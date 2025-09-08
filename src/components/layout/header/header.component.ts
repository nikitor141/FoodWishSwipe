import { ThemeSwitcher } from '@components/ui/theme-switcher/theme-switcher.component.ts'
import { Component } from '@core/component/component'

import { RenderService } from '@core/services/render.service'
import { Store } from '@core/store/store.ts'
import styles from './header.module.scss'
import template from './header.template.html?raw'

export class Header implements Component {
	element: HTMLElement
	renderService: RenderService = RenderService.instance
	store: Store = Store.instance

	constructor() {
		this.store.addObserver(this)
	}

	update({ key, value }): void {
		if (key !== 'screen') return

		const nav: HTMLElement = this.element.querySelector('nav')
		const indicator: HTMLElement = this.element.querySelector(`.${styles['header__nav-indicator']}`)
		const activeLinkBtn: HTMLElement = this.element.querySelector(
			`.${styles['header__nav-link']}[href="${value.current.instance.path}"]`
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
	}

	render(): HTMLElement {
		this.element = this.renderService.htmlToElement(template, [ThemeSwitcher], styles) as HTMLElement

		setTimeout(() => this.update({ key: 'screen', value: this.store.state.screen }), 0)

		return this.element
	}
}
