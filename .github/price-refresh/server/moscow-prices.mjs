export function shelfDay(time) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone:"Europe/Moscow", year:"numeric", month:"2-digit", day:"2-digit",
  }).format(time);
}
function shelfOffer(item, rule, brand) {
  if (!item?.available || !(item.inStock > 0) || item.slug !== rule.slug ||
      String(item.weight).replace(/\s+/g," ").trim() !== rule.expectedWeight) return null;
  const price = Number(item.decimalPrice);
  if (!Number.isFinite(price) || price <= 0) return null;
  const out = {title:rule.title, url:"https://eda.yandex.ru/retail/" + brand + "/product/" +
    encodeURIComponent(rule.slug) + "/" + rule.uid, unit:rule.unit, packLabel:rule.packLabel};
  if (rule.note) out.note = rule.note;
  if (rule.unit === "pack") {
    if (item.weight_data?.quantim_value_g || !(rule.grams > 0)) return null;
    return {...out, unitPrice:price, packGrams:rule.grams};
  }
  const step = Number(item.weight_data?.quantim_value_g);
  const perKg = Number(item.weight_data?.price_per_kg);
  if (!Number.isInteger(step) || step <= 0 || !Number.isFinite(perKg) || perKg <= 0) return null;
  return {...out, unitPrice:perKg, minGrams:step, stepGrams:step, edibleFraction:rule.edibleFraction || 1};
}
export function checkedShelf(config, sections, now = Date.now()) {
  if (!Array.isArray(sections) || sections.length !== Object.keys(config.categories).length)
    throw Error("Не все разделы витрины проверены");
  const samples = new Map();
  for (const section of sections) {
    const {id,at,branch,address,city,currency,brand,items} = section;
    if (!Object.hasOwn(config.categories,id) || samples.has(id) || branch !== config.slug ||
        address !== config.address || brand !== config.brand || city !== "Москва" || currency !== "RUB")
      throw Error("Филиал или раздел не совпадает");
    if (!Number.isFinite(at) || at > now + 300000 || Math.abs(now-at) >= 86400000 ||
        shelfDay(at) !== shelfDay(now) || !Array.isArray(items)) throw Error("Не подтверждена сегодняшняя дата витрины");
    samples.set(id,new Map(items.map(item=>[item.uid,item])));
  }
  const products = {};
  for (const [key, choices] of Object.entries(config.goods)) {
    for (const rule of choices) {
      const offer = shelfOffer(samples.get(String(rule.categoryId)).get(rule.uid),rule,config.brand);
      if (offer) { products[key]=offer; break; }
    }
  }
  if (!Object.keys(products).length) throw Error("Нет подтверждённых цен");
  return {revision:config.revision, city:"Москва", address:config.address, name:config.name, source:"Яндекс Еда", checkedAt:now,
    checkedOn:shelfDay(Math.min(...sections.map(s=>s.at))),products};
}
export async function savedShelf(bucket,store) {
  const object = bucket && await bucket.get("moscow-prices/" + store);
  return object ? await object.json() : null;
}
export function preferredShelf(saved, seed) {
  return !saved || seed.checkedOn > saved.checkedOn || (seed.checkedOn === saved.checkedOn && seed.revision && saved.revision !== seed.revision) ? seed : saved;
}
export async function updateShelf(request,bucket,store,rules,seeds,writerKey) {
  const respond = (data,status=200) => Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
  if (!Object.hasOwn(rules,store)) return respond({error:"Неизвестная сеть"},404);
  if (request.method === "GET") {
    const saved = await savedShelf(bucket,store);
    const value = preferredShelf(saved, seeds[store]);
    return respond({saved:!!saved && value === saved,city:value.city,address:value.address,checkedOn:value.checkedOn,
      checkedAt:value.checkedAt,products:Object.keys(value.products).length});
  }
  if (request.method !== "POST") return respond({error:"Нужен POST"},405);
  if (!bucket) return respond({error:"Хранилище не подключено"},503);
  const signature = request.headers.get("x-kbr-shelf-signature") || "";
  if (!writerKey || !/^[0-9a-f]{64}$/.test(signature) || !request.headers.get("content-type")?.startsWith("application/json"))
    return respond({error:"Требуется служебный запрос"},403);
  const raw = await request.text();
  if (raw.length > 250000) return respond({error:"Слишком большой пакет"},413);
  const encoder = new TextEncoder();
  const hmac = await crypto.subtle.importKey("raw", encoder.encode(writerKey), {name:"HMAC",hash:"SHA-256"}, false, ["verify"]);
  const signatureBytes = Uint8Array.from(signature.match(/../g), pair => parseInt(pair, 16));
  const signed = new URL(request.url).pathname + "\n" + raw;
  if (!await crypto.subtle.verify("HMAC", hmac, signatureBytes, encoder.encode(signed)))
    return respond({error:"Требуется служебный запрос"},403);
  const key = "moscow-prices/" + store;
  const previous = await bucket.get(key);
  try {
    const value = checkedShelf(rules[store],JSON.parse(raw).sections);
    if (previous) {
      const latest = await previous.json();
      if (latest.checkedOn === value.checkedOn && latest.revision === value.revision) return respond({status:"already-checked",products:Object.keys(latest.products).length});
    }
    const saved = await bucket.put(key,JSON.stringify(value),{onlyIf:previous ? {etagMatches:previous.etag} : {etagDoesNotMatch:"*"}});
    if (!saved) return respond({error:"Каталог обновился параллельно. Повторите запрос."},409);
    return respond({status:"updated",date:value.checkedOn,products:Object.keys(value.products).length});
  } catch (error) { return respond({error:error.message},422); }
}
