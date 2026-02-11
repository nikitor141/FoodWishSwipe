import { Home } from '@components/screens/home/home.component.ts'
import { ProductCard } from '@components/screens/home/products/product-card/product-card.component.ts'
import { Component } from '@core/component/component'
import { DragCustomEvent } from '@core/services/drag.service.ts'
import { ObserverService } from '@core/services/observer.service.ts'
import { ProductsManagerEvent, ProductsManagerService } from '@core/services/products-manager.service.ts'
import { RenderService } from '@core/services/render.service'
import { Product } from '@/api/products-fetcher.service.ts'
import styles from './products.module.scss'
import template from './products.template.html?raw'

export class Products implements Component {
	element: HTMLElement
	renderService: RenderService = RenderService.instance
	productsManagerService: ProductsManagerService = ProductsManagerService.instance
	observerService: ObserverService = ObserverService.instance

	#productCardsByProduct: WeakMap<Product, ProductCard> = new WeakMap()

	constructor() {
		this.observerService.subscribe(this, [this.productsManagerService], Home)
	}

	#fill() {
		for (const product of this.productsManagerService.getActive()) {
			this.update({ type: 'products-active-add', data: { product } })
		}
	}

	update({ type, data }: ProductsManagerEvent) {
		const productsListEl: HTMLElement = this.element.querySelector('#products__list')
		switch (type) {
			case 'products-active-add':
				const productCard = new ProductCard(data.product)
				productCard.mount(productsListEl, 'prepend')

				this.#productCardsByProduct.set(data.product, productCard)
				break

			case 'products-active-delete':
				this.#productCardsByProduct.get(data.product).destroy(data.direction)
				break
		}
	}

	render(): HTMLElement {
		this.element = this.renderService.htmlToElement(template, [], styles) as HTMLElement

		// Если данные уже загружали, то при повторном рендере компонента заполняем его
		if (this.productsManagerService.isReady()) this.#fill()
		return this.element
	}
}
