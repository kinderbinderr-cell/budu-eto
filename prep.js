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
// A later change to serving sizes must keep an earlier shopping and cooking day intact.
function protectEarlierPrep(off,base){
  if(!data.savedWeeks[plannedDate(off-1)])return;
  const s=weekProfile(off-1),days=kitchenCookDays(s);
  const record=weekData(off);
  for(const [d,day] of base.days.entries())for(const [slot,m] of day.meals.entries()){
    const timing=prepTiming(m.r,d+7,days,slot);
    if(timing.cook>=7 && !(timing.storage==="freeze" && d===0))continue;
    const previous=(record.incomingPrep||={}),key=d+"-"+slot;
    if(previous[key]?.id!==m.r.id)previous[key]={id:m.r.id,f:m.f,...(m.personFactors && {personFactors:m.personFactors})};
  }
}
function kitchenWeek(profile, current, next, weekOffset=offset) {
  const days = Array.from({length:7},()=>({cook:new Map(),thaw:[],serve:[]}));
  const people = profile.mode === "personal" ? 1 : profile.adults + profile.small;
  const cookDays = kitchenCookDays(profile);
  const menuDays = [...current.days, ...(next?.days || [])];
  for (const [serve,entry] of menuDays.entries()) {
    for (const [slot,meal] of entry.meals.entries()) {
      const r=meal.r, saved=serve>=7 && data.weeks[plannedDate(weekOffset+1)]?.incomingPrep?.[(serve-7)+"-"+slot];
      const {f,personFactors}=saved?.id===r.id?saved:meal;
      const effectiveDays=profile.startDate && weekOffset===0 && serve<7 ? [...cookDays,0] : cookDays;
      const timing=prepTiming(r,serve,effectiveDays,slot);
      const firstWeek=profile.startDate && weekOffset===0;
      const {cook,storage}=firstWeek && timing.cook<0 ? {cook:0,storage:"fresh"} : timing;
      const use = {r,f,personFactors,people,cook,serve,slot,storage,sweetMoment:meal.sweetMoment};
      if (days[serve]) days[serve].serve.push(use);
      if (days[cook]) {
        const tasks = days[cook].cook;
        if (!tasks.has(r.id)) tasks.set(r.id,{r,uses:[],factor:0,portions:0});
        const task = tasks.get(r.id);
        task.uses.push(use);
        task.factor += f;
        task.portions += people;
      }
      if (storage === "freeze" && days[serve-1]) days[serve-1].thaw.push(use);
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
const earlyPrepCache=new WeakMap();
function earlyPrep(week,off,receiving,baseline) {
  if(!week)return {};
  const previous=weekProfile(off-1), record=data.weeks[plannedDate(off)];
  const weekdays=kitchenCookDays(previous);
  const signature=JSON.stringify([weekdays,record?.incomingPrep,receiving]);
  const cached=earlyPrepCache.get(week);
  if(cached?.signature===signature && cached.baseline===baseline)return cached.counts;
  const counts={};
  for(const [d,day] of week.days.entries())for(const [slot,m] of day.meals.entries()){
    if(prepTiming(m.r,d+7,weekdays,slot).cook>=7)continue;
    const committed=baseline?.days[d].meals[slot];
    const fixed=record?.incomingPrep?.[d+"-"+slot];
    const prepared=fixed?.id===m.r.id?fixed.f:committed?.r.id===m.r.id?committed.f:m.f;
    const f=receiving?Math.min(m.f,prepared):prepared;
    for(const [k,g] of m.r.items)counts[k]=(counts[k]||0)+g*f;
  }
  earlyPrepCache.set(week,{signature,baseline,counts});return counts;
}
function shoppingTransfer(week,off,receiving=false,baseline=null) {
  const early=earlyPrep(week,off,receiving,baseline), record=data.weeks[plannedDate(off)];
  if(!record?.cart)return early;
  // Older shopping lists could already have a pack against the serving week.
  // Keep that receipt there, allowing only its unused grams to cover early prep.
  const moved={...early}, legacy=record.prepReceipts??record.cart;
  for(const [k,g] of Object.entries(early)){
    const paid=Math.min(legacy[k]||0,record.cart[k]||0);
    if(paid<=0)continue;
    const remaining=Math.max(0,(week.counts[k]||0)-g);
    moved[k]=Math.max(0,g-Math.max(0,paid-remaining));
  }
  return moved;
}
function shoppingCounts(week,off=offset,baseline=null) {
  if(!week || !data.quizDone)return week?.counts||{};
  const counts={...week.counts}, previous=data.savedWeeks?.[plannedDate(off-1)];
  if(previous)for(const [k,g] of Object.entries(shoppingTransfer(week,off,true,baseline)))
    counts[k]=Math.max(0,(counts[k]||0)-g);
  const next=kitchenNextWeek(off);
  if(next)for(const [k,g] of Object.entries(shoppingTransfer(next,off+1)))
    counts[k]=(counts[k]||0)+g;
  for(const k of Object.keys(counts))if(counts[k]<1e-7)delete counts[k];
  return counts;
}
const prepUseKey = u => [u.r.id,u.cook,u.serve,u.slot,u.storage,u.people,u.f,u.personFactors];
function prepSignature(tasks){return prepSignatureFor(tasks,weekProfile());}
function prepSignatureFor(tasks,s) {
  return JSON.stringify([s.adults,s.small,
    [...tasks.cook.values()].flatMap(t=>t.uses.map(prepUseKey)),
    tasks.thaw.map(prepUseKey),tasks.serve.map(prepUseKey)]);
}
function prepDone(tasks,index) {
  return weekData().prepDone?.[index] === prepSignature(tasks);
}
function prepDate(index) {
  return shortDay(index)+" "+dateText(dateAt(index),{day:"numeric",month:"short"});
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
function prepCardSummary(tasks) {
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
  if (!use.personFactors || use.personFactors.length<2) return "";
  const share=Math.round(use.personFactors[0]*100/use.f);
  return " · первому "+share+"%, второму "+(100-share)+"%";
}
function prepBatchText(task) {
  return (task.uses.length>1 ? task.uses.length+" "+plural(task.uses.length,"приём","приёма","приёмов")+" · " : "")+household(weekProfile());
}
function prepDayPanel(tasks) {
  const frozen=freezerUses(tasks);
  const cookRows=[...tasks.cook.values()].map(task=>{
    const lines=task.uses.map(use=>{
      const place={fresh:"к подаче",today:"к столу",overnight:"начать вечером",fridge:"в холодильник",freeze:"в морозилку"}[use.storage];
      return '<li>'+mealWhen(use)+' · '+household(weekProfile())+' '+place+prepDivision(use)+'</li>';
    });
    return '<article class="prep-dish"><button type="button" data-action="prep-recipe" data-id="'+$(task.r.id)+'"><img src="'+photo(task.r)+'" alt=""><span><strong>'+$(task.r.title)+'</strong><small>'+prepBatchText(task)+' · '+cookingTime(task.r)+'</small>'+equipmentBadges(task.r)+'</span>'+icon("right",16)+'</button><ul>'+lines.join("")+'</ul></article>';
  }).join("");
  const transfer=(use)=>'<li><b>'+$(use.r.title)+'</b><span>'+household(weekProfile())+' · '+mealWhen(use)+prepDivision(use)+'</span></li>';
  const riceInFreezer=frozen.some(use=>use.r.items.some(([key])=>key==="rice"));
  const coolingTime=riceInFreezer ? "часа" : "двух часов";
  const leftovers=tasks.serve.filter(u=>u.cook!==day);
  const serveRows=leftovers.map(u=>{
    const action=u.storage==="overnight" ? (u.r.id==="rcOatKissel"?"Доварить по рецепту":"Добавить свежие фрукты") : "Разогреть";
    return '<li><b>'+$(u.r.title)+'</b><span>'+slotNames[u.slot]+' · '+household(weekProfile())+' · '+action.toLowerCase()+" · заготовка от "+dateText(dateAt(u.cook),{day:"numeric",month:"short"})+prepDivision(u)+'</span></li>';
  }).join("");
  const family=weekProfile().mode==="personal" ? "На одного" : weekProfile().adults===2&&!weekProfile().small ? "На двоих" : "Семейное меню";
  return '<div class="sheet-body simple prep-sheet"><button class="link" data-action="close" type="button">'+icon("left",15)+' К меню недели</button><h2 id="sheet-title">'+dayName(day)+'</h2><p class="prep-sub">'+dateText(dateAt(day),{day:"numeric",month:"long"})+' · '+family+'</p>'+
    (cookRows?'<section><h3>Приготовить</h3>'+cookRows+'</section>':'')+
    (frozen.length?'<section class="prep-cold"><h3>'+icon("snow",19)+' Заморозить в этот день</h3><ul>'+frozen.map(u=>'<li><b>'+$(u.r.title)+'</b><span>'+household(weekProfile())+' · '+mealWhen(u)+prepDivision(u)+'</span><small>'+prepDate(u.serve-1)+' вечером переложить в холодильник.</small></li>').join("")+'</ul><p>Охладите небольшими порциями и уберите в морозилку в течение '+coolingTime+'. Свежую зелень, сметану и соусы для подачи добавьте перед едой.</p></section>':'')+
    (tasks.thaw.length?'<section class="prep-cold"><h3>'+icon("snow",19)+' Вечером в холодильник</h3><p>Переложите из морозилки к завтрашней подаче.</p><ul>'+tasks.thaw.map(transfer).join("")+'</ul></section>':'')+
    (serveRows?'<section class="prep-serve"><h3>Из заготовок к столу</h3><ul>'+serveRows+'</ul></section>':'')+
    '<label class="day-done"><input type="checkbox" data-prep-done '+(prepDone(tasks,day)?"checked":"")+'>Всё на сегодня сделано</label>'+reminderEntry()+'</div>';
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
    <p>Корзина ≈ ${money(weeklyQuote(p).cents/100)} → ${money(weeklyQuote(next).cents/100)}</p>${macroChanges(p,next,new Set([d]))}
    <div class="budget-actions">${button("Применить замену","prep-apply","primary")}${button("Оставить меню","close","outline")}</div></div>`;
}
function batchCandidates(p,kitchen) {
  const s=weekProfile(), cook=DAYS.map((_,i)=>i).filter(i=>s.cook.includes(weekdayIndex(s,i)));
  if(s.startDate && offset===0 && !cook.includes(0))cook.push(0);
  const result=[];
  for(const d of extraCookDays(kitchen)){
    for(const [slot,m] of p.days[d].meals.slice(0,3).entries()){
      if(m.manual || !kitchen[d].cook.has(m.r.id))continue;
      const pool=RECIPES.filter(r=>eligible(s,r) && canPlace(s,r,slot) && fitsNutritionSwap(s,p,d,slot,r,lastPlan?.previous));
      for(const r of pool.sort((a,b)=>Number(s.votes[b.id]===1)-Number(s.votes[a.id]===1)||a.minutes-b.minutes)){
        const timing=prepTiming(r,d,cook,slot);
        if(timing.cook>=d || timing.cook<0 || !["freeze","fridge"].includes(timing.storage) ||
           !s.cook.includes(weekdayIndex(s,timing.cook)))continue;
        const next=swapOne(s,p,{d,slot,from:m.r.id},r);
        if(!keepsDayTargets(activePortionTargets(s),p.days[d].meals,next.days[d].meals))continue;
        result.push({d,slot,r,timing,next,week:p});break;
      }
    }
  }
  return result;
}
