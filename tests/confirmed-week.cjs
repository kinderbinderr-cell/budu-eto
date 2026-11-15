// Upgrade an isolated browser from the production revision that stored shortfalls as checkmarks.
const assert=require("node:assert/strict");
const {execFileSync}=require("node:child_process");
const {chromium,webkit}=require(process.env.PLAYWRIGHT_PATH||"playwright");
const root=require("node:path").resolve(__dirname,"..");
const url=new URL(process.argv[2]||"http://127.0.0.1:8794/");
const mini=process.env.MINI==="1";
const entry=url.href+(mini?"?mini=1#tgWebAppVersion=7.10&tgWebAppPlatform=ios":"");
const button=(p,a)=>p.locator('[data-action="'+a+'"]:visible').first();
const snapshot=p=>p.evaluate(()=>{
  const original=offset, weeks=[];
  for(offset=0;offset<3;offset++){
    const p=plan(),w=weekData();
    weeks.push({menu:fullWeekSnapshot(p),pantry:{...w.pantry},cart:{...w.cart},checks:prepWeek().map((t,i)=>[prepSignature(t),prepDone(t,i)])});
  }
  offset=original;plan();return weeks;
});
async function oldClient(p){
  const types={js:"application/javascript",html:"text/html",css:"text/css"};
  await p.route("**/*",async route=>{
    const u=new URL(route.request().url()),name=u.pathname.slice(url.pathname.length)||"index.html";
    const contentType=types[name.split(".").pop()];
    if(u.origin!==url.origin || !contentType)return route.continue();
    const body=execFileSync("git",["show","453c2e0:"+name],{cwd:root,maxBuffer:8e6});
    await route.fulfill({body,contentType});
  });
  await p.goto(entry,{waitUntil:"domcontentloaded"});
  await p.evaluate(()=>{
    const s=data.family;data.mode="family";data.quizDone=true;
    Object.assign(s,{adults:2,small:0,strictTaste:true,fromQuiz:true,rotateBatches:true,cuisines:[],stores:["pyaterochka"],
      cook:[0,2,4,6],budget:10000,budgetChosen:true,startDate:"2026-11-16",tasteAnchor:1,
      portionTargets:[[[1250,1400],[95,105],[45,55],[100,130]],[[1750,1900],[140,160],[60,75],[140,170]]]});
    for(const id of "wcRaggmunk rcRosolli neboorsok wmSoutzoukakia savoryOats wcKaalilaatikko rl065 rb021 rcRechta reDagKaai rd021 rd139 reDagShah rd003 reEuvy rd075 rb059 rl053".split(" "))s.votes[id]=1;
    protectMenus();
    for(offset=0;offset<3;offset++){
      const w=weekData();w.pantry.salt=100;w.cart={rice:50};w.paidStock={rice:50};
      if(offset===2){w.pantry.flour=neededGrams(plan().counts.flour)-245;w.cart.flour=245;w.paidStock.flour=245;}
      w.prepDone=Object.fromEntries(prepWeek().map((t,i)=>[i,prepSignature(t)]));
    }
    offset=0;day=0;persist();navTo("week");
  });
  const old=await snapshot(p);
  await p.unroute("**/*");await p.reload({waitUntil:"domcontentloaded"});
  await p.locator(".meal-card").first().waitFor();
  return old;
}
async function setStock(p,g){
  await button(p,"shopping-mode").waitFor();
  await p.locator('[data-action="shopping-mode"][data-value="home"]').click();
  await p.locator('[data-action="stock"][data-id="flour"]').click();
  await p.locator('#stock-form input').fill(String(g));await p.locator('#stock-form [type=submit]').click();
  await p.locator('[data-action="shopping-mode"][data-value="store"]').click();
}
(async()=>{
  const browser=mini?await webkit.launch():await chromium.launch({executablePath:process.env.CHROME_PATH});
  try{
    const p=await browser.newPage({timezoneId:"Europe/Moscow",isMobile:true,viewport:{width:430,height:932}}),errors=[];
    p.on("pageerror",e=>errors.push(e.message));p.setDefaultTimeout(18000);
    await p.clock.setFixedTime(new Date("2026-11-15T12:00:00+03:00"));
    const old=await oldClient(p);assert.deepEqual(await snapshot(p),old);
    await button(p,"portion-edit").click();
    await p.locator('[name="r-0-0-0"]').fill("1500");await p.locator('[name="r-0-0-1"]').fill("1650");
    await p.getByRole("button",{name:"Сохранить для будущих меню"}).click();
    await p.reload({waitUntil:"domcontentloaded"});
    assert.deepEqual(await snapshot(p),old);
    assert.deepEqual(await p.evaluate(()=>[settings().portionTargets,weekProfile(3).portionTargets,weekProfile(0).portionTargets].map(g=>g[0][0])),[[1500,1650],[1500,1650],[1250,1400]]);
    const preview=async()=>{
      await button(p,"portion-edit").click();await p.locator('[name="period"]').selectOption("1");
      await p.locator('button[name="preview"]').click();
      await p.getByRole("heading",{name:/Порции на/}).waitFor();
    };
    await preview();assert.deepEqual(await snapshot(p),old);await p.getByRole("button",{name:"Оставить как есть"}).click();
    await preview();assert.equal(await p.locator("#sheet details").first().locator("h3").count(),2);
    await button(p,"portion-apply").click();await p.reload({waitUntil:"domcontentloaded"});
    const changed=await snapshot(p);assert.deepEqual(changed[0],old[0]);assert.deepEqual(changed[2],old[2]);
    const ids=w=>w.menu.days.flatMap(d=>d.meals.map(m=>m.r));
    assert.deepEqual(ids(changed[1]),ids(old[1]));assert.notDeepEqual(changed[1].menu.counts,old[1].menu.counts);
    const daysChanged=changed[1].menu.days.filter((day,d)=>JSON.stringify(day.meals)!==JSON.stringify(old[1].menu.days[d].meals)).length;
    assert.ok(daysChanged>0);
    const goalRanges=()=>p.evaluate(()=>[0,1,2].map(i=>weekProfile(i).portionTargets[0][0]));
    assert.deepEqual(await goalRanges(),[[1250,1400],[1500,1650],[1250,1400]]);
    const flour=await p.evaluate(()=>neededGrams(plan().counts.flour));
    assert.ok(flour>385);
    await p.locator('#dock [href="#list"]').click();
    await setStock(p,flour-245);
    const unpicked=p.locator('[data-cart="flour"]:not(:checked)'),picked=p.locator('[data-cart="flour"]:checked');
    assert.match(await unpicked.locator("..").innerText(),/2 кг/);await unpicked.click();await picked.waitFor();
    const paid=await p.evaluate(()=>weekData().purchases.flour);assert.equal(paid.grams,2000);
    await setStock(p,flour-385);await p.reload({waitUntil:"domcontentloaded"});
    assert.equal(await picked.count(),1);assert.equal(await unpicked.count(),0);
    assert.deepEqual(await p.evaluate(()=>weekData().purchases.flour),paid);
    const amounts=await p.evaluate(()=>{
      const w=structuredClone(weekData());w.pantry={flour:315};w.cart={flour:2000};w.purchases={flour:w.purchases.flour};
      const score=budgetScorer({...settings(),stores:["pyaterochka"]});
      const quote=g=>score({flour:g},w.pantry,w.cart,w.purchases);
      return [outstandingGrams(w,"flour",700),outstandingGrams(w,"flour",2500),quote(700).cents,quote(2500).cents];
    });
    assert.deepEqual(amounts,[0,185,paid.cents,2*paid.cents]);
    // Reopen the exported three-week copy after different defaults were saved.
    await p.evaluate(()=>{const text=JSON.stringify(buildMenuCopy());applyMenuCopy({previous:localStorage.getItem(key),copy:parseMenuCopy(text)});});
    await p.waitForFunction(()=>!document.querySelector(".listpage") && document.querySelector(".meal-card"));await p.locator(".meal-card").first().waitFor();
    assert.deepEqual(await goalRanges(),[[1250,1400],[1500,1650],[1250,1400]]);
    assert.deepEqual(await p.evaluate(()=>weekData().purchases.flour),paid);
    assert.deepEqual((await snapshot(p)).slice(1),changed.slice(1));
    await p.locator('#dock [href="#list"]').click();
    await button(p,"next").click();await button(p,"next").click();
    const g3=await p.evaluate(()=>neededGrams(plan().counts.flour));
    await setStock(p,g3-385);assert.equal(await unpicked.count(),0);
    const clarify=p.locator('[data-action="purchase-edit"][data-id="flour"]');
    assert.match(await clarify.innerText(),/Уточнить/);await clarify.click();
    await p.locator('#purchase-form input').fill("200");await p.locator('#purchase-form [type=submit]').click();
    assert.match(await unpicked.locator("..").innerText(),/185 г/);await unpicked.click();
    assert.equal(await unpicked.count(),0);
    const accumulated=await p.evaluate(()=>weekData().purchases.flour);
    assert.equal(accumulated.grams,2200);assert.equal(accumulated.cents,2*paid.cents);
    await p.evaluate(()=>{settings().stores=["perekrestok"];persist();render();});
    await p.reload({waitUntil:"domcontentloaded"});
    assert.equal(await p.evaluate(()=>weekData(2).purchases.flour.cents),accumulated.cents);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({mini,old:"453c2e0",unchangedAfterSave:21,changedDays:[0,daysChanged,0],recipesChanged:0,
      gramsPurchased:paid.grams,priceRub:paid.cents/100,shortfalls:amounts.slice(0,2),copyRestored:true}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
