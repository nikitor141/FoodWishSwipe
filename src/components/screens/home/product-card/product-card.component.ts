import { RenderService } from '@core/services/render.service'
import { Store } from '@core/store/store.ts'
import { ProductsService } from '@/api/products.service'
import { Component } from '@/core/component/component'
import styles from './product-card.module.scss'
import template from './product-card.template.html?raw'

export class ProductCard implements Component {
	element: HTMLElement
	renderService: RenderService = RenderService.instance
	productsService: ProductsService = ProductsService.instance
	store: Store = Store.instance
	screen = this.store.state.screen.current

	constructor() {
		this.store.addObserver(this, this.screen)
	}

	update(): void {
		this.element.querySelector(`.${styles['product-card__price']}`).textContent = this.store.state.theme
	}

	render(): HTMLElement {
		this.element = this.renderService.htmlToElement(template, [], styles) as HTMLElement

		this.update()
		return this.element
	}
}
