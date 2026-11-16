import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'ops-deck',
  component: 'AbovePrompt',
  surface: 'desktop',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 4,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 4 },
    view: {},
  },
} as const

test('the band has no frame at rest, and a red one after a tool fails', async ($, on) => {
  on('clock.now', () => ({ value: 1794700000000 }))
  on('ui.toast', () => ({ value: undefined }))
  on('tool.call', () => ({ result: {}, isError: true }))

  let ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Box', key: 'band-frame' })).toBeUndefined()
  await ui.unmount()

  await $.tool.call({ tool: 'Bash', command: 'exit 1' })

  ui = await $.ui.mount(BAND)
  const frame = await ui.find({ type: 'Box', key: 'band-frame' })
  expect(frame?.props.borderColor).toBe('#ff4d6d')
  expect(frame?.props.backgroundColor).toBe('#05090f')
  expect(await ui.find({ type: 'Text', text: /^▲ BASH FAILED$/ })).toBeDefined()
  await ui.unmount()
})

test('the band has a button that opens and closes the dashboard', async ($, on) => {
  on('clock.now', () => ({ value: 1794700000000 }))
  const saved: Record<string, unknown> = {}
  on('store.set', (_$, e) => {
    saved[e.key] = e.value
    return { value: undefined }
  })
  const opened: string[] = []
  on('ui.open', (_$, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', () => ({ value: undefined }))

  const ui = await $.ui.mount(BAND)
  // The dashboard starts open: the button closes it, then opens it again.
  const button = async () => ui.find({ type: 'Button', key: 'band-dashboard' })
  expect(await ui.find({ type: 'Text', text: /^☷$/ })).toBeDefined()
  expect((await button())?.props.variant).toBe('primary')
  await ui.press({ key: 'band-dashboard' })
  expect(saved.dashboard).toBe(false)
  await ui.press({ key: 'band-dashboard' })
  expect(saved.dashboard).toBe(true)
  expect(opened).toEqual(['hud-dashboard'])
  await ui.unmount()
})

test('the band shows LOCAL while nothing has left this PC', async ($, on) => {
  on('clock.now', () => ({ value: 1794700000000 }))
  const ui = await $.ui.mount(BAND)
  expect((await ui.find({ type: 'Text', text: /⌂ LOCAL/ }))?.props.color).toBe('#39ff88')
  await ui.unmount()
})

test('the band counts the places reached outside this PC, and warns on a full context', async ($, on) => {
  on('clock.now', () => ({ value: 1794700000000 }))
  const readout = { model: 'x', contextPercent: 93, usd: null, fiveHour: null, week: null, tools: 0, seconds: 0 }
  on('state.get', ($, e, next) => (e.key === 'readout' ? { value: { value: readout, version: 1 } } : next(e)))
  on('ui.toast', () => ({ value: undefined }))
  on('tool.call', () => ({ result: {} }))

  await $.tool.call({ tool: 'WebFetch', url: 'https://example.com/page', prompt: 'read it' })
  await $.tool.call({ tool: 'PowerShell', command: 'ping 192.168.1.20' })

  const ui = await $.ui.mount(BAND)
  expect((await ui.find({ type: 'Text', text: /🌐 2/ }))?.props.color).toBe('#ffb020')
  expect(await ui.find({ type: 'Text', text: /⛔/ })).toBeUndefined()
  const ctx = await ui.find({ type: 'Text', text: /CTX 93% ⚠/ })
  expect(ctx?.props.color).toBe('#ff4d6d')
  expect(ctx?.props.bold).toBe(true)
  await ui.unmount()
})

test('the band shows the total time worked this session', async ($, on) => {
  on('clock.now', () => ({ value: 1794700000000 }))
  // An hour, two minutes and five seconds already worked in earlier turns.
  on('state.get', ($, e, next) => (e.key === 'workSeconds' ? { value: { value: 3725, version: 1 } } : next(e)))

  const ui = await $.ui.mount(BAND)
  expect((await ui.find({ type: 'Text', text: /^Σ / }))?.text).toBe('Σ 1:02:05')
  await ui.unmount()
})
