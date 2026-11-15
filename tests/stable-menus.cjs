// Reopen an actual previous client on the same isolated origin before loading the release under test.
const assert=require("node:assert/strict");
const path=require("node:path"),{execFileSync}=require("node:child_process");
const {chromium,webkit}=require(process.env.PLAYWRIGHT_PATH||"playwright");
const root=path.resolve(__dirname,".."), old="a4a79b3";
const url=new URL(process.argv[2]||"http://127.0.0.1:8794/");
const capture=page=>page.evaluate(()=>{
  const current=offset,result=[];
  for(offset=0;offset<3;offset++){
    const w=plan(),rec=weekData(),tasks=prepWeek();
    result.push({menu:packMenuWeek(w),date:weekKey(),quote:weeklyQuote(w).cents,
      pantry:{...rec.pantry},cart:{...rec.cart},checks:tasks.map((t,d)=>prepDone(t,d)),prep:tasks.map(prepSignature)});
  }
  offset=current;plan();return result;
});
const mime={".js":"application/javascript",".css":"text/css",".html":"text/html",".json":"application/json"};
(async()=>{
  const b=process.env.WEBKIT?await webkit.launch():await chromium.launch({executablePath:process.env.CHROME_PATH});
  try{
    for(const pair of [false,true]){
      const ctx=await b.newContext({timezoneId:"Europe/Moscow",viewport:{width:393,height:852},isMobile:true,hasTouch:true});
      const p=await ctx.newPage(),errors=[];p.on("pageerror",e=>errors.push(e.message));p.setDefaultTimeout(12000);
      await p.clock.setFixedTime(new Date("2026-11-15T12:00:00+03:00"));
      let previous=true;
      const files=new Map();
      await p.route("**/*",async route=>{
        const u=new URL(route.request().url());
        if(u.origin!==url.origin)return route.abort();
        if(!previous)return route.continue();
        const name=decodeURIComponent(u.pathname.slice(url.pathname.length))||"index.html";
        const type=mime[path.extname(name)];
        if(!type)return route.continue();
        if(!files.has(name))files.set(name,execFileSync("git",["show",old+":"+name],{cwd:root,maxBuffer:8000000}));
        return route.fulfill({body:files.get(name),contentType:type});
      });
      await p.goto(url.href,{waitUntil:"domcontentloaded"});
      await p.evaluate(pair=>{
        const f=getFlow();Object.assign(f,{stage:3,who:pair?"two":"family",adults:2,small:pair?0:1,
          minutes:30,budget:5000,exclude:["legumes"],cuisines:["everyday","russian"],stores:["pyaterochka"],cook:[2,6]});
        for(const id of "rb062 rl052 rd009 rb027 lemonChickenSoup mushroomBuck buckapple rd120 rd123 rb026 nhPastaSalad ncTyurya herbOmelet rd065 rd105 rb020 rd139 rl035".split(" "))f.votes[id]=1;
        f.dessertPrefs={frequency:3,days:[],moment:"dinner",likes:["rb058"]};rememberFlow();render();
      },pair);
      await p.locator("#flow-form [type=submit]").click();await p.locator(".meal-card").first().waitFor();
      await p.evaluate(pair=>{
        if(pair)settings().portionTargets=[[[1250,1400],[95,105],[45,55],[100,130]],[[1750,1900],[140,160],[60,75],[140,170]]];
        for(offset=0;offset<3;offset++){
          const rec=weekData(),w=plan();
          if(offset===1)rec.replacements["day:0-0"]=w.days[3].meals[0].r.id;
          rec.cart={...rec.cart,rice:300};rec.pantry={...rec.pantry,salt:15};rec.prepDone={6:prepSignature(prepWeek()[6])};
        }
        offset=0;day=0;persist();render();
      },pair);
      const baseline=await capture(p);
      previous=false;
      await p.reload({waitUntil:"domcontentloaded"});await p.locator(".meal-card").first().waitFor();
      assert.deepEqual(await capture(p),baseline,"migration changed the previous release's plan");
      const btn=a=>p.locator('[data-action="'+a+'"]:visible').first();
      await btn("discover").click();
      const liked=await btn("taste-yes").getAttribute("data-id");await btn("taste-yes").click();await btn("save-tastes").click();await p.locator(".meal-card").first().waitFor();
      assert.equal(await p.evaluate(id=>settings().votes[id],liked),1);
      assert.deepEqual(await capture(p),baseline,"new like changed a saved week");
      async function limit(n){
        const details=p.locator("details.week-spending").first();
        if(!await details.evaluate(d=>d.open))await details.locator("summary").first().click();
        await btn("budget-edit").click();await p.locator('#budget-form input').fill(String(n));await p.locator('#budget-form [type=submit]').click();
        assert.deepEqual(await p.evaluate(()=>[0,1,2].map(n=>data.weeks[data.mode+"/"+weekKey(n)]?.budgetLimit||null)),[n,null,null]);
      }
      await limit(12000);assert.deepEqual(await capture(p),baseline,"raising limit changed meals");
      await limit(4200);await p.reload({waitUntil:"domcontentloaded"});assert.deepEqual(await capture(p),baseline,"lowering limit or reload changed meals");
      await p.locator("details.week-spending > summary").first().click();
      const choices=p.locator("[data-offer-index]");
      await p.locator('[data-budget-offer][data-state=ready]').waitFor();
      let changed=[];
      if(!pair){
        const n=await choices.count();assert.ok(n>=3,"expected a multi-item offer");
        assert.ok(await p.locator(".offer-prices").evaluate(el=>Boolean(el.compareDocumentPosition(el.parentNode.querySelector(".offer-choices"))&Node.DOCUMENT_POSITION_FOLLOWING)));
        for(let i=2;i<n;i++)await choices.nth(i).uncheck();
        const confirmed=await p.evaluate(()=>{const v=previewSelection(budgetSuggestion);return {edits:v.edits,price:v.after.cents};});
        assert.equal(confirmed.edits.length,2);
        const summary=await p.evaluate(()=>{const entry=budgetSuggestion,selected=previewSelection(entry);return {
          after:document.querySelector(".offer-prices > div:last-child strong").textContent,
          expected:"≈ "+money(selected.after.cents/100),status:document.querySelector(".budget-offer [aria-live]").textContent,
          gap:Math.max(0,selected.after.cents-entry.offer.limit)};});
        assert.equal(summary.after,summary.expected);
        assert.match(summary.status,summary.gap?/Сверх бюджета/:/В пределах бюджета/);
        assert.deepEqual(await capture(p),baseline,"preview modified the menu");
        await btn("budget-apply").click();await p.reload({waitUntil:"domcontentloaded"});
        const after=await capture(p);
        assert.deepEqual(after.slice(1),baseline.slice(1),"sibling week changed");
        for(const [d,row] of after[0].menu.days.entries())for(const [slot,m] of row.meals.entries()){
          const orig=baseline[0].menu.days[d].meals[slot], e=confirmed.edits.find(x=>x.d===d && x.slot===slot);
          if(e){assert.equal(orig.r,e.from);assert.equal(m.r,e.to);changed.push([d,slot]);}
          else assert.deepEqual(m,orig,"unconfirmed meal or portion changed");
        }
        assert.equal(changed.length,2);assert.equal(after[0].quote,confirmed.price);
        assert.deepEqual(after[0].cart,baseline[0].cart);assert.deepEqual(after[0].pantry,baseline[0].pantry);
      }
      const before=await capture(p);
      const confirmedSlot=await p.evaluate(()=>{
        const week=plan(),s=settings();
        return week.days[0].meals.slice(0,3).findIndex((m,slot)=>similarOptions(m.r,RECIPES.filter(x=>canPlace(s,x,slot)),s.votes,
          week.days[0].meals.filter((_,i)=>i!==slot).map(m=>m.r.id)).length>0);
      });
      assert.ok(confirmedSlot>=0,"no alternatives for any meal on day one");
      await p.locator('[data-action=swap][data-slot="'+confirmedSlot+'"]').click();await btn("choose-swap").click();
      if(pair){await p.locator('#sheet .swap-numbers summary').click();assert.equal(await p.locator('#sheet .swap-numbers p').count(),2);}
      assert.deepEqual(await capture(p),before);
      await btn("manual-apply").click();await p.reload({waitUntil:"domcontentloaded"});
      const after=await capture(p);assert.deepEqual(after.slice(1),before.slice(1));
      for(const [d,row] of before[0].menu.days.entries())for(const [slot,m] of row.meals.entries()){
        const next=after[0].menu.days[d].meals[slot];
        if(!d && slot===confirmedSlot)assert.notEqual(m.r,next.r);else assert.deepEqual(next,m);
      }
      assert.deepEqual(errors,[]);
      console.log(JSON.stringify({pair,old,dates:baseline.map(w=>w.date),meals:baseline.flatMap(w=>w.menu.days.flatMap(d=>d.meals)).length,
        budgetConfirmed:changed,manualConfirmed:1,originalRub:baseline[0].quote/100,otherWeeksIdentical:true}));
      await ctx.close();
    }
  }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
