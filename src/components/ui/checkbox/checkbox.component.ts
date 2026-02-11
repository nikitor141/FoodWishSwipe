import { Component } from '@core/component/component'
import { RenderService } from '@core/services/render.service'
import styles from './checkbox.module.scss'
import template from './checkbox.template.html?raw'

export type CheckboxChangeEvent = CustomEvent<{ checked: boolean; changeIsTrusted: boolean }>

export class Checkbox implements Component {
	static #instancesByElement: WeakMap<HTMLElement, Checkbox> = new WeakMap()

	static from(element: HTMLElement): Checkbox {
		return this.#instancesByElement.get(element)
	}

	static isEventsDelegated: boolean = false

	element: HTMLElement
	renderService: RenderService = RenderService.instance
	text: string
	interactiveLabel: boolean
	status: boolean
	indeterminate: boolean

	#input: HTMLInputElement
	#label: HTMLSpanElement

	constructor(status: boolean, text: string, interactiveLabel = true) {
		this.status = status
		this.text = text
		this.interactiveLabel = interactiveLabel
	}

	#addListeners(): void {
		document.addEventListener('change', e => {
			const target = e.target as HTMLInputElement | null
			if (!target?.closest('input')) return

			const checkboxEl = target?.closest('[data-ui="checkbox"]') as HTMLLabelElement
			const checkbox = Checkbox.from(checkboxEl)
			if (!checkbox) return

			checkbox.setStatus(checkbox.#input.checked)

			checkbox.element.dispatchEvent(
				new CustomEvent('checkbox:change', {
					detail: { checked: checkbox.status, changeIsTrusted: e.isTrusted },
					bubbles: true
				})
			)
		})

		document.addEventListener('click', e => {
			const target = e.target as HTMLSpanElement | null
			if (!target?.closest('span')) return

			const checkboxEl = target?.closest('[data-ui="checkbox"]') as HTMLLabelElement
			const checkbox = Checkbox.from(checkboxEl)
			if (!checkbox || checkbox.interactiveLabel) return

			e.preventDefault()
			checkbox.element.dispatchEvent(
				new CustomEvent('checkbox:label-click', {
					bubbles: true
				})
			)
		})
		Checkbox.isEventsDelegated = true
	}

	mount(parent: HTMLElement, method: 'append' | 'prepend'): void {
		if (!this.element) this.element = this.render()

		Checkbox.#instancesByElement.set(this.element, this)

		parent[method](this.element)
	}

	toggleStatus(): void {
		this.setStatus(!this.status)
	}

	setStatus(status: boolean): void {
		if (status === this.status) return

		this.status = status
		this.#input.checked = status
		this.#input.dispatchEvent(new Event('change', { bubbles: true }))
	}

	setIndeterminate(indeterminate: boolean): void {
		if (indeterminate === this.indeterminate) return

		this.indeterminate = indeterminate
		this.#input.indeterminate = indeterminate

		if (indeterminate) this.setStatus(true)
	}

	render(): HTMLElement {
		this.element = this.renderService.htmlToElement(template, [], styles) as HTMLElement

		this.#label = this.element.querySelector<HTMLSpanElement>(`.${styles['checkbox__text']}`)
		this.#input = this.element.querySelector<HTMLInputElement>(`.${styles['checkbox__input']}`)

		this.#label.textContent = this.text

		if (!Checkbox.isEventsDelegated) this.#addListeners()

		this.#input.checked = this.status

		return this.element
	}
}
