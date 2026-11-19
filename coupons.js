const houseGifts = [
  {id:"budu-after-work", value:"5 ужинов", title:"После работы — за 15 минут", dishes:["mustardChicken","rd128","rd135","tomatoPollock","mushroomBeanMash"]},
  {id:"budu-three-mornings", value:"3 завтрака", title:"Утро на выбор — сладкое, солёное или с ягодами", dishes:["curd","herbOmelet","berryToast"]},
  {id:"budu-buckwheat", value:"Гречка × 3", title:"Три идеи, если дома есть гречка", dishes:["buckapple","mushroomBuck","rd121"]}
].map(gift=>({...gift,store:"Буду это"}));

function giftSheet(gift) {
  const recipes=gift.dishes.map(byId);
  const totals=new Map();
  for(const recipe of recipes) {
    for(const [key,grams] of recipe.items) totals.set(key,(totals.get(key)||0)+grams*2);
  }
  const lines=[...totals].sort(([a],[b])=>FOOD[a][0].localeCompare(FOOD[b][0],"ru"))
    .map(([key,grams])=>FOOD[key][0]+" — "+weeklyNeed(key,grams));
  const cards=recipes.map(recipe=>`<button class="gift-recipe" type="button" data-action="recipe" data-id="${$(recipe.id)}"><img src="${$(photo(recipe))}" alt="" loading="lazy"><span><b>${$(recipe.title)}</b><small>${$(cookingTime(recipe))}</small></span>${icon("right",16)}</button>`).join("");
  return `<div class="sheet-body simple coupon-detail"><p class="quiet">Подарок от «Буду это»</p><h2 id="sheet-title">${$(gift.title)}</h2>${cards}<details class="gift-list"><summary>Продукты на двоих</summary><p>Если приготовить каждое блюдо один раз. Сверьте количество с тем, что есть дома.</p><ul>${lines.map(line=>"<li>"+$(line)+"</li>").join("")}</ul><button class="btn outline" type="button" data-coupon="gift-copy">Скопировать список</button><textarea aria-label="Список для копирования" hidden readonly>${$([gift.title,"На двоих",...lines].join("\n"))}</textarea></details></div>`;
}
let couponCatalog = null, couponFilter = "", couponRequest = null, couponsUpdated = 0;
let couponLoadFailed = false;
let affiliateOffers = [], affiliateRequest = null, affiliateUpdated = 0, affiliateIssue = 0;

function couponsPage() {
  return '<div class="wrap inner-page coupon-page"><h1>Купоны</h1><section id="coupon-list" aria-label="Купоны и подарки"></section></div>';
}
function expiryLabel(c) {
  return new Date(c.expires+"T12:00:00Z").toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"});
}
function activeCoupons() {
  const today = new Intl.DateTimeFormat("sv-SE", {timeZone:"Europe/Moscow"}).format(new Date());
  return [...affiliateOffers, ...(couponCatalog?.items || [])]
    .filter(c => c.expires === null || c.expires >= today);
}
function couponBrand(c) {
  const logo = c.logo ? `<img class="coupon-logo" src="${$(c.logo)}" alt="" loading="lazy">` : "";
  return `<span class="coupon-brand">${logo}<b>${$(c.store)}</b></span>`;
}
function couponAdNotice(c) {
  return c.advertising ? `<p class="coupon-ad-notice">
    <span>erid: ${$(c.erid)}</span>
    <span>${$(c.advertising)}</span>
  </p>` : "";
}
function couponMedicalWarning(c) {
  return c.medical ? '<p class="coupon-medical-warning">Имеются противопоказания. Необходима консультация специалиста.</p>' : "";
}
function couponCard(c,index) {
  const validThrough = c.expires ? "До " + expiryLabel(c) : "Бессрочно";
  return `<article class="coupon-ticket tone-${index%2}">
    <div class="coupon-offer">
      ${couponAdNotice(c)}
      <div class="coupon-store">${couponBrand(c)}${icon("ticket",22)}</div>
      <strong class="coupon-value">${$(c.value)}</strong><h2>${$(c.title)}</h2>
      ${couponMedicalWarning(c)}
    </div>
    <button class="coupon-terms" type="button" data-coupon="detail" data-id="${$(c.id)}"><span>${c.dishes ? "Подарок от приложения" : validThrough}</span><b>${c.dishes ? "Открыть подарок" : "Открыть купон"} ${icon("right",15)}</b></button>
  </article>`;
}
function paintCoupons() {
  const list = document.getElementById("coupon-list"), week = document.getElementById("week-coupons");
  const retry = '<button class="link" data-coupon="retry">Повторить</button>';
  const pending = couponLoadFailed ? 'Не удалось загрузить купоны. ' + retry : 'Загружаем купоны…';
  const affiliateNotice = affiliateIssue === 403
    ? 'Откройте «Буду это» заново в Telegram, чтобы обновить партнёрские купоны.'
    : affiliateIssue ? 'Не удалось загрузить партнёрские купоны. ' + retry : '';
  const items = [houseGifts[0], ...activeCoupons(), ...houseGifts.slice(1)];
  const first = items[0];
  if(week) week.innerHTML = first ? `<div class="coupon-intro"><h3>Купоны и подарки</h3><a class="link" href="#coupons">Смотреть все</a></div><button class="coupon-feature" data-coupon="detail" data-id="${$(first.id)}"><strong>${$(first.value)}</strong><span><b>${$(first.store)}</b><small>${$(first.title)}</small></span>${icon("right",18)}</button>` : '';
  if(!list) return;
  const stores = [...new Set(items.map(c=>c.store))];
  if (!stores.includes(couponFilter)) couponFilter = "";
  const filters = ["",...stores].map(s=>`<button type="button" aria-pressed="${s===couponFilter}" data-coupon="filter" data-store="${$(s)}">${$(s||"Все")}</button>`).join("");
  list.innerHTML = (items.length ? `<div class="coupon-filters" aria-label="От кого предложение">${filters}</div><div class="coupon-grid">${items.filter(c=>!couponFilter||c.store===couponFilter).map(couponCard).join("")}</div>` : '<p class="quiet">Сейчас нет действующих купонов.</p>') +
    (couponLoadFailed || !couponCatalog ? '<p class="quiet" role="status">'+pending+'</p>' : "") +
    (affiliateNotice ? '<p class="quiet" role="status">'+affiliateNotice+'</p>' : "") +
    (couponCatalog?.owner ? '<button class="btn outline" data-coupon="add">Добавить купон</button>' : '<a class="link coupon-login" target="_top" href="https://za-stol-menu-kbr.kbrcore.chatgpt.site/signin-with-chatgpt?return_to=%2F%23coupons">Вход для владельца</a>');
}
function mountAffiliateCoupons(force) {
  const initData = window.Telegram?.WebApp?.initData;
  if (!initData || affiliateRequest || (!force && Date.now() - affiliateUpdated < 30000)) return;
  affiliateIssue = 0;
  affiliateRequest = fetch("https://www.kbrcore.ru:8444/budu-eto/coupons", {
    method: "POST", credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store",
    body: JSON.stringify({initData})
  }).then(async response => {
    if (!response.ok) {
      affiliateIssue = response.status;
      throw Error("unavailable");
    }
    const result = await response.json();
    affiliateOffers = result.items;
    affiliateUpdated = Date.now();
  }).catch(() => {
    affiliateOffers = [];
    affiliateIssue = affiliateIssue || 503;
  }).finally(() => {
    affiliateRequest = null;
    paintCoupons();
  });
}
async function mountCoupons(force=false) {
  if (route === "coupons") mountAffiliateCoupons(force);
  paintCoupons();
  if (couponRequest || (!force && couponCatalog && Date.now()-couponsUpdated < 30000)) return;
  const start = couponsUpdated;
  couponRequest = fetch("data/coupons.json",{cache:"no-store"}).then(async r=>{
    if(!r.ok) throw Error();
    const result = await r.json();
    if(start === couponsUpdated) {couponCatalog=result; couponsUpdated=Date.now(); couponLoadFailed=false; paintCoupons();}
  }).catch(()=>{couponLoadFailed=true;paintCoupons();}).finally(()=>{couponRequest=null});
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
  const gift = houseGifts.find(g=>g.id===info.id);
  if(gift && info.kind==="coupon-detail") return giftSheet(gift);
  const c = activeCoupons().find(c => c.id === info.id);
  if(!c) return '<div class="sheet-body simple">'+title("Купон недоступен")+'</div>';
  if(info.kind==="coupon-remove") return `<div class="sheet-body simple">${title("Снять купон с публикации?")}<p>${$(c.store)} · ${$(c.title)}</p><button class="btn primary" data-coupon="remove" data-id="${$(c.id)}">Снять с публикации</button><p class="form-error" role="alert"></p></div>`;
  const validThrough = c.expires ? "Действует по " + expiryLabel(c) + " включительно." : "Бессрочно.";
  const brand = c.logo ? `<div class="coupon-detail-brand">${couponBrand(c)}</div>` : `<p class="quiet">${$(c.store)}</p>`;
  return `<div class="sheet-body simple coupon-detail">
  ${couponAdNotice(c)}
  ${brand}
  ${title($(c.title))}<strong class="coupon-value">${$(c.value)}</strong><p>${$(c.conditions)}</p>
  <p class="quiet">${validThrough}</p>
  ${couponMedicalWarning(c)}
  ${c.code ? `<label class="field">Промокод<input class="coupon-code" readonly value="${$(c.code)}"></label><button class="btn primary" data-coupon="copy" data-offer="${c.advertising ? $(c.id) : ""}">Скопировать код</button>` : '<p>Промокод не требуется.</p>'}
  ${c.shopUrl ? `<a class="link" data-coupon="shop" data-offer="${$(c.id)}" href="${$(c.shopUrl)}" target="_blank" rel="noopener noreferrer sponsored">${$(c.shopLabel)} ↗</a>` : ''}
  ${c.source ? `<a class="link" href="${$(c.source)}" target="_blank" rel="noopener noreferrer">Правила акции у магазина ↗</a>` : ''}
  ${couponCatalog?.owner && !c.advertising ? `<button class="link" data-coupon="confirm-remove" data-id="${$(c.id)}">Снять с публикации</button>` : ''}</div>`;
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
  const {coupon,id,store,offer}=b.dataset;
  if(coupon==="filter") {couponFilter=store;paintCoupons();document.querySelector(`[data-store="${CSS.escape(store)}"]`)?.focus({preventScroll:true});}
  if(coupon==="retry") mountCoupons(true);
  if (coupon === "detail") {
    openSheet({kind:"coupon-detail",id});
    if (affiliateOffers.some(c => c.id === id)) miniStats.coupon("coupon_open", id);
  }
  if(coupon==="add") openSheet({kind:"coupon-add"});
  if(coupon==="confirm-remove") openSheet({kind:"coupon-remove",id});
  if(coupon==="remove") publishCoupon("DELETE",{id},b);
  if (coupon === "shop") {
    miniStats.coupon("coupon_visit", offer);
    if (window.Telegram?.WebApp?.isVersionAtLeast?.("6.1")) {
      event.preventDefault();
      window.Telegram.WebApp.openLink(b.href);
    }
  }
  if(coupon==="gift-copy") {
    const field=b.parentElement.querySelector("textarea");
    try {await navigator.clipboard.writeText(field.value);notify("Список скопирован");}
    catch {field.hidden=false;field.focus();field.select();notify("Выделили список для копирования");}
  }
  if(coupon==="copy") {
    const field=sheet.querySelector(".coupon-code");
    try {
      await navigator.clipboard.writeText(field.value);
      notify("Промокод скопирован");
      miniStats.coupon("coupon_copy", offer);
    }
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
