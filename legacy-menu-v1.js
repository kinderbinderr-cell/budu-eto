// Compatibility with menus created by release a121c18. Keep this algorithm versioned:
// the old app persisted choices and edits, not seven days of recipe IDs.
const originalMenuPlanner = ((catalogue, availableDesserts) => {
const RECIPES=catalogue.map(r=>{
  if(!Object.hasOwn(reviewedMains,r.id)) return r;
  const original={...r,slot:"b",mealRole:"breakfast"};
  delete original.kind;
  return original;
});
const byId=id=>RECIPES.find(r=>r.id===id);
function servings(s) {
  return s.mode === "personal" ? 1 : s.adults + s.small * 0.5;
}
function allowed(s, r) {
  const types = {
    all: ["vegan", "veget", "pesc", "meat"],
    veget: ["veget", "vegan"],
    pesc: ["pesc", "veget", "vegan"],
    vegan: ["vegan"],
  };
  return (
    types[s.diet].includes(r.diet) &&
    (!s.maxMinutes || r.minutes <= s.maxMinutes) &&
    (r.equip === "cold" || s.equipment.includes(r.equip)) &&
    (!r.alsoHob || s.equipment.includes("hob")) &&
    !r.items.some(
      ([key]) => FOOD[key].slice(5).flat().some(a => s.exclude.includes(a)) || s.exclude.includes(key),
    )
  );
}
function energy(s) {
  return s.targetMode === "own"
    ? s.target
    : Math.round(
        ((10 * s.weight +
          6.25 * s.height -
          5 * s.age +
          (s.sex === "male" ? 5 : -161)) *
          s.activity) /
          10,
      ) * 10;
}
function macroGoal(s) {
  const pct = s.ratio === "protein" ? [0.25, 0.3, 0.45] : [0.2, 0.3, 0.5];
  return pct.map((v, i) => Math.round((energy(s) * v) / (i === 1 ? 9 : 4)));
}
// Daily targets are supplied by the diner. Legacy and ordinary plans do not enable this option.
function activePortionTargets(s) {
  const n = s.mode === "personal" || (s.adults === 1 && !s.small) ? 1 : s.small === 0 && s.adults === 2 ? 2 : 0;
  const rows = s.portionTargets;
  if (!n || !Array.isArray(rows) || rows.length !== n) return null;
  const valid = rows.every(person => Array.isArray(person) && person.length === 4 &&
    person.every(pair => pair === null || (Array.isArray(pair) && pair.length === 2 &&
      pair.every(x => Number.isFinite(x) && x > 0) && pair[0] <= pair[1])));
  return valid && rows.some(person => person.some(Boolean)) ? rows : null;
}
// Each daily target bounds a linear combination of the three meal sizes.
function feasiblePortions(vectors,target,base) {
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const bands=vectors.map((_,i)=>({normal:[0,1,2].map(j=>Number(i===j)),lo:.4,hi:2.5}));
  for(const [j,pair] of target.entries()) {
    if(!pair) continue;
    const [lo,hi]=pair;
    const normal=vectors.map(v=>v[j]), length=Math.hypot(...normal);
    if(!length) return null;
    bands.push({normal:normal.map(x=>x/length),lo:lo/length,hi:hi/length});
  }
  const inside=x=>bands.every(({normal,lo,hi})=>{const y=dot(normal,x);return y>=lo-1e-9 && y<=hi+1e-9;});
  if(inside(base)) return base;
  // A nonempty bounded intersection has a vertex at three independent boundary planes.
  let closest=null, distance=Infinity;
  for(let i=0;i<bands.length;i++) for(let j=0;j<i;j++) for(let k=0;k<j;k++){
    const a=bands[i], b=bands[j], c=bands[k];
    const bc=cross(b.normal,c.normal), ca=cross(c.normal,a.normal), ab=cross(a.normal,b.normal);
    const det=dot(a.normal,bc);
    if(Math.abs(det)<1e-12)continue;
    for(const x of [a.lo,a.hi])for(const y of [b.lo,b.hi])for(const z of [c.lo,c.hi]){
      const v=bc.map((n,h)=>(x*n+y*ca[h]+z*ab[h])/det);
      const d=v.reduce((sum,n,h)=>sum+(n-base[h])**2,0);
      if(d<distance && inside(v)){distance=d;closest=v;}
    }
  }
  if(!closest)return null;
  // Move toward ordinary serving sizes while staying inside every requested range.
  let t=1;
  for(const {normal,lo,hi} of bands){
    const start=dot(normal,closest),delta=dot(normal,base)-start;
    if(delta>0)t=Math.min(t,(hi-start)/delta);
    if(delta<0)t=Math.min(t,(lo-start)/delta);
  }
  return closest.map((v,h)=>v+Math.max(0,t)*(base[h]-v));
}
function fitDailyPortions(meals,target) {
  if (meals[3]) {
    const row = remainingDessertTargets(target, meals[3].r);
    return [...fitDailyPortions(meals.slice(0,3), row), dessertPortion];
  }
  if(!target.some(Boolean)) return meals.map(()=>1);
  const vectors=meals.map(({r})=>[r.kcal,...r.macros]);
  const mid=target.map(pair=>pair ? (pair[0]+pair[1])/2 : null);
  const base=vectors.map((v,i)=>mid[0]===null ? 1 : Math.max(.4,Math.min(2.5,mid[0]*[.28,.36,.36][i]/v[0])));
  const feasible=feasiblePortions(vectors,target,base);
  if(feasible) return feasible;
  const factors=base.slice();
  function loss() {
    let sum=0;
    for(let j=0;j<4;j++){
      if(!target[j]) continue;
      const x=vectors.reduce((total,v,i)=>total+v[j]*factors[i],0);
      const gap=Math.max(0,target[j][0]-x,x-target[j][1])/mid[j];
      sum+=gap*gap;
    }
    return sum + factors.reduce((a,f,i)=>a+.0001*(f-base[i])**2,0);
  }
  // Coordinate search over 0.4 to 2.5 standard portions, refined to 0.01 servings.
  for (const step of [.25,.05,.01]) {
    for(let pass=0;pass<12;pass++){
      let changed=false;
      for(let i=0;i<3;i++){
        const old=factors[i]; let best=old, score=loss();
        for(const direction of [-1,1]){
          for(let x=old+step*direction; x>=.4 && x<=2.5; x+=step*direction){
            factors[i]=x;const candidate=loss();
            if(candidate>=score) break;
            best=x;score=candidate;
          }
        }
        factors[i]=best;changed ||= best!==old;
      }
      if(!changed)break;
    }
  }
  return factors;
}
function applyDailyTargets(s,meals) {
  const targets=activePortionTargets(s);
  if (!targets) {
    if (meals[3] && s.mode === "personal" && !s.plainPortion) {
      const daily = energy(s);
      const remaining = Math.max(0, daily - meals[3].r.kcal * meals[3].f) / daily;
      meals.slice(0, 3).forEach((m, slot) => { m.f = factor(s, m.r, slot) * remaining; });
    }
    return;
  }
  const portionsByPerson=targets.map(t=>fitDailyPortions(meals,t));
  meals.forEach((meal,i)=>{
    meal.personFactors=portionsByPerson.map(person=>person[i]);
    meal.f=meal.personFactors.reduce((sum,f)=>sum+f,0);
  });
}
// Lower bounds for the relative miss: even independently scaled portions must
// lie within these nutrient and nutrient-ratio intervals. Zero means "worth solving".
function pairPortionSearch(targets) {
  const cache = new Map();
  const features = new Map();
  const dimensions = [];
  for (const target of targets) {
    for (const [i, range] of target.entries()) {
      if (!range) continue;
      dimensions.push({i, j:null, range});
      for (let j=0; j<i; j++) {
        if (target[j]) dimensions.push({i,j,range:[range[0]/target[j][1],range[1]/target[j][0]]});
      }
    }
  }
  function values(r) {
    if (!features.has(r)) {
      const v=[r.kcal,...r.macros];
      features.set(r,dimensions.map(({i,j})=>j===null?v[i]:v[i]/v[j]));
    }
    return features.get(r);
  }
  function lowerBound(a,b,c,cutoff) {
    let worst=0;
    for (let k=0; k<dimensions.length; k++) {
      const {j,range:[lo,hi]}=dimensions[k];
      const min = j===null ? 0.4*(a[k]+b[k]+c[k]) : Math.min(a[k],b[k],c[k]);
      const max=j===null?2.5*(a[k]+b[k]+c[k]):Math.max(a[k],b[k],c[k]);
      const gap=j===null ? Math.max((lo-max)/lo,(min-hi)/hi,0)
        : Math.max((lo-max)/(lo+max),(min-hi)/(min+hi),0);
      worst=Math.max(worst,gap);
      if(worst>cutoff) break;
    }
    return worst;
  }
  function assess(recipes) {
    const key=recipes.map(r=>r.id).join("/");
    if (cache.has(key)) return cache.get(key);
    const meals=recipes.map(r=>({r}));
    const portions=targets.map(row=>fitDailyPortions(meals,row));
    let worst=0,sum=0;
    for(const [i,row] of targets.entries()) {
      const actual=mealNutrients(meals,portions[i]);
      for(const [j,range] of row.entries()) {
        if(!range) continue;
        const gap=nutrientGap(actual[j],range);
        worst=Math.max(worst,gap);
        sum+=gap;
      }
    }
    const result={portions,worst,sum};
    // Full catalogue profiles can test different triples on each week.
    if(cache.size>=12000) cache.clear();
    cache.set(key,result);
    return result;
  }
  return {values,lowerBound,assess};
}
function mealNutrients(meals,portions) {
  const totals=[0,0,0,0];
  meals.forEach(({r},i)=>{
    totals[0]+=r.kcal*portions[i];
    r.macros.forEach((x,j)=>{totals[j+1]+=x*portions[i];});
  });
  return totals;
}
function nutrientGap(value,[lo,hi]) {
  if(value<lo-1e-7) return (lo-value)/lo;
  if(value>hi+1e-7) return (value-hi)/hi;
  return 0;
}
function pairDayMeals(search,meals,options,priority) {
  const base=meals.map(m=>m.r);
  const ranked=options.map((pool,slot)=>pool.map(r=>({
    r, priority:priority(r,slot), vector:search.values(r)
  })).sort((a,b)=>a.priority-b.priority));
  const combinations=ranked.reduce((n,pool)=>n*pool.length,1);
  // Exhaust typical decks. Bound the work for large catalogues on mobile clients.
  const choices=ranked.map(pool=>combinations<=18000?pool:pool.slice(0,22));
  const distinct=choices[1].some(lunch=>choices[2].some(dinner=>lunch.r!==dinner.r));
  const permitted=(lunch,dinner)=>!distinct || lunch!==dinner;
  const pairVariety=(l,u)=>Number(sameDishStyle(l,u))*5+Number(mainFamily(l)===mainFamily(u))*3;
  const baselineAllowed=base.every((r,i)=>options[i].includes(r)) && permitted(base[1],base[2]);
  let best=baselineAllowed ? search.assess(base) : {worst:Infinity,sum:Infinity};
  let selected=base;
  let bestPriority=baselineAllowed ? base.reduce((sum,r,i)=>sum+priority(r,i),0)+pairVariety(base[1],base[2]) : Infinity;
  const queue=[];
  for(const breakfast of choices[0]) for(const lunch of choices[1]) for(const dinner of choices[2]) {
    if(!permitted(lunch.r,dinner.r)) continue;
    const bound=search.lowerBound(breakfast.vector,lunch.vector,dinner.vector,best.worst);
    if(bound>best.worst+1e-10) continue;
    const order=breakfast.priority+lunch.priority+dinner.priority+pairVariety(lunch.r,dinner.r);
    queue.push({recipes:[breakfast.r,lunch.r,dinner.r],bound,order});
  }
  queue.sort((a,b)=>a.bound-b.bound || a.order-b.order);
  let attempts=0;
  for (const {recipes,bound,order} of queue) {
    if(bound>best.worst+1e-10) break;
    if(best.worst===0 && order>=bestPriority) break;
    if(combinations>18000 && ++attempts>160) break;
    const fit=search.assess(recipes);
    if(fit.worst<best.worst || (fit.worst===best.worst &&
       (fit.sum<best.sum || (fit.sum===best.sum && order<bestPriority)))) {
      best=fit; selected=recipes; bestPriority=order;
    }
  }
  meals.forEach((m,i)=>{
    m.r=selected[i];
    m.personFactors=best.portions.map(row=>row[i]);
    m.f=m.personFactors[0]+m.personFactors[1];
  });
  return best.worst;
}

function factor(s, r, slot) {
  return s.mode === "personal" && !s.plainPortion
    ? (energy(s) * [0.27, 0.36, 0.37][slot]) / r.kcal
    : servings(s);
}
// Each cook day starts a batch. A replacement applies to that batch, including reheated days.
const sequence = [
  ["shakshuka", "chickenOrzo", "fish"],
  ["oats", "chickpea", "mushroomBuck"],
  ["syrniki", "pumpkinSoup", "chicken"],
  ["eggs", "salmonRice", "tomatoPasta"],
  ["curd", "lentils", "tray"],
  ["banana", "ricefish", "eggpot"],
  ["buckapple", "beans", "ovenveg"],
];
function groupStart(s, day) {
  let first = day;
  while (first > 0 && !s.cook.includes(first)) first--;
  return first;
}
function batchDays(s, day) {
  const start = groupStart(s, day);
  const next = Math.min(7, ...s.cook.filter(d => d > start));
  return Array.from({ length: next - start }, (_, i) => start + i);
}
function fitsCuisines(profile, recipe) {
  return !profile.cuisines?.length || profile.cuisines.some(key => recipe.cuisines?.includes(key));
}
function eligible(s, r) {
  return (
    fitsCuisines(s, r) && allowed(s, r) &&
    (s.strictTaste ? s.votes[r.id] === 1 : s.votes[r.id] !== -1)
  );
}
function manualCandidate(s, r, slot) {
  return Boolean(r && r.slot === (slot === 0 ? "b" : "m") && fitsCuisines(s,r) && allowed(s,r) && s.votes[r.id] !== -1);
}
function candidates(s, slot) {
  return RECIPES.filter(
    (r) => r.slot === (slot === 0 ? "b" : "m") && eligible(s, r),
  );
}
const familyCache = new WeakMap();
function mainFamily(r) {
  if (familyCache.has(r)) return familyCache.get(r);
  const grams = [...r.items].sort((a,b)=>b[1]-a[1]);
  const protein = key => {
    if (key.startsWith("chicken") || key==="turkey") return "птица";
    if (FOOD[key].slice(5).includes("fish")) return "рыба";
    if (key==="squid") return "морепродукты";
    if (/^(beef|cannedBeef|pelmeni)/.test(key)) return "говядина";
    if (/^(pork|mincedPork|bacon|ham$|smokedPork|smokedSausage|frankfurters)/.test(key)) return "свинина";
    if (key==="lamb") return "баранина";
    return null;
  };
  const mainProtein = grams.find(([k])=>protein(k));
  const title = r.title.toLowerCase();
  const family = mainProtein ? protein(mainProtein[0])
    : /омлет|фриттата|скр[эе]мбл|шакшук|яичниц/.test(title) ? "яйца"
    : /творож|сырник|из творога/.test(title) && grams.slice(0,2).some(([k])=>k==="curd") ? "творог"
    : (grams.find(([k])=>!["milk","kefir","ryazhenka","cream","sourCream","yogurt"].includes(k)) || grams[0])[0];
  const grouped = FOOD[family]?.slice(5).includes("legumes") ? "бобовые"
    : ["mushroom","chanterelle","oysterMushroom","driedPorcini"].includes(family) ? "грибы"
    : family==="egg" ? "яйца" : family==="curd" ? "творог" : family;
  familyCache.set(r,grouped);
  return grouped;
}
function tasteAffinity(r, likes = []) {
  if (!likes.length) return 0;
  const ingredients = r.items.map(([k]) => k);
  const matches = {
    chicken: ingredients.some(k=>k.startsWith("chicken")),
    fish: mainFamily(r)==="рыба",
    greens: r.diet==="vegan" && r.slot==="m",
    pasta: ingredients.some(k=>["pasta","orzo","buck","rice","vermicelli","pastaShells","pastaNests","buckwheatNoodles"].includes(k)),
    soups: /суп|^борщ|^щи |^уха |^окрошка|^солянка|^рассольник|^свекольник|похл[её]бка|юшка|^капустняк|^кулеш/.test(r.title.toLowerCase()),
    curd: ingredients.includes("curd"),
  };
  return likes.reduce((score,k)=>score+Number(Boolean(matches[k])),0);
}
// Look at the kind of dish first; a potato in a soup does not make it a potato pancake.
const dishKinds = [
  ["суп", /^(?:борщ|щи\b|щи |суп|рассольник|солянк|окрошк|ух[аия] |свекольник|похл[её]бк|кулеш)|(?: суп| щи|похл[её]бк|юшка)/u],
  ["салат", /салат|винегрет|оливье|сел[её]дка под шубой/u],
  ["котлеты", /котлет|биточк|тефтел|фрикадел|зраз[ыа]|шницел/u],
  ["вареники и пельмени", /пельмен|вареник|манты|хинкал/u],
  ["каша", /каш[аиу]|овсянк|крупеник|овсяные хлопья/u],
  ["блины и оладьи", /блин|олад|драник|панкейк|леп[её]шк/u],
  ["сырники", /сырник|творожник/u], ["яичное блюдо", /омлет|яичниц|скр[эе]мбл|яйца |яйцо |шакшук|драч[её]н/u],
  ["бутерброд", /бутерброд|тост|гренк|брускетт|сэндвич/u],
  ["выпечка", /пирог|пирож|расстега|манник|слойк|ватрушк|шаньг|шарлотк|калитк|кекс/u],
  ["запеканка", /запеканк|пудинг|лапшевник|бабка/u],
  ["фаршированное блюдо", /голубц|фарширован|с начинкой|с мясной начинкой/u],
  ["паста", /макарон|паста |паст[ау] |лапша|вермишел|спагетти|орзо/u],
  ["плов", /плов|пилав/u], ["рагу и жаркое", /рагу|жаркое|гуляш|бигос|бефстроганов/u],
];
const dishKindCache=new WeakMap();
function dishKind(r) {
  if (r.kind) return r.kind;
  if (!dishKindCache.has(r)) {
    const title=r.title.toLowerCase();
    dishKindCache.set(r,dishKinds.find(([,re])=>re.test(title))?.[0] || "");
  }
  return dishKindCache.get(r);
}
function sameDishStyle(a,b) {
  const kind=dishKind(a);
  return Boolean(kind && kind===dishKind(b));
}
function mealRole(r) {
  if (r.mealRole) return r.mealRole;
  if (r.slot === "b") return "breakfast";
  if (/суп/i.test(r.title) || ["vegbowl","panTomate","chickenMushroomToast"].includes(r.id)) return "lunch";
  if (["tray","fish","mustardChicken","lemonPollock","herbChickenRolls","pollockCakes","pumpkinSalmon"].includes(r.id)) return "dinner";
  return "either";
}
function fitsMainSlot(r,slot) {
  const role=mealRole(r);
  return role==="either" || role===(slot===1?"lunch":"dinner");
}
function slotPool(pool,slot) {
  if (!slot) return pool;
  const compatible=pool.filter(r=>fitsMainSlot(r,slot));
  return compatible.length ? compatible : pool;
}
// Choose dinner where possible while leaving a distinct, suitable lunch.
// Apply before novelty, price or taste scores may consume the only flexible dish.
function dinnerPool(pool) {
  const dinners=slotPool(pool,2);
  const lunches=pool.filter(r=>fitsMainSlot(r,1));
  if (lunches.length!==1) return dinners;
  const reservingLunch=dinners.filter(r=>r!==lunches[0]);
  return reservingLunch.length ? reservingLunch : dinners;
}
// Record what appeared on the plate, including manual edits and non-cooking days.
function rememberWeek(prior,p) {
  for (const day of p.days) for (const [slot,{r}] of day.meals.entries()) {
    const entry=prior.get(r.id) || {uses:0,dinners:0};
    entry.uses++;
    if (slot===2) entry.dinners++;
    prior.set(r.id,entry);
  }
}
function cookSlot(s, d, slot) {
  if (!slot || !s.rotateBatches || (d - groupStart(s, d)) % 2 === 0)
    return slot;
  return 3 - slot;
}
function cookingTime(r) {
  return r.id === "oatjar" ? "5 мин + ночь" : r.minutes + " мин";
}
// A different centrepiece for each evening, with a faster alternative when the user's time allows it.
const supperPairs = [
  ["rd022", "mustardChicken"],
  ["salmonRice", "lemonPollock"],
  ["rd021", "rl021"],
  ["rd024", "mushroomBuck"],
  ["fish", "lemonPollock"],
  ["chickenOrzo", "mustardChicken"],
  ["rd023", "rl001"],
];
function cyclePool(pool, perWeek, phase, seed) {
  if (pool.length < 5 || phase === 2) return pool;
  const first = Math.min(
    pool.length - 2,
    Math.max(Math.min(pool.length, perWeek), Math.ceil(pool.length / 2)),
  );
  const count =
    phase === 0 ? first : first + Math.ceil((pool.length - first) / 2);
  // Interleave groups so a smaller first-week pool still covers different foods.
  const groups = new Map();
  for (const r of pool) {
    const kind = r.slot === "b" ? r.items[0][0] : mainFamily(r);
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(r);
  }
  const ordered = [];
  const queues = [...groups.values()];
  for (const q of queues) {
    const n = ((seed % q.length) + q.length) % q.length;
    q.push(...q.splice(0, n));
  }
  while (ordered.length < count) {
    for (const q of queues) if (q.length) ordered.push(q.shift());
  }
  return ordered.slice(0, count);
}
function smallMainPair(mains,absoluteDay) {
  const phase=((absoluteDay%3)+3)%3;
  const pattern=mains.length===2 ? [[0,0],[0,1],[1,1]] : [[0,1],[0,2],[1,2]];
  const pair=pattern[phase].map(n=>mains[n]);
  const score=(a,b)=>Number(fitsMainSlot(a,1))+Number(fitsMainSlot(b,2));
  if (score(pair[1],pair[0])>score(pair[0],pair[1])) pair.reverse();
  return pair;
}
function pinnedMeal(s,swaps,d,i) {
  const key=swaps["day:"+d+"-"+i] ?? swaps[groupStart(s,d)+"-"+cookSlot(s,d,i)];
  if (!key) return null;
  const r=RECIPES.find(r=>r.id===key);
  return manualCandidate(s,r,i) ? r : null;
}
// With just two liked mains, a manual edit can otherwise use up both on two
// successive days. Plan these 14 slots together and minimise changes to other meals.
function twoMainSchedule(s,mains,week,swaps,previous) {
  const bit=r=>r===mains[0]?1:r===mains[1]?2:0;
  const masks=previous.slice(-2).map(d=>d.meals.reduce((n,m)=>n|bit(m.r),0));
  const pins=DAYS.map((_,d)=>[pinnedMeal(s,swaps,d,1),pinnedMeal(s,swaps,d,2)]);
  const memo=new Map();
  function search(d,older,last) {
    // Leave at least one automatic main available for next Monday.
    if(d===7) return (older&last)===3 ? null : {cost:0,days:[]};
    const key=d*16+older*4+last;
    if(memo.has(key)) return memo.get(key);
    const wanted=smallMainPair(mains,week*7+d), [l,u]=pins[d];
    let best=null;
    for(const a of l?[l]:mains) for(const b of u?[u]:mains) {
      const blocked=older&last;
      if ((!l&&(bit(a)&blocked)) || (!u&&(bit(b)&blocked))) continue;
      const next=search(d+1,last,bit(a)|bit(b));
      if(!next)continue;
      const cost=next.cost+10*(Number(!l&&a!==wanted[0])+Number(!u&&b!==wanted[1]))+
        Number(!fitsMainSlot(a,1))+Number(!fitsMainSlot(b,2))+Number(a===b);
      if(!best||cost<best.cost) best={cost,days:[[a,b],...next.days]};
    }
    memo.set(key,best);
    return best;
  }
  return search(0,masks.at(-2)||0,masks.at(-1)||0)?.days;
}
function planWeek(
  s,
  weekOffset = 0,
  replacements = {},
  prior = null,
  phase = 0,
  precedingDays = [],
  economize = 0,
  checkoutCost = null,
  desserts = {},
) {
  const pools = [candidates(s, 0), candidates(s, 1)];
  if (pools.some(pool => pool.length < 2)) return null;
  const batches = 7 - DAYS.filter((_, i) => groupStart(s, i) !== i).length;
  const autoPools = s.strictTaste
    ? pools.map((pool, slot) =>
        cyclePool(
          pool,
          batches * (slot === 0 ? 1 : 2),
          phase,
          weekOffset - phase,
        ),
      )
    : pools;
  // Spread each meal role across both calendar windows, even with a small list of likes.
  const orderedMains = [...pools[1]].sort((a,b)=>mealRole(a).localeCompare(mealRole(b)));
  const goals=activePortionTargets(s);
  const pairSearch=goals?.length===2 ? pairPortionSearch(goals) : null;
  const timesServed=new Map();
  const pairMisses=[];
  const cycle=((weekOffset-(s.tasteAnchor||0))%3+3)%3;
  const pairCycleStart=!s.strictTaste || cycle===0;
  const pairCycleEnd=!s.strictTaste || cycle===2;
  // Split each culinary role across the absolute two-day calendar windows.
  // Both sides contain a mix of protein densities. The same split on Saturday,
  // Sunday and Monday protects a three-day streak across independently opened cycles.
  const boundarySide=new Map();
  if(pairSearch) {
    [...pools[0]].sort((a,b)=>b.macros[0]/b.kcal-a.macros[0]/a.kcal)
      .forEach((r,index)=>boundarySide.set(r,index%2));
    let index=0;
    for(const role of ["lunch","dinner","either"]) {
      orderedMains.filter(r=>mealRole(r)===role).sort((a,b)=>b.macros[0]/b.kcal-a.macros[0]/a.kcal)
        .forEach(r=>boundarySide.set(r,index++%2));
    }
  }
  const twoMains = orderedMains.length===2 ? twoMainSchedule(s,orderedMains,weekOffset,replacements,precedingDays) : null;
  if (orderedMains.length===2 && !twoMains) return null;
  const used = new Map(),
    days = [],
    counts = {},
    macros = [];
  const seenIngredients = new Set(),
    dinnerUses = new Map();
  const recent = precedingDays.slice(-2).map(day => new Set(day.meals.slice(0,3).map(m => m.r.id)));
  let lastPicks = [];
  let cost = 0,
    picks = null;
  for (let d = 0; d < 7; d++) {
    const start = groupStart(s, d);
    // Adjacent two-day calendar windows draw from disjoint approved recipes.
    // The absolute day keeps Sunday and Monday consistent when weeks are opened out of order.
    const absoluteDay = weekOffset * 7 + d;
    const window = Math.floor(absoluteDay / 2);
    const groupParity = ((window % 2) + 2) % 2;
    const pickDay = d === 0 || start === d || absoluteDay % 2 === 0;
    if (pickDay) {
      const multipleDays = d < 6 && groupStart(s, d + 1) === start;
      lastPicks = picks || [];
      picks = [];
      for (const slot of [0, 2, 1]) {
        const group = slot === 0 ? 0 : 1;
        const allowedWindow = (group ? orderedMains : pools[0]).filter((_, index) => index % 2 === groupParity);
        const preferredWindow = allowedWindow.filter(r => autoPools[group].includes(r));
        let pool = !economize && preferredWindow.length ? preferredWindow : allowedWindow;
        if (slot === 1 && picks[2]) {
          const distinct = pool.filter(r => r.id !== picks[2].id);
          if (distinct.length) pool = distinct;
          else if (allowedWindow.length > 1) pool = allowedWindow.filter(r => r.id !== picks[2].id);
        }
        if(slot>0) {
          const windowOptions = allowedWindow.filter(r=>slot!==1 || r!==picks[2]);
          const options = windowOptions.length ? windowOptions : allowedWindow;
          const suitable = slot===2 ? dinnerPool(options) : slotPool(options,slot);
          const preferred = pool.filter(r=>suitable.includes(r));
          pool = preferred.length ? preferred : suitable;
        }
        const targetBudget = (s.budget / 7) * [0.24, 0.37, 0.39][slot];
        const menuDay = (((d + weekOffset) % 7) + 7) % 7;
        const preferred = sequence[menuDay][slot];
        const suppers = supperPairs[menuDay];
        const rank = (r) => {
          const portion = factor(s, r, slot);
          const amount = r.cost * portion;
          const excess =
            Math.max(0, amount - targetBudget) / Math.max(8, targetBudget);
          const ratio =
            s.mode === "personal"
              ? Math.abs(
                  (r.macros[0] * 4) / r.kcal -
                    (s.ratio === "protein" ? 0.25 : 0.2),
                ) * 10
              : 0;
          const family = mainFamily(r);
          const previousFamily =
            slot > 0 &&
            lastPicks[slot] &&
            mainFamily(lastPicks[slot]) === family;
          const paired = slot === 1 ? picks[2] : null;
          const sameDay = paired && mainFamily(paired) === family;
          const sharedGreens = r.items.filter(
            ([k]) =>
              [
                "dill",
                "basil",
                "parsley",
                "lemon",
                "yogurt",
                "mushroom",
              ].includes(k) && seenIngredients.has(k),
          ).length;
          const index = RECIPES.indexOf(r);
          const shuffle =
            ((index * 17 + slot * 13 + (weekOffset + 20) * 31 + d * 7) % 37) /
            15;
          const earlier = prior?.get(r.id);
          // Prefer approved recipes that have not appeared yet in this three-week cycle.
          const rotation = earlier
            ? Math.min(4, earlier.uses) * 50 +
              (slot === 2 ? earlier.dinners * 22 : 0)
            : 0;
          return (
            rotation +
            (multipleDays && ["eggs", "shakshuka"].includes(r.id) ? 10 : 0) +
            (used.get(r.id) || 0) * (slot === 2 ? 7 : 22) +
            (slot === 2 ? (dinnerUses.get(r.id) || 0) * 34 : 0) +
            (slot === 1 && suppers.includes(r.id) && pool.length > 2 ? 10 : 0) +
            (slot === 2 && r.equip === "cold" ? 9 : 0) -
            (slot === 2 && r.id === suppers[0]
              ? 22
              : slot === 2 && r.id === suppers[1]
                ? 12
                : 0) +
            (previousFamily ? 17 : 0) +
            (sameDay ? 7 : 0) -
            Math.min(2, sharedGreens) +
            (paired && sameDishStyle(paired,r) ? 16 : 0) +
            (checkoutCost ? checkoutCost(r,portion,counts) / Math.max(1,targetBudget) * 90 : 0) +
            (picks.some((a) => a.id === r.id) ? 70 : 0) +
            excess * 55 + economize * (amount / Math.max(1, targetBudget) * 15 + r.items.filter(([k]) => !seenIngredients.has(k)).length * 1.5) -
            Math.min(2, tasteAffinity(r, s.likes)) * 12 +
            ratio +
            shuffle -
            (r.id === preferred ? 7 : 0) -
            (s.votes[r.id] === 1 ? 4 : 0)
          );
        };
        let recipe = pool[0], best = Infinity;
        for (const candidate of pool) {
          const score = rank(candidate);
          if (score < best) { best = score; recipe = candidate; }
        }
        for (const [key] of recipe.items) seenIngredients.add(key);
        picks[slot] = recipe;
        if (slot === 2)
          dinnerUses.set(recipe.id, (dinnerUses.get(recipe.id) || 0) + 1);
        used.set(recipe.id, (used.get(recipe.id) || 0) + 1);
      }
    }
    const daily = [0, 0, 0];
    const repeated = new Set(recent.length === 2 ? [...recent[0]].filter(id => recent[1].has(id)) : []);
    const meals = [];
    for (let i = 0; i < picks.length; i++) {
      const sourceSlot = cookSlot(s, d, i);
      const pool = pools[i === 0 ? 0 : 1];
      const chosen = pinnedMeal(s,replacements,d,i);
      let r = chosen || picks[i];
      if (!chosen && i>0 && orderedMains.length<=3)
        r=(twoMains ? twoMains[d] : smallMainPair(orderedMains,absoluteDay))[i-1];
      if (!chosen && repeated.has(r.id)) {
        const available = pool.filter(candidate => !repeated.has(candidate.id));
        const suitable = slotPool(available,i);
        r = suitable.find(candidate => !meals.some(m => m.r.id === candidate.id)) || suitable[0];
        if (!r) return null;
      }
      meals.push({ r, f: factor(s,r,i), sourceSlot: chosen ? sourceSlot : i, manual: Boolean(chosen) });
    }
    // A pinned lunch or dinner can collide with the other automatically chosen dish.
    // Keep the explicit choice, then resolve the other slot against the actual calendar.
    if (meals[1].r===meals[2].r && orderedMains.length>2 && !(meals[1].manual && meals[2].manual)) {
      const slot=meals[2].manual ? 1 : 2, other=meals[3-slot].r;
      const candidates=orderedMains.filter(r=>r!==other && !repeated.has(r.id));
      // Preserve the calendar split used by weeks that may be opened independently.
      const sameWindow=candidates.filter(r=>orderedMains.indexOf(r)%2===groupParity);
      const compatible=sameWindow.filter(r=>fitsMainSlot(r,slot));
      const pool=compatible.length ? compatible : slotPool(candidates,slot);
      if(pool.length) {
        const useScore=r=>(timesServed.get(r)||0)*5+(prior?.get(r.id)?.uses||0)*2+
          Number(sameDishStyle(r,other))*3+Number(mainFamily(r)===mainFamily(other))*2;
        const r=pool.reduce((best,r)=>useScore(r)<useScore(best)?r:best);
        meals[slot]={...meals[slot],r,f:factor(s,r,slot)};
      }
    }
    const requested = desserts?.[d];
    const dessertId = typeof requested === "string" ? requested : requested?.id;
    const dessert = dessertId && RECIPES.find(r => r.id === dessertId && allowsDessert(s,r));
    if (pairSearch) {
      const groups=[pools[0],orderedMains,orderedMains];
      const guardedBoundary=(pairCycleStart && d<2) || (pairCycleEnd && d>=5);
      const boundaryParity=groupParity;
      const options=meals.map((m,i)=>{
        if (m.manual || (i>0 && orderedMains.length<=3)) return [m.r];
        const group=groups[i];
        // The calendar parity at week boundaries also protects weeks opened directly.
        const available=group.filter(r=>!repeated.has(r.id));
        const restricted=guardedBoundary ? available.filter(r=>boundarySide.get(r)===boundaryParity) : available;
        const pool=restricted.length?restricted:available;
        return i===0 ? pool : slotPool(pool,i);
      });
      const leftovers=!pickDay && days.at(-1)?.meals;
      const priority=(r,slot)=>{
        const use=(timesServed.get(r)||0)+(prior?.get(r.id)?.uses||0)*.7;
        const match=leftovers && r===leftovers[slot].r ? -100 : (r===meals[slot].r ? -4 : 0);
        return use*6 + match + (economize ? Math.min(12,economize)*r.cost/30 : 0)
          + ((RECIPES.indexOf(r)*17+(absoluteDay+300)*31+slot*7)%43)/43;
      };
      const search = dessert ? pairPortionSearch(goals.map(row => remainingDessertTargets(row,dessert))) : pairSearch;
      pairMisses.push(pairDayMeals(search,meals,options,priority));
    }
    if (dessert) {
      meals.push({r:dessert, f:servings(s)*dessertPortion, manual:true, sourceSlot:3,
        sweetMoment:sweetMoment(requested?.moment ?? s.dessertPrefs?.moment),
        personFactors:goals?.map(() => dessertPortion)});
    }
    if (!pairSearch) applyDailyTargets(s,meals);
    else if (dessert) pairMisses[d] = Math.max(...swapDayScore(swapDayTotals(meals,goals),goals).map(p=>p.worst));
    for (const {r,f} of meals) {
      timesServed.set(r,(timesServed.get(r)||0)+1);
      for (const [key, g] of r.items) counts[key] = (counts[key] || 0) + g * f;
      daily.forEach((_, j) => (daily[j] += r.macros[j] * f));
      cost += r.cost * f;

    }
    recent.push(new Set(meals.slice(0,3).map(m => m.r.id)));
    if (recent.length > 2) recent.shift();
    days.push({
      meals,
      start,
      pickDay,
      freshly: s.cook.includes(d),
      prep: d === 0 && !s.cook.includes(0),
    });
    macros.push(daily);
  }
  const newCount = [
    ...new Set(days.flatMap((d) => d.meals.map((m) => m.r.id))),
  ].filter((id) => !prior?.has(id)).length;
  return { days, counts, macros, cost: Math.round(cost), newCount, phase, pairMisses };
}

// A confirmed nutrition substitution is local to one serving day. Start from the
// weekly plan each time so changes to goals, allergies and manual pins still apply.
function fitsNutritionSwap(s,week,d,slot,recipe,previous=[]) {
  const meals=week.days[d].meals;
  if (!recipe || meals[slot].manual || !manualCandidate(s,recipe,slot)) return false;
  if (slot && !fitsMainSlot(recipe,slot)) return false;
  if (meals.some(m=>m.r.id===recipe.id)) return false;
  const days=previous.slice(-2).concat(week.days);
  const position=days.length-7+d;
  const contains=i=>i===position || days[i]?.meals.some(m=>m.r.id===recipe.id);
  for(let first=position-2; first<=position; first++) {
    if(contains(first) && contains(first+1) && contains(first+2)) return false;
  }
  return true;
}
function swapDayTotals(meals,goals) {
  return goals.map((_,i)=>mealNutrients(meals,meals.map(m=>m.personFactors[i])));
}
function swapDayScore(totals,goals) {
  return totals.map((row,i)=>{
    const gaps=row.map((v,j)=>goals[i][j] ? nutrientGap(v,goals[i][j]) : 0);
    return {gaps,worst:Math.max(...gaps),sum:gaps.reduce((a,b)=>a+b,0)};
  });
}
function withNutritionSwaps(s,week,records,prior,previous) {
  const goals=activePortionTargets(s);
  if (!week || goals?.length!==2 || !records || !Object.keys(records).length) return week;
  const result={...week,days:week.days.slice(),macros:week.macros.slice(),pairMisses:week.pairMisses.slice()};
  let changed=false;
  for(const [d,original] of week.days.entries()) {
    const meals=original.meals.map(m=>({...m}));
    let edited=false;
    for(const [slot,m] of meals.entries()) {
      const edit=records[d+"-"+slot];
      if(!edit || edit.from!==m.r.id) continue;
      const r=RECIPES.find(x=>x.id===edit.to);
      if(!fitsNutritionSwap(s,result,d,slot,r,previous)) continue;
      m.r=r; m.manual=true; edited=true;
      result.days[d]={...original,meals};
    }
    if(!edited) continue;
    changed=true;
    applyDailyTargets(s,meals);
    result.macros[d]=mealNutrients(meals,meals.map(m=>m.f)).slice(1);
    result.pairMisses[d]=Math.max(...swapDayScore(swapDayTotals(meals,goals),goals).map(x=>x.worst));
  }
  if(!changed) return week;
  const counts={},ids=new Set();
  let cost=0;
  for(const day of result.days) for(const {r,f} of day.meals) {
    ids.add(r.id);
    cost+=r.cost*f;
    for(const [key,g] of r.items) counts[key]=(counts[key]||0)+g*f;
  }
  result.counts=counts;
  result.cost=Math.round(cost);
  result.newCount=[...ids].filter(id=>!prior?.has(id)).length;
  return result;
}
// These photographed recipes also work as a small sweet course or snack.
const dessertIds = new Set([
  "rb063", "rb082", "rb058", "rb067", "rb059", "rb065", "rb068", "rb094",
  "rb098", "rb062", "carrotYogurt", "rwWahe", "reBchak", "ncKutia",
  // Additional desserts are only used if a person explicitly likes or pins them.
  ...availableDesserts,
]);
const dessertPortion = 0.5;
const sweetMoments = {
  breakfast: "После завтрака", lunch: "После обеда", snack: "На перекус", dinner: "После ужина",
};
function sweetMoment(value) {
  return Object.hasOwn(sweetMoments,value) ? value : "dinner";
}
function sweetMealLabel(meal,slot) {
  return slot===3 ? "Десерт · "+sweetMoments[sweetMoment(meal.sweetMoment)].toLowerCase() : slotNames[slot];
}
// Keep the planner's three main meal slots stable. Only change the serving order on screen.
function servingSlots(meals) {
  const slots=[0,1,2];
  if(meals[3]){
    const position={breakfast:1,lunch:2,snack:2,dinner:3}[sweetMoment(meals[3].sweetMoment)];
    slots.splice(position,0,3);
  }
  return slots;
}
function chosenWeekdays(prefs) {
  return DAYS.map((_,i)=>i).filter(i=>Array.isArray(prefs?.days) && prefs.days.includes(i));
}
function momentPicker(selected) {
  return `<fieldset class="sweet-moment"><legend>Когда хочется сладкого?</legend><div class="chips">${Object.entries(sweetMoments).map(([id,label])=>choiceChip("sweet-moment",id,label,id===selected)).join("")}</div></fieldset>`;
}
function allowsDessert(profile, recipe) {
  return recipe && dessertIds.has(recipe.id) && allowed(profile, recipe) &&
    fitsCuisines(profile, recipe) && profile.votes?.[recipe.id] !== -1;
}
function sweetOptions(profile) {
  return Array.from(dessertIds,byId).filter(r=>allowsDessert(profile,r));
}
function remainingDessertTargets(row, recipe) {
  const nutrients = [recipe.kcal, ...recipe.macros];
  return row.map((range, i) => range && range.map(x => Math.max(0.01, x - nutrients[i] * dessertPortion)));
}

function sweetFrequency(prefs) {
  const days=chosenWeekdays(prefs);
  if(days.length) return days.length;
  return Number.isInteger(prefs?.frequency) ? Math.max(0, Math.min(7,prefs.frequency)) : 0;
}
function sweetLikes(profile) {
  const likes=new Set(profile.dessertPrefs?.likes || []);
  return sweetOptions(profile).filter(r=>likes.has(r.id));
}
function sweetSchedule(s,n,base,options) {
  const count=sweetFrequency(s.dessertPrefs), score=budgetScorer(s,{planning:true}), stock=s.planningPantry?.[n]||{};
  const limit=hasBudget(s)?s.budget*100:Infinity, goals=activePortionTargets(s);
  const out={}, usage=new Map();
  let counts=base.counts;
  const selected=chosenWeekdays(s.dessertPrefs);
  const days=selected.length ? selected : Array.from({length:count},(_,j)=>Math.floor((j+.5)*7/count));
  for(const [j,d] of days.entries()){
    const original=base.days[d].meals.slice(0,3);
    const trials=options.map((r,k)=>{
      const meals=[...original.map(m=>({...m})),{r,f:servings(s)*dessertPortion}];
      applyDailyTargets(s,meals);
      const totals={...counts};
      for(const [slot,m] of meals.entries()){
        const delta=m.f-(original[slot]?.f||0);
        if(delta) for(const [key,g] of m.r.items) totals[key]=(totals[key]||0)+g*delta;
      }
      const misses=goals?swapDayScore(swapDayTotals(meals,goals),goals):[];
      const gap=Math.round(Math.max(0,...misses.map(x=>x.worst))*1e5);
      const cents=score(totals,stock).cents;
      const rank=[gap,Math.max(0,cents-limit),Number(original.some(m=>m.r.id===r.id)),usage.get(r.id)||0,
        Number(Object.values(out).at(-1)===r.id),((k-j-n)%options.length+options.length)%options.length,cents];
      return {r,totals,rank};
    });
    trials.sort((a,b)=>{for(let k=0;k<a.rank.length;k++){const diff=a.rank[k]-b.rank[k];if(diff)return diff;}return 0;});
    const pick=trials[0]; out[d]=pick.r.id;counts=pick.totals;usage.set(pick.r.id,(usage.get(pick.r.id)||0)+1);
  }
  return out;
}
function budgetPlan(s,n,replacements,prior,phase,previous,desserts) {
  const make=(swaps,strength=0,checkout=null)=>planWeek(s,n,swaps,prior,phase,previous,strength,checkout,desserts);
  const sweets=sweetFrequency(s.dessertPrefs) ? sweetLikes(s) : [];
  if(sweets.length){
    const base=planWeek(s,n,{},prior,phase,previous,0,null,{});
    if(!base) return null;
    const schedule=sweetSchedule(s,n,base,sweets);
    for(const [day,edit] of Object.entries(desserts || {})){
      if(edit?.auto) {
        if(schedule[day]) schedule[day]={id:schedule[day],moment:edit.moment};
      } else {
        schedule[day]=edit;
      }
    }
    desserts=schedule;
  }
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
    const checkout=level===16 ? marginalCheckout(initialQuote.store,pantry,normalizePriceCity(s.priceCity)) : null;
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

return {budgetPlan,withBudgetEdits,withNutritionSwaps,byId,manualCandidate};
})(RECIPES,dessertIds);
