from datetime import date
from html import escape
from pathlib import Path
from runpy import run_path
import unittest


module = run_path(str(Path(__file__).with_name("refresh-grocery-averages.py")))
categories = module["read_js"](Path("city-prices.js"), "const cityObservations = ")
keys = module["NATIONAL_PRODUCTS"]
today = date(2026, 11, 20)
city = dict(id="kazan", geo="92401000000", sourceName="Казань", names=["Казань", "Kazan"], region="16")


def area_html(territory, products, observation="за 42 неделя 2026 (26 октября)"):
    return "".join(
        f'<li class="has-pick"><input class="cmp-check" data-title="{escape(categories[key]["category"])} - Средняя цена · {territory}">'
        f'<span class="series-value">123,45 ₽<span class="series-period">{observation}</span></span>'
        f'<span class="meta">{territory}</span></li>'
        for key in products
    )


class SnapshotTests(unittest.TestCase):
    def test_prefer_only_verified_date_and_exact_geography(self):
        html = area_html("Казань", keys) + area_html("Татарстан", keys, "за 45 неделя 2026 (16 ноября)")
        snapshot = module["area_snapshot"]([html], city, "cities", categories, today)
        self.assertEqual(snapshot["period"], "2026-10-26")
        self.assertEqual(snapshot["rates"]["milk"], 12345)
        self.assertEqual(snapshot["region"], "16")

    def test_ignore_undated_wrong_area_and_incomplete_reports(self):
        for html in (
            area_html("Татарстан", keys),
            area_html("Казань", keys, "за 45 неделя 2026"),
            area_html("Казань", ["milk"]),
            area_html("Казань", keys, "за 47 неделя 2026 (30 ноября)"),
        ):
            with self.subTest(html=html[:90]), self.assertRaises(ValueError):
                module["area_snapshot"]([html], city, "cities", categories, today)

    def test_keep_previous_for_older_or_incomplete_snapshots(self):
        old = {"period": "2026-10-26", "rates": {"milk": 10000, "potato": 4000}}
        older = {"period": "2026-10-19", "rates": {"milk": 10000, "potato": 4000}}
        incomplete = {"period": "2026-11-16", "rates": {"milk": 10000}}
        newer = {"period": "2026-11-16", "rates": {"milk": 11000, "potato": 4200}}
        self.assertEqual(module["keep_newer"](old, older), old)
        self.assertEqual(module["keep_newer"](old, incomplete), old)
        self.assertEqual(module["keep_newer"](old, newer), newer)

    def test_national_requires_same_period_and_correct_units(self):
        unit_names = {"kg": "кг", "l": "л", "10pcs": "10 шт."}
        cards = "".join(
            f'<article class="inflation-card"><a href="/inflation/products/{slug}/"></a>'
            '<div class="inflation-card__price">123,45 ₽</div>'
            f'<div class="inflation-card__meta">за {unit_names[categories[key]["unit"]]} · 16.11.2026</div>'
            '</article>'
            for key, slug in keys.items()
        )
        result = module["national_snapshot"](cards, categories, today)
        self.assertEqual(len(result["rates"]), 27)
        self.assertEqual(result["rates"]["egg"], 12345)
        with self.assertRaises(ValueError):
            module["national_snapshot"](cards.replace("за 10 шт.", "за кг"), categories, today)


if __name__ == "__main__":
    unittest.main()
