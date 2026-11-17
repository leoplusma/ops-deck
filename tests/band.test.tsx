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

test('the band shows what Claude is doing in its colour, on every scene', async ($, on) => {
  on('clock.now', () => ({ value: 1794700000000 }))
  // Working on files, with the background off.
  const state: Record<string, unknown> = { isThinking: true, activity: 'files', isBackgroundOn: false }
  on('state.get', ($, e, next) => (e.key in state ? { value: { value: state[e.key], version: 1 } } : next(e)))

  let ui = await $.ui.mount(BAND)
  const word = await ui.find({ type: 'Text', text: /^◉ FILES$/ })
  expect(word?.props.color).toBe('#ffb020')
  expect((await ui.find({ type: 'Box', key: 'band-frame' }))?.props.borderColor).toBe('#ffb020')
  await ui.unmount()

  // A moving scene too: running a command, in the run colour.
  state.isBackgroundOn = true
  state.currentScene = 'horizon'
  state.activity = 'run'
  ui = await $.ui.mount(BAND)
  expect((await ui.find({ type: 'Text', text: /^◉ RUNNING$/ }))?.props.color).toBe('#33f5b0')
  expect((await ui.find({ type: 'Box', key: 'band-frame' }))?.props.borderColor).toBe('#33f5b0')
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

test('an MCP server started as a command counts as this PC; one at a remote URL as web', async ($, on) => {
  on('clock.now', () => ({ value: 1794700000000 }))
  on('ui.toast', () => ({ value: undefined }))
  on('tool.call', () => ({ result: {} }))
  on('env.get', ($, e) => ({ value: e.name === 'USERPROFILE' ? 'C:/Users/someone' : undefined }))
  on('session.root', () => ({ value: 'C:/work/app' }))
  // The user's settings: a local server and a remote one; nothing else exists.
  on('fs.read', ($, e) => {
    // The engine hands paths over with backslashes.
    if (String(e.path).split('\\').join('/') === 'C:/Users/someone/.claude.json') {
      return {
        value: JSON.stringify({
          mcpServers: { s1mcp: { command: 'node', args: ['server.js'] }, tickets: { type: 'http', url: 'https://mcp.example.com/sse' } },
        }),
      }
    }
    throw new Error('missing')
  })

  await $.tool.call({ tool: 'mcp__s1mcp__run_select', sql: 'SELECT 1' })
  let ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: /LOCAL/ })).toBeDefined()
  await ui.unmount()

  await $.tool.call({ tool: 'mcp__tickets__list' })
  ui = await $.ui.mount(BAND)
  expect(await ui.find({ type: 'Text', text: /🌐 1/ })).toBeDefined()
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
