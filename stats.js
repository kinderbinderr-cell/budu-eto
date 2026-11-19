(() => {
  const byId = id => document.getElementById(id);
  const telegram = window.Telegram?.WebApp;
  const report = byId("stats-report");
  const refresh = byId("stats-refresh");
  const status = byId("stats-status");
  const numbers = new Intl.NumberFormat("ru-RU");
  const plurals = new Intl.PluralRules("ru-RU");
  const people = {one:"новый пользователь", few:"новых пользователя", many:"новых пользователей"};
  const dateFormat = new Intl.DateTimeFormat("ru-RU", {day:"numeric", month:"long", timeZone:"UTC"});
  const dateLabel = day => dateFormat.format(new Date(day + "T12:00:00Z"));
  let snapshot = null;
  let range = 7;

  function create(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function renderFunnel(days) {
    const stages = [
      ["Нажали «Старт»", "starts"],
      ["Открыли мини-приложение", "opened"],
      ["Собрали меню на неделю", "built"]
    ];
    const base = days.reduce((sum, day) => sum + day.starts, 0);
    const list = byId("stats-funnel");
    list.replaceChildren();
    for (const [label, field] of stages) {
      const count = days.reduce((sum, day) => sum + day[field], 0);
      const share = base ? Math.round(100 * count / base) : 0;
      const row = create("li", "", "stats-step");
      const value = create("strong", numbers.format(count));
      if (base) value.append(create("small", share + "%"));
      const track = create("div", "", "stats-track");
      track.setAttribute("aria-hidden", "true");
      track.style.setProperty("--share", share + "%");
      track.append(create("span"));
      row.append(create("span", label), value, track);
      list.append(row);
    }
  }

  function renderChart(days) {
    const total = days.reduce((sum, day) => sum + day.starts, 0);
    const first = days[0];
    const last = days.at(-1);
    const maximum = Math.max(1, ...days.map(day => day.starts));
    const plot = byId("stats-bars");
    byId("stats-period").textContent = `${numbers.format(total)} за период · ${dateLabel(first.day)} — ${dateLabel(last.day)}`;
    byId("stats-axis-max").textContent = numbers.format(maximum);
    byId("stats-date-first").textContent = dateLabel(first.day);
    byId("stats-date-last").textContent = first === last ? "" : dateLabel(last.day);
    plot.style.setProperty("--day-count", days.length);
    const bars = [];
    function select(day, button) {
      for (const bar of bars) bar.setAttribute("aria-pressed", String(bar === button));
      const phrase = people[plurals.select(day.starts)] || people.many;
      byId("stats-selection").textContent = `${dateLabel(day.day)} · ${numbers.format(day.starts)} ${phrase}`;
    }
    for (const day of days) {
      const label = `${dateLabel(day.day)}, новых пользователей: ${numbers.format(day.starts)}`;
      const bar = create("button", "", "stats-bar");
      bar.type = "button";
      bar.setAttribute("aria-label", label);
      bar.title = label;
      bar.style.setProperty("--bar", (100 * day.starts / maximum) + "%");
      bar.append(create("span"));
      bar.addEventListener("click", () => select(day, bar));
      bars.push(bar);
    }
    plot.replaceChildren(...bars);
    select(last, bars.at(-1));
  }

  function renderCoupons(firstDay) {
    const byOffer = new Map();
    for (const day of snapshot.coupon_days) {
      if (day.day < firstDay) continue;
      const offer = byOffer.get(day.id) || {label:day.label, opened:0, copied:0, visited:0};
      for (const key of ["opened", "copied", "visited"]) offer[key] += day[key];
      byOffer.set(day.id, offer);
    }
    const offers = [...byOffer.values()].sort((a, b) => b.opened - a.opened || b.copied - a.copied || a.label.localeCompare(b.label, "ru"));
    byId("stats-coupons-caption").textContent = `Учёт с ${dateLabel(snapshot.coupons_since)}. Повторы одного действия за день считаются один раз.`;
    byId("stats-coupons-empty").hidden = Boolean(offers.length);
    byId("stats-coupons-table").hidden = !offers.length;
    byId("stats-coupons").replaceChildren(...offers.map(offer => {
      const row = create("tr");
      const label = create("th", offer.label);
      label.scope = "row";
      row.append(label);
      for (const key of ["opened", "copied", "visited"]) row.append(create("td", numbers.format(offer[key])));
      return row;
    }));
  }

  function render() {
    const days = snapshot.days.slice(-range);
    byId("stats-since").textContent = `Данные с ${dateLabel(snapshot.since)} · по Москве`;
    byId("stats-since").hidden = false;
    for (const key of ["total", "daily", "recent"]) byId("stats-" + key).textContent = numbers.format(snapshot[key]);
    renderChart(days);
    renderFunnel(days);
    renderCoupons(days[0].day);
    report.hidden = false;
  }

  async function load() {
    if (refresh.disabled) return;
    if (!telegram?.initData) {
      status.textContent = "Отправьте /stats в личном чате с ботом и нажмите «Открыть статистику».";
      byId("stats-bot").hidden = false;
      return;
    }
    refresh.hidden = false;
    refresh.disabled = true;
    if (!snapshot) status.textContent = "Загружаем данные…";
    status.hidden = Boolean(snapshot);
    const request = new AbortController();
    const timeout = setTimeout(() => request.abort(), 8000);
    try {
      const result = await fetch("https://www.kbrcore.ru:8444/budu-eto/stats", {
        method:"POST", credentials:"omit", cache:"no-store", referrerPolicy:"no-referrer",
        signal:request.signal, body:JSON.stringify({initData:telegram.initData})
      });
      if (result.status === 403) {
        snapshot = null;
        report.hidden = true;
        byId("stats-since").hidden = true;
        status.textContent = "Доступ есть у владельца. Отправьте /stats в боте и откройте статистику кнопкой из нового сообщения.";
        status.hidden = false;
        return;
      }
      if (!result.ok) throw Error("report unavailable");
      const data = await result.json();
      if (!data.days?.length || !Array.isArray(data.coupon_days)) throw Error("report incomplete");
      snapshot = data;
      render();
      status.hidden = true;
    } catch {
      status.textContent = "Не удалось загрузить данные. Нажмите «Обновить» ещё раз.";
      status.hidden = false;
    } finally {
      clearTimeout(timeout);
      refresh.disabled = false;
    }
  }

  for (const button of document.querySelectorAll("[data-stats-range]")) {
    button.addEventListener("click", () => {
      range = Number(button.dataset.statsRange);
      for (const item of document.querySelectorAll("[data-stats-range]")) item.setAttribute("aria-pressed", String(item === button));
      if (snapshot) render();
    });
  }
  refresh.addEventListener("click", load);
  telegram?.ready();
  telegram?.expand();
  load();
})();
