// Optional individual portions for the same cooked dish.
const targetLabels=["Калории, ккал","Белки, г","Жиры, г","Углеводы, г"];
function portionCount(s) {
  return s.mode==="personal" || (s.adults===1 && !s.small) ? 1 : s.adults===2 && !s.small ? 2 : 0;
}
function personTitle(index,n) {
  return n===1 ? "Ваша порция" : ["Первая порция","Вторая порция"][index];
}
// An empty metric is unconstrained. A single value is a point target.
function dailyTargetPair(low, high) {
  const a = low === "" || low == null ? null : Number(low);
  const b = high === "" || high == null ? null : Number(high);
  return a === null && b === null ? null : [a ?? b, b ?? a];
}
function portionFields(count, values, ranges, prefix) {
  return Array.from({length:count}, (_,i) => {
    const person = personTitle(i,count);
    const inputs = targetLabels.map((label,j) => {
      const row = (ranges ? [0,1] : [0]).map(k => {
        const bound = ranges ? (k ? ", до" : ", от") : "";
        return `<input aria-label="${person}, ${label}${bound}" name="${prefix}-${i}-${j}-${k}" type="number" inputmode="decimal" min="0.1" step="any" value="${$(values?.[i]?.[j]?.[k] ?? "")}">`;
      }).join("");
      return `<span>${label}</span>${row}`;
    }).join("");
    return `<fieldset class="portion-fields"><legend>${person}</legend><div class="range-grid${ranges ? "" : " point-grid"}">${ranges ? "<span></span><small>От</small><small>До</small>" : ""}${inputs}</div></fieldset>`;
  }).join("");
}
function portionEditor() {
  const s=settings(), n=portionCount(s), goals=activePortionTargets(s);
  return `<div class="sheet-body simple"><h2 id="sheet-title">Свои диапазоны КБЖУ</h2><p>Укажите цели на день${n===2?" для каждого человека":""}. Для одного значения достаточно поля «От». Пустой показатель можно пропустить.${n===2 ? " Подберём общие блюда с отдельной порцией для каждого." : ""}</p><form id="portion-form">
  ${portionFields(n,goals,true,"r")}
  <p class="form-error" role="alert"></p><button class="btn primary" type="submit">${n===2 ? "Подобрать меню и порции" : "Рассчитать порции"}</button>
  ${goals ? button("Вернуть обычные порции","portion-off","outline") : ""}</form></div>`;
}
function portionReport(meals) {
  const goals=activePortionTargets(settings());
  return goals.map((target,i)=>{
    const actual=target.map((_,j)=>meals.reduce((sum,m)=>sum+[m.r.kcal,...m.r.macros][j]*m.personFactors[i],0));
    return `<h3>${personTitle(i,goals.length)}</h3><table class="nutritable"><thead><tr><th>За день</th><th>В меню</th><th>Ваша цель</th></tr></thead><tbody>${actual.map((x,j)=>{
      const value=Number(x.toFixed(1)).toLocaleString("ru-RU"), pair=target[j];
      let status="", goal="Без цели";
      if(pair){
        const [lo,hi]=pair;
        status=`<small>${x<lo-1e-7?"Ниже":x>hi+1e-7?"Выше":"В пределах"}</small>`;
        goal=lo===hi ? String(lo) : lo+"–"+hi;
      }
      return `<tr><th>${targetLabels[j]}</th><td>${value}${status}</td><td>${goal}</td></tr>`;
    }).join("")}</tbody></table>`;
  }).join("");
}
function individualFacts(meal) {
  const {r,personFactors:fs}=meal;
  const firstShare=Math.round(100*fs[0]/meal.f);
  return fs.map((f,i)=>`<p><strong>${personTitle(i,fs.length)}${fs.length===2 ? " · "+(i===0?firstShare:100-firstShare)+"% готового блюда" : ""}</strong><br>${Math.round(r.kcal*f)} ккал · ${r.macros.map((m,j)=>["Б","Ж","У"][j]+" "+Math.round(m*f)+" г").join(" · ")}</p>`).join("");
}
sheet.addEventListener("submit",e=>{
  if(e.target.id!=="portion-form") return;
  e.preventDefault();
  const n=portionCount(settings()), fields=new FormData(e.target);
  const goals=Array.from({length:n},(_,i)=>targetLabels.map((_,j)=>dailyTargetPair(fields.get(`r-${i}-${j}-0`), fields.get(`r-${i}-${j}-1`))));
  if(!goals.some(person=>person.some(Boolean))){
    e.target.querySelector(".form-error").textContent="Укажите хотя бы одну дневную цель.";return;
  }
  if(!activePortionTargets({...settings(),portionTargets:goals})){
    e.target.querySelector(".form-error").textContent="Проверьте диапазоны: оба числа должны быть положительными, минимум не больше максимума.";return;
  }
  protectMenus();settings().portionTargets=goals;updateSavedPortions();useStockForPlanning(settings(),weekSeed(),weekData().pantry);persist();render();openSheet({kind:"nutrition"});
});

const nutritionOffers=new WeakMap();
function dayNutritionOffer(p,d) {
  let days=nutritionOffers.get(p);
  if(!days) { days=new Map(); nutritionOffers.set(p,days); }
  if(!days.has(d)) days.set(d,suggestNutritionSwap(settings(),p,d,lastPlan?.previous || []));
  return days.get(d);
}
function nutritionSwapCard(p,d) {
  if(!(p.pairMisses[d]>0)) return "";
  const offer=dayNutritionOffer(p,d);
  if(!offer) return '<aside class="nutrition-tip"><h3>Подходящей замены пока нет</h3><p>Среди подходящих блюд не нашлось замены, которая приблизит вас к целям без ухудшения результата для другого.</p><button type="button" class="link" data-action="discover">Выбрать ещё блюда</button></aside>';
  return `<aside class="nutrition-tip"><small>${slotNames[offer.slot]} · замена по КБЖУ</small><h3>${$(offer.r.title)}</h3><p>Вместо «${$(offer.old.title)}»</p><button type="button" class="link" data-action="nutrition-swap-preview">Сравнить КБЖУ для двоих ${icon("right",15)}</button></aside>`;
}
function nutritionSwapPreview(offer) {
  const goals=activePortionTargets(settings());
  const format=n=>Number(n.toFixed(1)).toLocaleString("ru-RU");
  const titles=["Энергия, ккал","Белки, г","Жиры, г","Углеводы, г"];
  const table=goals.map((target,i)=>{
    const rows=target.map((range,j)=>{
      const before=offer.before[i][j],after=offer.after[i][j];
      const status=(v)=>!range?"":v<range[0]-1e-7?"Ниже":v>range[1]+1e-7?"Выше":"В цели";
      const cell=v=>`<td>${format(v)}<small>${status(v)}</small></td>`;
      const goal=!range?"—":range[0]===range[1]?format(range[0]):range.map(format).join("–");
      return `<tr><th scope="row">${titles[j]}</th>${cell(before)}${cell(after)}<td>${goal}</td></tr>`;
    }).join("");
    return `<table class="swap-comparison"><caption>${personTitle(i,2)} · за день</caption><thead><tr><th scope="col">Показатель</th><th scope="col">Сейчас</th><th scope="col">После</th><th scope="col">Цель</th></tr></thead><tbody>${rows}</tbody></table>`;
  }).join("");
  const bothHaveGoals=goals.every(row=>row.some(Boolean));
  const status=offer.rank[0]===0
    ? (bothHaveGoals ? "Оба попадёте в свои дневные диапазоны." : "Все заданные показатели будут в диапазоне.")
    : "Дневные итоги станут ближе к целям. Часть показателей останется вне диапазона.";
  let budgetNote="";
  if(hasBudget(settings())) {
    const current=plan();
    const adjusted=swapOne(settings(),current,{d:offer.d,slot:offer.slot,from:offer.old.id},offer.r);
    const from=weeklyQuote(current).cents, to=weeklyQuote(adjusted).cents;
    if(Math.round(from/100)!==Math.round(to/100)) budgetNote=" Закупка на неделю: примерно "+money(from/100)+" сейчас и "+money(to/100)+" после.";
  }
  return `<div class="sheet-body simple swap-preview"><p class="quiet">${dayName(offer.d)} · ${slotNames[offer.slot].toLowerCase()}</p><h2 id="sheet-title">Что изменится за день</h2><div class="swap-recipe"><img src="${photo(offer.r)}" alt=""><div><strong>${$(offer.r.title)}</strong><small>Вместо «${$(offer.old.title)}»</small></div></div><p>${status}</p>${table}<p class="quiet">${offer.liked?"Из понравившихся блюд.":"Новое для вашего меню."} Замена только на этот день. Список покупок обновится.${budgetNote}</p><div class="swap-preview-actions">${button("Применить замену","nutrition-swap-apply","primary")}${button("Оставить как есть","close","outline")}</div></div>`;
}
function confirmNutritionSwap() {
  const info=openInfo;
  if(info?.kind!=="nutrition-swap") return;
  const {offer}=info,p=plan();
  if(p!==info.plan || day!==offer.d || info.week!==weekKey() || dayNutritionOffer(p,day)!==offer) {
    dismissSheet(); render(); notify("Меню изменилось. Откройте новое сравнение."); return;
  }
  const updated=swapOne(settings(),p,{d:day,slot:offer.slot,from:offer.old.id},offer.r);
  if(!updated)return;
  protectMenus();setSavedWeek(updated);
  const record=weekData();
  record.nutritionSwaps={...record.nutritionSwaps,[day+"-"+offer.slot]:{from:offer.old.id,to:offer.r.id}};
  persist(); dismissSheet(); render(); notify("Блюдо заменено. Порции и список покупок пересчитаны.");
}
