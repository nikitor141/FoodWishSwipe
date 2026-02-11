import { FilterItemSubcategoriesList } from '@components/screens/home/category-filter/filter-item/filter-item-subcategories-list/filter-item-subcategories-list.component.ts'
import { Checkbox } from '@components/ui/checkbox/checkbox.component.ts'
import { Component } from '@core/component/component'
import {
	ProductsManagerEvent,
	ProductsManagerEvents,
	ProductsManagerService
} from '@core/services/products-manager.service.ts'
import { RenderService } from '@core/services/render.service'
import { Category, Subcategory } from '@/api/products-fetcher.service.ts'
import styles from './filter-item.module.scss'
import template from './filter-item.template.html?raw'

export class FilterItem implements Component {
	static #instancesByElement: WeakMap<HTMLElement, FilterItem> = new WeakMap()

	static from(element: HTMLElement): FilterItem {
		return this.#instancesByElement.get(element)
	}

	element: HTMLElement
	renderService: RenderService = RenderService.instance
	productsManagerService: ProductsManagerService = ProductsManagerService.instance

	category: Category | Subcategory
	parent?: FilterItem
	children: FilterItem[] = []
	checkbox: Checkbox
	subcategories?: Subcategory[]
	subcategoriesList?: FilterItemSubcategoriesList
	isParent: boolean = false

	constructor(category: Category | Subcategory, subcategories?: Subcategory[], parent?: FilterItem) {
		this.category = category
		if (subcategories) {
			this.subcategories = subcategories
			this.isParent = true
		}
		if (parent) this.parent = parent
	}

	mount(parent: HTMLElement, method: 'append' | 'prepend'): void {
		if (!this.element) this.element = this.render()

		FilterItem.#instancesByElement.set(this.element, this)

		parent[method](this.element)
	}

	syncUi(type: keyof ProductsManagerEvents) {
		const [scope, action] = type.split('-')
		const isExcluded = action === 'excluded'
		const handlers = {
			category: () => {
				this.checkbox.setStatus(!isExcluded)
				this.setChildrenStatuses(!isExcluded)
			},
			subcategory: () => {
				this.checkbox.setStatus(!isExcluded)
				this.updateStatusByChildren()
				this.updateIndeterminateState()
			}
		}
		handlers[scope]()
	}

	handleCheckboxLabelClick() {
		if (!this.isParent) return
		this.#toggleExpanded()
	}

	#toggleExpanded() {
		const subcategoriesListElement = this.subcategoriesList.element
		const isExpanded = subcategoriesListElement.ariaExpanded === 'true'
		subcategoriesListElement.ariaExpanded = String(!isExpanded)

		// Скролл если у раскрывающегося листа будет видно только 2 элемента
		const subcategoriesListCoords = subcategoriesListElement.getBoundingClientRect()
		if (
			!isExpanded &&
			!subcategoriesListElement.contains(
				document.elementFromPoint(
					subcategoriesListCoords.x,
					subcategoriesListCoords.y + (subcategoriesListElement.firstElementChild as HTMLElement).offsetHeight * 2
				)
			)
		)
			this.element.scrollIntoView({ behavior: 'smooth' })
	}

	setChildrenStatuses(status: boolean) {
		for (const childFilterItem of this.children) {
			childFilterItem.checkbox.setStatus(status)
		}
	}

	#checkChildrenStatuses(): { hasChecked: boolean; hasUnchecked: boolean } {
		if (!this.isParent) return

		const statuses = this.children.map(child => child.checkbox.status)
		const hasChecked = statuses.some(status => status)
		const hasUnchecked = statuses.some(status => !status)

		return { hasChecked, hasUnchecked }
	}

	updateStatusByChildren() {
		if (!this.isParent) {
			this.parent.updateStatusByChildren()
			return
		}

		const { hasChecked, hasUnchecked } = this.#checkChildrenStatuses()

		// При indeterminate === true, checkbox.component ставит status = false
		if (hasUnchecked && hasChecked) return

		this.checkbox.setStatus(hasChecked)
	}

	updateIndeterminateState() {
		if (!this.isParent) {
			this.parent.updateIndeterminateState()
			return
		}

		const { hasChecked, hasUnchecked } = this.#checkChildrenStatuses()

		this.checkbox.setIndeterminate(hasUnchecked && hasChecked)
	}

	render(): HTMLElement {
		this.element = this.renderService.htmlToElement(template, [], styles) as HTMLElement

		const excluded = this.productsManagerService.getExcludedRuntime()

		this.checkbox = new Checkbox(
			this.isParent
				? !excluded.categories.has(this.category.id)
				: !excluded.categories.has(this.parent.category.id) && !excluded.subcategories.has(this.category.id),
			this.category.name,
			!this.isParent
		)
		this.checkbox.mount(this.element, 'prepend')

		if (this.isParent) {
			this.subcategoriesList = new FilterItemSubcategoriesList()
			this.subcategoriesList.mount(this.element, 'append')
			const ul = this.subcategoriesList.element

			for (const subcategory of this.subcategories) {
				const subFilterItem = new FilterItem(subcategory, null, this)
				subFilterItem.mount(ul, 'append')
				this.children.push(subFilterItem)
			}
		}

		this.updateStatusByChildren()
		this.updateIndeterminateState()

		return this.element
	}
}
