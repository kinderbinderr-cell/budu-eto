"""Refresh Moscow city prices from the public Rosstat table and Mosstat's weekly bulletin.
Only replace observations with newer comparable rates. Run with no secrets or browser cookies.
"""
from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import urlencode, urljoin, urlparse, quote, unquote

PAGE = 'https://www.fedstat.ru/indicator/31448'
WEEKLY = 'https://77.rosstat.gov.ru/folder/65045'
MOSCOW = 'Город Москва столица Российской Федерации город федерального значения'
MONTHS = 'января февраля марта апреля мая июня июля августа сентября октября ноября декабря'.split()
# Indicator 31448, item dimension. Only map structurally comparable retail products.
IDS = dict(oats=1754738,apple=1743471,banana=1754800,rice=1755068,buck=1755104,
 pasta=1709722,pastaShells=1709722,pastaNests=1709722,potato=1743470,carrot=1743475,
 tomato=1755033,cucumber=1743457,cabbage=1743463,onion=1755134,egg=1709749,
 curd=1846520,yogurt=1846538,milk=1709745,oil=1846527,flour=1755145,lemon=1754730,
 garlic=1754742,salt=1755092,butter=1709734,beef=1709713,beet=1754741,
 herring=1754739,honey=1754734,kefir=1856405,millet=1755036,pear=1754750,
 processedCheese=1754709,ryeBread=1709733,semolina=1754784,sourCream=1709793,
 sugar=1709795,vermicelli=1755172,cream=1836489,cheese=1848409,pork=1709731,
 chickenLiver=1856496,brynza=1754790,adygheCheese=1754790,frankfurters=1743458)
PREFIX='const cityObservations = '
def request(url,data=None):
    args=['curl','--fail','--silent','--show-error','--location','--connect-timeout','6','--max-time','36','--retry','1','--max-filesize','8000000']
    if data is not None:args+=['--data-binary','@-']
    return subprocess.run(args+[url],input=data,stdout=subprocess.PIPE,check=True).stdout
def clean(s):
    return ' '.join(unescape(s).replace('ё','е').lower().split())
def kopecks(s):
    d=Decimal(s.replace(' ','').replace('\xa0','').replace(',','.'))*100
    if not d.is_finite() or d != d.to_integral_value() or not 0 < d < 2_000_000:
        raise ValueError('invalid published price')
    return int(d)
def unit(label):
    u=clean(label).rsplit(',',1)[-1].strip().rstrip('.')
    return {'кг':'kg','л':'l','10 шт':'10pcs'}.get(u)
def obs(label,raw,period,source):
    return dict(category=unescape(label),unit=unit(label),kopecks=kopecks(raw),period=period,source=source)
def period_end(p):
    return date.fromisoformat(p) if len(p)==10 else date.fromisoformat(p+'-'+str(monthrange(int(p[:4]),int(p[5:7]))[1]))
def fedstat(today):
    # Match values to the public selector by item id and exact returned row title.
    page=request(PAGE).decode()
    page=re.sub(r'\\u([a-fA-F0-9]{4})',lambda m:chr(int(m[1],16)),page)
    spec=dict((int(i),unescape(name)) for i,name in re.findall(r"(\d+):\s*\{\s*title: '([^']+)',\s*order:",page))
    if spec.get(1688506)!=MOSCOW or spec.get(950351)!='рубль': raise ValueError('unverified city or currency')
    # Read the period ids from the publication, including across New Year.
    names='январь февраль март апрель май июнь июль август сентябрь октябрь ноябрь декабрь'.split()
    months={i:names.index(v)+1 for i,v in spec.items() if v in names}
    if len(months)!=12: raise ValueError('invalid period selector')
    groups={}
    day=today.replace(day=1)
    for _ in range(4):
        day=day-timedelta(days=1);groups.setdefault(day.year,[]).append(day.month);day=day.replace(day=1)
    result={}
    for year,selected in groups.items():
        if year not in spec: continue
        terms={'0':[31448],'30611':[950351],'57831':[1688506],'58273':sorted(set(IDS.values())),'3':[year],'33560':[k for k,m in months.items() if m in selected]}
        form=[('lineObjectIds',k) for k in ['0','30611','57831','58273']]+[('columnObjectIds',k) for k in ['3','33560']]
        form += [('selectedFilterIds',k+'_'+str(v)) for k,values in terms.items() for v in values]
        rows=json.loads(request('https://www.fedstat.ru/indicator/dataGrid.do?id=31448',urlencode(form).encode()))['results']
        for row in rows:
            if row['dim57831']!=MOSCOW or row['dim30611']!='рубль': raise ValueError('unexpected region or currency')
            name=unescape(row['dim58273'])
            keys=[k for k,id_ in IDS.items() if spec.get(id_)==name]
            if not keys or not unit(name): raise ValueError('unmatched product or unit: '+name)
            for col,raw in row.items():
                m=re.fullmatch(r'dim(\d{4})_(\d+)_d\d+_i\d+',col)
                if not m or not raw or str(raw).strip() in ('-','…','...'):continue
                mo=months.get(int(m[2]))
                if int(m[1])!=year or mo not in selected: raise ValueError('unexpected period')
                period=f'{year}-{mo:02}'
                for key in keys:
                    if period>result.get(key,{}).get('period',''):result[key]=obs(name,str(raw),period,PAGE)
    if len(result)<28: raise ValueError('incomplete Moscow table')
    return result
class Links(HTMLParser):
    def __init__(self):
        super().__init__();self.links=[];self.a=None
    def handle_starttag(self,t,attrs):
        if t=='a': self.a=[dict(attrs).get('href',''),'']
    def handle_data(self,x):
        if self.a is not None:self.a[1]+=' '+x
    def handle_endtag(self,t):
        if t=='a' and self.a:
            self.links.append(self.a);self.a=None
def weekly(today, catalog):
    html=Links();html.feed(request(WEEKLY).decode())
    candidates=[]
    for href,label in html.links:
        url=urljoin(WEEKLY,href)
        if urlparse(url).hostname!='77.rosstat.gov.ru' or not urlparse(url).path.lower().endswith('.pdf'):continue
        m=re.search(r'\bна\s+(\d{1,2})\s+([а-я]+)\s+(20\d\d)\s+года',clean(label+' '+unquote(href)))
        if m and m[2] in MONTHS:
            dt=date(int(m[3]),MONTHS.index(m[2])+1,int(m[1]))
            if dt<=today:candidates.append((dt,url))
    if not candidates:raise ValueError('no dated weekly Moscow PDF')
    dt,url=max(candidates);url=quote(unquote(url),safe=':/')
    pdf=request(url)
    if not pdf.startswith(b'%PDF'):raise ValueError('not a PDF')
    try:
        s=subprocess.run(['pdftotext','-layout','-','-'],input=pdf,stdout=subprocess.PIPE,check=True).stdout.decode()
    except FileNotFoundError:
        from io import BytesIO
        from pypdf import PdfReader
        s='\n'.join(p.extract_text(extraction_mode='layout') for p in PdfReader(BytesIO(pdf)).pages)
    title=clean(s[:1300]); day=re.search(r'на\s+(\d{1,2})\s+([а-я]+)\s+(20\d\d)',title)
    if 'в москве' not in title or 'в московской области' in title or not day or (int(day[1]),day[2],int(day[3]))!=(dt.day,MONTHS[dt.month-1],dt.year): raise ValueError('weekly territory or observation date mismatch')
    found={}
    for line in s.splitlines():
        # First number following the unit is the price in rubles, never the change in percent.
        m=re.match(r'^\s*(.+?,\s*(?:кг|л|10\s*шт\.?))\s+(\d{1,3}(?:[ \xa0]\d{3})*[,.]\d{2})(?:\s|$)',line,re.I)
        if not m:continue
        for key,v in catalog.items():
            if clean(m[1]).rstrip('.')==clean(v['category']).rstrip('.'):
                found[key]=obs(v['category'],m[2],dt.isoformat(),url)
    if len(found)<14:raise ValueError('weekly layout incomplete')
    return found
# Week labels in EMISS are observation numbers (not ISO weeks), with no date.
# Verify the observation date using the city government's dated Moscow basket.
# Its rates are displayed to tenths; the prices we publish are EMISS kopecks.
WEEK_SERIES='https://www.fedstat.ru/indicator/37426'
CITY_CHECK='https://ac.mos.ru/special-projects/moscow-citizen-basket/'
CHECK_ITEMS={'Молоко (1 л)':'milk','Яйца (10 шт.)':'egg','Сахар (1 кг)':'sugar',
             'Мука пшеничная (1 кг)':'flour','Вермишель (1 кг)':'vermicelli',
             'Картофель (1 кг)':'potato','Гречка (1 кг)':'buck','Растительное масло (1 л)':'oil'}
def city_checkpoint(page,today):
    h=re.search(r'<h2\b[^>]*class="basket-chart__title"[^>]*>(.*?)</h2>',page,re.S)
    title=clean(re.sub('<[^>]*>',' ',h[1])) if h else ''
    m=re.search(r'цены на (\d{1,2}) ([а-я]+) (20\d\d) года',title)
    if not m or m[2] not in MONTHS:raise ValueError('missing official basket observation date')
    dt=date(int(m[3]),MONTHS.index(m[2])+1,int(m[1]))
    if dt>today:raise ValueError('future Moscow observation')
    rates={}
    for card in re.split(r'<div\s+data-product="[^"]+"\s+class="product-basket-section">',page)[1:]:
        raw=re.search(r'class="basket-container__price">\s*([\d ,\xa0]+)\s+р\.',card)
        name=re.search(r'class="product-basket-section__title">(.*?)</div>',card,re.S)
        if not raw or not name:continue
        name=' '.join(unescape(re.sub('<[^>]*>',' ',name[1])).split())
        if name not in CHECK_ITEMS:continue
        key=CHECK_ITEMS[name]
        if key in rates:raise ValueError('duplicate city checkpoint')
        rates[key]=kopecks(raw[1])
    if len(rates)<6:raise ValueError('insufficient dated city checkpoints')
    return dt,rates

def weekly_from_grid(rows,catalog,dt,anchors):
    labels={}
    for k,item in catalog.items():labels.setdefault(clean(item['category']),[]).append(k)
    periods={}
    for row in rows:
        if row.get('dim57831')!=MOSCOW or row.get('dim30611')!='рубль' or clean(row.get('dim0',''))!='еженедельные средние потребительские цены (тарифы) на отдельные товары и услуги':
            raise ValueError('wrong weekly geography, currency or indicator')
        m=re.fullmatch(r'(\d{1,2}) неделя (20\d\d)',row['dim33560'])
        if not m or int(m[2])!=dt.year:raise ValueError('invalid observation period')
        keys=labels.get(clean(row['dim58273']),[])
        if not keys:continue
        values=[str(v) for k,v in row.items() if re.fullmatch(r'dim'+str(dt.year)+r'_d\d+_i\d+',k) and v is not None and str(v).strip() not in ('','-','…','...')]
        if not values:continue
        if len(values)!=1:raise ValueError('ambiguous weekly rate')
        bucket=periods.setdefault(int(m[1]),{})
        for k in keys:
            if k in bucket:raise ValueError('duplicate official weekly item')
            bucket[k]=obs(catalog[k]['category'],values[0],dt.isoformat(),WEEK_SERIES)
    # Require all checkpoints and one unambiguous match. No calendar arithmetic,
    # no date inferred from publication/check time, no silent use of a different week.
    matches=[(week,items) for week,items in periods.items() if len(items)>=14 and
             all(k in items and (items[k]['kopecks']+5)//10*10==cents for k,cents in anchors.items())]
    if len(matches)!=1:raise ValueError('unable to verify a unique Moscow observation date')
    week,items=matches[0]
    print('Verified EMISS observation week',week,'against',len(anchors),'dated municipal prices')
    return items
def weekly_emiss(today,catalog):
    dt,anchors=city_checkpoint(request(CITY_CHECK).decode(),today)
    # Rows carry the explicit observation label and geography. Ignore non-matching
    # products, do not substitute similar meats, cuts or units.
    terms={0:[37426],30611:[950351],57831:[1688506],58273:sorted(set(IDS.values())),3:[dt.year]}
    form=[('lineObjectIds',k) for k in [0,30611,57831,58273,33560]]+[('columnObjectIds',3)]
    form += [('selectedFilterIds',f'{k}_{v}') for k,values in terms.items() for v in values]
    rows=json.loads(request('https://www.fedstat.ru/indicator/dataGrid.do?id=37426',urlencode(form).encode()))['results']
    return weekly_from_grid(rows,catalog,dt,anchors)

def main(path):
    prev=json.loads(path.read_text().removeprefix(PREFIX).strip().removesuffix(';')) if path.exists() else {}
    merged=dict(prev);ok=0
    for fn in (lambda:fedstat(date.today()),lambda:weekly_emiss(date.today(),merged),lambda:weekly(date.today(),merged)):
        try:
            rows=fn()
            for k,r in rows.items():
                prior=merged.get(k)
                if not prior or period_end(r['period'])>=period_end(prior['period']):merged[k]=r
            ok+=1;print('Read',len(rows),'city rates; newest period',max(r['period'] for r in rows.values()))
        except Exception as e:print('Source unavailable:',e,file=sys.stderr)
    if not ok or len(merged)<28:raise SystemExit('No valid update; kept previous snapshot')
    output=PREFIX+json.dumps(merged,ensure_ascii=False,sort_keys=True,indent=2)+';\n'
    path.with_suffix('.tmp').write_text(output);path.with_suffix('.tmp').replace(path)
if __name__=='__main__':main(Path(sys.argv[1]))
