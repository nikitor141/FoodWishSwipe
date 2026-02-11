import { RenderService } from '@core/services/render.service'
import { Singleton } from '@utils/singleton.ts'
import { getTitle } from '@/config/seo.config'
import { Component } from './component'

export abstract class BaseScreen extends Singleton implements Component {
	abstract element: HTMLElement
	abstract renderService: RenderService
	abstract path: string

	protected constructor() {
		super()
	}

	protected setTitle({ title }: { title: string }) {
		document.title = getTitle(title)
	}

	abstract render(): HTMLElement
	abstract init(): void

	destroy?(): void
	removeListeners?(): void
	addListeners?(): void
}
