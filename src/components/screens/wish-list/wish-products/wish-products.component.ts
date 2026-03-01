import { ProductCard } from '@components/screens/home/products/product-card/product-card.component.ts'
import { WishList } from '@components/screens/wish-list/wish-list.component.ts'
import { WishProductsListItemComponent } from '@components/screens/wish-list/wish-products/wish-products-list-item/wish-products-list-item.component.ts'
import { Component } from '@core/component/component'
import { ObserverService } from '@core/services/observer.service.ts'
import { ProductsManagerEvent, ProductsManagerService } from '@core/services/products-manager.service.ts'
import { RenderService } from '@core/services/render.service'
import { Product } from '@/api/products-fetcher.service.ts'
import styles from './wish-products.module.scss'
import template from './wish-products.template.html?raw'

export class WishProducts implements Component {
	element: HTMLElement
	productsListEl!: HTMLElement
	clearBtn!: HTMLElement
	renderService: RenderService = RenderService.instance
	productsManagerService: ProductsManagerService = ProductsManagerService.instance
	observerService: ObserverService = ObserverService.instance

	#productCardsByProduct: Map<Product, ProductCard> = new Map()

	#ProductCardsByLIElements: WeakMap<HTMLLIElement, ProductCard> = new WeakMap()
	#LiByProductCard: WeakMap<ProductCard, WishProductsListItemComponent> = new WeakMap()
	#selectedListItems: Set<HTMLLIElement> = new Set()

	constructor() {
		this.observerService.subscribe(this, [this.productsManagerService], WishList)
		// при загрузке приложения на этом экране ждем событие от productsManager для заполнения
	}

	update({ type, data }: ProductsManagerEvent) {
		switch (type) {
			case 'products-manager-ready':
				this.#fill()
				break
			case 'wish-list-removed':
				const productCard = this.#productCardsByProduct.get(data.product)
				this.#productCardsByProduct.delete(data.product)
				productCard.destroy()
				const li = this.#LiByProductCard.get(productCard)
				this.#selectedListItems.delete(li.element as HTMLLIElement)
				li.destroy()
				break
			case 'wish-list-cleared':
				for (const productCard of this.#productCardsByProduct.values()) {
					productCard.destroy()
					this.#LiByProductCard.get(productCard).destroy()
				}
				this.#productCardsByProduct.clear()
				this.#selectedListItems.clear()
				break
		}
	}

	#addListeners() {
		this.clearBtn.addEventListener('click', this.#handleClearBtnClick)

		this.element.oncontextmenu = e => {
			e.preventDefault()
		}
		document.oncontextmenu ??= e => {
			if (e.defaultPrevented) return
		}

		let timeoutId: ReturnType<typeof setTimeout>
		this.element.onpointerdown = () => {
			timeoutId = setTimeout(() => this.#handleAfterHold(), 500)
		}
		this.element.onpointerup =
			this.element.onpointercancel =
			this.element.onpointerleave =
				() => clearTimeout(timeoutId)
	}

	#handleClearBtnClick = () => {
		switch (this.productsListEl.dataset.wishProductsListMode) {
			case 'view':
				this.productsManagerService.wishList.clear()
				break
			case 'edit':
				this.#selectedListItems.forEach(li => {
					const productCard = this.#ProductCardsByLIElements.get(li)
					this.productsManagerService.wishList.remove(productCard.product)
				})
				break
		}
		this.productsListEl.dataset.wishProductsListMode = 'view'
		this.element.removeEventListener('click', this.#handleLiClick)
		this.#updateClearBtnIcon()
	}

	#handleAfterHold() {
		this.productsListEl.dataset.wishProductsListMode = 'edit'
		this.#updateClearBtnIcon()

		this.element.addEventListener('click', this.#handleLiClick)
	}

	#handleLiClick = (e: PointerEvent) => {
		const target = e.target as HTMLElement
		const liEl = target?.closest('[data-component="wish-products-list-item"]') as HTMLLIElement
		if (!liEl) return

		this.#selectedListItems.has(liEl) ? this.#selectedListItems.delete(liEl) : this.#selectedListItems.add(liEl)
		this.#updateClearBtnIcon()
		console.log(this.#selectedListItems)
	}
	#updateClearBtnIcon() {
		const mode = this.productsListEl.dataset.wishProductsListMode
		const useEl = this.element.querySelector('use')
		switch (mode) {
			case 'view':
				useEl.setAttribute('href', '#remove')
				break
			case 'edit':
				this.#selectedListItems.size === 0
					? useEl.setAttribute('href', '#cancel')
					: useEl.setAttribute('href', '#remove')
				break
		}
	}

	#fill() {
		for (const product of this.productsManagerService.wishList.getRuntime()) {
			const productCard = new ProductCard(product, { inactiveLink: false, draggable: false })
			const li = new WishProductsListItemComponent()
			li.mount(this.productsListEl, 'prepend')
			productCard.mount(li.element, 'append')
			this.#productCardsByProduct.set(product, productCard)
			this.#ProductCardsByLIElements.set(li.element as HTMLLIElement, productCard)
			this.#LiByProductCard.set(productCard, li)
		}
	}

	render() {
		this.element = this.renderService.htmlToElement(template, [], styles) as HTMLElement
		this.productsListEl = this.element.querySelector(`.${styles['wish-products__list']}`)
		this.clearBtn = this.element.querySelector(`.${styles['wish-products__clear-button']}`)
		if (this.productsManagerService.isReady()) this.#fill()

		this.#addListeners()

		return this.element
	}
}
