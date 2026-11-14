/* Four short questions share the same recipe and portion rules as the weekly planner. */
const flowTitles = [
  "Для кого готовим?",
  "Что хочется съесть?",
  "Сколько времени на блюдо?",
  "Сколько потратим за неделю?",
];
const flowLabels = ["За столом", "Ваши вкусы", "Время готовки", "Бюджет и магазины"];
const flowKey = "zastol-onboarding-v3";
let flow = null;
function firstFlow() {
  return {
    stage: 0,
    run: data.quizRun,
    who: "",
    adults: 3,
    small: 0,
    diet: "all",
    exclude: [],
    cuisines: [],
    votes: {},
    deck: null,
    minutes: null,
    budget: null,
    stores: [],
    cook: [0, 1, 2, 3, 4, 5, 6],
    target: null,
    dailyGoals: {},
  };
}
function restoreFlow(saved) {
  const fresh = { ...firstFlow(), ...saved };
  if (!saved.votes && fresh.stage > 1) fresh.stage = 1;
  return fresh;
}
function getFlow() {
  if (flow) return flow;
  try {
    const saved = JSON.parse(sessionStorage.getItem(flowKey));
    if (
      saved && saved.run === data.quizRun &&
      Number.isInteger(saved.stage) &&
      saved.stage >= 0 &&
      saved.stage < 4
    )
      flow = restoreFlow(saved);
  } catch {}
  return (flow ||= firstFlow());
}
function previousFlowStep() {
  if (history.state?.foodQuiz && flow.stage > 0) history.back();
  else if (flow.stage > 0) changeFlow((f) => f.stage--, true);
}
function advanceFlowStep() {
  history.replaceState(
    { ...history.state, foodQuiz: true, snapshot: structuredClone(flow) },
    "",
    location.href,
  );
  flow.stage++;
  history.pushState(
    { foodQuiz: true, snapshot: structuredClone(flow) },
    "",
    "#start",
  );
  rememberFlow();
  render({ top: true });
}
function rememberFlow() {
  if (history.state?.foodQuiz)
    history.replaceState(
      { ...history.state, snapshot: structuredClone(flow) },
      "",
      location.href,
    );
  try {
    sessionStorage.setItem(flowKey, JSON.stringify(flow));
  } catch {}
}
function changeFlow(fn, top = false) {
  fn(getFlow());
  rememberFlow();
  render({ top });
}
function flowChoice(action, value, label, note, active, leading = "") {
  return `<button type="button" class="flow-choice" data-action="${action}" data-value="${value}" aria-pressed="${!!active}">${leading}<span><strong>${label}</strong>${note ? `<small>${note}</small>` : ""}</span><i class="choice-radio">${active ? icon("check", 14) : ""}</i></button>`;
}
function flowCounter(k, title, min, max) {
  return `<div class="flow-counter"><b>${title}</b><div>${iconBtn("minus", "Уменьшить: " + title, "flow-count", `data-key="${k}" data-value="-1" ${flow[k] <= min ? "disabled" : ""}`)}<output>${flow[k]}</output>${iconBtn("plus", "Увеличить: " + title, "flow-count", `data-key="${k}" data-value="1" ${flow[k] >= max ? "disabled" : ""}`)}</div></div>`;
}
function flowGoalDraft(f) {
  if (f.who !== "self" && f.who !== "two") return null;
  f.dailyGoals ??= {};
  if (!f.dailyGoals[f.who]) {
    const count = f.who === "two" ? 2 : 1;
    const rows = Array.from({length:count}, () => targetLabels.map(() => ["",""]));
    // Resume the former solo calorie field, including an unfinished first run.
    if (f.who === "self" && f.target != null) rows[0][0][0] = String(f.target);
    f.dailyGoals[f.who] = {rows, ranges:false, open:false};
  }
  return f.dailyGoals[f.who];
}
function flowDailyTargets(f) {
  const draft = flowGoalDraft(f);
  if (!draft) return null;
  const goals = draft.rows.map(person => person.map(([a,b]) => dailyTargetPair(a, draft.ranges ? b : null)));
  return goals.some(person => person.some(Boolean)) ? goals : null;
}
function flowGoalPanel(f) {
  const draft = flowGoalDraft(f);
  if (!draft) return "";
  const count = draft.rows.length;
  return `<details class="flow-details flow-goals"${draft.open ? " open" : ""}>
    <summary><span>Указать КБЖУ на день<small>По желанию${count === 2 ? " · отдельно для каждого" : ""}</small></span>${icon("right",17)}</summary>
    <div class="flow-goals-body">
      <p>${count===2 ? "Из понравившихся блюд подберём общий завтрак, обед и ужин. Размер порции рассчитаем для каждого по его целям." : "Порции завтрака, обеда и ужина рассчитаем по вашим целям."} Оставьте поля пустыми для обычного меню.</p>
      <label class="goal-ranges"><input type="checkbox" data-goal-ranges ${draft.ranges ? "checked" : ""}>Указать диапазоны от и до</label>
      ${portionFields(count,draft.rows,draft.ranges,"goal")}
      <button class="link" type="button" data-action="flow-goals-skip">Продолжить без КБЖУ</button>
    </div></details>`;
}
function peopleQuestion() {
  const rows = [
    ["self", "Для себя", "Одна порция", "user"],
    ["two", "Для двоих", "Две полные порции", "users"],
    ["family", "Для семьи", "Указать, сколько вас за столом", "pot"],
  ];
  return (
    rows
      .map(([k, t, n, i]) =>
        flowChoice(
          "flow-who",
          k,
          t,
          n,
          flow.who === k,
          `<i class="choice-icon">${icon(i, 23)}</i>`,
        ),
      )
      .join("") +
    (flow.who === "family"
      ? `<div class="flow-extras">${flowCounter("adults", "Полные порции", 1, 12)}${flowCounter("small", "Половинные порции", 0, 8)}</div>`
      : "") +
    flowGoalPanel(flow)
  );
}
function choiceChip(action, k, t, active) {
  return `<button class="chip" type="button" data-action="${action}" data-value="${k}" aria-pressed="${active}">${active ? icon("check", 14) : ""}${t}</button>`;
}
function flavorQuestion() {
  return (
    tastingPanel() +
    `<details class="flow-details"${flow.diet !== "all" || flow.exclude.length ? " open" : ""}><summary>Тип питания и исключения</summary><div class="chips">${Object.entries(
      diets,
    )
      .map(([k, t]) => choiceChip("flow-diet", k, t, k === flow.diet))
      .join(
        "",
      )}</div><p>Исключить из рецептов</p><div class="chips">${Object.entries(
      allergens,
    )
      .map(([k, t]) =>
        choiceChip("flow-exclude", k, t, flow.exclude.includes(k)),
      )
      .join("")}</div></details>`
  );
}
function timeQuestion() {
  return (
    [
      [15, "До 15 минут", "Быстрый завтрак, салат или тост"],
      [30, "До 30 минут", "Подходит для обычного буднего вечера"],
      [45, "До 45 минут", "Есть время на суп или духовку"],
      [0, "Без ограничения", "Важнее само блюдо"],
    ]
      .map(([v, t, n]) => flowChoice("flow-time", v, t, n, flow.minutes === v))
      .join("") +
    `<div class="rhythm-choice"><b>Как готовим на неделе?</b><div class="chips">${choiceChip("flow-rhythm", "daily", "Каждый день новое", flow.cook.length === 7)}${choiceChip("flow-rhythm", "batch", "Готовлю впрок", flow.cook.length !== 7)}</div></div><details class="flow-details"><summary>Выбрать дни готовки</summary><div class="chips">${DAYS.map((t, i) => choiceChip("flow-day", i, t, flow.cook.includes(i))).join("")}</div></details>`
  );
}
function flowPortions(f) { return f.who==="self"?1:f.who==="two"?2:f.adults+f.small*0.5; }
function storeQuestion() {
  return (
    budgetFields(flowPortions(flow), flow.budget, "flow") +
    '<h2 class="budget-shop-title">Где покупаете продукты?</h2>' + shopPicker(flow.stores, "flow-store") +
    `<p class="flow-hint">Можно пропустить и выбрать магазины позже в списке продуктов.</p>`
  );
}
function flowProgress(stage, className) {
  return `<div class="${className}" role="progressbar" aria-label="Шаги анкеты" aria-valuenow="${stage + 1}" aria-valuemin="1" aria-valuemax="${flowLabels.length}">${flowLabels.map((_, i) => `<i class="${i <= stage ? "on" : ""}"></i>`).join("")}</div>`;
}
function flowHeader() {
  const first = getFlow().stage === 0;
  document.getElementById("dock").innerHTML = "";
  document.getElementById("top").innerHTML =
    `<div class="bar wrap"><span class="brand">${brandMark()}</span><span class="flow-position">${first ? "Шаг 1 из 4" : "Меню на неделю"}</span></div>${first ? flowProgress(0, "welcome-progress") : ""}`;
}
function sampleDay() {
  const dishes = [["syrniki", "Сырники"], ["rl001", "Борщ со сметаной"], ["rd022", "Котлеты с пюре"]];
  return `<section class="sample-day"><h1>Меню <em>на неделю</em></h1>
    <p>Отметьте блюда, которые любите. Соберём меню на 7 дней и список покупок под ваш бюджет.</p>
    <figure><figcaption>Пример одного дня</figcaption><ul>${dishes.map(([id, name], i) =>
      `<li><img src="${photo(byId(id))}" alt=""><small>${slotNames[i]}</small><strong>${name}</strong></li>`).join("")}</ul></figure>
  </section>`;
}
function funnelPage() {
  const s = getFlow().stage;
  const first = s === 0;
  const subtitles = [
    null,
    "Смахните вправо, если хочется попробовать, или нажмите «Хочу в меню».",
    "Время на одну-две порции, включая плиту и духовку. Для большой партии понадобится дольше.",
    "Лимит общий для всех завтраков, обедов и ужинов. Магазин можно выбрать ниже.",
  ];
  const pictures = [null, ["syrniki", "Сырники с малиной"], ["chickenOrzo", "Орзо с курицей"], ["mushroomBuck", "Гречка с шампиньонами"]];
  const visual = first ? sampleDay() : `<div class="flow-visual panel-${s}"><img src="assets/${pictures[s][0]}.webp" alt="" fetchpriority="high"><div class="flow-visual-copy"><span>Ваше меню</span><em>на неделю</em></div><small>${pictures[s][1]}</small></div>`;
  const progress = first ? "" : `<div class="flow-progress"><span>Шаг ${s + 1} из 4</span><b>${flowLabels[s]}</b>${flowProgress(s, "flow-segments")}</div>`;
  const heading = first ? `<h2>${flowTitles[s]}</h2>` : `<h1>${flowTitles[s]}</h1><p class="flow-intro">${subtitles[s]}</p>`;
  const submit = ["К выбору блюд", "Дальше", "Дальше", "Собрать моё меню"][s];
  return `<div class="flow-shell ${first ? "welcome-step" : s === 1 ? "tasting-step" : ""}">${visual}<section class="flow-form">${progress}
    <form id="flow-form">${heading}<div class="flow-options">${[peopleQuestion, flavorQuestion, timeQuestion, storeQuestion][s]()}</div>
    <p id="flow-error" role="alert"></p><div class="flow-footer">${s > 0 ? iconBtn("left", "Назад", "flow-back") : ""}<button class="btn primary" type="submit">${submit} ${icon("arrow", 19)}</button></div></form>
  </section></div>`;
}
function flowProfile(f) {
  const mode = f.who === "self" ? "personal" : "family";
  const s = {
    ...initial(mode),
    diet: f.diet,
    exclude: [...f.exclude],
    cuisines: [...(f.cuisines || [])],
    likes: [],
    votes: { ...f.votes },
    strictTaste: true,
    tasteAnchor: weekSeed(0),
    maxMinutes: f.minutes || 0,
    cook: [...f.cook].sort((a, b) => a - b),
    stores: [...f.stores],
    budget: f.budget ?? 5000,
    budgetChosen: budgetRange(f.budget),
    fromQuiz: true,
    rotateBatches: true,
  };
  if (mode === "personal") {
    s.plainPortion = true;
    s.targetMode = "own";
  } else {
    s.adults = f.who === "two" ? 2 : f.adults;
    s.small = f.who === "two" ? 0 : f.small;
  }
  const goals = flowDailyTargets(f);
  if (goals) s.portionTargets = goals;
  // Keep the original calorie-only plan for a draft started before daily goals existed.
  if (mode === "personal" && f.target != null && goals && goals[0][0]?.[0] === f.target &&
      goals[0][0][1] === f.target && goals[0].slice(1).every(pair => !pair)) {
    delete s.portionTargets;
    s.target = f.target;
    s.plainPortion = false;
  }
  return s;
}
function toggleValue(list, v) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}
function handleFlowAction(action, value, el) {
  if (!action.startsWith("flow-")) return false;
  if (action === "flow-back") {
    previousFlowStep();
    return true;
  }
  if (action === "flow-goals-skip") {
    const f = getFlow();
    delete f.dailyGoals[f.who];
    if (f.who === "self") f.target = null;
    advanceFlowStep();
    return true;
  }
  const wasOpen = el.closest("details")?.open;
  changeFlow((f) => {
    if (action === "flow-who") f.who = value;
    if (action === "flow-diet") f.diet = value;
    if (action === "flow-exclude") f.exclude = toggleValue(f.exclude, value);
    if (action === "flow-time") f.minutes = Number(value);
    if (action === "flow-rhythm")
      f.cook = value === "daily" ? [0, 1, 2, 3, 4, 5, 6] : [0, 2, 4, 6];
    if (action === "flow-day") f.cook = toggleValue(f.cook, Number(value));
    if (action === "flow-store") f.stores = toggleShop(f.stores, value);
    if (action === "flow-count") {
      const k = el.dataset.key;
      f[k] = Math.max(
        k === "adults" ? 1 : 0,
        Math.min(k === "adults" ? 12 : 8, f[k] + Number(value)),
      );
    }
  });
  if (wasOpen) main.querySelector("details")?.setAttribute("open", "");
  main
    .querySelector(
      `[data-action="${action}"][data-value="${value}"]${el.dataset.key ? '[data-key="' + el.dataset.key + '"]' : ""}`,
    )
    ?.focus({ preventScroll: true });
  return true;
}
function submitFlow() {
  const f = getFlow(),
    error = document.querySelector("#flow-error");
  if (f.stage === 0 && !f.who) {
    error.textContent = "Выберите, для кого готовите.";
    return;
  }
  if (f.stage === 0) {
    const goals = flowDailyTargets(f);
    if (goals) {
      for (const [i,person] of goals.entries()) {
        const j = person.findIndex(pair => pair && pair[0] > pair[1]);
        if (j === -1) continue;
        const panel = main.querySelector(".flow-goals");
        panel.open = true;
        error.textContent = personTitle(i,goals.length)+" · "+targetLabels[j]+". Значение «До» должно быть не меньше «От».";
        main.querySelector(`[name="goal-${i}-${j}-1"]`).focus();
        return;
      }
    }
  }
  if (f.stage === 1) {
    const { pool, votes } = tasteContext();
    const hint = selectionHint(selectedCounts(pool, votes));
    if (hint) {
      error.textContent = hint;
      return;
    }
  }
  if (f.stage === 2) {
    if (f.minutes === null || !f.cook.length) {
      error.textContent =
        "Выберите время на блюдо и хотя бы один день готовки.";
      return;
    }
    const trial = flowProfile(f);
    const hint = selectionHint(selectedCounts(tastePool(trial),trial.votes));
    if (hint) {
      error.textContent = hint+" С выбранным лимитом времени можно вернуться к блюдам или увеличить лимит.";
      return;
    }
  }
  if (f.stage < 3) {
    advanceFlowStep();
    return;
  }
  if (!budgetRange(f.budget)) { error.textContent="Укажите недельный бюджет от 400 до 150 000 ₽."; return; }
  const s = flowProfile(f);
  data.mode = s.mode;
  data[s.mode] = s;
  clearDiscovery(s.mode);
  data.quizDone = true;
  for (const [wk, record] of Object.entries(data.weeks))
    if (wk.startsWith(s.mode + "/")) {
      record.replacements = {};
      delete record.nutritionSwaps;
    }
  offset = 0;
  day = todayIndex;
  persist();
  flow = null;
  try {
    sessionStorage.removeItem(flowKey);
  } catch {}
  navTo("week");
  notify("Ваше меню на семь дней готово");
}
