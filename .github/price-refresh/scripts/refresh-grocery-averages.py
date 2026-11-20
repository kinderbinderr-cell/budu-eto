"""Refresh public grocery observations without moving a price to a different date or area."""
import argparse
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import time
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen


RUSTATA = "https://rustata.ru/indicator/fedstat/indicator_37426"
NATIONAL = "https://1000bankov.ru/inflation/products/"
PREFIX = "const dailyGroceryPrices = "
MONTHS = "января февраля марта апреля мая июня июля августа сентября октября ноября декабря".split()
MAX_BYTES = 1_000_000
NATIONAL_PRODUCTS = {
    "apple": "yabloki", "banana": "banany", "beet": "svekla-stolovaya",
    "buck": "krupa-grechnevaya-yadrica", "butter": "maslo-slivochnoe",
    "cabbage": "kapusta-belokochannaya-svezhaya", "carrot": "morkov",
    "cheese": "syry-tverdye-polutverdye-i-myagkie", "cucumber": "ogurcy",
    "curd": "tvorog", "egg": "yajca", "flour": "muka-pshenichnaya",
    "frankfurters": "sosiski-sardelki", "kefir": "kefir",
    "milk": "moloko-pasterizovannoe", "millet": "psheno", "oil": "maslo-podsolnechnoe",
    "onion": "luk", "pasta": "makaronnye-izdeliya-iz-pshenichnoj-muki-vysshego-sorta",
    "potato": "kartofel", "rice": "ris-shlifovannyj",
    "ryeBread": "hleb-iz-rzhanoj-muki-i-iz-smesi-muki-rzhanoj-i-pshenichnoj",
    "salt": "sol-povarennaya-pischevaya", "sourCream": "smetana", "sugar": "sahar",
    "tomato": "pomidory", "vermicelli": "vermishel",
}


def normalized(text):
    return " ".join(text.casefold().replace("ё", "е").split()).rstrip(".")


def read_js(path, prefix):
    text = path.read_text(encoding="utf-8").strip()
    if not text.startswith(prefix) or not text.endswith(";"):
        raise ValueError(f"invalid snapshot wrapper: {path}")
    return json.loads(text[len(prefix):-1])


def write_snapshot(path, data):
    text = PREFIX + json.dumps(data, ensure_ascii=False, sort_keys=True, indent=2) + ";\n"
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return
    temporary = path.with_suffix(".stage")
    temporary.write_text(text, encoding="utf-8")
    temporary.replace(path)


class PublicPriceRows(HTMLParser):
    """Capture only published series rows or national product cards."""

    def __init__(self, *, national=False):
        super().__init__()
        self.national = national
        self.container = "article" if national else "li"
        self.row_class = "inflation-card" if national else "has-pick"
        self.row = None
        self.rows = []
        self.stack = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        classes = attributes.get("class", "").split()
        if tag == self.container and self.row_class in classes:
            self.row = {"price": [], "period": [], "area": [], "title": ""}
            self.stack = []
            return
        if self.row is None:
            return
        if self.national:
            url = attributes.get("href", "")
            if tag == "a" and url.startswith("/inflation/products/"):
                self.row["title"] = url
            field = next((field for cls, field in (
                ("inflation-card__price", "price"), ("inflation-card__meta", "period")
            ) if cls in classes), None)
            if field == "period" and self.row["period"]:
                field = None
        else:
            if tag == "input" and "cmp-check" in classes:
                self.row["title"] = attributes.get("data-title", "")
            field = next((field for cls, field in (
                ("series-value", "price"), ("series-period", "period"), ("meta", "area")
            ) if cls in classes), None)
        if tag not in {"input", "img", "br", "hr", "source", "wbr"}:
            self.stack.append((tag, field))

    def handle_endtag(self, tag):
        if self.row is None:
            return
        if tag == self.container:
            self.rows.append({key: "".join(value).strip() for key, value in self.row.items()})
            self.row = None
            self.stack = []
            return
        for index in reversed(range(len(self.stack))):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                return

    def handle_data(self, text):
        if self.row is None:
            return
        for _, field in reversed(self.stack):
            if field:
                self.row[field].append(text)
                return


def parse_rows(html, *, national=False):
    parser = PublicPriceRows(national=national)
    parser.feed(html)
    return parser.rows


def published_date(text):
    match = re.fullmatch(r"за \d{1,2} неделя (20\d{2}) \((\d{1,2}) ([а-яё]+)\)", normalized(text))
    if not match or match[3] not in MONTHS:
        return None
    return date(int(match[1]), MONTHS.index(match[3]) + 1, int(match[2]))


def price_kopecks(text):
    text = "".join(text.split())
    if not re.fullmatch(r"\d{1,5}(?:[,.]\d{1,2})?₽", text):
        raise ValueError("price is not in rubles")
    amount = int(Decimal(text[:-1].replace(",", ".")) * 100)
    if not 0 < amount < 2_000_000:
        raise ValueError("price is outside the supported range")
    return amount


def checked_dates(prices, today):
    periods = [period for period in prices if today - timedelta(days=65) <= period <= today]
    return max(periods, default=None)


def national_snapshot(html, categories, today):
    product_keys = {slug: key for key, slug in NATIONAL_PRODUCTS.items()}
    by_period = {}
    unit_labels = {"kg": "кг", "l": "л", "10pcs": "10 шт."}
    for row in parse_rows(html, national=True):
        key = product_keys.get(row["title"].rstrip("/").split("/")[-1])
        stamp = re.fullmatch(r"за (.+?)\s*·\s*(\d\d\.\d\d\.20\d\d)", row["period"])
        if not key or not stamp or normalized(unit_labels[categories[key]["unit"]]) != normalized(stamp[1]):
            continue
        period = datetime.strptime(stamp[2], "%d.%m.%Y").date()
        put_rate(by_period, period, key, price_kopecks(row["price"]))
    period = checked_dates(by_period, today)
    if not period or set(by_period[period]) != set(NATIONAL_PRODUCTS):
        raise ValueError("missing or inconsistent national prices")
    return {
        "period": period.isoformat(), "source": NATIONAL, "rates": by_period[period],
        "publishers": ["Росстат, публикация 1000bankov.ru", "Rosstat, via 1000bankov.ru"],
        "labels": ["Средние цены по России", "Russian average prices"],
    }


def put_rate(by_period, period, key, amount):
    rates = by_period.setdefault(period, {})
    if key in rates and rates[key] != amount:
        raise ValueError(f"conflicting prices for {key}")
    rates[key] = amount


def area_snapshot(pages, area, group, categories, today):
    comparable_categories = {normalized(categories[key]["category"]): key for key in NATIONAL_PRODUCTS}
    by_period = {}
    expected_name = normalized(area["sourceName"])
    display_name = normalized(area.get("names", [area["sourceName"]])[0])
    for page in pages:
        for row in parse_rows(page):
            product, separator, territory = row["title"].partition(" - Средняя цена · ")
            if not separator or (normalized(territory) != expected_name and normalized(row["area"]) != display_name):
                continue
            key = comparable_categories.get(normalized(product))
            period = published_date(row["period"])
            if key and period:
                put_rate(by_period, period, key, price_kopecks(row["price"]))
    period = checked_dates(by_period, today)
    if not period or len(by_period[period]) < 18:
        raise ValueError("missing or inconsistent prices for the stated geography")
    return {
        "period": period.isoformat(), "source": RUSTATA + "?" + urlencode({"geo": area["geo"]}),
        "rates": by_period[period], "publishers": ["Росстат, публикация Rustata", "Rosstat, via Rustata"],
        **({"names": area["names"], "region": area["region"]} if group == "cities" else {"labels": area["labels"]}),
    }


class PublicSources:
    def __init__(self, captures, seconds):
        self.captures = captures
        self.deadline = time.monotonic() + seconds
        self.last_rustata = None

    def get(self, url, filename):
        if self.captures is not None:
            return (self.captures / filename).read_text(encoding="utf-8")
        host = urlsplit(url).hostname
        if host == "rustata.ru":
            if self.last_rustata is not None:
                time.sleep(max(0, 5.1 - (time.monotonic() - self.last_rustata)))
            self.last_rustata = time.monotonic()
        remaining = self.deadline - time.monotonic()
        if remaining < 1:
            raise TimeoutError("source refresh exceeded its run time")
        request = Request(url, headers={"User-Agent": "BuduEto Grocery Price Check/1.0"})
        with urlopen(request, timeout=min(12, remaining)) as response:
            target = urlsplit(response.geturl())
            if target.scheme != "https" or target.hostname != host:
                raise ValueError("unexpected source redirect")
            data = response.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise ValueError("source exceeded the expected document size")
        return data.decode("utf-8")


def keep_newer(previous, candidate):
    if previous is None:
        return candidate
    if candidate["period"] < previous["period"] or not previous["rates"].keys() <= candidate["rates"].keys():
        return previous
    return candidate


def warn_if_old(source, period, today):
    age = (today - date.fromisoformat(period)).days
    if age > 14:
        print(f"::warning::{source} has not published newer prices for {age} days ({period}).")


def refresh(args):
    sources = PublicSources(args.captures, args.seconds)
    categories = read_js(args.categories, "const cityObservations = ")
    data = read_js(args.output, PREFIX) if args.output.exists() else {"national": None, "cities": {}, "regions": {}}
    areas = json.loads(args.areas.read_text(encoding="utf-8"))
    today = datetime.now(timezone(timedelta(hours=3))).date()
    checks, failures = 0, []
    try:
        candidate = national_snapshot(sources.get(NATIONAL, "national.html"), categories, today)
        data["national"] = keep_newer(data["national"], candidate)
        warn_if_old("Russian averages", data["national"]["period"], today)
        checks += 1
    except (OSError, ValueError) as error:
        failures.append(f"Russia: {error}")
    try:
        index = sources.get(RUSTATA, "rustata.html")
        release = checked_dates([period for row in parse_rows(index) if (period := published_date(row["period"]))], today)
        if not release:
            raise ValueError("no dated Rustata publication")
        warn_if_old("Rustata regional series", release.isoformat(), today)
        checks += 1
        for group, places in areas.items():
            for place in places:
                area = place["id"]
                previous = data[group].get(area)
                existing_period = max((previous or {}).get("period", ""), place.get("coveredThrough", ""))
                if existing_period >= release.isoformat() and not args.captures:
                    continue
                try:
                    pages = [
                        sources.get(
                            RUSTATA + "?" + urlencode({"geo": place["geo"], "page": page}),
                            f"rustata-{place['geo']}-{page}.html",
                        ) for page in (1, 2)
                    ]
                    candidate = area_snapshot(pages, place, group, categories, today)
                    data[group][area] = keep_newer(previous, candidate)
                    checks += 1
                except (OSError, ValueError) as error:
                    failures.append(f"{area}: {error}")
    except (OSError, ValueError) as error:
        failures.append(f"Rustata: {error}")
    for failure in failures:
        print(f"Source kept unchanged: {failure}", file=sys.stderr)
    if not checks:
        raise SystemExit("No source passed verification. Retained the previous snapshot.")
    write_snapshot(args.output, data)
    print(f"Checked {checks} sources. Prices for {len(data['cities'])} cities and {len(data['regions'])} regions.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--areas", type=Path, required=True)
    parser.add_argument("--categories", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--captures", type=Path)
    parser.add_argument("--seconds", type=int, default=820)
    refresh(parser.parse_args())
