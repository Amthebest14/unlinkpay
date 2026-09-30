// The one place that decides which Vela the website talks to.
// After Vela access: build the real client and export it here instead.
import { browserStorage, createPlaceholderVela, DEMO_CONFIG, type DemoControls } from './placeholder'
import type { Vela } from './types'

const placeholder = createPlaceholderVela({ config: DEMO_CONFIG, storage: browserStorage(), latencyMs: 450 })

export const vela: Vela = placeholder.vela
export const demo: DemoControls | null = placeholder.demo
export const IS_DEMO = true
