function render({ top = false } = {}) {
  header();
  main.innerHTML =
    route === "coupons" ? couponsPage() : route === "tastes"
      ? discoveryPage()
      : route === "start"
        ? funnelPage()
        : route === "settings"
          ? setupPage()
          : route === "recipes"
            ? recipesPage()
            : route === "list"
              ? groceries()
              : weekPage();
  if (route === "coupons" || route === "week") mountCoupons();
  if (route === "week" || route === "list") {mountQuotes();mountBudgetOffer();}
  else clearPerekQuote();
  if (top) {
    window.scrollTo({ top: 0, behavior: "instant" });
    main.focus({ preventScroll: true });
  }
  tgBack();
}
function restartMenu() {
  const next = { ...freshPlanner(), favorites: data.favorites, quizRun: crypto.randomUUID() };
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    notify("Не удалось сбросить меню. Проверьте доступ браузера к хранилищу.");
    return;
  }
  try {
    sessionStorage.removeItem(flowKey);
    for (const mode of ["family", "personal"]) {
      sessionStorage.removeItem("zastol-quiz-2" + mode);
      sessionStorage.removeItem("kbr-syt-tasting-" + mode);
    }
  } catch {}
  history.replaceState(null, "", "#start");
  location.reload();
}
function changeWeek(delta) {
  offset = settings().startDate ? Math.max(0,offset+delta) : offset+delta;
  day = currentDay(offset);
  render();
}
function markFavorite(id) {
  const r = byId(id);
  if (!r) return;
  const saved = fav(r);
  data.favorites = saved
    ? data.favorites.filter((x) => x !== id)
    : [...data.favorites, id];
  persist();
  render();
  if (sheet.open && openInfo?.kind === "recipe") {
    const sc = sheet.querySelector(".dialog-scroll")?.scrollTop || 0;
    renderSheet();
    sheet.querySelector(".dialog-scroll").scrollTop = sc;
  }
  notify(saved ? "Убрано из избранного" : "Сохранено в избранное");
}
function replaceMeal(id, d, slot, oneDayAnalog = false) {
  const recipe = byId(id);
  if (!canPlace(settings(), recipe, slot)) return;
  if (oneDayAnalog ? !dishSimilarity(plan().days[d].meals[slot].r, recipe) : !eligible(settings(), recipe)) return;
  const key="day:"+d+"-"+slot;
  if (plan({[key]:id})?.days[d].meals[slot]?.r.id!==id) {
    notify("Эта замена не оставляет блюда для чередования. Выберите другое блюдо или добавьте ещё одно в «Что хочется съесть?».");
    return;
  }
  const record=weekData();
  record.replacements[key]=id;
  if(record.budgetEdits) record.budgetEdits=record.budgetEdits.filter(e=>e.d!==d || e.slot!==slot);
  if (weekData().nutritionSwaps) delete weekData().nutritionSwaps[d+"-"+slot];
  day = d;
  persist();
  const move = route !== "week";
  if (move && history.state?.mealSheet)
    addEventListener("popstate", () => navTo("week"), { once: true });
  else if (move) navTo("week");
  dismissSheet();
  render();
  notify("Меню и список продуктов обновлены");
}
async function copyList() {
  const p=plan(), store=weeklyQuote(p).store;
  const groups = groceryGroups(p)
    .map((g) => ({ ...g, items: g.items.filter((x) => !checked(x.k, x.g)) }))
    .filter((g) => g.items.length);
  const str = [
    "Буду это · " + rangeText(),
    ...groups.map(
      (g) =>
        g.label +
        "\n" +
        g.items.map((x) => "□ " + FOOD[x.k][0] + " — " + shoppingAmount(x.k, remainingGrams(x.k, x.g),store)).join("\n"),
    ),
  ].join("\n\n");
  try {
    await navigator.clipboard.writeText(str);
    notify("Список продуктов скопирован");
  } catch {
    const host = document.getElementById("copy-fallback");
    if (!host) return;
    host.innerHTML =
      '<label class="field">Текст для копирования<textarea readonly></textarea></label>';
    const a = host.querySelector("textarea");
    a.value = str;
    a.focus();
    a.select();
  }
}
function makeChoice(el) {
  const k = el.dataset.key,
    value = el.dataset.value,
    detail = Boolean(el.closest("details")?.open);
  if (Array.isArray(draft[k])) {
    const v = k === "cook" ? Number(value) : value;
    draft[k] = draft[k].includes(v)
      ? draft[k].filter((x) => x !== v)
      : [...draft[k], v];
    if (k === "cook") draft.cook.sort((a, b) => a - b);
  } else
    draft[k] = ["activity", "maxMinutes"].includes(k) ? Number(value) : value;
  render();
  if (detail) main.querySelector(".extra")?.setAttribute("open", "");
  main
    .querySelector(
      `[data-action="chip"][data-key="${k}"][data-value="${CSS.escape(value)}"]`,
    )
    ?.focus({ preventScroll: true });
}
function finishSetup() {
  draft.strictTaste = true;
  draft.tasteAnchor ??= weekSeed(0);
  const hint=selectionHint(selectedCounts(tastePool(draft),draft.votes));
  if (hint) {
    document.getElementById("setup-error").textContent = hint;
    return;
  }
  if (draft.mode === "personal")
    draft.plainPortion = draft.targetMode === "portion";
  data.quizDone = true;
  data.mode = draft.mode;
  useStockForPlanning(draft,weekSeed(),weekData().pantry);
  data[draft.mode] = structuredClone(draft);
  clearDiscovery(draft.mode);
  for (const [week, record] of Object.entries(data.weeks)) {
    if (!week.startsWith(draft.mode + "/")) continue;
    for (const [cell, id] of Object.entries(record.replacements)) {
      const oneDay = cell.startsWith("day:");
      const [start, slot] = cell.replace(/^day:/, "").split("-").map(Number);
      if (
        (!oneDay && groupStart(draft, start) !== start) ||
        !(oneDay ? manualCandidate(draft, byId(id), slot) : candidates(draft, slot).some(r=>r.id===id))
      )
        delete record.replacements[cell];
    }
  }
  draft = null;
  persist();
  miniStats.built();
  navTo("week");
  notify("Меню собрано по вашим настройкам");
}
function syncDraft(el) {
  if (!draft || !el.dataset.field || !el.validity.valid || !el.value) return;
  draft[el.dataset.field] = Number(el.value);
  if(el.dataset.field==="budget") draft.budgetChosen=true;
  const box = document.getElementById("draft-energy");
  if (box) box.innerHTML = energyInfo();
}
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn || btn.disabled) return;
  const { action, day: d, slot, id, value } = btn.dataset;
  if (
    handleSweetAction(action,btn) ||
    handleTasteAction(action, btn) ||
    handleFlowAction(action, value, btn) ||
    handleShopAction(action, value, btn)
  )
    return;
  switch (action) {
    case "shopping-mode":
      data.shoppingMode=value; persist(); render(); break;
    case "dessert-open":
      openSheet({kind:"dessert"}); break;
    case "dessert-pick":
      setDayDessert(id); break;
    case "dessert-remove":
      setDayDessert(null); break;
    case "nutrition-swap-preview": {
      const p=plan(), offer=dayNutritionOffer(p,day);
      if(offer) openSheet({kind:"nutrition-swap",offer,plan:p,week:weekKey()});
      break;
    }
    case "nutrition-swap-apply":
      confirmNutritionSwap();
      break;
    case "portion-edit":
      if(portionCount(settings()))openSheet({kind:"portion-edit"});break;
    case "portion-off":
      delete settings().portionTargets; persist(); dismissSheet(); render(); break;
    case "budget-edit":
      openSheet({kind:"budget-edit",value:hasBudget(settings())?settings().budget:null});break;
    case "budget-apply":
      applyBudgetOffer();break;
    case "budget-keep":
    case "budget-review":
      if(budgetSuggestion) {budgetSuggestion.kept=action==="budget-keep";mountBudgetOffer();}
      break;
    case "budget-preset": {
      const field=btn.closest(".budget-fields").querySelector("input");
      field.value=value;field.dispatchEvent(new Event("input",{bubbles:true}));break;
    }
    case "restart-menu":
      openSheet({kind: "restart"});
      break;
    case "confirm-restart":
      restartMenu();
      break;
    case "like-recipe": {
      const recipe = byId(id);
      if (!recipe || !allowed(settings(), recipe) || !fitsCuisines(settings(), recipe)) break;
      settings().votes[id] = 1;
      clearDiscovery(data.mode);
      persist();
      render();
      renderSheet();
      notify("Блюдо добавлено в подбор на неделю");
      break;
    }
    case "discover":
      if (sheet.open) {
        dismissSheet(false);
        history.replaceState(null, "", location.href);
      }
      discovery = null;
      navTo("tastes");
      break;
    case "save-tastes":
      saveDiscovery();
      break;
    case "jump-week":
      changeWeek(Number(value) - offset);
      if(openInfo?.kind==="all-week") renderSheet();
      break;
    case "settings":
      if (sheet.open) {
        dismissSheet(false);
        history.replaceState(null, "", location.href);
      }
      startDraft();
      navTo("settings");
      break;
    case "week":
    case "list":
    case "recipes":
      navTo(action);
      break;
    case "day":
      day = Number(d);
      render();
      break;
    case "prev":
      changeWeek(-1);
      break;
    case "next":
      changeWeek(1);
      break;
    case "thisweek":
      changeWeek(openingWeek(settings())-offset);
      break;
    case "recipe":
      openSheet({
        kind: "recipe",
        id,
        slot: slot == null ? null : Number(slot),
        batch: false,
      });
      break;
    case "heart":
      markFavorite(id);
      break;
    case "swap":
      openSheet({ kind: "swap", slot: Number(slot) });
      break;
    case "choose-swap":
      replaceMeal(id, day, Number(slot), true);
      break;
    case "place":
      openSheet({
        kind: "place",
        id,
        day,
        slot: placementSlots(byId(id))[0],
      });
      break;
    case "place-day":
      openInfo.day = Number(d);
      renderSheet();
      break;
    case "place-slot":
      openInfo.slot = Number(slot);
      renderSheet();
      break;
    case "confirm-place":
      replaceMeal(openInfo.id, openInfo.day, openInfo.slot);
      break;
    case "batch":
      openInfo.batch = value === "all";
      renderSheet();
      break;
    case "taste-cuisines": {
      const {profile, votes} = tasteContext();
      openSheet({kind: "taste-cuisines", selection: [...(profile.cuisines || [])], available: RECIPES.filter(r => allowed(profile, r)), votes});
      break;
    }
    case "taste-cuisines-clear":
      if (openInfo?.kind === "taste-cuisines") {
        openInfo.selection = [];
        sheet.querySelectorAll("[data-taste-cuisine]").forEach(input => { input.checked = false; });
        updateCuisineSummary();
      }
      break;
    case "taste-cuisines-apply":
      if (openInfo?.kind === "taste-cuisines") {
        const ctx = tasteContext();
        const target = route === "settings" ? draft : ctx.state;
        const selection = openInfo.selection;
        const previous = ctx.profile.cuisines || [];
        if (selection.length !== previous.length || selection.some(key => !previous.includes(key))) {
          target.cuisines = [...selection];
          ctx.state.deck = null;
          persistTasting();
        }
        dismissSheet();
        render();
        main.querySelector('[data-action="taste-cuisines"]')?.focus({preventScroll: true});
      }
      break;
    case "close":
      dismissSheet();
      break;
    case "all-week":
      openSheet({ kind: "all-week" });
      break;
    case "overview-day":
      day = Number(d);
      dismissSheet();
      render();
      break;
    case "prep-open-date":
      day=Number(d);
      render();
      openSheet({kind:"prep-day"});
      break;
    case "reminders":
      openSheet({kind:"reminders",flags:0});
      break;
    case "reminder-send":
      sendReminderPlan();
      break;
    case "reminder-copy": {
      const field=sheet.querySelector(".reminder-command");
      try {navigator.clipboard.writeText(field.value).then(()=>notify("Команда скопирована"),()=>field.select());}
      catch {field.select();}
      break;
    }
    case "prep-day":
      openSheet({kind:"prep-day"});
      break;
    case "prep-recipe":
      openSheet({kind:"recipe",id,prepId:id});
      break;
    case "prep":
      openSheet({ kind: "prep" });
      break;
    case "nutrition":
      openSheet({ kind: "nutrition" });
      break;
    case "copy":
      void copyList();
      break;
    case "more-recipes": {
      const firstNew = libraryLimit;
      libraryLimit += 36;
      const results = document.getElementById("library-results");
      results.innerHTML = libraryResults();
      results.querySelectorAll(".photolink")[firstNew]?.focus({preventScroll:true});
      break;
    }
    case "book-meal":
      bookFilters={...bookFilters,meal:value}; libraryLimit=36; render();
      main.querySelector('[data-action="book-meal"][aria-pressed="true"]').focus({preventScroll:true});
      break;
    case "book-filters":
      openSheet({kind:"book-filters",selection:{...bookFilters}});
      break;
    case "book-option": {
      if(openInfo?.kind!=="book-filters") break;
      const group=btn.dataset.key;
      openInfo.selection[group]=value;
      for(const el of btn.parentElement.querySelectorAll("button")) el.setAttribute("aria-pressed",String(el===btn));
      refreshBookDraft(openInfo.selection);
      break;
    }
    case "book-reset-draft":
      if(openInfo?.kind==="book-filters") {
        openInfo.selection={...bookDefaults,meal:openInfo.selection.meal};
        renderSheet();
        sheet.querySelector('[data-action="book-reset-draft"]').focus({preventScroll:true});
      }
      break;
    case "book-apply":
      if(openInfo?.kind!=="book-filters") break;
      bookFilters={...openInfo.selection}; libraryLimit=36; dismissSheet(); render();
      main.querySelector('[data-action="book-filters"]').focus({preventScroll:true});
      break;
    case "book-remove":
      bookFilters={...bookFilters,[value]:bookDefaults[value]}; libraryLimit=36; render();
      main.querySelector('[data-action="book-filters"]').focus({preventScroll:true});
      break;
    case "clear-search":
      bookFilters={...bookDefaults}; search=""; libraryLimit=36; render();
      main.querySelector("#recipe-search").focus({preventScroll:true});
      break;
    case "chip":
      makeChoice(btn);
      break;
    case "draft-mode":
      if (draft.mode !== value) {
        draft = structuredClone(data[value]);
        settingsTasting = null;
        render();
      }
      break;
    case "counter": {
      const k = btn.dataset.key;
      draft[k] = Math.max(
        k === "adults" ? 1 : 0,
        Math.min(k === "adults" ? 12 : 8, draft[k] + Number(btn.dataset.delta)),
      );
      render();
      break;
    }
    case "exit-setup":
      draft = null;
      navTo("week");
      break;
    case "prev-step":
      step--;
      render({ top: true });
      break;
  }
});
main.addEventListener("submit", (e) => {
  if (e.target.id === "flow-form") {
    e.preventDefault();
    submitFlow();
    return;
  }
  if (e.target.id !== "setup-form") return;
  e.preventDefault();
  if (step === 3 && !draft.cook.length) {
    document.getElementById("setup-error").textContent =
      "Выберите хотя бы один день готовки.";
    return;
  }
  if (step === 3) draft.budgetChosen = true;
  if (step === 4) finishSetup();
  else {
    step++;
    render({ top: true });
  }
});
sheet.addEventListener("change", e=>{
  if (e.target.hasAttribute("data-reminder-flag") && openInfo?.kind==="reminders") {
    const flag=Number(e.target.dataset.reminderFlag);
    openInfo.flags=e.target.checked?openInfo.flags|flag:openInfo.flags&~flag;
    delete openInfo.command;
    renderSheet();
    sheet.querySelector('[data-reminder-flag="'+flag+'"]').focus({preventScroll:true});
    return;
  }
  if (e.target.hasAttribute("data-prep-done") && openInfo?.kind==="prep-day") {
    const record=weekData(), tasks=prepWeek()?.[day];
    if (!tasks) return;
    record.prepDone ||= {};
    if (e.target.checked) record.prepDone[day]=prepSignature(tasks);
    else delete record.prepDone[day];
    persist();
    render();
    return;
  }
  if (openInfo?.kind === "taste-cuisines" && e.target.hasAttribute("data-taste-cuisine")) {
    openInfo.selection = toggleValue(openInfo.selection, e.target.value);
    updateCuisineSummary();
    return;
  }
  if(e.target.id!=="book-cuisine" || openInfo?.kind!=="book-filters") return;
  openInfo.selection.cuisine=e.target.value;
  sheet.querySelector("[data-book-flag]").innerHTML=cuisineFlag(e.target.value);
  refreshBookDraft(openInfo.selection);
});
sheet.addEventListener("input",e=>{
  if (e.target.id === "taste-cuisine-search") {
    const query = e.target.value.trim().toLocaleLowerCase("ru");
    let visible = 0;
    for (const row of sheet.querySelectorAll(".cuisine-list label")) {
      row.hidden = !row.textContent.toLocaleLowerCase("ru").includes(query);
      if (!row.hidden) visible++;
    }
    sheet.querySelector(".cuisine-no-match").hidden = visible > 0;
    return;
  }
  const {nutrient,bound}=e.target.dataset;
  if(!nutrient || openInfo?.kind!=="book-filters") return;
  const selection=openInfo.selection;
  selection[nutrient]={...selection[nutrient],[bound]:e.target.value.trim()};
  refreshBookDraft(selection);
});
sheet.addEventListener("submit",e=>{
  if(e.target.id!=="budget-form")return;
  e.preventDefault(); const n=Number(e.target.elements["weekly-budget"].value);
  if(!budgetRange(n))return;
  settings().budget=n;settings().budgetChosen=true;useStockForPlanning(settings(),weekSeed(),weekData().pantry);persist();dismissSheet();render();notify("Бюджет на неделю сохранён");
});
document.addEventListener("input",e=>{
  if(e.target.name!=="weekly-budget")return;
  const box=e.target.closest(".budget-fields"),n=e.target.value===""?null:Number(e.target.value);
  const isFlow=!!box.closest("#flow-form");
  if(isFlow){getFlow().budget=n;rememberFlow();}else if(openInfo?.kind==="budget-edit"){openInfo.value=n;}
  box.querySelector("[data-budget-day]").textContent=budgetDaily(n,isFlow?flowPortions(getFlow()):servings(settings()));
  for(const pick of box.querySelectorAll("[data-action=budget-preset]"))pick.setAttribute("aria-pressed",String(Number(pick.dataset.value)===n));
});
main.addEventListener("input", (e) => {
  const field = e.target.name?.match(/^goal-([01])-([0-3])-([01])$/);
  if (field && e.target.closest("#flow-form")) {
    const [,person,metric,bound] = field;
    flowGoalDraft(getFlow()).rows[person][metric][bound] = e.target.value;
    main.querySelector("#flow-error").textContent = "";
    rememberFlow();
    return;
  }
  if (e.target.id === "recipe-search") {
    search = e.target.value;
    updateBookResults();
  } else syncDraft(e.target);
});
main.addEventListener("toggle", e => {
  if (!e.target.matches(".flow-goals") || !main.contains(e.target)) return;
  flowGoalDraft(getFlow()).open = e.target.open;
  rememberFlow();
}, true);
main.addEventListener("invalid", e => {
  const panel = e.target.closest(".flow-goals");
  if (panel) panel.open = true;
}, true);
main.addEventListener("change", (e) => {
  if (e.target.matches("[data-goal-ranges]")) {
    const draft = flowGoalDraft(getFlow());
    draft.ranges = e.target.checked;
    draft.open = true;
    rememberFlow();
    render();
    main.querySelector("[data-goal-ranges]").focus({preventScroll:true});
    return;
  }
  const cartKey=e.target.dataset.cart;
  if(cartKey){
    const w=weekData(); w.cart ||= {};
    if(e.target.checked) w.cart[cartKey]=remainingGrams(cartKey,plan().counts[cartKey]);
    else delete w.cart[cartKey];
    persist(); render(); return;
  }
  if (!e.target.dataset.pantry) return;
  const k = e.target.dataset.pantry;
  if(weekData().cart) delete weekData().cart[k];
  weekData().pantry[k] = e.target.checked ? neededGrams(plan().counts[k]) : 0;
  persist();
  render();
  main.querySelector(`[data-pantry="${k}"]`)?.focus({ preventScroll: true });
});
sheet.addEventListener("cancel", (e) => {
  e.preventDefault();
  dismissSheet();
});
sheet.addEventListener("click", (e) => {
  if (e.target === sheet) {
    const b = sheet.getBoundingClientRect();
    if (
      e.clientX < b.left ||
      e.clientX > b.right ||
      e.clientY < b.top ||
      e.clientY > b.bottom
    )
      dismissSheet();
  }
});
addEventListener("storage", event => {
  if (event.key !== key || !event.newValue) return;
  const latest = loadData();
  if (latest.quizDone && !data.quizDone) { location.reload(); return; }
  if (budgetSuggestion && latest.quizRun===data.quizRun) {
    Object.assign(data,latest); budgetSuggestion=null; render(); return;
  }
  if (latest.quizRun !== data.quizRun) {
    history.replaceState(null, "", "#start");
    location.reload();
  }
});
addEventListener("popstate", () => {
  if (sheet.open && !history.state?.mealSheet) dismissSheet(false);
  if (!data.quizDone && history.state?.foodQuiz && history.state.snapshot && history.state.snapshot.run === data.quizRun) {
    if (route === "start" && flow?.stage === history.state.snapshot.stage) {
      // Returning from the cuisine picker keeps the same card, keyboard focus and scroll.
      rememberFlow();
      return;
    }
    flow = restoreFlow({
      ...(flow && flow.stage >= 0
        ? flow
        : structuredClone(history.state.snapshot)),
      stage: history.state.snapshot.stage,
    });
    route = "start";
    rememberFlow();
    render({ top: true });
  }
});
addEventListener("hashchange", () => {
  const next = readRoute();
  if (next !== route) {
    if (sheet.open) dismissSheet(false);
    if (next !== "settings") draft = null;
    route = next;
    render({ top: true });
  }
});
function appBack() {
  if (sheet.open) {
    dismissSheet();
    return;
  }
  if (route === "start" && getFlow().stage > 0) {
    previousFlowStep();
    return;
  }
  if (route === "settings" && step > 1) {
    step--;
    render({ top: true });
    return;
  }
  navTo("week");
}
function tgBack() {
  const t = window.Telegram?.WebApp;
  if (!document.body.classList.contains("telegram-mini") || !t?.isVersionAtLeast("6.1")) return;
  t.BackButton?.offClick(appBack);
  t.BackButton?.onClick(appBack);
  if (
    sheet.open ||
    (route !== "week" && (route !== "start" || getFlow().stage > 0))
  )
    t.BackButton?.show();
  else t.BackButton?.hide();
}
function bindTelegram() {
  const t = window.Telegram?.WebApp;
  if (!t || !(t.initData || (t.platform && t.platform !== "unknown"))) return;
  document.body.classList.add("telegram-mini");
  t.ready();
  miniStats.opened();
  t.expand();
  if (t.isVersionAtLeast("6.9")) {
    t.setHeaderColor("#fafbf7");
    t.setBackgroundColor("#fafbf7");
  }
  if (t.isVersionAtLeast("7.10")) t.setBottomBarColor("#fafbf7");
  tgBack();
}
route = readRoute();
const legacy = location.hash.match(/^#(family|personal)\/(week|[123])$/);
if (legacy) {
  data.mode = legacy[1];
  if (route === "settings") {
    startDraft();
    step = Number(legacy[2]);
  }
}
render();
retainUpcomingMenus();
bindTelegram();
if(data.quizDone && new URLSearchParams(location.search).get("section")==="reminders" && plan()) openSheet({kind:"reminders",flags:0});
