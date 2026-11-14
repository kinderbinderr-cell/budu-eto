"""Exchange a checked public Moscow price snapshot with the existing regional collector."""
import json
import re
import sys
from datetime import datetime, timezone, timedelta, date
from pathlib import Path
from urllib.parse import urlparse
from runpy import run_path
lib=run_path(str(Path(__file__).with_name('city-prices.py')))
PREFIX=lib['PREFIX']
def read_snapshot(path):return json.loads(path.read_text().removeprefix(PREFIX).strip().removesuffix(';'))
def write(path,text):
    tmp=path.with_suffix('.stage');tmp.write_text(text);tmp.replace(path)
def publish(feed,path):
    data=json.loads(feed.read_text())
    stamp=datetime.fromisoformat(data['retrievedAt'])
    if not timedelta(0)<=datetime.now(timezone.utc)-stamp<=timedelta(hours=36):raise ValueError('collector check too old')
    prior=read_snapshot(path);rows=data['prices']
    if not set(rows)<=set(lib['IDS']) or len(rows)<28:raise ValueError('bad city coverage')
    for key,r in rows.items():
        if not isinstance(r['category'],str) or not 0<len(r['category'])<180:raise ValueError('invalid category')
        if type(r['kopecks']) is not int or not 0<r['kopecks']<2_000_000:raise ValueError('invalid price')
        if r['unit']!=lib['unit'](r['category']) or r['unit'] not in ('kg','l','10pcs'):raise ValueError('invalid unit')
        if key in prior and (r['unit']!=prior[key]['unit'] or r['category']!=prior[key]['category']):raise ValueError('changed category')
        link=urlparse(r['source'])
        if r['source'] not in (lib['PAGE'],lib['WEEK_SERIES']) and not (link.scheme=='https' and link.netloc=='77.rosstat.gov.ru' and link.path.startswith('/storage/') and link.path.lower().endswith('.pdf')):raise ValueError('invalid public source')
        p=r['period']
        if not re.fullmatch(r'20\d\d-\d\d(?:-\d\d)?',p) or lib['period_end'](p)>date.today():raise ValueError('invalid observation period')
        if key not in prior or lib['period_end'](p)>=lib['period_end'](prior[key]['period']):prior[key]=r
    write(path,PREFIX+json.dumps(prior,ensure_ascii=False,sort_keys=True,indent=2)+';\n')
    print('Validated',len(rows),'Moscow prices; newest observation:',max(r['period'] for r in prior.values()))
if __name__=='__main__':
    mode,a,b=sys.argv[1:];a,b=Path(a),Path(b)
    if mode=='collect':
        lib['main'](a)
        write(b,json.dumps(dict(retrievedAt=datetime.now(timezone.utc).isoformat(),prices=read_snapshot(a)),ensure_ascii=False))
    elif mode=='publish':publish(a,b)
    else:raise SystemExit('unknown command')
