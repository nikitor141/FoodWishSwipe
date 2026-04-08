import { Component } from '@/core/component/component'
import { AtLeastOneInArray } from '@/utils/types'

export type Axis = 'x' | 'y'
export type Direction = 'horizontal' | 'vertical' | 'both'
export type Side = 'top' | 'right' | 'bottom' | 'left'

export interface DragConfig<T extends Component = Component, D extends Direction = Direction> {
	direction: D
	componentInstance: T
	threshold?: number // минимальное расстояние для срабатывания
	resistance?: number // сопротивление при перетаскивании
	snap?: { animation: boolean; forwards: boolean } // возврат на место|ждать transitionend для сброса стилей?|не сбрасывать стили после прохождения threshold?
	bounds?: {
		rect: DOMRect
		sides: AtLeastOneInArray<Side> | Set<Side>
	} // ограничения движения
	handles?: HTMLElement[] // элементы-ручка
}

export type DragMoveEvent<T, TAxis extends Axis> = CustomEvent<{
	instance: T // Нужен для того, чтобы не только сам компонент, но и его оркестратор мог реагировать на событие
	elementDelta: Record<TAxis, number> & { center: Record<TAxis, number> }
}>

export type DragEndEvent<T> = CustomEvent<{
	instance: T
	isInView: Record<'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight', boolean>
	direction: Record<Axis, Side>
	thresholdPassed?: Record<Axis, boolean>
}>
