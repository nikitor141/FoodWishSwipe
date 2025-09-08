import { ScreenSingleton } from '@core/component/base-screen.types.ts'
import { RenderService } from '@core/services/render.service'
import { StateItems } from '@core/store/store.types.ts'

export type ComponentConstructor = new (...args: any) => Component

export interface Component {
	element: Element
	renderService: RenderService
	screen?: ScreenSingleton
	render(): Element | HTMLElement | SVGElement
	destroy?(): void
	update?<K extends keyof StateItems>(payload: { key: K; value: StateItems[K] }): void
}
