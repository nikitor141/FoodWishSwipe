import { ScreenSingleton } from '@core/component/base-screen.types'
import { Component } from '@core/component/component'
import { RenderService } from '@core/services/render.service'
import { ThemesService } from '@core/services/themes.service'
import { Store } from '@core/store/store.ts'
import { Singleton } from '@utils/singleton'
import { SELECTOR_APP, SELECTOR_CONTENT } from '@/constants/selectors.constants'
import { Header } from './header/header.component'
import styles from './layout.module.scss'
import template from './layout.template.html?raw'

export class Layout extends Singleton implements Component {
	element: HTMLElement
	renderService: RenderService = RenderService.instance
	themeService: ThemesService = ThemesService.instance

	store: Store = Store.instance

	protected constructor() {
		super()

		this.themeService.init()
	}

	setScreen<S extends ScreenSingleton>(screen: S): void {
		this.store.updateState('screenReady', false)
		if (!this.element) this.render()

		const screenInstance = screen.instance
		screenInstance.init()

		const screenElement = screenInstance.render()
		const content = this.element.querySelector(SELECTOR_CONTENT)

		content.innerHTML = ''
		content.append(screenElement)

		requestAnimationFrame(() => this.store.updateState('screenReady', true))
	}

	render(): HTMLElement {
		this.element = this.renderService.htmlToElement(template, [Header], styles) as HTMLElement

		const appElement: HTMLElement = document.querySelector(SELECTOR_APP)

		appElement.innerHTML = ''
		appElement.append(this.element)

		requestAnimationFrame(() => this.store.updateState('layoutReady', true))
		return this.element
	}
}
