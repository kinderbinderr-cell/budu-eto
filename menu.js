/* Reference amounts are raw edible grams. Prices are editorial estimates in RUB per 100 g. */
const FOOD = {
  oats: ["Овсяные хлопья", 13, 6, 62, 14, "gluten"],
  apple: ["Яблоки", 0.4, 0.4, 11, 14],
  banana: ["Бананы", 1.5, 0.2, 21, 15],
  rice: ["Рис", 7, 0.7, 77, 12],
  buck: ["Гречневая крупа", 12.6, 3.3, 62, 10],
  lentil: ["Чечевица", 24, 1.5, 53, 23, "legumes"],
  chick: ["Нут консервированный", 7, 2.5, 19, 32, "legumes"],
  bean: ["Фасоль консервированная", 7, 0.5, 15, 31, "legumes"],
  pasta: ["Макароны", 12, 1.5, 70, 16, "gluten"],
  bread: ["Хлеб цельнозерновой", 9, 3, 44, 19, "gluten"],
  potato: ["Картофель", 2, 0.4, 17, 6],
  carrot: ["Морковь", 1.3, 0.1, 7, 6],
  tomato: ["Помидоры", 1, 0.2, 3.8, 23],
  cucumber: ["Огурцы", 0.8, 0.1, 3, 20],
  cabbage: ["Капуста белокочанная", 1.8, 0.1, 5, 7],
  zucchini: ["Кабачки", 0.6, 0.3, 5, 15],
  onion: ["Лук репчатый", 1.4, 0.2, 9, 7],
  paste: ["Томатная паста", 4, 0.5, 18, 37],
  egg: ["Яйца куриные", 12.7, 11, 0.7, 19, "egg"],
  curd: ["Творог", 17, 5, 2, 58, "milk"],
  yogurt: ["Йогурт натуральный", 4.5, 3.2, 5, 32, "milk"],
  milk: ["Молоко", 3, 3.2, 4.7, 10, "milk"],
  chicken: ["Куриное филе", 23, 2, 0, 48],
  fish: ["Филе минтая", 17, 1, 0, 54, "fish"],
  oil: ["Масло подсолнечное", 0, 100, 0, 18],
  dill: ["Укроп", 2.5, 0.5, 6, 75],
  flour: ["Мука пшеничная", 10.3, 1.1, 70.6, 9, "gluten"],
  raspberry: ["Малина", 1.2, 0.7, 8.3, 110],
  orzo: ["Паста орзо", 12, 1.5, 70, 26, "gluten"],
  basil: ["Базилик", 3.2, 0.6, 1.1, 160],
  salmon: ["Филе лосося", 20, 13, 0, 180, "fish"],
  mushroom: ["Шампиньоны", 3.1, 0.3, 3.3, 42],
  parsley: ["Петрушка", 3, 0.8, 6.3, 78],
  pumpkin: ["Тыква", 1, 0.1, 6.5, 15],
  // Per 100 g edible portion; budget values are estimates for planning.
  lemon: ["Лимон", 1.1, 0.3, 9.3, 22],
  garlic: ["Чеснок", 6.4, 0.5, 33.1, 38],
  paprika: ["Паприка молотая", 14.1, 12.9, 54, 320],
  cinnamon: ["Корица молотая", 4, 1.2, 80.6, 350],
  salt: ["Соль", 0, 0, 0, 6],
  mustard: ["Горчица столовая", 3.7, 3.3, 5.8, 54, "mustard"],
  butter: ["Масло сливочное", 0.9, 81.1, 0.1, 128, "milk"],
};
const originalRetailKeys = new Set(Object.keys(FOOD).concat("cumin"));
const RECIPES = [];
function add(
  id,
  title,
  slot,
  diet,
  equip,
  minutes,
  ingredients,
  steps,
  picture,
) {
  const items = Object.entries(ingredients);
  const macros = [1, 2, 3].map((k) =>
    items.reduce((v, [key, g]) => v + (FOOD[key][k] * g) / 100, 0),
  );
  const kcal = 4 * macros[0] + 9 * macros[1] + 4 * macros[2];
  const cost = items.reduce((v, [key, g]) => v + (FOOD[key][4] * g) / 100, 0);
  RECIPES.push({
    id,
    title,
    slot,
    diet,
    equip,
    minutes,
    items,
    steps,
    picture,
    macros,
    kcal,
    cost,
  });
}
add(
  "oats",
  "Овсянка с яблоком и корицей",
  "b",
  "vegan",
  "hob",
  18,
  { oats: 75, apple: 140, cinnamon: 1, salt: 0.5 },
  [
    "Половину яблока натрите крупно, остальное нарежьте тонкими дольками для подачи.",
    "Отмерьте по 3,5 мл воды на каждый грамм хлопьев, посолите и доведите до кипения.",
    "Всыпьте хлопья, добавьте тёртое яблоко и половину корицы, затем варите на слабом огне до мягкости по времени на упаковке.",
    "Снимите кашу с огня, пока она ещё медленно стекает с ложки, дайте постоять 2 минуты и добавьте свежие дольки с оставшейся корицей.",
  ].join(" "),
  "oats",
);
add(
  "banana",
  "Рисовая каша с банановым кремом",
  "b",
  "vegan",
  "hob",
  35,
  { rice: 75, banana: 120, cinnamon: 0.5, salt: 0.5 },
  [
    "Положите промытый рис в небольшую кастрюлю, добавьте соль и по 4 мл воды на грамм риса.",
    "Варите на тихом огне под неплотной крышкой 22–28 минут, изредка проводя ложкой по дну, пока зёрна не станут совсем мягкими.",
    "Половину спелого банана разомните вилкой с несколькими ложками горячей каши, вмешайте обратно в кастрюлю и выключите огонь.",
    "Нарежьте оставшийся банан кружками и положите сверху вместе с корицей перед подачей.",
  ].join(" "),
);
add(
  "eggs",
  "Скрэмбл на тосте с тёплыми томатами",
  "b",
  "veget",
  "hob",
  15,
  { egg: 100, bread: 60, tomato: 75, oil: 5, basil: 2, salt: 0.6 },
  [
    "Подсушите ломтики хлеба на сухой сковороде до румяных краёв и переложите на тарелки.",
    "Нарежьте томаты ломтиками и припустите минуту на половине масла, чтобы края размягчились, а середина держала форму.",
    "Вилкой смешайте яйца с солью, убавьте огонь и влейте смесь в освободившуюся сковороду с оставшимся маслом.",
    "Мягко собирайте яйца лопаткой со дна к центру и сразу переложите на тосты, когда свободной жидкости уже нет, а складки ещё блестят.",
    "Выложите томаты сверху и порвите над ними базилик.",
  ].join(" "),
  "eggs",
);
add(
  "curd",
  "Творожный крем с яблоком и корицей",
  "b",
  "veget",
  "cold",
  8,
  { curd: 160, yogurt: 60, apple: 150, cinnamon: 0.5, lemon: 6 },
  [
    "Разотрите половину творога ложкой с йогуртом до густого крема.",
    "Вмешайте оставшийся творог крупными хлопьями, чтобы в креме сохранилась текстура.",
    "Нарежьте яблоко небольшими кубиками, сбрызните лимонным соком и смешайте с корицей.",
    "Разложите крем по мискам и добавьте яблоко прямо перед едой, пока оно хрустит.",
  ].join(" "),
);
add(
  "oatjar",
  "Ночная овсянка с бананом и корицей",
  "b",
  "vegan",
  "cold",
  485,
  { oats: 65, banana: 130, cinnamon: 0.5, salt: 0.3 },
  [
    "Вечером смешайте хлопья в закрывающейся банке с корицей, солью и питьевой водой из расчёта 2 мл на грамм хлопьев.",
    "Хорошо перемешайте до дна, закройте банку и оставьте на 8 часов в холодильнике.",
    "Утром разомните половину банана, вмешайте в набухшие хлопья и при желании разбавьте ложкой воды.",
    "Оставшийся банан нарежьте перед едой и выложите кружками сверху.",
  ].join(" "),
);
add(
  "beanToast",
  "Тосты с фасолевым кремом и огурцом",
  "b",
  "vegan",
  "hob",
  12,
  { bread: 70, bean: 105, cucumber: 80, oil: 5, lemon: 10, dill: 2, salt: 0.5 },
  [
    "Подсушите хлеб на сухой сковороде до золотистых краёв, пока готовите начинку.",
    "Промойте и обсушите фасоль, разомните две трети с маслом и лимонным соком, оставив немного фасоли целой.",
    "Вмешайте целые бобы, укроп и соль, затем нарежьте огурец тонкими лентами.",
    "Намажьте тёплый хлеб густым кремом и сложите сверху ленты огурца непосредственно перед едой.",
  ].join(" "),
);
add(
  "fruit",
  "Фруктовый салат с нутом и лимонной заправкой",
  "b",
  "vegan",
  "cold",
  10,
  { apple: 130, banana: 100, chick: 90, lemon: 12, cinnamon: 0.5 },
  [
    "Откиньте готовый нут на сито, промойте и тщательно обсушите, чтобы с него не стекал рассол.",
    "Разомните треть спелого банана с лимонным соком и корицей в гладкую заправку.",
    "Сразу перемешайте нарезанное кубиками яблоко с заправкой, следом добавьте нут.",
    "Остальной банан нарежьте кружками и разложите поверх салата, чтобы он сохранил форму.",
  ].join(" "),
);
add(
  "buckapple",
  "Гречневая каша с тёплым яблоком",
  "b",
  "vegan",
  "hob",
  27,
  { buck: 75, apple: 140, cinnamon: 0.6, oil: 3, salt: 0.5 },
  [
    "Промойте гречку и залейте двумя объёмами воды, добавьте соль и доведите до кипения.",
    "Убавьте огонь и готовьте под крышкой 15–18 минут до впитывания воды, затем выключите и дайте постоять.",
    "Тем временем нарежьте яблоко дольками и обжарьте на тонком слое масла 3–4 минуты, чтобы одна сторона зарумянилась.",
    "Добавьте к яблокам корицу и ложку воды, встряхните сковороду и выложите тёплые дольки вместе с соком на рассыпчатую гречку.",
  ].join(" "),
);
add(
  "lentils",
  "Томатный суп из красной чечевицы с паприкой",
  "m",
  "vegan",
  "hob",
  35,
  {
    lentil: 75,
    carrot: 80,
    tomato: 100,
    onion: 40,
    oil: 8,
    paprika: 1,
    garlic: 2,
    lemon: 10,
    salt: 1,
  },
  [
    "Мелко нарежьте лук и морковь, обжарьте в масле 5–6 минут, пока лук не станет сладким и прозрачным.",
    "Добавьте измельчённый чеснок и паприку, через 20 секунд положите нарезанные томаты и прогрейте до выделения сока.",
    "Всыпьте промытую красную чечевицу, добавьте соль и по 4 мл воды на грамм сухой чечевицы.",
    "Томите при слабом кипении 15–20 минут до мягкости, затем разомните несколько ложек чечевицы о стенку кастрюли и размешайте.",
    "Снимите с огня и добавьте лимонный сок по вкусу.",
  ].join(" "),
  "lentils",
);
add(
  "chicken",
  "Курица с гречкой и лимонным соусом со сковороды",
  "m",
  "meat",
  "hob",
  30,
  {
    chicken: 140,
    buck: 75,
    carrot: 75,
    oil: 7,
    lemon: 15,
    garlic: 2,
    parsley: 3,
    salt: 1.3,
  },
  [
    "Залейте гречку двумя объёмами воды, добавьте часть соли и варите под крышкой 15–18 минут, пока крупа не впитает воду.",
    "Разрежьте толстое филе вдоль на пласты толщиной около 1,5 см, обсушите и посолите, а морковь нарежьте тонкими кружками.",
    "Выложите курицу в один слой на горячую сковороду с маслом, дайте нижней стороне подрумяниться 3–4 минуты и переверните.",
    "Когда центр филе достигнет 74 °C, переложите его на чистую тарелку, а в той же сковороде обжарьте морковь с чесноком и добавьте 30 мл воды на каждые 140 г филе.",
    "Соскребите румяные следы со дна, уварите жидкость с морковью до блеска, снимите с огня и полейте курицу лимонным соком, соусом и петрушкой.",
  ].join(" "),
  "chicken",
);
add(
  "fish",
  "Минтай в конверте с укропом и румяным картофелем",
  "m",
  "pesc",
  "oven",
  45,
  { fish: 160, potato: 240, oil: 9, dill: 4, lemon: 17, salt: 1.4 },
  [
    "Заранее разморозьте рыбу в холодильнике, а к началу готовки разогрейте духовку до 210 °C.",
    "Нарежьте картофель дольками толщиной около 1 см, перемешайте с большей частью масла и солью и запекайте одним слоем 18–22 минуты.",
    "Обсушите рыбу, уложите на лист бумаги для выпечки, добавьте остаток масла, соль, стебли укропа и тонкий ломтик лимона, затем плотно заверните края.",
    "Переверните картофель и положите рядом конверт на 10–15 минут, пока рыба не достигнет 63 °C в центре и не начнёт распадаться на влажные слои.",
    "Раскройте конверт, полейте рыбу и картофель выделившимся соком и добавьте свежие кончики укропа.",
  ].join(" "),
  "fish",
);
add(
  "chickpea",
  "Нут в пряном томатном соусе с рисом",
  "m",
  "vegan",
  "hob",
  30,
  {
    chick: 140,
    rice: 60,
    tomato: 100,
    paste: 15,
    oil: 7,
    garlic: 2,
    paprika: 1,
    lemon: 8,
    salt: 1,
  },
  [
    "Поставьте промытый рис вариться по соотношению воды и времени на пачке, затем дайте постоять под крышкой.",
    "Прогрейте измельчённый чеснок в масле, добавьте пасту и паприку и помешивайте полминуты, пока масло не станет оранжевым.",
    "Добавьте нарезанные томаты, промытый нут, соль и 50 мл воды на каждые 140 г нута, затем тушите 8–10 минут под крышкой.",
    "Раздавите часть нута вилкой прямо в соусе, разбавьте горячей водой до желаемой густоты и добавьте лимонный сок перед подачей с рисом.",
  ].join(" "),
  "chickpea",
);
add(
  "tomatoPasta",
  "Паста с томатами, чесноком и базиликом",
  "m",
  "vegan",
  "hob",
  25,
  {
    pasta: 90,
    tomato: 160,
    paste: 16,
    oil: 10,
    garlic: 2,
    basil: 4,
    salt: 1.5,
  },
  [
    "Поставьте воду для пасты, а в широкой сковороде на среднем огне прогрейте нарезанный чеснок в масле до аромата.",
    "Вмешайте томатную пасту, через полминуты добавьте нарезанные помидоры с соком и соль, раздавите кусочки и томите 6–8 минут.",
    "Сварите макароны в подсоленной воде на минуту меньше, чем указано на упаковке, и перед сливом сохраните около 60 мл отвара на каждые 90 г сухой пасты.",
    "Переложите макароны в соус, понемногу подливайте отвар и энергично перемешивайте минуту, пока соус не начнёт обволакивать завитки.",
    "Снимите с огня и вмешайте рваный базилик.",
  ].join(" "),
  "pasta",
);
add(
  "ricefish",
  "Рис с минтаем и обжаренным кабачком",
  "m",
  "pesc",
  "hob",
  30,
  { rice: 75, fish: 140, zucchini: 150, oil: 8, dill: 3, lemon: 14, salt: 1 },
  [
    "Используйте размороженное в холодильнике филе, а промытый рис поставьте вариться по инструкции на упаковке.",
    "Обсушите кабачок и нарежьте полукружьями толщиной 1 см, затем обжарьте в масле одним слоем до золотистого бока и переложите на тарелку.",
    "На той же сковороде припустите подсолённое филе под крышкой на слабом огне с 25 мл воды на каждые 140 г рыбы.",
    "Через 5 минут начните проверять середину куска и снимите с огня при 63 °C, когда слои рыбы легко расходятся.",
    "Добавьте к сокам со сковороды лимонный сок и укроп, верните кабачок и подайте с рыбой и рисом.",
  ].join(" "),
);
add(
  "tray",
  "Курица с паприкой, печёным картофелем и чесноком",
  "m",
  "meat",
  "oven",
  50,
  {
    chicken: 155,
    potato: 230,
    carrot: 90,
    oil: 9,
    garlic: 4,
    paprika: 1,
    lemon: 14,
    salt: 1.4,
  },
  [
    "Нагревайте духовку до 220 °C вместе с противнем, пока режете картофель и морковь кусочками по 2 см.",
    "Смешайте овощи с частью масла и соли и распределите одним слоем на горячем противне, затем запекайте 18–22 минуты до румяных краёв.",
    "Разрежьте толстое филе вдоль на пласты толщиной до 2 см, натрите оставшимся маслом, паприкой, мелко нарезанным чесноком и солью.",
    "Переверните овощи, добавьте филе и запекайте ещё 10–16 минут, проверяя температуру в самой толстой части курицы.",
    "Как только филе достигнет 74 °C, переложите на чистую тарелку на 3 минуты, после чего нарежьте и подайте с овощами, соком с противня и лимоном.",
  ].join(" "),
);
add(
  "buckveg",
  "Гречка с румяной капустой и паприкой",
  "m",
  "vegan",
  "hob",
  30,
  {
    buck: 85,
    cabbage: 160,
    carrot: 60,
    oil: 10,
    paprika: 1,
    lemon: 8,
    salt: 1,
  },
  [
    "Промойте гречку и варите под крышкой с двумя объёмами воды и частью соли, пока крупа не впитает жидкость.",
    "Тонко нашинкуйте капусту и морковь, разогрейте широкую сковороду и разложите капусту на масле тонким слоем.",
    "Оставьте на 2–3 минуты без перемешивания, затем переверните подрумяненную капусту и добавьте морковь, паприку и оставшуюся соль.",
    "Влейте 25 мл воды на каждые 160 г капусты, накройте на 4–5 минут, а затем снимите крышку и выпарите жидкость.",
    "Вмешайте рассыпчатую гречку и освежите готовое блюдо лимонным соком.",
  ].join(" "),
);
add(
  "eggpot",
  "Картофельная фриттата с томатами и укропом",
  "m",
  "veget",
  "oven",
  45,
  { egg: 150, potato: 180, tomato: 90, oil: 6, dill: 3, salt: 1 },
  [
    "Включите духовку на 200 °C, нарежьте картофель пластинками толщиной 2–3 мм, а помидоры — тонкими дольками.",
    "Смажьте небольшую форму маслом, выложите картофель тонким слоем, посолите и запекайте около 20 минут, пока кончик ножа не войдёт легко.",
    "Смешайте яйца вилкой с рубленым укропом и оставшейся солью, залейте картофель и разложите помидоры по поверхности.",
    "Уменьшите температуру до 180 °C и пеките 10–15 минут до мягко схватившейся середины, ориентир внутри яичной смеси — 71 °C.",
    "Дайте постоять в форме 3 минуты и нарежьте на порции.",
  ].join(" "),
);
add(
  "beans",
  "Фасоль с хрустящей капустой и лимонным укропом",
  "m",
  "vegan",
  "cold",
  15,
  {
    bean: 200,
    cabbage: 120,
    carrot: 65,
    oil: 12,
    lemon: 15,
    dill: 3,
    salt: 0.8,
  },
  [
    "Промойте готовую фасоль и дайте воде полностью стечь, пока тонко шинкуете капусту и трёте морковь.",
    "Добавьте к капусте соль и разомните ладонями буквально полминуты, чтобы полоски стали гибкими и сохранили хруст.",
    "Разотрите ложку фасоли с лимонным соком и маслом до густой заправки, затем вмешайте мелко нарезанный укроп.",
    "Соедините фасоль и овощи с заправкой и дайте постоять 3 минуты перед подачей.",
  ].join(" "),
);
add(
  "vegbowl",
  "Нут с томатами, огурцом и лимонной петрушкой",
  "m",
  "vegan",
  "cold",
  15,
  {
    chick: 210,
    cucumber: 100,
    tomato: 100,
    oil: 10,
    parsley: 4,
    lemon: 15,
    garlic: 1,
    salt: 0.8,
  },
  [
    "Нарежьте помидоры кубиками прямо над миской, чтобы сохранить сок, и слегка посолите.",
    "Промойте нут и дайте стечь воде, затем разрежьте огурец вдоль и нарежьте некрупными кусочками.",
    "Смешайте выделившийся томатный сок с лимонным соком, маслом и мелко натёртым чесноком.",
    "Добавьте нут и огурец, перемешайте и дайте постоять 5 минут, а рубленую петрушку положите перед подачей.",
  ].join(" "),
);
add(
  "saladcurd",
  "Творог с укропом и салатом из томатов и огурца",
  "m",
  "veget",
  "cold",
  12,
  {
    curd: 170,
    cucumber: 100,
    tomato: 80,
    bread: 65,
    yogurt: 25,
    dill: 3,
    lemon: 8,
    salt: 0.7,
  },
  [
    "Смешайте творог с йогуртом, частью соли и рубленым укропом, разминая крупные комочки до мягкого крема.",
    "Нарежьте помидоры и огурец крупными ломтиками и слегка посолите непосредственно перед подачей.",
    "Смешайте лимонный сок с выделившимся томатным соком и обваляйте в заправке овощи.",
    "Выложите овощи рядом с творогом, полейте оставшейся заправкой и подайте с ломтиками хлеба.",
  ].join(" "),
);
add(
  "ovenveg",
  "Печёные овощи с хрустящим нутом и паприкой",
  "m",
  "vegan",
  "oven",
  45,
  {
    chick: 160,
    zucchini: 130,
    potato: 160,
    oil: 10,
    paprika: 1,
    garlic: 2,
    lemon: 12,
    salt: 1,
  },
  [
    "Разогревайте духовку до 220 °C, нарежьте картофель кубиками по 1,5 см, а кабачок — более крупными кусками.",
    "Смешайте картофель с частью масла и соли, разложите одним слоем и запекайте 15 минут.",
    "Обсушите промытый нут полотенцем и смешайте с кабачком, оставшимся маслом, солью и паприкой.",
    "Переверните картофель, добавьте нут и кабачок и запекайте ещё 15–20 минут до румяных боков, за последние 3 минуты вмешайте нарезанный чеснок.",
    "Подавайте сразу и сбрызните лимонным соком уже в тарелке, чтобы поверхность нута осталась хрустящей.",
  ].join(" "),
);
const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
function initial(mode) {
  return {
    mode,
    adults: 2,
    small: 0,
    budget: 5000,
    diet: "all",
    exclude: [],
    equipment: ["hob", "oven"],
    cook: [0, 2, 4, 6],
    votes: {},
    likes: [],
    maxMinutes: 0,
    stores: [],
    age: 30,
    height: 170,
    weight: 70,
    sex: "female",
    activity: 1.4,
    ratio: "balanced",
    targetMode: "auto",
    target: 2100,
    week: 0,
  };
}
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
  if(!targets) return;
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
  const baselineAllowed=base.every((r,i)=>options[i].includes(r)) && permitted(base[1],base[2]);
  let best=baselineAllowed ? search.assess(base) : {worst:Infinity,sum:Infinity};
  let selected=base;
  let bestPriority=baselineAllowed ? base.reduce((sum,r,i)=>sum+priority(r,i),0) : Infinity;
  const queue=[];
  for(const breakfast of choices[0]) for(const lunch of choices[1]) for(const dinner of choices[2]) {
    if(!permitted(lunch.r,dinner.r)) continue;
    const bound=search.lowerBound(breakfast.vector,lunch.vector,dinner.vector,best.worst);
    if(bound>best.worst+1e-10) continue;
    const order=breakfast.priority+lunch.priority+dinner.priority;
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
function eligible(s, r) {
  return (
    allowed(s, r) &&
    (s.strictTaste ? s.votes[r.id] === 1 : s.votes[r.id] !== -1)
  );
}
function manualCandidate(s, r, slot) {
  return Boolean(r && r.slot === (slot === 0 ? "b" : "m") && allowed(s,r) && s.votes[r.id] !== -1);
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
  const recent = precedingDays.slice(-2).map(day => new Set(day.meals.map(m => m.r.id)));
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
      pairMisses.push(pairDayMeals(pairSearch,meals,options,priority));
      for(const {r} of meals) timesServed.set(r,(timesServed.get(r)||0)+1);
    } else applyDailyTargets(s,meals);
    for (const {r,f} of meals) {
      for (const [key, g] of r.items) counts[key] = (counts[key] || 0) + g * f;
      daily.forEach((_, j) => (daily[j] += r.macros[j] * f));
      cost += r.cost * f;

    }
    recent.push(new Set(meals.map(m => m.r.id)));
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
