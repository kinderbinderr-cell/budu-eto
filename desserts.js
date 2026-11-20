// These photographed recipes also work as a small sweet course or snack.
const dessertIds = new Set([
  "rb063", "rb082", "rb058", "rb067", "rb059", "rb065", "rb068", "rb094",
  "syrniki","rb024","rb064","rb079","rb080","rb097","rwPapanasi","ncPannukakku",
  "rb098", "rb062", "carrotYogurt", "rwWahe", "reBchak", "ncKutia",
]);
const dessertPortion = 0.5;
const sweetMoments = {
  breakfast: "После завтрака", lunch: "После обеда", snack: "На перекус", dinner: "После ужина",
};
function sweetMoment(value) {
  return Object.hasOwn(sweetMoments,value) ? value : "dinner";
}
function sweetMealLabel(meal,slot) {
  return slot===3 ? "Десерт · "+sweetMoments[sweetMoment(meal.sweetMoment)].toLowerCase() : slotNames[slot];
}
// Keep the planner's three main meal slots stable. Only change the serving order on screen.
function servingSlots(meals) {
  const slots=[0,1,2];
  if(meals[3]){
    const position={breakfast:1,lunch:2,snack:2,dinner:3}[sweetMoment(meals[3].sweetMoment)];
    slots.splice(position,0,3);
  }
  return slots;
}
function chosenWeekdays(prefs) {
  return DAYS.map((_,i)=>i).filter(i=>Array.isArray(prefs?.days) && prefs.days.includes(i));
}
function momentPicker(selected) {
  return `<fieldset class="sweet-moment"><legend>Когда хочется сладкого?</legend><div class="chips">${Object.entries(sweetMoments).map(([id,label])=>choiceChip("sweet-moment",id,label,id===selected)).join("")}</div></fieldset>`;
}
function allowsDessert(profile, recipe) {
  return recipe && dessertIds.has(recipe.id) && allowed(profile, recipe) &&
    fitsCuisines(profile, recipe) && profile.votes?.[recipe.id] !== -1;
}
function sweetOptions(profile) {
  return Array.from(dessertIds,byId).filter(r=>allowsDessert(profile,r));
}
function dessertPanel() {
  const meal=plan()?.days[day].meals[3];
  const current=meal?.r.id;
  const timing=openInfo.moment ?? sweetMoment(meal?.sweetMoment ?? weekProfile().dessertPrefs?.moment);
  const options = sweetOptions(settings());
  const rows = options.map(r => `<button type="button" data-action="dessert-pick" data-id="${r.id}" aria-pressed="${current === r.id}">
    ${dishPhoto(r, "66px")}<span><b>${$(r.title)}</b><small>${cookingTime(r)} · ${Math.round(r.kcal * dessertPortion)} ккал на порцию</small></span>
    ${icon(current === r.id ? "check" : "plus", 17)}</button>`).join("");
  return `<div class="sheet-body simple"><h2 id="sheet-title">Выберите десерт</h2>
    <p class="quiet">${dayName(day)} · ингредиенты войдут в покупки на неделю.</p>
    ${momentPicker(timing)}
    ${current && timing!==meal.sweetMoment ? button("Сохранить время подачи","sweet-apply-time","primary") : ""}
    <div class="options-list">${rows || "<p>Подходящих десертов пока нет. Можно расширить выбор кухонь или время готовки.</p>"}</div>
    ${current ? button("Убрать десерт", "dessert-remove", "outline") : ""}</div>`;
}
function setDayDessert(id, timeOnly=false) {
  if (id && !allowsDessert(settings(), byId(id))) return;
  protectMenus();
  const current=plan(),week = weekData();
  week.desserts ??= {};
  if (id) {
    const moment=openInfo?.moment ?? plan()?.days[day].meals[3]?.sweetMoment ?? weekProfile().dessertPrefs?.moment;
    const existing=week.desserts[day];
    const automatic=timeOnly && (!existing || existing.auto);
    week.desserts[day] = automatic ? {auto:true,moment:sweetMoment(moment)} : {id,moment:sweetMoment(moment)};
  }
  else if (sweetFrequency(weekProfile().dessertPrefs)) week.desserts[day]=null;
  else delete week.desserts[day];
  const when=sweetMoment(openInfo?.moment??current.days[day].meals[3]?.sweetMoment??weekProfile().dessertPrefs?.moment);
  setSavedWeek(editDessert(weekProfile(),current,day,id,when));
  persist();
  dismissSheet();
  render();
}
function remainingDessertTargets(row, recipe) {
  const nutrients = [recipe.kcal, ...recipe.macros];
  return row.map((range, i) => range && range.map(x => Math.max(0.01, x - nutrients[i] * dessertPortion)));
}

function sweetFrequency(prefs) {
  const days=chosenWeekdays(prefs);
  if(days.length) return days.length;
  return Number.isInteger(prefs?.frequency) ? Math.max(0, Math.min(7,prefs.frequency)) : 0;
}
function sweetLikes(profile) {
  const likes=new Set(profile.dessertPrefs?.likes || []);
  return sweetOptions(profile).filter(r=>likes.has(r.id));
}
function sweetTimes(n) {
  return n===7 ? "Каждый день" : n ? n+" "+plural(n,"раз","раза","раз")+" в неделю" : "Без десертов";
}
function sweetEntry(profile, scope, p) {
  const f=sweetFrequency(profile.dessertPrefs);
  const days=p ? p.days.flatMap((d,i)=>d.meals[3] ? [shortDay(i)] : []) : chosenWeekdays(profile.dessertPrefs).map(i=>DAYS[i]);
  const caption=days.length ? days.join(" · ") : p && f ? "На этой неделе нет десертов" : f ? sweetTimes(f) : "По желанию";
  const first=sweetLikes(profile)[0] || sweetOptions(profile)[0];
  return '<button type="button" class="sweet-entry" data-action="sweet-open" data-scope="'+scope+'">'+
    (first ? dishPhoto(first, "46px") : "")+
    '<span><strong>Десерты на неделю</strong><small>'+caption+'</small></span>'+icon("right",17)+'</button>';
}
function sweetAgenda(p) {
  const days=p.days.flatMap((d,i)=>d.meals[3]?[{r:d.meals[3].r,i}]:[]);
  if(!days.length) return "";
  return '<div class="sweet-agenda" aria-label="Дни с десертом">'+days.map(({r,i})=>
    `<button type="button" data-action="sweet-day" data-day="${i}">${dishPhoto(r, "46px")}<span><small>${dayName(i)} · ${sweetMoments[p.days[i].meals[3].sweetMoment].toLowerCase()}</small><strong>${$(r.title)}</strong></span>${icon("right",15)}</button>`).join("")+'</div>';
}
function sweetEditor(info) {
  const options=sweetOptions(info.profile);
  const {likes,days,byDay}=info;
  const n=byDay && days.length ? days.length : info.frequency;
  const schedule=byDay ? `<div class="sweet-numbers weekdays" role="group" aria-label="Дни недели">${DAYS.map((label,d)=>`<button type="button" data-action="sweet-weekday" data-value="${d}" aria-label="${dayNames[d]}" aria-pressed="${days.includes(d)}">${label}</button>`).join("")}</div>
    ${!days.length?`<small class="quiet">Пока дни не выбраны: ${n?sweetTimes(n).toLowerCase()+", автоматически":"без десертов"}.</small>`:""}`
    : `<div class="sweet-numbers" role="group" aria-label="Дней с десертом">${Array.from({length:8},(_,i)=>`<button type="button" data-action="sweet-count" data-value="${i}" aria-label="${i} из 7 дней" aria-pressed="${i===n}">${i}</button>`).join("")}</div>`;
  const cards=options.map(r=>`<button type="button" class="sweet-card" data-action="sweet-like" data-id="${r.id}" aria-pressed="${likes.includes(r.id)}">
    <span class="sweet-image">${dishPhoto(r, "auto, min(241px, 44vw)", 'alt="" loading="lazy"')}<i>${icon("heart",17)}</i></span>
    <strong>${$(r.title)}</strong><small>${r.minutes} мин · ${Math.round(r.kcal*dessertPortion)} ккал</small></button>`).join("");
  return `<div class="sheet-body simple sweet-editor"><small class="sweet-kicker">${info.inFlow?"МЕНЮ НА НЕДЕЛЮ":rangeText()}</small><h2 id="sheet-title">Что на сладкое?</h2>
    <p class="quiet">Как распределить десерты по неделе?</p>
    <div class="seg sweet-mode">${choiceChip("sweet-mode","auto","По количеству",!byDay)}${choiceChip("sweet-mode","days","Выбрать дни",byDay)}</div>
    ${schedule}
    ${n?`${momentPicker(info.moment)}<h3>Какие десерты любите?</h3><p class="quiet">${cards?'Отметьте по фото хотя бы один. Учтём порции в КБЖУ, а продукты — в бюджете.':'С вашими настройками десертов пока нет. Измените кухни, время или оставьте 0 дней.'}</p><div class="sweet-grid">${cards}</div>`:'<p class="sweet-off">Можно сохранить меню без десертов и добавить их позже.</p>'}
    <div class="sweet-save"><button type="button" class="btn primary" data-action="sweet-save" ${n&&!likes.length?'disabled':''}>${n?'Сохранить · '+sweetTimes(n).toLowerCase():'Оставить без десертов'}</button></div></div>`;
}
function handleSweetAction(action,btn) {
  if(!action.startsWith("sweet-")) return false;
  if(action==="sweet-day"){
    day=Number(btn.dataset.day);render();
    const target=document.querySelector('.meal-card .dish-title[data-slot="3"]');
    target?.focus({preventScroll:true});target?.closest("article").scrollIntoView({block:"center"});return true;
  }
  if(action==="sweet-open"){
    const inFlow=btn.dataset.scope==="flow", profile=inFlow?flowProfile(getFlow()):weekProfile();
    openSheet({kind:"sweet-week",inFlow,profile,frequency:sweetFrequency(profile.dessertPrefs),likes:sweetLikes(profile).map(r=>r.id),
      byDay:chosenWeekdays(profile.dessertPrefs).length>0,days:chosenWeekdays(profile.dessertPrefs),
      moment:sweetMoment(profile.dessertPrefs?.moment)});
    return true;
  }
  const i=openInfo;
  if(i?.kind==="dessert" && action==="sweet-apply-time"){
    const current=plan()?.days[day].meals[3];
    if(current) setDayDessert(current.r.id,true);
    return true;
  }
  if(i?.kind!=="sweet-week" && !(i?.kind==="dessert" && action==="sweet-moment")) return true;
  if(action==="sweet-mode") {
    if(i.byDay && i.days.length) i.frequency=i.days.length;
    i.byDay=btn.dataset.value==="days";
  }
  if(action==="sweet-weekday") i.days=toggleValue(i.days,Number(btn.dataset.value)).sort((a,b)=>a-b);
  if(action==="sweet-moment") i.moment=sweetMoment(btn.dataset.value);
  if(action==="sweet-save"){
    const days=i.byDay?i.days:[];
    const frequency=days.length || i.frequency;
    if(frequency&&!i.likes.length) return true;
    const target=i.inFlow?getFlow():weekData();
    if(!i.inFlow)protectMenus();
    target.dessertPrefs={frequency,days:days.slice(),moment:i.moment,likes:i.likes.slice()};
    if(i.inFlow) rememberFlow(); else {updateSavedDesserts();persist();}
    dismissSheet(); render(); return true;
  }
  if(action==="sweet-count") {i.frequency=Number(btn.dataset.value);i.days=[];}
  if(action==="sweet-like") i.likes=toggleValue(i.likes,btn.dataset.id);
  const scroll=sheet.querySelector(".dialog-scroll").scrollTop;
  renderSheet(); sheet.querySelector(".dialog-scroll").scrollTop=scroll;
  sheet.querySelector('[data-action="'+action+'"]['+(btn.dataset.id?'data-id="'+btn.dataset.id:'data-value="'+btn.dataset.value)+'"]')?.focus({preventScroll:true});
  return true;
}

// Pick only explicitly liked sweets. Price the entire basket (including pack sizes)
// with each candidate's adjusted main portions; compare both people's daily goals.
function sweetSchedule(s,n,base,options) {
  const count=sweetFrequency(s.dessertPrefs), score=budgetScorer(s,{planning:true}), stock=s.planningPantry?.[n]||{};
  const limit=hasBudget(s)?s.budget*100:Infinity, goals=activePortionTargets(s);
  const out={}, usage=new Map();
  let counts=base.counts;
  const selected=chosenWeekdays(s.dessertPrefs);
  const days=selected.length ? DAYS.map((_,i)=>i).filter(i=>selected.includes(weekdayIndex(s,i))) : Array.from({length:count},(_,j)=>Math.floor((j+.5)*7/count));
  for(const [j,d] of days.entries()){
    const original=base.days[d].meals.slice(0,3);
    const trials=options.map((r,k)=>{
      const meals=[...original.map(m=>({...m})),{r,f:servings(s)*dessertPortion}];
      applyDailyTargets(s,meals);
      const totals={...counts};
      for(const [slot,m] of meals.entries()){
        const delta=m.f-(original[slot]?.f||0);
        if(delta) for(const [key,g] of m.r.items) totals[key]=(totals[key]||0)+g*delta;
      }
      const misses=goals?swapDayScore(swapDayTotals(meals,goals),goals):[];
      const gap=Math.round(Math.max(0,...misses.map(x=>x.worst))*1e5);
      const cents=score(totals,stock).cents;
      const rank=[gap,Math.max(0,cents-limit),Number(original.some(m=>m.r.id===r.id)),usage.get(r.id)||0,
        Number(Object.values(out).at(-1)===r.id),((k-j-n)%options.length+options.length)%options.length,cents];
      return {r,totals,rank};
    });
    trials.sort((a,b)=>{for(let k=0;k<a.rank.length;k++){const diff=a.rank[k]-b.rank[k];if(diff)return diff;}return 0;});
    const pick=trials[0]; out[d]=pick.r.id;counts=pick.totals;usage.set(pick.r.id,(usage.get(pick.r.id)||0)+1);
  }
  return out;
}
