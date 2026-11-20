const assert = require("node:assert/strict");
const {chromium,webkit} = require(process.env.PLAYWRIGHT_PATH || "playwright");

(async () => {
  const browser = process.env.WEBKIT ? await webkit.launch() : await chromium.launch({executablePath:process.env.CHROME_PATH});
  try {
    const page = await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.setFixedTime(new Date("2026-11-20T12:00:00+03:00"));
    await page.goto(process.argv[2] || "http://127.0.0.1:8794/");
    await page.evaluate(() => {
      const f = getFlow();
      Object.assign(f,{stage:3,who:"two",minutes:30,cook:[2,6]});
      for (const id of "rb062 rl052 rd009 rb027 lemonChickenSoup mushroomBuck buckapple rd120 rd123 rb026 nhPastaSalad ncTyurya herbOmelet rd065 rd105 rb020 rd139 rl035".split(" ")) f.votes[id] = 1;
      rememberFlow();
      render();
    });
    const city = page.locator('[name="price-city"]');
    const amount = page.locator('[name="weekly-budget"]');
    const shops = page.locator("[data-flow-stores]");
    assert.equal(await city.inputValue(),"russia");
    assert.equal(await shops.isVisible(),false);
    await amount.fill("5000");
    await city.selectOption("moscow");
    assert.equal(await shops.isVisible(),true);
    await shops.locator('[data-action="flow-store"][data-value="pyaterochka"]').click();
    await city.selectOption("kazan");
    assert.equal(await shops.isVisible(),false);
    assert.equal(await amount.inputValue(),"5000");
    await city.selectOption("tyumen");
    assert.match(await page.locator("[data-price-city-source]").textContent(),/по городу.*\d{2}\.\d{2}\.20\d{2}/);
    await city.selectOption("kazan");
    await page.reload();
    assert.equal(await city.inputValue(),"kazan");
    assert.match(await page.locator("[data-price-city-source]").textContent(),/по городу.*\d{2}\.\d{2}\.20\d{2}/);
    await page.locator('#flow-form [type="submit"]').click();
    await page.locator(".meal-card").first().waitFor();

    const opening = await page.evaluate(() => {
      const p = plan(), item = Object.keys(shoppingCounts(p))[0];
      addPurchase(item);
      persist();
      render();
      const basket = {egg:500,milk:1030,potato:1000};
      return {
        scores:Object.fromEntries(["kazan","petersburg","moscow"].map(id=>[
          id,budgetScorer({priceCity:{id},stores:["pyaterochka"]})(basket),
        ])),
        prices:{
          cities:localGroceryPrices.size,
          regions:regionalGroceryPrices.size,
          local:observedPrice("potato",{id:"kirov"}),
          general:observedPrice("potato",{id:"other",name:"Киров, Калужская область"}),
          regional:observedPrice("potato",{id:"other",name:"Рыбинск"}),
          outsideCoverage:observedPrice("chicken",{id:"tyumen"}),
          mixed:budgetScorer({priceCity:{id:"tomsk"}})({...basket,flour:100}),
        },
        menus:[0,1,2].map(off=>data.savedWeeks[plannedDate(off)]),
        purchases:weekData().purchases,
        quote:weeklyQuote(p).cents,
      };
    });
    assert.equal(opening.scores.kazan.local,3);
    assert.equal(opening.scores.kazan.store,null);
    assert.equal(opening.scores.petersburg.local,3);
    assert.equal(opening.scores.petersburg.store,null);
    assert.equal(opening.scores.moscow.store,"pyaterochka");
    assert.notEqual(opening.scores.kazan.cents,opening.scores.petersburg.cents);
    assert.ok(opening.prices.cities>=21);
    assert.ok(opening.prices.regions>=8);
    assert.equal(opening.prices.local.scope,"local");
    assert.equal(opening.prices.general.scope,"national");
    assert.equal(opening.prices.regional.scope,"regional");
    assert.equal(opening.prices.outsideCoverage,null);
    assert.ok(opening.prices.mixed.local>=3);
    assert.equal(opening.prices.mixed.local+opening.prices.mixed.national,4);
    await page.locator("details.week-spending > summary").first().click();
    await page.locator('[data-action="budget-edit"]').click();
    await city.selectOption("other");
    const cityName=page.locator('[name="price-city-name"]');
    const results=page.locator("[data-city-results]");
    await cityName.fill("Киров");
    assert.equal(await results.getByRole("button",{name:"Киров Калужская область",exact:true}).count(),1);
    await results.getByRole("button",{name:"Киров Кировская область",exact:true}).click();
    assert.match(await page.locator("[data-price-city-source]").textContent(),/по городу/);
    await cityName.fill("Рыби");
    await results.getByRole("button",{name:"Рыбинск Ярославская область",exact:true}).click();
    assert.equal(await cityName.inputValue(),"Рыбинск");
    assert.match(await page.locator("[data-price-city-source]").textContent(),/по Ярославской области/);
    await cityName.fill("Сеге");
    if(process.env.CITY_SCREENSHOT) {
      await cityName.scrollIntoViewIfNeeded();
      await page.screenshot({path:process.env.CITY_SCREENSHOT});
    }
    await results.getByRole("button",{name:"Сегежа Республика Карелия",exact:true}).click();
    await page.locator('#budget-form [type="submit"]').click();
    await page.reload();
    const after = await page.evaluate(() => ({
      menus:[0,1,2].map(off=>data.savedWeeks[plannedDate(off)]),
      purchases:weekData().purchases,
      quote:weeklyQuote(plan()).cents,
      city:settings().priceCity,
      copy:copyProfile(settings()).priceCity,
      source:document.querySelector("[data-budget-source]").textContent,
    }));
    assert.deepEqual(after.city,{id:"other",name:"Сегежа"});
    assert.deepEqual(after.copy,after.city);
    assert.deepEqual(after.menus,opening.menus);
    assert.deepEqual(after.purchases,opening.purchases);
    assert.notEqual(after.quote,opening.quote);
    assert.match(after.source,/Сегежа.*по России.*\d{2}\.\d{2}\.20\d{2}/);
    await page.route("**/data/daily-grocery-prices.js",async route=>{
      const response=await route.fetch(), prefix="const dailyGroceryPrices = ";
      const snapshot=JSON.parse((await response.text()).trim().slice(prefix.length,-1));
      for(const key of Object.keys(snapshot.national.rates)) snapshot.national.rates[key]*=2;
      await route.fulfill({response,body:prefix+JSON.stringify(snapshot)+";"});
    });
    await page.reload();
    const repriced=await page.evaluate(()=>({
      quote:weeklyQuote(plan()).cents,
      menus:[0,1,2].map(off=>data.savedWeeks[plannedDate(off)]),
      purchases:weekData().purchases,
    }));
    assert.ok(repriced.quote>after.quote);
    assert.deepEqual(repriced.menus,after.menus);
    assert.deepEqual(repriced.purchases,after.purchases);
    assert.deepEqual(errors,[]);
    console.log("PASS city selection, dated sources, reload, menu and purchase preservation");
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error);process.exitCode=1;});
