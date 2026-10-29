# Tatar Bu

Чистый стартовый frontend-фундамент без бизнес-функциональности.

## Стек

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Radix UI
- Lucide React
- Zustand
- TanStack Query
- Feature-Sliced Design
- ESLint
- Prettier
- Stylelint
- Husky + lint-staged

## Запуск

```bash
npm install
npm run dev
```

GPS / browser geolocation requires HTTPS in production. Local development works on
`localhost`.

## Mock-режим

Mock-режим позволяет пройти основной сценарий без backend и внешних API. Создайте `.env.local`:

```env
VITE_ENABLE_MOCKS=true
```

Затем запустите `npm run dev`. В development-режиме справа внизу появится индикатор
`MOCK MODE`. Для возврата к реальным интеграциям удалите переменную или задайте
`VITE_ENABLE_MOCKS=false` и перезапустите Vite.

MSW перехватывает создание и перестроение маршрута, объекты в области карты, исторические
объекты и рассказы, анонимного пользователя, оценки и speech API. Запросы к OSRM, Overpass и
Tatsoft также обрабатываются локально. Тестовая геолокация находится в центре Казани и
подменяется только в mock-режиме. Оценки и прогресс прогулки сохраняются в `localStorage`.

Моковые маршруты детерминированы и используют упрощённую геометрию между точками, поэтому
они подходят для демонстрации интерфейса, но не для реальной навигации. Чтобы проверить
обработку ошибки API, добавьте слово `ошибка` в AI-запрос при создании маршрута.

## Scripts

- `npm run dev` - запуск Vite dev server.
- `npm run build` - typecheck и production-сборка.
- `npm run preview` - preview production-сборки.
- `npm run lint` - проверка TypeScript/React кода ESLint.
- `npm run lint:fix` - автоисправление ESLint.
- `npm run format` - форматирование Prettier.
- `npm run format:check` - проверка форматирования.
- `npm run stylelint` - проверка CSS.
- `npm run stylelint:fix` - автоисправление CSS.
- `npm run typecheck` - проверка TypeScript без emit.

## Архитектура

Проект организован по Feature-Sliced Design:

- `app` - инициализация приложения, глобальные providers и стили.
- `pages` - страницы приложения.
- `widgets` - крупные композиционные блоки интерфейса.
- `features` - пользовательские сценарии и действия.
- `entities` - доменные сущности.
- `shared` - переиспользуемые инфраструктурные модули, UI, типы, helpers, config.

## UI и стили

Tailwind CSS - основной способ стилизации компонентов. Глобальные CSS-файлы используются
только для theme tokens, базовых стилей и интеграций, которые неудобно описывать
utility-классами.

shadcn/ui интегрирован в FSD без отдельной директории `components/`: компоненты лежат в
`src/shared/ui/*` и импортируются через публичные API.

```ts
import { Button } from '@shared/ui/button';
```

или:

```ts
import { Button } from '@shared/ui';
```

Для объединения Tailwind-классов используется helper `cn`:

```ts
import { cn } from '@shared/lib/cn';
```

Визуальная тема настроена через CSS variables в `src/app/styles/globals.css`. Светлая тема -
основная; dark mode оставлен архитектурно через shadcn-compatible variables.

## UI Kit Showcase

Временная development-витрина UI Kit находится в `src/pages/ui-kit` и сейчас рендерится на
корневом route приложения. Она нужна только для проверки theme tokens и базовых primitives.

## Импорты

Настроены алиасы:

- `@app/*`
- `@pages/*`
- `@widgets/*`
- `@features/*`
- `@entities/*`
- `@shared/*`

Модули slice должны экспортировать наружу только публичный API через `index.ts`.

```ts
import { useExampleFeatureStore } from '@features/example-feature';
```

Внутренние файлы другого slice напрямую не импортируются.

Для shadcn-компонентов допустимы прямые импорты из публичных модулей `@shared/ui/button`,
`@shared/ui/card` и т.д. Внутренние файлы чужих slice напрямую не импортируются.

## State Management

Zustand используется только для client state. Store должен находиться рядом с доменом,
которому принадлежит: например, `features/example-feature/model/store.ts`.

Не создавайте один большой глобальный store. Server state не хранится в Zustand.

## Server State

TanStack Query подключен через `AppProviders`.

Queries и mutations стоит размещать рядом с доменным модулем, который ими владеет:
например, в `features/*/api` или `entities/*/api`. Общий HTTP-клиент находится в
`shared/api` и не зависит от React.
