import { Singleton } from '@/utils/singleton.ts'

import { Component } from '../component/component'
import { Axis, Direction, DragConfig, DragEndEvent, DragMoveEvent, Side } from './drag.types'
import { NotificationService } from './notification.service'

type AxisInfo = {
	readonly cssProperty: 'left' | 'top'
	readonly oppositeCssProperty: 'right' | 'bottom'
	readonly directionPositive: 'right' | 'top'
	readonly directionNegative: 'left' | 'bottom'
	readonly offsetSize: 'offsetWidth' | 'offsetHeight'
	readonly size: 'width' | 'height'
}

type DirectionToAxis<D extends Direction> = D extends 'horizontal' ? 'x' : D extends 'vertical' ? 'y' : 'x' | 'y'

interface NormalizedConfig<T extends Component = Component, D extends Direction = Direction> extends DragConfig<T, D> {
	bounds?: {
		rect: DOMRect
		sides: Set<Side>
	}
}

type SessionInfo<TAxis extends Axis> = Record<TAxis, AxisInfo>

interface InitialGeometry {
	width: number
	height: number
	left: number
	top: number
	center: Record<Axis, number>
	start: Record<Axis, number>
	shift: Record<Axis, number>
}

export class DragService extends Singleton {
	#dragSessionsFactory: DragSessionsFactory = DragSessionsFactory.instance
	#draggingElements = new Set<HTMLElement>()
	#pointerDownByAttachedElements = new WeakMap<HTMLElement, (e: PointerEvent) => void>()

	protected constructor() {
		super()
	}

	attach<T extends Component, D extends Direction>(element: HTMLElement, config: DragConfig<T, D>) {
		const handler = (e: PointerEvent) => {
			let canDrag = !this.#draggingElements.has(element)

			if (config.handles) {
				const target = e.target as Node
				canDrag = canDrag && config.handles.some(h => (h !== element ? h.contains(target) : target === element))
			}
			if (!canDrag) return

			this.#dragSessionsFactory.newSession(element, config, e, this.#draggingElements)
		}

		element.addEventListener('pointerdown', handler, { passive: true })
		this.#pointerDownByAttachedElements.set(element, handler)
	}

	detach(element: HTMLElement) {
		const handler = this.#pointerDownByAttachedElements.get(element)
		if (!handler) return

		element.removeEventListener('pointerdown', handler)
		this.#pointerDownByAttachedElements.delete(element)
	}
}

abstract class DragSessionsFactory extends Singleton {
	protected constructor() {
		super()
	}

	readonly horizontal: SessionInfo<'x'> = {
		x: {
			cssProperty: 'left',
			oppositeCssProperty: 'right',
			directionPositive: 'right',
			directionNegative: 'left',
			offsetSize: 'offsetWidth',
			size: 'width'
		}
	}
	readonly vertical: SessionInfo<'y'> = {
		y: {
			cssProperty: 'top',
			oppositeCssProperty: 'bottom',
			directionPositive: 'top',
			directionNegative: 'bottom',
			offsetSize: 'offsetHeight',
			size: 'height'
		}
	}
	readonly both: SessionInfo<'x' | 'y'> = {
		...this.horizontal,
		...this.vertical
	}

	#normalizeConfig<T extends Component, D extends Direction = Direction>(config: DragConfig<T, D>) {
		if (Array.isArray(config.bounds?.sides)) {
			config.bounds.sides = new Set(config.bounds.sides)
		}
		return config as NormalizedConfig<T, D>
	}

	newSession<T extends Component, D extends Direction>(
		element: HTMLElement,
		config: DragConfig<T, D>,
		e: PointerEvent,
		draggingElements: Set<HTMLElement>
	) {
		const info = this[config.direction] as SessionInfo<DirectionToAxis<D>>
		new DragSession(element, this.#normalizeConfig<T, D>(config), info, e, draggingElements).startDrag()
	}
}

class DragSession<T extends Component, D extends Direction, TAxis extends Axis = DirectionToAxis<D>> {
	#notificationService: NotificationService = NotificationService.instance
	element: HTMLElement
	config: NormalizedConfig<T, D>
	info: SessionInfo<TAxis>
	infoMetaList: SessionInfo<TAxis>[TAxis][]
	infoAxisList: TAxis[]
	eDown: PointerEvent
	draggingElements: Set<HTMLElement>
	initialGeometry: InitialGeometry

	eCurrent!: PointerEvent
	eMove!: PointerEvent
	eUp!: PointerEvent

	constructor(
		element: HTMLElement,
		config: NormalizedConfig<T, D>,
		info: SessionInfo<TAxis>,
		eDown: PointerEvent,
		draggingElements: Set<HTMLElement>
	) {
		this.element = element
		this.config = config
		this.info = info
		this.infoMetaList = Object.values(info)
		this.infoAxisList = Object.keys(info) as TAxis[]
		this.eDown = eDown
		this.draggingElements = draggingElements

		const rect = element.getBoundingClientRect()
		this.initialGeometry = {
			width: rect.width,
			height: rect.height,
			left: rect.left,
			top: rect.top,
			center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
			start: {
				x: eDown.clientX,
				y: eDown.clientY
			},
			shift: {
				x: eDown.clientX - rect.left,
				y: eDown.clientY - rect.top
			}
		}
	}

	startDrag() {
		this.styles('init')

		this.element.dataset['dragging'] = 'true'
		this.element.ondragstart = () => false

		this.element.dispatchEvent(
			new CustomEvent('dragstart', {
				bubbles: true,
				detail: { instance: this.config.componentInstance }
			})
		)

		const moving = (e: PointerEvent) => {
			this.eCurrent = this.eMove = e
			this.move()

			this.element.dispatchEvent(
				new CustomEvent('dragmove', {
					bubbles: true,
					detail: {
						instance: this.config.componentInstance,
						elementDelta: this.getElementDelta()
					}
				}) as DragMoveEvent<typeof this.config.componentInstance, TAxis>
			)
		}

		const release = (e: PointerEvent) => {
			this.eCurrent = this.eUp = e

			this.element.ondragstart = null
			this.element.removeAttribute('data-dragging')
			this.element.removeEventListener('pointermove', moving)
			this.element.removeEventListener('pointerup', release)
			this.element.removeEventListener('pointercancel', release)
			this.element.removeEventListener('pointerleave', release)
			this.element.releasePointerCapture(this.eDown.pointerId)

			this.snap()
			this.element.dispatchEvent(
				new CustomEvent('dragend', {
					bubbles: true,
					detail: {
						instance: this.config.componentInstance,
						isInView: this.isInView(),
						direction: this.getDirection(),
						thresholdPassed: this.checkThreshold()
					}
				}) as DragEndEvent<typeof this.config.componentInstance>
			)
		}

		this.element.addEventListener('pointermove', moving, { passive: true })
		this.element.addEventListener('pointerup', release, { passive: true })
		this.element.addEventListener('pointercancel', release, { passive: true })
		this.element.addEventListener('pointerleave', release, { passive: true })
		this.element.setPointerCapture(this.eDown.pointerId)
	}

	styles(action: 'init' | 'clear') {
		switch (action) {
			case 'init': {
				this.element.style.position = 'fixed'
				this.element.style.width = this.initialGeometry.width + 'px'
				this.element.style.height = this.initialGeometry.height + 'px'
				this.element.style.top = this.initialGeometry.top + 'px'
				this.element.style.left = this.initialGeometry.left + 'px'
				this.draggingElements.add(this.element)
				break
			}
			case 'clear': {
				this.element.style.removeProperty('width')
				this.element.style.removeProperty('height')
				this.element.style.removeProperty('top')
				this.element.style.removeProperty('left')
				this.element.style.removeProperty('position')
				this.makeDraggable()
				break
			}
		}
	}

	makeDraggable() {
		this.draggingElements.delete(this.element)
	}

	move() {
		const delta = this.getDelta()
		const countedPosition = {} as Record<SessionInfo<TAxis>[TAxis]['cssProperty'], number>

		for (const axis of this.infoAxisList) {
			const meta = this.info[axis]
			const appliedDelta = this.#applyResistance(delta[axis], this.config.threshold, this.config.resistance)

			countedPosition[meta.cssProperty as keyof typeof countedPosition] =
				this.initialGeometry.start[axis] - this.initialGeometry.shift[axis] + appliedDelta
		}

		if (this.config.bounds) {
			const { rect, sides } = this.config.bounds

			for (const meta of this.infoMetaList) {
				const p = meta.cssProperty as keyof typeof countedPosition
				if (sides.has(meta.cssProperty)) {
					countedPosition[p] = Math.max(countedPosition[p], rect[meta.cssProperty])
				}
				if (sides.has(meta.oppositeCssProperty)) {
					countedPosition[p] = Math.min(
						countedPosition[p],
						rect[meta.oppositeCssProperty] - this.element[meta.offsetSize]
					)
				}
			}
		}

		for (const meta of this.infoMetaList) {
			this.element.style[meta.cssProperty] = countedPosition[meta.cssProperty as keyof typeof countedPosition] + 'px'
		}
	}

	snap() {
		if (!this.config.snap) {
			this.makeDraggable()
			return
		}

		const { animation, forwards } = this.config.snap

		if (this.config.threshold != undefined) {
			const thresholds = this.checkThreshold()!
			const passed = (Object.keys(thresholds) as TAxis[]).every(axis => thresholds[axis])

			if (passed && forwards) {
				this.makeDraggable()
				return
			}
		}

		const complete = () => (forwards ? this.makeDraggable() : this.styles('clear'))

		if (!animation) {
			complete()
			return
		}

		// Если реализовывать через view-transition мы упираемся в ограничение возможности контролировать анимацию из-за невозможности задать ::view-transition-group(name) если name генерируется динамически, а статическое имя не подходит, так как может совпасть для разных сессий. Подход рабочий, но ограниченный.
		const elementDelta = this.getElementDelta()
		const promises = this.infoAxisList.map(axis => {
			const meta = this.info[axis]

			this.element.style[meta.cssProperty] = this.initialGeometry[meta.cssProperty] + 'px'

			return new Promise<void>(resolve => {
				const handler = (e: TransitionEvent) => {
					if (e.propertyName !== meta.cssProperty) return
					this.element.removeEventListener('transitionend', handler)
					resolve()
				}
				elementDelta[axis] === 0 ? resolve() : this.element.addEventListener('transitionend', handler)
			})
		})

		Promise.all(promises).then(complete, err => this.#notificationService.show(err))
	}

	// Публичный API. Результат передается в событии.
	getDirection() {
		const result = {} as Record<
			TAxis,
			SessionInfo<TAxis>[TAxis]['cssProperty'] | SessionInfo<TAxis>[TAxis]['oppositeCssProperty']
		>
		const delta = this.getDelta()

		for (const axis of this.infoAxisList) {
			const meta = this.info[axis]

			result[axis] = delta[axis] > 0 ? meta.oppositeCssProperty : meta.cssProperty
		}

		return result
	}

	// Публичный API. Результат передается в событии. (Видимы ли углы элемента)
	isInView() {
		const rect = this.element.getBoundingClientRect()
		return {
			topLeft: !!document.elementFromPoint(rect.left, rect.top),
			topRight: !!document.elementFromPoint(rect.right, rect.top),
			bottomLeft: !!document.elementFromPoint(rect.left, rect.bottom),
			bottomRight: !!document.elementFromPoint(rect.right, rect.bottom)
		}
	}

	// Публичный API. Результат передается в событии, поэтому удобнее объект.
	checkThreshold() {
		if (this.config.threshold == undefined) return

		const result = {} as Record<TAxis, boolean>
		const delta = this.getDelta()

		for (const axis of this.infoAxisList) {
			result[axis] = Math.abs(delta[axis]) > this.config.threshold
		}

		return result
	}

	getDelta() {
		const result = {} as Record<TAxis, number>
		const client = { x: this.eCurrent?.clientX, y: this.eCurrent?.clientY }

		for (const axis of this.infoAxisList) {
			result[axis] = client[axis] - this.initialGeometry.start[axis]
		}

		return result
	}

	getElementDelta() {
		const result = { center: {} } as Record<TAxis, number> & { center: Record<TAxis, number> }

		const rect = this.element.getBoundingClientRect()

		for (const axis of this.infoAxisList) {
			const meta = this.info[axis]

			;(result as Record<TAxis, number>)[axis] = rect[meta.cssProperty] - this.initialGeometry[meta.cssProperty]
			result.center[axis] = rect[meta.cssProperty] + rect[meta.size] / 2 - this.initialGeometry.center[axis]
		}
		return result
	}

	//тупой метод-хелпер
	#applyResistance(delta: number, threshold: number = 0, resistance: number = 0) {
		const T = Math.max(0, threshold)
		const R = Math.max(0, resistance)
		const a = Math.abs(delta)
		const s = Math.sign(delta) || 1

		return a <= T ? delta : s * (T + (a - T) / (1 + R))
	}
}
