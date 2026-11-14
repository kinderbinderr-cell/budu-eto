// Recency stores only recipe IDs, separately from votes so a restart still rotates the catalogue.
const tasteHistoryKey = "kbr-syt:recent-decks:1";
let memoryHistory = [];
function recentDishes() {
  try {
    const value = JSON.parse(localStorage.getItem(tasteHistoryKey));
    if (Array.isArray(value)) return value;
  } catch {}
  return memoryHistory;
}
function recordDishes(ids) {
  const offered = new Set(ids);
  memoryHistory = [...recentDishes().filter(id => !offered.has(id)), ...offered].slice(-RECIPES.length);
  try { localStorage.setItem(tasteHistoryKey, JSON.stringify(memoryHistory)); } catch {}
}
const classicDish = r => /(?:борщ|рассольник|(?:^| )щи |окрошк|крупеник|сырник|блины|блинчик|шаньг|драник|пельмен|вареник|голубц|винегрет|гречк|пш[её]нн|пожарски)/iu.test(r.title);
function sampleTasting(pool, limit, history = [], random = Math.random) {
  const order = new Map((pool.length <= limit ? [] : history).map((id,i)=>[id,i])), usedKinds = new Map();
  const rows = pool.map(r=>({r, age:order.get(r.id) ?? -1, ticket:random(), kind:dishKind(r)}));
  const result = [];
  while (rows.length && result.length < limit) {
    const wanted = result.length % 3 === 0 ? "b" : "m";
    let options = rows.filter(x=>x.r.slot === wanted);
    if (!options.length) options = rows;
    // Draw unseen dishes first, then recycle the oldest, never the last deck first.
    const oldest = Math.min(...options.map(x=>x.age));
    options = options.filter(x=>x.age===oldest);
    if (!result.some(classicDish)) {
      const familiar = options.filter(x=>classicDish(x.r));
      if (familiar.length) options = familiar;
    }
    options.sort((a,b)=>((usedKinds.get(a.kind)||0) - (usedKinds.get(b.kind)||0)) || a.ticket-b.ticket);
    const pick = options[0]; result.push(pick.r);
    usedKinds.set(pick.kind,(usedKinds.get(pick.kind)||0)+1);
    rows.splice(rows.indexOf(pick),1);
  }
  return result.map(r=>r.id);
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
const choiceFeatures = new WeakMap();
function dishKind(r) { return r.kind || dishKinds.find(([,re])=>re.test(r.title.toLowerCase()))?.[0] || ""; }
const seasonings = new Set("salt oil garlic dill parsley paprika cumin sugar pepper cinnamon butter paste basil mustard lemon bakingPowder yeast".split(" "));
const families = Object.fromEntries(Object.entries({
  птица:"chicken chickenThigh chickenLegMeat turkey chickenWingMeat",
  рыба:"fish salmon cod hake pinkSalmon pike pikeperch mackerel",
  фарш:"beefMince mincedPork", свинина:"pork porkLoin porkTenderloin porkRibMeat", говядина:"beef beefSteak",
  макароны:"pasta vermicelli orzo pastaNests pastaShells", хлеб:"bread ryeBread wheatRoll",
  грибы:"mushroom chanterelle oysterMushroom driedPorcini"
}).flatMap(([family,keys])=>keys.split(" ").map(k=>[k,family])));
function foodProfile(r) {
  if (choiceFeatures.has(r)) return choiceFeatures.get(r);
  const sorted = r.items.filter(([k])=>!seasonings.has(k)).sort((a,b)=>b[1]-a[1]);
  const features = {kind:dishKind(r), keys:sorted.slice(0,4).map(([k])=>k), leading:sorted.slice(0,2).map(([k])=>families[k]||k)};
  choiceFeatures.set(r,features);return features;
}
function dishSimilarity(a,b) {
  if (a===b || a.id===b.id || a.slot!==b.slot) return null;
  const x=foodProfile(a),y=foodProfile(b),same=x.kind && x.kind===y.kind;
  if (x.kind && y.kind && !same) return null;
  const common=x.keys.filter(k=>y.keys.includes(k)), lead=x.leading.find(k=>y.leading.includes(k));
  if (!same && !lead) return null;
  if (!same && (x.kind||y.kind) && common.length<2) return null;
  const score=(same?18:0)+(lead?7:0)+common.length*3+(a.diet===b.diet?2:0)+(a.equip===b.equip?1:0)-Math.min(3,Math.abs(a.minutes-b.minutes)/15);
  const reason = same ? "Похожее блюдо: "+x.kind : common.length ? "Общий продукт: "+FOOD[common[0]][0].toLocaleLowerCase("ru") : "Общая основа: "+lead;
  return {score,reason};
}
function similarOptions(source,pool,votes={},other=[]) {
  return pool.filter(r=>votes[r.id]!==-1).map(r=>({r,match:dishSimilarity(source,r)})).filter(x=>x.match)
    .sort((a,b)=> Number(other.includes(a.r.id))-Number(other.includes(b.r.id)) ||
      b.match.score-a.match.score || Number(votes[b.r.id]===1)-Number(votes[a.r.id]===1) || a.r.minutes-b.r.minutes);
}
