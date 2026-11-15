// From the repository root: PLAYWRIGHT_PATH=... CHROME_PATH=... node tests/sweet-week.cjs [URL]
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),path=require('node:path');
const url=process.argv[2] || require('node:url').pathToFileURL(path.resolve('index.html')).href;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 try{
 const p=await browser.newPage({viewport:{width:414,height:830},deviceScaleFactor:1.5});
 const errors=[], images=[];let agenda;
 p.on('pageerror',e=>errors.push(String(e)));
 if(process.env.MINI) await p.route('https://telegram.org/js/telegram-web-app.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.Telegram={WebApp:{platform:"ios",ready(){},expand(){},isVersionAtLeast(){return false}}}'}));
 await p.goto(url+(process.env.MINI?'?mini=1':''),{waitUntil:'domcontentloaded'});
 const b=(a)=>p.locator('[data-action="'+a+'"]');
 const shot=async(el,i)=>{if(process.env.PREVIEW){await p.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled([...document.querySelectorAll('dialog img,.meal-card img')].map(i=>i.decode()))}); images[i]=await el.screenshot();}};
 await p.evaluate(()=>{
   const f=getFlow();Object.assign(f,{stage:3,who:'two',minutes:0,budget:12000,cuisines:[]});
   for(const type of ['breakfast','lunch','dinner','either']) for(const r of RECIPES.filter(r=>mealRole(r)===type&&!dessertIds.has(r.id)).slice(0,6)) f.votes[r.id]=1;
   rememberFlow();render();
 });
 await b('sweet-open').click();
 assert.equal(await b('sweet-count').count(),8);
 await b('sweet-count').nth(3).click();assert.ok(await b('sweet-save').isDisabled());
 const ids=await b('sweet-like').evaluateAll(es=>es.map(e=>e.dataset.id));
 assert.ok(ids.length>=3);
 assert.ok(await b('sweet-like').locator('img').evaluateAll(async es=>(await Promise.all(es.map(async e=>{await e.decode();return e.naturalWidth>0}))).every(Boolean)));
 for(const el of [b('sweet-like').first(),b('sweet-like').nth(1)])await el.click();
 // If the user opens weekdays and leaves them blank, keep the chosen automatic frequency.
 await p.locator('[data-action=sweet-mode][data-value=days]').click();
 await b('sweet-weekday').nth(6).click();
 await b('sweet-weekday').nth(6).click();
 await shot(p.locator('#sheet'),1);
 await b('sweet-save').click();
 await p.reload({waitUntil:'domcontentloaded'});
 assert.match(await b('sweet-open').textContent(),/3 раза/);
 await p.locator('#flow-form [type=submit]').click();
 await p.locator('.meal-card').first().waitFor();
 const features=await p.evaluate((liked)=>{
   const s=settings(), expected=[1,3,5];
   const ok=(x,msg)=>{if(!x)throw Error(msg)};
   function inspect(w){
     const ds=[],counts={};
     for(const [d,day] of w.days.entries()){
       if(day.meals[3])ds.push(d);
       ok(day.meals.length===(expected.includes(d)?4:3),'frequency');
       if(expected.includes(d))ok(liked.includes(day.meals[3].r.id),'likes');
       ok(day.meals[1].r.id!==day.meals[2].r.id,'distinct mains');
       const macros=[0,0,0];
       for(const m of day.meals){
         for(const [key,g] of m.r.items)counts[key]=(counts[key]||0)+g*m.f;
         m.r.macros.forEach((x,i)=>macros[i]+=x*m.f);
       }
       ok(macros.every((x,i)=>Math.abs(x-w.macros[d][i])<1e-6),'macro rollup');
     }
     ok(Object.keys(counts).length===Object.keys(w.counts).length && Object.entries(counts).every(([k,g])=>Math.abs(w.counts[k]-g)<1e-6),'grocery rollup');
     return {days:ds, rub:budgetScorer(s)(counts).cents/100};
   }
   const three=Array.from({length:3},(_,i)=>inspect(plan(null,i)));
   const base=planWeek(s,0,{},new Map(),0,[]);
   for(let frequency=0;frequency<=7;frequency++){
     const t={...s,dessertPrefs:{frequency,likes:liked}};
     ok(Object.keys(sweetSchedule(t,0,base,sweetLikes(t))).length===frequency,'range '+frequency);
   }
   const plain={...s,dessertPrefs:undefined},off={...s,dessertPrefs:{frequency:0,likes:liked}};
   const build=t=>budgetPlan(t,0,{},new Map(),0,[]);
   ok(JSON.stringify(build(plain))===JSON.stringify(build(off)),'disabled profile changed');
   const restricted={...s,cuisines:[], votes:{...s.votes,[liked[0]]:-1,[liked[1]]:-1}};
   ok(build(restricted).days.every(d=>d.meals.length===3),'incompatible likes');
   // An empty pantry except for one sweet: at the same main menu, favour
   // the dessert already covered by stock over one requiring an extra pack.
   const pair=liked.map(byId);
   const pantry={...base.counts};for(const [k,g] of pair[1].items) pantry[k]=(pantry[k]||0)+g*servings(s)*dessertPortion;
   for(const key of Object.keys(pantry)) pantry[key]=neededGrams(pantry[key]);
   const tight={...s,budget:400,dessertPrefs:{frequency:1,likes:liked},planningPantry:{0:pantry}};
   const scorer=budgetScorer(tight,{planning:true});
   function cost(r){const c={...base.counts};for(const[k,g]of r.items)c[k]=(c[k]||0)+g*servings(s)*dessertPortion;return scorer(c,pantry).cents;}
   const costs=pair.map(cost);ok(costs[1]===0 && costs[0]>0,'test pantry differentiation '+costs);
   // If both are affordable, variation may win; when the base basket already
   // touches the limit, the difference must determine the dessert choice.
   const keys=Object.keys(base.counts).filter(k=>!pair.some(r=>r.items.some(([key])=>key===k)));
   for(const k of keys){delete pantry[k];if(cost(pair[1])>40000)break;}
   ok(cost(pair[0])>cost(pair[1]) && cost(pair[1])>40000,'binding spending limit');
   ok(sweetSchedule(tight,0,base,pair)[3]===pair[1].id,'basket-aware dessert choice');
   const goalTests=[];
   for(const who of [1,2]){
     const t={...s,mode:who===2?'family':'personal',adults:who,portionTargets:[[[1300,1550],[55,105],[30,80],[100,200]],[[1650,1980],[65,140],[40,95],[130,240]]].slice(0,who)};
     const w=build(t);inspect(w);
     const actual=swapDayTotals(w.days[1].meals,t.portionTargets);
     ok(actual.length===who && actual.every(row=>row.every(Number.isFinite)),'person totals');
     for(const d of w.days){
       const rep=swapDayScore(swapDayTotals(d.meals,t.portionTargets),t.portionTargets);
       if(who===2)ok(Math.abs(w.pairMisses[w.days.indexOf(d)]-Math.max(...rep.map(x=>x.worst)))<1e-5,'pair gap');
       ok(d.meals.every(m=>Math.abs(m.f-m.personFactors.reduce((a,b)=>a+b,0))<1e-8),'people portions');
     }
     goalTests.push(actual.map(row=>row.map(Math.round)));
   }
   const low={...s,budget:400};const expensive=build(low);
   ok(inspect(expensive).rub>400 && budgetBalance(low,budgetScorer(low)(expensive.counts)).includes('выше лимита'),'unattainable budget');
   return {three,goalTests};
 },ids.slice(0,2));
 await p.evaluate(()=>{day=1;render()});
 await p.locator('.meal-card').nth(3).waitFor();
 await shot(p.locator('.meal-card').nth(3),2);
 if(process.env.PREVIEW)agenda=await p.locator('.sweet-agenda').screenshot();
 await b('sweet-day').last().click();assert.equal(await p.evaluate(()=>day),5);await b('sweet-day').first().click();
 await p.locator('.meal-card').nth(3).locator('[data-action=dessert-open]').click();
 await shot(p.locator('#sheet'),0);
 await b('dessert-remove').click();await b('dessert-open').waitFor();assert.equal(await p.locator('.meal-card').count(),3);
 await p.reload({waitUntil:'domcontentloaded'});await p.evaluate(()=>{day=1;render()});assert.equal(await p.locator('.meal-card').count(),3);
 await b('dessert-open').click();await b('dessert-pick').nth(2).click();
 assert.equal(await p.evaluate(()=>plan().days[1].meals[3].r.id),ids[2]);
 await b('sweet-open').click();await b('sweet-count').first().click();await b('sweet-save').click();
 assert.equal(await p.evaluate(()=>plan().days.filter(d=>d.meals[3]).length),1);
 // Start from an existing profile and a legacy manually pinned dessert.
 await p.evaluate(id=>{weekData().desserts={1:id};persist();render()},ids[2]);
 assert.equal(await p.evaluate(()=>plan().days[1].meals[3].r.id),ids[2]);
 await b('sweet-open').click();
 const mode=value=>p.locator('[data-action=sweet-mode][data-value="'+value+'"]');
 const moment=value=>p.locator('[data-action=sweet-moment][data-value="'+value+'"]');
 await mode('days').click();
 await b('sweet-weekday').nth(5).click();await b('sweet-weekday').nth(6).click();
 await moment('lunch').click();
 await b('sweet-save').click();
 await p.reload({waitUntil:'domcontentloaded'});
 const slotsInView=()=>p.locator('.meal-card .dish-title').evaluateAll(es=>es.map(e=>Number(e.dataset.slot)));
 await b('sweet-day').last().click();
 assert.deepEqual(await slotsInView(),[0,1,3,2]);
 assert.deepEqual(await p.evaluate(()=>[0,1,2].map(i=>plan(null,i).days.flatMap((d,index)=>d.meals[3]?[index]:[]))),[[1,5,6],[5,6],[5,6]]);
 assert.match(await p.locator('.meal-card').nth(2).textContent(),/после обеда/);
 assert.match(await p.evaluate(()=>overviewWeek(plan())),/Десерт · после обеда/);
 const totals=()=>p.evaluate(()=>[plan().counts,plan().macros,weeklyQuote(plan()).cents]);
 const before=await totals();
 await b('dessert-open').click();await moment('breakfast').click();await b('sweet-apply-time').click();
 assert.deepEqual(await slotsInView(),[0,3,1,2]);assert.deepEqual(await totals(),before);
 assert.match(await p.evaluate(()=>prepDayPanel(prepWeek()[day])),/после завтрака/);
 await b('sweet-open').click();await mode('auto').click();await moment('snack').click();await b('sweet-save').click();
 assert.deepEqual(await p.evaluate(()=>plan().days.flatMap((d,i)=>d.meals[3]?[i]:[])),[1,5]);
 await b('sweet-day').last().click();
 assert.match(await p.locator('.meal-card').nth(2).textContent(),/на перекус/);
 assert.deepEqual(errors,[]);
 if(process.env.PREVIEW) {
   const board=await browser.newPage({viewport:{width:1260,height:1100},deviceScaleFactor:1.5});
   await board.setContent('<meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#efeee7;color:#263524;font:16px -apple-system,Arial,sans-serif}main{padding:32px}header{display:flex;justify-content:space-between;border-bottom:1px solid #c9cdbd;padding-bottom:15px;align-items:baseline}header strong{font-size:35px;letter-spacing:-1.4px}header span{font-weight:bold;color:#677359}section{display:grid;gap:22px;grid-template-columns:repeat(3,minmax(0,1fr))}figure{margin:20px 0 0}figure b{font-size:21px;letter-spacing:-.5px;display:block}figure p{font-size:16px;line-height:1.38;min-height:44px;margin:7px 0 13px}figure img{width:100%;display:block;outline:1px solid #d3d6c8;border-radius:14px}figure:nth-child(3) img{background:white}small{display:block;margin-top:20px;color:#626e59}</style><main><header><strong>Буду это · Что на сладкое?</strong><span>prod by. KBR</span></header><section>'+images.map((img,i)=>'<figure><b>'+['На один вечер','При составлении меню','В готовом меню'][i]+'</b><p>'+['Десерт можно вручную добавить или заменить в конкретном дне.','Выбираете частоту и отмечаете любимые десерты по фото.','Во вторник после ужина появилось выбранное сладкое.'][i]+'</p><img src="data:image/png;base64,'+img.toString('base64')+'">'+(i===2?'<img style="margin-top:14px" src="data:image/png;base64,'+agenda.toString('base64')+'">':'')+'</figure>').join('')+'</section><small>Экраны работающего приложения · пример для двоих</small></main>');
   await board.evaluate(async()=>Promise.all([...document.images].map(i=>i.decode())));
   await board.locator('main').screenshot({path:process.env.PREVIEW});
 }
 console.log(JSON.stringify(features));console.log('Passed: weekdays, automatic fallback, serving order, per-day timing, legacy overrides, all 8 frequencies, weekly distribution, exclusions, grocery and macro rollups, budget, edits, reload and 3 weeks');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
