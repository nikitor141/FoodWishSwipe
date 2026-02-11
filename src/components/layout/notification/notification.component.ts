import { Component } from '@core/component/component'
import { DragService } from '@core/services/drag.service.ts'
import { RenderService } from '@core/services/render.service'
import styles from './notification.module.scss'
import template from './notification.template.html?raw'

export type NotificationType = 'positive' | 'negative' | 'neutral'

export class Notification implements Component {
	element: HTMLElement
	renderService: RenderService = RenderService.instance
	dragService: DragService = DragService.instance
	message: string
	type: NotificationType

	timeout: ReturnType<typeof setTimeout>
	#isDestroying: boolean = false

	constructor(message: string, type: NotificationType) {
		this.message = message
		this.type = type
	}

	// todo? #addListenersRequiredReadyDOM
	#addListeners(): void {
		this.dragService.attach(this.element, {
			componentInstance: this,
			direction: 'vertical',
			threshold: 150,
			resistance: 1,
			snap: { animation: true, forwards: true }
		})
	}

	mount(parent: HTMLElement, method: 'append' | 'prepend'): void {
		if (!this.element) this.element = this.render()

		parent[method](this.element)

		requestAnimationFrame(() => {
			if (!this.element || this.#isDestroying) return
			this.#addListeners()
		})
	}

	destroy(): void {
		if (this.#isDestroying) return

		this.#isDestroying = true
		this.element.classList.add(styles['notification--vanishing'])

		this.element.onanimationend = () => {
			this.element.dispatchEvent(new CustomEvent('notifDestroyed', { bubbles: true, detail: { instance: this } }))

			this.dragService.detach(this.element)
			this.element.onanimationend = null
			this.element.remove()
			this.element = null
		}
	}

	render(): HTMLElement {
		this.element = this.renderService.htmlToElement(template, [], styles) as HTMLElement

		this.element.textContent = this.message

		const classNames = {
			positive: styles['notification--positive'],
			negative: styles['notification--negative'],
			neutral: styles['notification--neutral']
		}
		const className = classNames[this.type]

		this.element.classList.add(className)

		return this.element
	}
}
