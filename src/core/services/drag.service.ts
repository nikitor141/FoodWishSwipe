import { Component } from '@core/component/component.ts'
import { Singleton } from '@utils/singleton.ts'

export interface DragConfig {
	direction: 'horizontal' | 'vertical' | 'both'
	componentInstance: Component
	threshold?: number // минимальное расстояние для срабатывания
	resistance?: number // сопротивление при перетаскивании
	snap?: { animation: boolean; forwards: boolean } // возврат на место|анимировать?|не сбрасывать стили после прохождения threshold?
	bounds?: { rect: DOMRect; sides: ('top' | 'right' | 'bottom' | 'left')[] } // ограничения движения
	handles?: HTMLElement[] // элементы-ручка
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
		bounds: DragConfig['bounds']['rect'],
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
		initialGeometry: { width: number; height: number; left: number; top: number; center: { x: number; y: number } },
		isThresholdPassed: { x?: boolean; y?: boolean },
		snap: DragConfig['snap']
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
					const bounded = this.checkBounds(element, bounds.rect, { left })
					for (const side of bounds.sides) {
						if (bounded[`isAt${side[0].toUpperCase()}${side.slice(1)}`]) return
					}
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

			checkBounds: (element, rect, { left }) => {
				const maxLeft = rect.right - element.offsetWidth
				const correctedLeft = Math.max(rect.left, Math.min(left, maxLeft))

				return {
					left: correctedLeft,
					isAtLeft: left <= rect.left,
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
			snap: (element, initialGeometry, { x: isThresholdPassed }, snap) => {
				const shouldSnap = !isThresholdPassed || (isThresholdPassed && !snap.forwards)
				if (!shouldSnap) return

				if (!snap.animation) {
					clearStyles()
					return
				}

				element.style.left = initialGeometry.left + 'px'
				element.ontransitionend = e => {
					if (e.propertyName !== 'left') return
					clearStyles()
				}

				function clearStyles() {
					element.ontransitionend = null
					element.style.width = null
					element.style.height = null
					element.style.left = null
					element.style.position = null
				}
			}
		},
		vertical: {
			move(element, { y: shiftY }, { y: startY }, { resistance = 0, threshold, bounds }, e) {
				const deltaY = e.clientY - startY
				let top = startY - shiftY + deltaY

				const appliedDelta = applyResistance(deltaY, threshold, resistance)
				top = startY - shiftY + appliedDelta

				if (bounds) {
					const bounded = this.checkBounds(element, bounds.rect, { top })
					for (const side of bounds.sides) {
						if (bounded[`isAt${side[0].toUpperCase()}${side.slice(1)}`]) return
					}
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

			checkBounds: (element, rect, { top }) => {
				const maxTop = rect.bottom - element.offsetHeight
				const correctedTop = Math.max(rect.top, Math.min(top, maxTop))

				return {
					top: correctedTop,
					isAtTop: top <= rect.top,
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
			snap: (element, initialGeometry, { y: isThresholdPassed }, snap) => {
				const shouldSnap = !isThresholdPassed || (isThresholdPassed && !snap.forwards)
				if (!shouldSnap) return

				if (!snap.animation) {
					clearStyles()
					return
				}

				element.style.top = initialGeometry.top + 'px'
				element.ontransitionend = e => {
					if (e.propertyName !== 'top') return
					clearStyles()
				}

				function clearStyles() {
					element.ontransitionend = null
					element.style.width = null
					element.style.height = null
					element.style.top = null
					element.style.position = null
				}
			}
		},
		both: {
			move(element, shift, start, { resistance = 0, threshold, bounds }, e) {
				const delta = { x: e.clientX - start.x, y: e.clientY - start.y }

				let top = start.y - shift.y + delta.y
				let left = start.x - shift.x + delta.x

				const appliedDelta = {
					x: applyResistance(delta.x, threshold, resistance),
					y: applyResistance(delta.y, threshold, resistance)
				}
				top = start.y - shift.y + appliedDelta.y
				left = start.x - shift.x + appliedDelta.x

				if (bounds) {
					const bounded = this.checkBounds(element, bounds.rect, { top, left })
					for (const side of bounds.sides) {
						if (bounded[`isAt${side[0].toUpperCase()}${side.slice(1)}`]) return
					}
				}

				element.style.top = top + 'px'
				element.style.left = left + 'px'

				function applyResistance(delta: number, threshold: number = 0, resistance: number = 0) {
					const T = Math.max(0, threshold)
					const R = Math.max(0, resistance)
					const a = Math.abs(delta)
					const s = Math.sign(delta) || 1

					return a <= T ? delta : s * (T + (a - T) / (1 + R))
				}
			},

			checkThreshold: ({ x, y }, threshold) => {
				return { x: Math.abs(x) > threshold, y: Math.abs(y) > threshold }
			},

			checkBounds: (element, rect, { top, left }) => {
				const maxTop = rect.bottom - element.offsetHeight
				const maxLeft = rect.right - element.offsetWidth

				const correctedTop = Math.max(rect.top, Math.min(top, maxTop))
				const correctedLeft = Math.max(rect.left, Math.min(left, maxLeft))

				return {
					top: correctedTop,
					left: correctedLeft,
					isAtTop: top <= rect.top,
					isAtBottom: top >= maxTop,
					isAtLeft: left <= rect.left,
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
			snap: (element, initialGeometry, { x, y }, snap) => {
				const isThresholdPassed = x && y
				const shouldSnap = !isThresholdPassed || (isThresholdPassed && !snap.forwards)
				if (!shouldSnap) return

				if (!snap.animation) {
					clearStyles()
					return
				}

				element.style.top = initialGeometry.top + 'px'
				element.style.left = initialGeometry.left + 'px'

				Promise.all([
					new Promise(resolve => {
						element.ontransitionend = e => {
							if (e.propertyName !== 'top') return
							resolve(null)
						}
					}),
					new Promise(resolve => {
						element.ontransitionend = e => {
							if (e.propertyName !== 'left') return
							resolve(null)
						}
					})
				]).then(clearStyles)

				function clearStyles() {
					element.ontransitionend = null
					element.style.width = null
					element.style.height = null
					element.style.top = null
					element.style.left = null
					element.style.position = null
				}
			}
		}
	}

	attach(element: HTMLElement, config: DragConfig) {
		const rect = element.getBoundingClientRect()
		//todo? initialGeometry высчитывать в другом месте?
		const initialGeometry = {
			width: rect.width,
			height: rect.height,
			left: rect.left,
			top: rect.top,
			center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
		}

		this.#onPointerDown = e => {
			if (config.handles) {
				const target = e.target as Node
				const canDrag = config.handles.some(handle => {
					if (handle !== element && handle.contains(target)) {
						return true
					}

					return handle === element && target === element
				})

				if (!canDrag) return
			}

			this.#handleDrag(element, config, initialGeometry, e)
		}

		element.addEventListener('pointerdown', this.#onPointerDown, { passive: true })
	}

	detach(element: HTMLElement) {
		element.removeEventListener('pointerdown', this.#onPointerDown)
	}

	#handleDrag(
		element: HTMLElement,
		config: DragConfig,
		initialGeometry: { width: number; height: number; left: number; top: number; center: { x: number; y: number } },
		e: PointerEvent
	) {
		element.ondragstart = () => false
		element.style.position = 'fixed'
		element.style.width = initialGeometry.width + 'px'
		element.style.height = initialGeometry.height + 'px'
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
				x: elementCoords.left - initialGeometry.left,
				y: elementCoords.top - initialGeometry.top,
				center: {
					x: elementCoords.left + elementCoords.width / 2 - initialGeometry.center.x,
					y: elementCoords.top + elementCoords.height / 2 - initialGeometry.center.y
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

			if (config.snap) {
				strategy.snap(element, initialGeometry, isThresholdPassed, config.snap)
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

abstract class DragCore {
	applyResistance(delta: number, threshold: number = 0, resistance: number = 0) {
		const T = Math.max(0, threshold)
		const R = Math.max(0, resistance)
		const a = Math.abs(delta)
		const s = Math.sign(delta) || 1

		return a <= T ? delta : s * (T + (a - T) / (1 + R))
	}
}
