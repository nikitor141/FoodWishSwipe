import { FilterItem } from '@components/screens/home/category-filter/filter-item/filter-item.component.ts'
import { Home } from '@components/screens/home/home.component.ts'
import { CheckboxChangeEvent } from '@components/ui/checkbox/checkbox.component.ts'
import { Component } from '@core/component/component.ts'
import { DragCustomEvent, DragService } from '@core/services/drag.service.ts'
import { ObserverService } from '@core/services/observer.service.ts'
import { ProductsManagerEvent, ProductsManagerService } from '@core/services/products-manager.service.ts'
import { RenderService } from '@core/services/render.service.ts'
import { Store, StoreEvent } from '@core/store/store.ts'
import { AllCategories } from '@/api/products-fetcher.service.ts'
import styles from './category-filter.module.scss'
import template from './category-filter.template.html?raw'

type ObservableEvents = StoreEvent | ProductsManagerEvent

export class CategoryFilter implements Component {
	element: HTMLElement
	renderService: RenderService = RenderService.instance
	observerService: ObserverService = ObserverService.instance
	dragService: DragService = DragService.instance
	productsManagerService: ProductsManagerService = ProductsManagerService.instance
	store: Store = Store.instance

	#allCategories: AllCategories
	#expanded: boolean = false
	#categoriesContainer: HTMLUListElement

	#filterItemsById: Map<number, FilterItem> = new Map()

	constructor() {
		this.observerService.subscribe(this, [this.store, this.productsManagerService], Home)
	}

	update({ type, data }: ObservableEvents): void {
		const isScreenReady = this.store.state.screenReady

		switch (type) {
			case 'screenReady':
				if (isScreenReady) this.#onScreenReady()
				break
			case 'screen':
				this.#filterItemsById.clear()
				break
			case 'category-excluded':
			case 'subcategory-excluded':
			case 'category-included':
			case 'subcategory-included': {
				const filterItem = this.#filterItemsById.get(data)
				if (!filterItem) return

				filterItem.syncUi(type)
				break
			}
			// case 'category-excluded': {
			// 	const filterItem = this.#filterItemsById.get(data)
			// 	filterItem.checkbox.setStatus(false)
			// 	filterItem.setChildrenStatuses(false)
			// 	break
			// }
			// case 'category-added': {
			// 	const filterItem = this.#filterItemsById.get(data)
			// 	filterItem.checkbox.setStatus(true)
			// 	filterItem.setChildrenStatuses(true)
			// 	break
			// }
			// case 'subcategory-excluded': {
			// 	const filterItem = this.#filterItemsById.get(data)
			// 	filterItem.checkbox.setStatus(false)
			// 	filterItem.updateStatusByChildren()
			// 	filterItem.updateIndeterminateState()
			// 	break
			// }
			// case 'subcategory-added': {
			// 	const filterItem = this.#filterItemsById.get(data)
			// 	filterItem.checkbox.setStatus(true)
			// 	filterItem.updateStatusByChildren()
			// 	filterItem.updateIndeterminateState()
			// 	break
			// }
		}
	}

	#onScreenReady() {
		this.#addListeners()
	}

	#addListeners(): void {
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

	#handleDragend = (e: DragCustomEvent<this>): void => {
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
					? this.productsManagerService.includeCategory(filterItem.category.id)
					: this.productsManagerService.excludeCategory(filterItem.category.id)
				//	работает корректно
			} else {
				e.detail.checked
					? this.productsManagerService.includeSubcategory(filterItem.category.id, filterItem.parent.category.id)
					: this.productsManagerService.excludeSubcategory(filterItem.category.id, filterItem.parent.category.id)
			}
		})

		this.#categoriesContainer.addEventListener('checkbox:label-click', e => {
			const filterItem = FilterItem.from((e.target as HTMLElement).closest('[data-component="filter-item"]'))
			filterItem.handleCheckboxLabelClick()
		})
	}

	async #fillCategories() {
		this.#categoriesContainer = this.element.querySelector<HTMLUListElement>('#category-filter__list')
		this.#allCategories = await this.productsManagerService.getAllCategories()

		for (const category of Object.values(this.#allCategories.categories)) {
			const subcategories = category.subcategoryIds.map(
				subcategoryId => this.#allCategories.subcategories[subcategoryId]
			)

			const parentFilterItem = new FilterItem(category, subcategories)
			parentFilterItem.mount(this.#categoriesContainer, 'append')
			this.#filterItemsById.set(category.id, parentFilterItem)

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
