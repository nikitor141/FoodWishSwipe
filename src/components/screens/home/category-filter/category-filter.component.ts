import { AllCategories } from '@/api/products-fetcher.service.ts'
import { FilterItem } from '@/components/screens/home/category-filter/filter-item/filter-item.component.ts'
import { Home } from '@/components/screens/home/home.component.ts'
import { CheckboxChangeEvent } from '@/components/ui/checkbox/checkbox.component.ts'
import { Component } from '@/core/component/component.ts'
import { DragService } from '@/core/services/drag.service.ts'
import { DragEndEvent } from '@/core/services/drag.types'
import { ObserverService } from '@/core/services/observer.service.ts'
import { ProductsManagerEvent, ProductsManagerService } from '@/core/services/products-manager.service.ts'
import { RenderService } from '@/core/services/render.service.ts'
import { Store, StoreEvent } from '@/core/store/store.ts'

import styles from './category-filter.module.scss'
import template from './category-filter.template.html?raw'

type ObservableEvents = StoreEvent | ProductsManagerEvent

export class CategoryFilter implements Component {
	element!: ReturnType<typeof this.render>
	renderService: RenderService = RenderService.instance
	observerService: ObserverService = ObserverService.instance
	dragService: DragService = DragService.instance
	productsManagerService: ProductsManagerService = ProductsManagerService.instance
	store: Store = Store.instance

	#allCategories!: AllCategories
	#categoriesContainer!: HTMLUListElement
	#expanded: boolean = false

	#filterItemsById = new Map<number, FilterItem>()

	constructor() {
		this.observerService.subscribe(this, [this.store, this.productsManagerService], Home)
	}

	update({ type, data }: ObservableEvents) {
		const isScreenReady = this.store.state.screenReady
		switch (type) {
			case 'screenReady': {
				if (isScreenReady) this.#onScreenReady()
				break
			}
			case 'screen': {
				this.#filterItemsById.clear()
				break
			}
			case 'category-excluded':
			case 'subcategory-excluded':
			case 'category-included':
			case 'subcategory-included': {
				const filterItem = this.#filterItemsById.get(data)
				if (!filterItem) return

				filterItem.syncUi(type)
				break
			}
		}
	}

	#onScreenReady() {
		this.#addListeners()
	}

	#addListeners() {
		this.dragService.attach(this.element, {
			componentInstance: this,
			direction: 'vertical',
			threshold: 75,
			resistance: 2,
			snap: { animation: false, forwards: false },
			handles: [this.element.querySelector(`.${styles['category-filter__handle']}`), this.element],
			bounds: { rect: document.documentElement.getBoundingClientRect(), sides: ['top'] }
		})

		this.element.addEventListener('dragend', this.#handleDragend)
		this.#initCheckboxesListeners()
	}

	#handleDragend = (e: DragEndEvent<this>) => {
		if (e.detail.thresholdPassed.y) this.#toggleExpanded()
	}
	#toggleExpanded() {
		this.#expanded = !this.#expanded
		this.element.ariaExpanded = `${this.#expanded}`
	}

	#initCheckboxesListeners() {
		this.#categoriesContainer.addEventListener('checkbox:change', (e: CheckboxChangeEvent) => {
			if (!e.detail.changeIsTrusted) return

			const filterItem = FilterItem.from((e.target as HTMLElement).closest('[data-component="filter-item"]'))

			if (filterItem.isParent) {
				e.detail.checked
					? this.productsManagerService.excluded.includeCategory(filterItem.category.id)
					: this.productsManagerService.excluded.excludeCategory(filterItem.category.id)
				//	работает корректно
			} else {
				e.detail.checked
					? this.productsManagerService.excluded.includeSubcategory(
							filterItem.category.id,
							filterItem.parent.category.id
						)
					: this.productsManagerService.excluded.excludeSubcategory(
							filterItem.category.id,
							filterItem.parent.category.id
						)
			}
		})

		this.#categoriesContainer.addEventListener('checkbox:label-click', e => {
			const filterItem = FilterItem.from((e.target as HTMLElement).closest('[data-component="filter-item"]'))
			filterItem.handleCheckboxLabelClick()
		})
	}

	async #fillCategories() {
		this.#categoriesContainer = this.element.querySelector<HTMLUListElement>('#category-filter__list')!
		this.#allCategories = await this.productsManagerService.getAllCategories()

		for (const category of Object.values(this.#allCategories.categories)) {
			// Прохожу по каждой категории
			const subcategories = category.subcategory_ids.map(
				subcategory_id => this.#allCategories.subcategories[subcategory_id]
			) // Из id записанных в категории получаю объекты подкатегории из другого объекта

			const parentFilterItem = new FilterItem(category, subcategories)
			parentFilterItem.mount(this.#categoriesContainer, 'append')
			this.#filterItemsById.set(parentFilterItem.category.id, parentFilterItem)

			for (const childFilterItem of parentFilterItem.children) {
				this.#filterItemsById.set(childFilterItem.category.id, childFilterItem)
			}
		}
	}

	render(): HTMLElement {
		this.element = this.renderService.htmlToElement(template, [], styles) as HTMLElement

		void this.#fillCategories()

		return this.element
	}
}
