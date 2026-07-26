import json
from playwright.sync_api import sync_playwright

products = [
    ("Льняное масло Премиум+", "https://ekopremium.ru/tproduct/186395728682-lnyanoe-maslo-premium"),
    ("Тыквенное масло Премиум+", "https://ekopremium.ru/tproduct/208621883802-tikvennoe-maslo-premium"),
    ("Конопляное масло Премиум+", "https://ekopremium.ru/tproduct/982155580072-konoplyanoe-maslo-premium"),
    ("Амарантовое масло Премиум+", "https://ekopremium.ru/tproduct/556847911562-amarantovoe-maslo-premium-kontsentrat"),
    ("Масло расторопши Премиум+", "https://ekopremium.ru/tproduct/819278056212-maslo-rastoropshi-premium"),
    ("Горчичное сарептское масло Премиум+", "https://ekopremium.ru/tproduct/159103448032-gorchichnoe-sareptskoe-maslo-premium"),
    ("Подсолнечное масло Премиум+", "https://ekopremium.ru/tproduct/669604949752-podsolnechnoe-premium"),
    ("Облепиховое масло Премиум+", "https://ekopremium.ru/tproduct/829750994782-oblepihovoe-maslo-premium-kontsentrat"),
    ("Масло чёрного тмина", "https://ekopremium.ru/tproduct/898318100112-maslo-chyornogo-tmina"),
    ("Масло из абрикосовой косточки", "https://ekopremium.ru/tproduct/373580991962-maslo-iz-abrikosovoi-kostochki"),
    ("Кедровое масло Премиум+", "https://ekopremium.ru/tproduct/571289292212-kedrovoe-maslo-premium"),
    ("Масло грецкого ореха Премиум+", "https://ekopremium.ru/tproduct/110081352102-maslo-gretskogo-oreha-premium"),
]

selectors = [
    ".t-store__prod-popup__text",
    ".t-store__prod-popup__info",
    "[itemprop='description']",
    ".js-store-prod-text",
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(
        viewport={"width": 1440, "height": 1000},
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/126.0.0.0 Safari/537.36"
        ),
    )

    results = []

    for name, url in products:
        print(f"Открываю: {name}")

        try:
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(3000)

            description = ""

            for selector in selectors:
                element = page.locator(selector).first

                if element.count() > 0:
                    text = element.inner_text().strip()

                    if text:
                        description = text
                        break

            if not description:
                print(f"Не найдено описание: {name}")
                continue

            lines = [
                " ".join(line.split())
                for line in description.splitlines()
                if line.strip()
            ]

            description = "\n".join(lines)

            results.append({
                "name": name,
                "description": description,
            })

            print(f"Готово: {name}")

        except Exception as error:
            print(f"Ошибка у товара {name}: {error}")

    browser.close()

with open("descriptions_ready.txt", "w", encoding="utf-8") as file:
    for product in results:
        ready_description = json.dumps(
            product["description"],
            ensure_ascii=False
        )

        file.write(f'{product["name"]}\n')
        file.write(f'"description": {ready_description},\n\n')

print("Создан файл descriptions_ready.txt")