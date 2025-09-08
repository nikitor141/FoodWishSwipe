import { Store } from '@core/store/store.ts'
import { Singleton } from '@utils/singleton'

export type AvailableThemes = 'dark' | 'light' | 'system'
type ApplicableThemes = 'dark' | 'light'

export class ThemesService extends Singleton {
	store: Store = Store.instance
	darkThemeMq = window.matchMedia('(prefers-color-scheme: dark)')
	dataset = document.documentElement.dataset
	#defaultThemes: AvailableThemes[] = ['dark', 'light', 'system']
	#currentIndex = 0

	protected constructor() {
		super()
	}

	init(): void {
		this.darkThemeMq.onchange = () => {
			if (this.#getSavedTheme() !== 'system') return
			this.#applyTheme(this.#getSystemTheme())
		}

		const saved: AvailableThemes = this.store.state.theme
		const theme: ApplicableThemes = saved === 'system' ? this.#getSystemTheme() : saved

		this.#currentIndex = this.#defaultThemes.indexOf(saved)
		this.#applyTheme(theme)
	}

	toggleTheme() {
		this.#currentIndex = (this.#currentIndex + 1) % this.#defaultThemes.length

		const next: AvailableThemes = this.#defaultThemes[this.#currentIndex]
		const theme: ApplicableThemes = next === 'system' ? this.#getSystemTheme() : next

		this.store.updateState('theme', next)
		this.#applyTheme(theme)
	}

	#applyTheme(theme: ApplicableThemes): void {
		setTimeout(() => delete document.documentElement.dataset.themeChanging)

		document.documentElement.dataset.themeChanging = 'true'
		this.dataset.theme = theme
	}

	#getSavedTheme(): AvailableThemes {
		return this.store.state.theme
	}

	#getSystemTheme(): ApplicableThemes {
		return this.darkThemeMq.matches ? 'dark' : 'light'
	}
}
