// MENU_COPY points to a private local export. Serve both releases inside the browser.
// Requests never leave this isolated origin, even for Telegram or analytics.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {execFileSync}=require("node:child_process");
const {chromium,webkit}=require(process.env.PLAYWRIGHT_PATH||"playwright");
const root=path.resolve(__dirname,".."), origin="https://menu-copy.test";
const oldRelease="c714452", input=process.env.MENU_COPY;
const mime={".js":"application/javascript",".css":"text/css",".html":"text/html",".json":"application/json",".webp":"image/webp",".woff2":"font/woff2"};
const mini=!!process.env.MINI;
async function checkCookingContinuity(p,action,original){
  const revision=await p.evaluate(()=>data.quizRun);
  await p.evaluate(raw=>applyMenuCopy({previous:localStorage.getItem(key),copy:parseMenuCopy(raw)}),original.toString());
  await p.waitForFunction(old=>typeof data!=="undefined" && data.quizRun!==old && document.querySelector(".meal-card"),revision);
  const visit=async n=>{
    while(await p.evaluate(()=>offset)<n)await action("next").click();
    while(await p.evaluate(()=>offset)>n)await action("prev").click();
  };
  const selectDay=d=>p.locator('[data-action="day"][data-day="'+d+'"]:visible').first().click();
  const selected=await p.evaluate(()=>{
    for(const schedule of [[2,5],[5],[3],[2],[0]]){
      settings().cook=schedule;
      for(let off=0;off<2;off++){
        const kitchen=kitchenWeek(weekProfile(off),plan(null,off),kitchenNextWeek(off),off);
        for(const [d,t] of kitchen.entries())for(const batch of t.cook.values())for(const u of batch.uses){
          if(u.slot!==2 || u.storage!=="freeze" || u.serve<7)continue;
          persist();render();
          return {off,d,serve:u.serve-7,slot:u.slot,id:u.r.id,title:u.r.title,f:u.f,k:u.r.items[0][0]};
        }
      }
    }
    throw Error("No actual dinner crosses the boundary on the test schedules");
  });
  await visit(selected.off);await selectDay(selected.d);
  await p.evaluate(k=>{addPurchase(k);persist();},selected.k);
  await action("prep-day").click();await p.locator("[data-prep-done]").check();await action("close").click();
  const source=()=>p.evaluate(s=>{
    const w=weekData(s.off),m=plan(null,s.off);
    const task=kitchenWeek(weekProfile(s.off),m,kitchenNextWeek(s.off),s.off)[s.d];
    return {cart:w.cart,purchases:w.purchases,check:w.prepDone,pantry:w.pantry,
      batch:task.cook.get(s.id)?.uses.map(prepUseKey),grams:Object.fromEntries(Object.entries(shoppingCounts(m,s.off)).map(([k,g])=>[k,Math.round(g*1000)]))};
  },selected);
  const before=await source();assert.ok(before.purchases[selected.k].cents>0);
  await visit(selected.off+1);await selectDay(selected.serve);
  const sizes=await p.evaluate(({serve:d,slot})=>{
    const base=plan(),meals=base.days[d].meals.slice(),old=meals[slot];
    meals[slot]={...old,f:old.f+.75,personFactors:old.personFactors?.map(g=>g*(old.f+.75)/old.f)};
    const changed=changeDayMeals(weekProfile(),base,d,meals);
    const t=kitchenWeek(weekProfile(),changed,kitchenNextWeek(offset),offset)[d];
    const extra=t.changes.find(c=>c.kind==="extra" && c.slot===slot);
    const k=old.r.items[0][0],added=shoppingCounts(changed)[k]-(shoppingCounts(base)[k]||0);
    return {ready:extra?.available,extra:extra?.f,added,expected:old.r.items.filter(i=>i[0]===k).reduce((n,i)=>n+i[1]*.75,0),
      cooked:t.cook.get(old.r.id)?.uses.filter(u=>u.serve===d && u.slot===slot).reduce((n,u)=>n+u.f,0)};
  },selected);
  assert.ok(Math.abs(sizes.ready-selected.f)<1e-6 && Math.abs(sizes.extra-.75)<1e-6 && Math.abs(sizes.cooked-.75)<1e-6);
  assert.ok(Math.abs(sizes.added-sizes.expected)<1e-6);
  const oldMeals=await p.evaluate(()=>[0,1,2].map(n=>fullWeekSnapshot(plan(null,n)).days));
  await p.locator('[data-action="swap"][data-slot="2"]').click();
  await action("choose-swap").click();assert.match(await p.locator("#sheet").innerText(),/морозилке/);
  assert.deepEqual(await source(),before);
  await action("manual-apply").click();assert.deepEqual(await source(),before);
  const differences=await p.evaluate(old=>old.flatMap((days,w)=>days.flatMap((d,i)=>d.meals.flatMap((m,j)=>
    JSON.stringify(m)!==JSON.stringify(fullWeekSnapshot(plan(null,w)).days[i].meals[j])?[[w,i,j]]:[]))),oldMeals);
  assert.deepEqual(differences,[[selected.off+1,selected.serve,2]]);
  await action("prep-day").click();assert.match(await p.locator("#sheet").innerText(),/останется в морозилке/);await action("close").click();
  await visit(2);
  const outgoing=()=>p.evaluate(()=>{
    const t=prepWeek();return t.flatMap((x,d)=>[...x.cook.values()].flatMap(b=>b.uses.filter(u=>u.serve>=7)
      .map(u=>({d,id:u.r.id,serve:u.serve-7,slot:u.slot,f:u.f}))));
  });
  const forecast=await outgoing();assert.ok(forecast.length);
  await selectDay(forecast[0].d);await action("prep-day").click();await p.locator("[data-prep-done]").check();await action("close").click();
  const locked=()=>p.evaluate(()=>[0,1,2].map(n=>{
    const record=data.weeks[plannedDate(n)],week=plan(null,n);
    return {menu:fullWeekSnapshot(week),receipt:record?.purchases,cart:record?.cart,pantry:record?.pantry,
      marks:record?.prepDone,grams:Object.fromEntries(Object.entries(shoppingCounts(week,n)).map(([k,g])=>[k,Math.round(g*1000)]))};
  }));
  const three=await locked();
  await action("discover").click();for(let i=0;i<8;i++)await action("taste-yes").click();
  await action("save-tastes").click();
  await visit(3);
  const incoming=await p.evaluate(rows=>rows.map(u=>{const m=plan().days[u.serve].meals[u.slot];return [m.r.id,m.f];}),forecast);
  assert.deepEqual(incoming,forecast.map(u=>[u.id,u.f]));
  await p.reload();await p.locator(".meal-card").first().waitFor();
  assert.deepEqual(await locked(),three);assert.deepEqual(await source(),before);
  await visit(2);await selectDay(forecast[0].d);await action("prep-day").click();
  assert.equal(await p.locator("[data-prep-done]").isChecked(),true);await action("close").click();
  const homeKey=await p.evaluate(()=>Object.entries(shoppingCounts(plan())).find(([k,g])=>g>600 && stockUnit(k).unit==="г")[0]);
  await p.locator('nav:visible a[href="#list"]').click();await action("shopping-mode","home").click();
  await p.locator('[data-action="stock"][data-id="'+homeKey+'"]').click();
  await p.locator("#stock-form input").fill("600");await p.locator("#stock-form [type=submit]").click();
  const tick=p.locator('[data-pantry="'+homeKey+'"]');
  await tick.check();await p.reload();await tick.uncheck();await p.reload();
  await tick.waitFor();
  assert.equal(await p.evaluate(k=>weekData().pantry[k],homeKey),600);
  return {dinner:selected.title,servings:selected.f,preservedWeekFourSlots:forecast.length,addedServing:sizes.extra};
}
async function main(){
  assert.ok(input,"Specify a local MENU_COPY file");
  const original=fs.readFileSync(input), backup=JSON.parse(original);
  const browser=mini?await webkit.launch():await chromium.launch({executablePath:process.env.CHROME_PATH});
  try {
    const ctx=await browser.newContext({timezoneId:"Europe/Moscow",viewport:{width:430,height:932},isMobile:true,hasTouch:true});
    let old=true;
    const files=new Map(), errors=[];
    await ctx.route("**/*",async route=>{
      const u=new URL(route.request().url());
      if(mini && u.origin==="https://telegram.org" && u.pathname==="/js/telegram-web-app.js")
        return route.fulfill({contentType:mime[".js"],body:'window.Telegram={WebApp:{platform:"ios",ready(){},expand(){},isVersionAtLeast(){return false}}}'});
      if(u.origin!==origin || route.request().method()!=="GET")return route.abort();
      const name=decodeURIComponent(u.pathname.slice(1))||"index.html";
      if(name.includes(".."))return route.abort();
      let body;
      if(old && !name.includes("/")){
        if(!files.has(name))files.set(name,execFileSync("git",["show",oldRelease+":"+name],{cwd:root,maxBuffer:8000000}));
        body=files.get(name);
      }else body=fs.readFileSync(path.join(root,name));
      return route.fulfill({body,contentType:mime[path.extname(name)]||"application/octet-stream"});
    });
    const p=await ctx.newPage();
    p.on("pageerror",e=>errors.push(e.message));
    p.setDefaultTimeout(15000);
    await p.clock.setFixedTime(new Date("2026-11-15T12:00:00+03:00"));
    await p.goto(origin+"/"+(mini?"?mini=1":""));
    const action=(a,v)=>p.locator('[data-action="'+a+'"]'+(v===undefined?'':'[data-value="'+v+'"]')+':visible').first();
    await action("copy-restore").click();
    await p.locator("[data-menu-copy-file]").setInputFiles({name:"menu.json",mimeType:"application/json",buffer:original});
    await action("copy-apply").click();
    await p.locator(".meal-card").first().waitFor();
    const capture=()=>p.evaluate(()=>{
      const {weeks,profile,forecast,anchor}=buildMenuCopy();
      return {weeks,profile,forecast,anchor};
    });
    const before=await capture();
    for(const [i,w] of backup.weeks.entries()){
      assert.deepEqual(before.weeks[i].plan.days,w.plan.days);
      assert.deepEqual(before.weeks[i].record,w.record);
    }
    old=false;
    await p.reload();await p.locator(".meal-card").first().waitFor();
    assert.deepEqual(await capture(),before,"Original three weeks changed on upgrade");
    const kitchen=await p.evaluate(()=>{
      const saved=offset,out=[];
      for(offset=0;offset<3;offset++){
        const w=plan(), tasks=prepWeek(), physical={};
        const sum=(r,f)=>{for(const [k,g] of r.items)physical[k]=(physical[k]||0)+g*f;};
        const crossings=[];
        for(const [d,t] of tasks.entries()){
          for(const batch of t.cook.values()){
            sum(batch.r,batch.factor);
            for(const u of batch.uses)if(u.serve>=7 && u.storage==="freeze")
              crossings.push([u.r.title,localDayKey(dateAt(d)),localDayKey(dateAt(u.serve))]);
          }
          if(!data.savedWeeks[plannedDate(offset-1)])for(const u of t.serve)if(u.cook<0)sum(u.r,u.f);
        }
        const groups=Object.fromEntries(groceryGroups(w).flatMap(group=>group.items.map(({k,g})=>[k,g])));
        const expected=Object.fromEntries(Object.entries(physical).map(([k,g])=>[k,neededGrams(g)]));
        const wanted=Object.fromEntries(requiredItems().map(({key,g})=>[key,g]));
        const expectedWanted=Object.fromEntries(Object.entries(expected).flatMap(([k,g])=>{
          const need=outstandingGrams(weekData(),k,g);return need?[[k,need]]:[];
        }));
        const quote=budgetScorer(settings())(physical,weekData().pantry,accountedPurchases(weekData(),physical),weekData().purchases);
        out.push({groups,expected,wanted,expectedWanted,cents:weeklyQuote(w).cents,expectedCents:quote.cents,crossings});
      }
      offset=saved;
      return out;
    });
    for(const w of kitchen){
      assert.deepEqual(w.groups,w.expected);
      assert.deepEqual(w.wanted,w.expectedWanted);
      assert.equal(w.cents,w.expectedCents);
    }
    await action("all-week").click();
    await action("jump-week",1).click();
    await action("overview-day").click();
    await action("sweet-open").click();
    await action("sweet-mode","days").click();
    await action("sweet-weekday",5).click();await action("sweet-weekday",6).click();
    await action("sweet-moment","lunch").click();
    await action("sweet-like").click();await action("sweet-save").click();
    await p.reload();await p.locator(".meal-card").first().waitFor();
    const after=await capture(), chosen=after.weeks[1];
    for(const i of [0,2])assert.deepEqual(after.weeks[i],before.weeks[i]);
    assert.deepEqual(after.profile,before.profile);
    assert.deepEqual(after.forecast,before.forecast);
    for(const [i,d] of chosen.plan.days.entries()){
      assert.deepEqual(d.meals.slice(0,3),before.weeks[1].plan.days[i].meals.slice(0,3));
      assert.equal(d.meals.length,i>=5?4:3);
      if(i>=5)assert.equal(d.meals[3].sweetMoment,"lunch");
    }
    await action("sweet-open").click();await action("sweet-mode","auto").click();
    await action("sweet-count",0).click();await action("sweet-save").click();
    const removed=await capture();
    assert.deepEqual(removed.weeks[1].plan.days,before.weeks[1].plan.days);
    for(const i of [0,2])assert.deepEqual(removed.weeks[i],before.weeks[i]);
    // Keep the recipes from the export. Only vary the cooking days on this test copy
    // to exercise an actual freezer handoff even when the original schedule has none.
    const edge=await p.evaluate(()=>{
      settings().cook=[2,5];
      const days=plan(null,1).days, tasks=prepWeekFor(0);
      function prepWeekFor(n){return kitchenWeek(weekProfile(n),plan(null,n),kitchenNextWeek(n),n);}
      const frozen=tasks.flatMap((t,d)=>[...t.cook.values()].flatMap(batch=>
        batch.uses.filter(u=>u.serve>=7 && u.storage==="freeze").map(u=>({d,u}))));
      if(!frozen.length)throw Error("Selected recipe set has no freezer handoff");
      const physical=n=>{
        const total={};
        const add=(r,f)=>{for(const [k,g] of r.items)total[k]=(total[k]||0)+g*f;};
        for(const t of prepWeekFor(n)){
          for(const batch of t.cook.values())add(batch.r,batch.factor);
          if(!data.savedWeeks[plannedDate(n-1)])for(const u of t.serve)if(u.cook<0)add(u.r,u.f);
        }
        return Object.fromEntries(Object.entries(total).map(([k,g])=>[k,neededGrams(g)]));
      };
      const expected=[0,1].map(physical),originalOffset=offset;
      const actual=[0,1].map(n=>{
        offset=n;const w=plan(), groups=groceryGroups(w);
        return Object.fromEntries(groups.flatMap(group=>group.items.map(({k,g})=>[k,g])));
      });
      offset=originalOffset;
      const {d,u}=frozen[0],next=days[u.serve-7].meals[u.slot];
      const packet=reminderPacket(3),first=openingWeek(settings());
      const remindersCorrect=packet[4].every(([cook,thaw],n)=>{
        const w=first+Math.floor(n/7),i=n%7,t=prepWeekFor(w)[i];
        const expectedCook=[...t.cook.values()].map(task=>[task.r.id,task.portions,task.uses.reduce((n,use)=>n+(use.storage==="freeze"?use.people:0),0)]);
        return JSON.stringify(expectedCook)===JSON.stringify(cook.map(([id,...rest])=>[packet[3][id],...rest])) &&
          JSON.stringify(t.thaw.map(use=>[use.r.id,use.people,use.slot]))===JSON.stringify(thaw.map(([id,...rest])=>[packet[3][id],...rest]));
      });
      const need=kitchenShopping(plan(null,1),1,kitchenNextWeek(1)).incoming,serveWeek=plan(null,1),buyWeek=plan(null,0);
      const product=Object.keys(need).find(k=>need[k]>0 && serveWeek.counts[k]<=2000);
      if(!product)throw Error("No ingredient fits a 2 kg test pack");
      const rec=weekData(1),before=shoppingCounts(buyWeek,0)[product];
      const pack=2000;rec.cart={[product]:pack};
      const afterOld=shoppingCounts(buyWeek,0)[product]||0;
      // Modern purchases in a later week cannot retrospectively change Saturday's list.
      rec.prepReceipts={};
      const afterNew=shoppingCounts(buyWeek,0)[product]||0;
      const receiptCorrect=Math.abs((before-afterOld)-need[product])<1e-6 && Math.abs(before-afterNew)<1e-6;
      return {expected,actual,remindersCorrect,receiptCorrect,example:{dish:u.r.title,cook:localDayKey(dateAt(d,0)),serve:localDayKey(dateAt(u.serve,0)),sameDish:next.r.id===u.r.id}};
    });
    assert.deepEqual(edge.actual,edge.expected);assert.ok(edge.remindersCorrect);assert.ok(edge.receiptCorrect);assert.ok(edge.example.sameDish);
    const continuity=await checkCookingContinuity(p,action,original);
    assert.deepEqual(fs.readFileSync(input),original);assert.deepEqual(errors,[]);
    console.log(JSON.stringify({mini,continuity,dates:before.weeks.map(w=>w.date),meals:before.weeks.flatMap(w=>w.plan.days.flatMap(d=>d.meals)).length,pantry:before.weeks.map(w=>Object.keys(w.record.pantry).length),dessertDays:[5,6],originalFreezerHandoffs:kitchen.flatMap(w=>w.crossings).length,testHandoff:edge.example,upgradeAndReload:true}));
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
