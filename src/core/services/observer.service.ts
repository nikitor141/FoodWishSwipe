import { ScreenSingleton } from '@core/component/base-screen.types.ts'
import { StateItems } from '@core/store/store.types.ts'
import { Singleton } from '@utils/singleton.ts'

export interface ObservableEvent<T extends string = string, D = any> {
	type: T
	data: D
}

export interface Observer {
	update(event: ObservableEvent): void
}

type GetScreens = () => StateItems['screen']

interface ObserversStore {
	byScreen: Map<ScreenSingleton, Set<Observer>>
	independent: Set<Observer>
}

export class ObserverService extends Singleton {
	#registry: Map<any, ObserversStore> = new Map()

	protected constructor() {
		super()
	}

	makeObservable<Events extends Record<string, any>>(subject: any, getScreens: GetScreens) {
		this.#registry.set(subject, { byScreen: new Map(), independent: new Set() })

		return <T extends string & keyof Events>(type: T, data: Events[T]) => {
			this.#notify(subject, getScreens, { type, data })
		}
	}

	subscribe(observer: Observer, observables: any[], screen?: ScreenSingleton) {
		for (const observable of observables) {
			const observersStore = this.#registry.get(observable)

			if (!observersStore) throw new Error(`Subject ${observable.constructor.name} is not observable!`)

			if (!screen) {
				observersStore.independent.add(observer)
				continue
			}

			if (!observersStore.byScreen.has(screen)) {
				observersStore.byScreen.set(screen, new Set())
			}
			observersStore.byScreen.get(screen).add(observer)
		}
	}

	#notify(subject: any, getScreens: GetScreens, event: ObservableEvent) {
		const observersStore = this.#registry.get(subject)

		if (!observersStore) return

		observersStore.independent.forEach(observer => observer.update(event))

		const screens = getScreens()

		observersStore.byScreen.get(screens.previous)?.forEach(observer => observer.update(event))
		observersStore.byScreen.get(screens.current)?.forEach(observer => observer.update(event))
	}

	clearObservers(screen?: ScreenSingleton, fullClear: boolean = false) {
		if (!screen && !fullClear) return

		for (const observersStore of this.#registry.values()) {
			if (fullClear) {
				observersStore.independent.clear()
				observersStore.byScreen.clear()
				continue
			}

			observersStore.byScreen.delete(screen)
		}
	}
}
