import { Notification, NotificationType } from '@components/layout/notification/notification.component'
import { DragCustomEvent } from '@core/services/drag.service.ts'
import { Singleton } from '@utils/singleton'
import { SELECTOR_NOTIFICATIONS_LIST } from '@/constants/selectors.constants'

export class NotificationService extends Singleton {
	#queue: Notification[] = []
	#active: Set<Notification> = new Set()
	#limit: number = 3
	#container: HTMLElement

	protected constructor() {
		super()
	}

	show(message: string, type: NotificationType = 'neutral'): void {
		const notif = new Notification(message, type)
		if (this.#active.size >= this.#limit) {
			this.#queue.push(notif)
			return
		}

		this.#showNotif(notif)
	}

	#getContainer() {
		return (this.#container ??= document.querySelector(SELECTOR_NOTIFICATIONS_LIST))
	}

	#showNotif(notif: Notification) {
		this.#active.add(notif)
		notif.mount(this.#getContainer())
		this.#addListeners(notif)

		this.#setNotifTimeout(notif)
	}
	#setNotifTimeout(notif: Notification) {
		notif.timeout = setTimeout(() => this.#destroyNotif(notif), 3000)
	}

	#destroyNotif(notif: Notification) {
		clearTimeout(notif.timeout)
		notif.destroy()
	}

	#produceDestroyed = (e: DragCustomEvent<Notification>) => {
		this.#active.delete(e.detail.instance)
		this.#removeListeners(e.detail.instance)

		if (this.#queue.length > 0) {
			const notif = this.#queue.shift()

			this.#showNotif(notif)
		}
	}

	#produceDragstart = (e: DragCustomEvent<Notification>) => {
		clearTimeout(e.detail.instance.timeout)
		e.detail.instance.timeout = null
	}

	#produceDragend = (e: DragCustomEvent<Notification>) => {
		const notif = e.detail.instance

		if (e.detail.thresholdPassed.y || (!e.detail.isInView.topLeft && !e.detail.isInView.topRight)) {
			this.#destroyNotif(notif)
		} else {
			this.#setNotifTimeout(notif)
		}
	}

	#addListeners(notif: Notification) {
		notif.element.addEventListener('notifDestroyed', this.#produceDestroyed)
		notif.element.addEventListener('dragstart', this.#produceDragstart)
		notif.element.addEventListener('dragend', this.#produceDragend)
	}

	#removeListeners(notif: Notification) {
		notif.element.removeEventListener('notifDestroyed', this.#produceDestroyed)
		notif.element.removeEventListener('dragstart', this.#produceDragstart)
		notif.element.removeEventListener('dragend', this.#produceDragend)
	}
}
