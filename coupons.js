let couponCatalog = null, couponFilter = "", couponRequest = null, couponsUpdated = 0;
function couponsPage() {
  return '<div class="wrap inner-page coupon-page"><h1>Купоны</h1><section id="coupon-list" aria-label="Купоны магазинов"></section></div>';
}
function expiryLabel(c) {
  return new Date(c.expires+"T12:00:00Z").toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"});
}
function couponCard(c,index) {
  return `<article class="coupon-ticket tone-${index%2}"><div class="coupon-offer"><div class="coupon-store"><b>${$(c.store)}</b>${icon("ticket",22)}</div><strong class="coupon-value">${$(c.value)}</strong><h2>${$(c.title)}</h2></div>
  <button class="coupon-terms" type="button" data-coupon="detail" data-id="${$(c.id)}"><span>До ${expiryLabel(c)}</span><b>Открыть купон ${icon("right",15)}</b></button></article>`;
}
function paintCoupons(error = false) {
  const list = document.getElementById("coupon-list"), week = document.getElementById("week-coupons");
  const pending = error ? 'Не удалось загрузить купоны. <button class="link" data-coupon="retry">Повторить</button>' : 'Загружаем купоны…';
  if (!couponCatalog || error) {
    if(list) list.innerHTML = '<p class="quiet" role="status">'+pending+'</p>';
    if(week) week.innerHTML = error ? '<a class="link" href="#coupons">Купоны магазинов →</a>' : '';
    return;
  }
  const today = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Moscow"}).format(new Date());
  const items = couponCatalog.items.filter(c=>c.expires>=today);
  const first = items[0];
  if(week) week.innerHTML = first ? `<div class="coupon-intro"><h3>Купоны магазинов</h3><a class="link" href="#coupons">Смотреть все</a></div><button class="coupon-feature" data-coupon="detail" data-id="${$(first.id)}"><strong>${$(first.value)}</strong><span><b>${$(first.store)}</b><small>${$(first.title)}</small></span>${icon("right",18)}</button>` : '';
  if(!list) return;
  const stores = [...new Set(items.map(c=>c.store))];
  if (!stores.includes(couponFilter)) couponFilter = "";
  const filters = ["",...stores].map(s=>`<button type="button" aria-pressed="${s===couponFilter}" data-coupon="filter" data-store="${$(s)}">${$(s||"Все")}</button>`).join("");
  list.innerHTML = (items.length ? `<div class="coupon-filters" aria-label="Магазины">${filters}</div><div class="coupon-grid">${items.filter(c=>!couponFilter||c.store===couponFilter).map(couponCard).join("")}</div>` : '<p class="quiet">Сейчас нет действующих купонов.</p>') +
    (couponCatalog.owner ? '<button class="btn outline" data-coupon="add">Добавить купон</button>' : '<a class="link coupon-login" target="_top" href="https://za-stol-menu-kbr.kbrcore.chatgpt.site/signin-with-chatgpt?return_to=%2F%23coupons">Вход для владельца</a>');
}
async function mountCoupons(force=false) {
  paintCoupons();
  if (couponRequest || (!force && couponCatalog && Date.now()-couponsUpdated < 30000)) return;
  const start = couponsUpdated;
  couponRequest = fetch("data/coupons.json",{cache:"no-store"}).then(async r=>{
    if(!r.ok) throw Error();
    const result = await r.json();
    if(start === couponsUpdated) {couponCatalog=result; couponsUpdated=Date.now(); paintCoupons();}
  }).catch(()=>paintCoupons(true)).finally(()=>{couponRequest=null});
  await couponRequest;
}
function couponSheet(info) {
  const title = str=>`<h2 id="sheet-title">${str}</h2>`;
  if(info.kind === "coupon-add") {
    const textField = (name,label,max,example,required=true)=>`<label class="field">${label}<input name="${name}" maxlength="${max}" placeholder="${example}" ${required?"required":""}></label>`;
    return `<div class="sheet-body simple">${title("Добавить купон")}<form id="coupon-form">
    ${textField("store","Магазин",48,"Пятёрочка")}${textField("value","Размер скидки",24,"−15%")}${textField("title","На что действует",100,"На первый заказ")}
    <label class="field">Условия<textarea name="conditions" maxlength="700" required placeholder="Минимальная сумма заказа, регион и ограничения"></textarea></label>
    <label class="field">Действует по<input name="expires" type="date" required></label>
    ${textField("code","Промокод, если нужен",80,"Введите код",false)}
    <button class="btn primary" type="submit">Опубликовать купон</button><p class="form-error" role="alert"></p></form></div>`;
  }
  const c = couponCatalog?.items.find(c=>c.id===info.id);
  if(!c) return '<div class="sheet-body simple">'+title("Купон недоступен")+'</div>';
  if(info.kind==="coupon-remove") return `<div class="sheet-body simple">${title("Снять купон с публикации?")}<p>${$(c.store)} · ${$(c.title)}</p><button class="btn primary" data-coupon="remove" data-id="${$(c.id)}">Снять с публикации</button><p class="form-error" role="alert"></p></div>`;
  return `<div class="sheet-body simple coupon-detail"><p class="quiet">${$(c.store)}</p>${title($(c.title))}<strong class="coupon-value">${$(c.value)}</strong><p>${$(c.conditions)}</p><p class="quiet">Действует по ${expiryLabel(c)} включительно.</p>
  ${c.code ? `<label class="field">Промокод<input class="coupon-code" readonly value="${$(c.code)}"></label><button class="btn primary" data-coupon="copy">Скопировать код</button>` : '<p>Промокод не требуется.</p>'}
  ${c.source ? `<a class="link" href="${$(c.source)}" target="_blank" rel="noopener noreferrer">Правила акции у магазина ↗</a>` : ''}
  ${couponCatalog.owner ? `<button class="link" data-coupon="confirm-remove" data-id="${$(c.id)}">Снять с публикации</button>` : ''}</div>`;
}
async function publishCoupon(method,payload,btn) {
  btn.disabled=true;
  const panel=btn.closest(".sheet-body");
  try {
    const r=await fetch("/api/coupons",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const result=await r.json();
    if(!r.ok) throw Error(result.error||"Не удалось сохранить изменение.");
    couponCatalog=result; couponsUpdated=Date.now(); couponFilter=""; paintCoupons();
    if(panel.isConnected) dismissSheet();
    notify(method==="POST"?"Купон опубликован":"Купон снят с публикации");
  } catch(e) {
    panel.querySelector(".form-error").textContent=e.message||"Не удалось сохранить изменение.";
  } finally {btn.disabled=false}
}
document.addEventListener("click", async event=>{
  const b=event.target.closest("[data-coupon]");
  if(!b) return;
  const {coupon,id,store}=b.dataset;
  if(coupon==="filter") {couponFilter=store;paintCoupons();document.querySelector(`[data-store="${CSS.escape(store)}"]`)?.focus({preventScroll:true});}
  if(coupon==="retry") mountCoupons(true);
  if(coupon==="detail") openSheet({kind:"coupon-detail",id});
  if(coupon==="add") openSheet({kind:"coupon-add"});
  if(coupon==="confirm-remove") openSheet({kind:"coupon-remove",id});
  if(coupon==="remove") publishCoupon("DELETE",{id},b);
  if(coupon==="copy") {
    const field=sheet.querySelector(".coupon-code");
    try {await navigator.clipboard.writeText(field.value);notify("Промокод скопирован");}
    catch {field.focus();field.select();notify("Код выделен для копирования");}
  }
});
document.addEventListener("submit",e=>{
  if(e.target.id!=="coupon-form") return;
  e.preventDefault();
  publishCoupon("POST",Object.fromEntries(new FormData(e.target)),e.target.querySelector("[type=submit]"));
});
document.addEventListener("visibilitychange",()=>{
  if(!document.hidden && ["week","coupons"].includes(route)) mountCoupons(true);
});
