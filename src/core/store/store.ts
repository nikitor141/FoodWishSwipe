import { ObserverService } from '@core/services/observer.service.ts'
import { StorageService } from '@core/services/storage.service.ts'
import { StateItems } from '@core/store/store.types.ts'
import { debounce } from '@utils/debounce.ts'
import { INITIAL_STATE } from '@/config/state.config.ts'
import { Singleton } from '@/utils/singleton'

export type StoreEvent = {
	[K in keyof StateItems]: { type: K; data: StateItems[K] }
}[keyof StateItems]

export class Store extends Singleton {
	storageService: StorageService = StorageService.instance
	observerService: ObserverService = ObserverService.instance

	#state: StateItems = (this.storageService.getAll() as StateItems) ?? INITIAL_STATE

	#notify = this.observerService.makeObservable<StateItems>(this, () => this.state.screen)

	protected constructor() {
		super()
	}
	init(): void {
		this.#saveState()
	}

	#saveState() {
		const stateKeysToSkip = new Set(['screen', 'layoutReady', 'screenReady'])

		for (const [key, value] of Object.entries(this.state)) {
			if (stateKeysToSkip.has(key)) continue

			this.storageService.setItem(key, value)
		}
	}

	#saveStateDebounced = debounce(this.#saveState.bind(this), 1000)

	debouncedUpdateState = debounce(this.updateState.bind(this), 1000)

	updateState<K extends keyof StateItems>(key: K, value: StateItems[K]): void {
		if (this.state[key] === value) return

		this.#saveStateDebounced() // выполнится позже, планируем раньше.

		this.#stateProxy[key] = value
	}

	#stateProxy = new Proxy(this.#state, {
		set: <K extends keyof StateItems>(target: StateItems, property: K, newValue: StateItems[K]) => {
			const success = Reflect.set(target, property, newValue)
			if (success) {
				this.#notify(property, newValue)

				if (property === 'screen') this.observerService.clearObservers(this.state.screen.previous)
			}
			return success
		}
	})

	set state(value: any) {
		throw new Error('Cannot set state bypassing Store!')
	}
	get state(): Readonly<StateItems> {
		return this.#state
	}
}
