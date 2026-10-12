# Тема: цвета, шрифт и язык

> English version — [theme.en.md](theme.en.md).

Терминал сам передаёт странице виджета свою палитру CSS-переменными на `<html>`, а с ней масштаб
шрифта и два атрибута, — и обновляет их при каждой смене темы, цветов, размера шрифта или языка. Пишите
цвета через переменные ролей, и виджет выглядит родным без единой строки кода.

```css
body {
  background: var(--colibri-role-background, #0b0e13);
  color: var(--colibri-role-text, #d8dee9);
  font-size: calc(13px * var(--colibri-font-scale, 1));
}
.card {
  background: var(--colibri-role-surface, #171b23);
  border: 1px solid var(--colibri-role-divider, #2a2f3a);
}
.hint { color: var(--colibri-role-dim-text, #8b93a3); }
.buy { color: var(--colibri-role-bullish, #4caf50); }
.sell { color: var(--colibri-role-bearish, #e05252); }
```

Запасное значение во втором аргументе `var()` пишите всегда: вне терминала, например в обычном
браузере, переменных нет, а в первые мгновения загрузки они могут быть ещё не выставлены. Значение
каждой переменной цвета — восьмизначный hex `#rrggbbaa`: прозрачность в последних двух знаках.

## <a id="roles"></a>Роли

Роли — словарь для оформления самого виджета: фон, поверхность, текст, разделители, покупка и продажа.
Это стабильный контракт: имена ролей не меняются между версиями терминала. Пользователь может
переопределить роль в настройках цветов, и виджет на ролях последует за ним.

| Переменная | Роль в настройках цветов | Для чего в виджете |
| --- | --- | --- |
| `--colibri-role-bullish` | Покупка | покупка, рост, бид: текст, линии, значки |
| `--colibri-role-bearish` | Продажа | продажа, падение, аск: текст, линии, значки |
| `--colibri-role-bullish-muted` | Покупка (приглушённый) | заливки и фоны строк покупки |
| `--colibri-role-bearish-muted` | Продажа (приглушённый) | заливки и фоны строк продажи |
| `--colibri-role-background` | Фон | фон страницы |
| `--colibri-role-surface` | Поверхность | то, что приподнято над фоном: карточки, шапки, поля ввода |
| `--colibri-role-text` | Текст | основной текст и цифры |
| `--colibri-role-dim-text` | Приглушённый текст | подписи, второстепенный текст, подсказки |
| `--colibri-role-accent` | Акцент | выделение, полосы объёма, активный элемент |
| `--colibri-role-divider` | Разделитель | рамки, линии, сетка |

## <a id="elements"></a>Элементы палитры

Кроме ролей терминал передаёт каждый цвет своей палитры — 94 элемента стакана, ленты сделок,
кластеров, графика и оформления окон. Имя переменной — `--colibri-` и имя элемента через дефисы.
Элементы — это части отрисовки самого терминала, а не словарь для виджета: в новой версии терминала
элемент могут переименовать, добавить или убрать, и тогда переменная пропадёт, а сработает запасное
значение. Контракт — роли. Берите элемент, только когда нужен именно этот цвет терминала, — скажем,
цвет пузыря ликвидации из ленты, — и всегда с запасным значением.

<details>
<summary>Все 94 переменные элементов</summary>

**Лестница стакана**

| Переменная | Название в настройках цветов |
| --- | --- |
| `--colibri-background` | Фон панели |
| `--colibri-ask-background` | Фон строки аск |
| `--colibri-bid-background` | Фон строки бид |
| `--colibri-best-ask` | Подсветка лучшего аска |
| `--colibri-best-bid` | Подсветка лучшего бида |
| `--colibri-spread` | Строка спреда |
| `--colibri-text-ask` | Текст цены аск |
| `--colibri-text-bid` | Текст цены бид |
| `--colibri-text-black` | Текст объёма |
| `--colibri-text-gray` | Плашка % заголовка / текст статуса |
| `--colibri-bar` | Объёмный бар |
| `--colibri-large-volume` | Бар крупного объёма ① |
| `--colibri-large-volume2` | Бар крупного объёма ② |
| `--colibri-large-volume3` | Бар крупного объёма ③ |
| `--colibri-large-volume4` | Бар крупного объёма ④ |
| `--colibri-divider` | Разделитель колонок |
| `--colibri-round-divider` | Разделитель 10 строк |
| `--colibri-hover-row-highlight` | Подсветка строки под курсором |
| `--colibri-hover-readout-plaque` | Плашка % и объёма под курсором |
| `--colibri-hover-readout-ink` | Текст % и объёма под курсором |

**Ордера и позиция**

| Переменная | Название в настройках цветов |
| --- | --- |
| `--colibri-order-buy-fill` | Заливка ордера покупки |
| `--colibri-order-buy-border` | Граница ордера покупки |
| `--colibri-order-sell-fill` | Заливка ордера продажи |
| `--colibri-order-sell-border` | Граница ордера продажи |
| `--colibri-order-x-glyph` | Значок отмены (×) |
| `--colibri-order-qty-text` | Текст объёма ордера |
| `--colibri-position-entry-row` | Строка входа позиции |
| `--colibri-mark-price-marker` | Маркер mark price (MP) |
| `--colibri-index-price-marker` | Маркер index price (IP) |
| `--colibri-liquidation-price-marker` | Маркер liquidation price (LP) |

**Лента сделок и ликвидации**

| Переменная | Название в настройках цветов |
| --- | --- |
| `--colibri-tick-buy-circle` | Пузырь сделки покупки |
| `--colibri-tick-sell-circle` | Пузырь сделки продажи |
| `--colibri-tick-text` | Подпись пузыря сделки |
| `--colibri-tick-stroke` | Контур пузыря сделки |
| `--colibri-connector-line` | Соединительная линия сделок |
| `--colibri-liq-buy-fill` | Пузырь ликвидации покупки |
| `--colibri-liq-sell-fill` | Пузырь ликвидации продажи |
| `--colibri-liq-stroke` | Контур ликвидации |
| `--colibri-tape-entry-marker` | Маркер входа позиции |
| `--colibri-tape-entry-marker-text` | Текст маркера входа |

**Кластер / футпринт**

| Переменная | Название в настройках цветов |
| --- | --- |
| `--colibri-cluster-text` | Текст ячейки кластера |
| `--colibri-cluster-buy` | Ячейка кластера (покупка) |
| `--colibri-cluster-sell` | Ячейка кластера (продажа) |
| `--colibri-cluster-poc-frame` | Рамка максимального объёма кластера |
| `--colibri-footer-volume-bg` | Фон объёма кластера |
| `--colibri-footer-text` | Текст объёма кластера |
| `--colibri-footer-time-bg` | Фон времени кластера |
| `--colibri-footer-time-text` | Текст времени кластера |

**Заголовок и бейджи**

| Переменная | Название в настройках цветов |
| --- | --- |
| `--colibri-header-background` | Фон заголовка |
| `--colibri-header-symbol` | Текст символа |
| `--colibri-header-positive` | Изменение % рост |
| `--colibri-header-negative` | Изменение % падение |
| `--colibri-market-spot-bg` | Бейдж спота |
| `--colibri-market-spot-text` | Текст бейджа спота |
| `--colibri-market-futures-bg` | Бейдж фьючерсов |
| `--colibri-market-futures-text` | Текст бейджа фьючерсов |

**Свечной график**

| Переменная | Название в настройках цветов |
| --- | --- |
| `--colibri-candle-bull-body` | Тело бычьей свечи |
| `--colibri-candle-bear-body` | Тело медвежьей свечи |
| `--colibri-candle-bull-wick` | Тень бычьей свечи |
| `--colibri-candle-bear-wick` | Тень медвежьей свечи |
| `--colibri-candle-border` | Граница свечи |
| `--colibri-chart-grid-line` | Линия сетки графика |
| `--colibri-crosshair-line` | Перекрестие |
| `--colibri-current-price-badge` | Бейдж текущей цены |
| `--colibri-signal-marker-line` | Линия маркера сигнала |
| `--colibri-signal-alert-line` | Линия оповещения сигнала |
| `--colibri-signal-crossed-line` | Линия пересечённого сигнала |
| `--colibri-chart-drawing` | Линия рисунка |
| `--colibri-chart-drawing-selected` | Выделение рисунка |
| `--colibri-chart-background` | Фон графика |
| `--colibri-chart-price-zone-bg` | Фон ценовой зоны |
| `--colibri-chart-time-zone-bg` | Фон зоны таймфрейма |
| `--colibri-chart-scale-text` | Цифры шкал |
| `--colibri-chart-ruler-text` | Текст линейки |
| `--colibri-chart-pane-separator` | Линии рамки графика |
| `--colibri-volume-bar-bull` | Объёмный бар (покупка) |
| `--colibri-volume-bar-bear` | Объёмный бар (продажа) |
| `--colibri-chart-order-buy` | Линия ордера на покупку |
| `--colibri-chart-order-sell` | Линия ордера на продажу |
| `--colibri-chart-position-profit` | Линия входа позиции (прибыль) |
| `--colibri-chart-position-loss` | Линия входа позиции (убыток) |
| `--colibri-chart-take-profit` | Линия тейк-профита |
| `--colibri-chart-stop-loss` | Линия стоп-лосса |
| `--colibri-chart-liquidation` | Линия ликвидации |
| `--colibri-chart-trade-buy` | Маркер сделки: покупка |
| `--colibri-chart-trade-sell` | Маркер сделки: продажа |
| `--colibri-chart-trade-connector` | Связка входа и выхода сделки |

**Оформление окон**

| Переменная | Название в настройках цветов |
| --- | --- |
| `--colibri-window-header` | Шапка окна |
| `--colibri-tab-active` | Активная вкладка |
| `--colibri-tab-hover` | Вкладка под курсором |
| `--colibri-tab-attention` | Сигнальный уровень на вкладке |

**Цвета отметок на вкладках**

| Переменная | Название в настройках цветов |
| --- | --- |
| `--colibri-tab-mark-position` | Отметка позиции на вкладке |
| `--colibri-tab-mark-limits` | Отметка лимиток на вкладке |
| `--colibri-tab-mark-text` | Текст счётчиков на вкладке |

</details>

## <a id="font-scale"></a>Масштаб шрифта

`--colibri-font-scale` — число: 1 при размере шрифта терминала по умолчанию, больше или меньше, когда
пользователь меняет размер шрифта в настройках. Умножайте на него свои размеры, и текст виджета будет
расти вместе с текстом терминала:

```css
body { font-size: calc(13px * var(--colibri-font-scale, 1)); }
```

На `<canvas>` переменная не действует — возьмите `fontScale` из события
[`theme`](bridge.md#event-theme).

## <a id="attributes"></a>Атрибуты `<html>`

| Атрибут | Значения | Для чего |
| --- | --- | --- |
| `data-theme` | `dark`, `light` | Стили, которые зависят от светлой или тёмной основы, — например, логотип в двух вариантах. |
| `data-colibri-lang` | `ru`, `en` | Стили, которые зависят от языка интерфейса терминала. |

```css
:root[data-theme="light"] .logo { filter: invert(1); }
```

Терминал ставит атрибуты и переменные на `<html>` сам — не позже события `DOMContentLoaded` — и
переставляет при каждой смене. Атрибут `lang` он не трогает. В скрипте не читайте атрибуты при
загрузке: те же сведения есть в `handshake().theme` и `handshake().lang`, и они доступны синхронно, до
первой строки вашего кода.

## <a id="language"></a>Язык

Язык интерфейса терминала — `handshake().lang`: сейчас `"ru"` или `"en"`. Языки могут добавиться, так
что незнакомый показывайте по-английски. Пользователь может сменить язык на ходу, без перезапуска
виджета: тогда приходит событие [`theme`](bridge.md#event-theme) с новым `lang`, а
`handshake().lang` к этому моменту уже обновлён. Рецепт — [следовать языку](../recipes.md#follow-language).

```js
import { handshake, on } from "./colibri.js";

const texts = { ru: { title: "Стакан" }, en: { title: "Order book" } };
const render = (lang) => {
  document.title = (texts[lang] ?? texts.en).title;
};
render(handshake().lang);
on("theme", (e) => render(e.lang));
```
