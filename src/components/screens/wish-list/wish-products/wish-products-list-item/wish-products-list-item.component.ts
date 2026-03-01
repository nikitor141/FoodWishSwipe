import { Component } from '@core/component/component'
import { RenderService } from '@core/services/render.service'
import styles from './wish-products-list-item.module.scss'
import template from './wish-products-list-item.template.html?raw'

export class WishProductsListItemComponent implements Component {
	element: HTMLElement
	renderService: RenderService = RenderService.instance
	#isDestroying: boolean = false

	mount(parent: HTMLElement, method: 'append' | 'prepend') {
		if (!this.element) this.element = this.render()

		parent[method](this.element)
	}

	destroy() {
		if (this.#isDestroying) return
		this.#isDestroying = true

		this.element.remove()
		this.element = null
	}

	render(): HTMLElement {
		this.element = this.renderService.htmlToElement(template, [], styles) as HTMLElement

		return this.element
	}
}
