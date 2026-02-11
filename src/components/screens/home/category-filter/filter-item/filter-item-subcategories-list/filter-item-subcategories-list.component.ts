import { Component } from '@core/component/component'
import { RenderService } from '@core/services/render.service'
import styles from './filter-item-subcategories-list.module.scss'
import template from './filter-item-subcategories-list.template.html?raw'

export class FilterItemSubcategoriesList implements Component {
	element: HTMLElement
	renderService: RenderService = RenderService.instance

	mount(parent: HTMLElement, method: 'append' | 'prepend') {
		if (!this.element) this.element = this.render()

		parent[method](this.element)
	}

	render(): HTMLElement {
		this.element = this.renderService.htmlToElement(template, [], styles) as HTMLElement

		return this.element
	}
}
