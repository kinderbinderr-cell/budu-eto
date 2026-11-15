const assert=require("node:assert/strict");
const fs=require("node:fs/promises");

module.exports=async function dinnerAndBackup(p,action,cleanPage){
  const go=async n=>{
    while(await p.evaluate(()=>offset)<n)await action("next").click();
    while(await p.evaluate(()=>offset)>n)await action("prev").click();
  };
  const nav=async section=>{
    await p.locator('nav:visible a[href="#'+section+'"]').first().click();
    await p.locator(section==="week"?".week-first":".listpage").waitFor();
  };
  const snapshots=page=>page.evaluate(()=>[0,1,2].map(n=>fullWeekSnapshot(plan(null,n)).days));
  const initial=await snapshots(p);
  // This private export contains no weighed receipts. Exercise real dinner suggestions,
  // adding receipts to a disposable profile only. Keep every unrelated stock mark.
  await go(0);await p.locator('[data-action=day][data-day="0"]:visible').first().click();
  await action("prep-day").click();await p.locator("[data-prep-done]").check();await action("close").click();
  await go(1);
  const pick=await p.evaluate(()=>{
    const w=plan(),s=weekProfile(),g=neededGrams(shoppingCounts(w).chicken||0);
    const third=neededGrams(shoppingCounts(plan(null,2),2).chicken||0);
    const options=[];
    for(const [d,entry] of w.days.entries()){
      const m=entry.meals[2],others=entry.meals.filter((_,i)=>i!==2).map(m=>m.r.id);
      for(const {r} of similarOptions(m.r,RECIPES.filter(r=>canPlace(s,r,2)),s.votes,others).slice(0,8)){
        const next=swapOne(s,w,{d,slot:2,from:m.r.id},r);
        if(!next)continue;
        const after=neededGrams(shoppingCounts(next,1,w).chicken||0);
        if(after>g)options.push({d,id:r.id,meal:m.r.title,next:r.title,g,after,third});
      }
    }
    options.sort((a,b)=>Math.abs(a.after-a.g-350)-Math.abs(b.after-b.g-350));
    const sample=options[0];if(!sample || third<1500)throw Error("No suitable chicken dinner in this fixture: "+JSON.stringify({g,third,options:options.length}));
    function buy(n,grams){
      const rec=weekData(n);rec.prepReceipts||={};(rec.cart||={}).chicken=grams;
      (rec.purchases||={}).chicken={grams,weight:grams,cents:grams*35,weightSale:true,store:null,label:grams+" г"};
    }
    delete weekData(2).pantry.chicken;
    buy(1,sample.after+400);if(third>1500)buy(2,third-1500);
    persist();return sample;
  });
  await nav("list");await action("shopping-mode","store").click();await go(2);
  await p.locator('[data-action=carry-use][data-id=chicken]').first().click();
  const stock=page=>page.evaluate(()=>{
    const rec=weekData(2);
    return {home:rec.pantry.chicken,owe:outstandingGrams(rec,"chicken",shoppingCounts(plan(null,2),2).chicken)};
  });
  const old=await stock(p);assert.equal(old.home,pick.after+400-pick.g);
  const purchases=page=>page.evaluate(()=>[0,1,2].map(n=>{
    const w=weekData(n);return [w.cart,w.purchases,w.prepDone,Object.fromEntries(Object.entries(w.pantry).filter(([k])=>k!=="chicken"))];
  }));
  const records=await purchases(p);
  await nav("week");await go(1);await p.locator('[data-action=day][data-day="'+pick.d+'"]:visible').first().click();
  const preview=async()=>{
    await p.locator('[data-action=swap][data-slot="2"]:visible').first().click();
    await p.locator('[data-action=choose-swap][data-id="'+pick.id+'"]').click();
    assert.match(await p.locator("#sheet").innerText(),/останется 400 г/);
  };
  await preview();await action("close").click();assert.deepEqual(await stock(p),old);
  assert.deepEqual(await snapshots(p),initial);
  await preview();await action("manual-apply").click();
  const changed=await snapshots(p);
  const differences=initial.flatMap((week,n)=>week.flatMap((day,d)=>day.meals.flatMap((m,i)=>
    JSON.stringify(m)!==JSON.stringify(changed[n][d].meals[i])?[[n,d,i]]:[])));
  assert.deepEqual(differences,[[1,pick.d,2]]);assert.deepEqual(await purchases(p),records);
  await nav("list");await go(2);
  assert.deepEqual(await stock(p),{home:400,owe:1100});
  const row=await p.locator('[data-cart=chicken]:not(:checked)').locator("..").innerText();
  assert.match(row.replace(/\s/g,""),/Докупить1100г/);
  await action("shopping-mode","home").click();
  const tick=p.locator('[data-pantry=chicken]');
  await tick.check();await tick.uncheck();assert.deepEqual(await stock(p),{home:400,owe:1100});
  // An automatically checked transferred balance has no previous manual value.
  // Cancel preserves that weight. Confirming a new measurement also survives export.
  await p.evaluate(()=>{
    const s=weekData(1),r=s.purchases.chicken;
    r.grams+=1450;r.weight+=1450;s.cart.chicken=r.grams;refreshCarriedStock("chicken",1);
    persist();render();
  });
  assert.ok(await tick.isChecked());await tick.click();
  assert.equal(await p.locator("#stock-form input").inputValue(),"1850");
  await action("close").click();assert.ok(await tick.isChecked());
  assert.equal((await stock(p)).home,1850);
  await tick.click();await p.locator("#stock-form input").fill("400");await p.locator("#stock-form button").click();
  assert.deepEqual(await stock(p),{home:400,owe:1100});
  const snapshot=page=>page.evaluate(()=>{const {weeks,forecast,profile,anchor}=buildMenuCopy();return {weeks,forecast,profile,anchor};});
  const saved=await snapshot(p);
  await action("settings").click();await action("copy-save").click();
  await p.evaluate(()=>Object.defineProperty(navigator,"canShare",{configurable:true,value:()=>false}));
  const download=p.waitForEvent("download");await action("copy-file").click();
  const bytes=await fs.readFile(await (await download).path());
  const t=await cleanPage();
  await t.locator('[data-action=copy-restore]:visible').first().click();
  await t.locator("[data-menu-copy-file]").setInputFiles({name:"menu.json",mimeType:"application/json",buffer:bytes});
  await t.locator('[data-action=copy-apply]:visible').first().click();
  await t.locator(".meal-card").first().waitFor();await t.reload();await t.locator(".meal-card").first().waitFor();
  assert.deepEqual(await snapshot(t),saved);assert.deepEqual(await stock(t),{home:400,owe:1100});
  assert.deepEqual(await snapshots(t),changed);assert.ok(saved.weeks[0].record.prepDone[0]);
  for(let i=await t.evaluate(()=>offset);i<3;i++)await t.locator('[data-action=next]:visible').first().click();
  assert.deepEqual(await snapshots(t),changed);
  assert.deepEqual(await purchases(t),await purchases(p));
  // Old releases could leave just the dated link after unchecking an automatic stock.
  await t.evaluate(()=>{
    const w=weekData(2);delete w.pantry.chicken;delete w.pantryBeforeCheck?.chicken;
    refreshCarriedStock("chicken",1);
    const record=copyWeekRecord(w);
    if(Object.hasOwn(record.pantry,"chicken") || !record.carryFrom.chicken)throw Error("Unknown balance was fabricated");
    const invalid={...record,carryFrom:{badFood:weekKey(1)}};
    let rejected=false;try{copyWeekRecord(invalid);}catch{rejected=true;}
    if(!rejected)throw Error("Invalid food key admitted");
  });
  await t.context().close();
  return {sourceNeed:[pick.g,pick.after],bought:pick.after+400,followingNeed:pick.third,previouslyPurchased:pick.third-1500,home:400,owe:1100,changedMeals:differences.length,restoredMeals:63};
};
