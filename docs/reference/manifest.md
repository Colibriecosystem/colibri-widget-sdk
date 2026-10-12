# Манифест `widget.json`

> English version — [manifest.en.md](manifest.en.md).

`widget.json` лежит в корне папки виджета и его архива и говорит терминалу и Nest, что это за виджет:
какую страницу открыть, где он живёт, какие у него права и куда он ходит по сети. Терминал и Nest
читают манифест по одним правилам. Отказ называет устойчивый код; у каждого поля ниже перечислены его
коды со ссылкой на разбор в [CHECKS.md](../../CHECKS.md).

Общие правила:

- Файл — JSON-объект в корне, не во вложенной папке
  ([`manifest.missing`](../../CHECKS.md#manifestmissing),
  [`manifest.invalid-json`](../../CHECKS.md#manifestinvalid-json)). Манифест — описание, а не данные:
  слишком длинный отклоняется ([`manifest.too-large`](../../CHECKS.md#manifesttoo-large)).
- Имена полей пишутся ровно как здесь, с учётом регистра. Незнакомое поле терминал пропускает, поэтому
  опечатка в имени необязательного поля — не ошибка, а молча не заданное поле.
- Значение не того типа — строка вместо числа, строка вместо списка — это
  [`manifest.invalid-json`](../../CHECKS.md#manifestinvalid-json).
- В списках `permissions`, `egress` и `browserPermissions` — до 32 записей; пустая запись или запись
  длиннее 256 символов отклоняется.
- Названия, иконки и автора в манифесте нет: они живут у виджета в Nest — см.
  [устаревшие поля](#legacy-fields).

## <a id="example"></a>Пример

Манифест со всеми полями, которые сейчас имеют смысл:

```json
{
  "id": "funding-radar",
  "version": "1.2.0",
  "entry": "index.html",
  "surfaces": ["slot", "window"],
  "permissions": ["marketData", "notifications", "storage"],
  "egress": ["fapi.binance.com", "fstream.binance.com", "*.okx.com"],
  "minApiVersion": 1,
  "minColibriVersion": "1.4.0",
  "singleInstance": false,
  "windowScope": "app",
  "browserPermissions": ["clipboard-read"]
}
```

Обязательны только `id`, `version`, `entry` и `surfaces`; у остальных есть значения по умолчанию.

## <a id="fields"></a>Поля

### <a id="manifest-id"></a>`id`

**Строка, обязательное.** Коды: [`manifest.missing-id`](../../CHECKS.md#manifestmissing-id),
[`manifest.invalid-id`](../../CHECKS.md#manifestinvalid-id),
[`manifest.id-mismatch`](../../CHECKS.md#manifestid-mismatch),
[`ownership.taken`](../../CHECKS.md#ownershiptaken),
[`ownership.retired`](../../CHECKS.md#ownershipretired).

ID виджета: от 1 до 40 символов — строчные латинские буквы, цифры и дефисы, не в начале и не в конце.
Он одновременно origin виджета (`https://<id>.widgets.colibri.internal`) и имя папки установки, поэтому
правило такое строгое. ID выдаёт Nest, когда вы создаёте виджет, а терминал сам вписывает его в
`widget.json`, когда вы связываете папку с виджетом, — см. [ID виджета](../publishing.md#widget-id).
Между версиями ID не меняется: другой ID — это другой виджет.

### <a id="manifest-version"></a>`version`

**Строка, обязательное.** Коды: [`manifest.missing-version`](../../CHECKS.md#manifestmissing-version),
[`manifest.invalid-version`](../../CHECKS.md#manifestinvalid-version),
[`manifest.version-prerelease`](../../CHECKS.md#manifestversion-prerelease),
[`manifest.version-not-plain`](../../CHECKS.md#manifestversion-not-plain),
[`ownership.version-not-after`](../../CHECKS.md#ownershipversion-not-after).

Номер версии виджета — три числа `X.Y.Z`: `1.2.0`. Для публикации — без суффикса (`1.2.3-beta.1`
нельзя), без ведущих нулей (`01.2.0` нельзя) и не длиннее девяти цифр в каждой части. Распакованная
папка загрузится и с суффиксом, но выпустить такую версию нельзя. Номера только растут и не
повторяются; какую часть поднимать — в [номере версии](../publishing.md#release-version).

### <a id="manifest-entry"></a>`entry`

**Строка, обязательное.** Коды: [`manifest.missing-entry`](../../CHECKS.md#manifestmissing-entry),
[`manifest.invalid-entry`](../../CHECKS.md#manifestinvalid-entry),
[`consistency.mismatch`](../../CHECKS.md#consistencymismatch),
[`origin.unreachable`](../../CHECKS.md#originunreachable).

Страница, с которой виджет запускается. Одна из двух форм:

- **Путь внутри папки** — `index.html`, `app/index.html`. Только относительный: без `/` в начале, без
  `.` и `..`, без пустых частей вроде `a//b`; обратная косая черта читается как прямая. Файл должен
  лежать в архиве и быть `.html`.
- **Адрес `https://`** — hosted-виджет: страница загружается с вашего сайта, а его origin становится
  идентичностью виджета. Хост этого адреса обязательно указать в [`egress`](#manifest-egress), а Nest
  проверяет, что адрес отвечает. Развилка «hosted или в пакете» — в
  [публикации](../publishing.md#hosted).

Любая другая схема — `http://`, `file://` — отклоняется. Исключение одно: адрес dev-сервера у
распакованной папки, см. [ниже](#dev-server-entry).

### <a id="manifest-surfaces"></a>`surfaces`

**Список, обязательное, не пустой.** Коды:
[`manifest.missing-surfaces`](../../CHECKS.md#manifestmissing-surfaces),
[`manifest.invalid-surface`](../../CHECKS.md#manifestinvalid-surface).

Где виджет может жить: `"slot"` — ячейка во вкладке, `"window"` — отдельное окно. Значения строчными
буквами, повтор не считается. Только виджет с `"window"` открывается отдельным окном и закрепляется
закладкой в нижней строке; виджет только с `"slot"` живёт лишь в панелях. На поверхности, которой нет в
списке, терминал виджет не откроет. Виджет переносят между поверхностями без перезапуска — см. событие
[`surface`](bridge.md#event-surface).

### <a id="manifest-permissions"></a>`permissions`

**Список, необязательное, по умолчанию пустой.** Коды:
[`manifest.too-many-permissions`](../../CHECKS.md#manifesttoo-many-permissions),
[`manifest.invalid-permission`](../../CHECKS.md#manifestinvalid-permission),
[`review.excess-permissions`](../../CHECKS.md#reviewexcess-permissions),
[`embed.remote-shell`](../../CHECKS.md#embedremote-shell).

Разрешения API, которые просит виджет: `marketData`, `account:read`, `trading`, `panels`,
`notifications`, `signalLevels`, `storage`. Что открывает каждое и как пользователь их выдаёт — в
[разрешениях](README.md#permissions). Неизвестное имя отклоняет манифест, а не пропускается.
Объявляйте только то, чем пользуется код: каждое разрешение — строка в окне согласия, новое в следующей
версии спросит пользователя заново, а лишнее — повод для модератора отклонить версию. Виджет, который
лишь обёртка вокруг чужой страницы, не может просить `trading` и `account:read`.

### <a id="manifest-egress"></a>`egress`

**Список, необязательное, по умолчанию пустой.** Коды:
[`manifest.too-many-egress`](../../CHECKS.md#manifesttoo-many-egress),
[`manifest.invalid-egress`](../../CHECKS.md#manifestinvalid-egress),
[`egress.hosted-own-origin`](../../CHECKS.md#egresshosted-own-origin),
[`egress-code.undeclared-host`](../../CHECKS.md#egress-codeundeclared-host),
[`egress-ws.undeclared-host`](../../CHECKS.md#egress-wsundeclared-host),
[`embed.remote-frame`](../../CHECKS.md#embedremote-frame).

Хосты, куда виджет может ходить по сети. Без них страница достаёт только до своего origin. Запись —
одна из трёх форм:

| Запись | Что покрывает |
| --- | --- |
| `api.example.com` | этот хост на любом порту |
| `api.example.com:8443` | этот хост только на порту 8443 |
| `*.example.com` | любой поддомен `example.com` на любой глубине — но не сам `example.com` |

Схему и путь не пишут: подразумеваются `https` и `wss`, а `http` и `ws` не разрешаются вовсе. Регистр
не важен. Отклоняются `localhost` и всё на `.localhost`, IP-адреса, `*.com` и другие маски на домен
верхнего уровня, маска не в начале, порт вне 1–65535. Нужны и `example.com`, и его поддомены — пишите
обе записи. Больше 32 хостов — объедините поддомены одной маской.

Список действует на всё сразу:

- запросы страницы — `fetch`, XHR, картинки, скрипты, фреймы — к хосту не из списка отклоняются;
- `new WebSocket(...)` к хосту не из списка бросает `SecurityError` уже при создании: документ
  отдаётся с `Content-Security-Policy: connect-src`, собранным из этого списка;
- `net.fetch` к хосту не из списка отвечает `egress_denied`.

Пользователь видит список в окне согласия; новый хост в следующей версии спросит его заново. Если
виджет просит ещё и `account:read`, пользователь отдельно подтверждает, что данные счёта могут уйти по
этим адресам. Hosted-виджет обязан указать здесь хост своего `entry`.

### <a id="manifest-min-api-version"></a>`minApiVersion`

**Целое число, необязательное, по умолчанию 1.** Код:
[`manifest.invalid-min-api-version`](../../CHECKS.md#manifestinvalid-min-api-version).

Самая старая версия контракта `window.colibri`, с которой работает виджет; не меньше 1. Её сравнивают с
`handshake().apiVersion` терминала — сейчас это 1. Терминал со старым контрактом не запустит виджет,
вместо того чтобы тот упал посреди первого вызова. Контракт растёт только с несовместимыми изменениями
API, так что если виджету нужна возможность из нового выпуска Colibri, пишите
[`minColibriVersion`](#manifest-min-colibri-version). Подробнее — [версии](README.md#versions).

### <a id="manifest-min-colibri-version"></a>`minColibriVersion`

**Строка, необязательное; нет поля — подходит любой терминал.** Код:
[`manifest.invalid-min-colibri-version`](../../CHECKS.md#manifestinvalid-min-colibri-version).

Самая старая версия терминала, на которой работает виджет, — три числа без суффикса: `"1.4.0"`.
Терминалы новее 1.3.1 не ставят, не предлагают обновлением и не запускают версию, которой нужен более
новый Colibri: пользователь видит «Нужен Colibri 1.4.0 или новее», а уже стоящая у него версия
продолжает работать. Терминалы до 1.3.1 включительно этого поля не читают. Пробная сборка терминала
`1.4.0-beta.2` считается за `1.4.0`.

### <a id="manifest-single-instance"></a>`singleInstance`

**`true` или `false`, необязательное, по умолчанию `false`.**

`true` — у виджета не бывает больше одного работающего экземпляра: когда его открывают снова, в другой
ячейке или в окне, терминал отдаёт уже работающий экземпляр, а не запускает второй. Ставьте, когда два
экземпляра не имеют смысла. По умолчанию каждая ячейка и каждое окно — свой экземпляр со своим
`instanceId` и своим `storage`.

### <a id="manifest-window-scope"></a>`windowScope`

**`"app"` или `"tab"`, необязательное, по умолчанию `"app"`.** Код:
[`manifest.invalid-window-scope`](../../CHECKS.md#manifestinvalid-window-scope).

Как ведёт себя окно виджета, когда пользователь переключает вкладки; виджету без `"window"` в
[`surfaces`](#manifest-surfaces) поле ни к чему. `"app"` — окно — самостоятельный инструмент и при смене
вкладки не прячется. `"tab"` — окно принадлежит своей вкладке и прячется, когда пользователь уходит с
неё, если окно не закреплено, — как окно графика. Значение строчными буквами; другое отклоняется.

### <a id="manifest-browser-permissions"></a>`browserPermissions`

**Список, необязательное, по умолчанию пустой.** Коды:
[`manifest.invalid-browser-permission`](../../CHECKS.md#manifestinvalid-browser-permission),
[`manifest.forbidden-browser-permission`](../../CHECKS.md#manifestforbidden-browser-permission).

Что страница может попросить у браузера: `microphone`, `camera`, `clipboard-read`, `file-read-write`,
`autoplay`. Имена, которые виджет не получает никогда, — `geolocation`, `notifications`, `sensors`,
`automatic-downloads`, `local-fonts`, `midi-sysex`, `window-management`, `persistent-storage` —
отклоняют манифест. Это отдельный список: права терминала, например `storage` или `notifications`,
пишутся в [`permissions`](#manifest-permissions). Пользователь соглашается на каждое в окне установки и
может выключить любое. Терминал, выпущенный до этого поля, его не читает и отказывает в любом запросе.
Правила целиком — в [CAPABILITIES.md](../../CAPABILITIES.md#разрешения-браузера).

## <a id="dev-server-entry"></a>`entry` на dev-сервере

Для горячей перезагрузки Vite `entry` может указывать на ваш dev-сервер: `http://localhost:5173`. Это
послабление только для распакованной папки — той, из которой терминал запускает виджет на месте, пока
вы его пишете (см. [свою папку](../getting-started.md#own-folder)):

- годятся только буквальные `localhost` и `127.0.0.1`; другие адреса loopback, вроде `127.0.0.2`
  или `[::1]`, не годятся;
- такой манифест не выпускается никогда: обычная установка, упаковка и Nest его отклоняют
  ([`manifest.invalid-entry`](../../CHECKS.md#manifestinvalid-entry)), потому что распространять
  там нечего;
- страница с dev-сервера получает тот же `connect-src`, и ваш dev-origin вписан в него как `'self'`
  вместе с портом. HMR-сокет Vite на порту самой записи `entry` работает как есть, а вынесенный на другой
  порт (`server.hmr.port`) будет отклонён — держите его на порту `entry`;
- в `egress` loopback по-прежнему не вписать.

Шаблоны на Vite держат два манифеста: `dev/widget.json` с адресом dev-сервера для работы и
`public/widget.json` с `index.html`, который сборка кладёт в `dist/`.

```json
{
  "id": "my-widget",
  "version": "1.0.0",
  "entry": "http://localhost:5173",
  "surfaces": ["slot", "window"],
  "permissions": ["marketData", "storage"],
  "minApiVersion": 1
}
```

## <a id="legacy-fields"></a>Устаревшие поля

Название, иконка и автор теперь живут у самого виджета в Nest: название и иконку задают в карточке
виджета на вкладке «Автор» — см. [карточку](../publishing.md#listing), — а подпись под виджетом — имя из
профиля автора. Манифест с этими полями по-прежнему работает: Nest его не отклоняет, а помечает справкой
[`manifest.legacy-fields`](../../CHECKS.md#manifestlegacy-fields), и автоматический приём она не
отменяет. Кнопка «Убрать из widget.json» в терминале уберёт их за вас. Исключение — Colibri до 1.3.2
включительно: без `name` эти выпуски не загрузят папку и не поставят версию, поэтому, пока вы или ваши
пользователи на таком выпуске, `name` оставьте.

### <a id="manifest-name"></a>`name`

**Строка до 64 символов, устаревшее.** Коды:
[`manifest.invalid-name`](../../CHECKS.md#manifestinvalid-name),
[`manifest.missing-name`](../../CHECKS.md#manifestmissing-name).

Nest берёт его один раз — как название нового виджета, когда версию со старого Colibri загружают с ID,
которого Nest ещё не знает. В остальных случаях поле не читается.

### <a id="manifest-icon"></a>`icon`

**Путь до 256 символов, устаревшее.** Коды:
[`manifest.invalid-icon`](../../CHECKS.md#manifestinvalid-icon),
[`consistency.mismatch`](../../CHECKS.md#consistencymismatch).

Путь к картинке в архиве. Nest берёт её один раз — как иконку нового виджета или ни разу не
одобренного черновика без иконки; с Colibri до 1.3.0 включительно — при каждой загрузке. Иконку
задавайте в Nest: PNG (JPEG и WEBP тоже, SVG — нет) до 512 КБ, лучше всего квадрат 128×128 на прозрачном
фоне.

### <a id="manifest-author"></a>`author`

**Строка до 64 символов, устаревшее.** Код:
[`manifest.invalid-author`](../../CHECKS.md#manifestinvalid-author).

Не читается никогда: подпись под виджетом — имя из профиля автора.
