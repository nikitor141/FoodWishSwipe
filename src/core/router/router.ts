import { NotificationService } from '@core/services/notification.service'
import { ObserverService } from '@core/services/observer.service.ts'
import { Store } from '@core/store/store.ts'
import { Layout } from '@/components/layout/layout.component'
import { MESSAGE_REDIRECTED } from '@/constants/messages.constants'
import { HOME_URL } from '@/constants/routes.constants'
import { Singleton } from '@/utils/singleton'
import { ScreenSingleton } from '../component/base-screen.types'
import { ROUTES } from './routes.data'

export class Router extends Singleton {
	#observerService: ObserverService = ObserverService.instance
	#store: Store = Store.instance
	#notificationService: NotificationService = NotificationService.instance

	#routes: Record<string, ScreenSingleton> = ROUTES
	#currentRoute!: ScreenSingleton | undefined
	#layout: Layout = Layout.instance

	protected constructor() {
		super()

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
		try {
			return new URL(path, location.origin).hostname !== location.hostname
		} catch (e) {
			return false
		}
	}

	navigate(path: string): void {
		if (path === this.getCurrentPath()) return

		history.pushState({}, '', path)
		this.#handleRouteChange()
	}

	#handleRouteChange(): void {
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

	#handleLinks(): void {
		document.addEventListener('click', (e: PointerEvent) => {
			const target = e.target as HTMLElement | null

			const link = target?.closest<HTMLAnchorElement>('a')
			if (!link || this.#isExternalLink(link.href)) return

			e.preventDefault()
			this.navigate(link.getAttribute('href') ?? HOME_URL)
		})
	}

	#render(): void {
		this.#layout.setScreen(this.#currentRoute)
	}
}
