// Only committed dates are protected. The following week requested by the kitchen
// forecast is a read-only preview until that period is actually opened.
const decodedWeeks=new WeakMap(), visitedWeeks=new Set();
function fullWeekSnapshot(week) {
  const facts=Object.fromEntries(week.days.flatMap(d=>d.meals.map(({r})=>[r.id,recipeCopyFacts(r)])));
  return {...packMenuWeek(week),facts};
}
function plannedDate(off=offset){return data.mode+"/"+weekKey(off);}
function savedWeek(snapshot,s) {
  if(!decodedWeeks.has(snapshot)) decodedWeeks.set(snapshot,unpackMenuWeek(snapshot,s));
  return decodedWeeks.get(snapshot);
}
function protectMenus() {
  if(!data.quizDone) return;
  const s=settings(), prefix=data.mode+"/", offsets=new Set();
  const addPeriod=n=>{const start=Math.floor(n/3)*3;for(let i=0;i<3;i++)offsets.add(start+i);};
  addPeriod(0);addPeriod(offset);addPeriod(openingWeek(s));
  const dates=[...Object.keys(data.weeks),...visitedWeeks,...Object.keys(data.menuCopies?.[data.mode]?.plans||{}).map(date=>prefix+date)];
  for(const id of dates){
    if(!id.startsWith(prefix))continue;
    const n=copyDistance(startDate(s),copyDate(id.slice(prefix.length)))/7;
    if(Number.isInteger(n))offsets.add(n);
  }
  const saved=data.savedWeeks||{}, additions={};
  for(const n of [...offsets].sort((a,b)=>a-b)){
    const id=plannedDate(n);
    if(saved[id])continue;
    const week=plan(null,n);
    if(week) additions[id]=fullWeekSnapshot(week);
  }
  if(!s.startDate && !Number.isInteger(s.tasteAnchor))s.backupAnchor??=localDayKey(startDate(s));
  Object.assign(data.savedWeeks||={},additions);
  // Kitchen reminders for the last Sunday can involve meals in the following week.
  // Keep that forecast independently so liking a dish cannot invalidate a checked cooking day.
  let addedForecast=false;
  for(const n of offsets){
    const id=plannedDate(n+1);
    if(data.savedWeeks[id] || data.prepForecasts?.[id])continue;
    const next=plan(null,n+1);
    if(next){(data.prepForecasts||={})[id]=fullWeekSnapshot(next);addedForecast=true;}
  }
  return addedForecast || Object.keys(additions).length>0;
}
function setSavedWeek(week,off=offset) {
  const record=data.weeks[plannedDate(off)],base=data.savedWeeks[plannedDate(off)];
  if(base && record?.cart){
    const bought=accountedPurchases(record,base.counts);
    if(Object.keys(bought).length)record.paidStock=bought;
  }
  const prior=new Set();
  for(let i=1;i<=week.phase;i++){
    const previous=data.savedWeeks[plannedDate(off-i)];
    if(previous)for(const d of previous.days)for(const m of d.meals)prior.add(m.r);
  }
  const unique=new Set(week.days.flatMap(d=>d.meals.map(m=>m.r.id)));
  week={...week,newCount:[...unique].filter(id=>!prior.has(id)).length};
  const snap=fullWeekSnapshot(week);
  data.savedWeeks[plannedDate(off)]=snap;
  decodedWeeks.set(snap,week);
  lastPlan=null;adjacentPlan=null;
}
const portionFieldsToSave=["adults","small","targetMode","target","plainPortion","weight","height","age","sex","activity","ratio","portionTargets"];
function portionPolicy(s){
  return Object.fromEntries(portionFieldsToSave.map(k=>[k,structuredClone(s[k]??null)]));
}
function weekProfile(off=offset){
  return {...settings(),...data.portionPolicies?.[plannedDate(off)]};
}
function protectPortionPolicies(){
  protectMenus();
  const policy=portionPolicy(settings()), policies=data.portionPolicies||={};
  for(const key of Object.keys(data.savedWeeks||{}))
    if(key.startsWith(data.mode+"/"))policies[key]??=policy;
}
function spendingProfile(){
  const limit=weekData().budgetLimit;
  const s=weekProfile();
  return budgetRange(limit)?{...s,budget:limit,budgetChosen:true}:s;
}
// Only the selected meal may change portion size. Solve each person's one free
// portion against the rest of their already fixed day.
function replacementMeal(s,meals,slot,r) {
  const old=meals[slot], goals=activePortionTargets(s);
  const m={...old,r,manual:true,f:factor(s,r,slot)};
  if(!goals)return m;
  const nutrients=[r.kcal,...r.macros];
  m.personFactors=goals.map((goal,i)=>{
    const other=meals.filter((_,j)=>j!==slot);
    const rest=mealNutrients(other,other.map(x=>x.personFactors[i]));
    const original=old.personFactors[i];
    const candidates=new Set([original,.4,2.5]);
    for(const [j,bounds] of goal.entries()) if(bounds && nutrients[j]>0)
      for(const limit of bounds)candidates.add(Math.max(.4,Math.min(2.5,(limit-rest[j])/nutrients[j])));
    const rank=f=>{
      const gaps=goal.map((bounds,j)=>bounds?nutrientGap(rest[j]+nutrients[j]*f,bounds):0);
      return [gaps.reduce((a,b)=>a+b,0),Math.max(...gaps),Math.abs(f-original)];
    };
    return [...candidates].sort((a,b)=>{
      const x=rank(a),y=rank(b);
      for(let j=0;j<x.length;j++)if(Math.abs(x[j]-y[j])>1e-8)return x[j]-y[j];
      return 0;
    })[0];
  });
  m.f=m.personFactors.reduce((a,b)=>a+b,0);
  return m;
}
function changeDayMeals(s,week,d,meals) {
  const original=week.days[d].meals;
  const days=week.days.slice(),counts={...week.counts},macros=week.macros.slice(),pairMisses=week.pairMisses.slice();
  const adjust=(m,sign)=>{for(const [k,g] of m.r.items)counts[k]=(counts[k]||0)+sign*g*m.f;};
  for(let i=0;i<Math.max(original.length,meals.length);i++){
    const old=original[i],next=meals[i];
    if(old?.r===next?.r && old?.f===next?.f)continue;
    if(old)adjust(old,-1);
    if(next)adjust(next,1);
  }
  for(const k of Object.keys(counts))if(counts[k]<1e-7)delete counts[k];
  days[d]={...week.days[d],meals};
  macros[d]=mealNutrients(meals,meals.map(m=>m.f)).slice(1);
  const goals=activePortionTargets(s);
  if(goals?.length===2)pairMisses[d]=Math.max(...swapDayScore(swapDayTotals(meals,goals),goals).map(x=>x.worst));
  const cost=Math.round(days.reduce((sum,x)=>sum+x.meals.reduce((n,m)=>n+m.r.cost*m.f,0),0));
  return {...week,days,macros,counts,pairMisses,cost};
}
function swapOne(s,week,e,r) {
  const meals=week.days[e.d]?.meals.slice();
  if(!meals || meals[e.slot]?.r.id!==e.from || !r || r.id===e.from)return null;
  meals[e.slot]=replacementMeal(s,meals,e.slot,r);
  return changeDayMeals(s,week,e.d,meals);
}

function visitSavedWeeks(fn) {
  const prefix=data.mode+"/";
  for(const [key,snap] of Object.entries(data.savedWeeks||{})){
    if(!key.startsWith(prefix))continue;
    const n=copyDistance(startDate(settings()),copyDate(key.slice(prefix.length)))/7;
    if(!Number.isInteger(n))continue;
    const week=savedWeek(snap,settings()),next=fn(week,n);
    if(next!==week)setSavedWeek(next,n);
  }
}
function resizedWeek(week,s) {
    let result=week;
    for(const [d,day] of week.days.entries()){
      const meals=day.meals.map(({personFactors,...m},slot)=>({...m,f:slot===3?servings(s)*dessertPortion:factor(s,m.r,slot)}));
      applyDailyTargets(s,meals);
      result=changeDayMeals(s,result,d,meals);
    }
    if(activePortionTargets(s)?.length!==2)result.pairMisses=[];
    return result;
}
function editDessert(s,p,d,id,moment){
  const old=p.days[d].meals[3];
  if(!old && !id || old?.r.id===id && old.sweetMoment===moment)return p;
  const meals=p.days[d].meals.slice(0,3),goals=activePortionTargets(s);
  if(id)meals.push({r:byId(id),sourceSlot:3,manual:true,f:servings(s)*dessertPortion,
    ...(goals && {personFactors:goals.map(()=>dessertPortion)}),sweetMoment:moment});
  return changeDayMeals(s,p,d,meals);
}
function updateSavedDesserts(){
  const choices=sweetLikes(settings());
  visitSavedWeeks((week,n)=>{
    const s=weekProfile(n);
    let next=week,base=week;
    for(let d=0;d<7;d++)base=editDessert(s,base,d,null);
    const schedule=sweetFrequency(s.dessertPrefs) && choices.length?sweetSchedule(s,weekSeed(n),base,choices):{};
    const edits=data.weeks[plannedDate(n)]?.desserts||{};
    for(let d=0;d<7;d++){
      const edit=edits[d],id=edit===undefined || edit?.auto?schedule[d]:edit?.id||edit;
      next=editDessert(s,next,d,id,sweetMoment(edit?.moment??s.dessertPrefs.moment));
    }
    return next;
  });
}
