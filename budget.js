// Compare a complete basket at each selected Moscow shelf, never a sum of the cheapest individual SKUs.
const budgetRange = n => Number.isInteger(n) && n>=400 && n<=150000;
const hasBudget = s => budgetRange(s.budget) && (s.budgetChosen === true || (s.budgetChosen == null && s.budget !== 5000));
function storeShelf(store) {
  return typeof referenceCatalogs==="undefined" ? null : referenceCatalogs[store];
}
function cataloguePurchase(key, g, store) {
  if (!store) return null;
  const row = storeShelf(store)
    ? referenceLine({key,g},store)
    : priceLine({key,g},store);
  return Number.isFinite(row.cents) && !row.expired ? row : null;
}
function estimatedPurchase(key,g) {
  const purchase=typicalPurchase(key,g);
  return {quantity:purchase.label,cents:Math.round(FOOD[key][4]*purchase.weight)};
}
function estimatedRow({key,g,status,expired}) {
  const row=estimatedPurchase(key,g);
  const note=status==="unavailable" ? " · нет в наличии" : expired ? " · прежняя цена устарела" : "";
  return `<li><div><b>${$(FOOD[key][0])}</b><small>${$(row.quantity)} · примерная цена${note}</small></div><strong>≈ ${money(row.cents/100)}</strong></li>`;
}
function budgetScorer(s, {planning = false} = {}) {
  // Live prices arrive after the menu appears. They update checkout without silently replacing meals.
  const stores = (s.stores || []).filter(store => supportedShop(store) && (!planning || storeShelf(store)));
  const sources = stores.length ? stores : [null], cache = new Map();
  return (counts, pantry = {}) => {
    const items = Object.entries(counts).map(([key,g]) => [key,Math.max(0,neededGrams(g) - (pantry[key] || 0))]).filter(([,g]) => g > 0);
    let best = null;
    for (const store of sources) {
      let cents = 0, known = 0;
      for (const [key,g] of items) {
        const token = store + "/" + key + "/" + g;
        let line = cache.get(token);
        if (!line) {
          const row = cataloguePurchase(key,g,store);
          line = {cents:row?.cents ?? estimatedPurchase(key,g).cents, known:!!row};
          cache.set(token,line);
        }
        cents += line.cents;
        known += Number(line.known);
      }
      const amount = {store,cents,known,count:items.length};
      // An entirely unpriced store gives no basis for comparing it with a priced one.
      if (!best || (known > 0 && !best.known) || (Boolean(known) === Boolean(best.known) &&
        (cents < best.cents || (cents === best.cents && known > best.known)))) best = amount;
    }
    return best;
  };
}
function weeklyQuote(p) {
  return budgetScorer(settings())(p.counts,weekData().pantry);
}
function budgetPlan(s,n,replacements,prior,phase,previous) {
  const make=(swaps,strength=0)=>planWeek(s,n,swaps,prior,phase,previous,strength);
  if (!hasBudget(s)) return make(replacements);
  const score=budgetScorer(s,{planning:true}), pantry=s.planningPantry?.[n] || {};
  // Choose the underlying week independently of one-day edits. A manual swap never triggers a new cost tier.
  let chosen=make({}), tier=0;
  if (!chosen) return null;
  let amount=score(chosen.counts,pantry).cents;
  for(const level of [1,4,12]){
    if(amount<=s.budget*100) break;
    const next=make({},level);
    if(!next) continue;
    const value=score(next.counts,pantry).cents;
    if(value<amount){chosen=next;tier=level;amount=value;}
  }
  return Object.keys(replacements).length ? make(replacements,tier) : chosen;
}
// Capture stock only when the user explicitly requests a new budget/menu. Checking a shopping row keeps the chosen meals.
function useStockForPlanning(s,n,pantry) {
  s.planningPantry={...s.planningPantry,[n]:Object.fromEntries(Object.entries(pantry).filter(([,g])=>g>0))};
}
function budgetFields(count,value,scope) {
  const amounts=[2500,3500,5000].map(n=>Math.round(n*count/100)*100);
  return `<div class="budget-fields"><p class="quiet">На 7 дней · ${portions(count)} на каждый приём пищи. Выберите сумму или введите свою.</p><div class="chips">${amounts.map(n=>`<button class="chip" type="button" data-action="budget-preset" data-scope="${scope}" data-value="${n}" aria-pressed="${n===value}">${money(n)}</button>`).join("")}</div><label class="field">Лимит на неделю, ₽<input type="number" name="weekly-budget" required min="400" max="150000" step="1" inputmode="numeric" placeholder="Например, ${amounts[1]}" value="${Number.isFinite(value)?value:""}"></label><small class="quiet" data-budget-day aria-live="polite">${budgetDaily(value,count)}</small></div>`;
}
function budgetDaily(value,count) {
  return budgetRange(value) ? "Около "+money(value/7)+" в день на всех · "+money(value/(7*count))+" на полную порцию в день." : "Введите сумму от 400 до 150 000 ₽.";
}
function budgetSource(q) {
  if(!q.count) return "Всё есть дома. Для этой недели покупать продукты не нужно.";
  if(!q.store) return "Оценка с округлением до упаковок и покупного веса. В магазине фасовка и цены могут отличаться.";
  const shelf=storeShelf(q.store);
  const source=shelf ? shelf.name+" · Москва, "+new Date(shelf.checkedOn+"T12:00:00Z").toLocaleDateString("ru-RU") : shopName(q.store);
  return source+". Цены и фасовки магазина: "+q.known+" из "+q.count+" позиций."+(q.known<q.count?" Остальное — по примерной фасовке и весу покупки.":"")+" Без доставки.";
}
function budgetPanel(p, q=weeklyQuote(p)) {
  const s=settings(), limited=hasBudget(s), edit=button(limited?"Изменить сумму":"Задать бюджет","budget-edit","soft");
  return `<section class="budget-box"><div><h2>${limited?"Бюджет на неделю · "+money(s.budget):"Планируемая закупка"}</h2><p><strong>Докупить примерно на <span data-purchase-total>${money(q.cents/100)}</span></strong><span data-budget-balance>${budgetBalance(s,q)}</span></p><small data-budget-source>${budgetSource(q)}</small></div><div class="budget-actions">${edit}${limited?button("Найти замены дешевле","budget-swaps","outline","",q.cents>s.budget*100?"":"hidden"):""}</div></section>`;
}
function budgetBalance(s,q) {
  if(!hasBudget(s)) return "";
  const delta=(s.budget*100-q.cents)/100;
  if(!delta)return " · ровно в пределах лимита";
  return " · "+(delta>0?"запас около ":"выше лимита примерно на ")+rubles(Math.abs(delta)<1?Math.abs(delta):Math.round(Math.abs(delta)));
}
function refreshShoppingEstimate() {
  const box=document.querySelector(".budget-box");
  if(!box) return;
  const p=plan(), q=weeklyQuote(p);
  for(const el of document.querySelectorAll("[data-purchase-total]")) el.textContent=money(q.cents/100);
  box.querySelector("[data-budget-balance]").textContent=budgetBalance(settings(),q);
  box.querySelector("[data-budget-source]").textContent=budgetSource(q);
  const swaps=box.querySelector("[data-action=budget-swaps]");
  if(swaps) swaps.hidden=q.cents<=settings().budget*100;
  for(const label of document.querySelectorAll(".grocery input:not(:checked)")) {
    const k=label.dataset.pantry;
    label.closest(".grocery").querySelector("b").textContent="Купить: "+shoppingAmount(k,remainingGrams(k,p.counts[k]),q.store);
  }
}

function budgetAlternatives() {
  const s=settings(),p=plan(),pantry=weekData().pantry,score=budgetScorer(s),base=score(p.counts,pantry).cents,options=[];
  const pool=RECIPES.filter(r=>allowed(s,r) && s.votes[r.id]!==-1);
  for(const [d,dayPlan] of p.days.entries()) for(const [slot,meal] of dayPlan.meals.entries()){
    if(meal.manual) continue;
    const analogues=similarOptions(meal.r,pool,s.votes).slice(0,10);
    for(const {r} of analogues){
      if(dayPlan.meals.some(x=>x.r.id===r.id))continue;
      const counts={...p.counts};
      const nextMeals=dayPlan.meals.map((m,i)=>i===slot ? {...m,r,f:factor(s,r,slot)} : {...m});
      applyDailyTargets(s,nextMeals);
      for(const m of dayPlan.meals) for(const [k,g] of m.r.items) counts[k]-=g*m.f;
      for(const m of nextMeals) for(const [k,g] of m.r.items) counts[k]=(counts[k]||0)+g*m.f;
      const saving=base-score(counts,pantry).cents;
      if(saving>=100) options.push({day:d,slot,r,old:meal.r,saving});
    }
  }
  const verified=[], ids=new Set();
  for(const v of options.sort((a,b)=>b.saving-a.saving)){
    if(ids.has(v.r.id))continue;
    const projected=plan({["day:"+v.day+"-"+v.slot]:v.r.id});
    if(!projected || projected.days[v.day].meals[v.slot].r.id!==v.r.id)continue;
    // Only advertise one-day swaps that actually leave all other meals alone.
    if(!projected.days.every((x,d)=>x.meals.every((m,i)=>d===v.day&&i===v.slot||m.r.id===p.days[d].meals[i].r.id))) continue;
    const saving=base-score(projected.counts,pantry).cents;
    if(saving<100) continue;
    verified.push({...v,saving});ids.add(v.r.id);if(verified.length>=3)break;
  }
  return verified;
}
function budgetDialog(info) {
  if(info.kind==="budget-edit")return `<div class="sheet-body simple"><h2 id="sheet-title">Сколько потратим за неделю?</h2><form id="budget-form">${budgetFields(servings(settings()),info.value,"sheet")}<button class="btn primary" type="submit">Применить бюджет</button></form></div>`;
  const choices=info.choices;
  return `<div class="sheet-body simple"><h2 id="sheet-title">Замены дешевле</h2><p class="quiet">Сравнили всю недельную закупку с учётом запасов. Меню изменится, только если выберете замену.</p><div class="options-list">${choices.map(v=>`<button type="button" data-action="budget-swap" data-id="${v.r.id}" data-day="${v.day}" data-slot="${v.slot}"><img src="${photo(v.r)}" alt=""><span><small>${DAYS[v.day]} · ${slotNames[v.slot]} · вместо «${$(v.old.title)}»</small><b>${$(v.r.title)}</b><small>Экономия около ${money(v.saving/100)} за неделю</small></span></button>`).join("")||"<p>Среди близких аналогов не нашлось замены, которая уменьшит закупку. Можно отметить больше блюд или изменить лимит.</p>"}</div></div>`;
}
