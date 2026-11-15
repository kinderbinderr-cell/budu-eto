// These photographed recipes also work as a small sweet course after dinner.
const dessertIds = new Set([
  "rb063", "rb082", "rb058", "rb067", "rb059", "rb065", "rb068", "rb094",
  "rb098", "rb062", "carrotYogurt", "rwWahe", "reBchak", "ncKutia",
]);
const dessertPortion = 0.5;
function allowsDessert(profile, recipe) {
  return recipe && dessertIds.has(recipe.id) && allowed(profile, recipe) &&
    fitsCuisines(profile, recipe) && profile.votes?.[recipe.id] !== -1;
}
function sweetOptions(profile) {
  return Array.from(dessertIds,byId).filter(r=>allowsDessert(profile,r));
}
function dessertPanel() {
  const current = plan()?.days[day].meals[3]?.r.id;
  const options = sweetOptions(settings());
  const rows = options.map(r => `<button type="button" data-action="dessert-pick" data-id="${r.id}" aria-pressed="${current === r.id}">
    <img src="${photo(r)}" alt=""><span><b>${$(r.title)}</b><small>${cookingTime(r)} · ${Math.round(r.kcal * dessertPortion)} ккал на порцию</small></span>
    ${icon(current === r.id ? "check" : "plus", 17)}</button>`).join("");
  return `<div class="sheet-body simple"><h2 id="sheet-title">Выберите десерт</h2>
    <p class="quiet">${dayNames[day]} · небольшая порция после ужина. Ингредиенты добавятся в покупки на неделю.</p>
    <div class="options-list">${rows || "<p>Подходящих десертов пока нет. Можно расширить выбор кухонь или время готовки.</p>"}</div>
    ${current ? button("Убрать десерт", "dessert-remove", "outline") : ""}</div>`;
}
function setDayDessert(id) {
  if (id && !allowsDessert(settings(), byId(id))) return;
  const week = weekData();
  week.desserts ??= {};
  if (id) week.desserts[day] = id;
  else if (sweetFrequency(settings().dessertPrefs)) week.desserts[day]=null;
  else delete week.desserts[day];
  persist();
  dismissSheet();
  render();
}
function remainingDessertTargets(row, recipe) {
  const nutrients = [recipe.kcal, ...recipe.macros];
  return row.map((range, i) => range && range.map(x => Math.max(0.01, x - nutrients[i] * dessertPortion)));
}

function sweetFrequency(prefs) {
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
  const days=p?.days.flatMap((d,i)=>d.meals[3] ? [DAYS[i]] : []) || [];
  const caption=p && days.length ? days.join(" · ") : p && f ? "На этой неделе нет десертов" : f ? sweetTimes(f) : "По желанию";
  const first=sweetLikes(profile)[0] || sweetOptions(profile)[0];
  return '<button type="button" class="sweet-entry" data-action="sweet-open" data-scope="'+scope+'">'+
    (first?'<img src="'+photo(first)+'" alt="">':'')+
    '<span><strong>Десерты на неделю</strong><small>'+caption+'</small></span>'+icon("right",17)+'</button>';
}
function sweetAgenda(p) {
  const days=p.days.flatMap((d,i)=>d.meals[3]?[{r:d.meals[3].r,i}]:[]);
  if(!days.length) return "";
  return '<div class="sweet-agenda" aria-label="Дни с десертом">'+days.map(({r,i})=>
    `<button type="button" data-action="sweet-day" data-day="${i}"><img src="${photo(r)}" alt=""><span><small>${dayNames[i]}</small><strong>${$(r.title)}</strong></span>${icon("right",15)}</button>`).join("")+'</div>';
}
function sweetEditor(info) {
  const options=sweetOptions(info.profile);
  const {frequency:n,likes}=info;
  const cards=options.map(r=>`<button type="button" class="sweet-card" data-action="sweet-like" data-id="${r.id}" aria-pressed="${likes.includes(r.id)}">
    <span class="sweet-image"><img src="${photo(r)}" alt=""><i>${icon("heart",17)}</i></span>
    <strong>${$(r.title)}</strong><small>${r.minutes} мин · ${Math.round(r.kcal*dessertPortion)} ккал</small></button>`).join("");
  return `<div class="sheet-body simple sweet-editor"><small class="sweet-kicker">МЕНЮ НА НЕДЕЛЮ</small><h2 id="sheet-title">Что на сладкое?</h2>
    <p class="quiet">Сколько дней в неделю добавить десерт после ужина?</p>
    <div class="sweet-numbers" role="group" aria-label="Дней с десертом">${Array.from({length:8},(_,i)=>`<button type="button" data-action="sweet-count" data-value="${i}" aria-label="${i} из 7 дней" aria-pressed="${i===n}">${i}</button>`).join("")}</div>
    ${n?`<h3>Какие десерты любите?</h3><p class="quiet">${cards?'Отметьте по фото хотя бы один. Учтём порции в КБЖУ, а продукты — в бюджете.':'С вашими настройками десертов пока нет. Измените кухни, время или оставьте 0 дней.'}</p><div class="sweet-grid">${cards}</div>`:'<p class="sweet-off">Оставьте 0, если хотите обычное меню. Десерт можно добавить и позже.</p>'}
    <div class="sweet-save"><button type="button" class="btn primary" data-action="sweet-save" ${n&&!likes.length?'disabled':''}>${n?'Сохранить · '+sweetTimes(n).toLowerCase():'Оставить без десертов'}</button></div></div>`;
}
function handleSweetAction(action,btn) {
  if(!action.startsWith("sweet-")) return false;
  if(action==="sweet-day"){
    day=Number(btn.dataset.day);render();
    const target=document.querySelector('.meal-card:nth-child(4) .dish-title');
    target?.focus({preventScroll:true});target?.closest("article").scrollIntoView({block:"center"});return true;
  }
  if(action==="sweet-open"){
    const inFlow=btn.dataset.scope==="flow", profile=inFlow?flowProfile(getFlow()):settings();
    openSheet({kind:"sweet-week",inFlow,profile,frequency:sweetFrequency(profile.dessertPrefs),likes:sweetLikes(profile).map(r=>r.id)});
    return true;
  }
  const i=openInfo;
  if(i?.kind!=="sweet-week") return true;
  if(action==="sweet-save"){
    if(i.frequency&&!i.likes.length) return true;
    const target=i.inFlow?getFlow():settings();
    target.dessertPrefs={frequency:i.frequency,likes:i.likes.slice()};
    if(i.inFlow) rememberFlow(); else persist();
    dismissSheet(); render(); return true;
  }
  if(action==="sweet-count") i.frequency=Number(btn.dataset.value);
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
  for(let j=0;j<count;j++){
    const d=Math.floor((j+.5)*7/count), original=base.days[d].meals.slice(0,3);
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
