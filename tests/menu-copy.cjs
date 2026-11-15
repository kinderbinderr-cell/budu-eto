// Exercise a portable backup across isolated browser stores and a change of date.
const assert=require("node:assert/strict");
const fs=require("node:fs/promises");
const path=require("node:path");
const {chromium,webkit}=require(process.env.PLAYWRIGHT_PATH||"playwright");
const url=process.argv[2]||require("node:url").pathToFileURL(path.resolve("index.html")).href;
const button=(page,action)=>page.locator('[data-action="'+action+'"]:visible').first();
const capture=p=>p.evaluate(()=>{
  const saved=offset, out=[];
  for(offset=0;offset<3;offset++){
    const w=plan(), record=weekData(), tasks=prepWeek();
    out.push({date:weekKey(),plan:packMenuWeek(w),pantry:record.pantry,cart:record.cart,desserts:record.desserts,
      replacements:record.replacements,budgetEdits:record.budgetEdits,prepDone:tasks.map((t,i)=>prepDone(t,i)),cartChecked:Object.keys(record.cart).map(k=>cartHas(k,w.counts[k]))});
  }
  offset=saved;return out;
});
(async()=>{
 const browser=process.env.WEBKIT ? await webkit.launch() : await chromium.launch({executablePath:process.env.CHROME_PATH});
 try{
  for(const legacy of [false,true]){
   const errors=[];
   async function open(date){
     const ctx=await browser.newContext({timezoneId:"Europe/Moscow",viewport:{width:393,height:852},hasTouch:true,isMobile:true});
     const p=await ctx.newPage();p.setDefaultTimeout(7000);p.on("pageerror",e=>errors.push(e.message));
     if(process.env.MINI)await p.route("https://telegram.org/js/telegram-web-app.js*",r=>r.fulfill({contentType:"text/javascript",body:'window.Telegram={WebApp:{platform:"ios",ready(){},expand(){},isVersionAtLeast(){return false}}}'}));
     await p.clock.setFixedTime(new Date(date+"T12:00:00+03:00"));
     await p.goto(url,{waitUntil:"domcontentloaded"});return p;
   }
   const p=await open("2026-11-15");
   await p.evaluate(legacy=>{
     const f=getFlow();Object.assign(f,{stage:3,who:legacy?"self":"two",minutes:0,budget:8500,cuisines:[],stores:["pyaterochka"]});
     for(const role of ["breakfast","lunch","dinner","either"])
       for(const r of RECIPES.filter(r=>mealRole(r)===role).slice(0,8))f.votes[r.id]=1;
     f.dessertPrefs={frequency:2,days:[5,6],moment:"snack",likes:["rb082"]};
     render();
   },legacy);
   await p.locator("#flow-form [type=submit]").click();await p.locator(".meal-card").first().waitFor();
   await p.evaluate(legacy=>{
     if(legacy){delete settings().startDate;delete settings().tasteAnchor;}
     else settings().portionTargets=[[[1250,1400],[95,105],[45,55],[100,130]],[[1750,1900],[140,160],[60,75],[140,170]]];
     for(offset=0;offset<3;offset++){
       const rec=weekData(),w=plan();
       rec.replacements["day:1-0"]=w.days[3].meals[0].r.id;
       rec.desserts={2:{id:"rb082",moment:"lunch"}};
       const items=Object.entries(plan().counts);rec.pantry[items[0][0]]=neededGrams(items[0][1]);
       rec.cart={[items[1][0]]:neededGrams(items[1][1])};
     }
     if(!legacy){
       offset=0;
       const w=plan(),from=w.days[4].meals[1].r.id;
       const recipes=new Map(RECIPES.map(r=>[r.id,r]));
       for(const id of Object.keys(settings().votes)){
         const edit={d:4,slot:1,from,to:id};
         if(id!==from && budgetMealEdit(settings(),w,edit,[],recipes,activePortionTargets(settings()))){
           weekData().budgetEdits=[edit];break;
         }
       }
       if(!weekData().budgetEdits) throw Error("No budget replacement in fixture");
     }
     for(offset=0;offset<3;offset++)weekData().prepDone={1:prepSignature(prepWeek()[1])};
     offset=1;day=1;persist();render();
   },legacy);
   const before=await capture(p);
   await button(p,"settings").click();await button(p,"copy-save").click();
   await p.locator(".menu-copy").waitFor();
   // Capture the exact file passed to an OS share sheet, then exercise browser download too.
   await p.evaluate(()=>{Object.defineProperties(navigator,{
     canShare:{configurable:true,value:()=>true},share:{configurable:true,value:async({files})=>window.sharedCopy=await files[0].text()}
   });});
   await button(p,"copy-file").click();await p.waitForFunction(()=>window.sharedCopy);
   const shared=await p.evaluate(()=>{Object.defineProperty(navigator,"canShare",{value:()=>false,configurable:true});return window.sharedCopy;});
   const download=p.waitForEvent("download");await button(p,"copy-file").click();
   const text=await fs.readFile(await (await download).path(),"utf8");
   assert.equal(text,shared);assert.equal(JSON.parse(text).weeks[0].date,before[0].date);
   await p.context().close();
   const t=await open("2026-12-18");
   await button(t,"copy-restore").click();
   const file=content=>t.locator("[data-menu-copy-file]").setInputFiles({name:"menu.json",mimeType:"application/json",buffer:Buffer.from(content)});
   await file('{"truncated":');await t.locator(".copy-feedback").filter({hasText:"прочитать"}).waitFor();
   const damaged=JSON.parse(text);damaged.weeks[0].plan.days[0].meals[0].r="missing-recipe";await file(JSON.stringify(damaged));
   await t.locator(".copy-feedback").filter({hasText:"повреждены"}).waitFor();
   const lost=JSON.parse(text);lost.weeks[0].record.cart={};await file(JSON.stringify(lost));
   await t.locator(".copy-feedback").filter({hasText:"неполная"}).waitFor();
   await file(text);await button(t,"copy-apply").waitFor();assert.equal(await t.locator(".copy-weeks li").count(),3);
   assert.equal(await t.evaluate(()=>localStorage.getItem(key)),null);
   await button(t,"close").last().click();await t.locator("dialog[open]").waitFor({state:"hidden"});
   await button(t,"copy-restore").click();await t.locator(".menu-copy summary").click();await t.locator("[data-menu-copy-text]").fill(text);await button(t,"copy-read").click();
   if(process.env.COPY_SCREEN && !legacy)await t.locator("#sheet").screenshot({path:process.env.COPY_SCREEN});
   await t.evaluate(()=>{const write=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new Error('full');return write.call(this,k,v);};window.releaseStorage=()=>Storage.prototype.setItem=write;});
   await button(t,"copy-apply").click();await t.locator(".copy-feedback").filter({hasText:"место"}).waitFor();
   assert.equal(await t.evaluate(()=>localStorage.getItem(key)),null);await t.evaluate(()=>releaseStorage());
   await button(t,"copy-apply").click();await t.locator(".meal-card").first().waitFor();
   assert.equal(await t.evaluate(()=>weekKey()),before[0].date);
   assert.deepEqual(await capture(t),before);
   await t.reload({waitUntil:"domcontentloaded"});assert.deepEqual(await capture(t),before);
   // Restored meals are exact even when a newly calculated menu would change.
   await t.evaluate(()=>{lastPlan=null;adjacentPlan=null;const old=budgetPlan;budgetPlan=(...args)=>{const p=old(...args);return {...p,cost:99999999};};});
   assert.deepEqual(await capture(t),before);
   // Restore over an existing menu from Settings, preserve unrelated dates and the other profile.
   const kept=await t.evaluate(()=>{
     const other=data.mode==="family"?"personal":"family"; data[other].budget=7591;
     const unrelated=data.mode+"/2027-1-4";data.weeks[unrelated]={replacements:{},pantry:{milk:790}};
     offset=0;weekData().pantry={};persist();return {other,unrelated};
   });
   await button(t,"settings").click();await button(t,"copy-restore").click();await file(text);
   await button(t,"copy-apply").waitFor();await t.evaluate(()=>{const fresh=JSON.parse(localStorage.getItem(key));fresh.favorites=["rb073"];localStorage.setItem(key,JSON.stringify(fresh));});
   await button(t,"copy-apply").click();
   await t.locator(".copy-feedback").filter({hasText:"измениться"}).waitFor();
   await button(t,"close").click();await t.locator("dialog[open]").waitFor({state:"hidden"});
   await button(t,"copy-restore").click();await file(text);await button(t,"copy-apply").click();await t.locator(".meal-card").first().waitFor();
   assert.deepEqual(await capture(t),before);
   assert.deepEqual(await t.evaluate(({other,unrelated})=>[data[other].budget,data.weeks[unrelated].pantry.milk,data.favorites],kept),[7591,790,["rb073"]]);
   assert.deepEqual(errors,[]);await t.context().close();
   console.log("PASS "+(legacy?"undated legacy personal plan":"dated two-person plan")+" — 21 days, portions, shopping, swaps, prep, mobile download and restore, cancel, errors, reload");
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
