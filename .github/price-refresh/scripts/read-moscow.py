"""Read ordinary public storefront pages. Return only the selected grocery offers."""
import argparse
import concurrent.futures
import datetime
import hashlib
import hmac
import json
import os
import re
import sys
import urllib.request

SITE = 'https://za-stol-menu-kbr.kbrcore.chatgpt.site'
DAY = datetime.timezone(datetime.timedelta(hours=3))

class SameSiteOnly(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        raise ValueError("Служебный адрес потребовал перенаправление")

def site(path, body=None):
    headers = {'OAI-Sites-Authorization': 'Bearer ' + os.environ['KBR_SITE_ACCESS']}
    if body is not None:
        headers['Content-Type'] = 'application/json'
        body = json.dumps(body, ensure_ascii=False).encode()
        key = hashlib.sha256(b'kbr-syt:moscow-writer:v1:' + os.environ['KBR_SITE_ACCESS'].encode()).hexdigest().encode()
        headers['X-KBR-Shelf-Signature'] = hmac.new(key, path.encode() + b'\n' + body, hashlib.sha256).hexdigest()
    with urllib.request.build_opener(SameSiteOnly).open(urllib.request.Request(SITE + path, data=body, headers=headers),timeout=50) as response:
        return json.load(response)

def collect(config, any_moscow_branch=False):
    wanted = {r['uid'] for choices in config['goods'].values() for r in choices}
    def read(section):
        category, url = section
        with urllib.request.urlopen(url,timeout=28) as response:
            if response.geturl() != url:
                raise ValueError('Адрес витрины изменился')
            html = response.read(12000001)
        if len(html) > 12000000:
            raise ValueError('Страница слишком велика')
        doc = html.decode()
        marker = re.search(r'window\.serverData\s*=\s*',doc)
        if not marker:
            raise ValueError('Витрина не прислала каталог')
        data = json.JSONDecoder().raw_decode(doc[marker.end():])[0]
        queries = data['queryClientCache']['queries']
        place = next(q['state']['data'] for q in queries if q['queryKey'][:2] == ['catalog','shopBySlug'])
        if (place['brandSlug'],place['address']['city'],place['regionSlug'],place['currency']['code']) != (config['brand'],'Москва','moscow','RUB'):
            raise ValueError('Витрина не подтвердила сеть, Москву и рубли')
        if not any_moscow_branch and (place['slug'],place['address']['short']) != (config['slug'],config['address']):
            raise ValueError('Филиал не совпадает')
        current = next(q['state'] for q in queries if q['queryKey'][:2] == ['menu','goods'] and
            q['queryKey'][2].get('slug') == place['slug'] and str(q['queryKey'][2].get('category_uid')) == category)
        if not current['data'].get('categories'):
            raise ValueError('Раздел не подтверждён')
        fields = ['uid','slug','name','weight','weight_data','available','inStock','decimalPrice']
        items = [{k:i[k] for k in fields if k in i} for c in current['data']['categories'] for i in c.get('items',[])
                 if i.get('uid') in wanted]
        return {'id':category,'at':current['dataUpdatedAt'],'branch':place['slug'],'address':place['address']['short'],
                'city':place['address']['city'],'currency':place['currency']['code'],'brand':place['brandSlug'],'items':items}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        return list(executor.map(read,config['categories'].items()))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--local-rules')
    parser.add_argument('--moscow-branch',action='store_true',help='Принять московский филиал, указанный открытой витриной')
    parser.add_argument('--store',choices=['perekrestok','pyaterochka'])
    args = parser.parse_args()
    configs = json.load(open(args.local_rules,encoding='utf-8')) if args.local_rules else site('/api/moscow/rules')
    collected, failures = {}, []
    today = datetime.datetime.now(DAY).date().isoformat()
    for store,config in configs.items():
        if args.store and args.store != store: continue
        try:
            if not args.local_rules:
                old = site('/api/moscow/prices/' + store)
                if old.get('saved') and old['checkedOn'] == today:
                    print(store, 'уже проверено',today)
                    continue
            sections = collect(config,args.moscow_branch and bool(args.local_rules))
            if args.local_rules: collected[store] = sections
            else:
                result = site('/api/moscow/prices/' + store,{'sections':sections})
                check = site('/api/moscow/prices/' + store)
                if not check.get('saved') or check['checkedOn'] != today or check['products'] != result['products']:
                    raise ValueError('Прочитанные данные отличаются от записанных')
                print(store, check['address'],check['checkedOn'],check['products'])
        except Exception as error:
            failures.append(store)
            print(store, type(error).__name__,str(error),file=sys.stderr)
    if args.local_rules: json.dump(collected,sys.stdout,ensure_ascii=False)
    if failures: sys.exit(1)
if __name__ == '__main__': main()
