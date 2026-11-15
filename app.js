"use strict";
const main = document.getElementById("content"),
  sheet = document.getElementById("sheet");
const slotNames = ["Завтрак", "Обед", "Ужин", "Десерт"],
  slotIcons = ["sun", "cloud", "moon", "heart"];
const dayNames = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
];
const diets = {
  all: "Ем всё",
  pesc: "С рыбой, без мяса",
  veget: "Вегетарианское",
  vegan: "Растительное",
};
const allergens = {
  gluten: "Глютен",
  milk: "Молочные продукты",
  egg: "Яйца",
  fish: "Рыба",
  legumes: "Бобовые",
  mustard: "Горчица",
  nuts: "Орехи",
  sesame: "Кунжут",
  celery: "Сельдерей",
  molluscs: "Моллюски",
};
const gear = { hob: "Плита", oven: "Духовка" };
const navItems = {
  week: ["week", "Меню недели"],
  recipes: ["book", "Рецепты"],
  list: ["bag", "Список продуктов"],
  coupons: ["ticket", "Купоны"],
};
const key = "za-stol-planner-v3",
  today = new Date(),
  monday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - ((today.getDay() + 6) % 7),
    12,
  );
const todayIndex = (today.getDay() + 6) % 7;

const $ = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
const money = (n) => Math.round(n).toLocaleString("ru-RU") + " ₽";
const grams = (n) =>
  n >= 1000
    ? (Math.round(n / 10) / 100).toLocaleString("ru-RU") + " кг"
    : Math.ceil(n) + " г";
const plural = (n, one, few, many) =>
  Number.isInteger(n)
    ? n % 100 >= 11 && n % 100 <= 14
      ? many
      : n % 10 === 1
        ? one
        : [2, 3, 4].includes(n % 10)
          ? few
          : many
    : few;
const portions = (n) =>
  n.toLocaleString("ru-RU") + " " + plural(n, "порция", "порции", "порций");
const dateText = (d, opts) => new Intl.DateTimeFormat("ru-RU", opts).format(d);
function startDate(profile) {
  if (!profile?.startDate) {
    if(Number.isInteger(profile?.tasteAnchor)) return plusDays(new Date(2026,10,9,12),7*profile.tasteAnchor);
    if(!profile?.backupAnchor) return monday;
  }
  const [y,m,d]=(profile.startDate || profile.backupAnchor).split("-").map(Number);
  return new Date(y,m-1,d,12);
}
function plusDays(date,n) { return new Date(date.getFullYear(),date.getMonth(),date.getDate()+n,12); }
function localDayKey(date) {return [date.getFullYear(),date.getMonth()+1,date.getDate()].join("-");}
function dateAt(day, off = offset) { return plusDays(startDate(data[data.mode]),off*7+day); }
function weekdayIndex(profile,index) {return (startDate(profile).getDay()+6+index+14)%7;}
function dayName(index) {return dayNames[weekdayIndex(settings(),index)];}
function shortDay(index) {return DAYS[weekdayIndex(settings(),index)];}
function currentDay(off) {
  for(let i=0;i<7;i++) if(dateAt(i,off).toDateString()===today.toDateString()) return i;
  return 0;
}
function household(s) {
  if(s.mode!=="family" || !s.small) return portions(servings(s));
  const people=s.adults+s.small;
  const audience=({2:"На двоих",3:"На троих",4:"На четверых"})[people] || "На "+people+" чел.";
  return audience+" · "+s.adults+" "+plural(s.adults,"полная","полные","полных")+" и "+s.small+" "+plural(s.small,"половинная","половинные","половинных");
}
function weekKey(off = offset) {
  const d = dateAt(0, off);
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()].join("-");
}
function rangeText() {
  const a = dateAt(0),
    b = dateAt(6);
  return (
    (a.getMonth() === b.getMonth()
      ? a.getDate()
      : dateText(a, { day: "numeric", month: "short" })) +
    " – " +
    dateText(b, { day: "numeric", month: "long" })
  );
}
function photo(r) {
  return "assets/" + (r.picture || r.id) + ".webp";
}
function byId(id) {
  return RECIPES.find((r) => r.id === id);
}
function placementSlots(recipe) {
  if(settings().startDate) return servingChoices(recipe);
  return originalMenuPlanner.byId(recipe.id)?.slot==="b" ? [0] : [1,2];
}
function canPlace(profile,recipe,slot) {
  return profile.startDate ? manualCandidate(profile,recipe,slot) :
    !!recipe && originalMenuPlanner.manualCandidate(profile,originalMenuPlanner.byId(recipe.id),slot);
}
function freshPlanner() {
  return {
    mode: "family",
    quizDone: false,
    family: initial("family"),
    personal: initial("personal"),
    favorites: [],
    weeks: {},
  };
}
function loadData() {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "null");
    if (raw?.family && raw?.personal)
      return {
        ...raw,
        quizDone: raw.quizDone ?? true,
        family: { ...initial("family"), ...raw.family },
        personal: { ...initial("personal"), ...raw.personal },
      };
  } catch {}
  const result = freshPlanner();
  for (const mode of ["family", "personal"]) {
    try {
      const old = JSON.parse(
        sessionStorage.getItem("zastol-quiz-2" + mode) || "null",
      );
      if (old?.s) result[mode] = { ...initial(mode), ...old.s, mode };
    } catch {}
  }
  return result;
}
const data = loadData();
function openingWeek(profile) {
  return Math.max(0,Math.floor((Date.UTC(today.getFullYear(),today.getMonth(),today.getDate())-
    Date.UTC(startDate(profile).getFullYear(),startDate(profile).getMonth(),startDate(profile).getDate()))/604800000));
}
const restoredPosition=history.state;
let offset = restoredPosition?.menuCopy && restoredPosition.menuCopy===data.menuCopies?.[data.mode]?.revision &&
  Number.isInteger(restoredPosition.weekOffset) ? restoredPosition.weekOffset : openingWeek(data[data.mode]),
  day = currentDay(offset),
  route = "week",
  draft = null,
  step = 1,
  libraryLimit = 36,
  search = "",
  openInfo = null,
  toastTimer = null,
  lastPlan = null;
function readStoredPlanner(){
  try{return localStorage.getItem(key);}catch{return null;}
}
let lastStored=readStoredPlanner();
function persist({migration=false}={}) {
  if(readStoredPlanner()!==lastStored){
    location.reload();throw Error("Меню изменилось в другом окне. Откройте действие ещё раз.");
  }
  const serialized=JSON.stringify(data);
  try {
    localStorage.setItem(key, serialized);lastStored=serialized;
  } catch {
    // Optional cached weeks must never take the space needed for the primary user record.
    try {
      for(const name of Object.keys(localStorage)){
        if(name.startsWith("budu-retained-v1/")) localStorage.removeItem(name);
      }
      localStorage.setItem(key,serialized);lastStored=serialized;
    } catch {
      if(migration){notify("На устройстве мало места. Можно сохранить копию меню в настройках.");return false;}
      if(data.savedWeeks){window.alert("Не удалось сохранить изменения. Предыдущее меню осталось на устройстве.");location.reload();throw Error("Menu storage full");}
      notify("В этом браузере меню сохранится только до закрытия страницы.");
    }
  }
}
function notify(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.textContent = ""), 2500);
}
const settings = () => data[data.mode];
function weekData() {
  const wk = data.mode + "/" + weekKey();
  return data.weeks[wk] || (data.weeks[wk] = { replacements: {}, pantry: {} });
}
function weekSeed(off = offset) {
  const a = dateAt(0, off);
  return Math.round(
    (Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) -
      Date.UTC(2026, 10, 9)) /
      (7 * 86400000),
  );
}
let adjacentPlan = null;
// Separate storage: never overwrite the original profile, pantry or manual edits on upgrade.
function packMenuWeek(week) {
  const days=week.days.map(d=>({...d,meals:d.meals.map(m=>({...m,r:m.r.id}))}));
  return {...week,days};
}
function unpackMenuWeek({facts,...week},profile) {
  const lookup=profile.startDate ? byId : originalMenuPlanner.byId;
  const restoredRecipes=new Map();
  const days=week.days.map(d=>({...d,meals:d.meals.map(m=>{
    let r=restoredRecipes.get(m.r) || lookup(m.r);
    if(!r) throw Error("Не найден рецепт из сохранённого меню.");
    if(facts?.[m.r] && !restoredRecipes.has(m.r)){
      const original=facts[m.r];
      if(JSON.stringify(original)!==JSON.stringify(recipeCopyFacts(r))) r={...r,...original};
      restoredRecipes.set(m.r,r);
    }
    return {...m,r};
  })}));
  return {...week,days};
}
function retainedWeek(profile,seed,swaps,edits,build,date,record) {
  const pinned=data.savedWeeks?.[profile.mode+"/"+date];
  if(pinned)return savedWeek(pinned,profile);
  const restored=data.menuCopies?.[profile.mode];
  const fixed=restored?.plans[date];
  if(fixed && restored.signature===JSON.stringify(profile) && fixed.edits===copyRecordSignature(record)) {
    return unpackMenuWeek(fixed.week,profile);
  }
  const key="budu-retained-v1/"+(restored ? restored.revision+"/" : "")+profile.mode+"/"+(profile.startDate || "legacy")+"/"+seed;
  const signature=JSON.stringify([profile,swaps,edits]);
  try {
    const saved=JSON.parse(localStorage.getItem(key));
    if(saved?.signature===signature && saved.week?.days.length===7){
      return unpackMenuWeek(saved.week,profile);
    }
  } catch {}
  const week=build();
  if(week){
    try {localStorage.setItem(key,JSON.stringify({signature,week:packMenuWeek(week)}));} catch {}
  }
  return week;
}
function plan(preview = null, weekOffset = offset) {
  const date=plannedDate(weekOffset), snap=data.savedWeeks?.[date];
  if(!preview && weekOffset===offset && data.quizDone)visitedWeeks.add(date);
  if(snap && !preview){
    const value=savedWeek(snap,settings());
    if(weekOffset===offset && lastPlan?.value!==value){
      const prev=data.savedWeeks[plannedDate(weekOffset-1)];
      lastPlan={value,previous:prev?savedWeek(prev,settings()).days.slice(-2):[]};
    }
    return value;
  }
  const s = settings(),
    seed = weekSeed(weekOffset);
  const anchor = Number.isInteger(s.tasteAnchor) ? s.tasteAnchor : 0;
  const phaseOf = n => s.strictTaste ? (((n - anchor) % 3) + 3) % 3 : 0;
  let first = seed - phaseOf(seed);
  // A manual edit may affect subsequent days. Rebuild its history from the
  // beginning of the preceding cycle, with ordinary weeks still taking one to three passes.
  if (preview && Object.keys(preview).length) first=Math.min(first,seed-1-phaseOf(seed-1));
  for (const [key, record] of Object.entries(data.weeks)) {
    if (!key.startsWith(data.mode + "/")) continue;
    const manualHistory=Object.keys(record.replacements || {}).length;
    const nutritionHistory=Object.keys(record.nutritionSwaps || {}).length;
    const budgetHistory=record.budgetEdits?.length;
    if (!manualHistory && !nutritionHistory && !budgetHistory) continue;
    const [y, m, d] = key.split("/")[1].split("-").map(Number);
    const edited = Math.round((Date.UTC(y,m-1,d) - Date.UTC(2026,10,9)) / 604800000);
    if (Number.isFinite(edited) && edited <= seed && manualHistory) first=Math.min(first,edited-1-phaseOf(edited-1));
    if ((nutritionHistory || budgetHistory) && edited<seed) first=Math.min(first,edited-phaseOf(edited));
  }
  const weeks=Array.from({length:seed-first+1},(_,i)=>data.weeks[data.mode+"/"+weekKey(weekOffset-(seed-first)+i)]);
  const records=weeks.map(w=>w?.replacements || {});
  const desserts=weeks.map(w=>w?.desserts);
  const nutrition=weeks.map(w=>w?.nutritionSwaps);
  const budgetEdits=weeks.map(w=>w?.budgetEdits);
  if(preview) records[records.length-1] = {...records[records.length-1],...preview};
  const signature = JSON.stringify([seed,s,records,nutrition,budgetEdits,desserts]);
  const cached = weekOffset === offset ? lastPlan : adjacentPlan;
  if (cached?.signature === signature) return cached.value;
  const prior = new Map();
  let value;
  let previous = [];
  for (let n = first; n <= seed; n++) {
    const phase = phaseOf(n);
    if (!phase) prior.clear();
    const planner=s.startDate ? {budgetPlan,withNutritionSwaps,withBudgetEdits} : originalMenuPlanner;
    const build=()=>{
      let week=planner.budgetPlan(s,n,records[n-first],prior,phase,previous,desserts[n-first]);
      week=planner.withNutritionSwaps(s,week,nutrition[n-first],prior,previous);
      if(budgetEdits[n-first]?.length) week=planner.withBudgetEdits(s,week,budgetEdits[n-first],prior,previous);
      return week;
    };
    value=data.quizDone && !preview ? retainedWeek(s,n,records.slice(0,n-first+1),
      [nutrition.slice(0,n-first+1),budgetEdits.slice(0,n-first+1),desserts.slice(0,n-first+1)],build,weekKey(weekOffset+n-seed),weeks[n-first]) : build();
    if (n === seed) break;
    if (!value) { previous = []; continue; }
    previous = value.days.slice(-2);
    rememberWeek(prior,value);
  }
  if (!preview) {
    const result = {signature,value,previous};
    if (weekOffset === offset) lastPlan = result;
    else adjacentPlan = result;
  }
  return value;
}
function readRoute() {
  const h = location.hash.slice(1);
  if (!h || /(?:^|&)tgWebApp(?:Data|Version|Platform)=/.test(h)) {
    const q = new URLSearchParams(location.search);
    const section = q.get("mini") === "1" ? q.get("section") : null;
    if (["recipes","list","coupons"].includes(section)) return section;
  }
  if (!data.quizDone && (!h || h==="start" || /tgWebApp/.test(h)))
    return "start";
  if (h === "coupons" || h === "recipes" || h === "list" || h === "settings" || h === "tastes")
    return h;
  if (/^(family|personal)\/[123]$/.test(h)) return "settings";
  return "week";
}
function navTo(next) {
  if (next === "settings" && !draft) startDraft();
  if (route === next) {
    render();
    return;
  }
  location.hash = next;
}
function profileName(s = settings()) {
  return s.mode === "family" ? "Семейное меню" : "Личный рацион";
}
function button(text, act, variant = "primary", name = "", attributes = "") {
  return `<button type="button" class="btn ${variant}" data-action="${act}" ${attributes}>${name ? icon(name, 18) : ""}${text}</button>`;
}
function iconBtn(name, label, act, attr = "") {
  return `<button class="iconbtn" type="button" data-action="${act}" aria-label="${$(label)}" title="${$(label)}" ${attr}>${icon(name, 19)}</button>`;
}
function navHTML(mobile = false) {
  return Object.entries(navItems)
    .map(
      ([v, [name, title]]) =>
        `<a href="#${v}" ${v === route ? 'aria-current="page"' : ""}>${icon(name, mobile ? 21 : 17)}<span>${mobile && v === "list" ? "Продукты" : title}</span></a>`,
    )
    .join("");
}
function brandMark() {
  return `<i aria-hidden="true">${icon("brand", 31)}</i><span class="brand-nameplate"><b>Буду это</b><small lang="en">prod by. KBR</small></span>`;
}
function header() {
  document.body.classList.toggle("in-flow", route === "start");
  if (route === "start") {
    document.body.classList.remove("in-setup");
    flowHeader();
    return;
  }
  document.getElementById("top").innerHTML =
    `<div class="bar wrap"><a href="#week" class="brand" aria-label="Буду это, меню недели">${brandMark()}</a><nav class="desktopnav" aria-label="Основная навигация">${navHTML()}</nav><button class="profilebtn" data-action="settings" type="button">${icon("sliders", 17)}<span>Настройки меню</span></button></div>`;
  document.getElementById("dock").innerHTML = navHTML(true);
  document.body.classList.toggle("in-setup", route === "settings");
}
function weekControls() {
  return `<div class="week-control">${iconBtn("left", "Предыдущая неделя", "prev",settings().startDate && offset===0?"disabled":"")}<span>${rangeText()}</span>${iconBtn("right", "Следующая неделя", "next")}${offset !== openingWeek(settings()) ? `<button class="link todaylink" type="button" data-action="thisweek">Текущая неделя</button>` : ""}</div>`;
}
function hero(p) {
  const s = settings();
  const showcase = p && (p.days.flatMap(d=>d.meals).find(m=>m.r.id==="shakshuka")?.r || p.days[day].meals[2].r);
  const isCover = showcase?.id === "shakshuka";
  return `<section class="cover ${isCover ? "signature" : "alternate"}">${showcase ? `<img class="cover-image" src="${isCover ? "assets/skillet-cover.webp" : photo(showcase)}" alt="" fetchpriority="high">` : ""}<div class="cover-copy"><h1>Меню <em>на неделю</em></h1><p>${s.mode === "family" ? `${icon("users", 16)} ${profileName(s)} <span>·</span> ${portions(servings(s))}` : `${icon("user", 16)} Личный рацион <span>·</span> ${activePortionTargets(s) ? "Свои диапазоны КБЖУ" : s.plainPortion ? "1 порция" : energy(s).toLocaleString("ru-RU") + " ккал в день"}`}</p>${s.maxMinutes ? `<p>Блюда до ${s.maxMinutes} минут</p>` : ""}${button("Выбрать ещё блюда", "discover", "apricot", "heart")}</div>${showcase ? `<button class="cover-credit" type="button" data-action="recipe" data-id="${showcase.id}">${showcase.title} ${icon("open", 16)}</button>` : ""}</section>`;
}
function overviewWeek(p) {
  if (!p)
    return '<div class="sheet-body simple"><h2 id="sheet-title">Неделя пока не собрана</h2></div>';
  return `<div class="sheet-body simple"><h2 id="sheet-title">Меню на семь дней</h2><p class="quiet">${rangeText()} · ${profileName()}</p>${threeWeekTabs()}<div class="week-overview">${p.days.map((item, i) => `<button type="button" data-action="overview-day" data-day="${i}"><img src="${photo(item.meals[2].r)}" alt=""><span><b>${dayName(i)}</b>${servingSlots(item.meals).map(slot => `<small>${sweetMealLabel(item.meals[slot],slot)} · ${$(item.meals[slot].r.title)}</small>`).join("")}</span>${icon("right", 15)}</button>`).join("")}</div></div>`;
}
function threeWeekTabs() {
  return `<div class="three-weeks" aria-label="Ближайшие три недели">${[0, 1, 2].map((i) => `<button type="button" data-action="jump-week" data-value="${i}" aria-pressed="${offset === i}">Неделя ${i + 1}<small>${dateText(dateAt(0, i), { day: "numeric", month: "short" })} – ${dateText(dateAt(6, i), { day: "numeric", month: "short" })}</small></button>`).join("")}</div>`;
}
function weekVariety(p) {
  if (!p || !settings().strictTaste) return "";
  const notes=[];
  if (p.days.some(d=>!d.meals[2].manual && !fitsMainSlot(d.meals[2].r,2)))
    notes.push("Для части ужинов взяли блюда из обеденного выбора. Отметьте ещё пару блюд на ужин, чтобы чередовать их.");
  else if (p.days.some(d=>!d.meals[1].manual && !fitsMainSlot(d.meals[1].r,1)))
    notes.push("На некоторые обеды поставили блюда из выбора на ужин. Для большего разнообразия отметьте ещё пару блюд на обед.");
  const doubleDays=p.days.filter(d=>d.meals[1].r===d.meals[2].r && !(d.meals[1].manual && d.meals[2].manual)).length;
  if (doubleDays) {
    const mains=candidates(settings(),1).length;
    notes.push(mains===2 ? "Выбраны два основных блюда. Чтобы ни одно не повторялось три дня подряд, обед и ужин иногда совпадают. Выберите третье основное блюдо для чередования." : "В этой неделе есть совпадение обеда и ужина с учётом ваших замен. Можно выбрать ещё одно основное блюдо.");
  }
  const count=p.newCount;
  if (p.phase) notes.push(count ? "Впервые в этом трёхнедельном меню: "+count+" "+plural(count,"блюдо","блюда","блюд")+"." : "На этой неделе повторяются блюда из вашего выбора.");
  return notes.length ? `<div class="week-variety"><span>${notes.join(" ")}</span> <button type="button" class="link" data-action="discover">Выбрать ещё</button></div>` : "";
}
function calendar(p, kitchen) {
  return `<section class="calendar" aria-label="Выбор дня недели"><div class="week-line"><div class="week-link-group"><button type="button" class="link" data-action="all-week">Все 7 дней ${icon("right", 14)}</button></div>${weekControls()}</div><div class="dates ${kitchen ? "kitchen-dates" : ""}">${DAYS.map(
    (n, i) => {
      const d = dateAt(i),
        isToday = d.toDateString()===today.toDateString();
      return `<button type="button" class="date ${day === i ? "selected" : ""}" aria-label="${dayName(i)}, ${dateText(d, { day: "numeric", month: "long" })}" aria-pressed="${day === i}" ${isToday ? 'aria-current="date"' : ""} aria-description="${kitchen ? [settings().cook.includes(weekdayIndex(settings(),i)) && "День готовки",prepDone(kitchen[i],i) && "Всё сделано"].filter(Boolean).join(", ") : ""}" data-action="day" data-day="${i}"><small>${shortDay(i)}</small><b>${d.getDate()}</b>${kitchen ? prepFlags(kitchen[i],i) : ""}${isToday ? '<i aria-label="Сегодня"></i>' : ""}</button>`;
    },
  ).join("")}</div></section>`;
}
function fav(r) {
  return data.favorites.includes(r.id);
}
function heart(r) {
  return `<button class="heart ${fav(r) ? "saved" : ""}" type="button" data-action="heart" data-id="${r.id}" aria-pressed="${fav(r)}" aria-label="${fav(r) ? "Убрать из избранного" : "В избранное"}: ${$(r.title)}">${icon("heart", 19)}</button>`;
}
function mealCard(meal, slot) {
  const { r, f } = meal,
    kcal = Math.round((r.kcal * f) / servings(settings()));
  return `<article class="meal-card"><div class="card-image"><button type="button" class="photolink" data-action="recipe" data-id="${r.id}" data-slot="${slot}" aria-label="Рецепт: ${$(r.title)}"><img src="${photo(r)}" alt="" decoding="async"></button><span class="meal-label">${icon(slotIcons[slot], 15)} ${sweetMealLabel(meal,slot)}</span>${heart(r)}</div><button class="dish-title" type="button" data-action="recipe" data-id="${r.id}" data-slot="${slot}">${$(r.title)}</button><div class="card-meta"><span>${icon("clock", 15)} ${cookingTime(r)}</span>${equipmentBadges(r)}<i></i><span>${meal.personFactors ? meal.personFactors.map(f=>Math.round(f*r.kcal)).join(" / ")+" ккал" : kcal+" ккал / порция"}</span></div><button type="button" class="swap" data-action="${slot === 3 ? "dessert-open" : "swap"}" data-slot="${slot}">${icon("swap", 16)} Заменить</button></article>`;
}
function weekSummary(p,kitchen) {
  const s = settings(),
    n = Object.keys(p.counts).length;
  return `<aside class="summary"><h3>Неделя в деталях</h3><div class="summary-row">${icon("pot", 21)}<div><b>Дни готовки</b><small>${prepLoad(kitchen)}</small></div><button type="button" data-action="prep" class="mini-btn" aria-label="Посмотреть план готовки">${icon("right", 17)}</button></div><div class="summary-row">${icon("bag", 21)}<div><b>Продукты на неделю</b><small>${n} ${plural(n, "позиция", "позиции", "позиций")} · докупить ≈ <span data-purchase-total>${money(weeklyQuote(p).cents/100)}</span></small></div></div>${button("Открыть список", "list", "soft", "bag")}${sweetEntry(s,"week",p)}${sweetAgenda(p)}${portionCount(s) ? button(activePortionTargets(s)?"Изменить мои диапазоны КБЖУ":"Настроить порции по КБЖУ","portion-edit","outline") : ""}</aside>`;
}
function weekPage() {
  const p=plan();
  if(!p) return '<div class="wrap page">'+emptyPlan()+'</div>';
  const kitchen=prepWeek(), s=spendingProfile(), meals=p.days[day].meals, q=weeklyQuote(p);
  const nutrition=data.mode==="personal" || activePortionTargets(s) ? `<button class="macro-link" type="button" data-action="nutrition">${icon("fire",16)} ${p.pairMisses[day]>0?"КБЖУ вне диапазона":"КБЖУ дня"}</button>`:"";
  return `<div class="wrap page week-first"><div class="week-title"><h1>Меню недели</h1><span>${household(s)}</span></div>${calendar(p,kitchen)}
    <details class="week-spending"><summary><strong>Корзина ≈ <span data-purchase-total>${money(q.cents/100)}</span></strong><span data-quick-balance>${budgetBalance(s,q)}</span><b data-budget-details>${hasBudget(s)&&q.cents>s.budget*100?"Посмотреть замены":"Подробнее"}</b></summary>
    ${budgetPanel(p,q)}${s.stores?.length?'<section id="price-area"></section>':""}</details>
    <div class="week-body"><section class="mealsection"><div class="menu-heading"><h2>${dayName(day)}, ${dateText(dateAt(day),{day:"numeric",month:"short"})}</h2>${nutrition}</div>
    <div class="meal-grid">${servingSlots(meals).map(slot=>mealCard(meals[slot],slot)).join("")}</div>
    <div class="week-next">${button("Что готовить","prep-day","soft","pot")}${button("Открыть покупки","list","primary","bag")}</div>
    ${meals[3]?"":button("Добавить десерт","dessert-open","outline","plus")}${nutritionSwapCard(p,day)}${weekVariety(p)}
    ${button("Выбрать ещё блюда","discover","outline","heart")}</section>${weekSummary(p,kitchen)}</div><section id="week-coupons" aria-label="Купоны магазинов"></section></div>`;
}
function emptyPlan() {
  return `<div class="empty"><h2>Добавьте блюда для чередования</h2><p>Для недельного меню нужны минимум два подходящих завтрака и два основных блюда.</p>${button("Выбрать блюда", "discover", "primary", "heart")}</div>`;
}
function catCard(r) {
  const facts=bookRanges(bookFilters).filter(([key])=>key!=="kcal")
    .map(([,metric])=>`<span>${metric.label} ${bookNumber.format(metric.value(r))} г</span>`).join("");
  return `<article class="library-card"><div class="card-image"><button class="photolink" type="button" data-action="recipe" data-id="${r.id}" aria-label="Рецепт: ${$(r.title)}"><img loading="lazy" src="${photo(r)}" alt=""></button>${heart(r)}</div><button class="dish-title" type="button" data-action="recipe" data-id="${r.id}">${$(r.title)}</button><div class="card-meta"><span>${icon("clock", 15)} ${cookingTime(r)}</span>${equipmentBadges(r)}<i></i><span>${hasBookRange(bookFilters.kcal)?bookNumber.format(r.kcal):Math.round(r.kcal)} ккал / порция</span></div>${facts?`<div class="book-card-nutrients">${facts}</div>`:""}</article>`;
}
const libraryPicks = ["rl001","rd022","rb020","rd023","rl041","rb021","rd024","rl021","rb001","rd001","rl004","rb076","rd021","rl049","rb059","rl006","rb030","rd041"];
const bookMeals = {all:"Все", breakfast:"Завтрак", lunch:"Обед", dinner:"Ужин",dessert:"Десерт"};
const bookGroups = {
  cuisine: typeof bookCuisines==="undefined" ? {all:"Все кухни"} : bookCuisines,
  minutes: {"0":"Любое", "15":"До 15 мин", "30":"До 30 мин", "45":"До 45 мин"},
  kind: {all:"Любой", "суп":"Супы", "салат":"Салаты", "каша":"Каши", "котлеты":"Котлеты", "паста":"Паста", "запеканка":"Запеканки", "блины и оладьи":"Блины и оладьи", "вареники и пельмени":"Вареники и пельмени"},
  collection: {all:"Все рецепты", favorite:"Избранное", liked:"Хочу в меню"}
};
const bookDefaults={meal:"all",minutes:"0",kind:"all",collection:"all",cuisine:"all"};
const bookNutrients={
  kcal:{label:"Калории",unit:"ккал",value:r=>r.kcal},
  protein:{label:"Белки",unit:"г",value:r=>r.macros[0]},
  fat:{label:"Жиры",unit:"г",value:r=>r.macros[1]},
  carbs:{label:"Углеводы",unit:"г",value:r=>r.macros[2]}
};
const bookNumber=new Intl.NumberFormat("ru-RU",{maximumFractionDigits:1});
function hasBookRange(range) { return !!(range?.min || range?.max); }
function bookBound(text) { return Number(text.replace(",", ".")); }
function bookRangeError(range={}) {
  const {min,max}=range;
  if([min,max].some(s=>s && !/^\d+(?:[.,]\d+)?$/.test(s))) return "Введите число от нуля, например 30 или 12,5.";
  return min && max && bookBound(min)>bookBound(max) ? "Значение «до» должно быть не меньше «от»." : "";
}
function bookRanges(selection) {
  return Object.entries(bookNutrients).filter(([key])=>hasBookRange(selection[key]));
}
let bookFilters={...bookDefaults};
const recipeWords=new WeakMap();
const chickenKeys=new Set(["chicken","chickenThigh","chickenLegMeat","chickenWingMeat","chickenLiver","chickenGizzards","chickenHearts"]);
const fishAlias={fish:"рыба",molluscs:"морепродукты"};
const stopwords=new Set(["с","со","и","из","в","на","под","по","для"]);
function searchWords(text) {
  return text.toLocaleLowerCase("ru").replaceAll("ё","е").match(/[а-яa-z0-9]+/g) || [];
}
function wordStem(word) {
  // Case and adjective endings: «гречкой» and «гречка», «куриное» and «куриный».
  return word.length<4 ? word : word.replace(/(иями|ями|ами|ого|его|ому|ему|ыми|ими|ий|ый|ой|ей|ью|ая|яя|ое|ее|ые|ие|ую|юю|ых|их|ом|ем|ов|ев|ам|ям|ах|ях|а|я|у|ю|ы|и|е|о|ь)$/u,
    (ending,_,offset)=>offset>=3 ? "" : ending);
}
function recipeSearchWords(r) {
  if(!recipeWords.has(r)){
    const labels=[r.title,dishKind(r),...(r.cuisines || []).map(key=>cuisineNames[key]+" кухня")];
    for(const [k] of r.items){
      const item=FOOD[k];
      labels.push(item[0]);
      if(chickenKeys.has(k)) labels.push("курица куриный");
      for(const tag of item.slice(5).flat()) if(fishAlias[tag]) labels.push(fishAlias[tag]);
    }
    recipeWords.set(r,new Set(searchWords(labels.join(" ")).map(wordStem)));
  }
  return recipeWords.get(r);
}
function libraryItems(selection=bookFilters, query=search) {
  const terms=searchWords(query).filter(word=>!stopwords.has(word)).map(wordStem);
  const bounds=bookRanges(selection).map(([key,metric])=>{
    const {min,max}=selection[key];
    return {metric,low:min?bookBound(min):0,high:max?bookBound(max):Infinity};
  });
  const s={...settings(),maxMinutes:Number(selection.minutes)};
  const matches=r=>{
    if(!allowed(s,r)) return false;
    if(selection.cuisine!=="all" && !r.cuisines.includes(selection.cuisine)) return false;
    if(selection.meal==="dessert" && !dessertIds.has(r.id)) return false;
    const slot=["breakfast","lunch","dinner"].indexOf(selection.meal);
    if(slot>=0 && !servingChoices(r).includes(slot)) return false;
    if(selection.kind!=="all" && dishKind(r)!==selection.kind) return false;
    if(selection.collection==="favorite" && !fav(r)) return false;
    if(selection.collection==="liked" && s.votes[r.id]!==1) return false;
    if(!bounds.every(({metric,low,high})=>{
      // Products are summed in floating point. Keep exact inclusive endpoints
      // without admitting a dish just because its displayed total rounded down.
      const value=metric.value(r);
      return value>=low-1e-9 && value<=high+1e-9;
    })) return false;
    if(!terms.length) return true;
    const words=recipeSearchWords(r);
    return terms.every(term=>words.has(term) || (term.length>=3 && [...words].some(word=>word.startsWith(term))));
  };
  const picks=libraryPicks.map(byId).filter(Boolean);
  return picks.concat(RECIPES.filter(r=>!libraryPicks.includes(r.id))).filter(matches);
}
function bookCount(n) { return n+" "+plural(n,"рецепт","рецепта","рецептов"); }
function bookResultCount(n) {
  return n===RECIPES.length ? bookCount(n) : n+" из "+RECIPES.length+" рецептов";
}
function appliedBookGroups(selection=bookFilters) {
  return Object.keys(bookGroups).filter(k=>selection[k]!==bookDefaults[k]).concat(bookRanges(selection).map(([key])=>key));
}
function bookTag(key) {
  if(bookGroups[key]) return bookGroups[key][bookFilters[key]];
  const {min,max}=bookFilters[key], {label,unit}=bookNutrients[key];
  const format=s=>String(bookBound(s)).replace(".",",");
  const range=min && max ? `${format(min)}–${format(max)}` : min ? "от "+format(min) : "до "+format(max);
  return `${label} ${range} ${unit}`;
}
function libraryControls() {
  const active=appliedBookGroups(),hasAny=search.trim() || bookFilters.meal!=="all" || active.length;
  return `<div class="book-meals" role="group" aria-label="Приём пищи">${Object.entries(bookMeals).map(([value,label])=>
    `<button type="button" data-action="book-meal" data-value="${value}" aria-pressed="${bookFilters.meal===value}">${label}</button>`).join("")}</div>
    <div class="book-applied">${active.map(k=>`<button class="book-tag" type="button" data-action="book-remove" data-value="${k}" aria-label="Убрать фильтр: ${bookTag(k)}">${k==="cuisine" ? cuisineLabel(bookFilters.cuisine) : bookTag(k)} ${icon("close",13)}</button>`).join("")}
      <button type="button" class="link book-reset" data-action="clear-search" ${hasAny?"":"hidden"}>Сбросить всё</button></div>`;
}
function libraryResults(available=libraryItems()) {
  if(available.length) return `<div class="library">${available.slice(0,libraryLimit).map(catCard).join("")}</div>${available.length>libraryLimit ? button("Показать ещё "+Math.min(36,available.length-libraryLimit),"more-recipes","outline","plus") : ""}`;
  const noFav=bookFilters.collection==="favorite" && !data.favorites.length;
  const noLikes=bookFilters.collection==="liked" && !Object.values(settings().votes).includes(1);
  const title=noFav?"В избранном пока пусто":noLikes?"Вы ещё не выбрали блюда":"Рецептов не нашлось";
  const hint=noFav?"Сохраняйте понравившиеся рецепты сердечком на фотографии.":noLikes?"Отмечайте блюда кнопкой «Хочу в меню».":"Попробуйте другой запрос или снимите один из фильтров.";
  const any=bookFilters.meal!=="all" || appliedBookGroups().length || search.trim();
  return `<div class="empty"><h2>${title}</h2><p>${any?hint:"С текущими настройками меню нет подходящих рецептов."}</p>${any ? button("Все подходящие рецепты","clear-search","soft") : button("Настройки меню","settings","soft")}</div>`;
}
function updateBookResults() {
  libraryLimit=36;
  const results=libraryItems();
  document.querySelector(".library-count").textContent=bookResultCount(results.length);
  document.getElementById("library-results").innerHTML=libraryResults(results);
  document.querySelector(".book-reset").hidden=!(search.trim() || bookFilters.meal!=="all" || appliedBookGroups().length);
}
function bookNutritionFields(selection) {
  return `<details class="book-nutrition" ${bookRanges(selection).length?"open":""}><summary>КБЖУ на порцию ${icon("right",16)}</summary>
    <div class="book-range-grid"><span></span><span aria-hidden="true">От</span><span aria-hidden="true">До</span>
    ${Object.entries(bookNutrients).map(([key,{label,unit}])=>`<span class="book-range-name">${label}<small>${unit}</small></span>
      ${["min","max"].map((bound,i)=>`<input type="text" inputmode="decimal" maxlength="12" autocomplete="off" data-nutrient="${key}" data-bound="${bound}" value="${$(selection[key]?.[bound]||"")}" aria-label="${label}, ${i?"до":"от"}, ${unit}" aria-describedby="book-error-${key}">`).join("")}
      <span class="book-range-error" id="book-error-${key}" role="status"></span>`).join("")}</div></details>`;
}
function bookApplyLabel(n) { return n?"Показать "+bookCount(n):"Показать результаты (0)"; }
function refreshBookDraft(selection) {
  let invalid=false;
  for(const key of Object.keys(bookNutrients)) {
    const message=bookRangeError(selection[key]);
    const hint=sheet.querySelector("#book-error-"+key);
    if(hint.textContent!==message) hint.textContent=message;
    for(const field of sheet.querySelectorAll(`[data-nutrient="${key}"]`))
      field.setAttribute("aria-invalid",String(!!message && !!field.value));
    if(message) invalid=true;
  }
  const apply=sheet.querySelector('[data-action="book-apply"]');
  apply.disabled=invalid;
  apply.textContent=invalid?"Проверьте диапазон":bookApplyLabel(libraryItems(selection).length);
}
function bookFilterSheet(selection) {
  const labels={minutes:"Время на блюдо",kind:"Вид блюда",collection:"Мои блюда"};
  const n=libraryItems(selection).length;
  const fields=Object.entries(bookGroups).map(([key,choices])=>{
    if(key==="cuisine") return `<label class="book-cuisine">Кухня<span class="book-cuisine-choice"><span data-book-flag aria-hidden="true">${cuisineFlag(selection.cuisine)}</span><select id="book-cuisine">${Object.entries(choices).map(([value,label])=>`<option value="${value}" ${selection.cuisine===value?"selected":""}>${label}</option>`).join("")}</select></span></label>`;
    const options=Object.entries(choices).map(([value,label])=>`<button type="button" class="chip" aria-pressed="${selection[key]===value}" data-action="book-option" data-key="${key}" data-value="${value}">${label}</button>`).join("");
    return `<fieldset class="book-field"><legend>${labels[key]}</legend><div>${options}</div></fieldset>${key==="minutes"?bookNutritionFields(selection):""}`;
  }).join("");
  return `<div class="sheet-body simple book-filter-sheet"><h2 id="sheet-title">Фильтры рецептов</h2>
    ${fields}
    <div class="book-filter-footer"><button class="link" type="button" data-action="book-reset-draft">Сбросить фильтры</button>
    <button type="button" class="btn primary" data-action="book-apply" aria-live="polite">${bookApplyLabel(n)}</button></div></div>`;
}
function recipesPage() {
  const available=libraryItems(),count=appliedBookGroups().length;
  return `<div class="wrap inner-page cookbook"><div class="view-title"><div><h1>Книга рецептов</h1></div>${button("Выбрать блюда по фото","discover","soft","heart")}</div>
    <div class="book-tools"><div class="book-search-row"><label class="searchbox">${icon("search",18)}<input id="recipe-search" value="${$(search)}" placeholder="Блюдо или продукт" aria-label="Найти блюдо или продукт" type="search"></label>
    <button class="book-filter-button" type="button" data-action="book-filters" aria-haspopup="dialog">${icon("sliders",17)} Фильтры${count?" · "+count:""}</button></div>${libraryControls()}</div>
    <p class="quiet library-count" role="status" aria-atomic="true">${bookResultCount(available.length)}</p><section id="library-results" aria-label="Найденные рецепты">${libraryResults(available)}</section></div>`;
}
const categories = [
  [
    "Овощи, фрукты и зелень",
    [
      "apple",
      "banana",
      "potato",
      "carrot",
      "tomato",
      "cucumber",
      "cabbage",
      "zucchini",
      "onion",
      "dill",
      "basil",
      "raspberry",
      "mushroom",
      "parsley",
      "pumpkin",
    ],
  ],
  ["Мясо, рыба и яйца", ["chicken", "fish", "salmon", "egg"]],
  ["Молочные продукты", ["curd", "yogurt", "milk"]],
  ["Крупы и бакалея", []],
];
// Ignore floating-point noise from scaled portions at a pack boundary.
const neededGrams = (g) => Math.ceil(g - 1e-7);
function groceryGroups(p) {
  const groups = categories.map(([label]) => ({ label, items: [] }));
  for (const [k, g] of Object.entries(p.counts)) {
    let i = categories.findIndex(([, ids]) => ids.includes(k));
    if (i < 0) i = homeFoodGroups[k] ?? groups.length - 1;
    groups[i].items.push({ k, g: neededGrams(g) });
  }
  for (const group of groups)
    group.items.sort((a, b) => FOOD[a.k][0].localeCompare(FOOD[b.k][0], "ru"));
  return groups.filter((x) => x.items.length);
}
function remainingGrams(k, g) {
  return Math.max(0, neededGrams(g) - (weekData().pantry[k] || 0));
}
function checked(k, g) {
  return remainingGrams(k, g) === 0;
}
function cartHas(k,g) {
  const need=remainingGrams(k,g);
  return need>0 && (weekData().cart?.[k]||0)>=need;
}
function cartFigures(p,q) {
  let picked=0;
  for(const [k,g] of Object.entries(accountedPurchases(weekData(),p.counts))){
    picked+=(cataloguePurchase(k,g,q.store)||estimatedPurchase(k,g,q.store)).cents;
  }
  return `<strong>В корзине ≈ ${money(picked/100)}</strong><span>Осталось взять ≈ ${money((q.cents-picked)/100)} · Всего ≈ ${money(q.cents/100)}</span>`;
}
function shopRows(groups,p,q) {
  const picked=[];
  const sections=groups.map(({label,items})=>{
    const rows=[];
    for(const {k,g} of items){
      const need=remainingGrams(k,g);
      if(!need) continue;
      const inCart=cartHas(k,g);
      const row=`<label class="grocery"><input type="checkbox" data-cart="${k}" aria-label="В корзине: ${$(FOOD[k][0])}" ${inCart?"checked":""}><i>${icon("check",13)}</i><span>${$(FOOD[k][0])}<small class="line-price" data-line-price>${shoppingPriceNote(k,need,q.store)}</small></span><b>${shoppingAmount(k,need,q.store)}</b></label>`;
      (inCart?picked:rows).push(row);
    }
    return rows.length?`<section class="groceries"><h2>${label}</h2>${rows.join("")}</section>`:"";
  }).join("");
  for(const [k,g] of Object.entries(weekData().cart||{})){
    if(g>0 && FOOD[k] && !remainingGrams(k,p.counts[k]||0))picked.push(`<label class="grocery"><input type="checkbox" data-cart="${k}" checked><i>${icon("check",13)}</i><span>${$(FOOD[k][0])}<small>Уже взяли · по меню докупать не нужно</small></span><b>${weeklyNeed(k,g)}</b></label>`);
  }
  return `<div class="cart-figures" data-cart-total>${cartFigures(p,q)}</div><div class="groups">${sections || "<p>Всё собрано.</p>"}${picked.length?'<section class="groceries"><h2>В корзине</h2>'+picked.join("")+'</section>':""}</div>`;
}
function stockUnit(k) {
  if(k==="egg")return {unit:"шт.",grams:50};
  if(["oil","milk","kefir","ryazhenka","cream","kvass"].includes(k))
    return {unit:"мл",grams:k==="oil"?.92:k==="milk"?1.03:1};
  return {unit:"г",grams:1};
}
function stockPanel(k){
  const unit=stockUnit(k),stock=weekData().pantry[k]||0;
  return `<div class="sheet-body simple"><h2 id="sheet-title">${$(FOOD[k][0])}</h2><p>На неделю нужно ≈ ${weeklyNeed(k,neededGrams(plan().counts[k]))}. Укажите, сколько уже есть дома.</p>
    <form id="stock-form" data-key="${k}"><label class="field">Дома, ${unit.unit}<input type="number" inputmode="decimal" name="stock" min="0" max="1000000" step="any" required value="${stock?Number((stock/unit.grams).toFixed(2)):""}"></label>
    <button type="submit" class="btn primary">Сохранить остаток</button></form></div>`;
}
function pantryRow(k,g,store){
  const stock=weekData().pantry[k]||0,need=remainingGrams(k,g);
  return `<div class="pantry-row"><label class="grocery"><input type="checkbox" data-pantry="${k}" aria-label="Дома хватает: ${$(FOOD[k][0])}" ${need?"":"checked"}><i>${icon("check",13)}</i>
    <span>${$(FOOD[k][0])}<small class="recipe-need">На неделю ≈ ${weeklyNeed(k,g)}</small>${stock>0?`<small class="recipe-need">Дома ≈ ${weeklyNeed(k,stock)}${need?" · не хватает ≈ "+weeklyNeed(k,need):""}</small>`:""}
    <small class="line-price" data-line-price>${need?$(shoppingPriceNote(k,need,store)):""}</small></span>
    <b>${need?"Купить: "+$(shoppingAmount(k,need,store)):"Есть дома"}</b></label>
    <button type="button" class="link stock-link" data-action="stock" data-id="${k}">${stock?"Изменить остаток":"Указать остаток"}</button></div>`;
}
function groceries() {
  const p = plan();
  if (!p) return `<div class="wrap inner-page">${emptyPlan()}</div>`;
  const q = weeklyQuote(p), store=q.store;
  const groups = groceryGroups(p),
    all = groups.flatMap((x) => x.items),
    todo = all.filter((x) => !checked(x.k, x.g));
  const storeMode=data.shoppingMode==="store";
  const top=`<div class="wrap inner-page listpage"><div class="view-title"><div><h1>Список продуктов</h1><p>${storeMode?"Отмечайте продукты, когда кладёте их в корзину.":"Поставьте галочку, если продукта хватает. Если есть только часть, укажите остаток."}</p></div>${weekControls()}</div>
    <div class="seg shopping-switch">${choiceChip("shopping-mode","home","Проверить дома",!storeMode)}${choiceChip("shopping-mode","store","В магазине",storeMode)}</div>`;
  if(storeMode) return top+shopRows(groups,p,q)+'<details class="week-spending"><summary>Бюджет и цены</summary>'+budgetPanel(p,q)+'<section id="price-area"></section></details></div>';
  return `${top}<div class="list-layout"><div class="groups">${groups.map(({ label, items }) => `<section class="groceries"><h2>${label}</h2>${items.map(({k,g})=>pantryRow(k,g,store)).join("")}</section>`).join("")}</div><aside class="summary list-summary"><h3>Осталось купить</h3><strong class="list-count">${todo.length}<small> из ${all.length}</small></strong><div class="progress-track"><i style="width:${(100 * (all.length - todo.length)) / all.length}%"></i></div><p class="quiet">По отмеченным продуктам список обновляется сразу.</p>${button("Скопировать список", "copy", "primary", "copy", todo.length ? "" : "disabled")}<div id="copy-fallback"></div><p class="fine">Докупить примерно на <strong data-purchase-total>${money(q.cents/100)}</strong></p></aside></div><details class="week-spending"><summary>Бюджет, замены и цены магазинов</summary>${budgetPanel(p,q)}<section id="price-area"></section></details></div>`;
}
