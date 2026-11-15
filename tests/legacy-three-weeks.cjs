// Compare the last released client with the new code in one browser and storage origin.
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const oldRelease='a121c18';
const origin='https://upgrade.test';
const contentType={'.js':'application/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.json':'application/json','.woff2':'font/woff2'};
async function capture(page){
  return page.evaluate(()=>{
    const weeks=[];
    for(offset=0;offset<3;offset++){
      const p=plan(), record=weekData(), tasks=prepWeek();
      weeks.push({
        dates:p.days.map((_,i)=>dateAt(i).toISOString()),cost:p.cost,
        days:p.days.map(d=>d.meals.map(({r,...meal})=>({id:r.id,title:r.title,items:r.items,kcal:r.kcal,macros:r.macros,...meal}))),
        macros:p.macros,pairMisses:p.pairMisses,counts:p.counts,quote:weeklyQuote(p),record:structuredClone(record),
        prep:tasks.map((t,i)=>[prepSignature(t),prepDone(t,i)])
      });
    }
    offset=0;
    return {raw:localStorage.getItem(key),weeks};
  });
}
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH});
  try {
    const page=await browser.newPage({timezoneId:'Europe/Moscow',viewport:{width:430,height:932}});
    // Sunday here and Monday after the upgrade cover the calendar-week boundary.
    await page.clock.setFixedTime(new Date('2026-11-15T12:00:00+03:00'));
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    let old=true;
    const oldFiles=new Map();
    await page.route('**/*',async r=>{
      const url=new URL(r.request().url());
      if(url.origin!==origin) return r.abort();
      const name=decodeURIComponent(url.pathname.slice(1))||'index.html';
      if(name.includes('..'))return r.abort();
      try{
        let body;
        if(old && !name.includes('/')){
          if(!oldFiles.has(name))oldFiles.set(name,execFileSync('git',['show',oldRelease+':'+name],{cwd:root,maxBuffer:8000000}));
          body=oldFiles.get(name);
        }else body=readFileSync(path.join(root,name));
        await r.fulfill({body,contentType:contentType[path.extname(name)]||'application/octet-stream'});
      }catch{return r.fulfill({status:404,body:''});}
    });
    await page.goto(origin);
    await page.evaluate(()=>{
      const f=getFlow();
      Object.assign(f,{stage:3,who:'two',minutes:0,budget:11000,cuisines:[],stores:['pyaterochka'],cook:[1,4]});
      for(const role of ['breakfast','lunch','dinner','either'])
        for(const r of RECIPES.filter(r=>mealRole(r)===role && !dessertIds.has(r.id)).slice(0,9))f.votes[r.id]=1;
      f.votes.rb073=1;
      f.dessertPrefs={frequency:2,days:[5,6],moment:'lunch',likes:['rb063','rb082']};
      rememberFlow();render();
    });
    await page.locator('#flow-form [type=submit]').click();
    await page.locator('.meal-card').first().waitFor();
    await page.evaluate(()=>{
      settings().portionTargets=[[[1250,1400],[95,105],[45,55],[100,130]],[[1750,1900],[140,160],[60,75],[140,170]]];
      for(offset=0;offset<3;offset++){
        const record=weekData();
        record.replacements['day:0-0']='rb073';
        record.desserts={5:{id:'rb082',moment:'snack'}};
        const p=plan();
        if(p.days[0].meals[0].r.id!=='rb073')throw Error('original manual breakfast not applied');
        for(const [k,g] of Object.entries(p.counts).slice(0,4))record.pantry[k]=neededGrams(g);
        // Store a real accepted budget edit, so restoration has to replay both types of overrides.
        const recipes=new Map(RECIPES.map(r=>[r.id,r])), from=p.days[3].meals[1].r.id;
        for(const to of Object.keys(settings().votes)){
          if(to===from)continue;
          const edit={d:3,slot:1,from,to};
          if(budgetMealEdit(settings(),p,edit,[],recipes,activePortionTargets(settings()))){
            record.budgetEdits=[edit];break;
          }
        }
        record.prepDone={2:prepSignature(prepWeek()[2])};
      }
      offset=0;data.favorites=['rb073'];persist();
    });
    const previous=await capture(page);
    assert.ok(previous.weeks.every(w=>w.prep[2][1] && Object.keys(w.record.pantry).length===4));
    assert.ok(previous.weeks.some(w=>w.record.budgetEdits?.length));
    old=false;
    for(let reload=0;reload<2;reload++){
      await page.reload();await page.locator('.meal-card').first().waitFor();
      assert.deepEqual(await capture(page),previous,'Three saved weeks changed on reload '+reload);
    }
    await page.evaluate(()=>{history.pushState({foodQuiz:true,snapshot:{stage:3,run:data.quizRun}},'','#start');});
    await page.reload();
    await page.locator('.meal-card').first().waitFor();
    assert.deepEqual(await capture(page),previous,'Stale questionnaire history overwrote the menu');
    await page.clock.setFixedTime(new Date('2026-11-16T12:00:00+03:00'));
    await page.reload();await page.locator('.meal-card').first().waitFor();
    assert.equal(await page.evaluate(()=>offset),1);
    assert.deepEqual(await capture(page),previous,'Past week or a future week moved across Monday');
    await page.evaluate(()=>{
      offset=1;
      weekData().desserts[5]={id:"syrniki",moment:"breakfast"};
      persist();render();
    });
    assert.equal(await page.evaluate(()=>plan().days[5].meals[3].r.id),'syrniki');
    assert.deepEqual(errors,[]);
    console.log('PASS: 21 dates, all '+previous.weeks.flatMap(w=>w.days.flat()).length+' meal slots, individual portions, macros, checkout, grocery quantities, saved replacements, pantry, cooking checks and original storage match across two reloads and Monday rollover.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
