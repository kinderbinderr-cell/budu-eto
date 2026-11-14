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
  if (route === "week" || route === "list") mountQuotes();
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
  offset += delta;
  day = offset === 0 ? todayIndex : 0;
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
  if (!manualCandidate(settings(), recipe, slot)) return;
  if (oneDayAnalog ? !dishSimilarity(plan().days[d].meals[slot].r, recipe) : !eligible(settings(), recipe)) return;
  weekData().replacements[
    "day:" + d + "-" + slot
  ] = id;
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
  if ([0, 1].some(slot => candidates(draft, slot).length < 2)) {
    document.getElementById("setup-error").textContent =
      "Чтобы чередовать блюда, нужны два подходящих завтрака и два основных блюда.";
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
    handleTasteAction(action, btn) ||
    handleFlowAction(action, value, btn) ||
    handleShopAction(action, value, btn)
  )
    return;
  switch (action) {
    case "portion-edit":
      if(portionCount(settings()))openSheet({kind:"portion-edit"});break;
    case "portion-off":
      delete settings().portionTargets; persist(); dismissSheet(); render(); break;
    case "budget-edit":
      openSheet({kind:"budget-edit",value:hasBudget(settings())?settings().budget:null});break;
    case "budget-swaps":
      openSheet({kind:"budget-swaps",choices:budgetAlternatives()});break;
    case "budget-swap":
      if(openInfo?.kind==="budget-swaps" && openInfo.choices.some(x=>x.r.id===id && x.day===Number(d) && x.slot===Number(slot)))
        replaceMeal(id,Number(d),Number(slot),true);
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
      if (!recipe || !allowed(settings(), recipe)) break;
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
      changeWeek(-offset);
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
        slot: byId(id).slot === "b" ? 0 : 1,
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
    case "filter":
      libraryLimit = 36;
      filter = value;
      render();
      break;
    case "clear-search":
      libraryLimit = 36;
      filter = "all";
      search = "";
      render();
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
    libraryLimit = 36;
    document.getElementById("library-results").innerHTML = libraryResults();
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
  if (!e.target.dataset.pantry) return;
  const k = e.target.dataset.pantry;
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
  if (latest.quizRun !== data.quizRun) {
    history.replaceState(null, "", "#start");
    location.reload();
  }
});
addEventListener("popstate", () => {
  if (sheet.open && !history.state?.mealSheet) dismissSheet(false);
  if (history.state?.foodQuiz && history.state.snapshot && history.state.snapshot.run === data.quizRun) {
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
bindTelegram();
