"use strict";
const main = document.getElementById("content"),
  sheet = document.getElementById("sheet");
const slotNames = ["Завтрак", "Обед", "Ужин"],
  slotIcons = ["sun", "cloud", "moon"];
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
function dateAt(day, off = offset) {
  return new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() + off * 7 + day,
    12,
  );
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
let offset = 0,
  day = todayIndex,
  route = "week",
  draft = null,
  step = 1,
  libraryLimit = 36,
  search = "",
  openInfo = null,
  toastTimer = null,
  lastPlan = null;
function persist() {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    notify("В этом браузере меню сохранится только до закрытия страницы.");
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
function plan(preview = null) {
  const s = settings(),
    seed = weekSeed();
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
    if (!manualHistory && !nutritionHistory) continue;
    const [y, m, d] = key.split("/")[1].split("-").map(Number);
    const edited = Math.round((Date.UTC(y,m-1,d) - Date.UTC(2026,10,9)) / 604800000);
    if (Number.isFinite(edited) && edited <= seed && manualHistory) first=Math.min(first,edited-1-phaseOf(edited-1));
    if (nutritionHistory && edited<seed) first=Math.min(first,edited-phaseOf(edited));
  }
  const weeks=Array.from({length:seed-first+1},(_,i)=>data.weeks[data.mode+"/"+weekKey(offset-(seed-first)+i)]);
  const records=weeks.map(w=>w?.replacements || {});
  const nutrition=weeks.map(w=>w?.nutritionSwaps);
  if(preview) records[records.length-1] = {...records[records.length-1],...preview};
  const signature = JSON.stringify([seed, s, records, nutrition]);
  if (lastPlan?.signature === signature) return lastPlan.value;
  const prior = new Map();
  let value;
  let previous = [];
  for (let n = first; n <= seed; n++) {
    const phase = phaseOf(n);
    if (!phase) prior.clear();
    value = budgetPlan(s,n,records[n-first],prior,phase,previous);
    value=withNutritionSwaps(s,value,nutrition[n-first],prior,previous);
    if (n === seed) break;
    if (!value) { previous = []; continue; }
    previous = value.days.slice(-2);
    rememberWeek(prior,value);
  }
  if (!preview) lastPlan = { signature, value, previous };
  return value;
}
function readRoute() {
  const h = location.hash.slice(1);
  if (!h || /(?:^|&)tgWebApp(?:Data|Version|Platform)=/.test(h)) {
    const q = new URLSearchParams(location.search);
    const section = q.get("mini") === "1" ? q.get("section") : null;
    if (["recipes","list","coupons"].includes(section)) return section;
  }
  if (
    h === "start" ||
    (!h && (history.state?.foodQuiz || !data.quizDone)) ||
    (/tgWebApp/.test(h) && !data.quizDone)
  )
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
  return `<div class="week-control">${iconBtn("left", "Предыдущая неделя", "prev")}<span>${rangeText()}</span>${iconBtn("right", "Следующая неделя", "next")}${offset ? `<button class="link todaylink" type="button" data-action="thisweek">Текущая неделя</button>` : ""}</div>`;
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
  return `<div class="sheet-body simple"><h2 id="sheet-title">Меню на семь дней</h2><p class="quiet">${rangeText()} · ${profileName()}</p><div class="week-overview">${p.days.map((item, i) => `<button type="button" data-action="overview-day" data-day="${i}"><img src="${photo(item.meals[2].r)}" alt=""><span><b>${dayNames[i]}</b>${item.meals.map((m, slot) => `<small>${slotNames[slot]} · ${$(m.r.title)}</small>`).join("")}</span>${icon("right", 15)}</button>`).join("")}</div></div>`;
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
  if (p.days.some(d=>d.meals[1].r===d.meals[2].r && !d.meals[1].manual && !d.meals[2].manual))
    notes.push("Иногда обед и ужин совпадают. Для разных блюд в один день выберите хотя бы три основных.");
  const count=p.newCount;
  if (p.phase) notes.push(count ? "Впервые в этом трёхнедельном меню: "+count+" "+plural(count,"блюдо","блюда","блюд")+"." : "На этой неделе повторяются блюда из вашего выбора.");
  return notes.length ? `<div class="week-variety"><span>${notes.join(" ")}</span> <button type="button" class="link" data-action="discover">Выбрать ещё</button></div>` : "";
}
function calendar(p) {
  return `<section class="calendar" aria-label="Выбор дня недели"><div class="week-line"><div class="week-link-group"><h2>План на неделю</h2><button type="button" class="link" data-action="all-week">Все 7 дней ${icon("right", 14)}</button></div>${weekControls()}</div>${threeWeekTabs()}${weekVariety(p)}<div class="dates">${DAYS.map(
    (n, i) => {
      const d = dateAt(i),
        isToday = offset === 0 && i === todayIndex;
      return `<button type="button" class="date ${day === i ? "selected" : ""}" aria-label="${dayNames[i]}, ${dateText(d, { day: "numeric", month: "long" })}" aria-pressed="${day === i}" data-action="day" data-day="${i}"><small>${n}</small><b>${d.getDate()}</b>${isToday ? '<i aria-label="Сегодня"></i>' : ""}</button>`;
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
  return `<article class="meal-card"><div class="card-image"><button type="button" class="photolink" data-action="recipe" data-id="${r.id}" data-slot="${slot}" aria-label="Рецепт: ${$(r.title)}"><img src="${photo(r)}" alt="" decoding="async"></button><span class="meal-label">${icon(slotIcons[slot], 15)} ${slotNames[slot]}</span>${heart(r)}</div><button class="dish-title" type="button" data-action="recipe" data-id="${r.id}" data-slot="${slot}">${$(r.title)}</button><div class="card-meta"><span>${icon("clock", 15)} ${cookingTime(r)}</span><i></i><span>${meal.personFactors ? meal.personFactors.map(f=>Math.round(f*r.kcal)).join(" / ")+" ккал" : kcal+" ккал / порция"}</span></div><button type="button" class="swap" data-action="swap" data-slot="${slot}">${icon("swap", 16)} Заменить</button></article>`;
}
function prepNote(p) {
  const d = p.days[day];
  if (d.prep) return "Порции к началу недели готовятся заранее.";
  if (!d.freshly) {
    if (d.start === 0 && !settings().cook.includes(0))
      return "Сегодня используем заготовки к началу недели.";
    return (
      "Сегодня используем заготовки " +
      [
        "с понедельника",
        "со вторника",
        "со среды",
        "с четверга",
        "с пятницы",
        "с субботы",
        "с воскресенья",
      ][d.start] +
      "."
    );
  }
  const batch = batchDays(settings(), day);
  return batch.length === 1
    ? "Готовим только на этот день."
    : `Готовим сразу на ${batch.length} ${plural(batch.length, "день", "дня", "дней")}.`;
}
function weekSummary(p) {
  const s = settings(),
    n = Object.keys(p.counts).length;
  return `<aside class="summary"><h3>Неделя в деталях</h3><div class="summary-row">${icon("pot", 21)}<div><b>Дни готовки</b><small>${s.cook.map((i) => DAYS[i]).join(" · ")}</small></div><button type="button" data-action="prep" class="mini-btn" aria-label="Посмотреть план готовки">${icon("right", 17)}</button></div><div class="summary-row">${icon("bag", 21)}<div><b>Продукты на неделю</b><small>${n} ${plural(n, "позиция", "позиции", "позиций")} · докупить ≈ <span data-purchase-total>${money(weeklyQuote(p).cents/100)}</span></small></div></div>${button("Открыть список", "list", "soft", "bag")}${portionCount(s) ? button(activePortionTargets(s)?"Изменить мои диапазоны КБЖУ":"Настроить порции по КБЖУ","portion-edit","outline") : ""}</aside>`;
}
function weekPage() {
  const p = plan();
  return `<div class="wrap page">${hero(p)}${p ? budgetPanel(p) : ""}${p && settings().stores?.length ? '<section class="week-prices" id="price-area"></section>' : ""}${calendar(p)}${p ? `<div class="week-body"><section class="mealsection"><div class="menu-heading"><div><h2>${dayNames[day]}<span class="day-suffix">, ${dateText(dateAt(day), { day: "numeric", month: "long" })}</span></h2><p class="quiet">${prepNote(p)}</p></div>${data.mode === "personal" || activePortionTargets(settings()) ? `<button class="macro-link" type="button" data-action="nutrition">${icon("fire", 16)} ${p.pairMisses[day]>0 ? "КБЖУ вне диапазона" : "КБЖУ дня"}</button>` : ""}</div>${nutritionSwapCard(p,day)}<div class="meal-grid">${p.days[day].meals.map(mealCard).join("")}</div></section>${weekSummary(p)}</div><section id="week-coupons" aria-label="Купоны магазинов"></section>` : emptyPlan()}</div>`;
}
function emptyPlan() {
  return `<div class="empty"><h2>Добавьте блюда для чередования</h2><p>Для недельного меню нужны минимум два подходящих завтрака и два основных блюда.</p>${button("Выбрать блюда", "discover", "primary", "heart")}</div>`;
}
function catCard(r) {
  return `<article class="library-card"><div class="card-image"><button class="photolink" type="button" data-action="recipe" data-id="${r.id}" aria-label="Рецепт: ${$(r.title)}"><img loading="lazy" src="${photo(r)}" alt=""></button>${heart(r)}</div><button class="dish-title" type="button" data-action="recipe" data-id="${r.id}">${$(r.title)}</button><div class="card-meta"><span>${icon("clock", 15)} ${cookingTime(r)}</span><i></i><span>${Math.round(r.kcal)} ккал / порция</span></div></article>`;
}
const libraryPicks = ["rl001","rd022","rb020","rd023","rl041","rb021","rd024","rl021","rb001","rd001","rl004","rb076","rd021","rl049","rb059","rl006","rb030","rd041"];
const bookMeals = {all:"Все", breakfast:"Завтрак", lunch:"Обед", dinner:"Ужин"};
const bookGroups = {
  minutes: {"0":"Любое", "15":"До 15 мин", "30":"До 30 мин", "45":"До 45 мин"},
  kind: {all:"Любой", "суп":"Супы", "салат":"Салаты", "каша":"Каши", "котлеты":"Котлеты", "паста":"Паста", "запеканка":"Запеканки", "блины и оладьи":"Блины и оладьи", "вареники и пельмени":"Вареники и пельмени"},
  collection: {all:"Все рецепты", favorite:"Избранное", liked:"Хочу в меню"}
};
const bookDefaults={meal:"all",minutes:"0",kind:"all",collection:"all"};
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
    const labels=[r.title,dishKind(r)];
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
  const s=settings();
  const matches=r=>{
    if(!allowed(s,r)) return false;
    const role=mealRole(r);
    if(selection.meal!=="all" && selection.meal!==role &&
      !(role==="either" && (selection.meal==="lunch" || selection.meal==="dinner"))) return false;
    if(selection.minutes!=="0" && r.minutes>Number(selection.minutes)) return false;
    if(selection.kind!=="all" && dishKind(r)!==selection.kind) return false;
    if(selection.collection==="favorite" && !fav(r)) return false;
    if(selection.collection==="liked" && s.votes[r.id]!==1) return false;
    if(!terms.length) return true;
    const words=recipeSearchWords(r);
    return terms.every(term=>words.has(term) || (term.length>=3 && [...words].some(word=>word.startsWith(term))));
  };
  const picks=libraryPicks.map(byId).filter(Boolean);
  return picks.concat(RECIPES.filter(r=>!libraryPicks.includes(r.id))).filter(matches);
}
function bookCount(n) { return n+" "+plural(n,"рецепт","рецепта","рецептов"); }
function appliedBookGroups(selection=bookFilters) {
  return Object.keys(bookGroups).filter(k=>selection[k]!==bookDefaults[k]);
}
function libraryControls() {
  const active=appliedBookGroups(),hasAny=search.trim() || bookFilters.meal!=="all" || active.length;
  return `<div class="book-meals" role="group" aria-label="Приём пищи">${Object.entries(bookMeals).map(([value,label])=>
    `<button type="button" data-action="book-meal" data-value="${value}" aria-pressed="${bookFilters.meal===value}">${label}</button>`).join("")}</div>
    <div class="book-applied">${active.map(k=>`<button class="book-tag" type="button" data-action="book-remove" data-value="${k}" aria-label="Убрать фильтр: ${bookGroups[k][bookFilters[k]]}">${bookGroups[k][bookFilters[k]]} ${icon("close",13)}</button>`).join("")}
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
  document.querySelector(".library-count").textContent=bookCount(results.length);
  document.getElementById("library-results").innerHTML=libraryResults(results);
  document.querySelector(".book-reset").hidden=!(search.trim() || bookFilters.meal!=="all" || appliedBookGroups().length);
}
function bookFilterSheet(selection) {
  const labels={minutes:"Время на блюдо",kind:"Вид блюда",collection:"Мои блюда"};
  const n=libraryItems(selection).length;
  return `<div class="sheet-body simple book-filter-sheet"><h2 id="sheet-title">Фильтры рецептов</h2>
    ${Object.entries(bookGroups).map(([key,choices])=>`<fieldset class="book-field"><legend>${labels[key]}</legend><div>${Object.entries(choices).map(([value,label])=>`<button type="button" class="chip" aria-pressed="${selection[key]===value}" data-action="book-option" data-key="${key}" data-value="${value}">${label}</button>`).join("")}</div></fieldset>`).join("")}
    <div class="book-filter-footer"><button class="link" type="button" data-action="book-reset-draft">Сбросить фильтры</button>
    <button type="button" class="btn primary" data-action="book-apply" aria-live="polite">${n?"Показать "+bookCount(n):"Показать результаты (0)"}</button></div></div>`;
}
function recipesPage() {
  const available=libraryItems(),count=appliedBookGroups().length;
  return `<div class="wrap inner-page cookbook"><div class="view-title"><div><h1>Книга рецептов</h1></div>${button("Выбрать блюда по фото","discover","soft","heart")}</div>
    <div class="book-tools"><div class="book-search-row"><label class="searchbox">${icon("search",18)}<input id="recipe-search" value="${$(search)}" placeholder="Блюдо или продукт" aria-label="Найти блюдо или продукт" type="search"></label>
    <button class="book-filter-button" type="button" data-action="book-filters" aria-haspopup="dialog">${icon("sliders",17)} Фильтры${count?" · "+count:""}</button></div>${libraryControls()}</div>
    <p class="quiet library-count" role="status" aria-atomic="true">${bookCount(available.length)}</p><section id="library-results" aria-label="Найденные рецепты">${libraryResults(available)}</section></div>`;
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
function groceries() {
  const p = plan();
  if (!p) return `<div class="wrap inner-page">${emptyPlan()}</div>`;
  const q = weeklyQuote(p), store=q.store;
  const groups = groceryGroups(p),
    all = groups.flatMap((x) => x.items),
    todo = all.filter((x) => !checked(x.k, x.g));
  return `<div class="wrap inner-page listpage"><div class="view-title"><div><h1>Список продуктов</h1><p>Сверьте расход на неделю с запасами. Поставьте галочку, если дома хватает на всё меню. Для покупки показаны целые упаковки или вес. Без данных магазина фасовка примерная.</p></div>${weekControls()}</div>${budgetPanel(p,q)}<section id="price-area" class="price-section"></section><div class="list-layout"><div class="groups">${groups.map(({ label, items }) => `<section class="groceries"><h2>${label}</h2>${items.map(({ k, g }) => `<label class="grocery"><input type="checkbox" data-pantry="${k}" aria-label="Дома хватает: ${$(FOOD[k][0])}" ${checked(k, g) ? "checked" : ""}><i>${icon("check", 13)}</i><span>${FOOD[k][0]}<small class="recipe-need">На неделю ≈ ${weeklyNeed(k,g)}</small></span><b>${checked(k,g) ? "Есть дома" : "Купить: "+$(shoppingAmount(k, remainingGrams(k,g),store))}</b></label>`).join("")}</section>`).join("")}</div><aside class="summary list-summary"><h3>Осталось купить</h3><strong class="list-count">${todo.length}<small> из ${all.length}</small></strong><div class="progress-track"><i style="width:${(100 * (all.length - todo.length)) / all.length}%"></i></div><p class="quiet">По отмеченным продуктам список обновляется сразу.</p>${button("Скопировать список", "copy", "primary", "copy", todo.length ? "" : "disabled")}<div id="copy-fallback"></div><p class="fine">Докупить примерно на <strong data-purchase-total>${money(q.cents/100)}</strong></p></aside></div></div>`;
}
