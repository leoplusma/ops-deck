import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'ops-deck',
  component: 'Pane',
  requestId: 'hud-dashboard',
  props: {
    title: 'HUD · Session',
    isFocused: false,
    bodyColumns: 48,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
} as const

test('an empty dashboard shows its sections and switches on the desktop', async ($, on) => {
  on('clock.now', () => ({ value: 1794700000000 }))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  // No titles over the network line and the usage bars, to save height.
  expect(await ui.find({ type: 'Text', text: /^USAGE$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^OUTSIDE THIS PC$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Stayed on this PC/ })).toBeDefined()
  // Usage on its own rows at the top, then the network below, with no split line.
  expect(await ui.find({ type: 'Box', key: 'glance-net' })).toBeDefined()
  expect(await ui.find({ type: 'Box', key: 'glance-usage' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^│\n│\n│$/ })).toBeUndefined()
  // No figures yet: the three rows say so.
  expect(await ui.find({ type: 'Text', text: /^5H --$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^WK --$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /No files read or changed yet/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /No tool calls yet/ })).toBeDefined()
  // Plan limits live in the band, not here.
  expect(await ui.find({ type: 'Text', text: /PLAN LIMITS/ })).toBeUndefined()
  // The background has no button of its own: the Scene list holds "None".
  expect(await ui.find({ type: 'Button', key: 'background' })).toBeUndefined()
  expect(await ui.find({ type: 'Select', key: 'scene' })).toBeDefined()
  await ui.unmount()
})

test('the dashboard shows the logo, and its help button opens and closes the help with the credits', async ($, on) => {
  on('clock.now', () => ({ value: 1794700000000 }))
  // The globe button opens the project page through PowerShell.
  const opened: string[] = []
  on('process.run', (_$, e) => {
    opened.push(e.init?.env?.OPSDECK_URL ?? '')
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  const panes: string[] = []
  on('ui.open', (_$, e) => {
    panes.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('store.set', () => ({ value: undefined }))
  const closed: string[] = []
  on('ui.close', (_$, e) => {
    closed.push(e.id)
    return { value: undefined }
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^v\d+\.\d+\.\d+$/ })).toBeDefined()
  // No files yet, so the only picture is the logo.
  expect((await ui.find({ type: 'Svg' }))?.props.source).toContain('<tspan fill="#22d3ee">deck</tspan>')
  // The help is not inside the dashboard: its button opens a pane of its own.
  expect(await ui.find({ type: 'Text', text: /^CREDITS$/ })).toBeUndefined()
  await ui.press({ key: 'help' })
  expect(panes).toEqual(['ops-deck-help'])
  expect(await ui.find({ type: 'Text', text: /^CREDITS$/ })).toBeUndefined()
  await ui.unmount()

  const help = await $.ui.mount({ ...PANE, requestId: 'ops-deck-help', surface: 'desktop' })
  expect(await help.find({ type: 'Text', text: /^CREDITS$/ })).toBeDefined()
  expect(await help.find({ type: 'Text', text: /^SUBAGENTS \(HELPER AGENTS\)$/ })).toBeDefined()
  expect(await help.find({ type: 'Text', text: /^Claude Opus 5\.5$/ })).toBeDefined()
  expect(await help.find({ type: 'Text', text: /^Grok 4\.6$/ })).toBeDefined()
  expect(await help.find({ type: 'Text', text: /^https:\/\/github\.com\/leoplusma\/ops-deck$/ })).toBeDefined()
  await help.press({ key: 'repo-open' })
  expect(opened).toEqual(['https://github.com/leoplusma/ops-deck'])
  await help.press({ key: 'help-close' })
  expect(closed).toEqual(['ops-deck-help'])
  await help.unmount()

  // Closing the dashboard closes the help with it.
  const again = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await again.press({ key: 'close' })
  expect(closed).toEqual(['ops-deck-help', 'hud-dashboard', 'ops-deck-help'])
  await again.unmount()
})

test('the language list switches the dashboard and the band to Greek, and saves the choice', async ($, on) => {
  on('clock.now', () => ({ value: 1794700000000 }))
  const saved: Record<string, unknown> = {}
  on('store.set', (_$, e) => {
    saved[e.key] = e.value
    return { value: undefined }
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Select', key: 'language' }))?.props.value).toBe('en')
  expect(await ui.find({ type: 'Text', text: /No tool calls yet/ })).toBeDefined()

  await ui.select({ key: 'language', value: 'el' })
  expect(saved.language).toBe('el')
  expect((await ui.find({ type: 'Select', key: 'language' }))?.props.value).toBe('el')
  expect(await ui.find({ type: 'Text', text: /Καμία κλήση εργαλείου ακόμη/ })).toBeDefined()
  expect((await ui.find({ type: 'Button', key: 'close' }))?.props.label).toBe('Κλείσιμο')
  // The other languages are offered and switch too.
  const languages = (await ui.find({ type: 'Select', key: 'language' }))?.props.options as { value: string }[] | undefined
  expect(languages?.map(o => o.value)).toEqual(['en', 'el', 'de', 'fr', 'es', 'it', 'pt', 'zh', 'ja', 'ar'])
  for (const [lang, close] of [['de', 'Schließen'], ['fr', 'Fermer'], ['es', 'Cerrar'], ['it', 'Chiudi'], ['pt', 'Fechar'], ['zh', '关闭'], ['ja', '閉じる'], ['ar', 'إغلاق']]) {
    await ui.select({ key: 'language', value: lang ?? 'en' })
    expect((await ui.find({ type: 'Button', key: 'close' }))?.props.label).toBe(close ?? '')
  }
  // Arabic reads right to left: rows run from the right and the texts read right to left.
  expect((await ui.find({ type: 'Box', key: 'brand' }))?.props.flexDirection).toBe('row-reverse')
  expect((await ui.find({ type: 'Text', text: /لا استدعاءات للأدوات بعد/ }))?.props.dir).toBe('rtl')
  // Back to a left-to-right language, the rows run from the left again.
  await ui.select({ key: 'language', value: 'el' })
  expect((await ui.find({ type: 'Box', key: 'brand' }))?.props.flexDirection).toBe('row')
  await ui.unmount()

  const band = await $.ui.mount({
    plugin: 'ops-deck',
    component: 'AbovePrompt',
    surface: 'desktop',
    props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 4, bodyColumns: 120, scroll: { offset: 0, bodyRows: 4 }, view: {} },
  })
  expect(await band.find({ type: 'Text', text: /ΑΝΑΜΟΝΗ/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /ΤΟΠΙΚΑ/ })).toBeDefined()
  await band.unmount()
})

test('a helper agent gets a row and a timeline, and its instructions open with a Copy button', async ($, on) => {
  let clock = 1794700000000
  on('clock.now', () => ({ value: clock }))
  on('tool.call', () => ({ result: {} }))
  let ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /No helper agents started yet/ })).toBeDefined()
  await ui.unmount()

  await $.tool.call({ tool: 'Agent', description: 'find the reset code', subagent_type: 'Explore', model: 'haiku', prompt: 'Look for the reset code and report where it is.' })
  clock += 30000

  ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /SUBAGENTS/ }))?.text).toBe('▾ SUBAGENTS · 1')
  expect(await ui.find({ type: 'Box', key: 'agents-chart-360' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Explore/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /find the reset code/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Haiku$/ })).toBeDefined()
  await ui.press({ key: 'agent-open:run-1' })
  expect(await ui.find({ type: 'Text', text: /^Look for the reset code and report where it is\.$/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'agent-copy:run-1' })).toBeDefined()
  await ui.unmount()
})

test('the scene list offers every background and switches to the one picked', async ($, on) => {
  on('clock.now', () => ({ value: 1794700000000 }))
  // Stands for the saved settings and the theme.
  const saved: Record<string, unknown> = {}
  on('store.set', (_$, e) => {
    saved[e.key] = e.value
    return { value: undefined }
  })
  on('store.get', (_$, e) => ({ value: saved[e.key] }))
  const looks: unknown[] = []
  on('theme.set', (_$, e) => {
    looks.push(e)
    return { value: { isDrawn: true, requestId: 'test' } }
  })
  // The app itself is set to light.
  on('state.get', ($, e, next) => (e.key === 'appLook' ? { value: { value: 'light', version: 1 } } : next(e)))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  const scene = await ui.find({ type: 'Select', key: 'scene' })
  const options = scene?.props.options as { value: string; label: string }[] | undefined
  expect(options?.map(o => o.value)).toEqual([
    'none', 'spotlight', 'circuit', 'horizon', 'data-room', 'code-rain', 'signal', 'ink-plotter', 'halftone-tide', 'digital-cream', 'heartline',
  ])
  // Each entry is marked ☀ light, ☾ dark or ◐ following the app (None and spotlight).
  expect(options?.find(o => o.value === 'ink-plotter')?.label).toBe('ink plotter ☀')
  expect(options?.find(o => o.value === 'signal')?.label).toBe('signal ☾')
  expect(options?.find(o => o.value === 'none')?.label).toBe('None ◐')
  expect(options?.find(o => o.value === 'spotlight')?.label).toBe('spotlight ◐')

  // Spotlight follows the app: with the app set to light, the paper theme.
  await ui.select({ key: 'scene', value: 'spotlight' })
  expect(JSON.stringify(looks[looks.length - 1])).toContain('HUD paper')

  // A light scene takes the paper theme (the app turns light), and a dark one the HUD theme.
  await ui.select({ key: 'scene', value: 'halftone-tide' })
  expect(JSON.stringify(looks[looks.length - 1])).toContain('HUD paper')
  await ui.select({ key: 'scene', value: 'signal' })
  expect(JSON.stringify(looks[looks.length - 1])).not.toContain('HUD paper')
  await ui.select({ key: 'scene', value: 'data-room' })
  expect((await ui.find({ type: 'Select', key: 'scene' }))?.props.value).toBe('data-room')
  expect(saved.background).toBe(true)

  // "None" turns the background off; picking a scene again turns it back on.
  await ui.select({ key: 'scene', value: 'none' })
  expect((await ui.find({ type: 'Select', key: 'scene' }))?.props.value).toBe('none')
  expect(saved.background).toBe(false)
  // With the app set to light, no background is plain cream with the paper theme.
  expect(JSON.stringify(looks[looks.length - 1])).toContain('HUD paper')
  expect(JSON.stringify(looks[looks.length - 1])).toContain('"color":"#f3ead6"')
  await ui.select({ key: 'scene', value: 'horizon' })
  expect((await ui.find({ type: 'Select', key: 'scene' }))?.props.value).toBe('horizon')
  expect(saved.background).toBe(true)
  await ui.unmount()
})

test('minimized to a widget, the dashboard is a short glance', async ($, on) => {
  on('clock.now', () => ({ value: 1794700000000 }))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop', props: { ...PANE.props, placement: 'widget' } })

  expect((await ui.find({ type: 'Text', text: /^CTX/ }))?.text).toBe('CTX --')
  expect(await ui.find({ type: 'Text', text: /^USAGE/ })).toBeUndefined()
  await ui.unmount()
})

test('the dashboard graphs the files and details the tools', async ($, on) => {
  on('clock.now', () => ({ value: 1794700000000 }))
  // Stands for the tools themselves: each call answers.
  on('tool.call', () => ({ result: {} }))

  await $.tool.call({ tool: 'Read', file_path: 'C:/work/app/src/main.ts' })
  await $.tool.call({ tool: 'Edit', file_path: 'C:/work/app/src/main.ts', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Read', file_path: 'C:/work/app/docs/readme.md' })
  await $.tool.call({ tool: 'Bash', command: 'npm test' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await ui.find({ type: 'Text', text: /FILES TOUCHED/ }))?.text).toBe('▾ FILES TOUCHED · 2')
  expect((await ui.find({ type: 'Text', text: /TOOLS USED/ }))?.text).toBe('▾ TOOLS USED · 3 tools · 4 calls')
  expect(await ui.find({ type: 'Box', key: 'files-graph-360' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /read ×1 · edited ×1/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /npm test/ })).toBeDefined()
  // Idle, nothing in the graph moves: an endless pulse costs a PC without a graphics card.
  const graph = (await ui.findAll({ type: 'Svg' })).find(one => String(one.props.source).includes('class="fn'))
  expect(String(graph?.props.source)).toContain('class="fn')
  expect(String(graph?.props.source)).not.toContain('class="pl"')
  await ui.unmount()
})

test('the newest file pulses while Claude works with a scene, never with None', async ($, on) => {
  on('clock.now', () => ({ value: 1794700000000 }))
  on('tool.call', () => ({ result: {} }))
  const state: Record<string, unknown> = { isThinking: true, isBackgroundOn: false }
  on('state.get', ($, e, next) => (e.key in state ? { value: { value: state[e.key], version: 1 } } : next(e)))
  await $.tool.call({ tool: 'Read', file_path: 'C:/work/app/src/main.ts' })
  const mount = () => $.ui.mount({ ...PANE, surface: 'desktop' })
  const graphSource = async (ui: Awaited<ReturnType<typeof mount>>) =>
    String((await ui.findAll({ type: 'Svg' })).find(one => String(one.props.source).includes('class="fn'))?.props.source)

  // Working, with None: nothing pulses.
  let ui = await mount()
  let source = await graphSource(ui)
  expect(source).toContain('class="fn')
  expect(source).not.toContain('class="pl"')
  expect(source).not.toContain('class="live"')
  await ui.unmount()

  // Working, with a scene: the newest file pulses.
  state.isBackgroundOn = true
  ui = await mount()
  source = await graphSource(ui)
  expect(source).toContain('class="pl"')
  await ui.unmount()
})

test('the dashboard says when calls left this PC, and where to', async ($, on) => {
  on('clock.now', () => ({ value: 1794700000000 }))
  on('tool.call', () => ({ result: {} }))

  let ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /Stayed on this PC/ })).toBeDefined()
  await ui.unmount()

  await $.tool.call({ tool: 'Bash', command: 'curl -s http://localhost:3000/health' })
  await $.tool.call({ tool: 'WebFetch', url: 'https://example.com/page', prompt: 'read it' })
  await $.tool.call({ tool: 'PowerShell', command: 'ping 192.168.1.20' })
  await $.tool.call({ tool: 'Bash', command: 'npm install left-pad' })

  ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /Stayed on this PC/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^example\.com$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^192\.168\.1\.20$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^npm remote$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^localhost/ })).toBeUndefined()
  expect((await ui.find({ type: 'Text', text: /WEB/ }))?.text).toBe('◆ WEB 1')
  expect((await ui.find({ type: 'Text', text: /LAN/ }))?.text).toBe('◆ LAN 1')
  // ▸ opens the whole call to a place, with a Copy button.
  expect(await ui.find({ type: 'Button', key: 'net-copy:example.com' })).toBeUndefined()
  await ui.press({ key: 'net-open:example.com' })
  expect(await ui.find({ type: 'Button', key: 'net-copy:example.com' })).toBeDefined()
  await ui.unmount()

  // A name tag written into an SVG file is not a place anything connects to.
  await $.tool.call({ tool: 'Bash', command: `node -e "write('<svg xmlns=\\"http://www.w3.org/2000/svg\\"/>')"` })
  ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  // (The command itself still shows under TOOLS USED; only the network list must not name it.)
  expect(await ui.find({ type: 'Text', text: /^www\.w3\.org$/ })).toBeUndefined()
  await ui.unmount()
})

test('sections fold, a tool row opens its whole last command, and a file opens in Explorer', async ($, on) => {
  on('clock.now', () => ({ value: 1794700000000 }))
  on('tool.call', () => ({ result: {} }))
  const ran: string[] = []
  on('process.run', (_$, e) => {
    ran.push(`${e.argv[0]} ${e.init?.env?.OPSDECK_FILE ?? ''}`)
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.write', () => ({ value: undefined }))
  const copied: string[] = []
  on('ui.copy', (_$, e) => {
    copied.push(e.text)
    return { value: { isCopied: true } }
  })
  on('ui.toast', () => ({ value: undefined }))
  await $.tool.call({ tool: 'Read', file_path: 'C:/work/app/src/main.ts' })
  await $.tool.call({ tool: 'Read', file_path: 'C:/work/app/docs/readme.md' })

  const long = `npm run build -- --config ${'x'.repeat(200)} --then-the-end`
  await $.tool.call({ tool: 'Bash', command: long })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  // The switches sit on top, the graph has no zoom or size buttons left.
  expect(await ui.find({ type: 'Button', key: 'close' })).toBeDefined()
  // The graph is drawn at the pane's width: 48 columns make 360 px.
  expect(await ui.find({ type: 'Box', key: 'files-graph-360' })).toBeDefined()
  expect(await ui.find({ type: 'Button', key: 'zoom-in' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', key: 'tall' })).toBeUndefined()

  // Folding the files section hides the graph; unfolding brings it back.
  await ui.press({ key: 'fold:files' })
  expect(await ui.find({ type: 'Box', key: 'files-graph-360' })).toBeUndefined()
  await ui.press({ key: 'fold:files' })
  expect(await ui.find({ type: 'Box', key: 'files-graph-360' })).toBeDefined()

  // A long command shows whole once its row is opened.
  expect(await ui.find({ type: 'Text', text: /--then-the-end/ })).toBeUndefined()
  await ui.press({ key: 'open:Bash' })
  expect(await ui.find({ type: 'Text', text: /--then-the-end/ })).toBeDefined()
  // The tool's name keeps its colour beside the toggle.
  expect((await ui.find({ type: 'Text', text: /^Bash$/ }))?.props.color).toBe('#22d3ee')

  // Copy puts the whole command on the clipboard.
  await ui.press({ key: 'copy:Bash' })
  expect(copied).toEqual([long])

  await ui.press({ key: 'reveal:C:/work/app/src/main.ts' })
  expect(ran).toEqual(['powershell.exe C:\\work\\app\\src\\main.ts'])
  await ui.unmount()
})

test('the terminal shows the files as a list, without the graph', async ($, on) => {
  on('clock.now', () => ({ value: 1794700000000 }))
  on('tool.call', () => ({ result: {} }))
  await $.tool.call({ tool: 'Read', file_path: 'C:/work/app/src/main.ts' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /^main\.ts$/ })).toBeDefined()
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.unmount()
})

test('the demo tab draws the dashboard from a made-up session, leaving the real one empty', async ($, on) => {
  on('clock.now', () => ({ value: 1794700000000 }))
  const demo = await $.ui.mount({ ...PANE, requestId: 'ops-deck-demo', surface: 'desktop' })
  expect(await demo.find({ type: 'Text', text: /open-meteo\.com/ })).toBeDefined()
  expect(await demo.find({ type: 'Box', key: 'agent-open:demo-1' }) ?? (await demo.find({ type: 'Button', key: 'agent-open:demo-1' }))).toBeDefined()
  await demo.unmount()
  const real = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await real.find({ type: 'Text', text: /open-meteo\.com/ })).toBeUndefined()
  await real.unmount()
})
