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
function dessertPanel() {
  const current = weekData().desserts?.[day];
  const options = RECIPES.filter(r => allowsDessert(settings(), r));
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
  else delete week.desserts[day];
  persist();
  dismissSheet();
  render();
}
function remainingDessertTargets(row, recipe) {
  const nutrients = [recipe.kcal, ...recipe.macros];
  return row.map((range, i) => range && range.map(x => Math.max(0.01, x - nutrients[i] * dessertPortion)));
}
