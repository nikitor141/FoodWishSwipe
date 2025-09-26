import { ProductCard } from '@components/screens/home/products/product-card/product-card.component.ts'
import { Component } from '@core/component/component'
import { ProductsManagerService } from '@core/services/products-manager.service.ts'
import { RenderService } from '@core/services/render.service'
import { Product } from '@/api/products-fetcher.service.ts'
import styles from './products.module.scss'
import template from './products.template.html?raw'

export class Products implements Component {
	element: HTMLElement
	renderService: RenderService = RenderService.instance
	productsManagerService: ProductsManagerService = ProductsManagerService.instance

	constructor() {
		this.productsManagerService.subscribe(this)
	}

	fill() {
		for (const product of this.productsManagerService.getActive()) {
			this.refill('add', product)
		}
	}
	refill(type: 'delete' | 'add', product: Product) {
		const productsListEl: HTMLElement = this.element.querySelector('#products__list')

		if (type === 'add') {
			const productCard = new ProductCard(product)
			productCard.mount(productsListEl)
			this.productsManagerService.addProductCard(product, productCard)
		}
	}

	render(): HTMLElement {
		this.element = this.renderService.htmlToElement(template, [], styles) as HTMLElement

		this.fill()
		return this.element
	}
}
