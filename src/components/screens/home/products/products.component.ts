import { ProductCard } from '@components/screens/home/products/product-card/product-card.component.ts'
import { Component } from '@core/component/component'
import { ProductsManagerService } from '@core/services/ProductsManager.service.ts'
import { RenderService } from '@core/services/render.service'
import styles from './products.module.scss'
import template from './products.template.html?raw'

export class Products implements Component {
	element: HTMLElement
	renderService: RenderService = RenderService.instance
	productsManagerService: ProductsManagerService = ProductsManagerService.instance

	constructor() {
		this.productsManagerService.subscribe(this)
	}

	update() {
		const productsListEl = this.element.querySelector('#products__list')

		for (const product of this.productsManagerService.getActive()) {
			productsListEl.append(new ProductCard(product).render())
		}
	}

	render(): HTMLElement {
		this.element = this.renderService.htmlToElement(template, [], styles) as HTMLElement

		this.update()
		return this.element
	}
}
