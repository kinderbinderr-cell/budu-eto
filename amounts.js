// Approximate edible yield and shopping weight of one typical piece, in grams.
const producePieces = {
  apple: [150, 170], banana: [120, 170], lemon: [45, 120],
  pear: [150, 170], garlic: [40, 50], onion: [100, 120], cabbage: [900, 1000],
};
const measureNames = {
  pack: ["упаковка", "упаковки", "упаковок"],
  box: ["пачка", "пачки", "пачек"],
  bottle: ["бутылка", "бутылки", "бутылок"],
  jar: ["банка", "банки", "банок"],
  bag: ["пакетик", "пакетика", "пакетиков"],
  bunch: ["пучок", "пучка", "пучков"],
  head: ["головка", "головки", "головок"],
  cabbage: ["кочан", "кочана", "кочанов"],
};
function countLabel(n, kind) {
  const forms = measureNames[kind];
  return n + " " + (forms ? plural(n, ...forms) : "шт.");
}
const foodPacks = {
  oats: "box", rice: "box", buck: "box", pasta: "box", orzo: "box", lentil: "box",
  butter: "box", chick: "jar", bean: "jar", milk: "bottle", oil: "bottle",
  paprika: "bag", cinnamon: "bag", cumin: "bag",
};
function shoppingWeight(n) {
  const step = n >= 500 ? 100 : 50;
  return Math.ceil(n / step) * step;
}
function retailWeight(key, g, edibleFraction = 1) {
  const piece = producePieces[key];
  // A piece weight already includes its peel or core. Apply each yield only once.
  if (piece && edibleFraction !== 1) {
    const weight = Math.ceil(g / (piece[1] * edibleFraction)) * piece[1];
    return { weight, label: "около " + grams(weight) };
  }
  return weightPurchase(key, g / edibleFraction);
}
function weightPurchase(key, g) {
  const piece = producePieces[key];
  if (piece) {
    const count = Math.ceil(g / piece[0]);
    const label = countLabel(count, key === "garlic" ? "head" : key === "cabbage" ? "cabbage" : "piece");
    const weight = count * piece[1];
    return { weight, label: label + " · ≈ " + grams(weight) };
  }
  const weight = shoppingWeight(g);
  return { weight, label: "около " + grams(weight) };
}
function volumeLabel(ml) {
  return ml >= 1000 ? (ml / 1000).toLocaleString("ru-RU") + " л" : ml + " мл";
}
// Approximate retail packs when there is no selected catalogue SKU. Capacity is edible grams.
const commonPacks = {};
function addPack(keys, capacity, label, kind="pack") {
  for(const key of keys.split(" ")) commonPacks[key]={capacity,label,kind};
}
addPack("salt sugar flour",1000,"1 кг","box");
addPack("mustard horseradish",100,"100 г","jar");
addPack("paste",140,"140 г","jar");
addPack("oil",920,"1 л","bottle");
addPack("milk",1030,"1 л","bottle");
addPack("kefir ryazhenka kvass",1000,"1 л","bottle");
addPack("cream",200,"200 мл");
addPack("butter",180,"180 г","box");
addPack("oats pasta vermicelli pastaShells pastaNests orzo buckwheatNoodles",450,"450 г","box");
addPack("rice buck",900,"900 г","box");
addPack("lentil pearlBarley barleyGroats cornGrits millet spelt wheatGroats semolina bulgur splitPeas",500,"500 г","box");
addPack("buckFlour riceFlour ryeFlour tolokno",500,"500 г","box");
addPack("bread ryeBread",350,"350 г");
addPack("egg",500,"10 шт.");
addPack("curd sourCream yogurt creamCheese processedCheese",200,"200 г");
addPack("paprika cinnamon cumin pepper",15,"15 г","bag");
addPack("dill parsley basil",30,"30 г","bunch");
addPack("sorrel greenOnion",50,"50 г","bunch");
addPack("yeast bakingPowder",10,"10 г","bag");
addPack("walnut sunflowerSeeds raisin driedApricot prunes sesame poppy",100,"100 г");
addPack("chick bean corn olive",220,"≈ 220 г без заливки","jar");
addPack("tuna cannedSaury spratTomato pinkSalmonCanned sprats codLiver",160,"≈ 160 г съедобной части","jar");
addPack("honey appleButter",250,"250 г","jar");
addPack("grapeLeaves",500,"500 г");
addPack("puffPastry cornFrozen peas pelmeni",500,"500 г");
addPack("starch",200,"200 г");
function typicalPurchase(key,g) {
  const pack=commonPacks[key];
  if(pack){
    const count=Math.ceil(g/pack.capacity);
    return {weight:count*pack.capacity,label:packPurchase(key,count,pack.label,pack.kind)};
  }
  const boneFactor = {porkRibMeat: 1.5, chickenWingMeat: 1.7, chickenLegMeat: 1.4}[key];
  if(boneFactor){
    const weight=shoppingWeight(g*boneFactor);
    return {weight,label:"около "+grams(weight)+" с костью"};
  }
  return weightPurchase(key,g);
}
function generalPurchase(key,g) {return typicalPurchase(key,g).label;}
function weeklyNeed(key,g) {
  if(key==="egg") return kitchenAmount(key,g);
  if(["oil","milk","kefir","ryazhenka","cream","kvass"].includes(key)) {
    const ml=g/(key==="oil"?.92:key==="milk"?1.03:1);
    return volumeLabel(Math.max(1,Math.round(ml)));
  }
  return grams(g);
}
function packPurchase(key, count, label, kind = foodPacks[key] || "pack") {
  return countLabel(count, kind) + (count === 1 ? " · " : " по ") + label;
}
function shoppingAmount(key, g, store) {
  return cataloguePurchase(key, g, store)?.quantity || generalPurchase(key, g);
}
function kitchenFraction(n) {
  const quarters = Math.max(1, Math.round(n * 4));
  const whole = Math.floor(quarters / 4);
  const fraction = ["", "¼", "½", "¾"][quarters % 4];
  return (whole || !fraction ? String(whole) : "") + fraction;
}
function kitchenAmount(key, g) {
  if (key === "egg") return kitchenFraction(g / 50) + " шт.";
  if (key === "garlic") {
    const n = Math.max(0.25, Math.round(g / 4 * 4) / 4);
    return kitchenFraction(n) + " " + plural(n, "зубчик", "зубчика", "зубчиков");
  }
  const fruitForms = {lemon: ["лимон", "лимона", "лимонов"], apple: ["яблоко", "яблока", "яблок"], banana: ["банан", "банана", "бананов"], onion: ["луковица", "луковицы", "луковиц"]};
  if (fruitForms[key]) {
    const share = g / producePieces[key][0];
    const n = share < 0.18 ? 0.125 : Math.max(0.25, Math.round(share * 4) / 4);
    return (n === 0.125 ? "⅛" : kitchenFraction(n)) + " " + plural(n, ...fruitForms[key]);
  }
  if (["kefir", "ryazhenka", "cream", "kvass"].includes(key)) return volumeLabel(Math.max(5, Math.round(g / 5) * 5));
  if (key === "milk") return volumeLabel(Math.max(5, Math.round(g / 1.03 / 5) * 5));
  if (key === "oil") return kitchenFraction(g / 0.92 / (g < 12 ? 5 : 15)) + (g < 12 ? " ч. л." : " ст. л.");
  const perTeaspoon = { salt: 6, paprika: 2.3, cinnamon: 2.6, cumin: 2.1, mustard: 5 };
  if (perTeaspoon[key]) {
    const spoons = g / perTeaspoon[key];
    return spoons < 0.18 ? "щепотка" : kitchenFraction(spoons) + " ч. л.";
  }
  // Keep small and baking quantities precise; round scaled portions to kitchen increments.
  const step = g >= 200 ? 10 : g >= 20 && key !== "flour" ? 5 : 1;
  return grams(Math.max(1, Math.round(g / step) * step));
}
