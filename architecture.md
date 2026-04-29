# Архитектура приложения

## Очередность выполнения при запуске

1. **main.ts** — вызывает `Router.instance.init()`
2. **Router** (Singleton) — при создании экземпляра инициализирует:
   - `ObserverService.instance`, `Store.instance`, `NotificationService.instance`
   - `Layout.instance` → Layout конструктор вызывает `ThemesService.init()`
3. **Router.init()** выполняет:
   - Подписку на `popstate`
   - `Store.init()` — сохранение начального состояния в localStorage
   - `#handleRouteChange()` — определение текущего маршрута и запуск рендеринга
   - `#handleLinks()` — делегирование кликов по ссылкам на `document`
4. **Layout.setScreen()** (вызывается из `#handleRouteChange`):
   - `Store.updateState('screenReady', false)`
   - Если `layout.element` нет — `layout.render()`:
     - Добавляет себя в `#app`
     - `requestAnimationFrame(() => Store.updateState('layoutReady', true))`
   - `screen.instance.init()` — установка title
   - `screen.instance.render()` — рендер экрана
   - `content.innerHTML = ''` — очистка старого экрана
   - `content.append(screenElement)` — вставка нового
   - `requestAnimationFrame(() => Store.updateState('screenReady', true))`
5. **Наблюдатели**, подписанные на `layoutReady` / `screenReady`, получают уведомление и добавляют обработчики, требующие координат

> На первой загрузке оба `requestAnimationFrame` ставятся в очередь в одном синхронном вызове.  
> `layoutReady` регистрируется раньше, поэтому срабатывает первым, затем `screenReady`.  
> На последующих переходах layout уже отрендерен — срабатывает только `screenReady`.

---

## Интерфейсы компонентов

Определены в `src/core/component/component.ts`:

```typescript
// Базовый интерфейс — все компоненты
interface Component {
	element: HTMLElement | null
	renderService: RenderService
	render(): HTMLElement
	update?({ type, data }): void // необязателен
}

// Статический — рендерится раз, не монтируется
interface StaticComponent extends Component {}

// Динамический — монтируется и уничтожается программно
interface DynamicComponent extends Component {
	isDestroying: boolean
	mount(parent: HTMLElement, method: 'append' | 'prepend'): void
	destroy(...args: unknown[]): void
}

// Смешанный — реализует оба
interface HybridComponent extends StaticComponent, DynamicComponent {}
```

---

## Типы компонентов

### 1. BaseScreen — экраны (Singleton + StaticComponent)

Наследуются от `BaseScreen extends Singleton`, реализуют `StaticComponent`.

- Каждый экран — синглтон, один экземпляр на весь жизненный цикл приложения
- Регистрируются в `ROUTES`
- Нет `mount()` — вставляются в DOM напрямую через `Layout.setScreen()`
- Уничтожаются очисткой через `content.innerHTML = ''`
- Абстрактные методы: `render()`, `init()`
- Опциональные методы: `destroy()`, `addListeners()`, `removeListeners()`

**Жизненный цикл:**

```
Singleton создаётся → init() → render() → Layout.content.innerHTML = '' → content.append(screenElement)
→ requestAnimationFrame → screenReady = true
```

**Примеры:** `Home`, `WishList`

---

### 2. Статические компоненты — рендер через кастомные HTML-теги

Объявляются в шаблоне через `<component-название>` и автоматически заменяются `RenderService`.

- Передаются вторым аргументом в `RenderService.htmlToElement(html, [ComponentClass], styles)`
- `RenderService` находит тег `<component-название>` → создаёт `new ComponentClass(attrs)` → вызывает `.render()` → вставляет результат вместо тега
- Атрибуты тега становятся аргументами конструктора (числовые строки конвертируются в `number`)
- **Нет `mount()`**
- Обработчики без координат — сразу в `render()`
- Обработчики с координатами — через Observer на `layoutReady` или `screenReady`

**Примеры:**

- `Header` — в `layout.template.html`: `<component-header>`
- `ThemeSwitcher` — в `header.template.html`: `<component-theme-switcher>`
- `Products` — в `home.template.html`: `<component-products>`
- `CategoryFilter` — в `home.template.html`: `<component-category-filter>`

**Жизненный цикл:**

```
RenderService находит тег → new Component(attrs) → render() (+ подписка на Observer если нужно)
→ тег заменяется в DOM родителя → layoutReady/screenReady = true
→ Observer уведомляет → addListeners() с координатами
```

---

### 3. Динамические компоненты — монтируются через `mount()`

Создаются через `new Component()` и монтируются в DOM программно.

- Обязательно имеют `mount(parent, method)` и `destroy()`
- Если `this.element` нет — `mount()` сам вызывает `render()`
- Обработчики, требующие координат, добавляются в `requestAnimationFrame` внутри `mount()`
- Имеют флаг `isDestroying` для предотвращения двойного уничтожения
- По соглашению все компоненты, реализующие `DynamicComponent`, хранят связь `element → instance` через статический `WeakMap` и предоставляют статический метод `from(element)` для получения экземпляра по DOM-элементу; регистрация происходит в `mount()` до вставки в DOM

**Примеры:** `Notification`, `ProductCard`, `FilterItem`

**Жизненный цикл:**

```
new Component() → mount() → (если нет element) render() → parent[method](element)
→ requestAnimationFrame(() => addListeners()) — для слушателей с координатами
```

---

### 4. Смешанные (Hybrid) компоненты — и статические, и динамические

Реализуют `HybridComponent` — оба интерфейса (`StaticComponent` + `DynamicComponent`).

- Имеют **и `render()`, и `mount()`**
- В текущем коде используются преимущественно как динамические

**Примеры:** `Checkbox`, `FilterItemSubcategoriesList`

---

## Правила добавления обработчиков событий

> **Соглашение:** `addEventListener` никогда не вызывается напрямую в теле `render()`, `mount()` или других методов.  
> Все подписки инкапсулированы в приватные методы `#addListeners()` или `#addListenersRequiredReadyDOM()` — для наглядного разделения логики рендера и логики поведения.

### Когда НЕ нужны координаты элемента

`render()` вызывает `#addListeners()`:

```typescript
render() {
  this.element = this.renderService.htmlToElement(template, [], styles)
  this.#addListeners()
  return this.element
}

#addListeners() {
  this.element.addEventListener('click', () => this.service.doSomething())
  this.#categoriesContainer.addEventListener('checkbox:change', this.#handleChange)
}
```

> Применимо и для статических, и для динамических компонентов.  
> `CategoryFilter` добавляет делегированные слушатели на `checkbox:change` и `checkbox:label-click` через `#addListeners()` из `render()`.

---

### Когда НУЖНЫ координаты элемента (getBoundingClientRect, DragService.attach и т.д.)

**Статические компоненты** — паттерн Observer:

```typescript
constructor() {
  // Подписка с привязкой к экрану:
  this.observerService.subscribe(this, [this.store, this.productsManagerService], Home)
  // Или независимая (для компонентов в layout):
  this.observerService.subscribe(this, [this.store])
}

update({ type, data }) {
  switch (type) {
    case 'screenReady': {   // или 'layoutReady' для компонентов layout
      if (this.store.state.screenReady) this.#addListenersRequiredReadyDOM()
      break
    }
  }
}

#addListenersRequiredReadyDOM() {
  this.dragService.attach(this.element, {
    bounds: { rect: document.documentElement.getBoundingClientRect(), ... }
  })
}
```

> `layoutReady` — для компонентов, которые рендерятся один раз вместе с Layout (напр. `Header`).  
> `screenReady` — для компонентов, которые рендерятся при каждом заходе на экран (напр. `CategoryFilter`).

**Динамические компоненты** — `requestAnimationFrame` в `mount()`:

```typescript
mount(parent, method) {
  if (!this.element) this.element = this.render()
  parent[method](this.element)

  requestAnimationFrame(() => {
    if (!this.element || this.isDestroying) return
    this.#addListenersRequiredReadyDOM()
  })
}

#addListenersRequiredReadyDOM() {
  this.dragService.attach(this.element, this.dragConfig)
}
```

---

## Делегирование событий

Для компонентов, которые создаются часто, используется **делегирование на `document`** — один слушатель для всех экземпляров.

**Паттерн (Checkbox):**

```typescript
static isEventsDelegated: boolean = false

#addListeners() {
  document.addEventListener('change', e => {
    const checkboxEl = e.target?.closest('[data-ui="checkbox"]')
    const checkbox = Checkbox.from(checkboxEl)   // WeakMap: element → instance
    if (!checkbox) return
    // обработка...
  })
  Checkbox.isEventsDelegated = true
}

render() {
  this.element = this.renderService.htmlToElement(...)
  if (!Checkbox.isEventsDelegated) this.#addListeners()   // один раз на всё приложение
  return this.element
}
```

**Используется в:** `Checkbox` — делегирует события `change` и `click` на `document`.

---

## WeakMap: получение экземпляра компонента из элемента

Динамические компоненты хранят связь `element → instance` через `WeakMap`:

```typescript
static #instancesByElement = new WeakMap<HTMLElement, ComponentClass>()

static from(element: HTMLElement): ComponentClass | undefined {
  return this.#instancesByElement.get(element)
}

mount(parent, method) {
  if (!this.element) this.element = this.render()
  ComponentClass.#instancesByElement.set(this.element, this)   // регистрация
  parent[method](this.element)
}
```

**Используется в:** `Checkbox`, `FilterItem`, `ProductCard`, `Notification`

**Применение:**

```typescript
// В CategoryFilter — получение FilterItem по DOM-элементу:
this.#categoriesContainer.addEventListener('checkbox:change', e => {
	const filterItem = FilterItem.from((e.target as HTMLElement).closest('[data-component="filter-item"]'))
	filterItem.handleCheckboxLabelClick()
})
```

---

## Жизненный цикл и очистка компонентов

### 1. Очистка через `innerHTML = ''`

Используется для экранов при переходах.

**Где происходит:** `Layout.setScreen()` — `content.innerHTML = ''`

**Порядок событий при смене экрана:**

1. `Router.navigate(path)` → `history.pushState()` → `popstate`
2. `Router.#handleRouteChange()`:
   - запоминает `previousRoute`
   - `Store.updateState('screen', { previous, current })`:
     - `#notify('screen', ...)` — все наблюдатели получают событие `'screen'`
     - `ObserverService.clearObservers(previousScreen)` — удаление byScreen-подписок предыдущего экрана
3. `Router.#render()` → `Layout.setScreen(currentRoute)`:
   - `Store.updateState('screenReady', false)` — уведомление наблюдателей
   - `screen.init()` — установка title
   - `screen.render()` — создание нового DOM-дерева экрана (не вставлено в документ)
   - `content.innerHTML = ''` — удаление предыдущего экрана из DOM
   - `content.append(screenElement)` — вставка нового
   - `requestAnimationFrame(() => Store.updateState('screenReady', true))` — уведомление наблюдателей о готовности

> `innerHTML = ''` удаляет элементы из DOM — все прикреплённые к ним обработчики тоже исчезают.  
> `destroy()` на компонентах экрана при этом **не вызывается**.  
> Подписки наблюдателей очищаются через `clearObservers` по типу экрана.

---

### 2. Очистка через `destroy()`

Используется для динамических компонентов.

**Паттерн Notification (с анимацией):**

```typescript
destroy() {
  if (this.isDestroying || !this.element) return
  this.isDestroying = true

  this.element.classList.add(styles['notification--vanishing'])   // CSS-анимация

  this.element.onanimationend = () => {
    if (!this.element) return
    this.element.dispatchEvent(
      new CustomEvent('notifDestroyed', { bubbles: true, detail: { instance: this } })
    )                                             // 1. уведомление сервиса
    this.dragService.detach(this.element)         // 2. удаление обработчиков DragService
    this.element.onanimationend = null            // 3. очистка onanimationend
    this.element.remove()                         // 4. удаление из DOM
    this.element = null                           // 5. обнуление ссылки
  }
}
```

**Паттерн ProductCard (с опциональной анимацией):**

```typescript
destroy(direction?: DragEndEvent['detail']['direction']) {
  if (this.isDestroying || !this.element) return
  this.isDestroying = true

  const clear = () => {
    if (this.draggable) this.dragService.detach(this.element)
    this.element.onanimationend = null
    this.element.remove()
    this.element = null
  }

  if (direction?.x) {
    this.element.classList.add(styles[`product-card--vanishing-${direction.x}`])
    this.element.onanimationend = clear     // ← анимация → clear
  } else {
    clear()                                 // ← мгновенная очистка
  }
}
```

**Порядок событий при `destroy()`:**

1. Проверка `isDestroying || !element`
2. `isDestroying = true`
3. Если есть анимация: добавить CSS-класс → ждать `animationend`
4. В `animationend` (или сразу если без анимации):
   a. Dispatch кастомного события (если нужно уведомить внешний код)
   b. `dragService.detach(element)` — снятие drag-обработчиков
   c. `element.onanimationend = null`
   d. `element.remove()`
   e. `element = null`

---

## Управление подписками Observer

### Независимые (independent)

Подписываются без указания экрана — живут весь жизненный цикл приложения, не очищаются при смене экранов.

```typescript
constructor() {
  this.observerService.subscribe(this, [this.store])   // без 3-го аргумента
}
```

**Примеры:** `Header`, `ThemeSwitcher`

---

### Привязанные к экрану (byScreen)

Подписываются с указанием класса экрана — автоматически удаляются при уходе с этого экрана.

```typescript
constructor() {
  this.observerService.subscribe(this, [this.store, this.productsManagerService], Home)
}
```

**Примеры:** `CategoryFilter`, `Products`

**Когда очищаются:** `Store.updateState('screen', ...)` вызывает `ObserverService.clearObservers(previousScreen)`.

---

### Как работает ObserverService

```
observerService.makeObservable(subject, getScreens)
   → возвращает функцию notify(type, data)
   → при вызове notify — уведомляет independent + byScreen[previous] + byScreen[current]

observerService.subscribe(observer, [observable1, ...], screen?)
   → регистрирует observer в independent или byScreen[screen]

observerService.clearObservers(screen)
   → удаляет byScreen[screen] из всех observables
```

> Во время перехода между экранами `#notify` уведомляет наблюдателей как предыдущего, так и текущего экрана.  
> Это позволяет компонентам уходящего экрана (напр. `CategoryFilter`) получить событие `'screen'` и очистить внутреннее состояние.

---

## Особенности RenderService

`htmlToElement<T>(html, components, styles)` выполняет три шага:

1. **Парсинг шаблона** через `<template>` + `innerHTML` — требует единственного корневого элемента

2. **CSS Modules** — заменяет все оригинальные классы на хешированные:

   ```
   class="header" → class="header_a8s9d7"
   ```

3. **Замена специальных тегов:**
   - `<img data-src="...">` → `<picture>` с `<source avif>`, `<source webp>`, `<img>`
   - `<component-*>` → результат `new FoundComponent(attrs).render()`
     - атрибуты тега передаются как объект в конструктор
     - числовые строки конвертируются в `number`

---

## Итоговая схема архитектуры

```
main.ts
└─→ Router.instance.init()
     ├─→ Store.init()
     ├─→ #handleRouteChange()
     │    ├─→ Store.updateState('screen', { previous, current })
     │    │    ├─→ notify('screen') → все наблюдатели
     │    │    └─→ ObserverService.clearObservers(previousScreen)
     │    └─→ Layout.setScreen(currentRoute)
     │         ├─→ Store.updateState('screenReady', false) → наблюдатели
     │         ├─→ [первый раз] Layout.render()
     │         │    ├─→ htmlToElement([NotificationList, Header], styles)
     │         │    │    └─→ new Header().render() + new NotificationList().render()
     │         │    ├─→ appElement.innerHTML = ''
     │         │    ├─→ appElement.append(layout)
     │         │    └─→ rAF → Store.updateState('layoutReady', true) → Header.update()
     │         ├─→ screen.init()
     │         ├─→ screen.render()
     │         │    └─→ htmlToElement([Products, CategoryFilter], styles)
     │         │         ├─→ new Products().render() → htmlToElement([ProductCard,...])
     │         │         └─→ new CategoryFilter().render()
     │         │              ├─→ #addListeners() (без координат, на container)
     │         │              └─→ #fillCategories() (async)
     │         │                   └─→ new FilterItem(...).mount(ul, 'append')
     │         │                        └─→ new Checkbox(...).mount(li, 'prepend')
     │         ├─→ content.innerHTML = ''
     │         ├─→ content.append(screenElement)
     │         └─→ rAF → Store.updateState('screenReady', true)
     │                   └─→ CategoryFilter.update('screenReady')
     │                        └─→ #addListenersRequiredReadyDOM()
     │                             └─→ dragService.attach(element, { bounds: getBoundingClientRect() })
     └─→ #handleLinks() (делегирование кликов по <a> на document)
```
