const perekAddressKey = "kbr-syt:perekrestok-address";
let perekAddress = "";
try {
  perekAddress = localStorage.getItem(perekAddressKey) || "";
} catch {}
let perekEnabled = null,
  perekCheck = null,
  perekCheckAt = 0,
  perekSignature = "",
  perekController = null;
let perekResult = null,
  perekError = "",
  perekExpiry = null;
function clearPerekQuote() {
  perekController?.abort();
  perekController = null;
  perekSignature = "";
  perekResult = null;
  perekError = "";
  clearTimeout(perekExpiry);
  perekExpiry = null;
}
function perekActive() {
  return (
    (route === "week" || route === "list") &&
    moscowPrices(settings().priceCity) &&
    (settings().stores || []).includes("perekrestok")
  );
}
async function updatePerekQuote() {
  if (!perekActive()) {
    clearPerekQuote();
    return;
  }
  if (
    perekEnabled === null ||
    (perekEnabled === false && Date.now() - perekCheckAt >= 300000)
  ) {
    if (perekCheck) return;
    perekCheck = fetch("data/quote.json", {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((r) => {
        perekEnabled = r?.enabled === true;
      })
      .catch(() => {
        perekEnabled = false;
      })
      .finally(() => {
        perekCheck = null;
        perekCheckAt = Date.now();
      });
    await perekCheck;
    if (!perekActive()) return;
    drawQuotes();
  }
  if (!perekEnabled || !perekAddress) return;
  const items = requiredItems().map((i) => ({ key: i.key, grams: i.g }));
  if (!items.length) {
    clearPerekQuote();
    return;
  }
  const signature = JSON.stringify([perekAddress, weekKey(), items]);
  if (
    perekSignature === signature &&
    (!perekResult || Date.now() < perekResult.expiresAt)
  )
    return;
  clearPerekQuote();
  perekSignature = signature;
  const controller = new AbortController();
  perekController = controller;
  const timeout = setTimeout(() => controller.abort(), 15000);
  drawQuotes();
  try {
    const res = await fetch("/api/perekrestok-quote", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: perekAddress, items }),
      signal: controller.signal,
    });
    const details = await res.json();
    if (
      perekSignature !== signature ||
      perekController !== controller ||
      !perekActive()
    )
      return;
    if (!res.ok) {
      if (details.error === "not_connected") perekEnabled = false;
      throw Error(details.error);
    }
    if (!Number.isFinite(details.expiresAt) || details.expiresAt <= Date.now())
      throw Error("unconfirmed");
    perekResult = details;
    try {
      localStorage.setItem(perekAddressKey, perekAddress);
    } catch {}
    perekExpiry = setTimeout(
      () => {
        clearPerekQuote();
        if (perekActive()) {
          drawQuotes();
          if (!document.hidden) void updatePerekQuote();
        }
      },
      Math.max(0, details.expiresAt - Date.now()),
    );
  } catch (e) {
    if (perekController !== controller || perekSignature !== signature) return;
    perekError =
      e.message === "address"
        ? "Магазин не подтвердил доставку по этому адресу. Проверьте улицу, дом и корпус."
        : "Магазин не подтвердил текущие цены. Попробуйте обновить расчёт.";
  } finally {
    clearTimeout(timeout);
    if (perekController === controller) {
      perekController = null;
      if (perekActive()) drawQuotes();
    }
  }
}
function perekAddressDialog() {
  return `<div class="sheet-body simple"><h2 id="sheet-title">Куда доставлять продукты?</h2><form id="perek-address-form"><label class="field">Москва · улица и дом<input name="street" value="${$(perekAddress)}" placeholder="Например, Тверская улица, 7" required maxlength="180"></label><p class="quiet">Укажите корпус, если он есть. Для проверки цен передадим улицу и номер дома сервису доставки «Перекрёстка». Подтверждённый адрес сохранится в этом браузере.</p><p class="form-error" role="alert"></p><button class="btn primary" type="submit">Рассчитать неделю</button>${perekAddress ? button("Удалить адрес", "perek-forget", "outline") : ""}</form></div>`;
}
function perekAction(action) {
  if (action === "perek-address") {
    openSheet({ kind: "perek-address" });
    return true;
  }
  if (action === "perek-forget") {
    try {
      localStorage.removeItem(perekAddressKey);
    } catch {}
    perekAddress = "";
    clearPerekQuote();
    dismissSheet();
    drawQuotes();
    return true;
  }
  if (action === "perek-retry") {
    clearPerekQuote();
    void updatePerekQuote();
    return true;
  }
  return false;
}
document.addEventListener("submit", (e) => {
  if (e.target.id !== "perek-address-form") return;
  e.preventDefault();
  const street = e.target.elements.street.value.trim();
  if (!/\p{L}/u.test(street) || !/\d/.test(street)) {
    e.target.querySelector("[role=alert]").textContent =
      "Введите улицу и номер дома.";
    return;
  }
  if (!perekEnabled || !perekActive()) return;
  if (street !== perekAddress) {
    try {
      localStorage.removeItem(perekAddressKey);
    } catch {}
  }
  perekAddress = street;
  clearPerekQuote();
  dismissSheet();
  void updatePerekQuote();
});
function perekBasketPanel(items, mini, open) {
  const edit = button(
    perekAddress ? "Изменить адрес" : "Указать адрес в Москве",
    "perek-address",
    "soft",
  );
  const result =
    perekResult && perekResult.expiresAt > Date.now() ? perekResult : null;
  const sum = result?.complete
    ? (result.weighted ? "≈ " : "") + rubles(result.subtotalKopecks / 100)
    : "";
  const status = result
    ? result.complete
      ? "Товары на неделю"
      : "Часть товаров недоступна"
    : perekError
      ? "Расчёт недоступен"
      : perekAddress
        ? "Проверяем корзину…"
        : "Укажите адрес доставки";
  if (mini)
    return `<p><strong>Перекрёсток</strong> · ${status}${sum ? " · " + sum : ""}</p>${!perekAddress ? edit : ""}`;
  let content = "";
  if (result) {
    const rows = new Map(result.lines.map((line) => [line.sku, line]));
    content = `<p>${$(result.storeName)} · ${priceDate(result.checkedAt)}</p><ul class="price-rows">${items
      .map((item) => {
        const product = perekrestokGoods[item.key];
        if (!product) return `<li><b>${$(FOOD[item.key][0])}</b><small>Цена не подтверждена</small></li>`;
        const sku = product.url.match(/-(\d+)\/?$/)?.[1],
          line = rows.get(sku);
        if (line?.state !== "available")
          return `<li><b>${$(product.title)}</b><small>${line?.state === "unavailable" ? "Нет в наличии" : "Цена не подтверждена"}</small></li>`;
        const units =
          line.unit === "kg" ? grams(line.quantity) : line.quantity + " уп.";
        return `<li><div><b>${$(product.title)}</b><small>${$(units)} · ${$(line.label)} · ${rubles(line.unitPriceKopecks / 100)} / ${line.unit === "kg" ? "кг" : "уп."}</small></div><strong>${rubles(line.amountKopecks / 100)}</strong></li>`;
      })
      .join(
        "",
      )}</ul><p>${result.complete ? "Сумма за продукты до доставки и сборки." : "Сумма подтверждённых позиций — " + rubles(result.subtotalKopecks / 100) + ". Полная корзина пока не собрана."}${result.weighted ? " Весовые позиции уточнят при сборке." : ""}</p>`;
  } else if (perekError)
    content = `<p role="status">${$(perekError)}</p>${button("Обновить расчёт", "perek-retry", "soft")}`;
  return `<details class="price-market" data-store="perekrestok" ${open || !perekAddress ? "open" : ""}><summary><div><strong>Перекрёсток</strong><small>${$(result?.resolvedAddress || perekAddress || "Доставка по Москве")}</small></div><div class="price-numbers"><b>${sum || status}</b>${sum ? "<small>" + status + "</small>" : ""}</div></summary>${content}${edit}</details>`;
}
