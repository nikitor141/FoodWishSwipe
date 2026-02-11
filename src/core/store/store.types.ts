import { ScreenSingleton } from '@core/component/base-screen.types.ts'
import { AvailableThemes } from '@core/services/themes.service.ts'
import { ExcludedSerialized } from '@core/types/excluded.types.ts'

export interface StateItems {
	theme: AvailableThemes
	screen: { previous: ScreenSingleton; current: ScreenSingleton }
	excluded: ExcludedSerialized
	screenReady: boolean
	layoutReady: boolean
}
