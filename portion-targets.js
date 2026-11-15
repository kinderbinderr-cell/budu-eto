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
function editorProfile(info){
  return info.future?settings():weekProfile(info.off);
}
function portionEditor(info) {
  const s=editorProfile(info),n=portionCount(s),goals=activePortionTargets(s);
  const title=info.future?"Цели для будущих меню":"КБЖУ на "+rangeText(info.off);
  const action=info.future?"Сохранить для будущих меню":"Сравнить порции";
  const ordinary=info.future?button("Обычные порции для будущих меню","portion-off","outline")
    :'<button class="link" type="submit" name="ordinary" formnovalidate>Сравнить с обычными порциями</button>';
  return `<div class="sheet-body simple"><h2 id="sheet-title">${title}</h2><p>Укажите цели на день${n===2?" для каждого человека":""}. Можно заполнить только нужные показатели.</p><form id="portion-form">
    ${portionFields(n,goals,true,"r")}
    <p class="form-error" role="alert"></p><p class="quiet" data-goal-status role="status">${goals?"Эти цели уже действуют":"Сейчас используются обычные порции"}</p>
    <button class="btn primary" name="compare" type="submit" disabled>${action}</button> ${goals?ordinary:""}</form></div>`;
}
function goalsFromForm(form,count){
  const fields=new FormData(form);
  const goals=Array.from({length:count},(_,i)=>targetLabels.map((_,j)=>dailyTargetPair(fields.get(`r-${i}-${j}-0`),fields.get(`r-${i}-${j}-1`))));
  return goals.some(row=>row.some(Boolean))?goals:null;
}
sheet.addEventListener("input",e=>{
  if(e.target.form?.id!=="portion-form" || openInfo?.kind!=="portion-edit")return;
  const form=e.target.form,s=editorProfile(openInfo),old=activePortionTargets(s);
  const same=JSON.stringify(goalsFromForm(form,portionCount(s)))===JSON.stringify(old);
  form.elements.compare.disabled=same;
  form.querySelector("[data-goal-status]").textContent=same?(old?"Эти цели уже действуют":"Сейчас используются обычные порции"):"";
  form.querySelector(".form-error").textContent="";
});
function portionReport(meals) {
  const goals=activePortionTargets(weekProfile());
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
  const info=openInfo;
  if(info?.kind!=="portion-edit" || (!info.future && info.date!==plannedDate(info.off)))return;
  const s=editorProfile(info),goals=e.submitter?.name==="ordinary"?null:goalsFromForm(e.target,portionCount(s));
  if(goals && !activePortionTargets({...s,portionTargets:goals})){
    e.target.querySelector(".form-error").textContent="Проверьте диапазоны. Минимум должен быть не больше максимума.";return;
  }
  if(JSON.stringify(goals)===JSON.stringify(activePortionTargets(s)))return;
  if(info.future){saveFutureGoals(goals);return;}
  const off=info.off,base=plan(null,off),profile={...s,portionTargets:goals};
  openSheet({kind:"portion-preview",off,base,profile,next:resizedWeek(base,profile),date:info.date});
});

function saveFutureGoals(goals){
  protectPortionPolicies();
  if(goals)settings().portionTargets=goals;else delete settings().portionTargets;
  if(draft?.mode===data.mode){if(goals)draft.portionTargets=structuredClone(goals);else delete draft.portionTargets;}
  persist();dismissSheet();render();notify("Цели сохранены для будущих меню");
}
function portionPreview({off,base,next,profile}){
  const before=weekProfile(off),n=portionCount(profile),w=data.weeks[plannedDate(off)]||{};
  const figures=(meals,s,i)=>mealNutrients(meals,meals.map(m=>m.personFactors?.[i]??m.f/servings(s))).map(Math.round);
  const facts=a=>a[0]+" ккал · Б "+a[1]+" · Ж "+a[2]+" · У "+a[3]+" г";
  const days=next.days.map((d,j)=>'<details class="portion-day"><summary>'+dateText(dateAt(j,off),{weekday:"long",day:"numeric",month:"long"})+'</summary>'+
    Array.from({length:n},(_,i)=>'<h3>'+personTitle(i,n)+'</h3><p>Сейчас · '+facts(figures(base.days[j].meals,before,i))+'<br>После · '+facts(figures(d.meals,profile,i))+'</p>'+
      d.meals.map((m,slot)=>{const old=base.days[j].meals[slot],portion=(meal,s)=>Number((meal.personFactors?.[i]??meal.f/servings(s)).toFixed(2)).toLocaleString("ru");return '<small>'+$(m.r.title)+' · '+portion(old,before)+' → '+portion(m,profile)+' порц.</small>';}).join('<br>')).join("")+'</details>').join("");
  const beforeCounts=shoppingCounts(base,off),afterCounts=shoppingCounts(next,off,base);
  const score=budgetScorer(profile), bought=accountedPurchases(w,beforeCounts), quote=counts=>score(counts,w.pantry,bought,w.purchases);
  const first=quote(beforeCounts),last=quote(afterCounts), extra=[];
  for(const [k,g] of Object.entries(afterCounts)){
    const old=outstandingGrams(w,k,beforeCounts[k]||0),need=outstandingGrams(w,k,g);
    if(need>old)extra.push('<li>'+$(FOOD[k][0])+' · '+(old?weeklyNeed(k,old):"0")+' → '+weeklyNeed(k,need)+'</li>');
  }
  return '<div class="sheet-body simple portion-comparison"><h2 id="sheet-title">Порции на '+rangeText(off)+'</h2><p>Те же блюда, новые порции. Сравните КБЖУ каждого за день.</p>'+days+prepComparison(base,next,off)+
    '<h3>Корзина ≈ '+money(first.cents/100)+' → ≈ '+money(last.cents/100)+'</h3><p>Учтены остатки дома и покупки.</p>'+
    (extra.length?'<details><summary>Понадобится докупить больше · '+extra.length+'</summary><ul>'+extra.join("")+'</ul></details>':'<p>Дополнительных продуктов не потребуется.</p>')+
    button("Обновить порции на "+rangeText(off),"portion-apply","primary")+button("Оставить как есть","close","outline")+'</div>';
}
function confirmWeekPortions(){
  const info=openInfo;
  if(info?.kind!=="portion-preview" || info.date!==plannedDate(info.off) || plan(null,info.off)!==info.base)return;
  (data.portionPolicies||={})[info.date]=portionPolicy(info.profile);
  setSavedWeek(info.next,info.off);
  persist();dismissSheet();render();notify("Порции обновлены на "+rangeText(info.off));
}

const nutritionOffers=new WeakMap();
function dayNutritionOffer(p,d) {
  let days=nutritionOffers.get(p);
  if(!days) { days=new Map(); nutritionOffers.set(p,days); }
  if(!days.has(d)) days.set(d,suggestNutritionSwap(weekProfile(),p,d,lastPlan?.previous || []));
  return days.get(d);
}
function nutritionSwapCard(p,d) {
  if(!(p.pairMisses[d]>0)) return "";
  const offer=dayNutritionOffer(p,d);
  if(!offer) return '<aside class="nutrition-tip"><h3>Подходящей замены пока нет</h3><p>Среди подходящих блюд не нашлось замены, которая приблизит вас к целям без ухудшения результата для другого.</p><button type="button" class="link" data-action="discover">Выбрать ещё блюда</button></aside>';
  return `<aside class="nutrition-tip"><small>${slotNames[offer.slot]} · замена по КБЖУ</small><h3>${$(offer.r.title)}</h3><p>Вместо «${$(offer.old.title)}»</p><button type="button" class="link" data-action="nutrition-swap-preview">Сравнить КБЖУ для двоих ${icon("right",15)}</button></aside>`;
}
function nutritionSwapPreview(offer) {
  const goals=activePortionTargets(weekProfile());
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
    const adjusted=swapOne(weekProfile(),current,{d:offer.d,slot:offer.slot,from:offer.old.id},offer.r);
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
  const updated=swapOne(weekProfile(),p,{d:day,slot:offer.slot,from:offer.old.id},offer.r);
  if(!updated)return;
  protectMenus();setSavedWeek(updated);
  const record=weekData();
  record.nutritionSwaps={...record.nutritionSwaps,[day+"-"+offer.slot]:{from:offer.old.id,to:offer.r.id}};
  persist(); dismissSheet(); render(); notify("Блюдо заменено. Порции и список покупок пересчитаны.");
}
