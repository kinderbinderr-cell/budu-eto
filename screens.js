function startDraft() {
  draft = structuredClone(settings());
  if (draft.plainPortion) draft.targetMode = "portion";
  step = 1;
  settingsTasting = null;
}
function section(title, html, sub = "") {
  return `<section class="form-section"><h3>${title}</h3>${sub ? `<p class="quiet">${sub}</p>` : ""}${html}</section>`;
}
function chips(k, entries, arr = false) {
  return `<div class="chips">${Object.entries(entries)
    .map(([value, label]) => {
      const v = k === "cook" ? Number(value) : value;
      const active = arr ? draft[k].includes(v) : String(draft[k]) === value;
      return `<button type="button" class="chip" data-action="chip" data-key="${k}" data-value="${$(value)}" aria-pressed="${active}">${active ? icon("check", 15) : ""}${$(label)}</button>`;
    })
    .join("")}</div>`;
}
function field(k, title, min, max, inc = 1) {
  return `<label class="field">${title}<input type="number" required min="${min}" max="${max}" step="${inc}" data-field="${k}" value="${draft[k]}" inputmode="${inc === 1 ? "numeric" : "decimal"}"></label>`;
}
function counter(k, title, sub, min, max) {
  return `<div class="counter"><div><b>${title}</b><small>${sub}</small></div><div class="counter-control">${iconBtn("minus", "Уменьшить " + title, "counter", `data-key="${k}" data-delta="-1" ${draft[k] <= min ? "disabled" : ""}`)}<output>${draft[k]}</output>${iconBtn("plus", "Увеличить " + title, "counter", `data-key="${k}" data-delta="1" ${draft[k] >= max ? "disabled" : ""}`)}</div></div>`;
}
const stepNames = ["За столом", "Продукты", "Ритм недели", "Вкусы"];
const stepTitles = [
  "Для кого готовим?",
  "Что положить в меню?",
  "Когда удобнее готовить?",
  "Что хочется попробовать?",
];
const stepDesc = [
  "Выберите семейные порции или рассчитайте личный ориентир КБЖУ.",
  "Отметьте тип питания и продукты, которые нужно исключить.",
  "В дни готовки планируем новые блюда. Между ними используем приготовленные порции.",
  "Вправо — нравится, влево — исключить. Можно воспользоваться кнопками.",
];
function profileInputs() {
  const switcher = `<div class="mode-switch">${[
    ["family", "users", "Семейное меню", "Порции на всех"],
    ["personal", "user", "Личный рацион", "С учётом КБЖУ"],
  ]
    .map(
      ([m, i, title, note]) =>
        `<button type="button" data-action="draft-mode" data-value="${m}" aria-pressed="${draft.mode === m}">${icon(i, 23)}<span><b>${title}</b><small>${note}</small></span></button>`,
    )
    .join("")}</div>`;
  if (draft.mode === "family")
    return (
      switcher +
      section(
        "Размеры порций",
        counter("adults", "Полные порции", "На один приём пищи", 1, 12) +
          counter(
            "small",
            "Половинные порции",
            "Половина обычной порции",
            0,
            8,
          ),
      )
    );
  return (
    switcher +
    section(
      "Дневная калорийность",
      chips("targetMode", {
        portion: "Одна обычная порция",
        auto: "Рассчитать по параметрам",
        own: "Указать свой ориентир",
      }),
    ) +
    (draft.targetMode === "portion"
      ? ""
      : draft.targetMode === "auto"
        ? section(
            "Параметры для расчёта",
            chips("sex", { female: "Для женщины", male: "Для мужчины" }) +
              `<div class="fieldgrid">${field("age", "Возраст, лет", 19, 78)}${field("height", "Рост, см", 130, 220)}${field("weight", "Вес, кг", 40, 220, 0.1)}</div>`,
          ) +
          section(
            "Активность",
            chips("activity", {
              1.2: "Мало движения",
              1.4: "Много хожу",
              1.6: "Тренировки",
            }),
          )
        : `<div class="fieldgrid">${field("target", "Моя цель, ккал в день", 1200, 5000)}</div>`) +
    (draft.targetMode === "portion"
      ? ""
      : section(
          "Пропорции БЖУ",
          chips("ratio", {
            balanced: "Сбалансированно",
            protein: "Больше белка",
          }),
        )) +
    (draft.targetMode === "portion"
      ? ""
      : `<div class="nutri-summary" id="draft-energy">${energyInfo()}</div><p class="fine">Оценка для взрослых 19–78 лет по формуле Миффлина — Сан Жеора. При беременности, ГВ или лечебной диете используйте свой ориентир от специалиста.</p>`)
  );
}
function energyInfo() {
  const g = macroGoal(draft);
  return `<b>${energy(draft).toLocaleString("ru-RU")} ккал</b><span>Б ${g[0]} · Ж ${g[1]} · У ${g[2]} г</span>`;
}
function preferences() {
  return (
    section("Тип питания", chips("diet", diets)) +
    section(
      "Исключить из рецептов",
      chips("exclude", allergens, true),
      "Проверяем ингредиенты рецепта. При аллергии сверяйте также состав упаковки.",
    ) +
    `<details class="extra"><summary>Другие продукты, которые я не ем</summary>${chips(
      "exclude",
      Object.fromEntries(
        Object.entries(FOOD)
          .map(([k, v]) => [k, v[0]])
          .filter(([k]) => !Object.hasOwn(allergens, k)),
      ),
      true,
    )}</details>` +
    section(
      "На чём готовите?",
      chips("equipment", gear, true),
      "Если убрать оба варианта, останутся блюда без нагрева.",
    )
  );
}
function rhythm() {
  return (
    section(
      "Время на одно блюдо",
      chips("maxMinutes", {
        15: "До 15 минут",
        30: "До 30 минут",
        45: "До 45 минут",
        0: "Без ограничения",
      }),
    ) +
    section(
      "Дни готовки",
      chips("cook", Object.fromEntries(DAYS.map((v, i) => [i, v])), true),
    ) +
    section(
      "Бюджет на неделю",
      `<div class="fieldgrid">${field("budget", "Сумма на продукты, ₽", 400, 150000)}</div>`,
      "Сумма на все порции на 7 дней. Если любимые блюда не укладываются, покажем превышение и предложим замены.",
    )
  );
}
function livePreview() {
  const fit = RECIPES.filter((r) => eligible(draft, r));
  const featured =
    fit.find((r) => r.id === "chickenOrzo") ||
    fit.find((r) => r.slot === "m") ||
    fit[0];
  if (!featured)
    return '<div class="live-fit"><strong>Пока нет подходящих блюд</strong><small>Измените ограничения, чтобы собрать день.</small></div>';
  return `<div class="live-fit"><img src="${photo(featured)}" alt=""><div><small>Под ваши настройки</small><strong>${fit.length} ${plural(fit.length, "рецепт", "рецепта", "рецептов")}</strong><span>Например, ${featured.title.toLocaleLowerCase("ru")}.</span></div></div>`;
}
function setupPage() {
  if (!draft) startDraft();
  return `<div class="wrap inner-page setup"><div class="setup-rail"><button type="button" class="link" data-action="exit-setup">${icon("left", 16)} К меню недели</button><h2>Настройки меню</h2><ol>${stepNames.map((t, i) => `<li class="${i + 1 === step ? "current" : i + 1 < step ? "completed" : ""}"><i>${i + 1 < step ? icon("check", 13) : i + 1}</i>${t}</li>`).join("")}</ol><div class="rail-preview">${livePreview()}</div></div><section class="setup-form"><div class="steptrack">${stepNames.map((_, i) => `<i class="${i < step ? "on" : ""}"></i>`).join("")}</div><div class="settings-step"><div class="step-count">Шаг ${step} из 4 · ${stepNames[step - 1]}</div><button type="button" class="link restart-link" data-action="restart-menu">Пройти заново</button></div><h1>${stepTitles[step - 1]}</h1><p class="setup-desc">${stepDesc[step - 1]}</p><button class="link setup-taste-entry" type="button" data-action="discover">Выбрать блюда по фото ${icon("right", 15)}</button><form id="setup-form">${[profileInputs, preferences, rhythm, tastingPanel][step - 1]()}${step === 2 ? '<div class="inline-preview">' + livePreview() + "</div>" : ""}<p class="form-error" id="setup-error" role="alert"></p><div class="form-footer">${step > 1 ? button("Назад", "prev-step", "outline", "left") : ""}<button type="submit" class="btn primary">${step === 4 ? "Применить и открыть меню" : "Далее"} ${icon("arrow", 17)}</button></div></form></section></div>`;
}
function openSheet(info) {
  const fresh = !sheet.open;
  openInfo = info;
  renderSheet();
  if (fresh) {
    history.pushState({ mealSheet: true }, "", location.href);
    sheet.showModal();
    document.body.classList.add("sheet-open");
  }
  sheet.scrollTop = 0;
  const scroll = sheet.querySelector(".dialog-scroll");
  if (scroll) scroll.scrollTop = 0;
  tgBack();
}
function dismissSheet(pop = true) {
  if (!sheet.open) return;
  sheet.close();
  openInfo = null;
  document.body.classList.remove("sheet-open");
  tgBack();
  if (pop && history.state?.mealSheet) history.back();
}
function renderSheet() {
  const info = openInfo;
  if (!info) return;
  const contents =
    info.kind === "sweet-week" ? sweetEditor(info) : info.kind === "dessert" ? dessertPanel() : info.kind === "taste-cuisines" ? tasteCuisineSheet(info) : info.kind === "book-filters" ? bookFilterSheet(info.selection) : info.kind === "nutrition-swap" ? nutritionSwapPreview(info.offer) : info.kind === "portion-edit" ? portionEditor() : info.kind.startsWith("coupon-") ? couponSheet(info) : info.kind==="budget-edit" ? budgetDialog(info) : info.kind === "restart"
      ? `<div class="sheet-body simple"><h2 id="sheet-title">Пройти анкету заново?</h2><p>Выбор блюд, магазины и настройки обоих меню сбросятся на этом устройстве. Замены и отметки «есть дома» тоже очистятся. Избранные рецепты сохранятся.</p><div class="restart-actions">${button("Отмена", "close", "outline")}${button("Начать заново", "confirm-restart", "primary")}</div></div>`
      : info.kind === "perek-address"
      ? perekAddressDialog()
      : info.kind === "all-week"
        ? overviewWeek(plan())
        : info.kind === "recipe"
          ? recipeDetail(info)
          : info.kind === "shops"
            ? shopDialog()
            : info.kind === "swap"
              ? swapPanel(info)
              : info.kind === "place"
                ? placePanel(info)
                : info.kind === "reminders" ? remindersPanel(info) : info.kind === "prep-day" ? prepDayPanel(prepWeek()[day]) : info.kind === "prep"
                  ? prepPanel()
                  : nutritionPanel();
  sheet.innerHTML = `<div class="dialog-head">${iconBtn("close", "Закрыть окно", "close")}</div><div class="dialog-scroll">${contents}</div>`;
}
function recipeDetail(info) {
  const r = byId(info.id);
  const p = plan();
  const isPlanned =
    Number.isInteger(info.slot) && p?.days[day].meals[info.slot]?.r.id === r.id;
  const prepTask = info.prepId ? prepWeek()?.[day].cook.get(info.prepId) : null;
  const one = isPlanned ? p.days[day].meals[info.slot].f : 1;
  let batchFactor=one, mealCount=1;
  if (isPlanned) {
    const timing=prepTiming(r,day,DAYS.map((_,i)=>i).filter(i=>settings().cook.includes(weekdayIndex(settings(),i))),info.slot);
    const cook=settings().startDate && offset===0 ? Math.max(0,timing.cook) : timing.cook;
    // A serving early in the week may belong to the previous week's last cooking day.
    const weekOfCook = offset + (cook<0 ? -1 : 0);
    const current=plan(null,weekOfCook), next=plan(null,weekOfCook+1);
    const task=current && kitchenWeek(settings(),current,next,weekOfCook)[(cook+7)%7].cook.get(r.id);
    if(task) { batchFactor=task.factor; mealCount=task.uses.length; }
  }
  const mult=prepTask ? prepTask.factor : info.batch ? batchFactor : one;
  const stepList = Array.isArray(r.steps)
    ? r.steps
    : r.steps.split(/(?<=[.!?])\s+(?=[А-ЯЁA-Z])/u);
  const panNote =
    (isPlanned || prepTask) && mult > 2 && (r.equip === "hob" || r.alsoHob)
      ? "Время указано для одной-двух порций. Если всё не помещается в один слой, жарьте партиями и заложите дополнительное время."
      : "";
  let menuAction;
  if (prepTask) {
    menuAction=button("К плану готовки","prep-day","outline","left");
  } else if (isPlanned) {
    menuAction = button("Заменить блюдо", info.slot === 3 ? "dessert-open" : "swap", "primary", "swap", `data-slot="${info.slot}"`);
  } else if (!fitsCuisines(settings(), r)) {
    menuAction = `<p class="quiet">Это блюдо из другой кухни. Чтобы добавить его в недельное меню, расширьте выбор кухонь.</p>${button("К выбору блюд", "discover", "soft", "sliders")}`;
  } else if (settings().maxMinutes > 0 && r.minutes > settings().maxMinutes) {
    menuAction = `<p class="quiet">В недельное меню входят блюда до ${Number(settings().maxMinutes)} мин. Этот рецепт готовится дольше.</p>`;
  } else if (settings().votes[r.id] !== 1) {
    menuAction = button("Хочу в меню", "like-recipe", "primary", "heart", `data-id="${r.id}"`);
  } else {
    menuAction = p ? button("Поставить в меню", "place", "primary", "plus", `data-id="${r.id}"`)
      : button("Выбрать ещё блюда", "discover", "primary", "plus");
  }
  const cuisineLine=`<p class="quiet">${r.cuisines.map(cuisineLabel).join(" · ")}</p>`;
  const credit=r.photoCredit;
  const photoCredit=credit ? `<p class="photo-credit">${credit.illustrative ? "Фото: пример подачи" : "Фото"} · <a href="${$(credit.source)}" target="_blank" rel="noopener noreferrer">${$(credit.author)}</a> · <a href="${$(credit.licenseUrl)}" target="_blank" rel="noopener noreferrer">${$(credit.license)}</a> · уменьшено для экрана, возможно кадрирование</p>` : "";
  const perPortion = value => isPlanned ? Math.round(value * (one / servings(settings()))) : bookNumber.format(value);
  const kcal = perPortion(r.kcal);
  return `<div class="detail-cover"><img src="${photo(r)}" alt="${$(r.title)}"></div><div class="sheet-body"><div class="detail-meta">${icon("clock", 16)} ${cookingTime(r)} <i></i> ${equipmentBadges(r)}</div><h2 id="sheet-title">${r.title}</h2>${cuisineLine}${isPlanned && p.days[day].meals[info.slot].personFactors ? individualFacts(p.days[day].meals[info.slot]) : `<div class="detail-facts"><span><b>${kcal}</b> ккал</span>${r.macros.map((m, i) => `<span><b>${perPortion(m)}</b> ${["Б", "Ж", "У"][i]}, г</span>`).join("")}</div><p class="fine">На ${isPlanned && data.mode === "personal" ? "вашу" : "одну полную"} порцию · ориентировочно</p>`}<div class="sheet-section"><h3>Ингредиенты</h3>${isPlanned && mealCount > 1 ? `<div class="seg small"><button type="button" data-action="batch" data-value="one" aria-pressed="${!info.batch}">На один приём</button><button type="button" data-action="batch" data-value="all" aria-pressed="${!!info.batch}">На ${mealCount} ${plural(mealCount, "приём", "приёма", "приёмов")}</button></div>` : ""}<p class="quiet">${prepTask ? prepBatchText(prepTask)+" по плану готовки" : isPlanned ? `${data.mode === "family" ? household(settings()) : "1 личная порция"}${info.batch ? " на каждый приём, продукты на весь период готовки" : " на этот приём пищи"}` : "На одну порцию"}</p>${r.items.map(([k, g]) => `<div class="ingredient"><span>${FOOD[k][0]}</span><i></i><b>${kitchenAmount(k, g * mult)}</b></div>`).join("")}</div><div class="sheet-section"><h3>Как приготовить</h3>${(isPlanned || prepTask) && (r.homeCooking || r.photoCredit) && Math.abs(mult-1)>0.01 ? `<p class="fine">В шагах количество воды указано на одну порцию; для вашей готовки умножьте его на ${Number(mult.toFixed(2)).toLocaleString("ru-RU")}.</p>` : ""}<ol class="directions">${stepList.map((x) => `<li>${$(x.trim())}</li>`).join("")}</ol>${[

    panNote,
  ]
    .filter(Boolean)
    .map((note) => `<p class="quiet">${note}</p>`)
    .join(
      "",
    )}</div><div class="detail-actions">${menuAction}${button(fav(r) ? "В избранном" : "В избранное", "heart", "outline", "heart", `data-id="${r.id}" aria-pressed="${fav(r)}"`)}</div>${photoCredit}</div>`;
}
function blockText(d) {
  const b = batchDays(settings(), d);
  return b.length === 1 ? shortDay(d) : shortDay(b[0]) + " – " + shortDay(b[b.length - 1]);
}
function swapPanel(info) {
  const p = plan(),
    r = p.days[day].meals[info.slot].r;
  const s = settings(), other = p.days[day].meals.filter((_,i)=>i!==info.slot).map(m=>m.r.id);
  const choices = similarOptions(r, RECIPES.filter(x=>canPlace(s,x,info.slot)), s.votes, other).slice(0,8);
  return `<div class="sheet-body simple"><h2 id="sheet-title">Чем заменить ${["завтрак","обед","ужин"][info.slot]}?</h2><p class="quiet">${$(r.title)} · ${shortDay(day)}. Выберите похожее блюдо на этот день. Список покупок обновится.</p><div class="options-list">${choices.map(({r:x,match}) => `<button type="button" data-action="choose-swap" data-id="${x.id}" data-slot="${info.slot}"><img src="${photo(x)}" alt=""><span><b>${$(x.title)}</b><small>${$(match.reason)} · ${cookingTime(x)}</small><small>${s.votes[x.id]===1 ? "Уже нравится" : "Только на этот день"}</small></span>${icon("right", 18)}</button>`).join("") || "<p>Среди подходящих рецептов не нашлось аналога. Можно выбрать другое блюдо в книге рецептов.</p>"}</div></div>`;

}
function placePanel(info) {
  const p = plan();
  if (!p)
    return `<div class="sheet-body simple"><h2 id="sheet-title">Сначала настройте меню</h2>${button("Настроить меню", "settings")}</div>`;
  const r = byId(info.id),
    d = info.day ?? day,
    slot = info.slot ?? placementSlots(r)[0],
    old = p.days[d].meals[slot].r;
  return `<div class="sheet-body simple"><h2 id="sheet-title">Поставить в меню</h2><p class="quiet">${r.title} · ${rangeText()}</p>${section("Выберите день", `<div class="chips">${DAYS.map((n, i) => `<button type="button" class="chip" data-action="place-day" data-day="${i}" aria-pressed="${i === d}">${shortDay(i)}</button>`).join("")}</div>`)}${section("Приём пищи", `<div class="chips">${placementSlots(r).map((i) => `<button type="button" class="chip" data-action="place-slot" data-slot="${i}" aria-pressed="${slot === i}">${slotNames[i]}</button>`).join("")}</div>`)}<p class="quiet">Заменит «${old.title}» в меню на ${shortDay(d)}.</p>${button("Поставить в меню", "confirm-place", "primary", "check")}</div>`;
}
function prepPanel() {
  const p = plan();
  if (!p) return emptyPlan();
  const kitchen=prepWeek();
  const rows=kitchen.map((tasks,i)=>`<button type="button" class="prep-overview" data-action="prep-open-date" data-day="${i}"><span><b>${dayName(i)}</b><small>${prepDate(i)} · ${prepCardSummary(tasks)}</small></span>${prepFlags(tasks,i)}${icon("right",16)}</button>`).join("");
  return `<div class="sheet-body simple"><h2 id="sheet-title">План готовки</h2><p class="quiet">${rangeText()} · ${profileName()}</p>${rows}${reminderEntry()}</div>`;

}
function nutritionPanel() {
  const p = plan(),
    m = p.macros[day],
    g = macroGoal(settings());
  if(activePortionTargets(settings()))return `<div class="sheet-body simple"><h2 id="sheet-title">КБЖУ дня</h2><p>${dayName(day)} · по ингредиентам блюд дня, приблизительно</p>${p.pairMisses[day]>0 ? '<p>На этот день часть показателей выходит за ваш диапазон. Ниже видно, у кого и насколько.</p>' : ""}${portionReport(p.days[day].meals)}${button("Изменить цели","portion-edit","outline")}</div>`;
  if (settings().plainPortion)
    return `<div class="sheet-body simple"><h2 id="sheet-title">КБЖУ дня</h2><p>${dayName(day)} · по всем блюдам дня</p><p>${Math.round(m[0] * 4 + m[1] * 9 + m[2] * 4)} ккал · Б ${Math.round(m[0])} г · Ж ${Math.round(m[1])} г · У ${Math.round(m[2])} г</p></div>`;
  return `<div class="sheet-body simple"><h2 id="sheet-title">КБЖУ дня</h2><p class="quiet">${dayName(day)}, ${dateText(dateAt(day), { day: "numeric", month: "long" })}. По всем запланированным блюдам.</p><table class="nutritable"><thead><tr><th>Показатель</th><th>В меню</th><th>Ориентир</th></tr></thead><tbody>${[["Калории, ккал", m[0] * 4 + m[1] * 9 + m[2] * 4, energy(settings())], ...m.map((v, i) => [["Белки, г", "Жиры, г", "Углеводы, г"][i], v, g[i]])].map(([n, v, x]) => `<tr><th>${n}</th><td>${Math.round(v)}</td><td>${Math.round(x)}</td></tr>`).join("")}</tbody></table></div>`;
}
