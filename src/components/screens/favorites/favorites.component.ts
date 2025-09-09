import { RenderService } from '@core/services/render.service'

import { TITLE_FAVORITES } from '@/constants/titles.constants'
import { BaseScreen } from '@/core/component/base-screen.component'
import styles from './favorites.module.scss'
import template from './favorites.template.html?raw'

export class Favorites extends BaseScreen {
	element: HTMLElement
	renderService: RenderService = RenderService.instance
	path!: string

	protected constructor() {
		super()
	}
	init() {
		super.setTitle({ title: TITLE_FAVORITES })
	}

	render(): HTMLElement {
		this.element = this.renderService.htmlToElement(template, [], styles) as HTMLElement
		return this.element
	}
}
