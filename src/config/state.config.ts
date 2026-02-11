import { StateItems } from '@core/store/store.types.ts'

export const INITIAL_STATE: StateItems = {
	theme: 'system',
	screen: { previous: null, current: null },
	layoutReady: false,
	screenReady: false
}
