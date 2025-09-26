import { Component } from '@core/component/component.ts'
import { DragConfig, DragCustomEvent, DragService } from '@core/services/drag.service.ts'
import { ProductsManagerService } from '@core/services/products-manager.service.ts'
import { RenderService } from '@core/services/render.service.ts'
import { Product } from '@/api/products-fetcher.service.ts'
import styles from './product-card.module.scss'
import template from './product-card.template.html?raw'

export class ProductCard implements Component {
	element: HTMLElement
	renderService: RenderService = RenderService.instance
	dragService: DragService = DragService.instance
	productsManagerService: ProductsManagerService = ProductsManagerService.instance
	product: Product

	dragConfig: DragConfig = {
		componentInstance: this,
		direction: 'horizontal',
		threshold: 75,
		resistance: 5,
		snap: true
	}

	constructor(product: Product) {
		this.product = product
	}

	#produceDragMove = (e: DragCustomEvent<this>): void => {
		const dx = e.detail.elementDelta.center.x

		const t = Math.min(1, Math.abs(dx) / this.dragConfig.threshold)

		if (dx > 0) {
			// positive swipe
			this.element.style.setProperty('--card-gradient-negative-opacity', lerp(0.1, 0, t))
			this.element.style.setProperty('--card-gradient-positive-opacity', lerp(0.1, 0.4, t))
			this.element.style.setProperty('--card-gradient-positive-end', lerp(60, 100, t) + '%')
		} else {
			// negative swipe
			this.element.style.setProperty('--card-gradient-positive-opacity', lerp(0.1, 0, t))
			this.element.style.setProperty('--card-gradient-negative-opacity', lerp(0.1, 0.4, t))
			this.element.style.setProperty('--card-gradient-negative-end', lerp(80, 100, t) + '%')
		}

		this.element.style.rotate = dx * 0.05 + 'deg'
		this.element.style.opacity = lerp(1, 0.8, t)

		function lerp(start, end, t) {
			return start + (end - start) * t
		}
	}

	#produceDragend = (e: DragCustomEvent<this>): void => {
		this.element.style.rotate = null
		this.element.style.opacity = null
		this.element.style.removeProperty('--card-gradient-negative-opacity')
		this.element.style.removeProperty('--card-gradient-positive-opacity')
		this.element.style.removeProperty('--card-gradient-positive-end')
		this.element.style.removeProperty('--card-gradient-negative-end')

		if (e.detail.thresholdPassed.x) this.productsManagerService.swipe(e.detail.instance, e.detail.direction)
	}

	#addListeners(): void {
		this.dragService.attach(this.element, this.dragConfig)

		this.element.addEventListener('dragmove', this.#produceDragMove)
		this.element.addEventListener('dragend', this.#produceDragend)
	}

	mount(parent: HTMLElement): void {
		if (!this.element) this.element = this.render()

		parent.prepend(this.element)
		this.#addListeners()
	}

	destroy() {
		this.dragService.detach(this.element)
		this.element.remove()
	}

	render(): HTMLElement {
		this.element = this.renderService.htmlToElement(template, [], styles) as HTMLElement

		const subcategoryEl: HTMLSpanElement = this.element.querySelector(`.${styles['product-card__tag-subcategory']}`)
		const categoryEl: HTMLSpanElement = this.element.querySelector(`.${styles['product-card__tag-category']}`)
		const nameLinkEl: HTMLAnchorElement = this.element.querySelector(`.${styles['product-card__name']} a`)
		const linkEl: HTMLAnchorElement = this.element.querySelector(`.${styles['product-card__image']}`)
		const priceMainEl = this.element.querySelector(`.${styles['product-card__price']} span`)
		const pricePennyEl = this.element.querySelector(`.${styles['product-card__price']} sup`)
		const imgEl: HTMLImageElement = linkEl.querySelector('img')

		const price = this.product.price.toString().split('.')
		const priceMain = price[0]
		const pricePenny = price[1]

		subcategoryEl.textContent = this.product.subcategoryName
		categoryEl.textContent = this.product.categoryName
		nameLinkEl.textContent = this.product.name
		nameLinkEl.href = this.product.url
		linkEl.href = this.product.url
		priceMainEl.textContent = priceMain
		pricePennyEl.textContent = pricePenny
		imgEl.src = this.product.image

		return this.element
	}
}
