// Additional acceptance scenarios on the restored MENU_COPY browser profile.
const assert=require("node:assert/strict");

module.exports=async function stockAndServing(p,action){
  const go=async n=>{
    while(await p.evaluate(()=>offset)<n)await action("next").click();
    while(await p.evaluate(()=>offset)>n)await action("prev").click();
  };
  const dayButton=d=>p.locator('[data-action="day"][data-day="'+d+'"]:visible').first();
  const menus=()=>p.evaluate(()=>[0,1,2].map(n=>fullWeekSnapshot(plan(null,n))));
  const initial=await menus(), meals=plans=>plans.map(w=>w.days.map(d=>d.meals.map(m=>m.r)));
  const nav=name=>p.locator('nav:visible [href="#'+name+'"]').first().click();
  const source=await p.evaluate(()=>{
    const amount=n=>neededGrams(shoppingCounts(plan(null,n),n).potato);
    const first=amount(0),second=amount(1);
    if(first<388 || second<1200)throw Error("Fixture needs 388 g / 1,200 g of potatoes");
    function receipt(n,g){
      const w=weekData(n);w.prepReceipts={};(w.cart||={}).potato=g;
      (w.purchases||={}).potato={grams:g,weight:g,cents:g*5,weightSale:true,store:null,label:g+" г"};
    }
    weekData(0).pantry.potato=first-388;
    receipt(0,1700);if(second>1200)receipt(1,second-1200);
    persist();return {first,second,third:weekData(2).pantry.potato};
  });
  await nav("list");await action("shopping-mode","store").click();await go(1);
  const carry=p.locator('[data-action="carry-use"][data-id=potato]').first();
  await carry.click();
  assert.equal(await p.evaluate(()=>weekData(1).pantry.potato),1312);
  async function weight(g){
    await go(0);await p.locator('[data-action=purchase-edit][data-id=potato]').first().click();
    await p.locator('#purchase-form [name=qty]').fill(String(g));await p.locator('#purchase-form button').click();
    await go(1);
  }
  const shortfall=()=>p.evaluate(()=>outstandingGrams(weekData(), "potato", shoppingCounts(plan()).potato));
  await weight(900);await p.reload();await p.locator(".listpage").waitFor();
  assert.equal(await shortfall(),688);
  const row=await p.locator('[data-cart=potato]:not(:checked)').locator("..").innerText();
  assert.match(row,/Дома 512 г · Докупить 688 г/);
  assert.deepEqual(await menus(),initial);
  // Correcting one receipt keeps purchases already made in the following week.
  assert.equal(await p.evaluate(()=>weekData(2).pantry.potato),source.third);
  await p.locator('[data-action=purchase-edit][data-id=potato]').first().click();
  await p.locator('#purchase-form [name=qty]').fill(String(source.second-1200+500));
  await p.locator('#purchase-form button').click();
  assert.equal(await shortfall(),188);
  const receipt=await p.evaluate(()=>weekData(1).purchases.potato);
  await p.locator('[data-cart=potato]:not(:checked)').click();
  const extra=await p.evaluate(()=>weekData(1).purchases.potato.grams);
  assert.ok(extra>receipt.grams);

  // A confirmed chain recalculates each downstream week once.
  await go(2);
  // The third week already has weighed stock. Simulate a linked opening stock on
  // a separate branch of the test, then restore that week's original record.
  const originalThird=await p.evaluate(()=>{
    const w=weekData(2),original=JSON.stringify(w),off=1;
    setOpeningStock(w,"potato",weekKey(off),sourceStock("potato",off).available,"linked");
    persist();return original;
  });
  await weight(1700);
  assert.equal(await p.evaluate(()=>weekData(2).pantry.potato),Math.max(0,1312+extra-source.second));
  assert.equal(await p.evaluate(()=>weekData(1).purchases.potato.grams),extra);
  await p.evaluate(original=>{data.weeks[plannedDate(2)]=JSON.parse(original);persist();},originalThird);
  // Imported historical transfers have no provenance for manual weigh-ins.
  await go(1);
  await p.evaluate(()=>{
    const w=weekData();delete w.carryKind.potato;w.pantry.potato=600;persist();
  });
  await weight(900);await action("shopping-mode","home").click();
  assert.equal(await p.evaluate(()=>weekData().pantry.potato),600);
  const legacy=p.locator('.carry-line').filter({has:p.locator('[data-action=carry-use][data-id=potato]')});
  assert.match(await legacy.innerText(),/исправленной покупке выходит 512 г/);
  await legacy.getByRole('button',{name:'Учесть',exact:true}).click();
  await p.locator('[data-action=stock][data-id=potato]').click();await p.locator('#stock-form input').fill("600");
  await p.locator('#stock-form button').click();
  await action("shopping-mode","store").click();await weight(1700);
  assert.equal(await p.evaluate(()=>weekData().pantry.potato),600);
  assert.equal(await carry.count(),0);assert.deepEqual(await menus(),initial);

  await nav("week");await p.locator(".week-first .meal-card").first().waitFor();
  // Choose calorie inputs whose normal week solver produces an actual 77/23 split.
  const sample=await p.evaluate(()=>{
    const base=plan(),k=prepWeek();
    for(const [d,t] of k.entries())for(const batch of t.cook.values())for(const use of batch.uses){
      if(use.serve<=d || use.serve>=7 || use.slot>2)continue;
      const dayMeals=base.days[use.serve].meals;
      const choices=[];
      for(let kcal=1100;kcal<=3200;kcal+=25){
        const fs=fitDailyPortions(dayMeals,[[kcal,kcal],null,null,null]);choices.push([kcal,fs[use.slot]]);
      }
      for(const [low,a] of choices)for(const [high,b] of choices){
        if(Math.round(100*b/(a+b))===77)return {d,serve:use.serve,slot:use.slot,id:use.r.id,title:use.r.title,low,high};
      }
    }
    throw Error("No dated advance serving matched test proportions");
  });
  const edit=async (first,second)=>{
    if(await action('portion-edit').count())await action('portion-edit').click();
    else{await action('nutrition').click();await p.locator('#sheet [data-action=portion-edit]').click();}
    for(const [i,val] of [first,second].entries())for(const j of [0,1])
      await p.locator('[name="r-'+i+'-0-'+j+'"]').fill(String(val));
    await p.locator('[name=compare]').click();await action('portion-apply').click();
  };
  await edit(sample.low,sample.high);
  await dayButton(sample.d).click();await action('prep-day').click();await p.locator('[data-prep-done]').check();
  const checkedPanel=await p.locator('#sheet .prep-sheet').innerText();assert.match(checkedPanel,/Приготовлено \d+ блюд/);
  await action("close").click();
  const mark=await p.evaluate(d=>weekData().prepDone[d],sample.d);
  await dayButton(sample.serve).click();await edit(sample.high,sample.low);await p.reload();await go(1);
  await dayButton(sample.serve).click();await action('prep-day').click();
  const serveText=await p.locator('.prep-serve li').filter({hasText:sample.title}).first().innerText();
  assert.match(serveText,/первому 77%, второму 23%/);await action("close").click();
  await p.locator('.meal-card .dish-title').nth(sample.slot).click();
  const recipe=await p.locator('#sheet .sheet-body').innerText();
  assert.match(recipe,/Первая порция · 77%/);assert.match(recipe,/Вторая порция · 23%/);
  await action("close").click();assert.equal(await p.evaluate(d=>weekData().prepDone[d],sample.d),mark);
  const after=await menus();
  assert.deepEqual(meals(after),meals(initial));
  assert.deepEqual(after[0],initial[0]);assert.deepEqual(after[2],initial[2]);
  await go(3);await p.reload();assert.deepEqual(await menus(),after);
  return {shortfall:688,home:512,meal:sample.title,shares:[77,23],preservedSlots:meals(initial).flat(2).length};
};
