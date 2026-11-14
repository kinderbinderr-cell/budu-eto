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
function estimatedPurchase(key,g,store) {
  const city=typeof cityObservations==="undefined" ? null : cityObservations[key];
  if(city) {
    const purchase=typicalPurchase(key,g);
    // Retail pack capacities are in edible grams, including liquids and eggs.
    const divisor=city.unit==="kg" ? 1000 : city.unit==="10pcs" && key==="egg" ? 500
      : city.unit==="l" ? ({milk:1030,oil:920,cream:1000})[key] : null;
    if(divisor>0) return {quantity:purchase.label,cents:Math.round(city.kopecks*purchase.weight/divisor),city};
  }
  // Use a dated Moscow shelf for the same ingredient; keep its real pack size and identify it as a benchmark.
  let benchmark=null, latest="";
  if(typeof referenceCatalogs!=="undefined") for(const [id,shelf] of Object.entries(referenceCatalogs)) {
    if(id===store || !shelf.products[key] || !shelf.checkedOn || shelf.checkedOn<=latest) continue;
    const row=referenceLine({key,g},id);
    if(!Number.isFinite(row.cents)) continue;
    benchmark={quantity:row.quantity,cents:row.cents,shelf,offer:shelf.products[key]};
    latest=shelf.checkedOn;
  }
  if(benchmark) return benchmark;
  const purchase=typicalPurchase(key,g);
  return {quantity:purchase.label,cents:Math.round(FOOD[key][4]*purchase.weight)};
}
const displayPriceDate = iso => iso.split("-").reverse().join(".");
const cityPeriods=new Map();
function cityPeriod(iso) {
  if(iso.length===10)return displayPriceDate(iso);
  if(!cityPeriods.has(iso)) cityPeriods.set(iso,new Intl.DateTimeFormat("ru-RU",{year:"numeric",month:"long",timeZone:"UTC"}).format(new Date(iso+"-01T00:00:00Z")).replace(/ г\.$/,""));
  return cityPeriods.get(iso);
}
function cityPublisher(c) {return c.source.startsWith("https://77.rosstat.gov.ru/") ? "Мосстат" : "Росстат · ЕМИСС";}
function storePriceNote(store,row) {
  const shelf=storeShelf(store);
  const date=shelf?.checkedOn ? displayPriceDate(shelf.checkedOn) : row.at ? new Intl.DateTimeFormat("ru-RU",{timeZone:"Europe/Moscow"}).format(new Date(row.at)) : "";
  return "Цена магазина · "+(shelf?.name || shopName(store))+(date ? " · "+date : " · дата неизвестна");
}
function priceOrigin(row,store,own) {
  if(own) return storePriceNote(store,row);
  if(row.city) return "Средняя по Москве · "+cityPublisher(row.city)+" · "+cityPeriod(row.city.period);
  if(row.shelf) return "Другой магазин · "+row.shelf.name+" · "+displayPriceDate(row.shelf.checkedOn);
  return "Оценка «Буду это» · нет данных о цене";
}
function shoppingPriceNote(key,g,store) {
  const own=cataloguePurchase(key,g,store),row=own || estimatedPurchase(key,g,store);
  return "≈ "+rubles(row.cents/100)+" · "+priceOrigin(row,store,!!own);
}
function estimatedRow({key,g,status,expired},store) {
  const row=estimatedPurchase(key,g,store);
  const note=status==="unavailable" ? " · нет в наличии" : expired ? " · прежняя цена устарела" : "";
  const url=row.city?.source || row.offer?.url, caption=priceOrigin(row,store,false);
  const source=url ? '<a href="'+$(url)+'" target="_blank" rel="noopener noreferrer">'+$(caption)+'</a>' : $(caption);
  const rate=row.city ? '<small>'+$(row.city.category)+' · '+rubles(row.city.kopecks/100)+' / '+({kg:"кг",l:"л","10pcs":"10 шт."})[row.city.unit]+'</small>' : "";
  return `<li><div><b>${$(FOOD[key][0])}</b><small>${$(row.quantity)} · ${source}${note}</small>${rate}</div><strong>≈ ${rubles(row.cents/100)}</strong></li>`;
}
// Compare the additional checkout cost of a recipe, including the unused part of each pack.
function marginalCheckout(store,pantry) {
  const lines=new Map();
  function line(key,grams) {
    const need=Math.max(0,neededGrams(grams)-(pantry[key]||0));
    if(!need) return 0;
    const cacheKey=key+"/"+need;
    if(!lines.has(cacheKey)) lines.set(cacheKey,cataloguePurchase(key,need,store)?.cents ?? estimatedPurchase(key,need,store).cents);
    return lines.get(cacheKey);
  }
  return (recipe,portions,counts)=>recipe.items.reduce((cost,[key,g])=>{
    const before=counts[key]||0;
    return cost+(line(key,before+g*portions)-line(key,before))/100;
  },0);
}
function budgetScorer(s, {planning = false} = {}) {
  // Live prices arrive after the menu appears. They update checkout without silently replacing meals.
  const stores = (s.stores || []).filter(store => supportedShop(store) && (!planning || storeShelf(store)));
  const sources = stores.length ? stores : [null], cache = new Map();
  return (counts, pantry = {}) => {
    const items = Object.entries(counts).map(([key,g]) => [key,Math.max(0,neededGrams(g) - (pantry[key] || 0))]).filter(([,g]) => g > 0);
    let best = null;
    for (const store of sources) {
      let cents = 0, known = 0, benchmark = 0, city = 0;
      for (const [key,g] of items) {
        const token = store + "/" + key + "/" + g;
        let line = cache.get(token);
        if (!line) {
          const row = cataloguePurchase(key,g,store);
          const price=row || estimatedPurchase(key,g,store);
          line = {cents:price.cents,known:!!row,benchmark:!!price.shelf,city:!!price.city};
          cache.set(token,line);
        }
        cents += line.cents;
        known += Number(line.known);
        benchmark += Number(line.benchmark);
        city += Number(line.city);
      }
      const amount = {store,cents,known,benchmark,city,count:items.length};
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
function keepsDayTargets(goals,before,after) {
  if(!goals) return true;
  const gaps=meals=>goals.map((target,i)=>{
    const totals=mealNutrients(meals,meals.map(m=>m.personFactors[i]));
    return target.map((range,k)=>range ? nutrientGap(totals[k],range) : 0);
  });
  const oldGaps=gaps(before);
  return gaps(after).every((row,i)=>row.every((gap,k)=>gap<=oldGaps[i][k]+1e-8));
}
function budgetPlan(s,n,replacements,prior,phase,previous) {
  const make=(swaps,strength=0,checkout=null)=>planWeek(s,n,swaps,prior,phase,previous,strength,checkout);
  if (!hasBudget(s)) return make(replacements);
  const score=budgetScorer(s,{planning:true}), pantry=s.planningPantry?.[n] || {};
  // Choose the underlying week independently of one-day edits. A manual swap never triggers a new cost tier.
  let chosen=make({}), tier=0, chosenCheckout=null;
  if (!chosen) return null;
  const goals=activePortionTargets(s);
  const initialQuote=score(chosen.counts,pantry);
  let amount=initialQuote.cents;
  for(const level of [1,4,12,16]){
    if(amount<=s.budget*100) break;
    const checkout=level===16 ? marginalCheckout(initialQuote.store,pantry) : null;
    const next=make({},level,checkout);
    if(!next) continue;
    const value=score(next.counts,pantry).cents;
    // Compare the actual package bill among plans that do at least as well on the two daily goals.
    if(value<amount && next.days.every((day,d)=>keepsDayTargets(goals,chosen.days[d].meals,day.meals))) {
      chosen=next; tier=level; chosenCheckout=checkout; amount=value;
    }
  }
  return Object.keys(replacements).length ? make(replacements,tier,chosenCheckout) : chosen;
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
  const parts=[];
  if(q.store) {
    const shelf=storeShelf(q.store);
    parts.push(shelf ? shelf.name+" · Яндекс Еда · "+shelf.address+" · "+shelf.checkedOn.split("-").reverse().join(".") : shopName(q.store));
    parts.push("По витрине магазина "+q.known+" из "+q.count+" поз.");
  }
  if(q.city) parts.push("Средняя по Москве — "+q.city+" поз.");
  if(q.benchmark) parts.push("Другая московская витрина — "+q.benchmark+" поз.");
  const estimated=q.count-q.known-q.benchmark-(q.city||0);
  if(estimated) parts.push("Базовая оценка «Буду это» — "+estimated+" поз.");
  return parts.join(". ")+". С учётом фасовки, без доставки.";

}
function budgetPanel(p, q=weeklyQuote(p)) {
  const s=settings(), limited=hasBudget(s), edit=button(limited?"Изменить сумму":"Задать бюджет","budget-edit","soft");
  return `<section class="budget-box"><div class="budget-heading"><div><h2>${limited?"Бюджет на неделю · "+money(s.budget):"Планируемая закупка"}</h2><p><strong>Докупить примерно на <span data-purchase-total>${money(q.cents/100)}</span></strong><span data-budget-balance>${budgetBalance(s,q)}</span></p><small data-budget-source>${budgetSource(q)}</small></div><div class="budget-actions">${edit}</div></div><div class="budget-offer" data-budget-offer hidden></div></section>`;
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
  mountBudgetOffer();
  for(const label of document.querySelectorAll(".grocery input:not(:checked)")) {
    const k=label.dataset.pantry;
    label.closest(".grocery").querySelector("[data-line-price]").textContent=shoppingPriceNote(k,remainingGrams(k,p.counts[k]),q.store);
    label.closest(".grocery").querySelector("b").textContent="Купить: "+shoppingAmount(k,remainingGrams(k,p.counts[k]),q.store);
  }
}

function budgetDialog(info) {
  return `<div class="sheet-body simple"><h2 id="sheet-title">Сколько потратим за неделю?</h2><form id="budget-form">${budgetFields(servings(settings()),info.value,"sheet")}<button class="btn primary" type="submit">Применить бюджет</button></form></div>`;
}
