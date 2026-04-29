import { Product } from '@/api/products-fetcher.service.ts'
import { ProductCard } from '@/components/screens/home/products/product-card/product-card.component.ts'
import { WishList } from '@/components/screens/wish-list/wish-list.component.ts'
import { WishProductsListItemComponent } from '@/components/screens/wish-list/wish-products/wish-products-list-item/wish-products-list-item.component.ts'
import { NoData } from '@/components/ui/no-data/no-data.component'
import { StaticComponent } from '@/core/component/component'
import { ObserverService } from '@/core/services/observer.service.ts'
import { ProductsManagerEvent, ProductsManagerService } from '@/core/services/products-manager.service.ts'
import { RenderService } from '@/core/services/render.service'

import styles from './wish-products.module.scss'
import template from './wish-products.template.html?raw'

type Mode = 'view' | 'edit'
export class WishProducts implements StaticComponent {
	static componentName = 'component-wish-products'

	element!: HTMLElement
	productsListEl!: HTMLElement
	clearBtn!: HTMLElement
	renderService: RenderService = RenderService.instance
	#productsManagerService: ProductsManagerService = ProductsManagerService.instance
	#observerService: ObserverService = ObserverService.instance

	#items = new Map<Product, { productCard: ProductCard; li: WishProductsListItemComponent }>()
	#productsByLiElements = new WeakMap<HTMLLIElement, Product>()
	#selectedLiElements = new Set<HTMLLIElement>()

	#mode: Mode = 'view'
	#placeholder: NoData | null = null

	constructor() {
		this.#observerService.subscribe(this, [this.#productsManagerService], WishList)
		// при загрузке приложения на этом экране ждем событие от productsManager для заполнения
	}

	update({ type, data }: ProductsManagerEvent) {
		switch (type) {
			case 'products-manager-ready': {
				this.#fill()
				break
			}
			case 'wish-list-removed': {
				const { productCard, li } = this.#items.get(data.product)!
				this.#selectedLiElements.delete(li.element!)
				this.#items.delete(data.product)

				productCard.destroy()
				li.destroy()

				if (!this.#items.size) this.#handleNoData()
				break
			}
			case 'wish-list-cleared': {
				for (const { productCard, li } of this.#items.values()) {
					productCard.destroy()
					li.destroy()
				}

				this.#items.clear()
				this.#selectedLiElements.clear()
				this.#handleNoData()
				break
			}
		}
	}

	#setMode(mode: Mode) {
		this.#mode = mode
		this.productsListEl.dataset['wishProductsListMode'] = mode
		this.#updateClearBtnIcon()

		switch (mode) {
			case 'view': {
				this.element.removeEventListener('pointerdown', this.#handleLiClick)
				this.#selectedLiElements.clear()
				break
			}
			case 'edit': {
				this.element.addEventListener('pointerdown', this.#handleLiClick)
				break
			}
		}
	}

	#setHoldEvent() {
		let timeoutId: ReturnType<typeof setTimeout>
		this.element.onpointerdown = () => {
			timeoutId = setTimeout(() => this.element.dispatchEvent(new CustomEvent('pointerhold')), 500)
		}

		this.element.onpointerup =
			this.element.onpointercancel =
			this.element.onpointerleave =
				() => clearTimeout(timeoutId)

		document.oncontextmenu ??= e => {
			if (e.defaultPrevented) return
		}

		this.element.oncontextmenu = e => {
			e.preventDefault()
		}
	}

	#addListeners() {
		this.clearBtn.addEventListener('pointerdown', this.#handleClearBtnClick)

		this.#setHoldEvent()

		this.element.addEventListener('pointerhold', () => this.#setMode('edit'))
	}

	#handleClearBtnClick = () => {
		switch (this.#mode) {
			case 'view': {
				this.#productsManagerService.wishList.clear()
				break
			}
			case 'edit': {
				this.#selectedLiElements.forEach(li => {
					const product = this.#productsByLiElements.get(li)!
					const { productCard } = this.#items.get(product)!
					this.#productsManagerService.wishList.remove(productCard.product)
				})
				break
			}
		}
		this.#setMode('view')
	}

	#handleLiClick = (e: PointerEvent) => {
		const target = e.target as HTMLElement
		const liEl = target?.closest<HTMLLIElement>('[data-component="wish-products-list-item"]')
		if (!liEl) {
			this.element
				.querySelectorAll<HTMLLIElement>('[data-selected="true"]')
				.forEach(liEl => (liEl.dataset['selected'] = 'false'))

			this.#setMode('view')
			return
		}

		const isSelected = this.#selectedLiElements.has(liEl)
		isSelected ? this.#selectedLiElements.delete(liEl) : this.#selectedLiElements.add(liEl)
		liEl.dataset['selected'] = String(!isSelected)

		this.#updateClearBtnIcon()
	}

	#updateClearBtnIcon() {
		const useEl = this.element.querySelector('use')!
		switch (this.#mode) {
			case 'view': {
				useEl.setAttribute('href', '#remove')
				break
			}
			case 'edit': {
				this.#selectedLiElements.size === 0
					? useEl.setAttribute('href', '#cancel')
					: useEl.setAttribute('href', '#remove')
				break
			}
		}
	}

	#handleNoData() {
		if (this.#placeholder) return

		this.#placeholder = new NoData()
		this.#placeholder.mount(this.productsListEl, 'append')
	}

	#fill() {
		const wishProducts = this.#productsManagerService.wishList.getRuntime()
		let reversedIndex = wishProducts.size
		requestAnimationFrame(() => requestAnimationFrame(() => (this.element.dataset['ready'] = 'true')))

		if (!reversedIndex) {
			this.#handleNoData()
			return
		}

		if (this.#placeholder) {
			this.#placeholder.destroy()
			this.#placeholder = null
		}

		for (const product of wishProducts) {
			const productCard = new ProductCard(product, { inactiveLink: false, draggable: false })
			const li = new WishProductsListItemComponent()

			li.mount(this.productsListEl, 'prepend')
			li.element!.style.setProperty('--index', String(reversedIndex--))
			productCard.mount(li.element!, 'append')

			this.#items.set(product, { productCard, li })
			this.#productsByLiElements.set(li.element!, product)
		}
	}

	render() {
		this.element = this.renderService.htmlToElement(template, [], styles)
		this.productsListEl = this.element.querySelector<HTMLUListElement>(`.${styles['wish-products__list']}`)!
		this.clearBtn = this.element.querySelector<HTMLButtonElement>(`.${styles['wish-products__clear-button']}`)!

		if (this.#productsManagerService.isReady()) this.#fill()

		this.#addListeners()
		return this.element
	}
}
