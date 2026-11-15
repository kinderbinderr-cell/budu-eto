const shopLocations = {
  771766: "Москва, ул. Академика Комарова, 9",
  770287: "Москва, ул. Скобелевская, 4",
  773397: "Москва, ул. Молодогвардейская, 29, корп. 1",
  773802: "Москва, ул. Митинская, 50",
  777749: "Москва, ул. 2-я Владимирская, 44/10",
};
const priceBook = new Map();
let pendingPrices = new Map(),
  shopDraft = null;
let outletChoice = "771766",
  priceTimer = null,
  priceEpoch = 0;
const catalogShops = {
  perekrestok: {
    name: "Перекрёсток",
    caption: "Москва · Яндекс Еда",
    reference: true,
  },
  pyaterochka: { name: "Пятёрочка", caption: "Москва · Яндекс Еда", reference: true },
  vv: { name: "ВкусВилл", caption: "Общий каталог · обычные цены" },
  globus: {
    name: "Глобус",
    caption: "Самовывоз · Москва, Новорижское шоссе, 22-й км, д. 1, стр. 1",
  },
  tvoydom: {
    name: "Твой Дом",
    caption: "Москва и область · цены онлайн-витрины",
  },
};
const shopName = (id) => catalogShops[id]?.name || "Магнит";
const shopCaption = (id) =>
  (catalogShops[id]?.reference && typeof referenceCatalogs!=="undefined" && referenceCatalogs[id]?.address ? referenceCatalogs[id].address+" · Яндекс Еда" : catalogShops[id]?.caption) || shopLocations[id] || "";
const supportedShop = (id) =>
  Object.hasOwn(catalogShops, id) || Object.hasOwn(shopLocations, id);
const rubles = (n) =>
  n.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }) + " ₽";
function shopPicker(selected, action) {
  const outlet =
    selected.find((k) => Object.hasOwn(shopLocations, k)) || outletChoice;
  const tile = (id, name, caption, checked) =>
    flowChoice(
      action,
      id,
      name,
      caption,
      checked,
      `<i class="choice-icon">${icon("bag", 22)}</i>`,
    );
  const catalogTile = (id) =>
    tile(id, shopName(id), shopCaption(id), selected.includes(id));
  return `<div class="shop-list">${catalogTile("perekrestok")}${catalogTile("pyaterochka")}
    ${tile("magnit", "Магнит", "Цены выбранного магазина в Москве", selected.includes(outlet))}
    ${
      selected.includes(outlet)
        ? `<label class="field">Магнит · адрес магазина<select class="shop-select" data-outlet="${action}">${Object.entries(
            shopLocations,
          )
            .map(
              ([k, t]) =>
                `<option value="${k}" ${k === outlet ? "selected" : ""}>${$(t)}</option>`,
            )
            .join("")}</select></label>`
        : ""
    }
    ${Object.keys(catalogShops)
      .filter((id) => !catalogShops[id].reference)
      .map(catalogTile)
      .join("")}</div>`;
}
function toggleShop(list, value) {
  if (Object.hasOwn(catalogShops, value)) return toggleValue(list, value);
  if (value !== "magnit") return list;
  const other = list.filter((k) => !Object.hasOwn(shopLocations, k));
  if (list.some((k) => Object.hasOwn(shopLocations, k))) return other;
  return [...other, outletChoice];
}
function shopDialog() {
  if (!shopDraft) shopDraft = [...(settings().stores || [])];
  return `<div class="sheet-body simple shop-dialog"><h2 id="sheet-title">Цены в магазинах</h2>${shopPicker(shopDraft, "pick-store")}${button("Применить", "save-stores", "primary", "check")}</div>`;
}
function handleShopAction(action, value) {
  if (perekAction(action)) return true;
  if (action === "shops") {
    shopDraft = [...(settings().stores || [])];
    outletChoice =
      shopDraft.find((k) => Object.hasOwn(shopLocations, k)) || outletChoice;
    openSheet({ kind: "shops" });
    return true;
  }
  if (action === "pick-store") {
    shopDraft = toggleShop(shopDraft, value);
    renderSheet();
    return true;
  }
  if (action === "save-stores") {
    protectMenus();
    settings().stores = [...shopDraft];
    persist();
    shopDraft = null;
    dismissSheet();
    render();
    return true;
  }
  if (action === "retry-prices") {
    clearPerekQuote();
    priceEpoch++;
    priceBook.clear();
    pendingPrices = new Map();
    mountQuotes();
    return true;
  }
  return false;
}
document.addEventListener("change", (e) => {
  if (!e.target.dataset.outlet || !Object.hasOwn(shopLocations, e.target.value))
    return;
  const select = e.target,
    id = (outletChoice = select.value);
  const move = (list) =>
    list.some((k) => Object.hasOwn(shopLocations, k))
      ? list.map((k) => (Object.hasOwn(shopLocations, k) ? id : k))
      : list;
  if (select.dataset.outlet === "flow-store") {
    changeFlow((f) => (f.stores = move(f.stores)));
    main.querySelector("[data-outlet]")?.focus({ preventScroll: true });
  } else {
    shopDraft = move(shopDraft);
    renderSheet();
    sheet.querySelector("[data-outlet]")?.focus({ preventScroll: true });
  }
});
function requiredItems() {
  const p = plan();
  if (!p) return [];
  return Object.entries(p.counts)
    .map(([key, n]) => ({
      key,
      g: outstandingGrams(weekData(),key,n),
    }))
    .filter((x) => x.g > 0)
    .sort((a, b) => FOOD[a.key][0].localeCompare(FOOD[b.key][0], "ru"));
}
function priceLine(item, store, entry = priceBook.get(store + "/" + item.key)) {
  if (!entry) return { ...item, status: originalRetailKeys.has(item.key) ? "waiting" : "unknown" };
  if (!entry.offer)
    return {
      ...item,
      status: entry.unavailable ? "unavailable" : "unknown",
      at: entry.checkedAt,
    };
  const o = entry.offer;
  const weight = o.unit === "kg" ? retailWeight(item.key, item.g, o.edibleFraction) : null;
  let orderGrams = weight?.weight ?? item.g;
  if (o.unit === "kg" && Number.isFinite(o.minGrams) && o.minGrams > 0) {
    orderGrams = Math.max(orderGrams, o.minGrams);
    if (Number.isFinite(o.stepGrams) && o.stepGrams > 0) {
      orderGrams =
        o.minGrams +
        Math.ceil((orderGrams - o.minGrams) / o.stepGrams) * o.stepGrams;
    }
  }
  const pieces =
    o.unit === "kg" && o.nominalPieceGrams > 0
      ? Math.ceil(orderGrams / o.nominalPieceGrams)
      : null;
  if (pieces) orderGrams = pieces * o.nominalPieceGrams;
  const units =
    o.unit === "kg"
      ? orderGrams / 1000
      : o.packGrams > 0
        ? Math.ceil(item.g / o.packGrams)
        : null;
  return {
    ...item,
    status: "found",
    o,
    units,
    orderGrams,
    edibleGrams: o.unit==="kg" ? orderGrams*purchaseYield(item.key,o.edibleFraction) : units*o.packGrams,
    weightSale:o.unit==="kg",
    pieces,
    quantity: units === null ? null : weight
      ? (orderGrams === weight.weight ? weight.label : "около " + grams(orderGrams))
      : packPurchase(item.key, units, o.packLabel),
    at: entry.checkedAt,
    archived: entry.snapshot,
    expired: entry.snapshot && Date.now() - entry.checkedAt >= 86400000,
    cents:
      units === null ? null : Math.round(Math.round(o.unitPrice * 100) * units),
  };
}
function priceDate(ts) {
  return (
    new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Europe/Moscow",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(ts) + " МСК"
  );
}
function rowHTML(r,store) {
  const title = $(FOOD[r.key][0]);
  if (r.status !== "found")
    return `<li><span>${title}</span><small>${r.status === "waiting" ? "Проверяем…" : r.status === "unavailable" ? "Нет в наличии" : "Цена не подтверждена"}</small></li>`;
  const o = r.o,
    u = o.unit === "kg" ? " / кг" : " / уп.";
  let calc =
    r.units === null
      ? o.packLabel + " · число упаковок уточняется"
      : o.unit === "kg"
        ? grams(r.orderGrams) +
          (r.orderGrams > r.g
            ? " к заказу · по рецептам " + grams(r.g)
            : " · после взвешивания")
        : r.units + " уп. × " + o.packLabel;
  if (r.pieces)
    calc =
      r.pieces +
      " " +
      (o.pieceLabel || "шт.") +
      " · примерно " +
      grams(r.orderGrams) +
      " после взвешивания";
  return `<li><div><b>${title}</b>${store ? "<small>"+$(storePriceNote(store,r))+"</small>" : ""}<small><a href="${$(o.url)}" target="_blank" rel="noopener noreferrer">${$(o.title)}</a></small><small>${$(calc)}</small>${o.physicalOutlets?.length ? `<small>При проверке в наличии · ${$(o.physicalOutlets.join(", "))}</small>` : ""}${r.archived ? `<small>Цена на ${priceDate(r.at)}${r.expired ? " · в сумму не входит" : ""}</small>` : ""}</div><div class="price-numbers"><strong>${rubles(o.unitPrice)}${u}</strong>${r.cents !== null ? `<small>${o.unit === "kg" ? "≈ " : ""}${rubles(r.cents / 100)}</small>` : ""}</div></li>`;
}
function quoteInfo(store, items) {
  const rows = items.map((i) => priceLine(i, store)),
    quoted = rows.filter((r) => r.status === "found"),
    counted = quoted.filter((r) => r.cents !== null && !r.expired);
  const waiting = rows.some((r) => r.status === "waiting"),
    weight = counted.some((r) => r.o.unit === "kg"),
    missing = rows.length - counted.length;
  const total = counted.reduce((n, r) => n + r.cents, 0) / 100;
  const sum = !counted.length
    ? waiting
      ? "Проверяем…"
      : "Нет суммы"
    : weight ? "≈ " + money(total) : rubles(total);
  let label = waiting
    ? "Проверяем цены"
    : !counted.length
      ? "Сумма пока недоступна"
      : missing
        ? "Сумма по " + counted.length + " из " + rows.length
        : Object.hasOwn(catalogShops, store)
          ? "По ценам каталога"
          : weight
            ? "По плановому весу"
            : "Итого за упаковки";
  const archived = quoted.filter((r) => r.archived);
  const stamps = quoted.map((r) => r.at).filter(Number.isFinite);
  const note = stamps.length
    ? "Данные на " + priceDate(Math.min(...stamps)) + ". "
    : "";
  if (archived.length)
    label +=
      " · сохранённые цены на " +
      priceDate(Math.min(...archived.map((r) => r.at)));
  const fullCents=rows.reduce((total,row)=>total+(Number.isFinite(row.cents)&&!row.expired ? row.cents : estimatedPurchase(row.key,row.g,store).cents),0);
  return {
    fullSum:"≈ "+money(fullCents/100),
    rows,
    sum,
    label,
    waiting,
    coverage: quoted.length + " из " + rows.length,
    note,
  };
}
function drawQuotes() {
  const host = document.getElementById("price-area");
  if (!host) return;
  refreshShoppingEstimate();
  const stores = (settings().stores || []).filter(supportedShop);
  if (!stores.length) {
    host.innerHTML = `<div class="price-head"><h2>Цены в магазинах</h2>${button("Выбрать магазины", "shops", "soft", "bag")}</div>`;
    return;
  }
  const items = requiredItems(),
    mini = route === "week";
  const open = new Set(
    [...host.querySelectorAll("details[open]")].map((e) => e.dataset.store),
  );
  if (!items.length) {
    host.innerHTML =
      "<p><strong>0 ₽</strong> · Всё для этой недели уже есть дома.</p>" +
      button("Выбрать магазины", "shops", "soft", "bag");
    return;
  }
  if (mini) {
    host.innerHTML = `<h2>Цены по магазинам</h2>${stores
      .map((k) => {
        if (storeShelf(k))
          return referenceMarket(items, true, false, k);
        const q = quoteInfo(k, items);
        return `<p><strong>${shopName(k)}</strong> · ${q.fullSum}<br>${q.label} · ${q.sum}</p>`;
      })
      .join(
        "",
      )}<button type="button" class="link" data-action="list">Посмотреть цены по продуктам ${icon("right", 15)}</button>`;
    return;
  }
  host.innerHTML =
    `<div class="price-head"><h2>Цены в магазинах</h2><div class="price-tools"><button class="link" type="button" data-action="shops">Выбрать магазины</button>${stores.some(id => !catalogShops[id]?.reference) ? '<button class="link" type="button" data-action="retry-prices">Обновить</button>' : ""}</div></div>` +
    stores
      .map((k) => {
        if (storeShelf(k))
          return referenceMarket(items, false, open.has(k), k);
        const q = quoteInfo(k, items);
        return `<details class="price-market" data-store="${k}" ${open.has(k) ? "open" : ""}><summary><div><strong>${shopName(k)}</strong><small>${shopCaption(k)}</small></div><div class="price-numbers"><b>${q.fullSum}</b><small>${q.label} · ${q.sum}</small></div></summary><p>${q.note}Цены найдены для ${q.coverage} продуктов. Для остальных учтена примерная стоимость покупки. Весовой итог зависит от фактического веса.${k === "vv" ? " Наличие и персональные скидки уточняются по адресу во ВкусВилле." : k === "tvoydom" ? " Ниже указаны гипермаркеты, где нашёлся каждый товар. Цена в зале может отличаться от цены витрины." : ""}</p><ul class="price-rows">${q.rows.map(row=>Number.isFinite(row.cents)&&!row.expired ? rowHTML(row,k) : estimatedRow(row,k)).join("")}</ul></details>`;
      })
      .join("");
}
async function fetchPrices(store, keys, epoch) {
  try {
    const res = await fetch(
      "data/prices-" + encodeURIComponent(store) + ".json",
      { signal: AbortSignal.timeout(22000) },
    );
    if (!res.ok) throw Error("store");
    const payload = await res.json();
    if (epoch !== priceEpoch) return;
    for (const k of keys) {
      const row = payload[k];
      priceBook.set(store + "/" + k, {
        offer: row?.offer || null,
        snapshot: row?.snapshot === true,
        unavailable: row?.unavailable === true,
        receivedAt: Date.now(),
        checkedAt: row?.checkedAt || Date.now(),
      });
    }
  } catch {
    if (epoch === priceEpoch)
      for (const k of keys)
        priceBook.set(store + "/" + k, { offer: null, checkedAt: Date.now() });
  } finally {
    if (epoch === priceEpoch) {
      for (const k of keys) pendingPrices.delete(store + "/" + k);
      if (document.getElementById("price-area")) drawQuotes();
    }
  }
}
async function quoteQueue(jobs, epoch) {
  while (jobs.length && epoch === priceEpoch) {
    const { store, keys } = jobs.shift();
    await fetchPrices(store, keys, epoch);
  }
}
function mountQuotes() {
  clearTimeout(priceTimer);
  void updatePerekQuote();
  if (!document.getElementById("price-area")) return;
  const stores = settings().stores || [],
    keys = requiredItems().map((x) => x.key),
    jobs = [];
  for (const s of stores) {
    if (!supportedShop(s) || catalogShops[s]?.reference) continue;
    const needed = keys.filter((k) => {
      if (!originalRetailKeys.has(k)) return false;
      const name = s + "/" + k,
        row = priceBook.get(name);
      if (
        row &&
        Date.now() - (row.receivedAt || row.checkedAt) >=
          (row.offer ? 300000 : 60000)
      )
        priceBook.delete(name);
      return !priceBook.has(name) && !pendingPrices.has(name);
    });
    for (let i = 0; i < needed.length; i += 5) {
      const chunk = needed.slice(i, i + 5);
      chunk.forEach((k) => pendingPrices.set(s + "/" + k, true));
      jobs.push({ store: s, keys: chunk, index: i });
    }
  }
  drawQuotes();
  if (jobs.length) {
    jobs.sort((a, b) => a.index - b.index);
    const epoch = priceEpoch;
    void quoteQueue(jobs, epoch);
    void quoteQueue(jobs, epoch);
  }
  if (stores.some((id) => supportedShop(id) && !catalogShops[id]?.reference))
    priceTimer = setTimeout(() => {
      if (!document.hidden) mountQuotes();
    }, 120000);
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && document.getElementById("price-area")) mountQuotes();
});
