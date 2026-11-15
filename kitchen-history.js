// A checked cooking day already stores every batch, quantity and intended serving.
// Use those recorded quantities even if a later menu no longer contains the recipe.
const cookingMarkCache=new Map();
function readCookingMark(signature){
  if(!signature)return null;
  if(cookingMarkCache.has(signature))return cookingMarkCache.get(signature);
  let rows=null;
  try{
    const parsed=JSON.parse(signature);
    if(Array.isArray(parsed) && parsed.length===5 && parsed.slice(2).every(Array.isArray)){
      const valid=row=>Array.isArray(row) && row.length>=8 && byId(row[0]) &&
        Number.isInteger(row[1]) && Number.isInteger(row[2]) && Number.isInteger(row[3]) &&
        row[3]>=0 && row[3]<=3 && ["fresh","today","overnight","fridge","freeze"].includes(row[4]) &&
        Number.isFinite(row[5]) && row[5]>0 && Number.isFinite(row[6]) && row[6]>0 &&
        (row[7]==null || Array.isArray(row[7]) && row[7].every(Number.isFinite)) &&
        (row[8]==null || Number.isInteger(row[8]) && row[8]>=0 && row[8]<=row[5]);
      if(parsed.slice(2).every(list=>list.every(valid)))rows=parsed;
    }
  }catch{}
  if(cookingMarkCache.size>192)cookingMarkCache.clear();
  cookingMarkCache.set(signature,rows);
  return rows;
}
function kitchenBoundary(off,base,next){
  const record=data.weeks[plannedDate(off)]||{}, slots={...record.prepSlots};
  if(!base || base===next)return slots;
  const days=kitchenCookDays(weekProfile(off-1));
  for(const [d,day] of next.days.entries())for(const [slot,m] of day.meals.entries()){
    const key=d+"-"+slot, old=base.days[d].meals[slot];
    if(Object.hasOwn(slots,key) || old?.r.id===m.r.id && old.f===m.f)continue;
    const timing=old && prepTiming(old.r,d+7,days,slot);
    if(timing && timing.cook<7){
      const fixed=record.incomingPrep?.[key];
      const quantities=fixed?.id===old.r.id?fixed:old;
      slots[key]={id:old.r.id,cook:timing.cook-7,storage:timing.storage,f:quantities.f,
        ...(quantities.personFactors && {personFactors:quantities.personFactors})};
    }else if(prepTiming(m.r,d+7,days,slot).cook<7)slots[key]=false;
  }
  return slots;
}
function kitchenHistory(off,current,next){
  const cells=new Map(), days=new Map();
  for(let delta=-1;delta<=1;delta++){
    const record=data.weeks[plannedDate(off+delta)];
    const marks=record?.prepDone || (delta===-1 && data.weeks[plannedDate(off)]?.openingCooked) || {};
    for(const [index,signature] of Object.entries(marks)){
      const mark=readCookingMark(signature);
      if(!mark)continue;
      const date=Number(index)+7*delta;
      const decode=([id,cook,serve,slot,storage,people,f,personFactors,storedHalves])=>{
        serve+=7*delta;cook+=7*delta;
        const meal=(serve<7?current:next)?.days[(serve+7)%7]?.meals[slot];
        let r=meal?.r;
        if(r?.id!==id){
          const dated=plannedDate(off+Math.floor(serve/7));
          const archived=data.weeks[dated]?.preparedFacts?.[id] || data.savedWeeks?.[dated]?.facts?.[id];
          r={...(settings().startDate?byId(id):originalMenuPlanner.byId(id)||byId(id)),...archived};
        }
        return {r,cook,serve,slot,storage,people,f,personFactors,halfPeople:storedHalves??Math.min(people,Number(mark[1])||0),
          sweetMoment:meal?.r.id===id?meal.sweetMoment:undefined,completed:true};
      };
      const cook=mark[2].map(decode);
      days.set(date,{cook,thaw:mark[3].map(decode),serve:mark[4].map(decode)});
      for(const u of cook){
        const key=u.serve+"/"+u.slot;
        if(!cells.has(key))cells.set(key,[]);
        cells.get(key).push(u);
      }
    }
  }
  return {cells,days};
}
function addKitchenBatch(tasks,use){
  let batch=tasks.cook.get(use.r.id);
  if(!batch){batch={r:use.r,uses:[],factor:0,portions:0};tasks.cook.set(use.r.id,batch);}
  batch.uses.push(use);batch.factor+=use.f;batch.portions+=use.people;
}
const prepQuantity=f=>Number(f.toFixed(2)).toLocaleString("ru-RU")+" порц.";
function preparedChanges(week,off=offset){
  return kitchenWeek(weekProfile(off),week,kitchenNextWeek(off),off).flatMap((task,d)=>
    task.changes.map(change=>({...change,d})));
}
function prepChangeText(c){
  if(c.kind==="left" && !c.completed)return $(c.r.title)+" · по плану останется "+prepQuantity(c.f);
  if(c.kind==="left")return $(c.r.title)+" · "+prepQuantity(c.f)+(c.storage==="freeze"?" останется в морозилке":" останется готовым");
  return $(c.r.title)+" · "+(c.completed?"готово ":"по плану заготовлено ")+prepQuantity(c.available)+" · доготовить "+prepQuantity(c.f);
}
function prepComparison(base,next,off=offset){
  const before=new Set(preparedChanges(base,off).map(c=>JSON.stringify([c.d,c.slot,c.r.id,c.kind,c.f,c.available])));
  const changes=preparedChanges(next,off).filter(c=>!before.has(JSON.stringify([c.d,c.slot,c.r.id,c.kind,c.f,c.available])));
  const carry=replacementCarry(base,next,off), beforeQuote=weeklyQuote(base), afterQuote=weeklyQuote(next);
  const balance=(beforeQuote.pickedCents || afterQuote.pickedCents)?'<p>Осталось докупить ≈ '+money((beforeQuote.cents-(beforeQuote.pickedCents||0))/100)+' → '+money((afterQuote.cents-(afterQuote.pickedCents||0))/100)+'</p>':'';
  const stock=Object.entries(carry).map(([k,g])=>'<li>'+$(FOOD[k][0])+' · из остатка '+stockMeasure(k,g)+'</li>').join("");
  return balance+menuCarryPreview(base,next,off)+(stock?'<ul>'+stock+'</ul>':'')+(changes.length?'<ul>'+changes.map(c=>'<li>'+dateText(dateAt(c.d,off),{day:"numeric",month:"short"})+' · '+prepChangeText(c)+'</li>').join("")+'</ul>':"");
}
