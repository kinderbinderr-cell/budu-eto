const {chromium}=require(process.env.PLAYWRIGHT_PATH||"playwright");
const assert=require("node:assert/strict");
(async()=>{
  const b=await chromium.launch({executablePath:process.env.CHROME_PATH});
  try{
    const p=await b.newPage({viewport:{width:375,height:812},isMobile:true});
    await p.goto(process.argv[2]||"http://127.0.0.1:8794/");
    const next=p.locator('#flow-form [type=submit]');
    const click=(a,v)=>p.locator('[data-action="'+a+'"]'+(v?'[data-value="'+v+'"]':'')+':visible').first().click();
    await click("flow-who","self");await next.click();await click("flow-time","15");
    await click("flow-rhythm","batch");await next.click();
    await p.getByText("Тип питания и исключения",{exact:true}).click();
    await click("flow-diet","vegan");await click("flow-exclude","legumes");
    await click("taste-cuisines");await click("taste-cuisines-clear");await click("taste-cuisines-apply");
    let tries=0;
    while(await p.locator('[data-action=taste-yes]:visible').count() && ++tries<12)await click("taste-yes");
    const first=await p.evaluate(()=>{const c=tasteContext();return {likes:c.pool.filter(r=>c.votes[r.id]===1).map(r=>r.id),step:getFlow().stage,ready:tasteReadiness(c).complete};});
    assert.equal(first.likes.length,5);assert.equal(first.ready,false);assert.equal(await next.isDisabled(),true);
    // A questionnaire saved by the older release may already be on its final screen.
    await p.evaluate(()=>{getFlow().stage=3;getFlow().budget=3500;rememberFlow();render();});
    await next.click();assert.equal(await p.evaluate(()=>getFlow().stage),2);
    assert.equal(await p.evaluate(()=>loadData().quizDone),false);
    await click("wider-time");
    for(let i=0;i<100 && await next.isDisabled();i++)await click("taste-yes");
    assert.equal(await next.isEnabled(),true);await next.click();
    await p.locator('[name=weekly-budget]').fill("3500");await next.click();await p.locator(".meal-card").first().waitFor();
    const verified=await p.evaluate(ids=>{
      const s=settings();
      return {time:s.maxMinutes,intact:ids.every(id=>s.votes[id]===1),
        valid:[0,1,2].every(n=>{const w=plan(null,n);return w?.days.length===7 && w.days.every(d=>
          d.meals[1].r.id!==d.meals[2].r.id && d.meals.every(m=>eligible(s,m.r) && s.votes[m.r.id]===1));})};
    },first.likes);
    assert.ok(verified.intact && verified.valid);console.log("PASS narrow 5 likes blocked, draft retained, real three weeks after expansion",verified);
  }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
