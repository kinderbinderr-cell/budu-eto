// Apply one acknowledged substitution to a copy. All consumers of the plan then see the same portions.
function budgetMealEdit(s,week,edit,previous,recipes,goals) {
  const {d,slot,from,to}=edit, day=week.days[d], r=recipes.get(to);
  if(!day || day.meals[slot]?.r.id!==from || !r || !eligible(s,r) ||
     !fitsNutritionSwap(s,week,d,slot,r,previous)) return null;
  const meals=day.meals.map((m,i)=>i===slot ? {...m,r,f:factor(s,r,i),manual:true} : {...m});
  applyDailyTargets(s,meals);
  if(!keepsDayTargets(goals,day.meals,meals)) return null;
  const days=week.days.slice(),counts={...week.counts},macros=week.macros.slice(),pairMisses=week.pairMisses.slice();
  days[d]={...day,meals};
  for(const [i,m] of meals.entries()) {
    const old=day.meals[i];
    if(m.r===old.r && m.f===old.f) continue;
    for(const [k,g] of old.r.items) counts[k]-=g*old.f;
    for(const [k,g] of m.r.items) counts[k]=(counts[k]||0)+g*m.f;
  }
  for(const k of Object.keys(counts)) if(counts[k]<1e-7) delete counts[k];
  macros[d]=mealNutrients(meals,meals.map(m=>m.f)).slice(1);
  if(goals?.length===2) pairMisses[d]=Math.max(...swapDayScore(swapDayTotals(meals,goals),goals).map(x=>x.worst));
  return {...week,days,counts,macros,pairMisses};
}
function withBudgetEdits(s,week,edits,prior,previous) {
  if(!week || !edits?.length) return week;
  const recipes=new Map(RECIPES.map(r=>[r.id,r])), goals=activePortionTargets(s);
  let updated=week;
  for(const edit of edits) updated=budgetMealEdit(s,updated,edit,previous,recipes,goals) || updated;
  if(updated===week) return week;
  let cost=0;const ids=new Set();
  for(const day of updated.days) for(const {r,f} of day.meals){cost+=r.cost*f;ids.add(r.id);}
  return {...updated,cost:Math.round(cost),newCount:[...ids].filter(id=>!prior?.has(id)).length};
}

// Try singles and repeated servings together: changing only one may leave the same pack in the basket.
function* findBudgetOffer(s,base,pantry,previous) {
  const recipes=new Map(RECIPES.map(r=>[r.id,r])), goals=activePortionTargets(s);
  const pool=RECIPES.filter(r=>eligible(s,r)), score=budgetScorer(s), target=s.budget*100;
  const before=score(base.counts,pantry), choices=new Map(), edits=[];
  let week=base, after=before;
  while(after.cents>target) {
    let best=null;
    function consider(next,changes) {
      const quote=score(next.counts,pantry);
      if(quote.cents>=after.cents) return;
      const fits=quote.cents<=target, otherFits=best && best.quote.cents<=target;
      if(!best || (fits && !otherFits) || (fits===otherFits &&
          (fits ? changes.length<best.changes.length || (changes.length===best.changes.length && quote.cents<best.quote.cents)
                : quote.cents<best.quote.cents || (quote.cents===best.quote.cents && changes.length<best.changes.length))))
        best={week:next,changes,quote};
    }
    const groups=new Map();
    for(const [d,day] of week.days.entries()) for(const [slot,m] of day.meals.entries()) {
      if(m.manual) continue;
      const key=m.r.id+'/'+slot;
      if(!groups.has(key)) groups.set(key,[]);
      groups.get(key).push({d,slot,from:m.r.id});
    }
    for(const [key,cells] of groups) {
      const {from,slot}=cells[0],source=recipes.get(from);
      if(!choices.has(key)) {
        const suitable=pool.filter(r=>r!==source && r.slot===source.slot && (!slot || fitsMainSlot(r,slot)));
        const close=similarOptions(source,suitable,s.votes).slice(0,6).map(x=>x.r);
        const ranked=suitable.sort((a,b)=>Number(s.votes[b.id]===1)-Number(s.votes[a.id]===1) || a.cost-b.cost);
        choices.set(key,[...new Set([...close,...ranked.slice(0,s.strictTaste?30:8)])]);
      }
      for(const r of choices.get(key)) {
        let combined=week;const changes=[];
        for(const cell of cells) {
          const edit={...cell,to:r.id};
          const single=budgetMealEdit(s,week,edit,previous,recipes,goals);
          if(!single) continue;
          consider(single,[edit]);
          const next=changes.length ? budgetMealEdit(s,combined,edit,previous,recipes,goals) : single;
          if(next) {combined=next;changes.push(edit);if(changes.length>1) consider(combined,[...changes]);}
        }
        yield;
      }
    }
    if(!best) break;
    week=best.week;edits.push(...best.changes);after=best.quote;
  }
  return {before,after,edits,limit:target};
}

let budgetSuggestion=null;
function budgetOfferKey(p,q) {
  const s=settings();
  return JSON.stringify([data.mode,weekKey(),s.budget,s.stores,weekData().pantry,q,
    [...priceBook].filter(([key])=>s.stores?.includes(key.split('/')[0])).map(([key,row])=>[key,row,Boolean(row.snapshot && Date.now()-row.checkedAt>=86400000)])]);
}
function budgetOfferHtml(offer) {
  if(!offer.edits.length) return '<p>Среди проверенных вариантов дешевле не нашлось. Можно отметить больше блюд или изменить бюджет.</p>';
  const amounts=[['Сейчас',offer.before],['После замен',offer.after]].map(([label,q])=>'<div><small>'+label+'</small><strong>≈ '+money(q.cents/100)+'</strong>'+(q.store?'<small>'+$(shopName(q.store))+'</small>':'')+'<small>'+q.known+' по магазину · '+(q.count-q.known)+' по оценке</small></div>').join('');
  const gap=offer.after.cents-offer.limit;
  const details=offer.edits.slice().sort((a,b)=>a.d-b.d||a.slot-b.slot).map(e=>'<li><small>'+DAYS[e.d]+' · '+slotNames[e.slot]+'</small><span>'+$(byId(e.from).title)+' <span aria-label="заменить на">→</span> <b>'+$(byId(e.to).title)+'</b></span></li>').join('');
  return '<div class="offer-prices">'+amounts+'</div><p><b>Экономия ≈ '+rubles((offer.before.cents-offer.after.cents)/100)+'</b> · '+(gap>0?'останется сверх бюджета ≈ '+rubles(gap/100):'в пределах вашего бюджета')+'</p><ul>'+details+'</ul><div class="budget-actions">'+button('Применить '+(offer.edits.length===1?'замену':'замены'),'budget-apply','primary')+button('Оставить меню','budget-keep','soft')+'</div>';
}
function mountBudgetOffer() {
  const host=document.querySelector('[data-budget-offer]');
  if(!host) return;
  const p=plan(),s=settings(),q=weeklyQuote(p);
  if(!hasBudget(s) || q.cents<=s.budget*100){budgetSuggestion=null;host.hidden=true;return;}
  host.hidden=false;
  const key=budgetOfferKey(p,q);
  if(!budgetSuggestion || budgetSuggestion.p!==p || budgetSuggestion.key!==key) {
    const entry=budgetSuggestion={p,key,offer:null,kept:false};
    const search=findBudgetOffer(s,p,{...weekData().pantry},lastPlan?.previous||[]);
    const advance=()=>{
      if(budgetSuggestion!==entry || !document.querySelector('[data-budget-offer]')) { if(budgetSuggestion===entry) budgetSuggestion=null; return; }
      const start=performance.now();
      do {
        const part=search.next();
        if(part.done){entry.offer=part.value;mountBudgetOffer();return;}
      } while(performance.now()-start<12);
      setTimeout(advance,0);
    };
    setTimeout(advance,0);
  }
  const entry=budgetSuggestion;
  const state=entry.kept?'kept':entry.offer?'ready':'pending';
  if(host.budgetEntry===entry && host.dataset.state===state) return;
  host.budgetEntry=entry;host.dataset.state=state;
  if(entry.kept){host.innerHTML=button('Посмотреть предложение','budget-review','soft');return;}
  host.innerHTML='<h3>Как снизить стоимость недели</h3>'+(entry.offer?budgetOfferHtml(entry.offer):'<p role="status">Сравниваем варианты по стоимости всей корзины…</p>');
}
function applyBudgetOffer() {
  const entry=budgetSuggestion,offer=entry?.offer,p=plan();
  if(!offer?.edits.length || entry.kept || p!==entry.p || entry.key!==budgetOfferKey(p,weeklyQuote(p))) {
    mountBudgetOffer();notify('Цены или меню изменились. Проверьте новое предложение.');return;
  }
  const updated=withBudgetEdits(settings(),p,offer.edits,null,lastPlan.previous);
  const q=weeklyQuote(updated);
  if(!offer.edits.every(e=>updated.days[e.d].meals[e.slot].r.id===e.to) || q.cents!==offer.after.cents || q.store!==offer.after.store) {
    budgetSuggestion=null;mountBudgetOffer();notify('Обновили расчёт. Проверьте сумму ещё раз.');return;
  }
  const record=weekData();
  record.budgetEdits=[...(record.budgetEdits||[]),...offer.edits];
  persist();render();notify('Замены применены. Список продуктов обновлён.');
}
