// Update each shelf independently. checkedShelf verifies every section against the same Moscow branch and date.
import {readFile,writeFile,rename} from "node:fs/promises";
import {checkedShelf} from "../server/moscow-prices.mjs";
const [catalogPath,rulesPath,observationsPath]=process.argv.slice(2);
const source=await readFile(catalogPath,"utf8"), marker="const referenceCatalogs = ";
const split=source.indexOf(marker);
if(split<0) throw Error("В файле нет московских витрин");
const shelves=JSON.parse(source.slice(split+marker.length).trim().replace(/;$/,""));
const rules=JSON.parse(await readFile(rulesPath,"utf8"));
const incoming=JSON.parse(await readFile(observationsPath,"utf8"));
let confirmed=0;
for(const [id,config] of Object.entries(rules)) {
  const rows=incoming[id], branch=rows?.[0];
  if(!branch) continue;
  try {
    if(!branch.branch || !branch.address) throw Error("Нет адреса");
    const shelf=checkedShelf({...config,slug:branch.branch,address:branch.address},rows);
    if(shelf.checkedOn>=shelves[id].checkedOn) shelves[id]=shelf;
    confirmed++;
    console.log(id,shelf.address,shelf.checkedOn,Object.keys(shelf.products).length);
  } catch(e) {console.error(id,e.message);}
}
if(!confirmed) throw Error("Свежие московские цены не подтверждены");
const updated=source.slice(0,split)+marker+JSON.stringify(shelves)+";";
await writeFile(catalogPath+".tmp",updated);
await rename(catalogPath+".tmp",catalogPath);
