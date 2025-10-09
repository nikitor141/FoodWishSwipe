import { Component } from '@core/component/component.ts'
import { Singleton } from '@utils/singleton.ts'

export interface DragConfig {
	direction: 'horizontal' | 'vertical' | 'both'
	componentInstance: Component
	threshold?: number // минимальное расстояние для срабатывания
	resistance?: number // сопротивление при перетаскивании
	snap?: boolean // возврат на место или удаление
	bounds?: DOMRect // ограничения движения
}
interface Strategy {
	move: (
		element: HTMLElement,
		shift: { x?: number; y?: number },
		start: { x?: number; y?: number },
		config: DragConfig,
		e: PointerEvent
	) => void
	checkThreshold: (delta: { x?: number; y?: number }, threshold: number) => { x?: boolean; y?: boolean }
	checkBounds: (
		element: HTMLElement,
		bounds: DOMRect,
		pendingCoords: { top?: number; left?: number }
	) => {
		top?: number
		left?: number
		isAtTop?: boolean
		isAtBottom?: boolean
		isAtLeft?: boolean
		isAtRight?: boolean
	}
	isInView: (element: HTMLElement) => {
		topLeft: boolean
		topRight: boolean
		bottomLeft: boolean
		bottomRight: boolean
	}
	snap: (
		element: HTMLElement,
		initialPosition: { left: number; top: number; center: { x: number; y: number } }
	) => void
}
export type DragCustomEvent<T extends Component = Component> = CustomEvent<{
	instance: T
	thresholdPassed: { x?: boolean; y?: boolean }
	isInView: { topLeft: boolean; topRight: boolean; bottomLeft: boolean; bottomRight: boolean }
	elementDelta: { x: number; y: number; center: { x: number; y: number } }
	direction: 'left' | 'right' | 'up' | 'down' | null
}>

export class DragService extends Singleton {
	#onPointerDown: (e: PointerEvent) => void

	protected constructor() {
		super()
	}

	#strategies: Record<string, Strategy> = {
		horizontal: {
			move(element, { x: shiftX }, { x: startX }, { resistance = 0, threshold, bounds }, e) {
				const deltaX = e.clientX - startX
				let left = startX - shiftX + deltaX

				const appliedDelta = applyResistance(deltaX, threshold, resistance)
				left = startX - shiftX + appliedDelta

				if (bounds) {
					const bounded = this.checkBounds(element, bounds, { left })
					left = bounded.left
				}

				element.style.left = left + 'px'

				function applyResistance(delta: number, threshold = 0, resistance = 0) {
					const T = Math.max(0, threshold)
					const R = Math.max(0, resistance)
					const a = Math.abs(delta)
					const s = Math.sign(delta) || 1

					if (a <= T) return delta
					return s * (T + (a - T) / (1 + R))
				}
			},

			checkThreshold: ({ x }, threshold) => {
				return { x: Math.abs(x) > threshold }
			},

			checkBounds: (element, bounds, { left }) => {
				const maxLeft = bounds.right - element.offsetWidth
				const correctedLeft = Math.max(bounds.left, Math.min(left, maxLeft))

				return {
					left: correctedLeft,
					isAtLeft: left <= bounds.left,
					isAtRight: left >= maxLeft
				}
			},
			isInView: element => {
				const elementCoords = element.getBoundingClientRect()
				return {
					topLeft: !!document.elementFromPoint(elementCoords.left, elementCoords.top),
					topRight: !!document.elementFromPoint(elementCoords.right, elementCoords.top),
					bottomLeft: !!document.elementFromPoint(elementCoords.left, elementCoords.bottom),
					bottomRight: !!document.elementFromPoint(elementCoords.right, elementCoords.bottom)
				}
			},
			snap: (element, initialPosition) => {
				element.style.left = initialPosition.left + 'px'
			}
		},
		vertical: {
			move(element, { y: shiftY }, { y: startY }, { resistance = 0, threshold, bounds }, e) {
				const deltaY = e.clientY - startY
				let top = startY - shiftY + deltaY

				const appliedDelta = applyResistance(deltaY, threshold, resistance)
				top = startY - shiftY + appliedDelta

				if (bounds) {
					const bounded = this.checkBounds(element, bounds, { top })
					top = bounded.top
				}

				element.style.top = top + 'px'

				function applyResistance(delta: number, threshold = 0, resistance = 0) {
					const T = Math.max(0, threshold)
					const R = Math.max(0, resistance)
					const a = Math.abs(delta)
					const s = Math.sign(delta) || 1

					if (a <= T) return delta
					return s * (T + (a - T) / (1 + R))
				}
			},

			checkThreshold: ({ y }, threshold) => {
				return { y: Math.abs(y) > threshold }
			},

			checkBounds: (element, bounds, { top }) => {
				const maxTop = bounds.bottom - element.offsetHeight
				const correctedTop = Math.max(bounds.top, Math.min(top, maxTop))

				return {
					top: correctedTop,
					isAtTop: top <= bounds.top,
					isAtBottom: top >= maxTop
				}
			},

			isInView: element => {
				const elementCoords = element.getBoundingClientRect()
				return {
					topLeft: !!document.elementFromPoint(elementCoords.left, elementCoords.top),
					topRight: !!document.elementFromPoint(elementCoords.right, elementCoords.top),
					bottomLeft: !!document.elementFromPoint(elementCoords.left, elementCoords.bottom),
					bottomRight: !!document.elementFromPoint(elementCoords.right, elementCoords.bottom)
				}
			},
			snap: (element, initialPosition) => {
				element.style.top = initialPosition.top + 'px'
			}
		},
		both: {
			move(element, shift, start, { resistance = 0, threshold, bounds }, e) {
				const delta = { x: e.clientX - start.x, y: e.clientY - start.y }

				let top = start.y - shift.y + delta.y
				let left = start.x - shift.x + delta.x

				const appliedDelta = applyResistance(delta, threshold, resistance)
				top = start.y - shift.y + appliedDelta.y
				left = start.x - shift.x + appliedDelta.x

				if (bounds) {
					const bounded = this.checkBounds(element, bounds, { top, left })
					top = bounded.top
					left = bounded.left
				}

				element.style.top = top + 'px'
				element.style.left = left + 'px'

				function applyResistance(delta: { x: number; y: number }, threshold = 0, resistance = 0) {
					const T = Math.max(0, threshold)
					const R = Math.max(0, resistance)
					const aX = Math.abs(delta.x)
					const sX = Math.sign(delta.x) || 1
					const aY = Math.abs(delta.y)
					const sY = Math.sign(delta.y) || 1

					if (aX <= T && aY <= T) return { x: delta.x, y: delta.y }
					if (aX <= T) return { x: delta.x, y: sY * (T + (aY - T) / (1 + R)) }
					if (aY <= T) return { y: delta.y, x: sX * (T + (aX - T) / (1 + R)) }

					return { x: sX * (T + (aX - T) / (1 + R)), y: sY * (T + (aY - T) / (1 + R)) }
				}
			},

			checkThreshold: ({ x, y }, threshold) => {
				return { x: Math.abs(x) > threshold, y: Math.abs(y) > threshold }
			},

			checkBounds: (element, bounds, { top, left }) => {
				const maxTop = bounds.bottom - element.offsetHeight
				const maxLeft = bounds.right - element.offsetWidth

				const correctedTop = Math.max(bounds.top, Math.min(top, maxTop))
				const correctedLeft = Math.max(bounds.left, Math.min(left, maxLeft))

				return {
					top: correctedTop,
					left: correctedLeft,
					isAtTop: top <= bounds.top,
					isAtBottom: top >= maxTop,
					isAtLeft: left <= bounds.left,
					isAtRight: left >= maxLeft
				}
			},
			isInView: element => {
				const elementCoords = element.getBoundingClientRect()
				return {
					topLeft: !!document.elementFromPoint(elementCoords.left, elementCoords.top),
					topRight: !!document.elementFromPoint(elementCoords.right, elementCoords.top),
					bottomLeft: !!document.elementFromPoint(elementCoords.left, elementCoords.bottom),
					bottomRight: !!document.elementFromPoint(elementCoords.right, elementCoords.bottom)
				}
			},
			snap: (element, initialPosition) => {
				element.style.top = initialPosition.top + 'px'
				element.style.left = initialPosition.left + 'px'
			}
		}
	}

	attach(element: HTMLElement, config: DragConfig) {
		const elementCoords = element.getBoundingClientRect()
		const initialPosition = {
			left: elementCoords.left,
			top: elementCoords.top,
			center: { x: elementCoords.left + elementCoords.width / 2, y: elementCoords.top + elementCoords.height / 2 }
		}

		this.#onPointerDown = e => {
			this.#produceDrag(element, config, initialPosition, e)
		}

		element.addEventListener('pointerdown', this.#onPointerDown, { passive: true })
	}

	detach(element: HTMLElement) {
		element.removeEventListener('pointerdown', this.#onPointerDown)
	}

	#produceDrag(
		element: HTMLElement,
		config: DragConfig,
		initialPosition: { left: number; top: number; center: { x: number; y: number } },
		e: PointerEvent
	) {
		element.ondragstart = () => false
		element.style.position = 'absolute'
		element.dataset.dragging = 'true'
		element.dispatchEvent(
			new CustomEvent('dragstart', { bubbles: true, detail: { instance: config.componentInstance } })
		)

		const strategy = this.#strategies[config.direction]
		const shift = {
			x: e.clientX - element.getBoundingClientRect().left,
			y: e.clientY - element.getBoundingClientRect().top
		}
		const start = {
			x: e.clientX,
			y: e.clientY
		}

		const moving = (e: PointerEvent) => {
			strategy.move(element, shift, start, config, e)

			const elementCoords = element.getBoundingClientRect()
			const elementDelta = {
				x: elementCoords.left - initialPosition.left,
				y: elementCoords.top - initialPosition.top,
				center: {
					x: elementCoords.left + elementCoords.width / 2 - initialPosition.center.x,
					y: elementCoords.top + elementCoords.height / 2 - initialPosition.center.y
				}
			}
			element.dispatchEvent(
				new CustomEvent('dragmove', {
					bubbles: true,
					detail: {
						instance: config.componentInstance,
						elementDelta
					}
				})
			)
		}

		const release = (e: PointerEvent) => {
			const delta = { x: e.clientX - start.x, y: e.clientY - start.y }
			const isThresholdPassed = strategy.checkThreshold(delta, config.threshold)
			let swipeDirection: DragCustomEvent['detail']['direction'] = null

			if (config.snap && (!isThresholdPassed.x || !isThresholdPassed.y)) {
				strategy.snap(element, initialPosition)
			}
			if (isThresholdPassed.x) {
				swipeDirection = delta.x > 0 ? 'right' : 'left'
			} else if (isThresholdPassed.y) {
				swipeDirection = delta.y > 0 ? 'down' : 'up'
			}

			element.dataset.dragging = 'false'
			element.ondragstart = null
			element.removeEventListener('pointermove', moving)
			element.removeEventListener('pointerup', release)

			element.dispatchEvent(
				new CustomEvent('dragend', {
					bubbles: true,
					detail: {
						instance: config.componentInstance,
						thresholdPassed: isThresholdPassed,
						isInView: strategy.isInView(element),
						direction: swipeDirection
					}
				})
			)
		}

		element.addEventListener('pointermove', moving, { passive: true })
		element.addEventListener('pointerup', release, { passive: true })
		element.setPointerCapture(e.pointerId)
	}
}
