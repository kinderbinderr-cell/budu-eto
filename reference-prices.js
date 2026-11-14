function referenceLine(item, store) {
  const offer = referenceCatalogs[store].products[item.key];
  if (!offer) return { ...item, status: "unknown" };
  return priceLine(item, store, {offer});
}
function referenceEstimate(items, store) {
  const rows = items.map(item => referenceLine(item, store));
  const priced = rows.filter((row) => Number.isFinite(row.cents));
  const cents = priced.reduce((sum, row) => sum + row.cents, 0);
  return { rows, cents, count: priced.length, sum: priced.length ? "≈ " + money(cents / 100) : "Нет цен" };
}
function referenceRow(row) {
  if (!row.quantity) return rowHTML(row);
  const offer = row.o;
  const rate = rubles(offer.unitPrice) + (offer.unit === "kg" ? " / кг" : " / уп.");
  const need = row.key === "egg" ? " · для меню " + Math.ceil(row.g / 50) + " шт." : "";
  return `<li><div><b>${$(FOOD[row.key][0])}</b><small>${$(row.quantity + need)}</small><small><a href="${$(offer.url)}" target="_blank" rel="noopener noreferrer">${$(offer.title)}</a></small>${offer.note ? "<small>" + $(offer.note) + "</small>" : ""}</div><div class="price-numbers"><strong>${money(row.cents / 100)}</strong><small>${rate}</small></div></li>`;
}
function referenceMarket(items, mini, open, store) {
  if (store === "perekrestok" && perekEnabled && perekAddress && perekResult?.complete && perekResult.expiresAt > Date.now())
    return perekBasketPanel(items, mini, open);
  const { name, address, checkedOn } = referenceCatalogs[store];
  const date = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(checkedOn + "T00:00:00Z"));
  const q = referenceEstimate(items, store);
  const full = budgetScorer({stores:[store]})(Object.fromEntries(items.map(({key,g})=>[key,g])));
  const total = "≈ "+money(full.cents/100);
  const source = "Москва · Яндекс Еда · проверено " + date;
  const count = "По витрине "+q.count+" из "+items.length+" · "+(q.count===items.length ? "вся закупка" : "остальное по оценке");
  const partner = store === "perekrestok" && perekEnabled ? perekBasketPanel(items, mini, false) : "";
  if (mini) return `<div class="reference-week"><div><strong>${$(name)}</strong><small>${count}</small></div><b>${total}</b><small class="reference-place">${source}</small></div>${partner}`;
  return `<details class="price-market reference-market" data-store="${store}" ${open ? "open" : ""}><summary><div><strong>${$(name)}</strong><small>${source}</small></div><div class="price-numbers"><b>${total}</b><small>${count}</small></div></summary><p>Магазин на витрине Яндекс Еды — ${$(address)}. Считаем по обычным ценам Яндекс Еды за целые упаковки и вес с учётом шага заказа. Остальные позиции входят в итог по примерным ценам. Доставка отдельно.</p><ul class="price-rows">${q.rows.map(row=>row.status==="unknown" ? estimatedRow(row,store) : referenceRow(row)).join("")}</ul></details>${partner}`;
}
