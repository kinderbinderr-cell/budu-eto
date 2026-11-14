"""Deliver claimed kitchen reminders. Keep chat IDs, tokens and meal plans out of logs."""
import json
import os
from pathlib import Path
import ssl
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

API = 'https://www.kbrcore.ru:8443/budu-eto/reminder-dispatch'
CERT = ssl.create_default_context(cafile=str(Path(__file__).with_name('server.pem')))


def request(url, payload, headers=None, context=None):
    req = Request(url, json.dumps(payload).encode(), {'Content-Type':'application/json', **(headers or {})})
    with urlopen(req, context=context, timeout=15) as res:
        return json.load(res)


def dispatch(action, **args):
    return request(API, {'action':action, **args}, {'X-Reminders-Key':os.environ['BUDU_DISPATCH_KEY']}, CERT)


def run():
    token = os.environ.get('BUDU_BOT_TOKEN', '')
    if not dispatch('probe').get('ok'):
        raise RuntimeError('Reminder server unavailable')
    if not token:
        print('Delivery is waiting for the bot owner to enable sending.')
        return
    api = 'https://api.telegram.org/bot' + token + '/'
    identity = request(api + 'getMe', {})
    if identity.get('result',{}).get('username','').lower() != 'budueto_bot':
        raise RuntimeError('Bot identity check failed')
    sent = 0
    deadline = time.monotonic() + 210
    while time.monotonic() < deadline:
        batch = dispatch('claim')
        if not batch['rows']: break
        for row in batch['rows']:
            row.pop('text',None)
            args = {**row,'claim':batch['claim']}
            text = dispatch('check', **args).get('text')
            if not text: continue
            try:
                reply = request(api + 'sendMessage', {'chat_id':row['chat'],'text':text})
                result = 'sent' if reply.get('ok') else 'unknown'
            except HTTPError as err:
                if err.code == 429:
                    detail = json.load(err)
                    delay = max(1,int(detail.get('parameters',{}).get('retry_after',10)))
                    result = 'retry'
                elif err.code == 403: result = 'blocked'
                elif err.code >= 500: result = 'retry'; delay = 10
                else: result = 'unknown'
            except (URLError,TimeoutError,OSError):
                result = 'unknown'  # Telegram may already have accepted the message.
            dispatch('settle', **args, result=result)
            if result == 'sent': sent += 1
            if result == 'retry':
                time.sleep(min(delay,120))
                if delay>120: return
            time.sleep(.05)
    print('Confirmed deliveries:', sent)


if __name__ == '__main__':
    try:
        run()
    except Exception as err:
        sys.exit('Delivery unavailable: '+type(err).__name__+' '+str(getattr(err,'code','')))
