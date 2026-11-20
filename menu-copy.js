// Portable menu copies contain catalogue IDs and quantities, never executable markup or browser storage dumps.
const menuCopyFormat="budu-eto/menu";
const maxCopySize=2*1024*1024;
function requireCopy(value) {
  if(!value) throw Error("Данные копии повреждены или относятся к другой версии приложения.");
}
const copyObject=v=>v!==null && typeof v==="object" && !Array.isArray(v);
const copyNumber=(v,min=0,max=1e9)=>Number.isFinite(v) && v>=min && v<=max;
const validCopyList=(v,test,max=1000)=>Array.isArray(v) && v.length<=max && v.every(test);
const copyMap=(v,keyTest,valueTest)=>copyObject(v) && Object.entries(v).every(([k,x])=>keyTest(k) && valueTest(x));
const copyToken=v=>typeof v==="string" && /^[\w-]{1,80}$/.test(v) && !["__proto__","prototype","constructor"].includes(v);
const copyRecipe=id=>copyToken(id) && !!byId(id);
const copyDay=v=>Number.isInteger(v) && v>=0 && v<=6;
const copyGrams=v=>copyMap(v,k=>Object.hasOwn(FOOD,k),g=>copyNumber(g));
const copyMoment=v=>Object.hasOwn(sweetMoments,v);
function copyDate(key) {
  requireCopy(typeof key==="string" && /^20\d\d-\d{1,2}-\d{1,2}$/.test(key));
  const [y,m,d]=key.split("-").map(Number), date=new Date(y,m-1,d,12);
  requireCopy(localDayKey(date)===key);
  return date;
}
function copyDistance(start,date) {
  const utc=d=>Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());
  return (utc(date)-utc(start))/86400000;
}
function copyRecordSignature(record={}) {
  return JSON.stringify([record.replacements||{},record.desserts||{},record.nutritionSwaps||{},record.budgetEdits||[]]);
}
function copyDessertPrefs(prefs) {
  requireCopy(copyObject(prefs));
  const {frequency,likes,days,moment}=prefs;
  requireCopy(Number.isInteger(frequency) && frequency>=0 && frequency<=7 &&
    validCopyList(likes,copyToken) && (days==null || validCopyList(days,copyDay,7)) && (moment==null || copyMoment(moment)));
  return {frequency,likes,...(days!=null && {days}),...(moment!=null && {moment})};
}
function copyProfile(raw) {
  requireCopy(copyObject(raw) && ["family","personal"].includes(raw.mode));
  const profile=initial(raw.mode);
  const defaults={...profile};
  const extras=["startDate","backupAnchor","tasteAnchor","fromQuiz","budgetChosen","strictTaste","rotateBatches","plainPortion","portionTargets","dessertPrefs","planningPantry","priceCity"];
  for(const field of [...Object.keys(defaults),...extras]) if(Object.hasOwn(raw,field)) profile[field]=raw[field];
  for(const field of ["adults","small","budget","age","height","weight","target","maxMinutes","week"])
    requireCopy(copyNumber(profile[field]));
  requireCopy(Number.isInteger(profile.adults) && profile.adults>=1 && profile.adults<=12 && Number.isInteger(profile.small) && profile.small<=8);
  requireCopy(["auto","portion","own"].includes(profile.targetMode) && ["balanced","protein"].includes(profile.ratio) &&
    ["male","female"].includes(profile.sex) && Object.hasOwn(diets,profile.diet) && [1.2,1.4,1.6,"1.2","1.4","1.6"].includes(profile.activity));
  requireCopy(validCopyList(profile.cook,copyDay,7) && validCopyList(profile.stores,supportedShop,20) &&
    validCopyList(profile.equipment,k=>Object.hasOwn(gear,k),3) && validCopyList(profile.cuisines,copyToken) &&
    validCopyList(profile.likes,copyToken) && validCopyList(profile.exclude,k=>Object.hasOwn(allergens,k)||Object.hasOwn(FOOD,k)) &&
    copyMap(profile.votes,copyToken,v=>[-1,0,1].includes(v)));
  for(const k of ["startDate","backupAnchor"]) if(profile[k]!=null) copyDate(profile[k]);
  if(profile.tasteAnchor!=null) requireCopy(Number.isInteger(profile.tasteAnchor) && Math.abs(profile.tasteAnchor)<=4000);
  for(const k of ["fromQuiz","budgetChosen","strictTaste","rotateBatches","plainPortion"])
    if(profile[k]!=null) requireCopy(typeof profile[k]==="boolean");
  if(profile.portionTargets!=null) requireCopy(validCopyList(profile.portionTargets,row=>Array.isArray(row)&&row.length===4&&row.every(
    range=>range===null || (Array.isArray(range)&&range.length===2&&copyNumber(range[0],0.01)&&copyNumber(range[1],range[0]))),2));
  if(profile.planningPantry!=null) requireCopy(copyMap(profile.planningPantry,k=>/^-?\d{1,4}$/.test(k),copyGrams));
  if(profile.dessertPrefs!=null) profile.dessertPrefs=copyDessertPrefs(profile.dessertPrefs);
  if(profile.priceCity!=null) profile.priceCity=normalizePriceCity(profile.priceCity);
  return profile;
}
function copyWeekRecord(raw) {
  requireCopy(copyObject(raw));
  const r={replacements:raw.replacements||{},pantry:raw.pantry||{}};
  const exchange=v=>copyObject(v)&&copyRecipe(v.from)&&copyRecipe(v.to);
  requireCopy(copyMap(r.replacements,k=>/^(day:)?[0-6]-[0-2]$/.test(k),copyRecipe) && copyGrams(r.pantry));
  if(raw.pantryBeforeCheck!=null){
    requireCopy(copyMap(raw.pantryBeforeCheck,k=>Object.hasOwn(FOOD,k),v=>v===null || copyNumber(v)));
    r.pantryBeforeCheck={...raw.pantryBeforeCheck};
  }
  if(raw.prepSlots!=null){
    requireCopy(copyMap(raw.prepSlots,k=>/^[0-6]-[0-3]$/.test(k),v=>v===false ||
      copyObject(v) && copyRecipe(v.id) && copyNumber(v.f,0.001,100) && Number.isInteger(v.cook) &&
      v.cook>=-7 && v.cook<0 && ["fridge","freeze","overnight"].includes(v.storage) &&
      (v.personFactors==null || validCopyList(v.personFactors,f=>copyNumber(f,0.001,100),2))));
    r.prepSlots=structuredClone(raw.prepSlots);
  }
  if(raw.dessertPrefs!=null)r.dessertPrefs=copyDessertPrefs(raw.dessertPrefs);
  if(raw.budgetLimit!=null){requireCopy(budgetRange(raw.budgetLimit));r.budgetLimit=raw.budgetLimit;}
  if(raw.carryFrom!=null){
    // Older clients sometimes removed the amount while retaining its source. Preserve an unknown amount.
    requireCopy(copyMap(raw.carryFrom,k=>Object.hasOwn(FOOD,k),v=>typeof v==="string" && !!copyDate(v)));
    r.carryFrom={...raw.carryFrom};
  }
  if(raw.carryKind!=null){
    requireCopy(copyMap(raw.carryKind,k=>Object.hasOwn(r.carryFrom||{},k),v=>v==="linked" || v==="manual"));
    r.carryKind={...raw.carryKind};
  }
  if(raw.carryReview!=null){
    requireCopy(copyMap(raw.carryReview,k=>Object.hasOwn(r.carryFrom||{},k) && !r.carryKind?.[k],v=>copyNumber(v)));
    r.carryReview={...raw.carryReview};
  }
  if(raw.earlyPaid!=null){requireCopy(copyGrams(raw.earlyPaid));r.earlyPaid={...raw.earlyPaid};}
  if(raw.prepReceipts!=null){requireCopy(copyGrams(raw.prepReceipts));r.prepReceipts={...raw.prepReceipts};}
  if(raw.paidStock!=null){requireCopy(copyGrams(raw.paidStock));r.paidStock=raw.paidStock;}
  if(raw.cart!=null){requireCopy(copyGrams(raw.cart));r.cart=raw.cart;}
  if(raw.purchases!=null){
    requireCopy(copyMap(raw.purchases,k=>Object.hasOwn(FOOD,k),p=>copyObject(p) && copyNumber(p.grams,0.001) &&
      copyNumber(p.weight,0.001) && Number.isSafeInteger(p.cents) && copyNumber(p.cents) &&
      (p.source==null || (typeof p.source==="string" && p.source.length<=256)) && typeof p.weightSale==="boolean" && (p.store===null||supportedShop(p.store)) && typeof p.label==="string" && p.label.length<=160));
    for(const [k,p] of Object.entries(raw.purchases))requireCopy(r.cart?.[k]===p.grams);
    r.purchases=raw.purchases;
  }
  if(raw.incomingPrep!=null){
    requireCopy(copyMap(raw.incomingPrep,k=>/^[0-6]-[0-3]$/.test(k),m=>copyObject(m) && copyRecipe(m.id) &&
      copyNumber(m.f,0.001,100) && (m.personFactors==null || validCopyList(m.personFactors,f=>copyNumber(f,0.001,100),2))));
    r.incomingPrep=raw.incomingPrep;
  }
  if(raw.preparedFacts!=null)r.preparedFacts=copyMealFacts(raw.preparedFacts);
  if(raw.openingCooked!=null){
    requireCopy(copyMap(raw.openingCooked,k=>/^[0-6]$/.test(k),v=>typeof v==="string" && v.length<=65536 && !!readCookingMark(v)));
    r.openingCooked={...raw.openingCooked};
  }
  if(raw.prepDone!=null){
    requireCopy(copyMap(raw.prepDone,k=>/^[0-6]$/.test(k),v=>typeof v==="string" && v.length<=65536));r.prepDone=raw.prepDone;
  }
  if(raw.nutritionSwaps!=null){
    requireCopy(copyMap(raw.nutritionSwaps,k=>/^[0-6]-[0-2]$/.test(k),exchange));
    r.nutritionSwaps=Object.fromEntries(Object.entries(raw.nutritionSwaps).map(([k,{from,to}])=>[k,{from,to}]));
  }
  if(raw.budgetEdits!=null){
    requireCopy(validCopyList(raw.budgetEdits,e=>exchange(e)&&copyDay(e.d)&&[0,1,2].includes(e.slot),10000));
    r.budgetEdits=raw.budgetEdits.map(({d,slot,from,to})=>({d,slot,from,to}));
  }
  if(raw.desserts!=null){
    requireCopy(copyMap(raw.desserts,k=>/^[0-6]$/.test(k),v=>v===null || copyRecipe(v) ||
      (copyObject(v) && (v.auto===true || copyRecipe(v.id)) && copyMoment(v.moment))));
    r.desserts=Object.fromEntries(Object.entries(raw.desserts).map(([k,v])=>[k,copyObject(v)?{...(v.auto?{auto:true}:{id:v.id}),moment:v.moment}:v]));
  }
  return r;
}
function recipeCopyFacts({items,kcal,macros,cost}) {
  return {items,kcal,macros,cost};
}
function copyMealFacts(raw){
  requireCopy(copyMap(raw,copyRecipe,f=>copyObject(f) && copyNumber(f.kcal) && copyNumber(f.cost) &&
    validCopyList(f.macros,x=>copyNumber(x),3) && f.macros.length===3 && validCopyList(f.items,
      item=>Array.isArray(item) && item.length===2 && typeof item[0]==="string" && Object.hasOwn(FOOD,item[0]) && copyNumber(item[1]))));
  return Object.fromEntries(Object.entries(raw).map(([id,f])=>[id,recipeCopyFacts(f)]));
}
function copySnapshot(raw) {
  requireCopy(copyObject(raw) && raw.days?.length===7 && raw.macros?.length===7 && copyGrams(raw.counts) &&
    copyNumber(raw.cost) && copyNumber(raw.newCount,0,28) && [0,1,2].includes(raw.phase) &&
    validCopyList(raw.pairMisses,v=>v===null || copyNumber(v),7));
  // Compare against the ingredient quantities in the file, even if a catalogue recipe has since been revised.
  const facts=copyMealFacts(raw.facts);
  const counts={};
  const days=raw.days.map((d,i)=>{
    requireCopy(copyObject(d) && copyDay(d.start) && [d.pickDay,d.prep,d.freshly].every(v=>typeof v==="boolean") &&
      Array.isArray(d.meals) && [3,4].includes(d.meals.length));
    const macros=[0,0,0];
    const meals=d.meals.map(m=>{
      requireCopy(copyObject(m) && copyRecipe(m.r) && copyNumber(m.f,0.001,100) && [0,1,2,3].includes(m.sourceSlot) &&
        typeof m.manual==="boolean" && (m.sweetMoment==null || copyMoment(m.sweetMoment)) &&
        (m.personFactors==null || validCopyList(m.personFactors,x=>copyNumber(x,0.001,100),2)));
      const recipe=facts[m.r];requireCopy(recipe);
      for(const [k,g] of recipe.items) counts[k]=(counts[k]||0)+g*m.f;
      recipe.macros.forEach((g,j)=>macros[j]+=g*m.f);
      return {r:m.r,f:m.f,manual:m.manual,sourceSlot:m.sourceSlot,...(m.personFactors && {personFactors:m.personFactors}),...(m.sweetMoment && {sweetMoment:m.sweetMoment})};
    });
    requireCopy(raw.macros[i]?.length===3 && macros.every((v,j)=>copyNumber(raw.macros[i][j]) && Math.abs(v-raw.macros[i][j])<1e-5));
    return {meals,start:d.start,pickDay:d.pickDay,freshly:d.freshly,prep:d.prep};
  });
  requireCopy([...new Set([...Object.keys(raw.counts),...Object.keys(counts)])].every(k=>Math.abs((counts[k]||0)-(raw.counts[k]||0))<1e-5));
  return {days,facts,counts:raw.counts,macros:raw.macros,cost:raw.cost,newCount:raw.newCount,phase:raw.phase,pairMisses:raw.pairMisses};
}
async function copyDigest(payload) {
  const bytes=new TextEncoder().encode(JSON.stringify(payload));
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
function copyPeriod(copy) {
  const start=copyDate(copy.weeks[0].date),end=plusDays(start,20);
  return dateText(start,{day:"numeric",month:"long",...(start.getFullYear()!==end.getFullYear() && {year:"numeric"})})+" – "+dateText(end,{day:"numeric",month:"long",year:"numeric"});
}
function buildMenuCopy() {
  const first=3*Math.floor(offset/3),profile=settings();
  const weeks=Array.from({length:3},(_,i)=>{
    const n=first+i,date=weekKey(n),p=plan(null,n);
    if(!p) throw Error("Для этой недели пока нет готового меню.");
    const record=data.weeks[profile.mode+"/"+date]||{};
    const policy=data.portionPolicies?.[plannedDate(n)];
    const exported=copyWeekRecord(record);
    if(i===0){
      const previous=data.weeks[plannedDate(n-1)]?.prepDone;
      const marks=Object.entries(previous||{}).filter(([,raw])=>readCookingMark(raw)?.[2].some(row=>row[2]>=7));
      if(marks.length)exported.openingCooked=Object.fromEntries(marks);
    }
    return {date,record:exported,plan:fullWeekSnapshot(p),...(policy && {policy})};
  });
  const next=first+3,stored=data.savedWeeks?.[plannedDate(next)] || data.prepForecasts?.[plannedDate(next)];
  const forecast=stored || (plan(null,next) && fullWeekSnapshot(plan(null,next)));
  return {format:menuCopyFormat,version:1,...(forecast && {forecast}),anchor:localDayKey(startDate(profile)),profile:copyProfile(profile),weeks};
}
function parseMenuCopy(text) {
  requireCopy(typeof text==="string" && text.length<=maxCopySize);
  let raw;
  try{raw=JSON.parse(text);}catch{throw Error("Не удалось прочитать копию. Выберите файл «Буду это» или вставьте текст копии целиком.");}
  if(raw?.format!==menuCopyFormat) throw Error("Выберите копию меню, сохранённую в «Буду это».");
  if(raw.version!==1) throw Error("Эта версия копии пока не поддерживается.");
  const anchor=copyDate(raw.anchor), profile=copyProfile(raw.profile);
  if(!profile.startDate && !Number.isInteger(profile.tasteAnchor)) profile.backupAnchor=raw.anchor;
  requireCopy(localDayKey(startDate(profile))===raw.anchor && Array.isArray(raw.weeks) && raw.weeks.length===3);
  const first=copyDate(raw.weeks[0].date),distance=copyDistance(anchor,first);
  requireCopy(distance%7===0 && Math.abs(distance)<36525);
  const weeks=raw.weeks.map((week,i)=>{
    requireCopy(copyObject(week) && week.date===localDayKey(plusDays(first,7*i)));
    const policy=week.policy;
    if(policy!=null){
      requireCopy(copyObject(policy) && Object.keys(policy).every(k=>portionFieldsToSave.includes(k)));
      copyProfile({...profile,...policy});
    }
    const plan=copySnapshot(week.plan),goals=activePortionTargets({...profile,...policy});
    if(goals) requireCopy(plan.days.every(d=>d.meals.every(m=>m.personFactors?.length===goals.length &&
      Math.abs(m.f-m.personFactors.reduce((a,b)=>a+b,0))<1e-6)));
    return {date:week.date,plan,policy,record:copyWeekRecord(week.record)};
  });
  return {profile,weeks,first:distance/7,forecast:raw.forecast?copySnapshot(raw.forecast):null};
}
function applyMenuCopy(info) {
  const raw=localStorage.getItem(key);
  if(raw!==info.previous) throw Error("Меню успело измениться. Откройте копию ещё раз, чтобы проверить даты.");
  const current=loadData(), {profile,weeks,first}=info.copy, mode=profile.mode;
  const revision=crypto.randomUUID(),records={...current.weeks};
  const signature=JSON.stringify(profile), old=current.menuCopies?.[mode];
  const plans=old?.signature===signature ? {...old.plans} : {};
  const portionPolicies={...current.portionPolicies};
  for(const key of Object.keys(current.savedWeeks||{}))
    if(key.startsWith(mode+"/"))portionPolicies[key]??=portionPolicy(current[mode]);
  for(const {date,plan,record,policy} of weeks){
    portionPolicies[mode+"/"+date]=portionPolicy({...profile,...policy});
    records[mode+"/"+date]=record;
    plans[date]={week:plan,edits:copyRecordSignature(record)};
  }
  const savedWeeks={...current.savedWeeks};
  for(const {date,plan} of weeks)savedWeeks[mode+"/"+date]=plan;
  const prepForecasts={...current.prepForecasts};
  const boundary=mode+"/"+localDayKey(plusDays(copyDate(weeks[2].date),7));
  if(info.copy.forecast)prepForecasts[boundary]=info.copy.forecast;else delete prepForecasts[boundary];
  const next={...current,prepForecasts,savedWeeks,portionPolicies,mode,[mode]:profile,quizDone:true,quizRun:revision,weeks:records,
    menuCopies:{...current.menuCopies,[mode]:{revision,signature,plans}}};
  // A single atomic write also covers the concrete meals. On quota failure the existing menu stays intact.
  try{localStorage.setItem(key,JSON.stringify(next));}
  catch{throw Error("На устройстве не удалось сохранить копию. Освободите место и попробуйте ещё раз.");}
  history.replaceState({menuCopy:revision,weekOffset:first},"","#week");
  location.reload();
}
function menuCopyPane(info) {
  const note='<p class="copy-feedback" role="status" aria-live="polite"></p>';
  if(info.kind==="copy-save"){
    return `<div class="sheet-body simple menu-copy"><h2 id="sheet-title">Сохранить копию меню</h2>
      <p class="copy-period">${copyPeriod(info.copy)}</p>
      <p>В одном файле — три недели, выбранные блюда и порции, замены и отметки «Есть дома», «В корзине» и «Приготовлено».</p>
      ${button("Сохранить файл","copy-file","primary","copy")}
      <details><summary>Сохранить текстом</summary><p>Скопируйте текст целиком в заметку. Его можно вставить при восстановлении.</p>
      <textarea aria-label="Текст копии" readonly spellcheck="false">${$(info.text)}</textarea>${button("Скопировать текст","copy-text","soft")}</details>${note}</div>`;
  }
  if(info.kind==="copy-confirm"){
    const mode=info.copy.profile.mode;
    return `<div class="sheet-body simple menu-copy"><h2 id="sheet-title">Восстановить меню?</h2>
      <p class="copy-period">${copyPeriod(info.copy)}</p><p>${profileName(info.copy.profile)} · 21 день</p>
      <ul class="copy-weeks">${info.copy.weeks.map(({date,record,plan},i)=>{
        const start=copyDate(date),end=plusDays(start,6);
        let home=0,cart=0;
        for(const [id,g] of Object.entries(plan.counts)){
          const remaining=neededGrams(g)-(record.pantry[id]||0);
          if(remaining<=0)home++;
          else if(record.cart?.[id] && !outstandingGrams(record,id,plan.counts[id]))cart++;
        }
        return `<li><b>Неделя ${i+1}</b><span>${dateText(start,{day:"numeric",month:"short"})} – ${dateText(end,{day:"numeric",month:"short"})}</span><small>Есть дома · ${home} &nbsp; В корзине · ${cart}</small></li>`;
      }).join("")}</ul>
      <p>${data.quizDone ? "Настройки "+(mode==="family"?"семейного":"личного")+" меню и отметки за эти даты будут заменены данными из копии." : "Сразу откроется первая неделя из копии."}</p>
      ${button("Восстановить меню","copy-apply","primary")}${button("Отмена","close","outline")}${note}</div>`;
  }
  return `<div class="sheet-body simple menu-copy"><h2 id="sheet-title">Восстановить из копии</h2>
    <p>Выберите сохранённый файл «Буду это». Сначала покажем даты трёх недель.</p>
    ${button("Выбрать файл","copy-choose","primary")}<input type="file" data-menu-copy-file accept=".json,application/json,text/plain" hidden>
    <details><summary>Вставить текст копии</summary><label>Текст копии<textarea data-menu-copy-text spellcheck="false" autocapitalize="off"></textarea></label>${button("Проверить копию","copy-read","soft")}</details>${note}</div>`;
}
function copyMessage(message) {
  const el=sheet.querySelector(".copy-feedback");
  if(el) el.textContent=message;
}
async function showCopyPreview(text,source,ticket) {
  if(openInfo!==source || source.readTicket!==ticket) return;
  try{
    const copy=parseMenuCopy(text);
    const {checksum,...payload}=JSON.parse(text);
    if(checksum!==await copyDigest(payload)) throw Error("Копия неполная или была изменена. Выберите исходный файл или вставьте текст целиком.");
    if(openInfo!==source || source.readTicket!==ticket) return;
    openSheet({kind:"copy-confirm",copy,previous:localStorage.getItem(key)});
  } catch(e){if(openInfo===source && source.readTicket===ticket)copyMessage(e instanceof TypeError ? "Не удалось прочитать данные копии." : e.message);}
}
async function readMenuCopyFile(input) {
  const source=openInfo,file=input.files?.[0];
  input.value="";
  if(!file) return;
  const ticket=source.readTicket=Symbol();
  if(file.size>maxCopySize){copyMessage("Файл слишком большой для копии меню. Выберите файл «Буду это».");return;}
  try{await showCopyPreview(await file.text(),source,ticket);}
  catch{if(openInfo===source)copyMessage("Не удалось открыть файл. Попробуйте вставить текст копии.");}
}
async function handleCopyAction(action) {
  try{
    if(action==="copy-save"){
      const copy=buildMenuCopy();
      const text=JSON.stringify({...copy,checksum:await copyDigest(copy)});
      parseMenuCopy(text); // Only offer a file the reader can restore.
      openSheet({kind:"copy-save",copy,text});
    }else if(action==="copy-restore"){
      openSheet({kind:"copy-restore"});
    }else if(action==="copy-choose"){
      sheet.querySelector("[data-menu-copy-file]").click();
    }else if(action==="copy-read"){
      await showCopyPreview(sheet.querySelector("[data-menu-copy-text]").value,openInfo,openInfo.readTicket=Symbol());
    }else if(action==="copy-apply"){
      applyMenuCopy(openInfo);
    }else if(action==="copy-text"){
      const field=sheet.querySelector("textarea");
      try{await navigator.clipboard.writeText(field.value);copyMessage("Текст копии скопирован.");}
      catch{field.focus();field.select();copyMessage("Текст выделен. Нажмите «Скопировать» и сохраните его в заметке.");}
    }else if(action==="copy-file"){
      const {copy,text}=openInfo, name="Буду это — меню с "+copy.weeks[0].date+".json";
      const file=new File([text],name,{type:"application/json"});
      if(navigator.canShare?.({files:[file]})){
        try{await navigator.share({files:[file]});return;}
        catch(e){if(e.name==="AbortError")return;}
      }
      const url=URL.createObjectURL(file),link=document.createElement("a");
      link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      copyMessage("Если файл не появился в загрузках, выберите «Сохранить текстом».");
    }
  }catch(e){
    if(openInfo?.kind.startsWith("copy-")) copyMessage(e.message);
    else notify(e.message);
  }
}
