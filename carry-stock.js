// Use committed recipe quantities. A carry is an explicitly confirmed opening stock
// for one dated week. Later weeks never debit or rewrite earlier shopping records.
function carrySuggestion(k){
  const dest=weekData();
  if(dest.carryFrom?.[k])return null;
  for(let off=offset-1;;off--){
    const date=plannedDate(off),saved=data.savedWeeks?.[date];
    if(!saved)return null;
    const source=data.weeks[date]||{},home=source.pantry?.[k]||0;
    const need=neededGrams(shoppingCounts(savedWeek(saved,weekProfile(off)),off)[k]||0),purchase=source.purchases?.[k];
    if(!need && !purchase && !source.cart?.[k] && !Object.hasOwn(source.pantry||{},k))continue;
    const sourceDate=weekKey(off);
    if(Object.entries(data.weeks).some(([key,w])=>key.startsWith(data.mode+"/") && w.carryFrom?.[k]===sourceDate))return null;
    const unknown=!!source.cart?.[k] && !purchase;
    const bought=purchase?.grams||0, available=Math.max(0,home+bought-need);
    return unknown || available>0 ? {off,date:sourceDate,need,home,bought,unknown,available} : null;
  }
}
// Only an increased ingredient requirement can draw on a weighed, unspent purchase.
function replacementCarry(base,next,off){
  if(base===next || !base || !next)return {};
  const sourceDate=plannedDate(off-1),snapshot=data.savedWeeks?.[sourceDate],source=data.weeks[sourceDate];
  if(!snapshot || !source?.purchases)return {};
  const dest=data.weeks[plannedDate(off)]||{},previous=savedWeek(snapshot,weekProfile(off-1));
  const out={}, changed=new Set(next.days.flatMap((d,i)=>d.meals.flatMap((m,j)=>
    m.r.id!==base.days[i].meals[j]?.r.id?m.r.items.map(([k])=>k):[])));
  const candidates=[...changed].filter(k=>source.purchases[k] && !Object.hasOwn(dest.pantry||{},k));
  if(!candidates.length)return out;
  const before=shoppingCounts(base,off),after=shoppingCounts(next,off),used=shoppingCounts(previous,off-1,null,next);
  const date=weekKey(off-1);
  for(const k of candidates){
    if((after[k]||0)<=(before[k]||0) || Object.entries(data.weeks).some(([key,w])=>
      key.startsWith(data.mode+"/") && w.carryFrom?.[k]===date))continue;
    const grams=Math.max(0,(source.pantry?.[k]||0)+source.purchases[k].grams-neededGrams(used[k]||0));
    if(grams>0)out[k]=grams;
  }
  return out;
}
function stockMeasure(k,g){
  const unit=stockUnit(k);
  if(g>=1000 && g%1000===0 && unit.unit==="г")return (g/1000).toLocaleString("ru-RU")+" кг";
  return Number((g/unit.grams).toFixed(2)).toLocaleString("ru-RU")+" "+unit.unit;
}
function carryLine(k,need){
  const offer=carrySuggestion(k);
  if(!offer)return "";
  const w=weekData(),manual=Object.hasOwn(w.pantry,k);
  const details=offer.unknown ? "Покупка отмечена без веса." :
    [offer.home && "дома "+stockMeasure(k,offer.home),offer.bought && "куплено "+stockMeasure(k,offer.bought),
      "по меню "+stockMeasure(k,offer.need)].filter(Boolean).join(" · ")+".";
  const description=manual?"Дома указано "+stockMeasure(k,w.pantry[k])+". Уточнить?":
    offer.unknown?"Сколько осталось дома?":"Могло остаться "+stockMeasure(k,offer.available);
  const attr=' data-id="'+k+'" data-week="'+weekKey()+'"';
  return '<div class="carry-line"><strong>'+description+'</strong><small>На эту неделю нужно '+stockMeasure(k,need)+'.<br>'+rangeText(offer.off)+' · '+details+'</small><div>'+
    (!manual && !offer.unknown ? '<button class="link" type="button" data-action="carry-use"'+attr+'>Учесть '+stockMeasure(k,offer.available)+'</button>' : '')+
    '<button class="link" type="button" data-action="carry-edit"'+attr+'>'+(manual?"Уточнить остаток":offer.unknown?"Уточнить количество":"Указать, сколько осталось")+'</button></div></div>';
}
function carryPanel(info){
  const {id:k,offer}=info,unit=stockUnit(k),home=weekData().pantry[k];
  const askPack=offer.unknown && home==null;
  const label=askPack?"Сколько купили за "+rangeText(offer.off):"Сколько всего есть дома к началу недели";
  return '<div class="sheet-body simple"><h2 id="sheet-title">'+$(FOOD[k][0])+' · остаток</h2><p>'+rangeText()+
    (askPack?' · В старом списке сохранилась галочка. Укажите количество продукта в купленной упаковке.':' · Укажите общий запас, включая остаток прошлой недели.')+
    '</p><form id="carry-form"><label class="field">'+label+', '+unit.unit+'<input name="quantity" type="number" inputmode="decimal" min="0" max="1000000" step="any" required value="'+
    (home==null?"":Number((home/unit.grams).toFixed(2)))+'"></label><p aria-live="polite" data-carry-preview></p>'+
    '<button type="submit" class="btn primary">Учесть на '+rangeText()+'</button></form></div>';
}
function carryAmount(info,qty){
  const g=qty*stockUnit(info.id).grams;
  const fromPack=info.offer.unknown && !Object.hasOwn(weekData().pantry,info.id);
  return Math.max(0,Math.round((fromPack?info.offer.home+g-info.offer.need:g)*100)/100);
}
function acceptCarry(k,date,source,g){
  if(date!==weekKey() || !Number.isFinite(g) || g<0 || carrySuggestion(k)?.date!==source)return false;
  const w=weekData();
  if(w.pantryBeforeCheck)delete w.pantryBeforeCheck[k];
  w.pantry[k]=g;
  (w.carryFrom||={})[k]=source;
  persist();dismissSheet();render();notify("Остаток учтён на "+rangeText());return true;
}
sheet.addEventListener("input",e=>{
  if(e.target.form?.id!=="carry-form" || openInfo?.kind!=="carry")return;
  e.target.form.querySelector("[data-carry-preview]").textContent=e.target.value && e.target.validity.valid
    ?"Будет учтено дома · "+stockMeasure(openInfo.id,carryAmount(openInfo,Number(e.target.value))):"";
});
sheet.addEventListener("submit",e=>{
  if(e.target.id!=="carry-form" || openInfo?.kind!=="carry")return;
  e.preventDefault();
  const {id,date,offer}=openInfo;
  if(e.target.reportValidity())acceptCarry(id,date,offer.date,carryAmount(openInfo,Number(e.target.elements.quantity.value)));
});
