// Derive every kitchen task from a scheduled meal, including its final portion factors.
// Indices are relative to the Monday on screen; Sunday can prepare next week's meals.
// We know dates but not the cooking hour. Keep batches for the following day
// in the fridge; use the freezer for suitable dishes served later. For next-day
// rice we instead cook on the serving day so a late meal cannot exceed 24 hours.
const freezerKinds = new Set(["суп","котлеты","вареники и пельмени","сырники","выпечка","запеканка","фаршированное блюдо","плов","рагу и жаркое","блины и оладьи"]);
function prepTiming(recipe, serve, cookDays, slot) {
  if (slot === 3) return {cook: serve, storage: "fresh"};
  if (["oatjar","rcOatKissel"].includes(recipe.id)) return { cook: serve-1, storage: "overnight" };
  const kind = dishKind(recipe);
  const fresh = recipe.equip === "cold" || ["салат","яичное блюдо","бутерброд"].includes(kind) ||
    /фриттата|скрэмбл|бенедикт|салат|пашот|окрошк|холодник|глазунь|шакшук/i.test(recipe.title);
  if (fresh) return { cook: serve, storage: "fresh" };
  let cook = serve;
  while (cook > serve-7 && !cookDays.includes((cook+7)%7)) cook--;
  const gap = serve-cook;
  if (!gap) return {cook, storage:"today"};
  if (gap === 1) {
    const hasRice=recipe.items.some(([key])=>key==="rice");
    return hasRice ? {cook:serve,storage:"fresh"} : {cook,storage:"fridge"};
  }
  // Keep unreviewed dishes and fresh accompaniments out of the freezer.
  const delicate = recipe.items.some(([key])=>key==="cucumber") ||
    /салат|огурц|огуреч|свежими овощами|из свежих овощей|листов салата|авокадо/i.test(recipe.title);
  if (!delicate && freezerKinds.has(kind)) return {cook, storage:"freeze"};
  return {cook:serve, storage:"fresh"};
}
function kitchenCookDays(profile) {
  return DAYS.map((_,i)=>i).filter(i=>!profile.cook.length || profile.cook.includes(weekdayIndex(profile,i)));
}
function kitchenWeek(profile,current,next,weekOffset=offset){
  const days=Array.from({length:7},()=>({cook:new Map(),thaw:[],serve:[],changes:[]}));
  const history=kitchenHistory(weekOffset,current,next);
  const records=[0,1].map(n=>data.weeks[plannedDate(weekOffset+n)]||{});
  const saved=data.savedWeeks?.[plannedDate(weekOffset)];
  const previous=data.savedWeeks?.[plannedDate(weekOffset-1)];
  const following=data.savedWeeks?.[plannedDate(weekOffset+1)];
  const boundaries=[previous && saved?kitchenBoundary(weekOffset,savedWeek(saved,profile),current):records[0].prepSlots,
    next && following?kitchenBoundary(weekOffset+1,savedWeek(following,weekProfile(weekOffset+1)),next):records[1].prepSlots];
  const servingProfiles=[profile,weekProfile(weekOffset+1)];
  const cookDays=kitchenCookDays(profile);
  for(const [d,marked] of history.days)if(days[d])for(const u of marked.cook)addKitchenBatch(days[d],u);
  const route=(u,meal)=>{
    // The dated meal owns the plating instructions. A checked batch keeps its
    // original yield and allocation as a record of what was cooked.
    const factors=meal.personFactors;
    const served={...u,servingMeal:meal,personFactors:u.f===meal.f?factors:factors?.map(f=>f*u.f/meal.f)};
    days[u.serve]?.serve.push(served);
    if(u.storage==="freeze" && days[u.serve-1]){
      const thawed=history.days.get(u.serve-1)?.thaw.some(t=>t.r.id===u.r.id && t.slot===u.slot && t.serve===u.serve);
      days[u.serve-1].thaw.push({...u,servingMeal:meal,thawed});
    }
  };
  for(const [serve,entry] of [...current.days,...(next?.days||[])].entries()){
    const block=Math.floor(serve/7), d=serve%7;
    for(const [slot,meal] of entry.meals.entries()){
      const {r,f}=meal,key=d+"-"+slot;
      const first=profile.startDate && weekOffset===0;
      const schedule=block===0 && previous && !first?kitchenCookDays(weekProfile(weekOffset-1)):cookDays;
      let timing=prepTiming(r,serve,first && !block?[...cookDays,0]:cookDays,slot);
      if(!block && previous && !first){
        const prior=prepTiming(r,serve+7,schedule,slot);
        if(prior.cook<7)timing={cook:prior.cook-7,storage:prior.storage};
        else if(timing.cook<0)timing={cook:serve,storage:"fresh"};
      }
      if(first && timing.cook<0 && timing.storage!=="overnight")timing={cook:0,storage:"fresh"};
      const servingProfile=servingProfiles[block],halfPeople=servingProfile.mode==="personal"?0:servingProfile.small;
      const people=servingProfile.mode==="personal"?1:servingProfile.adults+halfPeople;
      const original={r,f,personFactors:meal.personFactors,people,halfPeople,serve,slot,...timing,sweetMoment:meal.sweetMoment};
      let need=f;
      const allocate=(u,done)=>{
        const take=Math.min(need,u.f), left=u.f-take;
        if(take>1e-7){
          u.servingMeal=meal;
          route(take===u.f?u:{...u,f:take},meal);
          need-=take;
        }
        if(left>1e-7)days[serve]?.changes.push({kind:"left",r:u.r,slot,f:left,storage:u.storage,completed:done});
      };
      const cooked=history.cells.get(serve+"/"+slot)||[];
      for(const u of cooked){
        if(u.r.id===r.id)allocate(u,true);
        else{
          u.spare=true;
          const thawed=history.days.get(serve-1)?.thaw.some(t=>t.r.id===u.r.id && t.slot===slot && t.serve===serve);
          days[serve]?.changes.push({kind:"left",r:u.r,slot,f:u.f,storage:thawed?"fridge":u.storage,completed:true});
        }
      }
      const anchor=boundaries[block]?.[key], legacy=records[block].incomingPrep?.[key];
      const fixed=anchor===undefined && timing.cook<7*block?legacy:anchor;
      if(fixed && fixed.id===r.id){
        const u={...original,f:fixed.f,personFactors:fixed.personFactors,
          ...(anchor && {cook:anchor.cook+7*block,storage:anchor.storage})};
        if(!history.days.has(u.cook)){
          if(days[u.cook])addKitchenBatch(days[u.cook],u);
          allocate(u,false);
        }
      }
      if(need<1e-7)continue;
      if(anchor!==undefined || fixed || cooked.length || history.days.has(timing.cook)){
        original.cook=serve;original.storage="fresh";
      }
      const additional=f-need>1e-7;
      if(additional)days[serve]?.changes.push({kind:"extra",r,slot,f:need,available:f-need,completed:cooked.length>0});
      const use={...original,f:need,personFactors:additional?meal.personFactors?.map(g=>g*need/f):meal.personFactors,additional};
      if(days[use.cook])addKitchenBatch(days[use.cook],use);
      use.servingMeal=meal;
      route(use,meal);
    }
  }
  return days;
}
function kitchenNextWeek(off) {
  const id=plannedDate(off+1), snapshot=data.savedWeeks?.[id] || data.prepForecasts?.[id];
  return snapshot?savedWeek(snapshot,weekProfile(off+1)):plan(null,off+1);
}
function prepWeek() {
  const current=plan();
  return current && kitchenWeek(weekProfile(),current,kitchenNextWeek(offset),offset);
}
// Move only ingredients that cross a shopping week. The saved meals and their
// portion totals keep describing the week when people actually eat them.
const cookingCountsCache=new WeakMap();
let kitchenEpoch=0;
function kitchenShopping(week,off,next){
  const profile=weekProfile(off), before=data.weeks[plannedDate(off-1)], here=data.weeks[plannedDate(off)], after=data.weeks[plannedDate(off+1)];
  const parts=[off,kitchenEpoch,profile.cook.join(),next,data.savedWeeks?.[plannedDate(off)],
    before?.prepDone,here?.prepDone,after?.prepDone,here?.prepSlots,after?.prepSlots,here?.incomingPrep,after?.incomingPrep];
  const cached=cookingCountsCache.get(week);
  if(cached && parts.every((p,i)=>p===cached.parts[i]))return cached;
  const physical={},incoming={},outgoing={};
  const add=(list,u)=>{for(const [k,g] of u.r.items)list[k]=(list[k]||0)+g*u.f;};
  const previous=data.savedWeeks?.[plannedDate(off-1)];
  for(const day of kitchenWeek(profile,week,next,off)){
    for(const batch of day.cook.values())for(const u of batch.uses){
      add(physical,u);if(u.serve>=7)add(outgoing,u);
    }
    for(const u of day.serve)if(u.cook<0){
      add(incoming,u);
      if((!previous || (profile.startDate && off===0)) && !u.completed)add(physical,u);
    }
  }
  const value={physical,incoming,outgoing,parts};
  cookingCountsCache.set(week,value);return value;
}
function earlyPurchaseCredit(early,serving,record){
  const credit={},legacy=record.prepReceipts??record.cart;
  for(const [k,g] of Object.entries(early)){
    const bought=Math.min(legacy[k]||0,record.cart[k]||0);
    const available=record.earlyPaid?Math.min(record.earlyPaid[k]||0,bought):
      Math.max(0,bought-Math.max(0,(serving.counts[k]||0)-g));
    if(available>0)credit[k]=Math.min(g,available);
  }
  return credit;
}
function shoppingCounts(week,off=offset,baseline=null,next){
  if(!week || !data.quizDone)return week?.counts||{};
  if(next===undefined)next=kitchenNextWeek(off);
  const {physical,incoming,outgoing}=kitchenShopping(week,off,next), counts={...physical};
  // Legacy checkmarks may have paid for an early batch in its serving week.
  const credit=(early,serving,n,sign)=>{
    const record=data.weeks[plannedDate(n)];
    if(!record?.cart || !serving)return;
    for(const [k,g] of Object.entries(earlyPurchaseCredit(early,serving,record)))counts[k]=(counts[k]||0)+sign*g;
  };
  if(data.savedWeeks?.[plannedDate(off-1)] && !(weekProfile(off).startDate && off===0))credit(incoming,baseline||week,off,1);
  credit(outgoing,next,off+1,-1);
  for(const k of Object.keys(counts))if(counts[k]<1e-7)delete counts[k];
  return counts;
}
const prepUseKey = u => [u.r.id,u.cook,u.serve,u.slot,u.storage,u.people,u.f,u.personFactors];
function prepSignature(tasks){return prepSignatureFor(tasks,weekProfile());}
function prepSignatureFor(tasks,s) {
  const encode=u=>{
    const row=prepUseKey(u);
    if(u.halfPeople!==s.small)row.push(u.halfPeople);
    return row;
  };
  return JSON.stringify([s.adults,s.small,
    [...tasks.cook.values()].flatMap(t=>t.uses.map(encode)),
    tasks.thaw.map(encode),tasks.serve.map(encode)]);
}
function prepDone(tasks,index) {
  return !!readCookingMark(weekData().prepDone?.[index]);
}
function prepDate(index) {
  return shortDay(index)+" "+dateText(dateAt(index),{day:"numeric",month:"short"});
}
function overnightNote(r,d){
  if(r.id!=="oatjar" && r.id!=="rcOatKissel")return "";
  const hours=r.id==="oatjar"?"8 часов":"8–12 часов";
  const late=dateAt(d).toDateString()===today.toDateString();
  return '<p class="quiet"><b>'+prepDate(d-1)+' вечером</b> · замочить хлопья. Нужно '+hours+'.'+
    (late?' На сегодняшний завтрак подойдёт, если хлопья уже замочены.':'')+'</p>';
}
function openingPrepNote(tasks){
  if(!settings().startDate || offset!==0)return "";
  return tasks.serve.filter(u=>u.cook<0 && u.storage==="overnight").map(u=>
    '<div class="prep-cold"><b>'+$(u.r.title)+'</b>'+overnightNote(u.r,0)+'</div>').join("");
}
function mealWhen(use) {
  return prepDate(use.serve)+" · "+sweetMealLabel(use,use.slot).toLowerCase();
}
function equipmentBadges(r) {
  const required=r.alsoHob && r.equip==="oven" ? ["hob","oven"] : [r.equip];
  const labels={hob:"Плита",oven:"Духовка",cold:"Без нагрева"};
  return '<span class="equipment">'+required.map(k=>'<span>'+icon(k,15)+labels[k]+'</span>').join('')+'</span>';
}
function prepFlags(tasks,index) {
  const done=prepDone(tasks,index);
  return '<span class="prep-flags">'+(weekProfile().cook.includes(weekdayIndex(weekProfile(),index))?icon("pot",14):"")+
    (done?'<span class="prep-done-mark">'+icon("check",13)+'</span>':"")+'</span>';
}
function freezerUses(tasks) {
  return [...tasks.cook.values()].flatMap(t=>t.uses.filter(u=>u.storage==="freeze"));
}
function cookingProgress(tasks){
  const batches=[...tasks.cook.values()];
  return {
    cooked:batches.filter(b=>b.uses.some(u=>u.completed)).length,
    remaining:batches.filter(b=>b.uses.some(u=>!u.completed)).length,
    toThaw:tasks.thaw.filter(u=>!u.thawed).length
  };
}
function prepCardSummary(tasks,index) {
  if(prepDone(tasks,index)){
    const {cooked,remaining,toThaw}=cookingProgress(tasks);
    const summary=cooked?"Приготовлено "+cooked+" "+plural(cooked,"блюдо","блюда","блюд"):"День отмечен";
    return summary+(remaining?" · осталось приготовить "+remaining:"")+(toThaw?" · осталось достать из морозилки":"");
  }
  if (tasks.cook.size) return "Приготовить "+tasks.cook.size+" "+plural(tasks.cook.size,"блюдо","блюда","блюд");
  return tasks.thaw.length ? "Достать из морозилки" : "Подать заготовки";
}
function prepCard(tasks,index) {
  const count=tasks.cook.size;
  const frozen=freezerUses(tasks).reduce((n,u)=>n+u.people,0);
  const planned=weekProfile().cook.includes(weekdayIndex(weekProfile(),index));
  const title=planned ? (dateAt(index).toDateString()===today.toDateString() ? "Сегодня готовим" : "День готовки") : tasks.thaw.length ? "Вечером достать из морозилки" : count ? "Приготовить к подаче" : "Сегодня из заготовок";
  const notes=[];
  if (count) {
    const audience=weekProfile().mode==="personal"?"на одного":weekProfile().adults===2&&!weekProfile().small?"на двоих":"";
    notes.push([count,plural(count,"блюдо","блюда","блюд"),audience].filter(Boolean).join(" "));
  }
  if (frozen) notes.push(portions(frozen)+" в морозилку");
  if (tasks.thaw.length) notes.push("к завтрашнему меню — "+portions(tasks.thaw.reduce((n,u)=>n+u.people,0)));
  if (!notes.length) notes.push("Что разогреть и подать в этот день");
  return '<section class="prep-feature"><div><h3>'+title+'</h3><p>'+notes.join(" · ")+'</p></div><button type="button" class="btn primary" data-action="prep-day">План готовки '+icon("right",17)+'</button></section>';
}
function prepDivision(use) {
  const meal=use.servingMeal||use;
  if(meal.personFactors?.length!==2)return "";
  const share=firstPortionPercent(meal);
  return " · первому "+share+"%, второму "+(100-share)+"%";
}
function prepBatchText(task) {
  if(task.uses.length<2)return household(weekProfile());
  const times=task.uses.length+" "+plural(task.uses.length,"приём","приёма","приёмов")+" · ";
  const halves=task.uses.reduce((n,u)=>n+u.halfPeople,0);
  if(!halves)return times+portions(task.portions);
  const full=task.portions-halves;
  return times+full+" "+plural(full,"полная","полные","полных")+" и "+halves+" "+plural(halves,"половинная","половинные","половинных");
}
function prepDayPanel(tasks) {
  const frozen=freezerUses(tasks), marked=prepDone(tasks,day), progress=cookingProgress(tasks);
  const pending=progress.remaining>0 || progress.toThaw>0;
  const cookRows=[...tasks.cook.values()].map(task=>{
    const lines=task.uses.map(use=>{
      const place={fresh:"к подаче",today:"к столу",overnight:"· вечером замочить хлопья",fridge:"в холодильник",freeze:"в морозилку"}[use.storage];
      if(use.spare)return '<li>'+prepQuantity(use.f)+' · готовый запас</li>';
      return '<li>'+(marked?(use.completed?"Готово · ":"Осталось приготовить · "):"")+mealWhen(use)+' · '+(use.additional?'доготовить '+prepQuantity(use.f):household(weekProfile()))+' '+place+prepDivision(use)+'</li>';
    });
    return '<article class="prep-dish"><button type="button" data-action="prep-recipe" data-id="'+$(task.r.id)+'">'+dishPhoto(task.r, "60px")+'<span><strong>'+$(task.r.title)+'</strong><small>'+prepBatchText(task)+' · '+cookingTime(task.r)+'</small>'+equipmentBadges(task.r)+'</span>'+icon("right",16)+'</button><ul>'+lines.join("")+'</ul></article>';
  }).join("");
  const transfer=(use)=>'<li><b>'+$(use.r.title)+'</b><span>'+(marked?(use.thawed?'Уже в холодильнике · ':'Осталось переложить · '):'')+household(weekProfile())+' · '+mealWhen(use)+prepDivision(use)+'</span></li>';
  const riceInFreezer=frozen.some(use=>use.r.items.some(([key])=>key==="rice"));
  const coolingTime=riceInFreezer ? "часа" : "двух часов";
  const leftovers=tasks.serve.filter(u=>u.cook!==day);
  const serveRows=leftovers.map(u=>{
    const action=u.storage==="overnight" ? (u.r.id==="rcOatKissel"?"Доварить кисель и подать":"Добавить банан и подать") : "Разогреть";
    return '<li><b>'+$(u.r.title)+'</b><span>'+slotNames[u.slot]+' · '+household(weekProfile())+' · '+action.toLowerCase()+" · заготовка от "+dateText(dateAt(u.cook),{day:"numeric",month:"short"})+prepDivision(u)+'</span></li>';
  }).join("");
  const family=weekProfile().mode==="personal" ? "На одного" : weekProfile().adults===2&&!weekProfile().small ? "На двоих" : "Семейное меню";
  return '<div class="sheet-body simple prep-sheet"><button class="link" data-action="close" type="button">'+icon("left",15)+' К меню недели</button><h2 id="sheet-title">'+dayName(day)+'</h2><p class="prep-sub">'+dateText(dateAt(day),{day:"numeric",month:"long"})+' · '+family+'</p>'+
    (day===0?openingPrepNote(tasks):"")+
    (tasks.changes.length?'<section><h3>Порции после изменения меню</h3><ul>'+tasks.changes.map(c=>'<li>'+prepChangeText(c)+'</li>').join("")+'</ul></section>':'')+
    (cookRows?'<section><h3>'+(marked?prepCardSummary(tasks,day):'Приготовить')+'</h3>'+cookRows+'</section>':'')+
    (frozen.length?'<section class="prep-cold"><h3>'+icon("snow",19)+(marked?' Заморозка':' Заморозить в этот день')+'</h3><ul>'+frozen.map(u=>'<li><b>'+$(u.r.title)+'</b><span>'+(marked?(u.completed?'Заморожено · ':'Осталось заморозить · '):'')+(u.spare?prepQuantity(u.f)+' · готовый запас':household(weekProfile())+' · '+mealWhen(u)+prepDivision(u))+'</span><small>'+(u.spare?'Подача отменена.':prepDate(u.serve-1)+' вечером переложить в холодильник.')+'</small></li>').join("")+'</ul><p>Охладите небольшими порциями и уберите в морозилку в течение '+coolingTime+'. Свежую зелень, сметану и соусы для подачи добавьте перед едой.</p></section>':'')+
    (tasks.thaw.length?'<section class="prep-cold"><h3>'+icon("snow",19)+(marked?' Разморозка':' Вечером в холодильник')+'</h3><p>К завтрашней подаче.</p><ul>'+tasks.thaw.map(transfer).join("")+'</ul></section>':'')+
    (serveRows?'<section class="prep-serve"><h3>Из заготовок к столу</h3><ul>'+serveRows+'</ul></section>':'')+
    '<label class="day-done"><input type="checkbox" data-prep-done '+(marked && !pending?"checked":"")+'>'+
    (marked && pending?"Отметить оставшееся":"Всё на сегодня сделано")+'</label>'+reminderEntry()+'</div>';
}

function extraCookDays(kitchen) {
  const s=weekProfile();
  return kitchen.flatMap((tasks,d)=>tasks.cook.size && !s.cook.includes(weekdayIndex(s,d))?[d]:[]);
}
function prepLoad(kitchen) {
  const s=weekProfile(), extra=extraCookDays(kitchen);
  return 'Основные дни: '+s.cook.map(i=>DAYS[i]).join(' · ')+'. '+(extra.length?
    'Ещё '+extra.length+' '+plural(extra.length,'день','дня','дней')+' с готовкой к подаче.':'В остальные дни достаточно разогреть или подать готовое.');
}
function prepOfferPanel(info){
  const p=info.week,s=weekProfile(),{d,slot,r}=info;
  const old=p.days[d].meals[slot].r, next=info.next;
  return `<div class="sheet-body simple"><h2 id="sheet-title">Приготовить заранее</h2><p>${prepDate(d)} · ${slotNames[slot]}</p>
    <p>${$(old.title)} → <strong>${$(r.title)}</strong></p><p>Приготовить ${prepDate(info.timing.cook)} · ${info.timing.storage==="freeze"?"заморозить порции":"оставить в холодильнике"}.</p>
    <p>Корзина ≈ ${money(weeklyQuote(p).cents/100)} → ${money(weeklyQuote(next).cents/100)}</p>${prepComparison(p,next)}${macroChanges(p,next,new Set([d]))}
    <div class="budget-actions">${button("Применить замену","prep-apply","primary")}${button("Оставить меню","close","outline")}</div></div>`;
}
function advanceCookingTime(week,d,slot){
  const kitchen=kitchenWeek(weekProfile(),week,kitchenNextWeek(offset),offset);
  const uses=kitchen[d].serve.filter(u=>u.slot===slot);
  const first=uses[0];
  if(!first || first.cook<0 || first.cook>=d || dateAt(first.cook)<plusDays(today,0) ||
      prepDone(kitchen[first.cook],first.cook) || !["freeze","fridge"].includes(first.storage) ||
      !uses.every(u=>u.cook===first.cook && u.storage===first.storage))return null;
  return {cook:first.cook,storage:first.storage};
}
function batchCandidates(p,kitchen) {
  const s=weekProfile(), cook=DAYS.map((_,i)=>i).filter(i=>s.cook.includes(weekdayIndex(s,i)));
  if(s.startDate && offset===0 && !cook.includes(0))cook.push(0);
  const result=[];
  for(const d of extraCookDays(kitchen)){
    if(dateAt(d)<=plusDays(today,0) || prepDone(kitchen[d],d))continue;
    for(const [slot,m] of p.days[d].meals.slice(0,3).entries()){
      if(m.manual || !kitchen[d].cook.has(m.r.id))continue;
      const pool=RECIPES.filter(r=>eligible(s,r) && canPlace(s,r,slot) && fitsNutritionSwap(s,p,d,slot,r,lastPlan?.previous));
      for(const r of pool.sort((a,b)=>Number(s.votes[b.id]===1)-Number(s.votes[a.id]===1)||a.minutes-b.minutes)){
        const timing=prepTiming(r,d,cook,slot);
        if(timing.cook>=d || timing.cook<0 || !["freeze","fridge"].includes(timing.storage) ||
           !s.cook.includes(weekdayIndex(s,timing.cook)) || prepDone(kitchen[timing.cook],timing.cook) ||
           dateAt(timing.cook)<plusDays(today,0))continue;
        const next=swapOne(s,p,{d,slot,from:m.r.id},r);
        if(!keepsDayTargets(activePortionTargets(s),p.days[d].meals,next.days[d].meals))continue;
        const actual=advanceCookingTime(next,d,slot);
        if(!actual)continue;
        result.push({d,slot,r,timing:actual,next,week:p});break;
      }
    }
  }
  return result;
}
