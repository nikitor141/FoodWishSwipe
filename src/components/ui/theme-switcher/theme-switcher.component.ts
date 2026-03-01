import { Component } from '@core/component/component'
import { ObserverService } from '@core/services/observer.service.ts'
import { RenderService } from '@core/services/render.service'
import { ThemesService } from '@core/services/themes.service.ts'
import { Store, StoreEvent } from '@core/store/store.ts'
import styles from './theme-switcher.module.scss'
import template from './theme-switcher.template.html?raw'

export class ThemeSwitcher implements Component {
	element: HTMLElement
	renderService: RenderService = RenderService.instance
	observerService: ObserverService = ObserverService.instance
	themeService: ThemesService = ThemesService.instance
	store: Store = Store.instance

	constructor() {
		this.observerService.subscribe(this, [this.store])
	}

	update({ type, data }: StoreEvent): void {
		const isLayoutReady = this.store.state.layoutReady

		switch (type) {
			case 'layoutReady':
				if (isLayoutReady) this.#onLayoutReady()
				break

			case 'theme':
				if (isLayoutReady) this.#onUpdate()
				break
		}
	}

	#onLayoutReady() {
		this.#onUpdate()
	}

	#onUpdate() {
		this.element.querySelector('use').setAttribute('href', '#' + this.store.state.theme)
	}

	render(): HTMLElement {
		this.element = this.renderService.htmlToElement(template, [], styles) as HTMLElement

		this.element.onclick = () => this.themeService.toggleTheme()

		return this.element
	}
}
