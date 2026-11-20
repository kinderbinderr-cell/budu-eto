const priceCities = {
  moscow: ["Москва", "Moscow", "77"],
  petersburg: ["Санкт-Петербург", "Saint Petersburg", "78"],
  kazan: ["Казань", "Kazan", "16"],
  yekaterinburg: ["Екатеринбург", "Yekaterinburg", "66"],
  novosibirsk: ["Новосибирск", "Novosibirsk", "54"],
  yaroslavl: ["Ярославль", "Yaroslavl", "76"],
  kursk: ["Курск", "Kursk", "46"],
  izhevsk: ["Ижевск", "Izhevsk", "18"],
  kirov: ["Киров", "Kirov", "43"],
  "kirovo-chepetsk": ["Кирово-Чепецк", "Kirovo-Chepetsk", "43"],
  "vyatskiye-polyany": ["Вятские Поляны", "Vyatskiye Polyany", "43"],
  tyumen: ["Тюмень", "Tyumen", "72"],
  ishim: ["Ишим", "Ishim", "72"],
  tobolsk: ["Тобольск", "Tobolsk", "72"],
  "khanty-mansiysk": ["Ханты-Мансийск", "Khanty-Mansiysk", "86"],
  nizhnevartovsk: ["Нижневартовск", "Nizhnevartovsk", "86"],
  surgut: ["Сургут", "Surgut", "86"],
  beloyarsky: ["Белоярский", "Beloyarsky", "86"],
  salekhard: ["Салехард", "Salekhard", "89"],
  nadym: ["Надым", "Nadym", "89"],
  "novy-urengoy": ["Новый Уренгой", "Novy Urengoy", "89"],
  noyabrsk: ["Ноябрьск", "Noyabrsk", "89"],
  tomsk: ["Томск", "Tomsk", "70"],
  omsk: ["Омск", "Omsk", "55"],
  barnaul: ["Барнаул", "Barnaul", "22"],
  krasnoyarsk: ["Красноярск", "Krasnoyarsk", "24"],
  abakan: ["Абакан", "Abakan", "19"],
  kemerovo: ["Кемерово", "Kemerovo", "42"],
  kyzyl: ["Кызыл", "Kyzyl", "17"],
  other: ["Найти другой город", "Find another city"],
  russia: ["Без города", "No city selected"],
};
const refreshedGroceryPrices=typeof dailyGroceryPrices==="undefined" ? {cities:{},regions:{}} : dailyGroceryPrices;
const priceEnglish=()=>typeof menuLanguage!=="undefined" && menuLanguage.isEnglish();
for(const [id,{names,region}] of Object.entries(refreshedGroceryPrices.cities)) {
  priceCities[id]=[...names,region];
}

const citySearchKey = name => name.trim().toLowerCase().replaceAll("ё","е").replace(/[–—]/g,"-").replace(/\s+/g," ");
const citiesByName = new Map();
for (const [region, [regionName, names]] of Object.entries(russianCityDirectory)) {
  for (const name of names) {
    const key=citySearchKey(name);
    if(!citiesByName.has(key)) citiesByName.set(key,[]);
    citiesByName.get(key).push({name,region,regionName});
  }
}

function directoryCity(name) {
  const [city,regionName]=name.split(",").map(citySearchKey);
  const matches=citiesByName.get(city) || [];
  return regionName ? matches.find(match=>citySearchKey(match.regionName)===regionName)
    : matches.length===1 ? matches[0] : null;
}

function citySuggestions(name) {
  const key=citySearchKey(name);
  if(key.length<2 || directoryCity(name)) return [];
  const found=[];
  for(const [city,matches] of citiesByName) {
    if(!city.startsWith(key)) continue;
    for(const match of matches) {
      found.push({...match,value:matches.length===1?match.name:match.name+", "+match.regionName});
    }
  }
  return found.sort((a,b)=>(a.name.length-b.name.length)||a.name.localeCompare(b.name,"ru")).slice(0,5);
}

function normalizePriceCity(city) {
  if (!Object.hasOwn(priceCities, city?.id)) return {id:"moscow"};
  if (city.id !== "other") return {id:city.id};
  const name=typeof city.name==="string" ? city.name.trim().slice(0,80) : "";
  const key=citySearchKey(name), directory=directoryCity(name);
  const namedCity=Object.entries(priceCities).find(([, [ru,en,region]])=>region && (
    directory ? citySearchKey(directory.name)===citySearchKey(ru) && directory.region===region
      : !citiesByName.has(key) && (citySearchKey(ru)===key || citySearchKey(en)===key)
  ));
  return namedCity ? {id:namedCity[0]} : {id:"other",name};
}

const moscowPrices = city => normalizePriceCity(city).id === "moscow";
function priceCityName(city) {
  return city.name || priceCities[city.id][Number(priceEnglish())];
}

// Weekly average retail prices for equivalent product categories. Values are in kopecks.
const averageFoodPrices = {
  apple: [13787, 12053],
  banana: [16091, 14941],
  beet: [4695, 3468],
  buck: [9409, 6919],
  butter: [111328, 95643],
  cabbage: [3942, 3265],
  carrot: [4960, 3506],
  cheese: [95967, 80777],
  cucumber: [16011, 9785],
  curd: [48393, 45966],
  egg: [11254, 9126],
  flour: [5748, 4353],
  frankfurters: [56333, 48888],
  kefir: [11370, 10179],
  milk: [9999, 8961],
  millet: [6934, 4902],
  oil: [16029, 14102],
  onion: [4977, 4496],
  // The same price series covers the three dry wheat pasta shapes.
  pasta: [12549, 7733],
  potato: [5034, 4249],
  rice: [12670, 8196],
  ryeBread: [10903, 9252],
  salt: [2457, 1938],
  sourCream: [36061, 30736],
  sugar: [8005, 7959],
  tomato: [23462, 15717],
  vermicelli: [12436, 9190],
};
const priceSnapshots = {
  national: {
    period: "2026-11-16",
    source: "https://1000bankov.ru/inflation/products/",
    labels: ["Средние цены по России", "Russian average prices"],
    publishers: ["Росстат, публикация 1000bankov.ru", "Rosstat, via 1000bankov.ru"],
  },
  regional: {
    period: "2026-10-26",
    source: "https://16.rosstat.gov.ru/storage/mediabank/%D0%9E%20%D1%86%D0%B5%D0%BD%D0%B0%D1%85%20%D0%BD%D0%B0%20%D0%BF%D1%80%D0%BE%D0%B4.%D1%82%D0%BE%D0%B2.%2026.10.2026%D0%B3.pdf",
    labels: ["Средние цены по Татарстану", "Tatarstan average prices"],
    publishers: ["Татарстанстат", "Tatarstanstat"],
  },
};

const localGroceryPrices = new Map();
const regionalGroceryPrices = new Map();
const regionalPriceNames = {
  "18": ["Удмуртии", "Udmurtia average prices"],
  "43": ["Кировской области", "Kirov Oblast average prices"],
  "46": ["Курской области", "Kursk Oblast average prices"],
  "72": ["Тюменской области", "Tyumen Oblast average prices"],
  "76": ["Ярославской области", "Yaroslavl Oblast average prices"],
  "86": ["ХМАО — Югре", "Khanty-Mansi Autonomous Okrug average prices"],
  "89": ["ЯНАО", "Yamalo-Nenets Autonomous Okrug average prices"],
};
for(const {areas,rows,source,period,publishers} of Object.values(groceryBulletins)) {
  for(const [column,area] of areas.entries()) {
    const region=Object.hasOwn(regionalPriceNames,area);
    const rates=Object.fromEntries(Object.entries(rows)
      .filter(([,prices])=>Number.isInteger(prices[column]))
      .map(([key,prices])=>[key,prices[column]]));
    const labels=region ? ["Средние цены по "+regionalPriceNames[area][0],regionalPriceNames[area][1]]
      : ["Средние цены по городу","City average prices"];
    (region ? regionalGroceryPrices : localGroceryPrices).set(area,{source,period,publishers,labels,rates});
  }
}
const ratesFor = column => Object.fromEntries(Object.entries(averageFoodPrices).map(([key,rates])=>[key,rates[column]]));
priceSnapshots.national.rates=ratesFor(0);
regionalGroceryPrices.set("16",{...priceSnapshots.regional,rates:ratesFor(1)});

function addPriceSnapshot(map,id,next) {
  const saved=map.get(id);
  if(saved && (saved.period>next.period ||
    (saved.period===next.period && Object.keys(saved.rates).length>=Object.keys(next.rates).length))) return;
  map.set(id,next);
}
for(const [id,snapshot] of Object.entries(refreshedGroceryPrices.cities)) {
  addPriceSnapshot(localGroceryPrices,id,{...snapshot,labels:["Средние цены по городу","City average prices"]});
}
for(const [id,snapshot] of Object.entries(refreshedGroceryPrices.regions)) {
  addPriceSnapshot(regionalGroceryPrices,id,snapshot);
}
if(refreshedGroceryPrices.national?.period>=priceSnapshots.national.period) {
  priceSnapshots.national=refreshedGroceryPrices.national;
}

function priceSources(city) {
  const region=city.id==="other" ? directoryCity(city.name)?.region : priceCities[city.id]?.[2];
  return {
    local:localGroceryPrices.get(city.id),
    regional:regionalGroceryPrices.get(region),
    national:priceSnapshots.national,
  };
}

function observedPrice(key, city) {
  if (city.id==="moscow" && cityObservations[key]) return cityObservations[key];
  const categoryKey=["pastaNests","pastaShells"].includes(key) ? "pasta" : key;
  const categoryData=cityObservations[categoryKey];
  if(!categoryData) return null;
  for(const [scope,snapshot] of Object.entries(priceSources(city))) {
    const kopecks=snapshot?.rates[categoryKey];
    if(!Number.isInteger(kopecks)) continue;
    const {category,unit}=categoryData, {labels,publishers,period,source}=snapshot;
    return {category,unit,scope,kopecks,labels,publishers,period,source};
  }
  return null;
}
