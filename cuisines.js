// Tags describe the cooking tradition of this version. A shared dish can appear
// in several cuisines; everyday combinations have their own shelf.
const cuisineNames = {
  everyday: "Просто домашняя",
  russian: "Русская", karelian: "Карельская", tatar: "Татарская", bashkir: "Башкирская",
  ossetian: "Осетинская", dagestani: "Дагестанская", georgian: "Грузинская",
  armenian: "Армянская", azerbaijani: "Азербайджанская", turkish: "Турецкая",
  uzbek: "Узбекская", kazakh: "Казахская", kyrgyz: "Кыргызская", crimeanTatar: "Крымскотатарская",
  italian: "Итальянская", greek: "Греческая", french: "Французская",
  spanish: "Испанская", portuguese: "Португальская", swiss: "Швейцарская",
  ukrainian: "Украинская", belarusian: "Белорусская", polish: "Польская",
  czech: "Чешская", slovak: "Словацкая", austrian: "Австрийская", german: "Немецкая",
  swedish: "Шведская", finnish: "Финская", hungarian: "Венгерская",
  serbian: "Сербская", bulgarian: "Болгарская", romanian: "Румынская",
  maghrebi: "Магрибская", mexican: "Мексиканская"
};

// Tile order in the bundled flag sheet. Maghreb uses three flags for the region.
const cuisineFlagOrder = "russian georgian armenian azerbaijani turkish uzbek kazakh kyrgyz italian greek french spanish portuguese swiss ukrainian belarusian polish czech slovak austrian german swedish finnish hungarian serbian bulgarian romanian mexican karelian tatar bashkir ossetian dagestani crimeanTatar maghrebi".split(" ");
function cuisineFlag(key) {
  if (key === "everyday") return `<i class="cuisine-flag home-flag" aria-hidden="true">${icon("pot",18)}</i>`;
  const index = cuisineFlagOrder.indexOf(key);
  if (index < 0) return "";
  return `<i class="cuisine-flag" aria-hidden="true" style="background-position-x:${-22 * index}px"></i>`;
}
function cuisineLabel(key) {
  return `<span class="cuisine-name">${cuisineFlag(key)}${$(cuisineNames[key])}</span>`;
}

const existingCuisineIds = {
  everyday: "rd029",
  russian: `buckapple syrniki mushroomBuck rb001 rb002 rb003 rb004 rb006 rb010 rb012 rb013
    rb016 rb019 rb020 rb022 rb023 rb024 rb025 rb026 rb027 rb030 rb035 rb037 rb038 rb059 rb060
    rb061 rb062 rb063 rb064 rb069 rb070 rb072 rb073 rb076 rb077 rb078 rb080 rb085 rb089 rb092 rb094 rb096
    rl002 rl003 rl004 rl006 rl008 rl009 rl015 rl019 rl021 rl022 rl023 rl029 rl030 rl033 rl036 rl041 rl042 rl043 rl044
    rl054 rl062 rl070 rl071 rl074 rl075 rl078 rl083 rl084 rl085 rl088 rl089 rl092 rl097 rl101 rl103 rl105
    rd001 rd007 rd016 rd018 rd020 rd021 rd022 rd023 rd024 rd026 rd034 rd035 rd043 rd045 rd046
    rd047 rd050 rd051 rd052 rd053 rd057 rd061 rd062 rd063 rd065 rd066 rd068 rd071 rd073 rd074 rd079
    rd087 rd088 rd094 rd101 rd102 rd106 rd109 rd112 rd121 rd124 rd129 rd131 rd133 rd140`,
  ukrainian: `syrniki rb021 rb024 rb029 rb061 rb062 rl001 rl007 rl013 rl020 rl063 rl068 rl069
    rl079 rl093 rl096 rd021 rd092 rd110 rd117`,
  belarusian: "rb028 rb037 rb095 rl063 rl064 rd033",
  tatar: "rb032 rd025 rd039 rd091 rd115",
  bashkir: "rb032 negubadiya webalish nekullama rd115",
  ossetian: "rl008 rb010 rd003 nesatsivi", dagestani: "nedushbara webozbash wedovga rd021",
  karelian: "rb031 wcKarjalanpaisti ncVispipuuro rl018", crimeanTatar: "rd118 weimam rd029 rb001",
  georgian: "rd003 rd015 rd049 rd114", azerbaijani: "rd116",
  uzbek: "rd096 rd098 rd113", kazakh: "rd098", kyrgyz: "rd098 rd113 welagman wekuurdak rd096 nekespe wesamsa reTalkan",
  italian: "tomatoPasta eggpot breadTomatoSoup curdGnocchi rb066 rl060",
  french: "berryToast rb044 rd005", spanish: "panTomate rl034",
  swiss: "potatoRosti appleBircher", polish: "rl065 rd111",
  finnish: "rl018 rb031", maghrebi: "shakshuka", mexican: "rd125"
};

for (const [cuisine,ids] of Object.entries(existingCuisineIds)) {
  for (const id of ids.trim().split(/\s+/)) {
    const recipe=RECIPES.find(r=>r.id===id);
    (recipe.cuisines ??= []).push(cuisine);
  }
}
for (const recipe of RECIPES) recipe.cuisines ??= ["everyday"];

const representedCuisines=new Set(RECIPES.flatMap(r=>r.cuisines));
const bookCuisines=Object.fromEntries([
  ["all","Все кухни"],
  ...Object.entries(cuisineNames)
    .filter(([key])=>representedCuisines.has(key))
    .sort((a,b)=>a[1].localeCompare(b[1],"ru"))
]);
