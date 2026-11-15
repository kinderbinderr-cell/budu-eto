const assert=require("node:assert/strict");
const {chromium,webkit}=require(process.env.PLAYWRIGHT_PATH||"playwright");
const mini=process.env.MINI==="1",base=new URL(process.argv[2]||"http://127.0.0.1:8794/");
if(mini){base.search="?mini=1";base.hash="tgWebAppVersion=7.10&tgWebAppPlatform=ios";}
(async()=>{
  const browser=mini?await webkit.launch():await chromium.launch({executablePath:process.env.CHROME_PATH});
  try{
    const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
    let p=await ctx.newPage();
    const click=(a,v)=>p.locator('[data-action="'+a+'"]'+(v?'[data-value="'+v+'"]':'')+':visible').first().click();
    const next=()=>p.locator('#flow-form [type=submit]').click();
    const state=()=>p.evaluate(()=>({flow:structuredClone(getFlow()),card:document.querySelector(".reaction-card h2, .reaction-card h3")?.textContent}));
    await p.goto(base.href,{waitUntil:"domcontentloaded"});
    await click("flow-who","two");await next();await click("flow-time","30");await next();
    await click("taste-yes");await click("taste-no");await click("taste-yes");
    const saved=await state();
    assert.equal(saved.flow.stage,2);assert.equal(saved.flow.who,"two");
    assert.deepEqual(Object.values(saved.flow.votes).sort(),[-1,1,1]);
    await p.reload({waitUntil:"domcontentloaded"});assert.deepEqual(await state(),saved);
    await p.close();p=await ctx.newPage();await p.goto(base.href,{waitUntil:"domcontentloaded"});
    assert.match(await p.locator('[data-action="resume-draft"]').innerText(),/отмечено 2 блюда/);
    await click("resume-draft");
    assert.deepEqual(await state(),saved);
    // Back on a resumed session stays inside the questionnaire.
    await p.evaluate(()=>appBack());assert.equal((await state()).flow.stage,1);
    await next();assert.deepEqual((await state()).flow.votes,saved.flow.votes);
    console.log(JSON.stringify({mini,stage:saved.flow.stage+1,positive:2,negative:1,deckPreserved:true}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
