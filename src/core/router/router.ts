import { Layout } from '@/components/layout/layout.component'
import { MESSAGE_REDIRECTED } from '@/constants/messages.constants'
import { HOME_URL } from '@/constants/routes.constants'
import { ScreenSingleton } from '@/core/component/base-screen.types.ts'
import { ROUTES } from '@/core/router/routes.data.ts'
import { NotificationService } from '@/core/services/notification.service'
import { ObserverService } from '@/core/services/observer.service.ts'
import { Store } from '@/core/store/store.ts'
import { Singleton } from '@/utils/singleton'

export class Router extends Singleton {
	#observerService: ObserverService = ObserverService.instance
	#store: Store = Store.instance
	#notificationService: NotificationService = NotificationService.instance

	#routes: Record<string, ScreenSingleton> = ROUTES
	#currentRoute!: ScreenSingleton | undefined
	#layout: Layout = Layout.instance

	protected constructor() {
		super()
	}

	init() {
		window.addEventListener('popstate', () => {
			this.#handleRouteChange()
		})

		this.#store.init()
		this.#handleRouteChange()
		this.#handleLinks()
	}

	getCurrentPath(): string {
		return location.pathname
	}

	#isExternalLink(path: string): boolean {
		if (!path) return false

		return (
			path.startsWith('mailto:') ||
			path.startsWith('tel:') ||
			new URL(path, location.origin).hostname !== location.hostname
		)
	}

	navigate(path: string) {
		if (path === this.getCurrentPath()) return

		history.pushState({}, '', path)
		this.#handleRouteChange()
	}

	#handleRouteChange() {
		const path: string = this.getCurrentPath()

		const previousRoute = this.#currentRoute
		this.#currentRoute = this.#routes[path]

		if (!this.#currentRoute) {
			this.#observerService.clearObservers(previousRoute) //очищаем страницу, с которой ушли на 404
			this.navigate(HOME_URL)
			this.#notificationService.show(MESSAGE_REDIRECTED, 'negative')
			return
		}

		this.#currentRoute.instance.path ??= path
		this.#store.updateState('screen', { previous: previousRoute, current: this.#currentRoute })
		// код ниже может использовать state, чтобы получить актуальную информацию, поэтому такой порядок
		this.#render()
	}

	#handleLinks() {
		document.addEventListener('click', (e: PointerEvent) => {
			const target = e.target as HTMLElement | null

			const link = target?.closest<HTMLAnchorElement>('a')
			if (!link || this.#isExternalLink(link.href)) return

			e.preventDefault()
			this.navigate(link.getAttribute('href') ?? HOME_URL)
		})
	}

	#render() {
		this.#layout.setScreen(this.#currentRoute)
	}
}
