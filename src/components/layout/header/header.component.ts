import { ThemeSwitcher } from '@components/ui/theme-switcher/theme-switcher.component.ts'
import { Component } from '@core/component/component'
import { ObserverService } from '@core/services/observer.service.ts'
import { RenderService } from '@core/services/render.service'
import { Store, StoreEvent } from '@core/store/store.ts'
import styles from './header.module.scss'
import template from './header.template.html?raw'

export class Header implements Component {
	element: HTMLElement
	renderService: RenderService = RenderService.instance
	observerService: ObserverService = ObserverService.instance
	store: Store = Store.instance

	constructor() {
		this.observerService.subscribe(this, [this.store])
	}

	update({ type, data }: StoreEvent): void {
		// screen приходит раньше layoutReady, и до рендера, поэтому при загрузке страницы screen не передастся сюда, ибо header еще не успел стать
		// обсервером в store
		const isLayoutReady = this.store.state.layoutReady

		switch (type) {
			case 'layoutReady':
				if (isLayoutReady) this.#onLayoutReady()
				break
			case 'screen':
				if (isLayoutReady) this.#onUpdate()
				break
		}
	}

	#onLayoutReady() {
		this.#onUpdate()
	}

	#onUpdate() {
		const nav: HTMLElement = this.element.querySelector('nav')
		const indicator: HTMLElement = this.element.querySelector(`.${styles['header__nav-indicator']}`)
		const activeLinkBtn: HTMLElement = this.element.querySelector(
			`.${styles['header__nav-link']}[href="${this.store.state.screen.current.instance.path}"]`
		)
		const allActiveLinkBtns: NodeList = this.element.querySelectorAll(`.${styles['header__nav-link--active']}`)

		const navCoords = nav.getBoundingClientRect()
		const indicatorCoords = indicator.getBoundingClientRect()
		const btnCoords = activeLinkBtn.getBoundingClientRect()

		const newLeft = btnCoords.left - navCoords.left
		const newRight = navCoords.right - btnCoords.right

		const currentLeft = indicatorCoords.left - navCoords.left

		const { first, second } = getCoords(newLeft, newRight, currentLeft)

		indicator.classList.remove(
			styles['header__nav-indicator--going-left'],
			styles['header__nav-indicator--going-right']
		)
		indicator.classList.add(styles[`header__nav-indicator--going-${first[0]}`])

		indicator.style[first[0]] = first[1] + 'px'
		indicator.style[second[0]] = second[1] + 'px'

		allActiveLinkBtns.forEach((el: HTMLElement) => el.classList.remove(styles['header__nav-link--active']))
		activeLinkBtn.classList.add(styles['header__nav-link--active'])

		function getCoords(newLeft: number, newRight: number, currentLeft: number) {
			const goingRight = newLeft > currentLeft

			return goingRight
				? { first: ['right', newRight], second: ['left', newLeft] }
				: { first: ['left', newLeft], second: ['right', newRight] }
		}

		// и scss - чинит анимацию при загрузке страницы в chromium, safari
		if (!nav.dataset.init) requestAnimationFrame(() => (nav.dataset.init = 'true'))
	}

	render(): HTMLElement {
		this.element = this.renderService.htmlToElement(template, [ThemeSwitcher], styles) as HTMLElement

		return this.element
	}
}
