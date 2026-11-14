// Only an explicit yes makes a dish eligible for a personal menu.
const tastingSize = 30;
let settingsTasting = null,
  discovery = null;
function tastePool(profile) {
  return RECIPES.filter(r => allowed(profile, r));
}
function newTasting(pool, votes, scope = "new") {
  const available = pool.filter((r) =>
    scope === "picked"
      ? votes[r.id] === 1
      : scope === "again"
        ? votes[r.id] === -1
        : votes[r.id] !== 1 && votes[r.id] !== -1,
  );
  const ids = scope === "new" ? sampleTasting(available, tastingSize, recentDishes()) :
    available.slice(0, scope === "picked" ? available.length : tastingSize).map(r => r.id);
  if (scope === "new") recordDishes(ids);
  return {
    ids, passed: [],
    index: 0,
    trail: [],
    scope,
  };
}
function clearDiscovery(mode) {
  discovery = null;
  try {
    sessionStorage.removeItem("kbr-syt-tasting-" + mode);
  } catch {}
}
function startingDiscovery() {
  try {
    const saved = JSON.parse(
      sessionStorage.getItem("kbr-syt-tasting-" + data.mode),
    );
    if (saved?.votes && saved?.deck) return saved;
  } catch {}
  return { votes: { ...settings().votes }, deck: null };
}
function tasteContext() {
  let profile, state;
  if (route === "start" && getFlow().stage === 1) {
    const f = getFlow();
    f.votes ||= {};
    profile = {
      ...initial("family"),
      diet: f.diet,
      exclude: f.exclude || [],
      maxMinutes: f.minutes || 0,
    };
    state = f;
  } else if (route === "settings" && step === 4 && draft) {
    settingsTasting ||= { deck: null };
    profile = draft;
    state = settingsTasting;
  } else if (route === "tastes") {
    discovery ||= startingDiscovery();
    profile = { ...settings(), votes: discovery.votes };
    state = discovery;
  } else return null;
  const votes = route === "start" ? state.votes : profile.votes,
    pool = tastePool(profile);
  const signature = pool.map((r) => r.id).join("/");
  if (!state.deck) {
    state.deck = { ...newTasting(pool, votes), signature };
    persistTasting();
  } else if (state.deck.signature !== signature) {
    const deck = state.deck;
    const compatible = new Set(pool.map(r=>r.id));
    // Keep the reviewed prefix so the progress and undo history survive a filter change.
    const reviewed = deck.ids.slice(0,deck.index);
    const upcoming = deck.ids.slice(deck.index).filter(id=>compatible.has(id));
    const used = new Set([...reviewed,...upcoming,...(deck.passed || [])]);
    const fresh = pool.filter(r=>!used.has(r.id) && votes[r.id]==null);
    const fill = deck.scope === "new" && deck.index < deck.ids.length
      ? sampleTasting(fresh, Math.max(0,tastingSize-reviewed.length-upcoming.length), recentDishes()) : [];
    deck.ids = [...reviewed,...upcoming,...fill];
    deck.signature = signature;
    if(fill.length) recordDishes(fill);
    persistTasting();
  }
  return { state, pool, votes, deck: state.deck, signature };
}
function persistTasting() {
  if (route === "start") rememberFlow();
  if (route === "tastes")
    try {
      sessionStorage.setItem(
        "kbr-syt-tasting-" + data.mode,
        JSON.stringify(discovery),
      );
    } catch {}
}
function selectedCounts(pool, votes) {
  const chosen = pool.filter((r) => votes[r.id] === 1);
  return {
    chosen,
    b: chosen.filter((r) => r.slot === "b").length,
    m: chosen.filter((r) => r.slot === "m").length,
  };
}
function selectionHint(counts) {
  if (counts.b < 2 && counts.m < 2) return "Для чередования отметьте минимум два завтрака и два основных блюда.";
  if (counts.b < 2) return "Для чередования нужно отметить два разных завтрака.";
  if (counts.m < 2) return "Для чередования нужно отметить два разных основных блюда.";
  return "";
}
function deckLink(text, action, extra = "") {
  return `<button class="reaction-link" type="button" data-action="${action}" ${extra}>${text}</button>`;
}
function tastingAlternative(r, pool, votes, deck) {
  if (!r || deck.scope !== "new") return null;
  const used = new Set([...deck.ids,...(deck.passed||[])]);
  const fresh = similarOptions(r, pool.filter(x=>!used.has(x.id) && !votes[x.id]), votes)[0]?.r;
  if (fresh) return fresh;
  // If all compatible dishes are in this small deck, bring an upcoming analogue forward.
  const upcoming = new Set(deck.ids.slice(deck.index+1).filter(id=>!(deck.passed||[]).includes(id)));
  return similarOptions(r,pool.filter(x=>upcoming.has(x.id) && !votes[x.id]),votes)[0]?.r;
}
function tastingPanel() {
  const { pool, votes, deck } = tasteContext(),
    counts = selectedCounts(pool, votes);
  const r = byId(deck.ids[deck.index]);
  const left = pool.filter(
    (r) => votes[r.id] !== 1 && votes[r.id] !== -1,
  ).length;
  const rejected = pool.filter((r) => votes[r.id] === -1).length;
  const next = byId(deck.ids[deck.index + 1]);
  if (r && next) {
    const prefetch = new Image();
    prefetch.fetchPriority = "low";
    prefetch.src = photo(next);
  }
  const liked = RECIPES.filter(r=>votes[r.id]===1).length;
  const summary = `<div class="taste-counter"><span>${icon("heart", 15)} Выбрано <b>${liked}</b>${liked>counts.chosen.length ? ` · подходят ${counts.chosen.length}` : ""}</span>${deck.trail.length ? deckLink(icon("undo", 14) + " Отменить", "taste-undo") : ""}</div>`;
  if (!r)
    return `<section class="taste-end">${summary}<h2>${pool.length ? (counts.chosen.length ? "Вот что вам по вкусу" : "Поищем другие блюда?") : "Пока нет подходящих блюд"}</h2><p>${selectionHint(counts) || "Недельный план будет собран только из вашего выбора."}</p>
    ${
      counts.chosen.length
        ? `<div class="taste-samples">${counts.chosen
            .slice(-4)
            .map((x) => `<img src="${photo(x)}" alt="${$(x.title)}">`)
            .join(
              "",
            )}</div><small>${counts.b} на завтрак · ${counts.m} на обед и ужин</small>`
        : ""
    }
    <div class="taste-end-actions">${left ? button("Посмотреть ещё " + Math.min(left, tastingSize), "taste-more", "soft", "plus") : ""}${counts.chosen.length ? deckLink("Изменить понравившиеся", "taste-picked") : ""}${rejected ? deckLink("Пересмотреть пропущенные", "taste-again") : ""}</div></section>`;
  const title = $(r.title),
    type = r.slot === "b" ? "Завтрак" : mealRole(r) === "lunch" ? "На обед" : mealRole(r) === "dinner" ? "На ужин" : "Обед или ужин",
    number = deck.index + 1;
  return `<section class="reaction-card" aria-label="Выбор блюда">
    <div class="reaction-photo" data-taste-id="${r.id}"><img draggable="false" src="${photo(r)}" alt="${title}" loading="eager" fetchpriority="high"><button type="button" data-action="retry-photo" class="btn outline retry-photo" hidden>Загрузить фото ещё раз</button><span>${type}</span><b>${number} / ${deck.ids.length}</b></div>
    <div class="reaction-body"><div class="reaction-track" aria-hidden="true"><i style="width:${Math.round((100 * number) / deck.ids.length)}%"></i></div>
    <div class="reaction-info" aria-live="polite"><h2>${title}</h2><p>${icon("clock", 16)} ${cookingTime(r)}<i></i>${Math.round(r.kcal)} ккал на порцию</p></div>
    <div class="reaction-actions">${button("Не хочу", "taste-no", "outline", "close", `data-id="${r.id}"`)}${button("Хочу в меню", "taste-yes", "primary", "heart", `data-id="${r.id}"`)}</div>
    ${tastingAlternative(r,pool,votes,deck) ? deckLink("Показать похожее блюдо", "taste-similar", `data-id="${r.id}"`) : ""}
    ${summary}</div></section>`;
}
function handleTasteAction(action, el) {
  if (
    ![
      "taste-yes",
      "taste-no",
      "taste-undo",
      "taste-similar",
      "taste-more",
      "taste-again",
      "taste-picked",
    ].includes(action)
  )
    return false;
  const ctx = tasteContext();
  if (!ctx) return true;
  const { deck, state, votes, pool, signature } = ctx;
  if (action === "taste-similar") {
    const current=byId(deck.ids[deck.index]);
    if (!current || current.id!==el.dataset.id) return true;
    const next=tastingAlternative(current,pool,votes,deck);
    if (!next) return true;
    (deck.passed ||= []).push(current.id);
    const upcoming=deck.ids.indexOf(next.id,deck.index+1);
    if (upcoming>=0) deck.ids[upcoming]=current.id;
    deck.ids[deck.index]=next.id;
    recordDishes([next.id]);
  } else if (action === "taste-undo") {
    let last = deck.trail.pop();
    while(last && !pool.some(r=>r.id===last.id)) last=deck.trail.pop();
    if (last) {
      if (last.previous == null) delete votes[last.id];
      else votes[last.id] = last.previous;
      const index = deck.ids.lastIndexOf(last.id,deck.index-1);
      const allowedIds = new Set(pool.map(r=>r.id));
      deck.ids = [...deck.ids.slice(0,index), ...deck.ids.slice(index).filter(id=>allowedIds.has(id))];
      deck.index = index;
    }
  } else if (["taste-more", "taste-again", "taste-picked"].includes(action)) {
    state.deck = {
      ...newTasting(
        pool,
        votes,
        action === "taste-again"
          ? "again"
          : action === "taste-picked"
            ? "picked"
            : "new",
      ),
      signature,
    };
  } else {
    const id = deck.ids[deck.index];
    if (!id || id !== el.dataset.id) return true;
    deck.trail.push({ id, previous: votes[id] ?? null });
    votes[id] = action === "taste-yes" ? 1 : -1;
    deck.index++;
  }
  const focused = document.activeElement === el;
  persistTasting();
  render();
  // Keep keyboard activation on the same control as the next photo arrives.
  if (focused) {
    main
      .querySelector('[data-action="' + action + '"]')
      ?.focus({ preventScroll: true });
  }
  return true;
}
function discoveryPage() {
  const content = tastingPanel();
  return `<div class="discovery-page"><button class="link" type="button" data-action="week">${icon("left", 15)} К меню</button><h1>Что хочется съесть?</h1><p class="quiet">Добавьте блюда для следующих недель. В меню попадут только отмеченные.</p>${content}<p id="discovery-error" class="form-error" role="alert"></p>${button("Сохранить выбор", "save-tastes", "primary", "check")}</div>`;
}
function saveDiscovery() {
  const { pool, votes } = tasteContext(),
    hint = selectionHint(selectedCounts(pool, votes));
  if (hint) {
    document.querySelector("#discovery-error").textContent = hint;
    return;
  }
  const s = settings();
  s.votes = { ...votes };
  s.strictTaste = true;
  useStockForPlanning(s,weekSeed(),weekData().pantry);
  s.tasteAnchor ??= weekSeed(0);
  try {
    sessionStorage.removeItem("kbr-syt-tasting-" + data.mode);
  } catch {}
  discovery = null;
  data.quizDone = true;
  persist();
  navTo("week");
  notify("Выбранные блюда сохранены");
}
function setTastingPhotoError(event) {
  const image = event.target;
  if (!image.matches?.(".reaction-photo img")) return;
  const container = image.parentElement;
  const failed = event.type === "error";
  if (failed && !image.dataset.retried && navigator.onLine) {
    image.dataset.retried = "true";
    setTimeout(() => {
      if (image.isConnected && !image.naturalWidth) {
        image.src = photo(byId(container.dataset.tasteId)) + "?retry=" + Date.now();
      }
    }, 350);
    return;
  }
  container.classList.toggle("photo-failed", failed);
  container.querySelector(".retry-photo").hidden = !failed;
}
main.addEventListener("load", setTastingPhotoError, true);
main.addEventListener("error", setTastingPhotoError, true);
main.addEventListener("click", event => {
  const retry = event.target.closest('[data-action="retry-photo"]');
  if (!retry) return;
  const container = retry.closest(".reaction-photo");
  const image = container.querySelector("img");
  const recipe = byId(container.dataset.tasteId);
  container.classList.remove("photo-failed");
  retry.hidden = true;
  image.src = photo(recipe) + "?retry=" + Date.now();
});
let gesture = null;
main.addEventListener("pointerdown", (e) => {
  const card = e.target.closest(".reaction-photo");
  if (!card || e.target.closest("button") || !e.isPrimary || e.button !== 0) return;
  gesture = {
    id: card.dataset.tasteId,
    p: e.pointerId,
    x: e.clientX,
    y: e.clientY,
  };
  card.setPointerCapture?.(e.pointerId);
});
main.addEventListener("pointercancel", () => {
  gesture = null;
});
main.addEventListener("pointerup", (e) => {
  const g = gesture;
  gesture = null;
  if (!g || g.p !== e.pointerId) return;
  const dx = e.clientX - g.x,
    dy = e.clientY - g.y;
  if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
  const btn = main.querySelector(
    `[data-action="${dx > 0 ? "taste-yes" : "taste-no"}"][data-id="${g.id}"]`,
  );
  if (btn) handleTasteAction(btn.dataset.action, btn);
});
document.addEventListener("keydown", (e) => {
  if (
    e.altKey ||
    e.ctrlKey ||
    e.metaKey ||
    e.shiftKey ||
    e.repeat ||
    sheet.open ||
    e.target.closest(
      "input,select,textarea,summary,details,[contenteditable=true]",
    ) ||
    !["ArrowLeft", "ArrowRight"].includes(e.key)
  )
    return;
  const btn = main.querySelector(
    `[data-action="${e.key === "ArrowRight" ? "taste-yes" : "taste-no"}"]`,
  );
  if (btn) {
    e.preventDefault();
    handleTasteAction(btn.dataset.action, btn);
  }
});
