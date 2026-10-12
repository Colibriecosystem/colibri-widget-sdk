# @colibri-terminal/sdk

> English version — [README.en.md](README.en.md).

Клиент API виджетов Colibri — два файла, без сборки и без зависимостей:

| Файл | Что это |
| --- | --- |
| [`colibri.js`](colibri.js) | клиент: тонкая обёртка над `window.colibri`, который терминал кладёт в страницу до её кода |
| [`colibri.d.ts`](colibri.d.ts) | типы: подсказки в редакторе и проверка в TypeScript |

В npm пакет не публикуется — `package.json` здесь закрыт (`private`). Положите оба файла рядом со
страницей и импортируйте как модуль; в каждом [шаблоне](../starters/) их копия уже лежит.

```html
<script type="module">
  import { handshake, markets, stream } from "./colibri.js";
</script>
```

Новая версия SDK — это новые копии обоих файлов из этой папки.

- Каждый вызов, канал и событие: [справочник](../docs/reference/README.md); чем SDK отличается от
  голого `window.colibri` — [там же](../docs/reference/README.md#bridge-vs-sdk).
- Первый виджет шаг за шагом: [начало работы](../docs/getting-started.md).
