
# Архитектура приложения

## Очередность выполнения при запуске

1. **main.ts** - инициализирует `Router.instance`
2. **Router** (Singleton) - конструктор выполняет:
    - Подписка на `popstate` события
    - Вызов `Store.init()` (сохранение начального состояния в localStorage)
    - Вызов `#handleRouteChange()` - определение текущего роута и запуск рендеринга
    - Вызов `#handleLinks()` - делегирование кликов по ссылкам
3. **Layout** (Singleton) - при первом обращении через `Layout.instance`:
    - Инициализирует `ThemesService.init()` (применение сохраненной темы)
4. **Layout.setScreen()** - вызывается роутером:
    - Устанавливает `screenReady: false` в Store
    - Вызывает `screen.instance.init()` (установка title)
    - Вызывает `screen.instance.render()` (рендер экрана)
    - Очищает контейнер контента через `innerHTML = ''`
    - Добавляет элемент экрана в DOM
    - В `requestAnimationFrame` устанавливает `screenReady: true`
5. **Обсерверы** подписанные на `screenReady` получают уведомление и добавляют свои обработчики событий

---

## Типы компонентов

### 1. **BaseScreen** - Экраны (Singleton)
Наследуются от `BaseScreen` и `Singleton`. Это корневые компоненты маршрутов.

**Особенности:**
- Являются синглтонами (один экземпляр на весь жизненный цикл приложения)
- Регистрируются в `ROUTES` объекте
- Имеют метод `init()` для начальной настройки (установка title)
- Не имеют метода `mount()` - их рендерят напрямую через `render()`
- Уничтожаются только при переходе на другой экран через `innerHTML = ''` в Layout

**Примеры:**
- `Home`
- `WishList`

**Жизненный цикл:**
Создание синглтона → init() → render() → вставка через append в Layout → (screenReady = true)

---

### 2. **Статические компоненты** - Рендер через кастомные HTML-теги
Объявляются в HTML-шаблоне через тег `<component-название>` и автоматически заменяются на отрендеренный компонент.

**Особенности:**
- Указываются в массиве компонентов при вызове `RenderService.htmlToElement()`
- `RenderService` автоматически заменяет кастомные теги на результат `render()`
- Добавляются в DOM синхронно при парсинге шаблона
- **НЕ имеют метода `mount()`**
- Если нужны обработчики с координатами элемента - ~~добавляются в методе `render()` **ПОСЛЕ** того как элемент уже создан, но **ДО** возврата из `render()`~~

**Примеры:**
- `Header` (в layout.template.html: `<component-header>`)
- `ThemeSwitcher` (в header.template.html: `<component-theme-switcher>`)
- `Products` (в home.template.html: `<component-products>`)
- `CategoryFilter` (в home.template.html: `<component-category-filter>`)

**Особенности обработчиков:**
- Если НЕ нужны координаты - обработчики добавляются сразу в `render()` через простое присваивание:
  ```typescript
  render() {
    this.element = this.renderService.htmlToElement(...)
    this.element.onclick = () => this.themeService.toggleTheme() // ← сразу
    return this.element
  }
  ```
- Если НУЖНЫ координаты (getBoundingClientRect и т.д.) - используется паттерн Observer + `screenReady/layoutReady`:
  ```typescript
  constructor() {
    this.observerService.subscribe<StoreEvents>(this, [this.store])
  }
  
  update(key, value) {
    if (key === 'layoutReady' && value) {
      this.#addListeners() // ← здесь, когда элемент в DOM
    }
  }
  
  #addListeners() {
    const coords = this.element.getBoundingClientRect() // ← теперь работает
    // ...
  }
  ```

**Жизненный цикл:**
render() (создание + подписка на обсерверы если нужно) → автозамена тега RenderService → вставка в DOM родителя → (layoutReady/screenReady = true) → обсерверы получают уведомление → добавление обработчиков с координатами

---

### 3. **Динамические компоненты** - Монтируются через `mount()`
Создаются программно и монтируются в DOM через метод `mount()`.

**Особенности:**
- **Обязательно имеют метод `mount(parent, method)`**
- Создаются через `new Component()`
- При вызове `mount()` - если `element` не создан, вызывается `render()`
- Затем `element` вставляется в родителя через `parent[method](this.element)`
- Обработчики событий добавляются **через `requestAnimationFrame` внутри `mount()`**, чтобы элемент точно был в DOM
  - Notification и ProductCard сейчас используют только обработчики, требующие координаты
- Используются для динамически добавляемых элементов (списки, карточки и т.д.)

**Примеры:**
- `Notification` - монтируется NotificationService через `mount(container, 'prepend')`
- `ProductCard` - монтируется в Products через `mount(productsListEl, 'prepend')`
- `FilterItem` - монтируется в CategoryFilter через `mount(ul, 'append')`

**Паттерн с обработчиками:**
```typescript 
  mount(parent, method) { 
	if (!this.element) this.element = this.render()
    parent[method](this.element)
    requestAnimationFrame(() => { 
			if (!this.element || this.#isDestroying) return this.#addListeners() // ← обработчики добавляются здесь, когда элемент в DOM 
        }) 
  }
#addListeners() { 
	this.dragService.attach(this.element, ...) // требует координат
    this.element.addEventListener('dragmove', this.#handleDragMove) 
}
```

**Жизненный цикл:**
new Component() → mount() → (если нет element) render() → вставка в parent → requestAnimationFrame(() => addListeners())

---

### 4. **Смешанные компоненты** - И статические, И динамические
Могут работать в обоих режимах в зависимости от ситуации.

**Особенности:**
- Имеют **и `render()`, и `mount()`**
- Если используются как статические - рендерятся через кастомный тег
- Если используются как динамические - создаются через `new` и монтируются через `mount()`
- Пример: `Checkbox` - может быть создан как динамически в FilterItem, так и вставлен через тег (хотя в текущем коде используется только динамически)

**Примеры:**
- `Checkbox` - монтируется динамически в FilterItem
- `FilterItemSubcategoriesList` - монтируется динамически

**Паттерн:**
```typescript 
mount(parent, method) {
  if (!this.element) this.element = this.render()
  parent[method](this.element) 
}
render() { 
  this.element = this.renderService.htmlToElement(...) 
  return this.element 
}
```

---

## Правила добавления обработчиков событий

### Когда НЕ нужны координаты элемента

1. **Статические компоненты** — добавляем сразу в `render()`:
   ```ts
   render() {
      this.element = this.renderService.htmlToElement(...)
   
      this.element.onclick = () => {
         /* ... */
      }
   
      return this.element
   }
   ```
2. **Динамические компоненты с простыми событиями** - добавляем в `render()`:
   ```ts
   render() {
      this.element = this.renderService.htmlToElement(...)
      
      this.element.querySelector('button').onclick = () => {
      /* ... */
      }
   
   return this.element
   }
   ```

### Когда НУЖНЫ координаты элемента:

1. **Статические компоненты** - используем паттерн Observer:
   ```ts
      constructor() {
        this.observerService.subscribe(this, [this.store], ScreenClass)
        // с привязкой к экрану
        
        // или
        
        this.observerService.subscribe(this, [this.store])
        // без привязки (независимый)
      }
      
      update(key, value) {
        const isLayoutReady = this.store.state.layoutReady
        if (key === 'layoutReady' && isLayoutReady) {
          this.#addListeners()
        }
      }
      
      #addListeners() {
        const coords = this.element.getBoundingClientRect()
      
        // работа с координатами
      }
      
   ```

2. **Динамические компоненты** - используем `requestAnimationFrame` в `mount()`:
   ```ts
   mount(parent, method) {
   if (!this.element) this.element = this.render()
   
   parent[method](this.element)
   
   requestAnimationFrame(() => {
    if (!this.element || this.#isDestroying) return
      this.#addListeners()
    })
   }
   
   #addListeners() {
    const coords = this.element.getBoundingClientRect()
   
    // работа с координатами
   }
   ```

---

## Делегирование событий

Для оптимизации некоторые компоненты используют **делегирование событий на document**:

**Паттерн (Checkbox):**
```ts
static isEventsDelegated: boolean = false

#addListeners() {
  document.addEventListener('change', e => {
    const checkboxEl = e.target.closest('[data-ui="checkbox"]')
    const checkbox = Checkbox.from(checkboxEl) // WeakMap для получения инстанса

    if (!checkbox) return

    // обработка
  })

  Checkbox.isEventsDelegated = true
}

render() {
  this.element = this.renderService.htmlToElement(...)

  if (!Checkbox.isEventsDelegated) {
    this.#addListeners() // ← один раз для всех
  }

  return this.element
}

```

**Используется в:**
- `Checkbox` - делегирует события `change` и `click` на document

---

## Жизненный цикл и очистка компонентов

### 1. Очистка через `innerHTML = ''`

**Используется для экранов и крупных контейнеров.**

**Где происходит:**
- `Layout.setScreen()` - очищает предыдущий экран: `content.innerHTML = ''`

**Что происходит:**
1. Все элементы удаляются из DOM
2. **НЕ вызывается** `destroy()` на компонентах
3. ~~**НЕ удаляются** обработчики событий (могут остаться утечки!)~~ Удаляется элемент = удаляются обработчики
4. `ObserverService.clearObservers(previousScreen)` - очищает подписки обсерверов для предыдущего экрана
5. Garbage Collector очищает неиспользуемые объекты

**Порядок событий при смене экрана:**
1. Router.navigate()
2. Store.updateState('screen', { previous, current })
3. ObserverService.clearObservers(previousScreen) ← очистка обсерверов
4. Layout.setScreen()
5. Store.updateState('screenReady', false)
6. screen.init()
7. screen.render()
8. content.innerHTML = '' ← удаление старого экрана
9. content.append(screenElement) ← вставка нового
10. requestAnimationFrame(() => Store.updateState('screenReady', true))
11. Обсерверы нового экрана получают уведомление и добавляют обработчики

---

### 2. Очистка через метод `destroy()`

**Используется для динамических компонентов.**

**Примеры компонентов с `destroy()`:**
- `Notification`
- `ProductCard`

**Паттерн Notification:**
```ts
#isDestroying: boolean = false
destroy() { 
	if (this.#isDestroying) return
    this.#isDestroying = true
    this.element.classList.add(styles['notification--vanishing']) // CSS анимация
    this.element.onanimationend = () => { 
		this.element.dispatchEvent(new CustomEvent('notifDestroyed', { bubbles: true, detail: { instance: this } })) // ← уведомление сервиса
        this.dragService.detach(this.element) // ← удаление обработчиков DragService
        this.element.onanimationend = null
        this.element.remove() // ← удаление из DOM
        this.element = null // ← очистка ссылки
    } 
}
```

**Порядок событий при destroy() компонента:**
1. destroy() вызывается извне (NotificationService.#destroyNotif)
2. Проверка флага #isDestroying
3. Установка флага #isDestroying = true
4. Добавление CSS класса для анимации исчезновения
5. Назначение обработчика onanimationend
6. (анимация проигрывается)
7. В onanimationend: a. Dispatch кастомного события (если нужно уведомить сервис) b. Удаление обработчиков (dragService.detach, removeEventListener и т.д.) c. Очистка onanimationend d. element.remove() - удаление из DOM e. element = null - очистка ссылки

**Паттерн ProductCard:**
```typescript 
destroy(direction?: 'left' | 'right' | 'up' | 'down') { 
	if (this.#isDestroying) return
    const clear = () => { 
		this.dragService.detach(this.element) 
        this.element.onanimationend = null 
        this.element.remove() 
        this.element = null 
	}
    this.#isDestroying = true
   
    if (direction) { 
        this.element.classList.add(styles[`product-card--vanishing-${direction}`]) 
        this.element.onanimationend = clear 
	} else { 
		clear() // ← мгновенная очистка без анимации 
    } 
}
```

**Порядок событий при destroy(direction):**
1. destroy(direction) вызывается из ProductsManagerService
2. Проверка #isDestroying
3. Установка #isDestroying = true
4. Если есть direction: a. Добавление класса анимации b. Назначение clear на onanimationend c. (анимация) d. clear(): удаление обработчиков → remove() → element = null
5. Если нет direction: a. clear() сразу - мгновенное удаление

---

## Управление подписками Observer

**Обсерверы бывают двух типов:**

### 1. Независимые (Independent)
Подписываются без указания экрана, живут весь жизненный цикл приложения.
```typescript 
constructor() { 
	this.observerService.subscribe(this, [this.store]) // ← без 3-го параметра 
}
```

**Примеры:**
- `Header` - подписан на Store, живет всегда
- `ThemeSwitcher` - подписан на Store

**Очистка:** НЕ очищаются автоматически при смене экрана.

---

### 2. Привязанные к экрану (byScreen)
Подписываются с указанием экрана, очищаются при уходе с экрана.
```typescript 
constructor() { 
	this.observerService.subscribe(this, [this.store], Home) // ← 3-й параметр - класс экрана 
}
```

**Примеры:**
- `CategoryFilter` - подписан на Store с привязкой к Home
- `Products` - подписан на ProductsManagerService с привязкой к Home

**Очистка:** Автоматически при смене экрана через `ObserverService.clearObservers(previousScreen)`.

---

## Особенности RenderService

**RenderService** автоматически обрабатывает:

1. **CSS Modules** - заменяет классы на хешированные:
   ```typescript 
   this.#applyModuleStyles(styles, rootElement) // .header → .header_a8s9d7
   ```

2. **Кастомные теги компонентов** - заменяет на отрендеренные компоненты:
   ```html 
   <component-theme-switcher></component-theme-switcher> ↓ ...
   ```

3. **Специальные теги изображений** - заменяет `<img data-src="...">` на `<picture>`:
```html
<img data-src="/src/assets/img/foo.png" alt="foo">
↓
<picture>
  <source srcset="foo.avif" type="image/avif">
  <source srcset="foo.webp" type="image/webp">
  <img src="foo.png" width="800" height="600" loading="lazy" alt="foo">
</picture>
```
## Получение инстанса компонента из элемента 
Некоторые компоненты сохраняют связь элемент ↔ инстанс через WeakMap:
```typescript
 static #instancesByElement: WeakMap<HTMLElement, ComponentClass> = new WeakMap()

static from(element: HTMLElement): ComponentClass {
return this.#instancesByElement.get(element)
}

mount(parent, method) {
if (!this.element) this.element = this.render()

ComponentClass.#instancesByElement.set(this.element, this) // ← сохранение связи

parent[method](this.element)
} 
```
**Используется в:**
- - для делегирования событий `Checkbox`
- - для делегирования событий через CategoryFilter `FilterItem`

**Применение:**
```typescript
// В CategoryFilter при делегировании:
this.#categoriesContainer.addEventListener('checkbox:change', (e) => {
  const filterItem = FilterItem.from(
    e.target.closest('[data-component="filter-item"]')
  ) // ← получение инстанса из элемента
  
  filterItem.handleCheckboxInputChange(...)
})
```
## Итоговая схема архитектуры
```
main.ts
└─→ Router (Singleton)
├─→ Store.init() (сохранение состояния)
├─→ #handleRouteChange()
│    ├─→ ObserverService.clearObservers(previousScreen)
│    ├─→ Store.updateState('screen', { previous, current })
│    └─→ Layout.setScreen()
│         ├─→ ThemesService.init() (при первом вызове Layout)
│         ├─→ Store.updateState('screenReady', false)
│         ├─→ screen.init() (title)
│         ├─→ screen.render()
│         │    └─→ RenderService.htmlToElement()
│         │         ├─→ Замена CSS классов
│         │         ├─→ Замена <component-*> тегов
│         │         │    └─→ component.render()
│         │         │         └─→ (подписка на обсерверы если нужны координаты)
│         │         └─→ Замена <img data-src>
│         ├─→ content.innerHTML = '' (очистка старого экрана)
│         ├─→ content.append(screenElement)
│         └─→ requestAnimationFrame(() => Store.updateState('screenReady', true))
│              └─→ Обсерверы получают уведомление
│                   └─→ addListeners() с координатами
└─→ #handleLinks() (делегирование кликов по ссылкам)
```

Я создал полное и детальное описание архитектуры вашего самописного фреймворка. Документация включает:

✅ **Типы компонентов** с четким разделением:
- BaseScreen (экраны-синглтоны)
- Статические (через кастомные теги)
- Динамические (через mount())
- Смешанные

✅ **Правила добавления обработчиков** в зависимости от необходимости координат элемента

✅ **Жизненный цикл и очистку** - два способа (innerHTML и destroy()) с детальными порядками событий

✅ **Паттерны делегирования событий** и получения инстансов из элементов

✅ **Схему работы ObserverService** с независимыми и привязанными к экрану подписками

Документация написана максимально практично, с примерами кода и схемами последовательности выполнения. Она поможет быстро понять архитектуру и правильно писать новые компоненты! 🎯