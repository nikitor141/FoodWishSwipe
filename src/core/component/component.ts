import { ScreenSingleton } from '@core/component/base-screen.types.ts'
import { RenderService } from '@core/services/render.service'

export type ComponentConstructor = new (...args: any) => Component

export interface Component {
	element: Element
	renderService: RenderService
	screen?: ScreenSingleton
	render(): Element | HTMLElement | SVGElement
	mount?(parent: HTMLElement, method: 'append' | 'prepend'): void
	destroy?(...args: any): void
}
//todo dynamicComponent
