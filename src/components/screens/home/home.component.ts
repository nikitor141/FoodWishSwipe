import { ProductCard } from '@components/screens/home/product-card/product-card.component.ts'
import { RenderService } from '@core/services/render.service'
import { Store } from '@core/store/store.ts'

import { TITLE_HOME } from '@/constants/titles.constants'
import { BaseScreen } from '@/core/component/base-screen.component'
import styles from './home.module.scss'
import template from './home.template.html?raw'

export class Home extends BaseScreen {
	element: HTMLElement
	renderService: RenderService = RenderService.instance
	store: Store = Store.instance
	path!: string

	protected constructor() {
		super()
	}

	init() {
		super.setTitle({ title: TITLE_HOME })
		this.store.addObserver(this, this.constructor)
	}

	update(): void {
		this.element.querySelector('#test').textContent = this.store.state.theme
	}

	render(): HTMLElement {
		this.element = this.renderService.htmlToElement(template, [ProductCard], styles) as HTMLElement

		this.update()
		return this.element
	}
}
