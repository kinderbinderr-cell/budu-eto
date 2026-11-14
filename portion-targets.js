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
  return `<div class="sheet-body simple"><h2 id="sheet-title">Свои диапазоны КБЖУ</h2><p>Укажите цели на день${n===2?" для каждого человека":""}. Для одного значения достаточно поля «От». Пустой показатель можно пропустить.</p><form id="portion-form">
  ${portionFields(n,goals,true,"r")}
  <p class="form-error" role="alert"></p><button class="btn primary" type="submit">Рассчитать порции</button>
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
  settings().portionTargets=goals;useStockForPlanning(settings(),weekSeed(),weekData().pantry);persist();render();openSheet({kind:"nutrition"});
});
