import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, Register, RenderSurface, ThemeSetArgs, Timer } from 'claude-code'

import type { AgentRun, Alert, FileTouch, GraphView, NetReach, Readout, ToolCount, TurnRecord } from '../types'
import { makeColors } from './make-colors.js'

// HUD: deep blue-black glass, cyan accent, phosphor-green success.
const { theme, problems } = makeColors({
  label: 'HUD',
  only: 'dark',
  codeTheme: { dark: 'tokyo-night' },
  roles: { accent: '#22d3ee', danger: '#ff4d6d', success: '#39ff88', warning: '#ffb020', pro: '#a78bfa' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#05090f',
        'surface-1': '#09111a',
        'surface-2': '#0d1822',
        'surface-3': '#121f2b',
        'text-primary': '#d8f6ff',
        'text-secondary': '#9fd4e3',
        'text-muted': '#6fa3b3',
      },
    },
  },
})

// Paper, for the light scenes: cream surfaces, navy ink, deep teal accent.
const { theme: paperTheme, problems: paperProblems } = makeColors({
  label: 'HUD paper',
  only: 'light',
  roles: { accent: '#0e7490', danger: '#b4233c', success: '#15803d', warning: '#b45309', pro: '#6d28d9' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#efe4cc',
        'surface-1': '#f3ead6',
        'surface-2': '#f8f1e2',
        'text-primary': '#1f2a44',
        'text-secondary': '#3d4a66',
        'text-muted': '#6b6a72',
      },
    },
  },
})

const isThinking = atom({ plugin: 'ops-deck', key: 'isThinking' } as const, false)
const readout = atom({ plugin: 'ops-deck', key: 'readout' } as const, null as Readout | null)
const alert = atom({ plugin: 'ops-deck', key: 'alert' } as const, null as Alert)
// Change the tag when a turn record's fields change: it declines what an earlier version stored.
const turns = atom({ plugin: 'ops-deck', key: 'turns' } as const, [] as TurnRecord[], { shape: 'turns-1' })
const isBackgroundOn = atom({ plugin: 'ops-deck', key: 'isBackgroundOn' } as const, true)
const isDashboardOpen = atom({ plugin: 'ops-deck', key: 'isDashboardOpen' } as const, true)
const currentScene = atom({ plugin: 'ops-deck', key: 'currentScene' } as const, 'horizon')
const toolUse = atom({ plugin: 'ops-deck', key: 'toolUse' } as const, {} as Record<string, ToolCount>, { shape: 'tools-2' })
const files = atom({ plugin: 'ops-deck', key: 'files' } as const, [] as FileTouch[], { shape: 'files-2' })
const reach = atom({ plugin: 'ops-deck', key: 'reach' } as const, [] as NetReach[], { shape: 'reach-1' })
// The dashboard sections the person folded, and the tools whose last call they opened.
const collapsed = atom({ plugin: 'ops-deck', key: 'collapsed' } as const, [] as string[], { shape: 'collapsed-1' })
const openTools = atom({ plugin: 'ops-deck', key: 'openTools' } as const, [] as string[], { shape: 'open-tools-1' })
// Seconds Claude has worked this session, over all finished turns (the band adds the turn in progress).
const workSeconds = atom({ plugin: 'ops-deck', key: 'workSeconds' } as const, 0)
// True for a moment after a turn ends with no failure: the band flashes a green frame.
const justDone = atom({ plugin: 'ops-deck', key: 'justDone' } as const, false)
const DONE_FLASH_MS = 1500
// What Claude is doing now (an Activity), as the backgrounds show it.
const activity = atom({ plugin: 'ops-deck', key: 'activity' } as const, 'think')
// The helper agents started this session, newest last.
const agents = atom({ plugin: 'ops-deck', key: 'agents' } as const, [] as AgentRun[], { shape: 'agents-1' })
// The language of the dashboard and the band (en, el, de, fr, es or it), mirroring the saved choice.
const language = atom({ plugin: 'ops-deck', key: 'language' } as const, 'en')
// The desktop app's own light or dark setting, followed while the background is off.
const appLook = atom({ plugin: 'ops-deck', key: 'appLook' } as const, 'dark')

// steady: working, drawn at once with no fade-in (after an alert, so blue comes back without a dip).
type Mode = 'idle' | 'busy' | 'steady' | 'alert' | 'rest'

// Shared by every scene: how a scene fades in when work starts and out when it ends, and
// the steady red glow at the edges during an alert. Change them here, for all scenes.
const FADE_IN_CSS = '.all{animation:in 2s ease-out both}@keyframes in{from{opacity:0}}'
const FADE_OUT_CSS = '.all{animation:out 2.5s ease-in forwards}@keyframes out{to{opacity:0}}'
const ALERT_EDGE_CSS = '.flash{opacity:.4}'
// A fresh start fades in, the end fades out; an alert and the return from one show at once.
const fadeFor = (mode: Mode) => (mode === 'busy' ? FADE_IN_CSS : mode === 'idle' ? FADE_OUT_CSS : '')

// Shared by every wave in the scenes: a smooth curve through points (Catmull-Rom, written
// as cubic Béziers), so a wave has no corners or flat facets at any window size. `join`
// starts the path (M) or carries on a shape already started (L).
// Waves also keep any second harmonic small (0.1 of the main one at most): a stronger one
// flattens the crests into shelves and pulls the slopes straight, and the flow is lost.
type XY = [number, number]
const curveThrough = (points: readonly XY[], join: 'M' | 'L' = 'M') => {
  const first = points[0]
  if (first === undefined) return ''
  const at = (p: XY) => `${Math.round(p[0] * 10) / 10} ${Math.round(p[1] * 10) / 10}`
  let d = `${join}${at(first)}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const p1 = points[i] ?? first
    const p2 = points[i + 1] ?? p1
    const p0 = points[i - 1] ?? p1
    const p3 = points[i + 2] ?? p2
    d += `C${at([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${at([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${at(p2)}`
  }
  return d
}

// What Claude is doing, shown by every scene in one element of the activity colour (the
// only colour shared by all scenes): thinking, working with files, running a command or
// tool, or reaching the web or network. An alert turns it red like everything else.
type Activity = 'think' | 'files' | 'run' | 'web'
const ACTIVITIES: readonly Activity[] = ['think', 'files', 'run', 'web']
const ACTIVITY_COLOR: Record<Activity, string> = {
  think: '#a78bfa',
  files: '#ffb020',
  run: '#33f5b0',
  web: '#ff4fd8',
}
// The red that replaces the activity colour during an alert.
const ALERT_ACTIVITY = '#ff8a9a'

// Swapping frames (a new activity, an alert) restarts a frame's animations, so every
// motion is started at the point it had reached: elements give their own offset as --d
// (not animation-delay), and the root's --t, filled in when the frame is shown, is how
// many seconds the scene has been moving. The fades (.all) are left out.
const PHASE_MARK = 'svg{--t:0s}'
const PHASE_CSS = `${PHASE_MARK}*:not(.all){animation-delay:calc(var(--d,0s) - var(--t))!important}`
const atPhase = (source: string, seconds: number) => source.replace(PHASE_MARK, `svg{--t:${seconds.toFixed(2)}s}`)

// Scene "circuit": a glowing circuit board seen at a low angle, flying toward the
// viewer, with light pulses racing along its traces. Busy: the board fades in and flies.
// Idle: it fades out. Alert: the board turns red and the edges flash.
//
// How the flight loops without a seam: one band of board (depth 1 to TILE) is drawn once,
// then repeated, each copy shrunk by TILE toward the vanishing point, which is exactly how
// the next band deeper would look. Odd copies are mirrored to hide the repeat, so the loop
// zooms by two bands (TILE squared): its last frame matches its first. No blur filters and
// no cross-fades, so the frame stays cheap to draw.

type Pt = [number, number]

// Board space: x across, z into the screen. Points project as a camera above a flat board
// sees them, so straight board lines stay straight on screen.
const HORIZON_Y = -100
const VANISH_X = 800
const FOCAL = 1200
const TILE = 1.6
const projX = (x: number, z: number) => Math.round(VANISH_X + (x * FOCAL) / z)
const projY = (z: number) => Math.round(HORIZON_Y + FOCAL / z)
const line = (pts: Pt[]) => pts.map(([x, z], i) => `${i === 0 ? 'M' : 'L'}${projX(x, z)} ${projY(z)}`).join('')

// The band is generated once, from a fixed seed, so every draw shows the same board.
const BAND = (() => {
  let seed = 4242
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const between = (a: number, b: number) => a + rand() * (b - a)
  const depth = () => between(1, TILE)
  // Wide enough that the deeper, shrunken copies still reach the screen edges.
  const across = () => between(-2.1, 2.1)
  const keep = (z: number) => Math.min(TILE + 0.05, Math.max(0.95, z))

  const traces: string[] = []
  const pads: string[] = []
  const dots: string[] = []
  const vias: string[] = []
  const pulseLines: Pt[][] = []

  const ring = (x: number, z: number, r: number) => {
    const rx = (r * FOCAL) / z
    vias.push(`<ellipse cx="${projX(x, z)}" cy="${projY(z)}" rx="${rx.toFixed(1)}" ry="${(rx / z).toFixed(1)}"/>`)
  }

  // Buses: groups of parallel wires running into the board with 45-degree jogs.
  for (let b = 0; b < 50; b += 1) {
    let z = depth()
    let x = across()
    const wires = 2 + Math.floor(rand() * 5)
    const away = rand() < 0.5 ? -1 : 1
    const path: Pt[] = [[x, z]]
    const steps = 3 + Math.floor(rand() * 3)
    for (let s = 0; s < steps; s += 1) {
      const len = between(0.04, 0.2)
      if (s % 2 === 0) {
        z = keep(z + away * len)
      } else {
        x += (rand() < 0.5 ? -1 : 1) * len * 0.8
        z = keep(z + away * len * 0.8)
      }
      path.push([x, z])
    }
    for (let w = 0; w < wires; w += 1) {
      const pts = path.map(([px, pz]) => [px + w * 0.016, pz] as Pt)
      traces.push(line(pts))
      if (rand() < 0.3) {
        ring(x + w * 0.016, z, 0.006)
      }
      if (rand() < 0.35) {
        pulseLines.push(pts)
      }
    }
  }

  // Single traces running across the board with a jog.
  for (let t = 0; t < 45; t += 1) {
    const z = depth()
    const x = across()
    const dz = between(-0.06, 0.06)
    const len = between(0.06, 0.3)
    const pts: Pt[] = [
      [x, z],
      [x + len, z],
      [x + len + Math.abs(dz), keep(z + dz)],
      [x + len * 1.8 + Math.abs(dz), keep(z + dz)],
    ]
    traces.push(line(pts))
    if (rand() < 0.3) {
      pulseLines.push(pts)
    }
  }

  // Chips: an outline, sometimes a filled die, and pins on all four sides.
  for (let c = 0; c < 20; c += 1) {
    const z = between(1.03, TILE - 0.06)
    const x = across()
    const w = between(0.05, 0.14)
    const d = between(0.03, 0.08)
    const box = (m: number) =>
      line([
        [x - w / 2 + m, z - d / 2 + m],
        [x + w / 2 - m, z - d / 2 + m],
        [x + w / 2 - m, z + d / 2 - m],
        [x - w / 2 + m, z + d / 2 - m],
      ]) + 'Z'
    let chip = box(0)
    if (rand() < 0.6) {
      pads.push(box(Math.min(w, d) * 0.22))
    }
    const pins = 3 + Math.floor(rand() * 5)
    const pin = 0.014
    for (let i = 0; i < pins; i += 1) {
      const px = x - w / 2 + (w * (i + 0.5)) / pins
      const pz = z - d / 2 + (d * (i + 0.5)) / pins
      chip += line([[px, z - d / 2], [px, z - d / 2 - pin]])
      chip += line([[px, z + d / 2], [px, z + d / 2 + pin]])
      chip += line([[x - w / 2, pz], [x - w / 2 - pin, pz]])
      chip += line([[x + w / 2, pz], [x + w / 2 + pin, pz]])
    }
    traces.push(chip)
  }

  // Dot grids.
  for (let g = 0; g < 8; g += 1) {
    const z0 = between(1, TILE - 0.1)
    const x0 = across()
    const rows = 3 + Math.floor(rand() * 3)
    const cols = 3 + Math.floor(rand() * 6)
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const pz = z0 + r * 0.014
        dots.push(`M${projX(x0 + c * 0.014, pz)} ${projY(pz)}h0`)
      }
    }
  }

  // Standalone vias: double rings.
  for (let v = 0; v < 14; v += 1) {
    const z = depth()
    const x = across()
    ring(x, z, 0.009)
    ring(x, z, 0.0045)
  }

  // Pulses: a bright dash running along a trace, each with its own speed class and start.
  const pulses = pulseLines.slice(0, 24).map((pts, i) => {
    const delay = (rand() * 8).toFixed(1)
    return `<path class="p s${i % 6}" pathLength="100" style="--d:-${delay}s" d="${line(pts)}"/>`
  })

  return {
    traces: traces.join(''),
    pads: pads.join(''),
    dots: dots.join(''),
    vias: vias.join(''),
    pulses: pulses.join(''),
  }
})()

// The band's copies, nearest (k = -1, mostly below the screen) to deepest, each shrunk by
// TILE per step toward the vanishing point, odd ones mirrored.
const COPIES = Array.from({ length: 7 }, (_, i) => {
  const k = i - 1
  const s = Math.pow(TILE, -k)
  const sx = k % 2 === 0 ? s : -s
  const ox = VANISH_X * (1 - sx)
  const oy = HORIZON_Y * (1 - s)
  return `<use href="#t" xlink:href="#t" transform="matrix(${sx.toFixed(5)} 0 0 ${s.toFixed(5)} ${ox.toFixed(1)} ${oy.toFixed(1)})"/>`
}).join('')

const PULSE_SECONDS = [2.6, 3.4, 4.2, 5, 6.2, 7.4]

// The core chip of "circuit", in screen space (it does not fly with the board): a package
// with pins, a die lit in the activity colour, and traces leading in from every side
// with pulses running toward it.
// Top left, clear of the chat column's frosted glass, and far enough in (about a quarter
// of the width) to stay to the right of the app's left sidebar when that is open.
const CORE_X = 400
// Below the "horizon" scene's horizon line (HZ_LINE), just above the band and prompt.
const CORE_Y = 250
// The soft glow (fog) round the core chip. Off for now, to try the chip without it;
// set true to bring it back.
const CORE_GLOW = false
const CORE = (() => {
  // The package only just bigger than its die, so little dark shows round it.
  const half = 42
  const pins: string[] = []
  const leads: string[] = []
  for (let i = 0; i < 5; i += 1) {
    const o = -36 + i * 18
    pins.push(`M${o} ${-half}v-10M${o} ${half}v10M${-half} ${o}h-10M${half} ${o}h10`)
    // Each lead runs out from a pin, jogs at 45 degrees, then runs on.
    const far = 120 + ((i * 37) % 5) * 26
    const jog = (i - 2) * 22
    leads.push(
      `M${o} ${-half - 10}V${-half - 40}L${o + jog} ${-half - 40 - Math.abs(jog)}V${-half - far}`,
      `M${o} ${half + 10}V${half + 40}L${o - jog} ${half + 40 + Math.abs(jog)}V${half + far}`,
      `M${-half - 10} ${o}H${-half - 40}L${-half - 40 - Math.abs(jog)} ${o + jog}H${-half - far * 1.6}`,
      `M${half + 10} ${o}H${half + 40}L${half + 40 + Math.abs(jog)} ${o - jog}H${half + far * 1.6}`,
    )
  }
  return { half, pins: pins.join(''), leads }
})()

const circuitScene = (mode: Mode, act: Activity) => {
  const busy = mode !== 'idle'
  const red = mode === 'alert'
  const trace = red ? '#d0203a' : '#3a7bff'
  const bright = red ? '#ff6b7d' : '#6fa8ff'
  const hot = red ? '#ffd6db' : '#dcefff'
  const ground = red ? '#0d0206' : '#03061a'
  const haze = red ? '#4a0614' : '#0c1f8a'
  const core = red ? ALERT_ACTIVITY : ACTIVITY_COLOR[act]
  // Seconds to fly two bands; the zoom is TILE squared.
  const flight = red ? 35 : 70
  const pace = red ? 0.7 : 1.2
  const speeds = PULSE_SECONDS.map((s, i) => `.s${i}{animation-duration:${(s * pace).toFixed(2)}s}`).join('')
  // Pulses run inward along the leads, to the chip.
  const inward = CORE.leads
    .map((d, i) => `<path class="cp" pathLength="100" style="--d:-${((i * 0.618) % 1 * 3).toFixed(2)}s" d="${d}"/>`)
    .join('')
  const side = CORE.half
  // Drawn at half its designed size.
  const chip = `<g transform="translate(${CORE_X} ${CORE_Y}) scale(.5)">
${CORE_GLOW ? '<circle class="cg" r="230" fill="url(#cg)"/>' : ''}
<path class="cl" d="${CORE.leads.join('')}"/>${inward}
<path class="cpin" d="${CORE.pins}"/>
<rect class="cbody" x="${-side}" y="${-side}" width="${side * 2}" height="${side * 2}" rx="6"/>
<rect class="cdie" x="-34" y="-34" width="68" height="68" rx="3"/>
<path class="cmark" d="M-20 -9h40M-20 0h40M-20 9h27"/>
</g>`
  const flash = red ? '<rect class="flash" width="1600" height="1000" fill="url(#r)"/>' : ''
  const fade = fadeFor(mode)

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
.gw{fill:none;stroke:${trace};stroke-width:8;stroke-opacity:.16;stroke-linejoin:round}
.c{fill:none;stroke:${trace};stroke-width:2.6;stroke-opacity:1;stroke-linejoin:round}
.pd{fill:${bright};fill-opacity:.35;stroke:${bright};stroke-opacity:.6;stroke-width:1.5}
.d{fill:none;stroke:${bright};stroke-width:6;stroke-linecap:round;stroke-opacity:.6}
.v{fill:none;stroke:${bright};stroke-width:2;stroke-opacity:.7}
.pg{fill:none;stroke:${bright};stroke-width:9;stroke-opacity:.35;stroke-linecap:round}
.p{fill:none;stroke:${hot};stroke-width:3;stroke-linecap:round;stroke-dasharray:9 91;animation:run 4s linear infinite}
${speeds}
@keyframes run{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}
.fly{transform-origin:${VANISH_X}px ${HORIZON_Y}px;animation:fly ${flight}s linear infinite}
@keyframes fly{from{transform:scale(1)}to{transform:scale(${(TILE * TILE).toFixed(2)})}}
${fade}
.corner{fill:none;stroke:${bright};stroke-opacity:.75;stroke-width:2}
.blink{animation:blink 1s steps(2) infinite}
@keyframes blink{50%{opacity:0}}
.cl{fill:none;stroke:${trace};stroke-width:2.5;stroke-opacity:.8;stroke-linejoin:round}
.cp{fill:none;stroke:${core};stroke-width:3.5;stroke-linecap:round;stroke-dasharray:6 94;stroke-dashoffset:0;${busy ? `animation:cin ${red ? 1.6 : 3}s linear infinite` : 'opacity:0'}}
@keyframes cin{from{stroke-dashoffset:0}to{stroke-dashoffset:100}}
.cpin{fill:none;stroke:${bright};stroke-width:3;stroke-opacity:.9}
.cbody{fill:${ground};stroke:${bright};stroke-width:2.5}
.cdie{fill:${core};fill-opacity:.55;stroke:${core};stroke-width:2${busy ? `;animation:die ${red ? '.7s' : '1.6s'} ease-in-out infinite` : ''}}
@keyframes die{0%,100%{fill-opacity:.35}50%{fill-opacity:.85}}
.cmark{fill:none;stroke:${ground};stroke-width:3;stroke-opacity:.6}
.cg{${busy ? `animation:die ${red ? '.7s' : '1.6s'} ease-in-out infinite` : 'opacity:.5'}}
${ALERT_EDGE_CSS}
${PHASE_CSS}
</style>
<defs>
<radialGradient id="cg"><stop offset="0" stop-color="${core}" stop-opacity=".18"/><stop offset=".35" stop-color="${core}" stop-opacity=".03"/><stop offset="1" stop-color="${core}" stop-opacity="0"/></radialGradient>
<linearGradient id="fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ground}"/><stop offset=".2" stop-color="${ground}" stop-opacity=".9"/><stop offset=".45" stop-color="${ground}" stop-opacity="0"/></linearGradient>
<radialGradient id="hz" cx=".5" cy=".72" r=".75"><stop offset="0" stop-color="${haze}" stop-opacity=".75"/><stop offset="1" stop-color="${haze}" stop-opacity="0"/></radialGradient>
<radialGradient id="vg" cx=".5" cy=".6" r=".8"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient>
<radialGradient id="r" cx=".5" cy=".5" r=".72"><stop offset=".6" stop-color="#ff1a3c" stop-opacity="0"/><stop offset="1" stop-color="#ff1a3c" stop-opacity=".9"/></radialGradient>
<g id="t"><path class="c" d="${BAND.traces}"/><path class="pd" d="${BAND.pads}"/><path class="d" d="${BAND.dots}"/><g class="v">${BAND.vias}</g>${BAND.pulses}</g>
</defs>
<rect width="1600" height="1000" fill="${ground}"/>
<g class="all">
<rect width="1600" height="1000" fill="url(#hz)"/>
<g class="fly">${COPIES}</g>
<rect width="1600" height="1000" fill="url(#fog)"/>
<rect width="1600" height="1000" fill="url(#vg)"/>
<path class="corner" d="M30 90V30H90M1570 90V30H1510"/>
${chip}
${flash}
</g>
</svg>`
}

// Scene "horizon": a star field over a perspective grid floor that runs to a glowing
// horizon. Busy: it fades in, the floor rolls toward the viewer, the stars drift and the
// horizon pulses. Idle: it fades out. Alert: everything goes red and the edges flash.

// Fixed star positions from a small seeded generator, so every draw is the same sky.
const HZ_STARS = (() => {
  let seed = 7
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const stars: { x: number; y: number; r: number; twinkle: boolean }[] = []
  for (let i = 0; i < 140; i += 1) {
    stars.push({ x: Math.round(rand() * 1600), y: Math.round(rand() * 560), r: 0.6 + rand() * 1.4, twinkle: rand() < 0.25 })
  }
  return stars
})()

const HZ_LINE = 620
const HZ_VANISH = 800

const horizonScene = (mode: Mode, act: Activity) => {
  const busy = mode !== 'idle'
  const red = mode === 'alert'
  // A deep electric blue for every line: the rays, the rolling floor, the horizon, the corners.
  const main = red ? '#ff3355' : '#3b82ff'
  // The activity colour: the glowing band along the horizon and the corner label.
  const second = red ? '#ff8a3d' : ACTIVITY_COLOR[act]
  const band = red ? main : second
  const skyTop = red ? '#0a0306' : '#03050c'
  const skyLow = red ? '#2a0710' : '#08203a'
  const floorSeconds = red ? 3 : busy ? 6 : 14
  const floorSpeed = `${floorSeconds}s`

  // The sky's middle, behind the conversation, looks frosted: its stars are drawn as soft
  // glows (no blur filter, which would be redrawn every frame) under a light tint. The
  // floor is left sharp; the app's own glass is off for this scene (see lookFor).
  const stars = HZ_STARS.map(s => {
    const off = Math.abs(s.x - HZ_VANISH)
    const soft = off < 300 ? 3 : off < 400 ? 2 : 1
    return soft === 1
      ? `<circle${s.twinkle ? ' class="tw"' : ''} cx="${s.x}" cy="${s.y}" r="${s.r.toFixed(1)}"/>`
      : `<circle${s.twinkle ? ' class="tw"' : ''} cx="${s.x}" cy="${s.y}" r="${(s.r * soft).toFixed(1)}" fill="url(#soft)"/>`
  }).join('')

  // Rays from the vanishing point to the bottom edge, spread wide so the floor fills the window.
  const rays = Array.from({ length: 25 }, (_, i) => {
    const x = HZ_VANISH + (i - 12) * 260
    return `<line x1="${HZ_VANISH}" y1="${HZ_LINE}" x2="${x}" y2="1000"/>`
  }).join('')

  // Floor lines start at the horizon and accelerate toward the viewer, staggered, which reads as perspective.
  const lines = Array.from({ length: 10 }, (_, i) => `<line class="fl" style="--d:-${((i * floorSeconds) / 10).toFixed(2)}s" x1="0" x2="1600" y1="${HZ_LINE}" y2="${HZ_LINE}"/>`).join('')

  const flash = red ? '<rect class="flash" width="1600" height="1000" fill="url(#r)"/>' : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
.stars{fill:#d8f6ff;fill-opacity:.85${busy ? ';animation:drift 18s linear infinite alternate' : ''}}
@keyframes drift{to{transform:translateX(-60px)}}
.tw{animation:tw ${busy ? '1.2s' : '4s'} ease-in-out infinite}
.tw:nth-child(3n){--d:-1.3s}.tw:nth-child(3n+1){--d:-2.6s}
@keyframes tw{0%,100%{opacity:.25}50%{opacity:1}}
.rays line{stroke:${main};stroke-opacity:${busy ? '.55' : '.4'};stroke-width:1.5}
.fl{stroke:${main};stroke-width:1.5;animation:fl ${floorSpeed} cubic-bezier(.6,0,1,.4) infinite}
@keyframes fl{from{transform:translateY(0);stroke-opacity:.15}to{transform:translateY(${1000 - HZ_LINE}px);stroke-opacity:.75}}
.hz{stroke:${main};stroke-width:2.5;stroke-opacity:.95}
.pulse{animation:pulse ${red ? '.9s' : busy ? '2.6s' : '4s'} ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:.5}50%{opacity:.67}}
.corner{fill:none;stroke:${main};stroke-opacity:.75;stroke-width:2}
.blink{animation:blink 1s steps(2) infinite}
@keyframes blink{50%{opacity:0}}
${ALERT_EDGE_CSS}
${fadeFor(mode)}
${PHASE_CSS}
</style>
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skyTop}"/><stop offset=".75" stop-color="${skyTop}"/><stop offset="1" stop-color="${skyLow}"/></linearGradient>
<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skyLow}"/><stop offset=".25" stop-color="${skyTop}"/><stop offset="1" stop-color="#000"/></linearGradient>
<linearGradient id="glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${band}" stop-opacity="0"/><stop offset=".5" stop-color="${band}" stop-opacity="${busy ? '.5' : '.3'}"/><stop offset="1" stop-color="${band}" stop-opacity="0"/></linearGradient>
<radialGradient id="r" cx=".5" cy=".5" r=".72"><stop offset=".6" stop-color="#ff1a3c" stop-opacity="0"/><stop offset="1" stop-color="#ff1a3c" stop-opacity=".9"/></radialGradient>
<clipPath id="fc"><rect y="${HZ_LINE}" width="1600" height="${1000 - HZ_LINE}"/></clipPath>
<radialGradient id="soft"><stop offset="0" stop-color="#d8f6ff" stop-opacity=".9"/><stop offset=".45" stop-color="#d8f6ff" stop-opacity=".35"/><stop offset="1" stop-color="#d8f6ff" stop-opacity="0"/></radialGradient>
<linearGradient id="frost" x1="0" y1="0" x2="1" y2="0"><stop offset=".24" stop-color="#03061a" stop-opacity="0"/><stop offset=".33" stop-color="#03061a" stop-opacity=".35"/><stop offset=".67" stop-color="#03061a" stop-opacity=".35"/><stop offset=".76" stop-color="#03061a" stop-opacity="0"/></linearGradient>
</defs>
<rect width="1600" height="1000" fill="#03050c"/>
<g class="all">
<rect width="1600" height="${HZ_LINE}" fill="url(#sky)"/>
<g class="stars">${stars}</g>
<rect width="1600" height="${HZ_LINE}" fill="url(#frost)"/>
<rect y="${HZ_LINE}" width="1600" height="${1000 - HZ_LINE}" fill="url(#floor)"/>
<g clip-path="url(#fc)"><g class="rays">${rays}</g>${lines}</g>
<rect class="pulse" y="${HZ_LINE - 40}" width="1600" height="80" fill="url(#glow)"/>
<line class="hz" x1="0" y1="${HZ_LINE}" x2="1600" y2="${HZ_LINE}"/>
<path class="corner" d="M30 90V30H90M1570 90V30H1510"/>
${flash}
</g>
</svg>`
}

// Scene "data-room" (first called "digital"): a deep blue data room. A faint grid wall with columns of data marks
// drifting up, two soft blue glows, and on the floor straight lines fanning out from the
// horizon and off the screen, with magenta pulses running down them. Busy: it fades in
// and moves. Idle: it fades out. Alert: it turns red and the pulses run faster.
// The horizon sits where the "horizon" scene's does.
const DG_HORIZON = HZ_LINE
const DG_VANISH = 800
// The soft band sweeping down the wall now and then (false hides it).
const DG_SCAN = true

const DG_PARTS = (() => {
  let seed = 9091
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  // Floor lines: straight, from points along the horizon near the middle, fanning out
  // past the bottom and side edges of the screen. Six a side, evenly spaced; none cross,
  // and none runs straight down the middle.
  const traces: { d: string }[] = []
  for (let side = -1; side <= 1; side += 2) {
    for (let j = 0; j < 6; j += 1) {
      const x0 = DG_VANISH + side * (12 + j * 16)
      const y0 = DG_HORIZON + 4
      const x1 = DG_VANISH + side * (170 + j * 270)
      traces.push({ d: `M${x0.toFixed(0)} ${y0}L${x1.toFixed(0)} 1080` })
    }
  }
  // Data columns across the whole wall. Each reads like a readout:
  // indented bars of three strengths, key/value pairs, bulleted rows, tiny hex words, now
  // and then a bright or magenta mark. One copy is 520 high and is drawn twice to loop.
  const HEX = '0123456789ABCDEF'
  const hex = (n: number) => Array.from({ length: n }, () => HEX[Math.floor(rand() * 16)] ?? '0').join('')
  const columns: { x: number; inner: string; label: string; fast: boolean }[] = []
  for (let c = 0; c < 14; c += 1) {
    const x = Math.round(50 + c * 108 + rand() * 20)
    const left = x < 800
    const parts: string[] = []
    let indent = 0
    for (let y = 0; y < 512; y += 11 + Math.round(rand() * 7)) {
      const roll = rand()
      if (roll < 0.12) {
        indent = [0, 8, 16][Math.floor(rand() * 3)] ?? 0
        continue
      }
      const tone = rand() < 0.08 ? 'br' : rand() < 0.04 ? 'mg' : `o${1 + Math.floor(rand() * 3)}`
      if (roll < 0.22) {
        parts.push(`<text class="hx" x="${indent}" y="${y + 3}">${hex(2)} ${hex(2 + Math.floor(rand() * 3))}</text>`)
      } else if (roll < 0.48) {
        const a = 6 + Math.round(rand() * 16)
        const b = 4 + Math.round(rand() * 22)
        parts.push(`<rect class="${tone}" x="${indent}" y="${y}" width="${a}" height="2"/><rect class="o1" x="${indent + a + 5}" y="${y}" width="${b}" height="2"/>`)
      } else if (roll < 0.6) {
        parts.push(`<rect class="br" x="${indent}" y="${y - 1}" width="3" height="3"/><rect class="${tone}" x="${indent + 6}" y="${y}" width="${8 + Math.round(rand() * 30)}" height="2"/>`)
      } else if (roll < 0.68) {
        // A tiny bar chart: five thin bars standing on the row.
        const bars = Array.from({ length: 5 }, (_, k) => {
          const tall = 2 + Math.round(rand() * 8)
          return `<rect class="${k === 4 ? tone : 'o2'}" x="${indent + k * 4}" y="${y + 2 - tall}" width="2" height="${tall}"/>`
        })
        parts.push(bars.join(''))
        y += 4
      } else if (roll < 0.75) {
        // A small gauge: an outline with a filled share.
        const w = 30 + Math.round(rand() * 14)
        parts.push(`<rect class="gb" x="${indent}" y="${y - 1}" width="${w}" height="4"/><rect class="${tone}" x="${indent + 1}" y="${y}" width="${Math.round((w - 2) * (0.15 + rand() * 0.8))}" height="2"/>`)
      } else {
        parts.push(`<rect class="${tone}" x="${indent}" y="${y}" width="${6 + Math.round(rand() * (52 - indent))}" height="2"/>`)
      }
    }
    columns.push({ x, inner: parts.join(''), label: `${left ? 'L' : 'R'}${hex(1)}.${String(c).padStart(2, '0')}`, fast: c % 3 === 1 })
  }
  // Short vertical sparks scattered over the wall.
  const sparks = Array.from({ length: 26 }, () => ({
    x: Math.round(60 + rand() * 1480),
    y: Math.round(90 + rand() * 500),
    tall: Math.round(8 + rand() * 26),
  }))
  return { traces, columns, sparks }
})()

const dataRoomScene = (mode: Mode, act: Activity) => {
  const busy = mode !== 'idle'
  const red = mode === 'alert'
  const main = red ? '#ff3355' : '#3d7bff'
  const line = red ? '#ff6b7f' : '#5aa8ff'
  // The activity colour: the pulses running down the floor lines, and the corner label.
  const pulse = red ? '#ffd0d6' : ACTIVITY_COLOR[act]
  const deep = red ? '#14040a' : '#030a26'
  const mid = red ? '#3a0a18' : '#0a1f6e'
  const drift = red ? 26 : 48
  const run = red ? 3.5 : 7

  const n0 = (v: number) => v.toFixed(0)
  const traces = DG_PARTS.traces.map(t => `<path d="${t.d}"/>`).join('')
  // A pulse on every line, each starting at its own time, scattered so neighbours differ.
  const pulses = DG_PARTS.traces
    .map((t, i) => `<path class="pu" pathLength="1000" style="--d:-${(((i * 0.618) % 1) * run).toFixed(2)}s" d="${t.d}"/>`)
    .join('')
  // The readouts scroll as two layers only, the slow columns and the fast ones, each one
  // animated group (one moving layer per speed instead of one per column keeps it light).
  // Each layer holds its columns twice, the copy 520 lower, so the loop has no seam.
  const layer = (fast: boolean) => {
    const set = DG_PARTS.columns
      .filter(c => c.fast === fast)
      .map(c => `<g transform="translate(${c.x} 0)">${c.inner}</g>`)
      .join('')
    return `<g transform="translate(0 100)"><g class="col${fast ? ' fast' : ''}">${set}<g transform="translate(0 520)">${set}</g></g></g>`
  }
  const guides = DG_PARTS.columns
    .map(c => `<line class="gd" x1="${c.x - 6}" y1="100" x2="${c.x - 6}" y2="${DG_HORIZON - 10}"/>`)
    .join('')
  const columns = `${guides}${layer(false)}${layer(true)}`
  const headers = DG_PARTS.columns
    .map(c => `<g transform="translate(${c.x} 76)"><rect class="hd" x="-6" y="0" width="58" height="12" rx="2"/><text class="hl" x="0" y="9">${c.label}</text></g>`)
    .join('')
  const sparks = DG_PARTS.sparks
    .map((s, i) => `<rect${i % 3 === 0 ? ' class="tw"' : ''} x="${s.x}" y="${s.y}" width="2" height="${s.tall}"/>`)
    .join('')
  const floorLines = Array.from({ length: 12 }, (_, k) => {
    const y = DG_HORIZON + 360 * ((k + 1) / 12) ** 2
    return `<line x1="0" x2="1600" y1="${n0(y)}" y2="${n0(y)}"/>`
  }).join('')
  const flash = red ? '<rect class="flash" width="1600" height="1000" fill="url(#dr)"/>' : ''

  // Cropped like the "horizon" scene (centred), so both horizons sit at the same height.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
.grid{stroke:${line};stroke-opacity:.07;stroke-width:1}
.col rect{fill:${line}}
.col .o1{fill-opacity:.22}.col .o2{fill-opacity:.42}.col .o3{fill-opacity:.65}
.col .br{fill:#e8f2ff;fill-opacity:.85}
.col .mg{fill:${pulse};fill-opacity:.85}
.col .gb{fill:none;stroke:${line};stroke-opacity:.35;stroke-width:1}
.hx{font:9px monospace;fill:${line};fill-opacity:.55;letter-spacing:1px}
.gd{stroke:${line};stroke-opacity:.12;stroke-width:1;stroke-dasharray:2 6}
.hd{fill:${line};fill-opacity:.12;stroke:${line};stroke-opacity:.35}
.hl{font:bold 8px monospace;fill:#e8f2ff;fill-opacity:.7;letter-spacing:1px}
.scan{${busy ? `animation:scan ${red ? 5 : 11}s linear infinite` : 'opacity:0'}}
@keyframes scan{from{transform:translateY(-80px)}to{transform:translateY(${DG_HORIZON - 20}px)}}
.col{${busy ? `animation:up ${drift}s linear infinite` : ''}}
.col.fast{${busy ? `animation-duration:${Math.round(drift * 0.65)}s` : ''}}
@keyframes up{to{transform:translateY(-520px)}}
.sp rect{fill:#dff0ff;fill-opacity:.55}
.tw{animation:tw ${busy ? '2.4s' : '6s'} ease-in-out infinite}
.tw:nth-child(2n){--d:-1.2s}
@keyframes tw{0%,100%{opacity:.15}50%{opacity:1}}
.fg{stroke:${line};stroke-opacity:.12;stroke-width:1}
.tr{fill:none;stroke:${line};stroke-opacity:.75;stroke-width:3;stroke-linejoin:round}
.pu{fill:none;stroke:${pulse};stroke-width:4;stroke-linecap:round;stroke-dasharray:28 1000;stroke-dashoffset:1028;${busy ? `animation:run ${run}s linear infinite` : 'opacity:0'}}
@keyframes run{to{stroke-dashoffset:0}}
.glow{animation:breathe ${busy ? '6s' : '12s'} ease-in-out infinite}
@keyframes breathe{0%,100%{opacity:.7}50%{opacity:1}}
.blink{animation:blink 1s steps(2) infinite}
@keyframes blink{50%{opacity:0}}
${ALERT_EDGE_CSS}
${fadeFor(mode)}
${PHASE_CSS}
</style>
<defs>
<radialGradient id="dbg" cx=".5" cy=".45" r=".75"><stop offset="0" stop-color="${mid}"/><stop offset="1" stop-color="${deep}"/></radialGradient>
<radialGradient id="dgl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${main}" stop-opacity=".55"/><stop offset="1" stop-color="${main}" stop-opacity="0"/></radialGradient>
<linearGradient id="dfl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${deep}"/><stop offset="1" stop-color="#01030a"/></linearGradient>
<linearGradient id="dtop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${deep}" stop-opacity=".45"/><stop offset="1" stop-color="${deep}" stop-opacity="0"/></linearGradient>
<linearGradient id="dbot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${deep}" stop-opacity="0"/><stop offset="1" stop-color="${deep}" stop-opacity=".8"/></linearGradient>
<linearGradient id="dhz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${main}" stop-opacity="0"/><stop offset=".5" stop-color="${main}" stop-opacity=".35"/><stop offset="1" stop-color="${main}" stop-opacity="0"/></linearGradient>
<radialGradient id="dr" cx=".5" cy=".5" r=".72"><stop offset=".6" stop-color="#ff1a3c" stop-opacity="0"/><stop offset="1" stop-color="#ff1a3c" stop-opacity=".9"/></radialGradient>
<pattern id="dgp" width="40" height="40" patternUnits="userSpaceOnUse"><path class="grid" d="M40 0H0V40" fill="none"/></pattern>
<clipPath id="dwall"><rect y="90" width="1600" height="${DG_HORIZON - 110}"/></clipPath>
</defs>
<rect width="1600" height="1000" fill="${deep}"/>
<g class="all">
<rect width="1600" height="${DG_HORIZON}" fill="url(#dbg)"/>
<rect width="1600" height="${DG_HORIZON}" fill="url(#dgp)"/>
<g class="glow"><ellipse cx="260" cy="260" rx="420" ry="300" fill="url(#dgl)"/><ellipse cx="1380" cy="320" rx="380" ry="280" fill="url(#dgl)"/></g>
<g clip-path="url(#dwall)">${columns}${DG_SCAN ? '<rect class="scan" x="0" y="0" width="1600" height="80" fill="url(#dhz)" opacity=".5"/>' : ''}</g>
<rect x="0" y="90" width="1600" height="30" fill="url(#dtop)"/>
<rect x="0" y="${DG_HORIZON - 70}" width="1600" height="50" fill="url(#dbot)"/>
${headers}
<g class="sp">${sparks}</g>
<rect y="${DG_HORIZON}" width="1600" height="${1000 - DG_HORIZON}" fill="url(#dfl)"/>
<g class="fg">${floorLines}</g>
<rect class="glow" y="${DG_HORIZON - 30}" width="1600" height="60" fill="url(#dhz)"/>
<g class="tr">${traces}</g>
${pulses}
${flash}
</g>
</svg>`
}

// Scene "code rain": streams of half-width katakana, digits and code symbols falling down
// a dark blue screen, in three layers (far: small, dim and slow; near: large, bright and
// fast). Each stream fades in from its tail to a bright head in the activity colour.
// Busy: it fades in and falls. Idle: it fades out. Alert: it turns red and falls faster.
//
// Kept light: the glyphs never change, only the three layers move (one animated group
// each). Every stream is drawn twice, RN_PERIOD apart, so the fall loops without a seam.
const RN_PERIOD = 1000
const RN_GLYPHS = 'ｦｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789{}<>=;:+*#/[]()$|'
// Per layer: glyph size and spacing, how faint, and seconds to fall one period.
const RN_LAYERS = [
  { name: 'far', size: 13, step: 15, fall: 16 },
  { name: 'mid', size: 17, step: 20, fall: 10 },
  { name: 'near', size: 22, step: 26, fall: 6.5 },
] as const
const RN_PARTS = (() => {
  let seed = 4242
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const esc = (c: string) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : c)
  const glyph = () => esc(RN_GLYPHS[Math.floor(rand() * RN_GLYPHS.length)] ?? '0')
  // 20 column slots across the screen, each given to one layer, mixed so neighbours differ;
  // one short stream per column. The far layer draws thin dashes instead of characters
  // (from that far they read the same, and cost far less to draw).
  const layers: string[][] = RN_LAYERS.map(() => [])
  for (let k = 0; k < 20; k += 1) {
    const which = [0, 2, 1, 0, 1, 2, 1, 0][k % 8] ?? 0
    const spec = RN_LAYERS[which] ?? RN_LAYERS[0]
    const x = Math.round(30 + k * 80 + rand() * 24)
    const top = Math.round(rand() * RN_PERIOD)
    const length = 6 + Math.floor(rand() * 6)
    // Tail to head: faint to strong, then the second glyph and the head.
    const cls = (i: number) => (i === length - 1 ? 'h' : i === length - 2 ? 'w' : `o${1 + Math.floor((i / (length - 2)) * 4)}`)
    const stream =
      which === 0
        ? Array.from({ length }, (_, i) => `<rect class="${cls(i)}" x="0" y="${top + i * spec.step - 9}" width="3" height="9"/>`).join('')
        : `<text>${Array.from({ length }, (_, i) => `<tspan x="0" y="${top + i * spec.step}" class="${cls(i)}">${glyph()}</tspan>`).join('')}</text>`
    layers[which]?.push(`<g transform="translate(${x} 0)">${stream}<g transform="translate(0 -${RN_PERIOD})">${stream}</g></g>`)
  }
  return layers.map(cols => cols.join(''))
})()

const rainScene = (mode: Mode, act: Activity) => {
  const busy = mode !== 'idle'
  const red = mode === 'alert'
  const line = red ? '#ff5a72' : '#4d8dff'
  const pale = red ? '#ffd0d6' : '#d6e6ff'
  const head = red ? '#ffffff' : ACTIVITY_COLOR[act]
  // The ground: black at the top to blue at the bottom.
  const deep = '#000000'
  const low = red ? '#3a0a18' : '#0a2a8c'
  const speed = red ? 0.55 : 1
  const flash = red ? '<rect class="flash" width="1600" height="1000" fill="url(#rr)"/>' : ''
  const layers = RN_LAYERS.map((spec, i) => `<g class="ly ${spec.name}">${RN_PARTS[i] ?? ''}</g>`).join('')
  const layerCss = RN_LAYERS.map(
    spec =>
      `.${spec.name}{font-size:${spec.size}px${busy ? `;animation:fall ${(spec.fall * speed).toFixed(2)}s linear infinite` : ''}}`,
  ).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
.ly{font-family:'MS Gothic','Yu Gothic','Meiryo',monospace;fill:${line}}
.far{opacity:.45}.mid{opacity:.7}
${layerCss}
@keyframes fall{to{transform:translateY(${RN_PERIOD}px)}}
.o1{fill-opacity:.12}.o2{fill-opacity:.28}.o3{fill-opacity:.48}.o4{fill-opacity:.7}.o5{fill-opacity:.85}
.w{fill:${red ? pale : head};fill-opacity:.7}
.h{fill:${head}}
.corner{fill:none;stroke:${line};stroke-opacity:.6;stroke-width:2}
.blink{animation:blink 1s steps(2) infinite}
@keyframes blink{50%{opacity:0}}
${ALERT_EDGE_CSS}
${fadeFor(mode)}
${PHASE_CSS}
</style>
<defs>
<linearGradient id="rbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${deep}"/><stop offset=".35" stop-color="${deep}"/><stop offset="1" stop-color="${low}"/></linearGradient>
<linearGradient id="rtop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${deep}" stop-opacity=".9"/><stop offset="1" stop-color="${deep}" stop-opacity="0"/></linearGradient>
<radialGradient id="rr" cx=".5" cy=".5" r=".72"><stop offset=".6" stop-color="#ff1a3c" stop-opacity="0"/><stop offset="1" stop-color="#ff1a3c" stop-opacity=".9"/></radialGradient>
</defs>
<rect width="1600" height="1000" fill="${deep}"/>
<g class="all">
<rect width="1600" height="1000" fill="url(#rbg)"/>
${layers}
<rect width="1600" height="140" fill="url(#rtop)"/>
<path class="corner" d="M30 90V30H90M1570 90V30H1510"/>
${flash}
</g>
</svg>`
}

// Scene "signal": an oscilloscope. Three waves slide across a faint grid on a ground going
// from black at the top to blue at the bottom, with dots fading in and out around them.
// The front wave, a few bright blips running along it, some dots and the corner label take
// the activity colour. Busy: it fades in and moves. Idle: it fades out. Alert: it turns red,
// the front wave goes jagged and everything runs faster.
//
// Kept light: three moving lines, one moving dash pattern and the dots' opacity; no text
// besides the label. Each wave is drawn one wavelength wider than the screen and slides by
// one wavelength, so the loop has no seam.
const SG_MID = 560
const SG_PARTS = (() => {
  let seed = 5150
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const dots = Array.from({ length: 28 }, (_, i) => ({
    x: Math.round(40 + rand() * 1520),
    y: Math.round(120 + rand() * 820),
    r: (1.6 + rand() * 2).toFixed(1),
    tint: i % 5 === 0,
    d: (rand() * 3.6).toFixed(2),
    s: (1.8 + rand() * 1.8).toFixed(1),
  }))
  return { dots }
})()
// A wave across the screen and one wavelength more: smooth, or jagged (for the alert).
const sgWave = (amp: number, length: number, phase: number, jagged = false) => {
  const points: [number, number][] = []
  // A jagged wave starts one corner early, so its first rounded corner is already on screen.
  for (let x = jagged ? -length / 8 : 0; x <= 1600 + length; x += length / (jagged ? 8 : 16)) {
    const a = (x / length) * Math.PI * 2 + phase
    // A small second harmonic gives the wave some character; both repeat every
    // wavelength, so the slide loops cleanly.
    const y = jagged
      ? ((x / (length / 8)) % 2 === 0 ? 1 : -1) * amp * 1.3 * (0.4 + 0.6 * Math.abs(Math.sin(a)))
      : amp * (Math.sin(a) + 0.1 * Math.sin(2 * a + 1)) * 0.95
    points.push([x, SG_MID + y])
  }
  const at = ([x, y]: [number, number]) => `${x.toFixed(0)} ${y.toFixed(1)}`
  if (!jagged) {
    return curveThrough(points)
  }
  // Jagged, with rounded peaks: a curve from midpoint to midpoint, bent by each peak.
  const mid = (p: [number, number], q: [number, number]): [number, number] => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
  const first = points[0] ?? [0, SG_MID]
  let d = `M${at(first)}`
  for (let i = 1; i < points.length - 1; i += 1) {
    const p = points[i] ?? first
    d += `Q${at(p)} ${at(mid(p, points[i + 1] ?? p))}`
  }
  return `${d}L${at(points[points.length - 1] ?? first)}`
}

const signalScene = (mode: Mode, act: Activity) => {
  const busy = mode !== 'idle'
  const red = mode === 'alert'
  const line = red ? '#ff5a72' : '#3d7bff'
  const soft = red ? '#ff8a9a' : '#5aa8ff'
  const front = red ? '#ff3355' : ACTIVITY_COLOR[act]
  const low = red ? '#3a0a18' : '#0a2a8c'
  const speed = red ? 0.5 : 1
  const run = (seconds: number) => (busy ? `animation:slide ${(seconds * speed).toFixed(2)}s linear infinite` : '')
  const flash = red ? '<rect class="flash" width="1600" height="1000" fill="url(#sr)"/>' : ''
  const dots = SG_PARTS.dots
    .map(d => `<circle class="dt${d.tint ? ' tn' : ''}" style="--d:-${d.d}s;animation-duration:${d.s}s" cx="${d.x}" cy="${d.y}" r="${d.r}"/>`)
    .join('')
  const back = sgWave(70, 800, 0)
  const middle = sgWave(42, 400, 1.3)
  const lead = sgWave(red ? 90 : 110, 800, 2.4, red)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
.grid{stroke:${line};stroke-opacity:.08;stroke-width:1}
.axis{stroke:${line};stroke-opacity:.25;stroke-width:1;stroke-dasharray:4 8}
.wv{fill:none;stroke-linejoin:round;stroke-linecap:round}
.w1{stroke:${line};stroke-opacity:.45;stroke-width:2;${run(14)}}
.w2{stroke:${soft};stroke-opacity:.35;stroke-width:1.5;${busy ? `animation:slide2 ${(9 * speed).toFixed(2)}s linear infinite` : ''}}
.w3{stroke:${front};stroke-opacity:.9;stroke-width:3;${run(6)}}
.bl{stroke:#ffffff;stroke-width:5;stroke-dasharray:3 497;${busy ? `animation:blip ${(8 * speed).toFixed(2)}s linear infinite` : 'opacity:0'}}
@keyframes slide{to{transform:translateX(-800px)}}
@keyframes slide2{to{transform:translateX(-400px)}}
@keyframes blip{to{stroke-dashoffset:-500}}
.dt{fill:#cfe0ff;animation:tw 5s ease-in-out infinite}
.tn{fill:${front}}
@keyframes tw{0%,100%{opacity:0}50%{opacity:.8}}
.corner{fill:none;stroke:${line};stroke-opacity:.6;stroke-width:2}
.blink{animation:blink 1s steps(2) infinite}
@keyframes blink{50%{opacity:0}}
${ALERT_EDGE_CSS}
${fadeFor(mode)}
${PHASE_CSS}
</style>
<defs>
<linearGradient id="sbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000000"/><stop offset=".35" stop-color="#000000"/><stop offset="1" stop-color="${low}"/></linearGradient>
<pattern id="sgp" width="80" height="80" patternUnits="userSpaceOnUse"><path class="grid" d="M80 0H0V80" fill="none"/></pattern>
<radialGradient id="sr" cx=".5" cy=".5" r=".72"><stop offset=".6" stop-color="#ff1a3c" stop-opacity="0"/><stop offset="1" stop-color="#ff1a3c" stop-opacity=".9"/></radialGradient>
</defs>
<rect width="1600" height="1000" fill="#000000"/>
<g class="all">
<rect width="1600" height="1000" fill="url(#sbg)"/>
<rect width="1600" height="1000" fill="url(#sgp)"/>
<line class="axis" x1="0" y1="${SG_MID}" x2="1600" y2="${SG_MID}"/>
<g>${dots}</g>
<path class="wv w1" d="${back}"/>
<path class="wv w2" d="${middle}"/>
<g class="w3"><path class="wv" d="${lead}"/><path class="wv bl" pathLength="1000" d="${lead}"/></g>
<path class="corner" d="M30 90V30H90M1570 90V30H1510"/>
${flash}
</g>
</svg>`
}

// The light scenes (cream paper, dark ink): the activity colour as ink, deep enough to
// read on paper, and the red of an alert.
const ACTIVITY_INK: Record<Activity, string> = {
  think: '#6d28d9',
  files: '#b45309',
  run: '#047857',
  web: '#be185d',
}
const PAPER = '#f3ead6'
const PAPER_ALERT = '#f7e2da'
// A light scene's alert: the paper warms and a soft red vignette rises at the edges.
const paperFlash = (id: string) =>
  `<radialGradient id="${id}" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#c0392b" stop-opacity="0"/><stop offset="1" stop-color="#c0392b" stop-opacity=".55"/></radialGradient>`

// Scene "ink plotter": plain cream paper with contour lines drifting slowly
// across it like a moving map. One contour is in the activity colour and a pen head travels
// along it, inking it as it goes. Alert: the ink turns red and the paper warms.
//
// Every contour repeats every 800 px, and the whole sheet slides by 800 px, so the drift
// loops without a seam. The pen and the inked line run on one 12 s clock.
const IP_WAVE = 800
const ipContour = (row: number) => {
  const base = 120 + row * 95
  const amp = 26 + (row % 3) * 9
  const points: XY[] = []
  for (let x = 0; x <= 1600 + IP_WAVE; x += 50) {
    const a = (x / IP_WAVE) * Math.PI * 2
    points.push([x, base + amp * Math.sin(a + row * 0.7) + amp * 0.1 * Math.sin(2 * a + row * 1.9)])
  }
  return curveThrough(points)
}
const IP_ROWS = Array.from({ length: 9 }, (_, row) => ipContour(row))
const IP_PEN_ROW = 4

const inkScene = (mode: Mode, act: Activity) => {
  const busy = mode !== 'idle'
  const red = mode === 'alert'
  const ink = red ? '#7a1f2b' : '#1f2f5c'
  const pen = red ? '#c0392b' : ACTIVITY_INK[act]
  const paper = red ? PAPER_ALERT : PAPER
  const drift = busy ? `animation:drift ${red ? 20 : 40}s linear infinite` : ''
  const draw = busy ? `animation:ink ${red ? 6 : 12}s linear infinite` : ''
  const flash = red ? '<rect class="flash" width="1600" height="1000" fill="url(#ipr)"/>' : ''
  const penPath = IP_ROWS[IP_PEN_ROW] ?? ''
  const lines = IP_ROWS.map((d, row) => (row === IP_PEN_ROW ? '' : `<path class="ct" d="${d}"/>`)).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
.ct{fill:none;stroke:${ink};stroke-opacity:.2;stroke-width:1.1}
.sheet{${drift}}
.ghost{fill:none;stroke:${pen};stroke-opacity:.08;stroke-width:2}
.inked{fill:none;stroke:${pen};stroke-opacity:.45;stroke-width:2.4;stroke-linecap:round;stroke-dasharray:1000 1000;stroke-dashoffset:1000;${draw}}
.pen{fill:${pen};fill-opacity:.6;offset-path:path('${penPath}');offset-rotate:0deg;offset-distance:0%;${busy ? `animation:pen ${red ? 6 : 12}s linear infinite` : 'opacity:0'}}
@keyframes drift{to{transform:translateX(-${IP_WAVE}px)}}
@keyframes ink{to{stroke-dashoffset:0}}
@keyframes pen{to{offset-distance:100%}}
${ALERT_EDGE_CSS}
${fadeFor(mode)}
${PHASE_CSS}
</style>
<defs>
${paperFlash('ipr')}
</defs>
<rect width="1600" height="1000" fill="${paper}"/>
<g class="all">
<g class="sheet">
${lines}
<path class="ghost" d="${penPath}"/>
<path class="inked" pathLength="1000" d="${penPath}"/>
<circle class="pen" r="6"/>
</g>
${flash}
</g>
</svg>`
}

// Scene "halftone tide": cream paper printed with a dot screen, like an old newspaper
// photo. Two wave-shaped bands slide across it: inside the wide one the dots are bigger,
// inside the narrow one bigger still and in the activity colour, so the dots seem to swell
// as the tide passes. Alert: the tide runs faster and turns red.
//
// Cheap to draw: the dots are three fixed patterns, and only the two band shapes move,
// as masks. Both bands repeat every 800 px and slide by 800 px, so the loop has no seam.
const HT_STEP = 26
const htBand = (mid: number, amp: number, half: number, phase: number) => {
  const top: XY[] = []
  const bottom: XY[] = []
  for (let x = 0; x <= 1600 + IP_WAVE; x += 50) {
    const a = (x / IP_WAVE) * Math.PI * 2 + phase
    const y = mid + amp * Math.sin(a) + amp * 0.1 * Math.sin(2 * a + 1)
    // The band swells a little and thins again, gently, so its edges keep the flow.
    const lift = half * (0.9 + 0.1 * Math.sin(a + phase + 1.2))
    top.push([x, y - lift])
    bottom.unshift([x, y + lift])
  }
  return `${curveThrough(top)}${curveThrough(bottom, 'L')}Z`
}
const HT_WIDE = htBand(520, 150, 190, 0)
const HT_CORE = htBand(520, 150, 52, 0)

const halftoneScene = (mode: Mode, act: Activity) => {
  const busy = mode !== 'idle'
  const red = mode === 'alert'
  const ink = red ? '#7a1f2b' : '#1f2f5c'
  const tide = red ? '#c0392b' : ACTIVITY_INK[act]
  const paper = red ? PAPER_ALERT : PAPER
  const slide = (seconds: number) => (busy ? `animation:tide ${(red ? seconds / 2 : seconds).toFixed(1)}s linear infinite` : '')
  const flash = red ? '<rect class="flash" width="1600" height="1000" fill="url(#htr)"/>' : ''
  const dotAt = (r: number, fill: string, opacity: number) =>
    `<circle cx="${HT_STEP / 2}" cy="${HT_STEP / 2}" r="${r}" fill="${fill}" fill-opacity="${opacity}"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
.wide{${slide(30)}}
.core{${slide(18)}}
@keyframes tide{to{transform:translateX(-${IP_WAVE}px)}}
${ALERT_EDGE_CSS}
${fadeFor(mode)}
${PHASE_CSS}
</style>
<defs>
<pattern id="hts" width="${HT_STEP}" height="${HT_STEP}" patternUnits="userSpaceOnUse">${dotAt(2.2, ink, 0.1)}</pattern>
<pattern id="htm" width="${HT_STEP}" height="${HT_STEP}" patternUnits="userSpaceOnUse">${dotAt(5, ink, 0.13)}</pattern>
<pattern id="htl" width="${HT_STEP}" height="${HT_STEP}" patternUnits="userSpaceOnUse">${dotAt(6.5, tide, 0.32)}</pattern>
<mask id="htw" maskUnits="userSpaceOnUse" x="0" y="0" width="1600" height="1000"><path class="wide" fill="#fff" d="${HT_WIDE}"/></mask>
<mask id="htc" maskUnits="userSpaceOnUse" x="0" y="0" width="1600" height="1000"><path class="core" fill="#fff" d="${HT_CORE}"/></mask>
${paperFlash('htr')}
</defs>
<rect width="1600" height="1000" fill="${paper}"/>
<g class="all">
<rect width="1600" height="1000" fill="url(#hts)"/>
<rect width="1600" height="1000" fill="${paper}" mask="url(#htw)"/>
<rect width="1600" height="1000" fill="url(#htm)" mask="url(#htw)"/>
<rect width="1600" height="1000" fill="${paper}" mask="url(#htc)"/>
<rect width="1600" height="1000" fill="url(#htl)" mask="url(#htc)"/>
${flash}
</g>
</svg>`
}

// Scene "digital cream": warm ivory with soft ribbons of cream sweeping across, each edged
// with a fine gold line and a fan of hair-thin gold lines beside it, like premium paper.
// A thin line in the activity colour runs along the lower ribbon. Alert: the gold turns
// rose and the ribbons drift faster.
//
// The ribbons repeat every screen width (1600 px) and slide by that much, the top one to
// the left and the lower one to the right, so both drifts loop without a seam.
const DC_WIDTH = 1600
const dcWave = (base: number, amp: number, phase: number) => (x: number) => {
  const a = (x / DC_WIDTH) * Math.PI * 2 + phase
  return base + amp * Math.sin(a) + amp * 0.1 * Math.sin(2 * a + phase * 1.7)
}
const DC_XS = Array.from({ length: 49 }, (_, i) => -DC_WIDTH + i * 100)
const dcLine = (y: (x: number) => number) => curveThrough(DC_XS.map((x): XY => [x, y(x)]))
// The band between two waves, filled.
const dcBand = (upper: (x: number) => number, lower: (x: number) => number) =>
  `${dcLine(upper)}${curveThrough([...DC_XS].reverse().map((x): XY => [x, lower(x)]), 'L')}Z`
// A fan of thin lines spreading between two waves.
const dcFan = (from: (x: number) => number, to: (x: number) => number, count: number) =>
  Array.from({ length: count }, (_, i) => {
    const k = (i + 1) / (count + 1)
    return `<path class="hair" d="${dcLine(x => from(x) + (to(x) - from(x)) * k * k)}"/>`
  }).join('')
const DC_TOP = (() => {
  const a = dcWave(150, 90, 0.4)
  const b = dcWave(330, 120, 1.1)
  const edge = dcWave(345, 120, 1.1)
  return { band: dcBand(dcWave(-80, 60, 0.2), a), soft: dcBand(a, b), edge: dcLine(edge), fan: dcFan(edge, dcWave(230, 100, 0.7), 9) }
})()
const DC_LOW = (() => {
  const a = dcWave(690, 130, 2.3)
  const b = dcWave(860, 110, 2.9)
  const edge = dcWave(700, 130, 2.3)
  return {
    soft: dcBand(a, dcWave(1100, 40, 3)),
    band: dcBand(b, dcWave(1100, 40, 3)),
    edge: dcLine(edge),
    accent: dcLine(dcWave(770, 120, 2.6)),
    fan: dcFan(edge, dcWave(820, 150, 2.0), 11),
  }
})()

const creamScene = (mode: Mode, act: Activity) => {
  const busy = mode !== 'idle'
  const red = mode === 'alert'
  const gold = red ? '#c0563f' : '#c99a2e'
  const hair = red ? '#d98a78' : '#d8b45c'
  const accent = red ? '#c0392b' : ACTIVITY_INK[act]
  const ground = red ? '#fbeee8' : '#fbf6ea'
  const deep = red ? '#f3d9cf' : '#f1e5c9'
  const move = (dir: 'left' | 'right', seconds: number) =>
    busy ? `animation:${dir} ${(red ? seconds / 2 : seconds).toFixed(1)}s linear infinite` : ''
  const flash = red ? '<rect class="flash" width="1600" height="1000" fill="url(#dcr)"/>' : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
.top{${move('left', 90)}}
.low{${move('right', 70)}}
.edge{fill:none;stroke:${gold};stroke-opacity:.7;stroke-width:2.2}
.hair{fill:none;stroke:${hair};stroke-opacity:.38;stroke-width:.9}
.accent{fill:none;stroke:${accent};stroke-opacity:.35;stroke-width:1.6}
@keyframes left{to{transform:translateX(-${DC_WIDTH}px)}}
@keyframes right{to{transform:translateX(${DC_WIDTH}px)}}
${ALERT_EDGE_CSS}
${fadeFor(mode)}
${PHASE_CSS}
</style>
<defs>
<linearGradient id="dcg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${ground}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
<linearGradient id="dcb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${deep}" stop-opacity=".9"/><stop offset="1" stop-color="${deep}" stop-opacity=".35"/></linearGradient>
<linearGradient id="dcw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".75"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
${paperFlash('dcr')}
</defs>
<rect width="1600" height="1000" fill="${ground}"/>
<g class="all">
<rect width="1600" height="1000" fill="url(#dcg)"/>
<g class="top">
<path fill="url(#dcw)" d="${DC_TOP.band}"/>
<path fill="url(#dcb)" d="${DC_TOP.soft}"/>
${DC_TOP.fan}
<path class="edge" d="${DC_TOP.edge}"/>
</g>
<g class="low">
<path fill="url(#dcb)" d="${DC_LOW.soft}"/>
<path fill="url(#dcw)" d="${DC_LOW.band}"/>
${DC_LOW.fan}
<path class="edge" d="${DC_LOW.edge}"/>
<path class="accent" d="${DC_LOW.accent}"/>
</g>
${flash}
</g>
</svg>`
}

// Scene "heartline": a photo studio's backdrop in warm taupe, lit in the middle and dark at
// the corners, with the wall meeting a lighter floor. Along that seam runs one thin line in
// the activity colour, a heart monitor's trace with three beats: a bright stretch sweeps from
// left to right over a faint copy of the whole trace. Alert: the line turns red and the
// heart races.
const ST_SEAM = 758
// One beat, its tall spike on x, all straight strokes like a monitor's trace: a small
// pointed P, a short flat, a deep dip, the tall spike, back to the line, a small pointed T.
const stBeat = (x: number) => {
  const y = ST_SEAM
  const at = (dx: number, dy: number) => `L${x + dx} ${y + dy}`
  return [at(-97, 0), at(-81, -14), at(-67, 0), at(-55, 0), at(-27, 69), at(0, -87), at(22, 0), at(38, -14), at(60, 0)].join('')
}
// Three beats, evenly spaced: one each side of the chat and one behind it.
const ST_TRACE = `M0 ${ST_SEAM}${stBeat(400)}${stBeat(800)}${stBeat(1200)}L1600 ${ST_SEAM}`

const heartlineScene = (mode: Mode, act: Activity) => {
  const busy = mode !== 'idle'
  const red = mode === 'alert'
  const line = red ? '#c0392b' : ACTIVITY_INK[act]
  const flash = red ? '<rect class="flash" width="1600" height="1000" fill="url(#str)"/>' : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
.ghost{fill:none;stroke:${line};stroke-opacity:.14;stroke-width:1.6;stroke-linejoin:miter}
.sweep{fill:none;stroke:${line};stroke-opacity:.75;stroke-width:2;stroke-linejoin:round;stroke-linecap:round;stroke-dasharray:180 1200;stroke-dashoffset:180;${busy ? `animation:sweep ${red ? 1.6 : 3.2}s linear infinite` : 'opacity:0'}}
@keyframes sweep{to{stroke-dashoffset:-1020}}
${ALERT_EDGE_CSS}
${fadeFor(mode)}
${PHASE_CSS}
</style>
<defs>
<radialGradient id="stw" cx=".5" cy=".36" r=".72"><stop offset="0" stop-color="#eee4d8"/><stop offset=".5" stop-color="#cbb9a6"/><stop offset=".85" stop-color="#a08b78"/><stop offset="1" stop-color="#6f5b4a"/></radialGradient>
<linearGradient id="stf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c6b5a3"/><stop offset=".35" stop-color="#ddcfbf"/><stop offset=".6" stop-color="#e6dacc"/><stop offset="1" stop-color="#d2c2b0"/></linearGradient>
<radialGradient id="sts" cx=".5" cy="0" r=".7"><stop offset=".55" stop-color="#5c4a3c" stop-opacity="0"/><stop offset="1" stop-color="#5c4a3c" stop-opacity=".45"/></radialGradient>
<linearGradient id="sth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a6655" stop-opacity="0"/><stop offset="1" stop-color="#7a6655" stop-opacity=".1"/></linearGradient>
${paperFlash('str')}
</defs>
<rect width="1600" height="1000" fill="url(#stw)"/>
<rect y="${ST_SEAM - 140}" width="1600" height="140" fill="url(#sth)"/>
<rect y="${ST_SEAM}" width="1600" height="${1000 - ST_SEAM}" fill="url(#stf)"/>
<rect y="${ST_SEAM}" width="1600" height="${1000 - ST_SEAM}" fill="url(#sts)"/>
${
  mode === 'rest'
    ? ''
    : `<g class="all">
<path class="ghost" d="${ST_TRACE}"/>
<path class="sweep" pathLength="1000" d="${ST_TRACE}"/>
${flash}
</g>`
}
</svg>`
}
// Heartline rests on its bare backdrop, without the line.
const REST_HEART = heartlineScene('rest', 'think')

// After the fade-out: the dark ground alone, so a redraw has nothing to flash.
const REST = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><rect width="1600" height="1000" fill="#03061a"/></svg>'
// The named backgrounds. To add one: write a function drawing it for each mode, add its
// name to SceneName and SCENE_NAMES, its drawings to SCENES and its look to SCENE_LOOK.
type SceneName =
  | 'spotlight'
  | 'circuit'
  | 'horizon'
  | 'data-room'
  | 'code-rain'
  | 'signal'
  | 'ink-plotter'
  | 'halftone-tide'
  | 'digital-cream'
  | 'heartline'
const SCENE_NAMES: readonly SceneName[] = [
  'spotlight',
  'circuit',
  'horizon',
  'data-room',
  'code-rain',
  'signal',
  'ink-plotter',
  'halftone-tide',
  'digital-cream',
  'heartline',
]
// Whether a scene is dark (neon on black), light (ink on cream paper), or follows the app's
// own setting (auto: spotlight, like no background). The app, the band and the dashboard
// take the same look as the scene.
type Look = 'dark' | 'light'
type SceneLook = Look | 'auto'
// How the Scene list marks each look: ◐ follows the app.
const LOOK_MARK: Record<SceneLook, string> = { light: '☀', dark: '☾', auto: '◐' }
const SCENE_LOOK: Record<SceneName, SceneLook> = {
  spotlight: 'auto',
  circuit: 'dark',
  horizon: 'dark',
  'data-room': 'dark',
  'code-rain': 'dark',
  signal: 'dark',
  'ink-plotter': 'light',
  'halftone-tide': 'light',
  'digital-cream': 'light',
  heartline: 'light',
}
// The scene a fresh install starts with: fast and smooth on any screen.
const DEFAULT_SCENE: SceneName = 'horizon'
// How a scene's name reads in the dashboard's list: "code-rain" as "code rain".
const sceneTitle = (name: SceneName) => name.replace(/-/g, ' ')
const isSceneName = (value: unknown): value is SceneName => SCENE_NAMES.includes(value as SceneName)
// A scene name as asked or saved: spaces read as dashes, and the old name "digital" as "data-room".
const sceneNamed = (value: unknown): unknown => {
  const name = typeof value === 'string' ? value.trim().toLowerCase().replace(/ +/g, '-') : value
  return name === 'digital' ? 'data-room' : name
}
// Every frame of a scene: while working, one per activity; the fade-out, the alert and the
// rest are the same whatever Claude was doing.
type SceneFrames = { idle: string; alert: string; rest: string; busy: Record<Activity, string>; steady: Record<Activity, string> }
const perActivity = (draw: (mode: Mode, act: Activity) => string, mode: Mode) =>
  Object.fromEntries(ACTIVITIES.map(act => [act, draw(mode, act)])) as Record<Activity, string>
const drawAll = (draw: (mode: Mode, act: Activity) => string, rest = REST): SceneFrames => ({
  idle: draw('idle', 'think'),
  busy: perActivity(draw, 'busy'),
  steady: perActivity(draw, 'steady'),
  alert: draw('alert', 'think'),
  rest,
})
// A light scene rests on bare paper.
const REST_PAPER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"><rect width="1600" height="1000" fill="${PAPER}"/></svg>`
const sceneFrame = (frames: SceneFrames, mode: Mode, act: Activity) =>
  mode === 'busy' || mode === 'steady' ? frames[mode][act] : frames[mode]
// Scene "spotlight": a still studio backdrop, one soft light in the middle fading to the
// edges over a slightly lighter floor. Nothing moves and nothing marks an alert (the band
// does); it is ivory or blue-black as the app's own light or dark setting is.
const spotlightOf = (look: Look) => {
  const [c0, c1, c2, c3, f0, f1, f2] =
    look === 'light'
      ? ['#f7f1e4', '#ece2cd', '#ddcfb2', '#cdbc9a', '#e2d6bd', '#e7dcc6', '#ede4d2']
      : ['#2a4178', '#172a55', '#0a1430', '#02040f', '#0d1834', '#12204a', '#18295a']
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<defs>
<radialGradient id="slw" cx=".5" cy=".42" r=".7"><stop offset="0" stop-color="${c0}"/><stop offset=".42" stop-color="${c1}"/><stop offset=".78" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></radialGradient>
<linearGradient id="slf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${f0}" stop-opacity="0"/><stop offset=".55" stop-color="${f1}" stop-opacity=".55"/><stop offset="1" stop-color="${f2}" stop-opacity=".8"/></linearGradient>
</defs>
<rect width="1600" height="1000" fill="url(#slw)"/>
<rect y="700" width="1600" height="300" fill="url(#slf)"/>
</svg>`
}
const SPOTLIGHT: Record<Look, string> = { dark: spotlightOf('dark'), light: spotlightOf('light') }
const SCENES: Record<SceneName, SceneFrames> = {
  // Still: the Backdrop hook draws SPOTLIGHT for the app's look instead of these frames.
  spotlight: drawAll(() => SPOTLIGHT.dark, SPOTLIGHT.dark),
  circuit: drawAll(circuitScene),
  horizon: drawAll(horizonScene),
  'data-room': drawAll(dataRoomScene),
  'code-rain': drawAll(rainScene),
  signal: drawAll(signalScene),
  'ink-plotter': drawAll(inkScene, REST_PAPER),
  'halftone-tide': drawAll(halftoneScene, REST_PAPER),
  'digital-cream': drawAll(creamScene, REST_PAPER),
  heartline: drawAll(heartlineScene, REST_HEART),
}
// The idle scene starts bright and fades to nothing (forwards), then simply stays up,
// faded, until the next job: see settleLater. The app first shows a new frame as a still
// image, so a frame that started dark would skip the fade.

// The theme with a named moving background, and the same colours without one.
// Horizon draws its own frost, in the sky only, so the app's glass keeps no blur for it
// (blur would soften the floor lines behind the chat too). The glass stays on with the same
// tint, though: with no glass at all, the app paints its panels (the prompt area) solid.
// A light scene takes the paper theme, which makes the app light while it is shown.
// A scene's look, with "auto" (spotlight) taking the app's own.
const resolvedLook = (name: SceneName, own: Look): Look => {
  const look = SCENE_LOOK[name]
  return look === 'auto' ? own : look
}
const lookFor = (name: SceneName, own: Look): ThemeSetArgs =>
  resolvedLook(name, own) === 'light'
    ? { colors: paperTheme, backdrop: { scene: name, glass: { blur: 3, tint: PAPER, opacity: 0.35 } } }
    : {
        colors: theme,
        backdrop: { scene: name, glass: { blur: name === 'horizon' ? 0 : 3, tint: '#03061a', opacity: 0.25 } },
      }
// No background: one still colour, cream or night blue as the app's own setting is.
const PLAIN: Record<Look, ThemeSetArgs> = {
  dark: { colors: theme, backdrop: { color: '#03061a' } },
  light: { colors: paperTheme, backdrop: { color: PAPER } },
}

const PANE = 'hud-dashboard'
// The help's own pane.
const HELP_PANE = 'ops-deck-help'
const titleFor = (sessionName: string | null) => `ops-deck - ${sessionName ?? 'Session'}`
// The pane's title, with this session's name once it is found.
let paneTitle = titleFor(null)

const ALERT_MS = 8000
// The solid fill inside the band's frame: the theme's darkest surface.
// The band's and dashboard's colours, for the look of the scene shown: neon on dark, or
// ink on paper. Every render hook calls paintFor first, so they always match the scene.
const PALETTES: Record<Look, { fill: string; cyan: string; green: string; red: string; amber: string; muted: string; activity: Record<Activity, string>; folder: string; label: string; halo: string }> = {
  dark: { fill: '#05090f', cyan: '#22d3ee', green: '#39ff88', red: '#ff4d6d', amber: '#ffb020', muted: '#6fa3b3', activity: ACTIVITY_COLOR, folder: '#e3b341', label: '#eafaff', halo: '#05090f' },
  light: { fill: '#f8f1e2', cyan: '#0e7490', green: '#15803d', red: '#b4233c', amber: '#b45309', muted: '#5b6b78', activity: ACTIVITY_INK, folder: '#9a6700', label: '#1f2a44', halo: PAPER },
}
let BAND_FILL = PALETTES.dark.fill
let CYAN = PALETTES.dark.cyan
let GREEN = PALETTES.dark.green
let RED = PALETTES.dark.red
let AMBER = PALETTES.dark.amber
let MUTED = PALETTES.dark.muted
let ACTIVITY_SHOWN = PALETTES.dark.activity
// The look now: the scene's while the background is on; with it off, the app's own
// light or dark setting (appLook).
const lookNow = async ($: Engine): Promise<Look> => {
  const [isOn, name, own] = await Promise.all([read($, isBackgroundOn), read($, currentScene), read($, appLook)])
  const ownLook: Look = own === 'light' ? 'light' : 'dark'
  return isOn && isSceneName(name) ? resolvedLook(name, ownLook) : ownLook
}

// The desktop app's profile folders (%LOCALAPPDATA%\Claude-Data\<profile>), the one used
// last first: its config.json holds the light/dark choice, and claude_desktop_config.json
// the app's own MCP servers.
const appProfiles = async ($: Engine): Promise<string[]> => {
  const local = await $.env.get('LOCALAPPDATA').catch(() => undefined)
  if (!local) return []
  const base = `${local}/Claude-Data`
  const entries = await $.fs.list(base).catch(() => [])
  const found: { dir: string; at: number }[] = []
  for (const entry of entries) {
    if (entry.kind !== 'dir') continue
    const dir = `${base}/${entry.name}`
    const at = await $.fs
      .stat(`${dir}/config.json`)
      .then(s => s.mtimeMs)
      .catch(() => -1)
    if (at >= 0) found.push({ dir, at })
  }
  return found.sort((a, b) => b.at - a.at).map(one => one.dir)
}
// The app's light/dark setting: light, dark, or the PC's own (read from Windows).
const readAppLook = async ($: Engine): Promise<Look> => {
  const dir = (await appProfiles($))[0]
  const mode = dir === undefined ? undefined : (await readJson($, `${dir}/config.json`))?.userThemeMode
  if (mode === 'light' || mode === 'dark') return mode
  // Following the PC: Windows' own setting, read with reg.exe at most once a minute (each
  // read starts a process).
  const now = await $.clock.now()
  if (pcLook !== undefined && now - pcLookAt < 60000) return pcLook
  const ran = await $.process
    .run(['reg', 'query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', '/v', 'AppsUseLightTheme'], { timeoutMs: 5000 })
    .catch(() => undefined)
  pcLook = ran !== undefined && /AppsUseLightTheme\s+REG_DWORD\s+0x1\b/i.test(ran.stdout) ? 'light' : 'dark'
  pcLookAt = now
  return pcLook
}
let pcLook: Look | undefined
let pcLookAt = -Infinity
// Reads the app's look again (at start and with the readout); a change while the
// background is off repaints the app, the band and the dashboard.
let appLookCheckedAt = -Infinity
const checkAppLook = async ($: Engine) => {
  const now = await $.clock.now()
  if (now - appLookCheckedAt < 10000) return
  appLookCheckedAt = now
  const look = await readAppLook($).catch((): Look => 'dark')
  if ((await read($, appLook)) !== look) {
    await update($, appLook, () => look)
    // The look shows with no background and with spotlight, which follows the app.
    if (!(await read($, isBackgroundOn)) || SCENE_LOOK[await savedScene($)] === 'auto') await applyTheme($)
  }
}
const paintFor = async ($: Engine) => {
  const p = PALETTES[await lookNow($)]
  BAND_FILL = p.fill
  CYAN = p.cyan
  GREEN = p.green
  RED = p.red
  AMBER = p.amber
  MUTED = p.muted
  ACTIVITY_SHOWN = p.activity
  FOLDER_YELLOW = p.folder
  LABEL_TEXT = p.label
  LABEL_HALO = p.halo
}

const pad = (n: number) => String(n).padStart(2, '0')
const clockText = (s: number) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
// A longer time: 05:09 under an hour, 1:05:09 from an hour on.
const durationText = (s: number) =>
  s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` : clockText(s)
const pct = (value: number | null | undefined) => (value === null || value === undefined ? '--' : `${Math.round(value)}%`)
// The usage bars: this many characters wide, the used part rounded to whole characters.
const USAGE_CELLS = 14
const usedCells = (percent: number, cells = USAGE_CELLS) => Math.max(0, Math.min(cells, Math.round((percent / 100) * cells)))
// Plan windows and context: amber from 70% used, red from 90%.
const tone = (value: number | null | undefined) =>
  value === null || value === undefined ? CYAN : value >= 90 ? RED : value >= 70 ? AMBER : CYAN
const kilo = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))
const hhmm = (ms: number) => {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
// The time of day to the second: 22:41:05.
const clockAt = (ms: number) => `${hhmm(ms)}:${pad(new Date(ms).getSeconds())}`
// When a usage window starts again: "in 2h 14m", or the day and time when it is more than
// a day away, in the dashboard's language.
const resetText = (iso: string | null | undefined, now: number, t: Texts = EN) => {
  if (iso === null || iso === undefined) {
    return ''
  }
  const at = Date.parse(iso)
  if (Number.isNaN(at)) {
    return ''
  }
  const minutes = Math.max(0, Math.round((at - now) / 60000))
  if (minutes < 24 * 60) {
    return t.resetIn(Math.floor(minutes / 60), pad(minutes % 60))
  }
  const day = t.days[new Date(at).getDay()] ?? ''
  return `${day} ${hhmm(at)}`
}
// mcp__server__tool reads as server:tool.
const toolLabel = (tool: string) => {
  const parts = tool.split('__')
  return parts.length === 3 && parts[0] === 'mcp' ? `${parts[1]}:${parts[2]}` : tool
}
// The last two parts of a path: …\hooks\register.tsx
const shortPath = (path: string) => {
  const parts = path.split(/[\\/]/).filter(part => part !== '')
  return parts.length <= 2 ? parts.join('/') : `…/${parts.slice(-2).join('/')}`
}
// Which file a tool call touches, and how.
const touchOf = (tool: string, input: unknown): { path: string; kind: 'read' | 'edit' | 'write' } | null => {
  const fields = input as { file_path?: unknown; notebook_path?: unknown }
  const path = typeof fields.file_path === 'string' ? fields.file_path : typeof fields.notebook_path === 'string' ? fields.notebook_path : null
  if (path === null) {
    return null
  }
  if (tool === 'Read') {
    return { path, kind: 'read' }
  }
  if (tool === 'Write') {
    return { path, kind: 'write' }
  }
  if (tool === 'Edit' || tool === 'MultiEdit' || tool === 'NotebookEdit') {
    return { path, kind: 'edit' }
  }
  return null
}

const nameOf = (path: string) => path.split(/[\\/]/).filter(part => part !== '').pop() ?? path
const folderOf = (path: string) => path.replace(/[\\/][^\\/]*$/, '')
const clip = (text: string, most: number) => (text.length > most ? `${text.slice(0, most - 1)}…` : text)

// What a tool call worked on, in a few words: the command, the file, the pattern.
const targetOf = (tool: string, input: unknown): string => {
  const fields = input as Record<string, unknown>
  const text = (key: string) => (typeof fields[key] === 'string' ? (fields[key] as string) : '')
  if (tool === 'Bash' || tool === 'PowerShell') {
    return clip(text('command').replace(/\s+/g, ' '), 56)
  }
  const file = text('file_path') || text('notebook_path')
  if (file !== '') {
    return nameOf(file)
  }
  if (tool === 'Grep') {
    return clip(`/${text('pattern')}/`, 56)
  }
  if (tool === 'Glob') {
    return clip(text('pattern'), 56)
  }
  if (tool === 'WebFetch') {
    return clip(text('url').replace(/^https?:\/\//, '').split('/')[0] ?? '', 56)
  }
  const said = text('description') || text('query') || text('action') || text('prompt')
  return clip(said.replace(/\s+/g, ' '), 56)
}

// The whole of what a tool call worked on, for the hover card: the full command, or the
// input's fields one per line. Capped so the stored counts stay small.
const FULL_MOST = 4000
// Keys the engine puts beside a tool's own arguments.
const RESERVED_KEYS = new Set(['tool', 'tool_use_id', 'consent', 'agentId', 'requestMeta'])
const fullOf = (tool: string, input: unknown): string => {
  const fields = input as Record<string, unknown>
  if ((tool === 'Bash' || tool === 'PowerShell') && typeof fields.command === 'string') {
    return clip(fields.command.trim(), FULL_MOST)
  }
  const lines = Object.entries(fields)
    .filter(([key, value]) => !RESERVED_KEYS.has(key) && value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
  return clip(lines.join('\n'), FULL_MOST)
}

// Where a host is: this PC, the local network, or the internet.
const scopeOf = (raw: string): 'local' | 'lan' | 'web' => {
  const host = raw
    .toLowerCase()
    .replace(/^.*@/, '')
    .replace(/^\[(.*)\](:\d+)?$/, '$1')
    .replace(/:\d+$/, '')
    .replace(/[\\,].*$/, '')
  if (host === '' || host === '.' || host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host.startsWith('127.') || host === '0.0.0.0' || host.startsWith('(local')) {
    return 'local'
  }
  if (
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^f[cd][0-9a-f]{2}:/.test(host) ||
    /\.(local|lan|home|internal|corp)$/.test(host) ||
    !host.includes('.')
  ) {
    return 'lan'
  }
  return 'web'
}
const hostOfUrl = (url: string) => url.replace(/^[a-z]+:\/\//i, '').split(/[/?#\s'"]/)[0] ?? ''

// Commands that talk to the network, and the host they name when there is one.
const NET_HOST_COMMAND =
  /\b(?:ping|tracert|traceroute|nslookup|Resolve-DnsName|Test-NetConnection|tnc|Test-Connection|ssh|scp|sftp|ftp|telnet)\s+(?:-{1,2}\S+\s+)*([A-Za-z0-9._@:-]+)/gi
const NET_COMMAND = /\b(?:curl|wget|Invoke-WebRequest|iwr|Invoke-RestMethod|irm|Start-BitsTransfer|Enter-PSSession|New-PSSession)\b/i
const FETCHING_COMMAND =
  /\b(git\s+(?:clone|fetch|pull|push|ls-remote)|npm\s+(?:install|i|ci|update|publish|view)|pnpm\s+(?:add|install)|yarn\s+(?:add|install)|pip3?\s+install|winget\s+install|choco\s+install|Install-Module|Install-Package|dotnet\s+(?:restore|add))\b/i
// MCP servers that run on this PC; any other server is a connector out on the network.
const LOCAL_MCP = /^(ops-deck|ccd_.*|visualize|terminal|scheduled-tasks|computer-use|Claude_Browser|claude-in-chrome)$/i

type Reached = { host: string; scope: 'web' | 'lan' | 'net' }

// Where each configured MCP server runs, read from the settings that define it: a server
// started as a command runs on this PC; one reached by URL is local, LAN or web by its host.
// A server found in none of them (one a plugin brings, say) is shown as plain network,
// never as web, since how it connects is unknown. Keys are the names as tool names spell
// them (mcp__<name>__tool: anything but letters, digits, _ and - becomes _).
const MCP_PLACES = new Map<string, 'local' | Reached>()
const mcpKey = (name: string) => name.replace(/[^A-Za-z0-9_-]/g, '_').toLowerCase()
const mcpPlaceOf = (name: string, entry: unknown): 'local' | Reached | undefined => {
  if (entry === null || typeof entry !== 'object') {
    return undefined
  }
  const fields = entry as Record<string, unknown>
  if (typeof fields.url === 'string' && fields.url !== '') {
    const host = hostOfUrl(fields.url).replace(/:\d+$/, '')
    const scope = scopeOf(host)
    return scope === 'local' ? 'local' : { host: host.toLowerCase() || name, scope }
  }
  return typeof fields.command === 'string' ? 'local' : undefined
}
// The servers already looked for, so a server in no settings file is read for only once.
const mcpLooked = new Set<string>()
const readJson = async ($: Engine, path: string): Promise<Record<string, unknown> | null> => {
  try {
    const parsed: unknown = JSON.parse(await $.fs.read(path))
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}
const loadMcpPlaces = async ($: Engine) => {
  const home = (await $.env.get('USERPROFILE').catch(() => undefined)) ?? (await $.env.get('HOME').catch(() => undefined))
  const configDir = await $.env.get('CLAUDE_CONFIG_DIR').catch(() => undefined)
  const appData = await $.env.get('APPDATA').catch(() => undefined)
  const root = await $.session.root().catch(() => '')
  const same = (a: string, b: string) => a.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase() === b.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase()
  const servers: Record<string, unknown>[] = []
  const take = (value: unknown) => {
    if (value !== null && typeof value === 'object') {
      servers.push(value as Record<string, unknown>)
    }
  }
  // User and local (per-project) servers, as `claude mcp add` writes them.
  for (const file of [configDir && `${configDir}/.claude.json`, home && `${home}/.claude.json`]) {
    if (!file) continue
    const json = await readJson($, file)
    if (json === null) continue
    take(json.mcpServers)
    const projects = json.projects
    if (projects !== null && typeof projects === 'object' && root !== '') {
      for (const [path, project] of Object.entries(projects as Record<string, unknown>)) {
        if (same(path, root) && project !== null && typeof project === 'object') {
          take((project as Record<string, unknown>).mcpServers)
        }
      }
    }
  }
  // The project's shared servers, and the desktop app's own.
  if (root !== '') take((await readJson($, `${root}/.mcp.json`))?.mcpServers)
  if (appData) take((await readJson($, `${appData}/Claude/claude_desktop_config.json`))?.mcpServers)
  // The desktop app keeps its own list in its profile folder (Claude-Data\<profile>).
  for (const dir of await appProfiles($).catch(() => [])) {
    take((await readJson($, `${dir}/claude_desktop_config.json`))?.mcpServers)
  }
  for (const group of servers) {
    for (const [name, entry] of Object.entries(group)) {
      const place = mcpPlaceOf(name, entry)
      if (place !== undefined) {
        MCP_PLACES.set(mcpKey(name), place)
      }
    }
  }
}
// Before an MCP call is counted: a server not known yet has the settings read again, once.
const learnMcpServer = async ($: Engine, tool: string) => {
  const parts = tool.split('__')
  if (parts.length !== 3 || parts[0] !== 'mcp') return
  const key = mcpKey(parts[1] ?? '')
  if (MCP_PLACES.has(key) || mcpLooked.has(key)) return
  mcpLooked.add(key)
  await loadMcpPlaces($).catch(() => undefined)
}

// The places outside this PC a tool call reaches: hosts it names, or the network at large.
const XML_NAMESPACE = /^https?:\/\/(www\.w3\.org\/(1999|2000|XML|2005)\/|schemas\.(openxmlformats\.org|microsoft\.com)\/|purl\.org\/dc\/)/i

const reachOf = (tool: string, input: unknown): Reached[] => {
  const fields = input as Record<string, unknown>
  const text = (key: string) => (typeof fields[key] === 'string' ? (fields[key] as string) : '')
  const out: Reached[] = []
  const add = (host: string) => {
    const scope = scopeOf(host)
    const name = host.replace(/^.*@/, '').toLowerCase()
    if (scope !== 'local' && !out.some(one => one.host === name)) {
      out.push({ host: name, scope })
    }
  }

  if (tool === 'WebFetch') {
    add(hostOfUrl(text('url')))
    return out
  }
  if (tool === 'WebSearch') {
    return [{ host: 'web search', scope: 'web' }]
  }
  if (tool === 'Bash' || tool === 'PowerShell') {
    const command = text('command')
    for (const m of command.matchAll(/\b(?:https?|ftp|wss?|ssh):\/\/[^\s'"`)]+/gi)) {
      // Standard name tags written inside SVG, HTML and XML files (xmlns="http://www.w3.org/2000/svg")
      // are labels, not addresses anything connects to.
      if (!XML_NAMESPACE.test(m[0])) {
        add(hostOfUrl(m[0]))
      }
    }
    for (const m of command.matchAll(/(?:^|[\s'"(])\\\\([A-Za-z0-9._-]+)\\/g)) {
      add(m[1] ?? '')
    }
    for (const m of command.matchAll(NET_HOST_COMMAND)) {
      add(m[1] ?? '')
    }
    for (const m of command.matchAll(/(?:-ComputerName|-HostName|-S)\s+["']?([A-Za-z0-9._()\\,-]+)/g)) {
      add(m[1] ?? '')
    }
    if (out.length === 0) {
      const fetching = FETCHING_COMMAND.exec(command)
      if (fetching !== null) {
        out.push({ host: (fetching[1] ?? '').split(/\s+/)[0]?.toLowerCase() + ' remote', scope: 'net' })
      } else if (NET_COMMAND.test(command)) {
        out.push({ host: 'unnamed host', scope: 'net' })
      }
    }
    return out
  }
  const parts = tool.split('__')
  if (parts.length === 3 && parts[0] === 'mcp') {
    const server = parts[1] ?? ''
    if (/^(Claude_Browser|claude-in-chrome)$/i.test(server)) {
      const url = text('url')
      if (url !== '' && /^(https?:\/\/|[a-z0-9-]+\.[a-z])/i.test(url)) {
        add(hostOfUrl(url))
      }
      return out
    }
    if (LOCAL_MCP.test(server)) {
      return out
    }
    // A claude.ai connector (named by an id, or claude_ai_…) runs on Anthropic's side.
    if (/^[0-9a-f]{8}-/i.test(server) || /^claude_ai_/i.test(server)) {
      return [{ host: 'claude.ai connector', scope: 'web' }]
    }
    // Otherwise as the MCP settings set it up: a command on this PC, or a URL.
    const place = MCP_PLACES.get(mcpKey(server))
    if (place === 'local') {
      return out
    }
    return [place ?? { host: server, scope: 'net' }]
  }
  return out
}

// A ten-step bar for a count against the largest.
const bar = (value: number, most: number) => {
  const filled = most <= 0 ? 0 : Math.max(1, Math.round((value / most) * 10))
  return '▰'.repeat(filled) + '▱'.repeat(10 - filled)
}

// The files graph, after the quarterdeck dashboard's: the session (a triangle) in the
// middle, spokes to each folder (a yellow folder mark) on a ring, the folder's files
// spiralling round it as dots (green written, amber edited, cyan read; bigger when used
// more), faint lines between files worked on in the same turn, the newest one pulsing.
// Hovering a dot names the file and what was done to it.
// The canvas is drawn at the pane's own width in pixels, so text is drawn at its real size
// instead of being scaled down; this is the width of the canvas when it is not known.
const GRAPH_W = 540
const GRAPH_RATIO = 0.8
// The pane's width in pixels, from its width in text columns.
const graphWidth = (columns: number) => Math.round(Math.max(280, Math.min(1000, columns * 7.5)))
// Expanded, the canvas is three times as tall, whatever the pane's own height.
const TALL_FACTOR = 3
const graphHeight = (width: number, tall: boolean) => Math.round(width * GRAPH_RATIO * (tall ? TALL_FACTOR : 1))
const GOLDEN_ANGLE = 2.39996
// How much a click on a file or a folder enlarges the files graph.
const FILE_ZOOM = 2.6
const FOLDER_ZOOM = 2
let FOLDER_YELLOW = '#e3b341'
// The graph's file names and the halo behind its labels (set by paintFor with the look).
let LABEL_TEXT = '#eafaff'
let LABEL_HALO = '#05090f'
const xml = (text: string) =>
  text.replace(/[&<>"]/g, c => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'))
const touchColor = (f: FileTouch) => (f.write > 0 ? GREEN : f.edit > 0 ? AMBER : CYAN)
const fileFacts = (f: FileTouch, t: Texts = EN) =>
  [f.read > 0 ? `${t.read} ×${f.read}` : '', f.edit > 0 ? `${t.edited} ×${f.edit}` : '', f.write > 0 ? `${t.written} ×${f.write}` : '']
    .filter(part => part !== '')
    .join(' · ')

// The zoom steps of the graph, and the framing for one: the part of the canvas in view.
const ZOOMS = [1, 1.5, 2, 3, 4] as const
const frameOf = (view: GraphView, width: number) => {
  const zoom = Math.max(1, view.zoom)
  const vw = width / zoom
  const tallH = graphHeight(width, view.tall === true)
  const vh = tallH / zoom
  const left = Math.min(width - vw, Math.max(0, width / 2 + (view.x * vw) / 2 - vw / 2))
  const top = Math.min(tallH - vh, Math.max(0, tallH / 2 + (view.y * vh) / 2 - vh / 2))
  return { zoom, left, top, vw, vh, w: width, tall: tallH }
}

const fileGraph = (
  all: FileTouch[],
  working: boolean,
  view: GraphView = { zoom: 1, x: 0, y: 0 },
  width: number = GRAPH_W,
  // The words on the mark that zooms back out, in the dashboard's language.
  resetLabel = 'Whole view',
  // Whether anything may pulse: only while Claude works with a scene chosen. With no
  // background (None, often picked on PCs without a graphics card) nothing moves.
  moving = working,
): string => {
  const frame = frameOf(view, width)
  // Text grows with the zoom, but slower than the drawing, so more names fit.
  // Expanded, the graph is three times as tall and its text bigger still.
  const k = (view.tall === true ? 1.15 : 0.85) / Math.sqrt(frame.zoom)
  const list = [...all].sort((a, b) => b.last - a.last).slice(0, 60)
  const newest = list[0]?.path
  const w = frame.w
  const tallH = frame.tall
  const cx = w / 2
  const cy = tallH / 2

  // Files grouped by folder, folders in order of first appearance.
  const names: string[] = []
  const members = new Map<string, number[]>()
  list.forEach((f, i) => {
    const dir = folderOf(f.path)
    const ids = members.get(dir) ?? []
    if (ids.length === 0) {
      names.push(dir)
    }
    members.set(dir, [...ids, i])
  })
  const single = names.length === 1
  const ringX = w * 0.28
  const ringY = tallH * 0.3
  const room = single ? Math.min(tallH / 2 - 30, 150) : Math.max(34, Math.min(62, ringY * 0.6))
  const stretch = single ? 1.6 : 1.25
  // Each folder gets a share of the ring in proportion to its files.
  const shares = names.map(name => Math.sqrt((members.get(name) ?? []).length) + 0.8)
  const whole = shares.reduce((sum, share) => sum + share, 0)
  const points: { x: number; y: number }[] = new Array(list.length)
  let turned = 0
  const folders = names.map((name, k) => {
    const share = shares[k] ?? 1
    const angle = Math.PI + ((turned + share / 2) / whole) * 2 * Math.PI
    turned += share
    const x = single ? cx : cx + Math.cos(angle) * ringX
    const y = single ? cy : cy + Math.sin(angle) * ringY
    const ids = members.get(name) ?? []
    const start = single ? 30 : 16
    const step = Math.min(18, (room - start) / Math.sqrt(Math.max(1, ids.length)))
    let reach = 0
    ids.forEach((id, j) => {
      const distance = start + step * Math.sqrt(j + (single ? 0 : 0.6))
      const turn = j * GOLDEN_ANGLE + k
      points[id] = { x: x + Math.cos(turn) * distance * stretch, y: y + Math.sin(turn) * distance }
      reach = Math.max(reach, distance)
    })
    return { name, x, y, reach, count: ids.length }
  })

  // Files worked on in the same turn are linked.
  const byTurn = new Map<number, number[]>()
  list.forEach((f, i) => {
    for (const t of f.turns) {
      byTurn.set(t, [...(byTurn.get(t) ?? []), i])
    }
  })
  const pairs = new Map<string, number>()
  for (const ids of byTurn.values()) {
    for (let a = 0; a < ids.length; a += 1) {
      for (let b = a + 1; b < ids.length; b += 1) {
        const key = `${ids[a]}-${ids[b]}`
        pairs.set(key, (pairs.get(key) ?? 0) + 1)
      }
    }
  }
  const at = (i: number) => points[i] ?? { x: cx, y: cy }
  const n1 = (v: number) => v.toFixed(1)

  const spokes = single
    ? ''
    : folders.map(f => `<line class="sp" x1="${cx}" y1="${cy}" x2="${n1(f.x)}" y2="${n1(f.y)}"/>`).join('')
  const folderMarks = single
    ? ''
    : folders
        .map(f => {
          const fx = f.x - 9
          const fy = f.y - 7
          return `<path id="d${folders.indexOf(f)}" tabindex="0" fill="${FOLDER_YELLOW}" d="M${n1(fx)} ${n1(fy + 1)}h6l2.5 3h9.5v11h-18z"><title>${xml(f.name)} · ${f.count} file${f.count === 1 ? '' : 's'}</title></path>`
        })
        .join('')
  const folderLabels = folders
    .map(f => {
      const parts = f.name.split(/[\\/]/).filter(part => part !== '')
      const short = parts.length > 2 ? `…/${parts.slice(-2).join('/')}` : parts.join('/')
      const y = single ? 16 : f.y + 13 + 12 * k
      return `<text class="fl" x="${n1(single ? cx : f.x)}" y="${n1(y)}" text-anchor="middle">${xml(clip(short, 22))} (${f.count})</text>`
    })
    .join('')
  const links = [...pairs.entries()]
    .slice(0, 160)
    .map(([key, times]) => {
      const [a, b] = key.split('-').map(Number)
      const p = at(a ?? 0)
      const q = at(b ?? 0)
      return `<line class="lk" stroke-opacity="${Math.min(0.35, 0.08 + times * 0.06).toFixed(2)}" x1="${n1(p.x)}" y1="${n1(p.y)}" x2="${n1(q.x)}" y2="${n1(q.y)}"/>`
    })
    .join('')
  const nameCount = frame.zoom >= 2 ? list.length : frame.zoom > 1 ? 16 : 8
  const named = new Set(list.slice(0, nameCount).map((_, i) => i))
  const dots = list
    .map((f, i) => {
      const p = at(i)
      const size = 3 + Math.min(7, Math.sqrt(f.read + f.edit + f.write) * 1.6)
      const color = touchColor(f)
      const folderX = single ? cx : (folders.find(one => one.name === folderOf(f.path))?.x ?? cx)
      const right = p.x >= folderX
      // Every file has its name; the ones beyond the first few show only while zoomed in.
      const label = `<text class="fn${named.has(i) ? '' : ' fz'}" x="${n1(p.x + (right ? size + 4 : -size - 4))}" y="${n1(p.y + 5 * k)}" text-anchor="${right ? 'start' : 'end'}">${xml(clip(nameOf(f.path), frame.zoom >= 2 ? 32 : 22))}</text>`
      // The newest file pulses only while Claude works with a scene chosen: an endless animation keeps a PC
      // without a graphics card busy redrawing the pane even when nothing happens.
      const pulse = f.path === newest && moving ? `<circle class="pl" cx="${n1(p.x)}" cy="${n1(p.y)}" r="${n1(size)}" stroke="${color}"/>` : ''
      return `${pulse}<circle id="n${i}" tabindex="0" cx="${n1(p.x)}" cy="${n1(p.y)}" r="${n1(size)}" fill="${color}"><title>${xml(f.path)} · ${fileFacts(f)}</title></circle>${label}`
    })
    .join('')
  const session = `<path d="M${cx} ${cy - 11}l10 18h-20z" fill="${working ? GREEN : MUTED}"${moving ? ' class="live"' : ''}><title>This session</title></path>`

  // Click to zoom, without scripts (the frame runs none): files and folders take focus
  // when clicked, and a rule per item moves its point to the middle, enlarged. Clicking
  // empty space, or the reset mark, drops the focus and the whole view comes back.
  const zoomTo = (id: string, x: number, y: number, z: number) =>
    `.scene:has(#${id}:focus){transform:translate(${n1(w / 2 - z * x)}px,${n1(tallH / 2 - z * y)}px) scale(${z})}`
  const zooms = [
    ...list.map((_, i) => zoomTo(`n${i}`, at(i).x, at(i).y, FILE_ZOOM)),
    ...(single ? [] : folders.map((f, i) => zoomTo(`d${i}`, f.x, f.y, FOLDER_ZOOM))),
  ].join('')
  const reset = `<text class="rs" tabindex="0" x="${n1(w - 8)}" y="${n1(tallH - 8)}" text-anchor="end">⤢ ${xml(resetLabel)}</text>`

  const box = `${n1(frame.left)} ${n1(frame.top)} ${n1(frame.vw)} ${n1(frame.vh)}`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" width="${w}" height="${tallH}">
<style>
.scene{transition:transform .6s ease;transform-origin:0 0}
${zooms}
[tabindex]{cursor:pointer;outline:none}
[tabindex]:focus{stroke:#fff;stroke-width:2.5}
.fz{opacity:0;transition:opacity .4s}
.scene:has(:focus) .fz{opacity:1}
.scene:has(:focus) .fn{font-size:${n1(7.5 * k)}px;stroke-width:${n1(2 * k)}px}
.scene:has(:focus) .fl{font-size:${n1(7 * k)}px;stroke-width:${n1(2 * k)}px}
.rs{font:bold ${n1(17 * k)}px monospace;fill:${CYAN};opacity:0;transition:opacity .4s}
svg:has(.scene :focus) .rs{opacity:.9}
.sp{stroke:${CYAN};stroke-opacity:.22;stroke-width:${n1(1.2 * k)}}
.lk{stroke:#9fd4e3;stroke-width:${n1(1.2 * k)}}
.fl{font:bold ${n1(14 * k)}px monospace;fill:${FOLDER_YELLOW};paint-order:stroke;stroke:${LABEL_HALO};stroke-width:${n1(4 * k)}px}
.fn{font:${n1(15 * k)}px monospace;fill:${LABEL_TEXT};paint-order:stroke;stroke:${LABEL_HALO};stroke-width:${n1(4 * k)}px}
.pl{fill:none;stroke-width:2;transform-box:fill-box;transform-origin:center;animation:pl 1.8s ease-out infinite}
@keyframes pl{from{opacity:.9;transform:scale(1)}to{opacity:0;transform:scale(3.2)}}
.live{animation:live 1.2s ease-in-out infinite}
@keyframes live{50%{opacity:.45}}
circle:hover{stroke:#fff;stroke-width:2}
</style>
<g class="scene">${spokes}${links}${folderMarks}${dots}${folderLabels}${session}</g>
${reset}
</svg>`
}

// The helper agents as a timeline: one lane each, a bar from start to end (or to now while
// running). The bar's colour is the helper's model; its shape is its state: solid done,
// pale with a dot at its tip running, red outline and ✖ failed, dashed when nothing was
// heard for a long time. The time each took follows its bar; the session's elapsed time
// runs along the top, and a legend names the models below. A still picture: redrawn only
// when a helper starts, calls a tool or ends.
const agentStatus = (row: AgentRun, now: number) =>
  row.status === 'running' && now - row.last > AGENT_QUIET_MS ? 'quiet' : row.status
const AGENT_COLOR = { running: CYAN, done: GREEN, failed: RED, quiet: MUTED } as const
// The model a helper ran on, as a name: the one named in its Agent call, else the
// session's; "?" for a row an older version recorded without it.
const agentModel = (row: AgentRun, sessionModel: string): string =>
  row.model === undefined
    ? '?'
    : row.model !== null && row.model !== ''
      ? modelName(row.model)
      : sessionModel !== '--' && sessionModel !== ''
        ? modelName(sessionModel)
        : '?'
const MODEL_COLORS: [RegExp, string][] = [
  [/^opus/i, '#b48cff'],
  [/^sonnet/i, '#ffa94d'],
  [/^haiku/i, '#3dd6c3'],
  [/^fable/i, '#ff7ac8'],
  [/^mythos/i, '#c6f24e'],
]
const modelColor = (name: string) =>
  name === '?' ? MUTED : (MODEL_COLORS.find(([match]) => match.test(name))?.[1] ?? '#6fa8ff')
const AGENT_CHART_STEP_MS = 15000
const AGENT_LANE = 22
const AGENT_TOP = 26
// The timeline shows the last few helpers only.
const AGENT_CHART_ROWS = 8
const agentChartHeight = (rows: number) => AGENT_TOP + Math.min(rows, AGENT_CHART_ROWS) * AGENT_LANE + 30
// The time axis counts only the stretches when some helper was running: the idle time
// between batches is folded into a short break (//), so a batch of quick helpers fills the
// width instead of shrinking to dots against an hour of nothing.
const AGENT_GAP_PX = 22
const agentChart = (all: AgentRun[], now: number, width: number, sessionModel = '--', unknownLabel = 'unknown'): string => {
  const rows = all.slice(-AGENT_CHART_ROWS)
  const lane = AGENT_LANE
  const top = AGENT_TOP
  const labelW = Math.min(170, Math.round(width * 0.38))
  const right = 56
  const chartH = agentChartHeight(rows.length)
  const n1 = (v: number) => v.toFixed(1)
  // The stretches when helpers ran, overlapping ones merged, each at least 5 s long.
  const spans = rows
    .map(row => [row.start, Math.max(row.start + 5000, row.end ?? now)] as [number, number])
    .sort((a, b) => a[0] - b[0])
  const clusters: [number, number][] = []
  for (const [s, e] of spans) {
    const last = clusters[clusters.length - 1]
    if (last !== undefined && s <= last[1] + 2000) {
      last[1] = Math.max(last[1], e)
    } else {
      clusters.push([s, e])
    }
  }
  const busyTotal = clusters.reduce((sum, [s, e]) => sum + (e - s), 0)
  const room = width - labelW - right - (clusters.length - 1) * AGENT_GAP_PX
  // Where each stretch begins on screen.
  const lefts: number[] = []
  let cursor = labelW
  for (const [s, e] of clusters) {
    lefts.push(cursor)
    cursor += ((e - s) / busyTotal) * room + AGENT_GAP_PX
  }
  const x = (t: number) => {
    let i = clusters.findIndex(([s, e]) => t >= s - 2000 && t <= e + 2000)
    if (i < 0) {
      i = clusters.length - 1
    }
    const [s, e] = clusters[i] ?? [t, t]
    return (lefts[i] ?? labelW) + ((Math.min(Math.max(t, s), e) - s) / busyTotal) * room
  }
  const lanesBottom = top + rows.length * lane
  // The clock time where each stretch begins (skipped where it would crowd the last one),
  // and a break mark in each folded gap.
  let lastLabel = -Infinity
  const ticks = clusters
    .map(([s], i) => {
      const tx = lefts[i] ?? labelW
      const line = `<line class="tk" x1="${n1(tx)}" y1="${top - 6}" x2="${n1(tx)}" y2="${lanesBottom}"/>`
      if (tx - lastLabel < 46) {
        return line
      }
      lastLabel = tx
      return `${line}<text class="tt" x="${n1(tx)}" y="${top - 10}" text-anchor="middle">${hhmm(s)}</text>`
    })
    .join('')
  const breaks = clusters
    .slice(1)
    .map((_, i) => {
      const gx = (lefts[i + 1] ?? labelW) - AGENT_GAP_PX / 2
      return `<path class="br" d="M${n1(gx - 5)} ${top + 2}l4 -8M${n1(gx + 1)} ${top + 2}l4 -8"/><line class="gp" x1="${n1(gx)}" y1="${top + 4}" x2="${n1(gx)}" y2="${lanesBottom}"/>`
    })
    .join('')
  const bars = rows
    .map((row, i) => {
      const y = top + i * lane
      const status = agentStatus(row, now)
      const model = agentModel(row, sessionModel)
      const color = modelColor(model)
      const a = x(row.start)
      const b = Math.max(a + 6, x(row.end ?? now))
      // While running, "now" moves in steps, so the time shown is at least 0 and rounded.
      const took = clockText(Math.max(0, Math.round(((row.end ?? now) - row.start) / 1000)))
      const name = xml(clip(row.description !== '' ? row.description : row.kind, Math.floor((labelW - 12) / 6.7)))
      const fillOpacity = status === 'running' ? '.45' : status === 'quiet' ? '.25' : '.85'
      const edge =
        status === 'failed'
          ? ` stroke="${RED}" stroke-width="2"`
          : status === 'quiet'
            ? ` stroke="${color}" stroke-width="1.5" stroke-dasharray="3 3"`
            : ''
      const tip = status === 'running' ? `<circle cx="${n1(b)}" cy="${y + 9.5}" r="4" fill="${color}"/>` : ''
      const mark = status === 'failed' ? '✖ ' : ''
      return `<text class="ln" x="${labelW - 8}" y="${y + 13}" text-anchor="end">${name}</text>
<rect x="${n1(a)}" y="${y + 4}" width="${n1(b - a)}" height="11" rx="3" fill="${color}" fill-opacity="${fillOpacity}"${edge}><title>${xml(row.kind)} · ${xml(model)} · ${xml(row.description)}</title></rect>${tip}
<text class="du" x="${n1(b + 6)}" y="${y + 13}" fill="${status === 'failed' ? RED : color}">${mark}${took}</text>`
    })
    .join('')
  // The legend: one swatch per model present.
  const models = [...new Set(rows.map(row => agentModel(row, sessionModel)))]
  let lx = 8
  const legend = models
    .map(model => {
      const label = model === '?' ? unknownLabel : model
      const part = `<rect x="${n1(lx)}" y="${chartH - 17}" width="12" height="8" rx="2" fill="${modelColor(model)}" fill-opacity=".85"/><text class="lg" x="${n1(lx + 17)}" y="${chartH - 9}">${xml(label)}</text>`
      lx += 17 + label.length * 6.2 + 16
      return part
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${chartH}" width="${width}" height="${chartH}">
<style>
.tk{stroke:${CYAN};stroke-opacity:.15;stroke-dasharray:2 4}
.tt{font:10px monospace;fill:${MUTED}}
.ln{font:11px monospace;fill:#d8f6ff}
.du{font:10px monospace}
.lg{font:10px monospace;fill:#d8f6ff}
.br{fill:none;stroke:${MUTED};stroke-width:1.5}
.gp{stroke:${MUTED};stroke-opacity:.18;stroke-dasharray:1 3}
</style>
${ticks}${breaks}${bars}${legend}
</svg>`
}

// Session values and the helpers that take $ live at the top of the file:
// the engine follows $ only into functions declared here.
let busy = false
let startedAt = 0
let tools = 0
let failed = 0
// Counts the turns, so files touched in the same turn can be linked in the graph.
let turnNo = 0
let lastSeconds = 0
let tick: Timer | undefined
let idleTick: Timer | undefined
let clearAlert: Timer | undefined
let clearDone: Timer | undefined
// The background rests (empty) until Claude works, and again once a fade-out has run.
let settled = true
// The background mode last drawn, so the return from an alert skips the fade-in.
let shownMode: Mode = 'rest'
// The background frame on show: its activity, key and source (with its phase filled in),
// and when its motion began.
let shownAct: Activity = 'think'
let shownKey = ''
let shownSource = ''
let motionFrom = 0
let settleTimer: Timer | undefined
// The last theme.set answer, reported by the diagnostics without setting the theme again.
let lastSet: unknown = 'not set yet'

let reported = false
// How many times each drawing hook ran, per surface, for the diagnostics.
const seen: Record<string, number> = {}
const saw = (what: string) => {
  seen[what] = (seen[what] ?? 0) + 1
}

// Which activity a tool call is: web or network, files, or a command or other tool. The
// HUD's own and the app's bookkeeping tools are not counted (null).
const FILE_TOOLS = new Set(['Read', 'Edit', 'Write', 'MultiEdit', 'Glob', 'Grep', 'NotebookEdit', 'NotebookRead'])
const QUIET_TOOLS = new Set(['TodoWrite', 'ToolSearch', 'Skill', 'AskUserQuestion', 'EnterPlanMode', 'ExitPlanMode'])
const activityOf = (tool: string, input: unknown): Activity | null => {
  if (QUIET_TOOLS.has(tool) || /^mcp__(ccd_|ops-deck__)/.test(tool)) {
    return null
  }
  if (
    tool === 'WebFetch' ||
    tool === 'WebSearch' ||
    /^mcp__(Claude_Browser|claude-in-chrome)__/.test(tool) ||
    // An MCP server of unknown kind is not counted as web for the colour.
    reachOf(tool, input).some(place => place.scope !== 'net' || !tool.startsWith('mcp__'))
  ) {
    return 'web'
  }
  return FILE_TOOLS.has(tool) ? 'files' : 'run'
}

// The tools running now, newest last; the backgrounds show the newest, or thinking when
// none runs. A colour stays at least ACTIVITY_HOLD_MS, so quick bursts of calls do not
// flicker: a change asked sooner waits, and only the latest wish is applied.
const ACTIVITY_HOLD_MS = 1500
let running: Activity[] = []
let actShown: Activity = 'think'
let actChangedAt = 0
let actTimer: Timer | undefined
const wantActivity = async ($: Engine) => {
  const wanted: Activity = running[running.length - 1] ?? 'think'
  actTimer?.cancel()
  actTimer = undefined
  if (wanted === actShown) {
    return
  }
  const now = await $.clock.now()
  const wait = actChangedAt + ACTIVITY_HOLD_MS - now
  if (wait > 0) {
    actTimer = $.clock.after(wait, () => void wantActivity($))
    return
  }
  actShown = wanted
  actChangedAt = now
  await update($, activity, () => wanted)
}

// Helper agents (subagents). An Agent call makes a row; the app then reports the helper's
// own turns and tool calls under its agent id, which is linked to the newest row still
// waiting for one. A helper started in the background returns from its Agent call at
// once and finishes with its last turn; one run in the foreground finishes with the call.
const AGENT_TOOLS = new Set(['Agent', 'Task'])
// A model id as people say it: claude-opus-5-5 is "Opus 5.5", haiku is "Haiku".
const modelName = (id: string): string => {
  const m = /(opus|sonnet|haiku|fable|mythos)(?:[-_ ](\d+)(?:[-_.](\d+))?)?/i.exec(id)
  if (m === null) {
    return id
  }
  const family = (m[1] ?? '').charAt(0).toUpperCase() + (m[1] ?? '').slice(1).toLowerCase()
  return m[2] === undefined ? family : `${family} ${m[2]}${m[3] !== undefined ? `.${m[3]}` : ''}`
}
// The longest text a tool call carries: a helper's hand-back report, whatever the field is called.
const longestText = (input: unknown): string => {
  const fields = input as Record<string, unknown>
  return Object.entries(fields)
    .filter(([key, value]) => !RESERVED_KEYS.has(key) && typeof value === 'string')
    .map(([, value]) => value as string)
    .reduce((best, one) => (one.length > best.length ? one : best), '')
}
const HANDBACK_TOOLS = /handback|hand_back|report/i
let agentSeq = 0
const agentIdOf = (e: unknown): string | undefined => {
  const id = (e as { agentId?: unknown }).agentId
  return typeof id === 'string' && id !== '' ? id : undefined
}
const agentLaunched = async ($: Engine, input: unknown): Promise<string> => {
  const fields = input as Record<string, unknown>
  const text = (key: string) => (typeof fields[key] === 'string' ? (fields[key] as string).trim() : '')
  agentSeq += 1
  const key = `run-${agentSeq}`
  const now = await $.clock.now()
  const row: AgentRun = {
    key,
    agentId: null,
    kind: text('subagent_type') || 'general-purpose',
    description: text('description'),
    prompt: clip(text('prompt'), FULL_MOST),
    start: now,
    end: null,
    last: now,
    calls: 0,
    failed: 0,
    status: 'running',
    model: text('model') || null,
    report: '',
    tools: {},
    recent: [],
  }
  await update($, agents, list => [...list, row].slice(-20))
  return key
}
const agentCallReturned = async ($: Engine, key: string, isError: boolean, tookMs: number) => {
  const now = await $.clock.now()
  await update($, agents, list =>
    list.map(row => {
      if (row.key !== key || row.end !== null) {
        return row
      }
      // Refused or failed at once; or, never linked to turns of its own and the call took
      // a while, so it ran in the foreground and is done.
      if (isError) {
        return { ...row, end: now, last: now, status: 'failed' }
      }
      if (row.agentId === null && tookMs > 3000) {
        return { ...row, end: now, last: now, status: 'done' }
      }
      return row
    }),
  )
}
const agentStarted = async ($: Engine, agentId: string) => {
  const now = await $.clock.now()
  await update($, agents, list => {
    const known = list.findIndex(row => row.agentId === agentId)
    if (known >= 0) {
      // Continued with a new message: running again.
      return list.map((row, i) => (i === known ? { ...row, end: null, last: now, status: 'running' } : row))
    }
    // Helpers started together begin in the order they were launched: the oldest waiting row.
    const waiting = list.findIndex(row => row.agentId === null && row.end === null)
    return waiting < 0 ? list : list.map((row, i) => (i === waiting ? { ...row, agentId, last: now } : row))
  })
}
const agentCalled = async ($: Engine, agentId: string, isError: boolean, tool: string, input: unknown) => {
  const now = await $.clock.now()
  // Its hand-back is kept as its report rather than counted as work.
  const report = HANDBACK_TOOLS.test(tool) ? clip(longestText(input).trim(), FULL_MOST) : ''
  const label = toolLabel(tool)
  const target = targetOf(tool, input)
  await update($, agents, list =>
    list.map(row => {
      if (row.agentId !== agentId) {
        return row
      }
      if (report !== '') {
        return { ...row, report, last: now }
      }
      const tools = { ...(row.tools ?? {}) }
      tools[label] = (tools[label] ?? 0) + 1
      const recent = [...(row.recent ?? []), `${isError ? '✖ ' : ''}${label}${target !== '' ? ` ${target}` : ''}`].slice(-5)
      return { ...row, calls: row.calls + 1, failed: row.failed + (isError ? 1 : 0), last: now, tools, recent }
    }),
  )
}
const agentFinished = async ($: Engine, agentId: string) => {
  const now = await $.clock.now()
  await update($, agents, list =>
    list.map(row => (row.agentId === agentId ? { ...row, end: now, last: now, status: row.failed > 0 ? 'failed' : 'done' } : row)),
  )
}
// A helper nothing has been heard from for this long is shown as unknown rather than running.
const AGENT_QUIET_MS = 30 * 60 * 1000

const refresh = async ($: Engine) => {
  try {
    void checkAppLook($)
    if (busy) {
      lastSeconds = Math.round(((await $.clock.now()) - startedAt) / 1000)
    }
    const model = await $.session.model().catch(() => '--')
    const usage = await $.session.usage().catch(() => undefined)
    const folder = await $.session.root().catch(() => null)
    const limit = (kind: string) => usage?.rateLimits.find(l => l.kind === kind)
    const next: Readout = {
      model,
      fiveHour: limit('five_hour')?.percentUsed ?? null,
      week: limit('seven_day')?.percentUsed ?? null,
      fiveHourResets: limit('five_hour')?.resetsAt ?? null,
      weekResets: limit('seven_day')?.resetsAt ?? null,
      contextPercent: usage?.context.percent ?? null,
      contextTokens: usage?.context.tokens ?? null,
      contextWindow: usage?.context.window ?? null,
      folder,
      usd: usage?.cost?.usd ?? null,
      tools,
      seconds: lastSeconds,
    }
    // Stored only when something changed: every store redraws the band and the whole
    // dashboard, graphs included, which costs a PC without a graphics card.
    if (JSON.stringify(await read($, readout)) !== JSON.stringify(next)) {
      await update($, readout, () => next)
    }
  } catch (error) {
    if (!reported) {
      reported = true
      $.ui.toast(`HUD readout failed: ${String(error)}`)
    }
  }
}

// The demo tab: the dashboard drawn in a pane of its own from a made-up session (a small
// weather app), for screenshots and for a look before using it. The real dashboard, the
// band and the session's own figures are left as they are. Opened by asking Claude for the
// ops-deck demo (the hud tool's "demo" action).
const DEMO_PANE = 'ops-deck-demo'
const DEMO_ROOT = 'C:/Projects/weather-app'
type DemoSession = {
  readout: Readout
  turns: TurnRecord[]
  toolUse: Record<string, ToolCount>
  files: FileTouch[]
  reach: NetReach[]
  agents: AgentRun[]
}
const demoSession = (now: number): DemoSession => {
  const ago = (minutes: number) => now - minutes * 60000
  const iso = (minutes: number) => new Date(now + minutes * 60000).toISOString()
  const file = (path: string, read: number, edit: number, write: number, minutes: number, turnList: number[]): FileTouch => ({
    path: `${DEMO_ROOT}/${path}`,
    read,
    edit,
    write,
    last: ago(minutes),
    turns: turnList,
  })
  const count = (n: number, bad: number, minutes: number, target: string, full: string, failedFull?: string): ToolCount => ({
    count: n,
    failed: bad,
    last: ago(minutes),
    target,
    full,
    ...(failedFull !== undefined ? { failedFull, failedReason: 'failed' } : {}),
  })
  const agent = (
    n: number,
    kind: string,
    description: string,
    model: string | null,
    startMin: number,
    endMin: number | null,
    calls: number,
    toolCounts: Record<string, number>,
    recent: string[],
    report: string,
  ): AgentRun => ({
    key: `demo-${n}`,
    agentId: `demo-agent-${n}`,
    kind,
    description,
    prompt: `${description}. Report back with the files and lines involved.`,
    start: ago(startMin),
    end: endMin === null ? null : ago(endMin),
    last: ago(endMin ?? 0),
    calls,
    failed: 0,
    status: endMin === null ? 'running' : 'done',
    model,
    report,
    tools: toolCounts,
    recent,
  })
  return {
    readout: {
      model: 'claude-opus-5-5',
      contextPercent: 38,
      contextTokens: 76000,
      contextWindow: 200000,
      fiveHour: 27,
      week: 41,
      fiveHourResets: iso(134),
      weekResets: iso(3 * 24 * 60 + 200),
      usd: 1.84,
      tools: 6,
      seconds: 0,
      folder: DEMO_ROOT.replace(/\//g, '\\'),
    },
    turns: [44, 31, 29, 22, 12, 3].map((minutes, i) => ({
      at: ago(minutes),
      seconds: [38, 95, 142, 71, 186, 64][i] ?? 60,
      tools: [6, 14, 19, 9, 23, 11][i] ?? 5,
      failed: i === 4 ? 1 : 0,
    })),
    toolUse: {
      Read: count(34, 0, 3, 'cache.test.ts', `${DEMO_ROOT}/tests/cache.test.ts`),
      Edit: count(16, 0, 9, 'forecast.test.ts', `${DEMO_ROOT}/tests/forecast.test.ts`),
      Bash: count(11, 1, 2, 'npm test', 'npm test -- --reporter=dot', 'npm run build && npm run lint'),
      Grep: count(8, 0, 14, 'fetchForecast', 'fetchForecast in src'),
      Glob: count(5, 0, 40, 'src/**/*.tsx', 'src/**/*.tsx'),
      Write: count(3, 0, 6, 'units.test.ts', `${DEMO_ROOT}/tests/units.test.ts`),
      WebFetch: count(2, 0, 33, 'open-meteo.com', 'https://open-meteo.com/en/docs'),
      Agent: count(3, 0, 26, 'Explore', 'Find where the forecast is cached'),
    },
    files: [
      file('README.md', 1, 1, 0, 52, [1, 6]),
      file('package.json', 2, 1, 0, 50, [1, 2]),
      file('src/main.ts', 3, 2, 0, 44, [1, 2, 4]),
      file('src/api/forecast.ts', 4, 3, 0, 31, [2, 3, 4]),
      file('src/api/geocode.ts', 2, 1, 0, 30, [3]),
      file('src/api/cache.ts', 1, 0, 1, 29, [3]),
      file('src/ui/App.tsx', 3, 2, 0, 22, [4, 5]),
      file('src/ui/ForecastCard.tsx', 2, 2, 0, 18, [5]),
      file('src/ui/CitySearch.tsx', 2, 1, 0, 17, [5]),
      file('src/ui/styles.css', 1, 1, 0, 16, [5]),
      file('src/utils/units.ts', 2, 0, 0, 12, [5, 6]),
      file('tests/forecast.test.ts', 2, 1, 0, 9, [3, 6]),
      file('tests/units.test.ts', 0, 0, 1, 6, [6]),
      file('tests/cache.test.ts', 1, 0, 1, 3, [6]),
    ],
    reach: [
      { host: 'open-meteo.com', scope: 'web', tool: 'WebFetch', how: 'open-meteo.com/en/docs', full: 'https://open-meteo.com/en/docs', count: 2, blocked: 0, last: ago(33) },
      { host: 'registry.npmjs.org', scope: 'web', tool: 'Bash', how: 'npm install date-fns', full: 'npm install date-fns', count: 1, blocked: 0, last: ago(48) },
      { host: '192.168.1.20', scope: 'lan', tool: 'Bash', how: 'curl http://192.168.1.20:8080/health', full: 'curl http://192.168.1.20:8080/health', count: 0, blocked: 1, last: ago(20) },
    ],
    agents: [
      agent(1, 'Explore', 'Find where the forecast is cached', 'haiku', 28, 26, 9, { Grep: 4, Read: 5 }, ['Grep cache', 'Read cache.ts', 'Read forecast.ts'], 'The forecast is cached in src/api/cache.ts for 10 minutes, keyed by city.'),
      agent(2, 'general-purpose', 'Write unit tests for the units helper', 'sonnet', 11, 6, 14, { Read: 4, Write: 1, Bash: 3 }, ['Read units.ts', 'Write units.test.ts', 'Bash npm test'], 'Added 8 tests in tests/units.test.ts; all pass.'),
      agent(3, 'Plan', 'Plan the 7-day forecast view', null, 4, null, 5, { Read: 3, Grep: 2 }, ['Read App.tsx', 'Grep ForecastCard'], ''),
    ],
  }
}
const openDemo = async ($: Engine): Promise<string> => {
  await $.ui.open({ id: DEMO_PANE, title: 'ops-deck · Demo', focus: true })
  return 'The ops-deck demo is open in its own tab: the dashboard with a made-up session. The real dashboard is unchanged; close the demo tab when done.'
}

// What happened at start-up, for the debug report.
const startLog: string[] = []
const attempt = async (label: string, run: () => Promise<unknown>) => {
  try {
    await run()
    startLog.push(`${label}: ok`)
  } catch (error) {
    startLog.push(`${label}: ${String(error)}`)
  }
}

const diagnose = async ($: Engine): Promise<string> => {
  const background = await $.store.get('background')
  const scene = await $.store.get('scene')
  const dashboard = await $.store.get('dashboard')
  const surface = await $.session.surface().catch(() => 'error')
  const surfaces = await $.session.surfaces().catch(() => ['error'])
  const r = await read($, readout).catch(error => `error: ${String(error)}`)
  const lines = [
    `store.background: ${JSON.stringify(background)}`,
    `store.scene: ${JSON.stringify(scene)}`,
    `store.dashboard: ${JSON.stringify(dashboard)}`,
    `theme.set: ${JSON.stringify(lastSet)}`,
    `surface: ${JSON.stringify(surface)}`,
    `surfaces: ${JSON.stringify(surfaces)}`,
    `readout: ${JSON.stringify(r)}`,
    `colors problems: ${problems.filter(p => p.startsWith("Desktop won't paint")).length}`,
    `paper colors problems: ${paperProblems.filter(p => p.startsWith("Desktop won't paint")).length}`,
    `renders seen: ${JSON.stringify(seen)}`,
    `start: ${startLog.join('; ')}`,
  ]
  return lines.join('\n')
}

// Writes the report beside the mod, so it can be read without a command or tool.
const dump = async ($: Engine, when: string) => {
  try {
    const at = new Date(await $.clock.now()).toISOString()
    await $.fs.write(`${$.plugin.root}/debug.txt`, `${when} at ${at}
${await diagnose($)}
`)
  } catch (error) {
    $.ui.toast(`HUD: could not write debug.txt: ${String(error)}`)
  }
}

// After work: the fading frame stays up, faded out, until the next job. It is not swapped
// for the rest frame: a swap made the app show a still image of the outgoing frame, which
// flashed it back. So "rest" is only the dark frame before the first job of a session.
const settleLater = ($: Engine) => {
  settleTimer?.cancel()
  settled = false
  void $
}

// The saved scene, or the first one.
const savedScene = async ($: Engine): Promise<SceneName> => {
  const stored = sceneNamed(await $.store.get('scene'))
  return isSceneName(stored) ? stored : DEFAULT_SCENE
}

// Applies the saved switches: the named background, or the colours alone.
const applyTheme = async ($: Engine) => {
  const isOn = await read($, isBackgroundOn)
  const own: Look = (await read($, appLook)) === 'light' ? 'light' : 'dark'
  const set = await $.theme.set(isOn ? lookFor(await savedScene($), own) : PLAIN[own])
  lastSet = set
  return set
}

// The HUD itself (colours, band) is always on; the moving background, its scene and
// the dashboard switch, each remembered across sessions.
const setBackground = async ($: Engine, isOn: boolean): Promise<string> => {
  await $.store.set('background', isOn)
  await update($, isBackgroundOn, () => isOn)
  await applyTheme($)
  return isOn ? 'HUD background on.' : 'HUD background off; the colours and the band stay.'
}

const setScene = async ($: Engine, name: SceneName): Promise<string> => {
  await $.store.set('scene', name)
  await update($, currentScene, () => name)
  await $.store.set('background', true)
  await update($, isBackgroundOn, () => true)
  await applyTheme($)
  return `HUD background: ${name}.`
}

const setDashboard = async ($: Engine, isOn: boolean): Promise<string> => {
  await $.store.set('dashboard', isOn)
  await update($, isDashboardOpen, () => isOn)
  if (isOn) {
    const opened = await $.ui.open({ id: PANE, title: paneTitle })
    return opened.isPlaced ? 'HUD dashboard open.' : `HUD dashboard opened, waiting for room: ${opened.reason}`
  }
  await $.ui.close({ id: PANE })
  // The help belongs to the dashboard: it closes with it.
  await $.ui.close({ id: HELP_PANE }).catch(() => undefined)
  return 'HUD dashboard closed.'
}

// This session's name, as the app saved it in the transcript (its last "custom-title"
// row), or null. The transcript is ~/.claude/projects/<project>/<session id>.jsonl; it
// can be too big to read whole (one read is at most 4 MiB), so it is read from the end in
// overlapping windows, and the first title row found there is the last one written.
// The title rows, and how the transcript is read from its end: 4 MiB windows overlapping
// by 64 KiB, at most 16 of them (the last 60 MiB or so).
const TITLE_MARK = '"type":"custom-title"'
const TITLE_WINDOW = 4 * 1024 * 1024
const TITLE_OVERLAP = 64 * 1024
const TITLE_WINDOWS = 16
const findSessionName = async ($: Engine): Promise<string | null> => {
  const id = await $.session.id()
  const projects = `${$.plugin.root.replace(/[\\/]mods[\\/][^\\/]+[\\/]?$/, '')}/projects`
  const folders = await $.fs.list(projects).catch(() => [])
  let file: string | null = null
  for (const folder of folders) {
    const candidate = `${projects}/${folder.name}/${id}.jsonl`
    if (folder.kind === 'dir' && (await $.fs.exists(candidate))) {
      file = candidate
      break
    }
  }
  if (file === null) {
    return null
  }
  const { size } = await $.fs.stat(file)
  // A title row is short: a window overlaps the next by more than one, so every row is
  // whole in some window. The first line of a window and the last (unless it ends the
  // file) may be cut, and are left to the neighbouring windows.
  let end = size
  for (let windows = 0; end > 0 && windows < TITLE_WINDOWS; windows += 1) {
    const start = Math.max(0, end - TITLE_WINDOW)
    const text = await $.fs.read(file, { offset: start, length: end - start })
    const lines = text.split('\n')
    const last = end === size ? lines.length - 1 : lines.length - 2
    const first = start === 0 ? 0 : 1
    for (let i = last; i >= first; i -= 1) {
      const line = lines[i]?.trim() ?? ''
      if (!line.includes(TITLE_MARK)) continue
      let row: { customTitle?: unknown }
      try {
        row = JSON.parse(line) as { customTitle?: unknown }
      } catch {
        continue
      }
      if (typeof row.customTitle === 'string' && row.customTitle.trim() !== '') return row.customTitle.trim()
    }
    if (start === 0) break
    end = start + TITLE_OVERLAP
  }
  return null
}

// Puts the session's name in the dashboard's title, when it changed. Looked up at most
// every five minutes: the search reads the transcript.
let retitledAt = -Infinity
const retitle = async ($: Engine): Promise<void> => {
  const now = await $.clock.now()
  if (now - retitledAt < 5 * 60000) return
  retitledAt = now
  try {
    const title = titleFor(await findSessionName($))
    if (title !== paneTitle) {
      paneTitle = title
      if (await read($, isDashboardOpen)) {
        await $.ui.open({ id: PANE, title })
      }
    }
  } catch (error: unknown) {
    lastSet = `retitle failed: ${String(error)}`
  }
}

// Opens Windows Explorer with the file selected, or ('open') opens a folder itself.
const revealFile = async ($: Engine, path: string, how: 'select' | 'open' = 'select'): Promise<void> => {
  const windowsPath = path.replace(/\//g, '\\')
  const args = how === 'open' ? `('"' + $env:OPSDECK_FILE + '"')` : `('/select,"' + $env:OPSDECK_FILE + '"')`
  const title = how === 'open' ? `(Split-Path -Leaf $env:OPSDECK_FILE)` : `(Split-Path -Leaf (Split-Path -Parent $env:OPSDECK_FILE))`
  // The engine ends the child's process tree when PowerShell exits, so PowerShell waits
  // (-Wait) until explorer.exe has handed the window to the shell, then raises it: a
  // window opened from a background process otherwise stays behind the app.
  const script = [
    `$p = Start-Process -FilePath explorer.exe -ArgumentList ${args} -PassThru -Wait`,
    `Start-Sleep -Milliseconds 800`,
    `$w = New-Object -ComObject WScript.Shell`,
    `$up = $w.AppActivate(${title})`,
    `Write-Output ('launcher exit ' + $p.ExitCode + ', raised ' + $up)`,
    `exit 0`,
  ].join('; ')
  let outcome: string
  try {
    const ran = await $.process.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', script], {
      env: { OPSDECK_FILE: windowsPath },
      timeoutMs: 15000,
    })
    outcome = `exit ${ran.exitCode} ${ran.stdout.trim()} ${ran.stderr.trim()}`
    if (ran.exitCode !== 0) {
      $.ui.toast(`Could not open Explorer: ${ran.stderr.trim() || `exit ${ran.exitCode}`}`)
    }
  } catch (error: unknown) {
    outcome = `failed: ${String(error)}`
    $.ui.toast(`Could not open Explorer: ${String(error)}`)
  }
  // What the last press did, for when it seems to do nothing.
  await $.fs.write(`${$.plugin.root}/reveal.txt`, `${windowsPath}\n${outcome}\n`).catch(() => undefined)
}

// The version shown in the dashboard; build.ps1 checks it matches .claude-plugin/plugin.json.
const VERSION = '1.2.2'
// Where the project lives on GitHub (shown in the help's credits).
const REPO_URL = 'https://github.com/leoplusma/ops-deck'

// The ops-deck logo, drawn as a vector (shield with a trace and a lit dot, then the name)
// so it stays sharp at any size and weighs almost nothing.
const LOGO_GREY = '#b8c2d0'
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 70">
<g transform="translate(4 3) scale(.58)" fill="none" stroke="${LOGO_GREY}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
<path d="M50 5C38 16 24 22 8 25V60C8 82 30 98 50 108C70 98 92 82 92 60V25C76 22 62 16 50 5Z"/>
<path d="M22 50H40Q48 50 48 58V75"/>
<circle cx="68" cy="51" r="5.5" fill="#22d3ee" stroke="none"/>
</g>
<text x="70" y="48" font-family="Segoe UI, Arial, sans-serif" font-size="38" letter-spacing="1"><tspan fill="${LOGO_GREY}">ops-</tspan><tspan fill="#22d3ee">deck</tspan></text>
</svg>`

// The dashboard's help is open while "help" is in the folded list (it starts shut).
const HELP = 'help'

// The languages of the dashboard, its help and the band. To add a language: add it to Lang
// and LANGS, give it a table of the same shape as EN, and add that table to TEXTS.
type Lang = 'en' | 'el' | 'de' | 'fr' | 'es' | 'it' | 'pt' | 'zh' | 'ja' | 'ar'
const LANGS: readonly { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'el', label: 'Ελληνικά' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
  { value: 'zh', label: '简体中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ar', label: 'العربية' },
]
const isLang = (value: unknown): value is Lang => LANGS.some(one => one.value === value)
type Reason = 'failed' | 'blocked' | string

// Right-to-left languages (Arabic, Hebrew, Persian...). The dashboard, the help and the band
// take their Box and Text through directed(), so a language whose table says dir: 'rtl'
// mirrors with no change to the drawing code: every row runs from the right (row becomes
// row-reverse, and the reverse) and every Text reads right to left, flush right. Columns,
// the graphs and the timeline keep their shape (time still runs left to right).
type Dir = 'ltr' | 'rtl'
const ROW_FLIP: Record<string, string> = { row: 'row-reverse', 'row-reverse': 'row' }
const directed = <T extends { Box: unknown; Text: unknown }>(table: T, dir: Dir): T => {
  if (dir === 'ltr') {
    return table
  }
  type Props = Record<string, unknown> & { children?: unknown }
  const draw = (tag: unknown, { children, ...props }: Props) => {
    const kids = children === undefined ? [] : Array.isArray(children) ? children : [children]
    return h(tag as never, props, ...kids)
  }
  const Box = (props: Props) => {
    const way = typeof props.flexDirection === 'string' ? ROW_FLIP[props.flexDirection] : undefined
    return draw(table.Box, way === undefined ? props : { ...props, flexDirection: way })
  }
  const Text = (props: Props) => draw(table.Text, { dir: 'rtl', ...props })
  return { ...table, Box, Text } as T
}

const EN = {
  // Which way the language reads: ltr, or rtl for a right-to-left script (see directed).
  dir: 'ltr' as Dir,
  scene: 'Scene',
  none: 'None',
  language: 'Language',
  help: '? Help',
  hideHelp: 'Hide help',
  close: 'Close',
  // The band.
  active: '◉ ACTIVE',
  // What Claude is doing, shown in the band while it works with no moving background.
  doing: { think: '◉ THINKING', files: '◉ FILES', run: '◉ RUNNING', web: '◉ WEB' } as Record<Activity, string>,
  standby: '○ STANDBY',
  done: '✔ DONE',
  alertLine: (tool: string, reason: Reason) => `▲ ${tool.toUpperCase()} ${reason.toUpperCase()}`,
  local: '⌂ LOCAL',
  toast: (tool: string, reason: Reason) => `▲ HUD ALERT: ${tool} ${reason}`,
  // The network half.
  stayed: '◉ Stayed on this PC',
  stayedNote: 'no web, network or connector calls',
  network: 'network',
  networkTag: 'NETWORK',
  blocked: (n: number) => `${n} blocked`,
  more: (n: number) => `+${n} more`,
  netGlance: (n: number) => (n === 0 ? 'NET this PC only' : `NET ${n} outside`),
  // Usage: when a window starts again.
  resetIn: (hours: number, m: string) => `in ${hours}h ${m}m`,
  days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  // Files.
  filesTitle: (n: number) => `FILES TOUCHED · ${n}`,
  noFiles: 'No files read or changed yet.',
  written: 'written',
  edited: 'edited',
  read: 'read',
  folder: 'folder',
  filesWord: 'files',
  // Tools.
  toolsTitle: (tools: number, calls: number) => `TOOLS USED · ${tools} tools · ${calls} calls`,
  noTools: 'No tool calls yet.',
  failed: (n: number) => `${n} failed`,
  lastCall: 'LAST CALL',
  lastFailed: (reason: Reason) => `LAST ${reason.toUpperCase()}`,
  sameCommand: (reason: Reason) => `▲ last ${reason}: this same command`,
  copy: '⧉ Copy',
  // Turns.
  turnsTitle: 'RECENT TURNS',
  noTurns: 'No finished turns yet.',
  ops: 'ops',
  // Help.
  hBand: 'THE BAND ABOVE THE PROMPT',
  hState: 'working · idle · just finished with no errors',
  hFrame: 'frame: green while working, red after a tool failed or was blocked',
  hCtx: 'context used: amber from 70%, red with ⚠ from 90% (time to /compact)',
  hNet: 'stayed on this PC · places reached outside it · tries a hook blocked',
  hUse: 'plan usage in the 5-hour and weekly windows',
  hTime: 'total time Claude has worked this session',
  hOps: 'tool calls this turn · estimated API cost of the session',
  hDeck: 'opens or closes this dashboard',
  hColour: 'BACKGROUND COLOUR: WHAT CLAUDE IS DOING',
  hThink: 'thinking',
  hFiles: 'reading or changing files',
  hRun: 'running commands, scripts or other tools',
  hWeb: 'reaching the web or the network',
  hAlert: 'a tool failed or was blocked',
  hFilesTools: 'FILES AND TOOLS',
  hFileDots: 'file written · amber edited · cyan read; bigger is touched more',
  hRing: 'the file touched last · lines join files worked on in one turn',
  hBars: 'calls of a tool against the most used one; amber if a call failed',
  hOpen: 'shows the whole last command · copies it',
  hAsk: 'ASK CLAUDE',
  hAskText: '"open the ops-deck dashboard" · "close the ops-deck dashboard" · "ops-deck scene data room" · "ops-deck background off"',
  hCredits: 'CREDITS',
  hBy: 'Concept & direction',
  hCode: 'Code',
  hLogo: 'Logo',
  hRepo: 'Source',
  wholeView: 'Whole view',
  agentsTitle: (n: number) => `SUBAGENTS · ${n}`,
  noAgents: 'No helper agents started yet.',
  agentState: (s: string): string => (s === 'running' ? 'running' : s === 'done' ? 'done' : s === 'failed' ? 'failed' : 'no news'),
  calls: (n: number) => `${n} calls`,
  asked: 'ASKED',
  report: 'REPORT',
  toolsUsedBy: 'TOOLS',
  lastCalls: 'LAST CALLS',
  time: 'Time',
  asSession: 'session',
  unknownModel: 'model unknown',
  helpTitle: 'ops-deck · Help',
  hSubagents: 'SUBAGENTS (HELPER AGENTS)',
  hAgentWhat: 'a bar per helper, from when it started to when it ended; its colour is its model:',
  hAgentShape: 'solid: done · pale with a dot at the tip: running · red outline and ✖: failed · dashed: no news for 30 minutes',
  hAgentGap: 'idle time between batches of helpers is folded into a break, so each batch fills the width',
  hAgentSheet: 'opens a helper\'s fact sheet: what it was asked, its report, its tools, its last calls and its times · copies them',
  hZoom: 'click a file or folder to zoom in · click empty space or ⤢ to see it all',
}
type Texts = typeof EN
// Greek capitals carry no accents, so the capital texts are written out in full.
const EL: Texts = {
  dir: 'ltr',
  scene: 'Σκηνή',
  none: 'Καμία',
  language: 'Γλώσσα',
  help: '? Βοήθεια',
  hideHelp: 'Κλείσιμο βοήθειας',
  close: 'Κλείσιμο',
  active: '◉ ΣΕ ΛΕΙΤΟΥΡΓΙΑ',
  // What Claude is doing, shown in the band while it works with no moving background.
  doing: { think: '◉ ΣΚΕΨΗ', files: '◉ ΑΡΧΕΙΑ', run: '◉ ΕΚΤΕΛΕΣΗ', web: '◉ WEB' } as Record<Activity, string>,
  standby: '○ ΑΝΑΜΟΝΗ',
  done: '✔ ΕΤΟΙΜΟ',
  alertLine: (tool: string, reason: Reason) =>
    `▲ ${tool.toUpperCase()} ${reason === 'blocked' ? 'ΜΠΛΟΚΑΡΙΣΤΗΚΕ' : 'ΑΠΕΤΥΧΕ'}`,
  local: '⌂ ΤΟΠΙΚΑ',
  toast: (tool: string, reason: Reason) =>
    `▲ ΣΦΑΛΜΑ HUD: ${tool} ${reason === 'blocked' ? 'μπλοκαρίστηκε' : 'απέτυχε'}`,
  stayed: '◉ Έμεινε σε αυτόν τον υπολογιστή',
  stayedNote: 'καμία κλήση σε web, δίκτυο ή connector',
  network: 'δίκτυο',
  networkTag: 'ΔΙΚΤΥΟ',
  blocked: (n: number) => `${n} μπλοκαρίστηκαν`,
  more: (n: number) => `+${n} ακόμη`,
  netGlance: (n: number) => (n === 0 ? 'ΔΙΚΤΥΟ μόνο τοπικά' : `ΔΙΚΤΥΟ ${n} εκτός`),
  resetIn: (hours: number, m: string) => `σε ${hours}ω ${m}λ`,
  days: ['Κυρ', 'Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ'],
  filesTitle: (n: number) => `ΑΡΧΕΙΑ · ${n}`,
  noFiles: 'Δεν έχουν διαβαστεί ή αλλάξει αρχεία ακόμη.',
  written: 'γράφτηκε',
  edited: 'άλλαξε',
  read: 'διαβάστηκε',
  folder: 'φάκελος',
  filesWord: 'αρχεία',
  toolsTitle: (tools: number, calls: number) => `ΕΡΓΑΛΕΙΑ · ${tools} εργαλεία · ${calls} κλήσεις`,
  noTools: 'Καμία κλήση εργαλείου ακόμη.',
  failed: (n: number) => `${n} απέτυχαν`,
  lastCall: 'ΤΕΛΕΥΤΑΙΑ ΚΛΗΣΗ',
  lastFailed: (reason: Reason) => (reason === 'blocked' ? 'ΤΕΛΕΥΤΑΙΑ ΜΠΛΟΚΑΡΙΣΜΕΝΗ' : 'ΤΕΛΕΥΤΑΙΑ ΑΠΟΤΥΧΗΜΕΝΗ'),
  sameCommand: (reason: Reason) =>
    `▲ η τελευταία ${reason === 'blocked' ? 'μπλοκαρισμένη' : 'αποτυχημένη'}: αυτή ακριβώς η εντολή`,
  copy: '⧉ Αντιγραφή',
  turnsTitle: 'ΠΡΟΣΦΑΤΟΙ ΓΥΡΟΙ',
  noTurns: 'Κανένας ολοκληρωμένος γύρος ακόμη.',
  ops: 'κλήσεις',
  hBand: 'Η ΜΠΑΡΑ ΠΑΝΩ ΑΠΟ ΤΟ PROMPT',
  hState: 'δουλεύει · σε αναμονή · μόλις τελείωσε χωρίς σφάλματα',
  hFrame: 'πλαίσιο: πράσινο όσο δουλεύει, κόκκινο όταν ένα εργαλείο απέτυχε ή μπλοκαρίστηκε',
  hCtx: 'χρήση context: πορτοκαλί από 70%, κόκκινο με ⚠ από 90% (ώρα για /compact)',
  hNet: 'έμεινε σε αυτόν τον υπολογιστή · μέρη εκτός του · προσπάθειες που μπλόκαρε ένα hook',
  hUse: 'χρήση του πλάνου στο 5ωρο και στην εβδομάδα',
  hTime: 'συνολικός χρόνος που δούλεψε ο Claude σε αυτή τη συνεδρία',
  hOps: 'κλήσεις εργαλείων σε αυτόν τον γύρο · εκτιμώμενο κόστος API της συνεδρίας',
  hDeck: 'ανοίγει ή κλείνει αυτόν τον πίνακα',
  hColour: 'ΧΡΩΜΑ ΦΟΝΤΟΥ: ΤΙ ΚΑΝΕΙ Ο CLAUDE',
  hThink: 'σκέφτεται',
  hFiles: 'διαβάζει ή αλλάζει αρχεία',
  hRun: 'τρέχει εντολές, scripts ή άλλα εργαλεία',
  hWeb: 'βγαίνει στο web ή στο δίκτυο',
  hAlert: 'ένα εργαλείο απέτυχε ή μπλοκαρίστηκε',
  hFilesTools: 'ΑΡΧΕΙΑ ΚΑΙ ΕΡΓΑΛΕΙΑ',
  hFileDots: 'αρχείο γράφτηκε · πορτοκαλί άλλαξε · γαλάζιο διαβάστηκε· όσο μεγαλύτερο, τόσο πιο συχνά',
  hRing: 'το αρχείο που άγγιξε τελευταίο · οι γραμμές ενώνουν αρχεία του ίδιου γύρου',
  hBars: 'κλήσεις ενός εργαλείου σε σχέση με το πιο συχνό· πορτοκαλί αν μια κλήση απέτυχε',
  hOpen: 'δείχνει ολόκληρη την τελευταία εντολή · την αντιγράφει',
  hAsk: 'ΠΕΙΤΕ ΣΤΟΝ CLAUDE',
  hAskText: '"άνοιξε το ops-deck dashboard" · "κλείσε το ops-deck dashboard" · "ops-deck σκηνή data room" · "ops-deck φόντο off"',
  hCredits: 'ΣΥΝΤΕΛΕΣΤΕΣ',
  hBy: 'Ιδέα & καθοδήγηση',
  hCode: 'Κώδικας',
  hLogo: 'Λογότυπο',
  hRepo: 'Κώδικας στο GitHub',
  wholeView: 'Όλη η εικόνα',
  agentsTitle: (n: number) => `ΒΟΗΘΟΙ ΠΡΑΚΤΟΡΕΣ · ${n}`,
  noAgents: 'Δεν έχει ξεκινήσει βοηθός ακόμη.',
  agentState: (s: string) => (s === 'running' ? 'τρέχει' : s === 'done' ? 'τελείωσε' : s === 'failed' ? 'απέτυχε' : 'χωρίς νέα'),
  calls: (n: number) => `${n} κλήσεις`,
  asked: 'ΤΟΥ ΖΗΤΗΘΗΚΕ',
  report: 'ΑΝΑΦΟΡΑ',
  toolsUsedBy: 'ΕΡΓΑΛΕΙΑ',
  lastCalls: 'ΤΕΛΕΥΤΑΙΕΣ ΚΛΗΣΕΙΣ',
  time: 'Ώρα',
  asSession: 'συνεδρία',
  unknownModel: 'άγνωστο μοντέλο',
  helpTitle: 'ops-deck · Βοήθεια',
  hSubagents: 'ΒΟΗΘΟΙ ΠΡΑΚΤΟΡΕΣ (SUBAGENTS)',
  hAgentWhat: 'μια μπάρα για κάθε βοηθό, από τη στιγμή που ξεκίνησε ως τη στιγμή που τελείωσε· το χρώμα της είναι το μοντέλο του:',
  hAgentShape: 'γεμάτη: τελείωσε · αχνή με τελεία στην άκρη: τρέχει · κόκκινο περίγραμμα και ✖: απέτυχε · διακεκομμένη: κανένα νέο για 30 λεπτά',
  hAgentGap: 'ο αδρανής χρόνος ανάμεσα σε ομάδες βοηθών διπλώνεται σε ένα διάλειμμα, ώστε κάθε ομάδα να γεμίζει το πλάτος',
  hAgentSheet: 'ανοίγει την καρτέλα ενός βοηθού: τι του ζητήθηκε, την αναφορά του, τα εργαλεία του, τις τελευταίες κλήσεις και τους χρόνους του · τα αντιγράφει',
  hZoom: 'κλικ σε αρχείο ή φάκελο για μεγέθυνση · κλικ σε κενό σημείο ή στο ⤢ για όλη την εικόνα',
}
const DE: Texts = {
  dir: 'ltr',
  scene: 'Szene',
  none: 'Keine',
  language: 'Sprache',
  help: '? Hilfe',
  hideHelp: 'Hilfe ausblenden',
  close: 'Schließen',
  active: '◉ AKTIV',
  // What Claude is doing, shown in the band while it works with no moving background.
  doing: { think: '◉ DENKT', files: '◉ DATEIEN', run: '◉ LÄUFT', web: '◉ WEB' } as Record<Activity, string>,
  standby: '○ BEREIT',
  done: '✔ FERTIG',
  alertLine: (tool: string, reason: Reason) =>
    `▲ ${tool.toUpperCase()} ${reason === 'blocked' ? 'BLOCKIERT' : 'FEHLGESCHLAGEN'}`,
  local: '⌂ LOKAL',
  toast: (tool: string, reason: Reason) => `▲ HUD-FEHLER: ${tool} ${reason === 'blocked' ? 'blockiert' : 'fehlgeschlagen'}`,
  stayed: '◉ Auf diesem PC geblieben',
  stayedNote: 'keine Web-, Netzwerk- oder Connector-Aufrufe',
  network: 'Netzwerk',
  networkTag: 'NETZWERK',
  blocked: (n: number) => `${n} blockiert`,
  more: (n: number) => `+${n} weitere`,
  netGlance: (n: number) => (n === 0 ? 'NETZ nur dieser PC' : `NETZ ${n} außerhalb`),
  resetIn: (hours: number, m: string) => `in ${hours} h ${m} min`,
  days: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  filesTitle: (n: number) => `DATEIEN · ${n}`,
  noFiles: 'Noch keine Dateien gelesen oder geändert.',
  written: 'geschrieben',
  edited: 'bearbeitet',
  read: 'gelesen',
  folder: 'Ordner',
  filesWord: 'Dateien',
  toolsTitle: (tools: number, calls: number) => `WERKZEUGE · ${tools} Werkzeuge · ${calls} Aufrufe`,
  noTools: 'Noch keine Werkzeugaufrufe.',
  failed: (n: number) => `${n} fehlgeschlagen`,
  lastCall: 'LETZTER AUFRUF',
  lastFailed: (reason: Reason) => (reason === 'blocked' ? 'ZULETZT BLOCKIERT' : 'ZULETZT FEHLGESCHLAGEN'),
  sameCommand: (reason: Reason) => `▲ zuletzt ${reason === 'blocked' ? 'blockiert' : 'fehlgeschlagen'}: genau dieser Befehl`,
  copy: '⧉ Kopieren',
  turnsTitle: 'LETZTE RUNDEN',
  noTurns: 'Noch keine abgeschlossenen Runden.',
  ops: 'Aufrufe',
  hBand: 'DIE LEISTE ÜBER DEM PROMPT',
  hState: 'arbeitet · wartet · gerade fehlerfrei fertig',
  hFrame: 'Rahmen: grün während der Arbeit, rot wenn ein Werkzeug fehlschlug oder blockiert wurde',
  hCtx: 'genutzter Kontext: gelb ab 70 %, rot mit ⚠ ab 90 % (Zeit für /compact)',
  hNet: 'auf diesem PC geblieben · erreichte Orte außerhalb · von einem Hook blockierte Versuche',
  hUse: 'Plan-Nutzung im 5-Stunden- und im Wochenfenster',
  hTime: 'gesamte Arbeitszeit von Claude in dieser Sitzung',
  hOps: 'Werkzeugaufrufe dieser Runde · geschätzte API-Kosten der Sitzung',
  hDeck: 'öffnet oder schließt dieses Dashboard',
  hColour: 'HINTERGRUNDFARBE: WAS CLAUDE GERADE TUT',
  hThink: 'denkt nach',
  hFiles: 'liest oder ändert Dateien',
  hRun: 'führt Befehle, Skripte oder andere Werkzeuge aus',
  hWeb: 'greift auf das Web oder das Netzwerk zu',
  hAlert: 'ein Werkzeug schlug fehl oder wurde blockiert',
  hFilesTools: 'DATEIEN UND WERKZEUGE',
  hFileDots: 'Datei geschrieben · gelb bearbeitet · cyan gelesen; je größer, desto öfter berührt',
  hRing: 'die zuletzt berührte Datei · Linien verbinden Dateien einer Runde',
  hBars: 'Aufrufe eines Werkzeugs im Vergleich zum meistgenutzten; gelb, wenn ein Aufruf fehlschlug',
  hOpen: 'zeigt den ganzen letzten Befehl · kopiert ihn',
  hAsk: 'CLAUDE FRAGEN',
  hAskText: '"öffne das ops-deck Dashboard" · "schließe das ops-deck Dashboard" · "ops-deck Szene data room" · "ops-deck Hintergrund aus"',
  hCredits: 'MITWIRKENDE',
  hBy: 'Idee & Leitung',
  hCode: 'Code',
  hLogo: 'Logo',
  hRepo: 'Quellcode',
  wholeView: 'Gesamtansicht',
  agentsTitle: (n: number) => `SUBAGENTEN · ${n}`,
  noAgents: 'Noch keine Hilfsagenten gestartet.',
  agentState: (s: string) => (s === 'running' ? 'läuft' : s === 'done' ? 'fertig' : s === 'failed' ? 'fehlgeschlagen' : 'keine Nachricht'),
  calls: (n: number) => `${n} Aufrufe`,
  asked: 'AUFTRAG',
  report: 'BERICHT',
  toolsUsedBy: 'WERKZEUGE',
  lastCalls: 'LETZTE AUFRUFE',
  time: 'Zeit',
  asSession: 'Sitzung',
  unknownModel: 'Modell unbekannt',
  helpTitle: 'ops-deck · Hilfe',
  hSubagents: 'SUBAGENTEN (HILFSAGENTEN)',
  hAgentWhat: 'ein Balken pro Helfer, vom Start bis zum Ende; seine Farbe ist sein Modell:',
  hAgentShape: 'voll: fertig · blass mit Punkt an der Spitze: läuft · rote Kontur und ✖: fehlgeschlagen · gestrichelt: 30 Minuten keine Nachricht',
  hAgentGap: 'Leerlauf zwischen Gruppen von Helfern wird zu einer Pause gefaltet, damit jede Gruppe die Breite füllt',
  hAgentSheet: 'öffnet das Datenblatt eines Helfers: Auftrag, Bericht, Werkzeuge, letzte Aufrufe und Zeiten · kopiert sie',
  hZoom: 'Datei oder Ordner anklicken zum Vergrößern · leere Fläche oder ⤢ anklicken für alles',
}
const FR: Texts = {
  dir: 'ltr',
  scene: 'Scène',
  none: 'Aucune',
  language: 'Langue',
  help: '? Aide',
  hideHelp: "Masquer l'aide",
  close: 'Fermer',
  active: '◉ ACTIF',
  // What Claude is doing, shown in the band while it works with no moving background.
  doing: { think: '◉ RÉFLEXION', files: '◉ FICHIERS', run: '◉ EXÉCUTION', web: '◉ WEB' } as Record<Activity, string>,
  standby: '○ EN ATTENTE',
  done: '✔ TERMINÉ',
  alertLine: (tool: string, reason: Reason) =>
    `▲ ${tool.toUpperCase()} ${reason === 'blocked' ? 'BLOQUÉ' : 'ÉCHEC'}`,
  local: '⌂ LOCAL',
  toast: (tool: string, reason: Reason) => `▲ ALERTE HUD : ${tool} ${reason === 'blocked' ? 'bloqué' : 'échec'}`,
  stayed: '◉ Resté sur ce PC',
  stayedNote: 'aucun appel web, réseau ou connecteur',
  network: 'réseau',
  networkTag: 'RÉSEAU',
  blocked: (n: number) => `${n} bloqué(s)`,
  more: (n: number) => `+${n} de plus`,
  netGlance: (n: number) => (n === 0 ? 'RÉSEAU ce PC seulement' : `RÉSEAU ${n} à l'extérieur`),
  resetIn: (hours: number, m: string) => `dans ${hours} h ${m}`,
  days: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
  filesTitle: (n: number) => `FICHIERS · ${n}`,
  noFiles: 'Aucun fichier lu ou modifié pour le moment.',
  written: 'écrit',
  edited: 'modifié',
  read: 'lu',
  folder: 'dossier',
  filesWord: 'fichiers',
  toolsTitle: (tools: number, calls: number) => `OUTILS · ${tools} outils · ${calls} appels`,
  noTools: "Aucun appel d'outil pour le moment.",
  failed: (n: number) => `${n} en échec`,
  lastCall: 'DERNIER APPEL',
  lastFailed: (reason: Reason) => (reason === 'blocked' ? 'DERNIER BLOQUÉ' : 'DERNIER ÉCHEC'),
  sameCommand: (reason: Reason) => `▲ dernier ${reason === 'blocked' ? 'blocage' : 'échec'} : cette même commande`,
  copy: '⧉ Copier',
  turnsTitle: 'TOURS RÉCENTS',
  noTurns: 'Aucun tour terminé pour le moment.',
  ops: 'appels',
  hBand: 'LA BANDE AU-DESSUS DU PROMPT',
  hState: 'au travail · en attente · vient de finir sans erreur',
  hFrame: "cadre : vert pendant le travail, rouge après l'échec ou le blocage d'un outil",
  hCtx: 'contexte utilisé : ambre dès 70 %, rouge avec ⚠ dès 90 % (moment de faire /compact)',
  hNet: 'resté sur ce PC · lieux atteints en dehors · tentatives bloquées par un hook',
  hUse: 'utilisation du forfait sur 5 heures et sur la semaine',
  hTime: 'temps total de travail de Claude dans cette session',
  hOps: "appels d'outils de ce tour · coût API estimé de la session",
  hDeck: 'ouvre ou ferme ce tableau de bord',
  hColour: 'COULEUR DU FOND : CE QUE FAIT CLAUDE',
  hThink: 'réfléchit',
  hFiles: 'lit ou modifie des fichiers',
  hRun: 'exécute des commandes, des scripts ou d’autres outils',
  hWeb: 'accède au web ou au réseau',
  hAlert: 'un outil a échoué ou a été bloqué',
  hFilesTools: 'FICHIERS ET OUTILS',
  hFileDots: 'fichier écrit · ambre modifié · cyan lu ; plus gros = plus souvent touché',
  hRing: 'le dernier fichier touché · les lignes relient les fichiers d’un même tour',
  hBars: "appels d'un outil par rapport au plus utilisé ; ambre si un appel a échoué",
  hOpen: 'affiche toute la dernière commande · la copie',
  hAsk: 'DEMANDER À CLAUDE',
  hAskText: '"ouvre le tableau ops-deck" · "ferme le tableau ops-deck" · "ops-deck scène data room" · "ops-deck fond off"',
  hCredits: 'CRÉDITS',
  hBy: 'Concept & direction',
  hCode: 'Code',
  hLogo: 'Logo',
  hRepo: 'Source',
  wholeView: 'Vue entière',
  agentsTitle: (n: number) => `SOUS-AGENTS · ${n}`,
  noAgents: "Aucun agent d'aide lancé pour le moment.",
  agentState: (s: string) => (s === 'running' ? 'en cours' : s === 'done' ? 'terminé' : s === 'failed' ? 'échec' : 'sans nouvelles'),
  calls: (n: number) => `${n} appels`,
  asked: 'DEMANDÉ',
  report: 'RAPPORT',
  toolsUsedBy: 'OUTILS',
  lastCalls: 'DERNIERS APPELS',
  time: 'Heure',
  asSession: 'session',
  unknownModel: 'modèle inconnu',
  helpTitle: 'ops-deck · Aide',
  hSubagents: "SOUS-AGENTS (AGENTS D'AIDE)",
  hAgentWhat: 'une barre par agent, de son début à sa fin ; sa couleur est son modèle :',
  hAgentShape: 'pleine : terminé · pâle avec un point au bout : en cours · contour rouge et ✖ : échec · pointillés : sans nouvelles depuis 30 minutes',
  hAgentGap: "le temps d'inactivité entre les groupes d'agents est replié en une pause, pour que chaque groupe remplisse la largeur",
  hAgentSheet: "ouvre la fiche d'un agent : sa demande, son rapport, ses outils, ses derniers appels et ses heures · les copie",
  hZoom: 'cliquez sur un fichier ou un dossier pour zoomer · cliquez dans le vide ou sur ⤢ pour tout voir',
}
const ES: Texts = {
  dir: 'ltr',
  scene: 'Escena',
  none: 'Ninguna',
  language: 'Idioma',
  help: '? Ayuda',
  hideHelp: 'Ocultar ayuda',
  close: 'Cerrar',
  active: '◉ ACTIVO',
  // What Claude is doing, shown in the band while it works with no moving background.
  doing: { think: '◉ PENSANDO', files: '◉ ARCHIVOS', run: '◉ EJECUTANDO', web: '◉ WEB' } as Record<Activity, string>,
  standby: '○ EN ESPERA',
  done: '✔ LISTO',
  alertLine: (tool: string, reason: Reason) =>
    `▲ ${tool.toUpperCase()} ${reason === 'blocked' ? 'BLOQUEADO' : 'FALLÓ'}`,
  local: '⌂ LOCAL',
  toast: (tool: string, reason: Reason) => `▲ ALERTA HUD: ${tool} ${reason === 'blocked' ? 'bloqueado' : 'falló'}`,
  stayed: '◉ Se quedó en este PC',
  stayedNote: 'ninguna llamada web, de red o de conector',
  network: 'red',
  networkTag: 'RED',
  blocked: (n: number) => `${n} bloqueadas`,
  more: (n: number) => `+${n} más`,
  netGlance: (n: number) => (n === 0 ? 'RED solo este PC' : `RED ${n} fuera`),
  resetIn: (hours: number, m: string) => `en ${hours} h ${m} min`,
  days: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  filesTitle: (n: number) => `ARCHIVOS · ${n}`,
  noFiles: 'Aún no se ha leído ni cambiado ningún archivo.',
  written: 'escrito',
  edited: 'editado',
  read: 'leído',
  folder: 'carpeta',
  filesWord: 'archivos',
  toolsTitle: (tools: number, calls: number) => `HERRAMIENTAS · ${tools} herramientas · ${calls} llamadas`,
  noTools: 'Aún no hay llamadas a herramientas.',
  failed: (n: number) => `${n} fallidas`,
  lastCall: 'ÚLTIMA LLAMADA',
  lastFailed: (reason: Reason) => (reason === 'blocked' ? 'ÚLTIMA BLOQUEADA' : 'ÚLTIMA FALLIDA'),
  sameCommand: (reason: Reason) => `▲ última ${reason === 'blocked' ? 'bloqueada' : 'fallida'}: este mismo comando`,
  copy: '⧉ Copiar',
  turnsTitle: 'TURNOS RECIENTES',
  noTurns: 'Aún no hay turnos terminados.',
  ops: 'llamadas',
  hBand: 'LA BANDA SOBRE EL PROMPT',
  hState: 'trabajando · en espera · recién terminado sin errores',
  hFrame: 'marco: verde mientras trabaja, rojo si una herramienta falló o fue bloqueada',
  hCtx: 'contexto usado: ámbar desde el 70 %, rojo con ⚠ desde el 90 % (hora de /compact)',
  hNet: 'se quedó en este PC · lugares alcanzados fuera · intentos bloqueados por un hook',
  hUse: 'uso del plan en las ventanas de 5 horas y semanal',
  hTime: 'tiempo total que Claude ha trabajado en esta sesión',
  hOps: 'llamadas a herramientas de este turno · coste API estimado de la sesión',
  hDeck: 'abre o cierra este panel',
  hColour: 'COLOR DEL FONDO: LO QUE HACE CLAUDE',
  hThink: 'pensando',
  hFiles: 'leyendo o cambiando archivos',
  hRun: 'ejecutando comandos, scripts u otras herramientas',
  hWeb: 'accediendo a la web o a la red',
  hAlert: 'una herramienta falló o fue bloqueada',
  hFilesTools: 'ARCHIVOS Y HERRAMIENTAS',
  hFileDots: 'archivo escrito · ámbar editado · cian leído; más grande = más veces tocado',
  hRing: 'el último archivo tocado · las líneas unen archivos de un mismo turno',
  hBars: 'llamadas de una herramienta frente a la más usada; ámbar si una llamada falló',
  hOpen: 'muestra el último comando completo · lo copia',
  hAsk: 'PÍDELE A CLAUDE',
  hAskText: '"abre el panel de ops-deck" · "cierra el panel de ops-deck" · "ops-deck escena data room" · "ops-deck fondo off"',
  hCredits: 'CRÉDITOS',
  hBy: 'Concepto y dirección',
  hCode: 'Código',
  hLogo: 'Logo',
  hRepo: 'Código fuente',
  wholeView: 'Vista completa',
  agentsTitle: (n: number) => `SUBAGENTES · ${n}`,
  noAgents: 'Aún no se ha iniciado ningún agente de ayuda.',
  agentState: (s: string) => (s === 'running' ? 'en curso' : s === 'done' ? 'terminado' : s === 'failed' ? 'falló' : 'sin noticias'),
  calls: (n: number) => `${n} llamadas`,
  asked: 'ENCARGO',
  report: 'INFORME',
  toolsUsedBy: 'HERRAMIENTAS',
  lastCalls: 'ÚLTIMAS LLAMADAS',
  time: 'Hora',
  asSession: 'sesión',
  unknownModel: 'modelo desconocido',
  helpTitle: 'ops-deck · Ayuda',
  hSubagents: 'SUBAGENTES (AGENTES DE AYUDA)',
  hAgentWhat: 'una barra por agente, desde que empezó hasta que terminó; su color es su modelo:',
  hAgentShape: 'llena: terminado · pálida con un punto en la punta: en curso · borde rojo y ✖: falló · discontinua: sin noticias en 30 minutos',
  hAgentGap: 'el tiempo inactivo entre grupos de agentes se pliega en una pausa, para que cada grupo ocupe el ancho',
  hAgentSheet: 'abre la ficha de un agente: su encargo, su informe, sus herramientas, sus últimas llamadas y sus horas · las copia',
  hZoom: 'haz clic en un archivo o carpeta para ampliar · clic en un espacio vacío o en ⤢ para verlo todo',
}
const IT: Texts = {
  dir: 'ltr',
  scene: 'Scena',
  none: 'Nessuna',
  language: 'Lingua',
  help: '? Aiuto',
  hideHelp: 'Nascondi aiuto',
  close: 'Chiudi',
  active: '◉ ATTIVO',
  // What Claude is doing, shown in the band while it works with no moving background.
  doing: { think: '◉ PENSA', files: '◉ FILE', run: '◉ ESECUZIONE', web: '◉ WEB' } as Record<Activity, string>,
  standby: '○ IN ATTESA',
  done: '✔ FATTO',
  alertLine: (tool: string, reason: Reason) =>
    `▲ ${tool.toUpperCase()} ${reason === 'blocked' ? 'BLOCCATO' : 'FALLITO'}`,
  local: '⌂ LOCALE',
  toast: (tool: string, reason: Reason) => `▲ ALLARME HUD: ${tool} ${reason === 'blocked' ? 'bloccato' : 'fallito'}`,
  stayed: '◉ Rimasto su questo PC',
  stayedNote: 'nessuna chiamata web, di rete o di connettore',
  network: 'rete',
  networkTag: 'RETE',
  blocked: (n: number) => `${n} bloccate`,
  more: (n: number) => `+${n} altri`,
  netGlance: (n: number) => (n === 0 ? 'RETE solo questo PC' : `RETE ${n} fuori`),
  resetIn: (hours: number, m: string) => `tra ${hours} h ${m} min`,
  days: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
  filesTitle: (n: number) => `FILE · ${n}`,
  noFiles: 'Nessun file letto o modificato finora.',
  written: 'scritto',
  edited: 'modificato',
  read: 'letto',
  folder: 'cartella',
  filesWord: 'file',
  toolsTitle: (tools: number, calls: number) => `STRUMENTI · ${tools} strumenti · ${calls} chiamate`,
  noTools: 'Nessuna chiamata a strumenti finora.',
  failed: (n: number) => `${n} fallite`,
  lastCall: 'ULTIMA CHIAMATA',
  lastFailed: (reason: Reason) => (reason === 'blocked' ? 'ULTIMA BLOCCATA' : 'ULTIMA FALLITA'),
  sameCommand: (reason: Reason) => `▲ ultima ${reason === 'blocked' ? 'bloccata' : 'fallita'}: proprio questo comando`,
  copy: '⧉ Copia',
  turnsTitle: 'TURNI RECENTI',
  noTurns: 'Nessun turno concluso finora.',
  ops: 'chiamate',
  hBand: 'LA BARRA SOPRA IL PROMPT',
  hState: 'al lavoro · in attesa · appena finito senza errori',
  hFrame: 'cornice: verde durante il lavoro, rossa se uno strumento è fallito o è stato bloccato',
  hCtx: 'contesto usato: ambra dal 70%, rosso con ⚠ dal 90% (è ora di /compact)',
  hNet: 'rimasto su questo PC · luoghi raggiunti fuori · tentativi bloccati da un hook',
  hUse: 'uso del piano nelle finestre di 5 ore e settimanale',
  hTime: 'tempo totale di lavoro di Claude in questa sessione',
  hOps: 'chiamate a strumenti in questo turno · costo API stimato della sessione',
  hDeck: 'apre o chiude questo pannello',
  hColour: 'COLORE DELLO SFONDO: COSA FA CLAUDE',
  hThink: 'sta pensando',
  hFiles: 'legge o modifica file',
  hRun: 'esegue comandi, script o altri strumenti',
  hWeb: 'accede al web o alla rete',
  hAlert: 'uno strumento è fallito o è stato bloccato',
  hFilesTools: 'FILE E STRUMENTI',
  hFileDots: 'file scritto · ambra modificato · ciano letto; più grande = toccato più spesso',
  hRing: "l'ultimo file toccato · le linee uniscono i file di uno stesso turno",
  hBars: 'chiamate di uno strumento rispetto al più usato; ambra se una chiamata è fallita',
  hOpen: "mostra l'intero ultimo comando · lo copia",
  hAsk: 'CHIEDI A CLAUDE',
  hAskText: '"apri il pannello ops-deck" · "chiudi il pannello ops-deck" · "ops-deck scena data room" · "ops-deck sfondo off"',
  hCredits: 'CREDITI',
  hBy: 'Ideazione e direzione',
  hCode: 'Codice',
  hLogo: 'Logo',
  hRepo: 'Sorgente',
  wholeView: 'Vista intera',
  agentsTitle: (n: number) => `SOTTOAGENTI · ${n}`,
  noAgents: 'Nessun agente di aiuto avviato finora.',
  agentState: (s: string) => (s === 'running' ? 'in corso' : s === 'done' ? 'finito' : s === 'failed' ? 'fallito' : 'nessuna notizia'),
  calls: (n: number) => `${n} chiamate`,
  asked: 'RICHIESTA',
  report: 'RAPPORTO',
  toolsUsedBy: 'STRUMENTI',
  lastCalls: 'ULTIME CHIAMATE',
  time: 'Ora',
  asSession: 'sessione',
  unknownModel: 'modello sconosciuto',
  helpTitle: 'ops-deck · Aiuto',
  hSubagents: 'SOTTOAGENTI (AGENTI DI AIUTO)',
  hAgentWhat: 'una barra per agente, da quando è partito a quando è finito; il colore è il suo modello:',
  hAgentShape: 'piena: finito · pallida con un punto in cima: in corso · bordo rosso e ✖: fallito · tratteggiata: nessuna notizia da 30 minuti',
  hAgentGap: "il tempo d'inattività tra gruppi di agenti è ripiegato in una pausa, così ogni gruppo riempie la larghezza",
  hAgentSheet: "apre la scheda di un agente: cosa gli è stato chiesto, il suo rapporto, gli strumenti, le ultime chiamate e gli orari · li copia",
  hZoom: 'clic su un file o una cartella per ingrandire · clic su uno spazio vuoto o su ⤢ per vedere tutto',
}
// Portuguese as written in Brazil (arquivo, tela), which most Portuguese readers use.
const PT: Texts = {
  dir: 'ltr',
  scene: 'Cena',
  none: 'Nenhuma',
  language: 'Idioma',
  help: '? Ajuda',
  hideHelp: 'Ocultar ajuda',
  close: 'Fechar',
  active: '◉ ATIVO',
  // What Claude is doing, shown in the band while it works with no moving background.
  doing: { think: '◉ PENSANDO', files: '◉ ARQUIVOS', run: '◉ EXECUTANDO', web: '◉ WEB' } as Record<Activity, string>,
  standby: '○ EM ESPERA',
  done: '✔ PRONTO',
  alertLine: (tool: string, reason: Reason) =>
    `▲ ${tool.toUpperCase()} ${reason === 'blocked' ? 'BLOQUEADO' : 'FALHOU'}`,
  local: '⌂ LOCAL',
  toast: (tool: string, reason: Reason) => `▲ ALERTA HUD: ${tool} ${reason === 'blocked' ? 'bloqueado' : 'falhou'}`,
  stayed: '◉ Ficou neste PC',
  stayedNote: 'nenhuma chamada à web, à rede ou a conectores',
  network: 'rede',
  networkTag: 'REDE',
  blocked: (n: number) => `${n} bloqueadas`,
  more: (n: number) => `+${n} mais`,
  netGlance: (n: number) => (n === 0 ? 'REDE só este PC' : `REDE ${n} fora`),
  resetIn: (hours: number, m: string) => `em ${hours} h ${m} min`,
  days: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  filesTitle: (n: number) => `ARQUIVOS · ${n}`,
  noFiles: 'Nenhum arquivo lido ou alterado ainda.',
  written: 'gravado',
  edited: 'editado',
  read: 'lido',
  folder: 'pasta',
  filesWord: 'arquivos',
  toolsTitle: (tools: number, calls: number) => `FERRAMENTAS · ${tools} ferramentas · ${calls} chamadas`,
  noTools: 'Nenhuma chamada de ferramenta ainda.',
  failed: (n: number) => `${n} falharam`,
  lastCall: 'ÚLTIMA CHAMADA',
  lastFailed: (reason: Reason) => (reason === 'blocked' ? 'ÚLTIMA BLOQUEADA' : 'ÚLTIMA FALHA'),
  sameCommand: (reason: Reason) => `▲ última ${reason === 'blocked' ? 'bloqueada' : 'falha'}: este mesmo comando`,
  copy: '⧉ Copiar',
  turnsTitle: 'RODADAS RECENTES',
  noTurns: 'Nenhuma rodada concluída ainda.',
  ops: 'chamadas',
  hBand: 'A FAIXA ACIMA DO PROMPT',
  hState: 'trabalhando · em espera · acabou de terminar sem erros',
  hFrame: 'moldura: verde enquanto trabalha, vermelha quando uma ferramenta falhou ou foi bloqueada',
  hCtx: 'contexto usado: âmbar a partir de 70%, vermelho com ⚠ a partir de 90% (hora de /compact)',
  hNet: 'ficou neste PC · lugares alcançados fora dele · tentativas bloqueadas por um hook',
  hUse: 'uso do plano nas janelas de 5 horas e semanal',
  hTime: 'tempo total que o Claude trabalhou nesta sessão',
  hOps: 'chamadas de ferramentas nesta rodada · custo estimado de API da sessão',
  hDeck: 'abre ou fecha este painel',
  hColour: 'COR DO FUNDO: O QUE O CLAUDE ESTÁ FAZENDO',
  hThink: 'pensando',
  hFiles: 'lendo ou alterando arquivos',
  hRun: 'executando comandos, scripts ou outras ferramentas',
  hWeb: 'acessando a web ou a rede',
  hAlert: 'uma ferramenta falhou ou foi bloqueada',
  hFilesTools: 'ARQUIVOS E FERRAMENTAS',
  hFileDots: 'arquivo gravado · âmbar editado · ciano lido; maior = mais vezes tocado',
  hRing: 'o último arquivo tocado · as linhas ligam arquivos de uma mesma rodada',
  hBars: 'chamadas de uma ferramenta em relação à mais usada; âmbar se uma chamada falhou',
  hOpen: 'mostra o último comando inteiro · copia',
  hAsk: 'PEÇA AO CLAUDE',
  hAskText: '"abra o painel do ops-deck" · "feche o painel do ops-deck" · "ops-deck cena data room" · "ops-deck fundo off"',
  hCredits: 'CRÉDITOS',
  hBy: 'Conceito e direção',
  hCode: 'Código',
  hLogo: 'Logo',
  hRepo: 'Código-fonte',
  wholeView: 'Visão completa',
  agentsTitle: (n: number) => `SUBAGENTES · ${n}`,
  noAgents: 'Nenhum agente auxiliar iniciado ainda.',
  agentState: (s: string) => (s === 'running' ? 'em andamento' : s === 'done' ? 'concluído' : s === 'failed' ? 'falhou' : 'sem notícias'),
  calls: (n: number) => `${n} chamadas`,
  asked: 'PEDIDO',
  report: 'RELATÓRIO',
  toolsUsedBy: 'FERRAMENTAS',
  lastCalls: 'ÚLTIMAS CHAMADAS',
  time: 'Hora',
  asSession: 'sessão',
  unknownModel: 'modelo desconhecido',
  helpTitle: 'ops-deck · Ajuda',
  hSubagents: 'SUBAGENTES (AGENTES AUXILIARES)',
  hAgentWhat: 'uma barra por agente, de quando começou até quando terminou; a cor é o seu modelo:',
  hAgentShape: 'cheia: concluído · clara com um ponto na ponta: em andamento · contorno vermelho e ✖: falhou · tracejada: sem notícias há 30 minutos',
  hAgentGap: 'o tempo ocioso entre grupos de agentes é dobrado numa pausa, para que cada grupo ocupe a largura',
  hAgentSheet: 'abre a ficha de um agente: o pedido, o relatório, as ferramentas, as últimas chamadas e os horários · copia tudo',
  hZoom: 'clique num arquivo ou pasta para ampliar · clique num espaço vazio ou em ⤢ para ver tudo',
}
// Simplified Chinese (mainland China and Singapore). Chinese has no capital letters, so the
// English capitals' headings are plain words here.
const ZH: Texts = {
  dir: 'ltr',
  scene: '场景',
  none: '无',
  language: '语言',
  help: '? 帮助',
  hideHelp: '隐藏帮助',
  close: '关闭',
  active: '◉ 运行中',
  // What Claude is doing, shown in the band while it works with no moving background.
  doing: { think: '◉ 思考中', files: '◉ 文件', run: '◉ 运行中', web: '◉ 网络' } as Record<Activity, string>,
  standby: '○ 待机',
  done: '✔ 完成',
  alertLine: (tool: string, reason: Reason) => `▲ ${tool.toUpperCase()} ${reason === 'blocked' ? '已拦截' : '失败'}`,
  local: '⌂ 本机',
  toast: (tool: string, reason: Reason) => `▲ HUD 警报：${tool} ${reason === 'blocked' ? '已拦截' : '失败'}`,
  stayed: '◉ 未离开本机',
  stayedNote: '没有网页、网络或连接器调用',
  network: '网络',
  networkTag: '网络',
  blocked: (n: number) => `${n} 次被拦截`,
  more: (n: number) => `还有 ${n} 个`,
  netGlance: (n: number) => (n === 0 ? '网络 仅本机' : `网络 外部 ${n} 处`),
  resetIn: (hours: number, m: string) => `${hours} 小时 ${m} 分后`,
  days: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
  filesTitle: (n: number) => `文件 · ${n}`,
  noFiles: '还没有读取或修改任何文件。',
  written: '写入',
  edited: '编辑',
  read: '读取',
  folder: '文件夹',
  filesWord: '个文件',
  toolsTitle: (tools: number, calls: number) => `工具 · ${tools} 个工具 · ${calls} 次调用`,
  noTools: '还没有工具调用。',
  failed: (n: number) => `${n} 次失败`,
  lastCall: '最近一次调用',
  lastFailed: (reason: Reason) => (reason === 'blocked' ? '最近一次拦截' : '最近一次失败'),
  sameCommand: (reason: Reason) => `▲ 最近一次${reason === 'blocked' ? '拦截' : '失败'}：正是这条命令`,
  copy: '⧉ 复制',
  turnsTitle: '最近的轮次',
  noTurns: '还没有完成的轮次。',
  ops: '次调用',
  hBand: '输入框上方的状态条',
  hState: '工作中 · 待机 · 刚刚无错误完成',
  hFrame: '边框：工作时为绿色，工具失败或被拦截后为红色',
  hCtx: '已用上下文：70% 起为琥珀色，90% 起为红色并带 ⚠（该运行 /compact 了）',
  hNet: '未离开本机 · 访问过的外部位置 · 被 hook 拦截的尝试',
  hUse: '套餐在 5 小时窗口和每周窗口中的用量',
  hTime: 'Claude 在本次会话中的总工作时间',
  hOps: '本轮的工具调用次数 · 本次会话的估算 API 费用',
  hDeck: '打开或关闭此仪表板',
  hColour: '背景颜色：Claude 正在做什么',
  hThink: '思考中',
  hFiles: '读取或修改文件',
  hRun: '运行命令、脚本或其他工具',
  hWeb: '访问网页或网络',
  hAlert: '某个工具失败或被拦截',
  hFilesTools: '文件和工具',
  hFileDots: '文件已写入 · 琥珀色已编辑 · 青色已读取；越大表示接触越多',
  hRing: '最后接触的文件 · 连线把同一轮中处理的文件连起来',
  hBars: '某个工具的调用次数与最常用工具的对比；有调用失败时为琥珀色',
  hOpen: '显示完整的最后一条命令 · 复制它',
  hAsk: '让 Claude 来做',
  hAskText: '"打开 ops-deck 仪表板" · "关闭 ops-deck 仪表板" · "ops-deck scene data room" · "ops-deck background off"',
  hCredits: '致谢',
  hBy: '构思与指导',
  hCode: '代码',
  hLogo: '标志',
  hRepo: '源代码',
  wholeView: '全部视图',
  agentsTitle: (n: number) => `子代理 · ${n}`,
  noAgents: '还没有启动任何助手代理。',
  agentState: (s: string) => (s === 'running' ? '运行中' : s === 'done' ? '已完成' : s === 'failed' ? '失败' : '无消息'),
  calls: (n: number) => `${n} 次调用`,
  asked: '任务',
  report: '报告',
  toolsUsedBy: '工具',
  lastCalls: '最近的调用',
  time: '时间',
  asSession: '会话',
  unknownModel: '模型未知',
  helpTitle: 'ops-deck · 帮助',
  hSubagents: '子代理（助手代理）',
  hAgentWhat: '每个助手一条横条，从开始到结束；颜色代表它的模型：',
  hAgentShape: '实心：已完成 · 浅色且末端有圆点：运行中 · 红色描边和 ✖：失败 · 虚线：30 分钟无消息',
  hAgentGap: '各批助手之间的空闲时间被折叠成一个间隔，让每一批都占满宽度',
  hAgentSheet: '打开助手的资料卡：它的任务、报告、工具、最近的调用和时间 · 复制这些内容',
  hZoom: '点击文件或文件夹放大 · 点击空白处或 ⤢ 查看全部',
}
// Japanese. It has no capital letters, so the English capitals' headings are plain words here.
const JA: Texts = {
  dir: 'ltr',
  scene: 'シーン',
  none: 'なし',
  language: '言語',
  help: '? ヘルプ',
  hideHelp: 'ヘルプを隠す',
  close: '閉じる',
  active: '◉ 稼働中',
  // What Claude is doing, shown in the band while it works with no moving background.
  doing: { think: '◉ 思考中', files: '◉ ファイル', run: '◉ 実行中', web: '◉ Web' } as Record<Activity, string>,
  standby: '○ 待機中',
  done: '✔ 完了',
  alertLine: (tool: string, reason: Reason) => `▲ ${tool.toUpperCase()} ${reason === 'blocked' ? 'ブロック' : '失敗'}`,
  local: '⌂ ローカル',
  toast: (tool: string, reason: Reason) => `▲ HUD 警告: ${tool} ${reason === 'blocked' ? 'ブロックされました' : '失敗しました'}`,
  stayed: '◉ この PC 内のみ',
  stayedNote: 'Web、ネットワーク、コネクタへの呼び出しなし',
  network: 'ネットワーク',
  networkTag: 'ネットワーク',
  blocked: (n: number) => `${n} 件ブロック`,
  more: (n: number) => `ほか ${n} 件`,
  netGlance: (n: number) => (n === 0 ? 'ネット この PC のみ' : `ネット 外部 ${n} 件`),
  resetIn: (hours: number, m: string) => `${hours} 時間 ${m} 分後`,
  days: ['日', '月', '火', '水', '木', '金', '土'],
  filesTitle: (n: number) => `ファイル · ${n}`,
  noFiles: 'まだファイルは読み込み・変更されていません。',
  written: '書き込み',
  edited: '編集',
  read: '読み込み',
  folder: 'フォルダ',
  filesWord: 'ファイル',
  toolsTitle: (tools: number, calls: number) => `ツール · ${tools} 種類 · ${calls} 回`,
  noTools: 'まだツールの呼び出しはありません。',
  failed: (n: number) => `${n} 回失敗`,
  lastCall: '最後の呼び出し',
  lastFailed: (reason: Reason) => (reason === 'blocked' ? '最後のブロック' : '最後の失敗'),
  sameCommand: (reason: Reason) => `▲ 最後の${reason === 'blocked' ? 'ブロック' : '失敗'}: まさにこのコマンド`,
  copy: '⧉ コピー',
  turnsTitle: '最近のターン',
  noTurns: 'まだ完了したターンはありません。',
  ops: '回',
  hBand: 'プロンプト上部のバンド',
  hState: '作業中 · 待機中 · エラーなしで完了したところ',
  hFrame: '枠: 作業中は緑、ツールが失敗またはブロックされると赤',
  hCtx: '使用中のコンテキスト: 70% から琥珀色、90% から ⚠ 付きの赤 (/compact のタイミング)',
  hNet: 'この PC 内のみ · 外部でアクセスした場所 · hook がブロックした試行',
  hUse: '5 時間枠と週間枠でのプラン使用量',
  hTime: 'このセッションで Claude が作業した合計時間',
  hOps: 'このターンのツール呼び出し回数 · セッションの推定 API コスト',
  hDeck: 'このダッシュボードを開閉する',
  hColour: '背景の色: Claude が今していること',
  hThink: '考え中',
  hFiles: 'ファイルを読み込み・変更中',
  hRun: 'コマンド、スクリプト、その他のツールを実行中',
  hWeb: 'Web またはネットワークにアクセス中',
  hAlert: 'ツールが失敗またはブロックされた',
  hFilesTools: 'ファイルとツール',
  hFileDots: 'ファイル書き込み · 琥珀色は編集 · シアンは読み込み。大きいほど多く触れたもの',
  hRing: '最後に触れたファイル · 線は同じターンで扱ったファイルをつなぐ',
  hBars: '最も多く使われたツールと比べた呼び出し回数。失敗があれば琥珀色',
  hOpen: '最後のコマンド全体を表示 · コピー',
  hAsk: 'Claude に頼む',
  hAskText: '"ops-deck のダッシュボードを開いて" · "ops-deck のダッシュボードを閉じて" · "ops-deck scene data room" · "ops-deck background off"',
  hCredits: 'クレジット',
  hBy: 'コンセプトとディレクション',
  hCode: 'コード',
  hLogo: 'ロゴ',
  hRepo: 'ソース',
  wholeView: '全体表示',
  agentsTitle: (n: number) => `サブエージェント · ${n}`,
  noAgents: 'まだヘルパーエージェントは起動していません。',
  agentState: (s: string) => (s === 'running' ? '実行中' : s === 'done' ? '完了' : s === 'failed' ? '失敗' : '応答なし'),
  calls: (n: number) => `${n} 回`,
  asked: '依頼内容',
  report: 'レポート',
  toolsUsedBy: 'ツール',
  lastCalls: '最近の呼び出し',
  time: '時刻',
  asSession: 'セッション',
  unknownModel: 'モデル不明',
  helpTitle: 'ops-deck · ヘルプ',
  hSubagents: 'サブエージェント (ヘルパーエージェント)',
  hAgentWhat: 'ヘルパーごとに開始から終了までのバー。色はそのモデルを表す:',
  hAgentShape: '塗りつぶし: 完了 · 淡色で先端に点: 実行中 · 赤い枠と ✖: 失敗 · 破線: 30 分間応答なし',
  hAgentGap: 'ヘルパーのグループ間の待ち時間は区切りに折りたたまれ、各グループが幅いっぱいに表示される',
  hAgentSheet: 'ヘルパーの詳細を開く: 依頼内容、レポート、ツール、最近の呼び出し、時刻 · それらをコピー',
  hZoom: 'ファイルやフォルダをクリックで拡大 · 空いている所か ⤢ をクリックで全体表示',
}
// Arabic reads right to left: the band, dashboard and help mirror for it (see directed).
// Arabic has no capital letters, so the English capitals' headings are plain words here.
const AR: Texts = {
  dir: 'rtl',
  scene: 'المشهد',
  none: 'بلا',
  language: 'اللغة',
  help: '? مساعدة',
  hideHelp: 'إخفاء المساعدة',
  close: 'إغلاق',
  active: '◉ يعمل',
  // What Claude is doing, shown in the band while it works with no moving background.
  doing: { think: '◉ يفكر', files: '◉ ملفات', run: '◉ تشغيل', web: '◉ ويب' } as Record<Activity, string>,
  standby: '○ في الانتظار',
  done: '✔ تم',
  alertLine: (tool: string, reason: Reason) => `▲ ${tool} ${reason === 'blocked' ? 'محظور' : 'فشل'}`,
  local: '⌂ محلي',
  toast: (tool: string, reason: Reason) => `▲ تنبيه HUD: ${tool} ${reason === 'blocked' ? 'محظور' : 'فشل'}`,
  stayed: '◉ بقي على هذا الجهاز',
  stayedNote: 'لا اتصالات بالويب أو الشبكة أو الموصلات',
  network: 'شبكة',
  networkTag: 'شبكة',
  blocked: (n: number) => `${n} محظورة`,
  more: (n: number) => `+${n} أخرى`,
  netGlance: (n: number) => (n === 0 ? 'الشبكة: هذا الجهاز فقط' : `الشبكة: ${n} بالخارج`),
  resetIn: (hours: number, m: string) => `بعد ${hours} س ${m} د`,
  days: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  filesTitle: (n: number) => `الملفات · ${n}`,
  noFiles: 'لم تُقرأ أو تُغيَّر أي ملفات بعد.',
  written: 'كُتب',
  edited: 'عُدِّل',
  read: 'قُرئ',
  folder: 'مجلد',
  filesWord: 'ملفات',
  toolsTitle: (tools: number, calls: number) => `الأدوات · ${tools} أدوات · ${calls} استدعاءات`,
  noTools: 'لا استدعاءات للأدوات بعد.',
  failed: (n: number) => `${n} فشلت`,
  lastCall: 'آخر استدعاء',
  lastFailed: (reason: Reason) => (reason === 'blocked' ? 'آخر محظور' : 'آخر فاشل'),
  sameCommand: (reason: Reason) => `▲ آخر ${reason === 'blocked' ? 'محظور' : 'فاشل'}: هذا الأمر نفسه`,
  copy: '⧉ نسخ',
  turnsTitle: 'الجولات الأخيرة',
  noTurns: 'لا جولات منتهية بعد.',
  ops: 'استدعاءات',
  hBand: 'الشريط فوق مربع الكتابة',
  hState: 'يعمل · في الانتظار · انتهى للتو دون أخطاء',
  hFrame: 'الإطار: أخضر أثناء العمل، وأحمر بعد فشل أداة أو حظرها',
  hCtx: 'السياق المستخدم: كهرماني من 70٪، وأحمر مع ⚠ من 90٪ (حان وقت /compact)',
  hNet: 'بقي على هذا الجهاز · أماكن وصل إليها خارجه · محاولات حظرها hook',
  hUse: 'استخدام الخطة في نافذة الساعات الخمس والنافذة الأسبوعية',
  hTime: 'إجمالي وقت عمل Claude في هذه الجلسة',
  hOps: 'استدعاءات الأدوات في هذه الجولة · التكلفة التقديرية لواجهة API في الجلسة',
  hDeck: 'يفتح لوحة المعلومات هذه أو يغلقها',
  hColour: 'لون الخلفية: ما يفعله Claude',
  hThink: 'يفكر',
  hFiles: 'يقرأ الملفات أو يغيّرها',
  hRun: 'يشغّل أوامر أو سكربتات أو أدوات أخرى',
  hWeb: 'يصل إلى الويب أو الشبكة',
  hAlert: 'فشلت أداة أو حُظرت',
  hFilesTools: 'الملفات والأدوات',
  hFileDots: 'ملف كُتب · كهرماني عُدِّل · سماوي قُرئ؛ الأكبر لُمس أكثر',
  hRing: 'آخر ملف لُمس · الخطوط تصل بين ملفات الجولة نفسها',
  hBars: 'استدعاءات الأداة مقارنةً بالأكثر استخدامًا؛ كهرماني إن فشل استدعاء',
  hOpen: 'يعرض آخر أمر كاملًا · ينسخه',
  hAsk: 'اطلب من Claude',
  hAskText: '"open the ops-deck dashboard" · "close the ops-deck dashboard" · "ops-deck scene data room" · "ops-deck background off"',
  hCredits: 'الشكر',
  hBy: 'الفكرة والإشراف',
  hCode: 'البرمجة',
  hLogo: 'الشعار',
  hRepo: 'المصدر',
  wholeView: 'العرض الكامل',
  agentsTitle: (n: number) => `الوكلاء المساعدون · ${n}`,
  noAgents: 'لم يبدأ أي وكيل مساعد بعد.',
  agentState: (s: string) => (s === 'running' ? 'يعمل' : s === 'done' ? 'انتهى' : s === 'failed' ? 'فشل' : 'لا أخبار'),
  calls: (n: number) => `${n} استدعاءات`,
  asked: 'المطلوب',
  report: 'التقرير',
  toolsUsedBy: 'الأدوات',
  lastCalls: 'آخر الاستدعاءات',
  time: 'الوقت',
  asSession: 'الجلسة',
  unknownModel: 'نموذج غير معروف',
  helpTitle: 'ops-deck · مساعدة',
  hSubagents: 'الوكلاء المساعدون (SUBAGENTS)',
  hAgentWhat: 'شريط لكل وكيل، من بدايته إلى نهايته؛ لونه هو نموذجه:',
  hAgentShape: 'ممتلئ: انتهى · باهت بنقطة في طرفه: يعمل · حد أحمر و✖: فشل · متقطع: لا أخبار منذ 30 دقيقة',
  hAgentGap: 'يُطوى وقت الخمول بين مجموعات الوكلاء في فاصل، لتملأ كل مجموعة العرض',
  hAgentSheet: 'يفتح بطاقة الوكيل: ما طُلب منه، وتقريره، وأدواته، وآخر استدعاءاته، وأوقاته · ينسخها',
  hZoom: 'انقر ملفًا أو مجلدًا للتكبير · انقر مساحة فارغة أو ⤢ لرؤية الكل',
}
const TEXTS: Record<Lang, Texts> = { en: EN, el: EL, de: DE, fr: FR, es: ES, it: IT, pt: PT, zh: ZH, ja: JA, ar: AR }
const textsFor = (lang: string): Texts => (isLang(lang) ? TEXTS[lang] : EN)

const setLanguage = async ($: Engine, lang: Lang): Promise<string> => {
  await $.store.set('language', lang)
  await update($, language, () => lang)
  return `ops-deck language: ${lang}.`
}

// Opens the help in its own pane, titled in the dashboard's language, and brings it to the
// front (the app does so while the prompt is empty and idle, as it is on a button press).
const openHelp = async ($: Engine, t: Texts): Promise<void> => {
  await $.ui.open({ id: HELP_PANE, title: t.helpTitle, focus: true })
}

// Folds a dashboard section, or unfolds it.
const toggleSection = async ($: Engine, name: string): Promise<void> => {
  await update($, collapsed, list => (list.includes(name) ? list.filter(one => one !== name) : [...list, name]))
}

// Opens the project's GitHub page in the default browser, when the person presses the
// button beside the address in the help.
const openRepo = async ($: Engine): Promise<void> => {
  try {
    const ran = await $.process.run(
      ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', 'Start-Process $env:OPSDECK_URL'],
      { env: { OPSDECK_URL: REPO_URL }, timeoutMs: 15000 },
    )
    if (ran.exitCode !== 0) {
      $.ui.toast(`Could not open the browser: ${ran.stderr.trim()}`)
    }
  } catch (error) {
    $.ui.toast(`Could not open the browser: ${String(error)}`)
  }
}

// Puts text on the clipboard: through the app where it can, else through Windows'
// own clipboard (Set-Clipboard), then says so in a toast.
const copyText = async ($: Engine, text: string, surface?: RenderSurface): Promise<void> => {
  const viaApp = await $.ui.copy(surface === undefined ? { text } : { text, surface }).catch(() => ({ isCopied: false }))
  if (viaApp.isCopied) {
    $.ui.toast('Copied.')
    return
  }
  try {
    const ran = await $.process.run(
      ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', 'Set-Clipboard -Value $env:OPSDECK_TEXT'],
      { env: { OPSDECK_TEXT: text }, timeoutMs: 15000 },
    )
    $.ui.toast(ran.exitCode === 0 ? 'Copied.' : `Could not copy: ${ran.stderr.trim() || `exit ${ran.exitCode}`}`)
  } catch (error: unknown) {
    $.ui.toast(`Could not copy: ${String(error)}`)
  }
}

// Opens a tool's last call in full under its row, or closes it.
const toggleTool = async ($: Engine, tool: string): Promise<void> => {
  await update($, openTools, list => (list.includes(tool) ? list.filter(one => one !== tool) : [...list, tool]))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // Each registration is tried on its own: one refused must not stop the theme.
    await attempt('command hud-background', () =>
      $.command.register({ name: 'hud-background', description: 'Turn the HUD moving background on or off' }),
    )
    await attempt('command hud-scene', () =>
      $.command.register({
        name: 'hud-scene',
        description: 'Switch the HUD background to the next scene',
        argumentHint: SCENE_NAMES.join(' | '),
      }),
    )
    await attempt('command hud-dashboard', () =>
      $.command.register({ name: 'hud-dashboard', description: 'Open or close the HUD session dashboard' }),
    )
    await attempt('command hud-debug', () =>
      $.command.register({ name: 'hud-debug', description: 'Show why the HUD is or is not drawing' }),
    )
    await attempt('tool hud', () =>
      $.tool.register({
        name: 'hud',
        description:
          `Controls the ops-deck mod. "background-on" / "background-off" turn the moving background on or off; "scene" switches the background to the scene in "name" (${SCENE_NAMES.join(', ')}); "dashboard-on" / "dashboard-off" open or close the session dashboard pane; "demo" opens a demo tab showing the dashboard with a made-up session (for a look or screenshots). All are remembered across sessions; the HUD colours and band always stay on. "debug" reports why it is or is not drawing.`,
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['background-on', 'background-off', 'scene', 'dashboard-on', 'dashboard-off', 'demo', 'debug'],
            },
            name: { type: 'string', enum: [...SCENE_NAMES] },
          },
          required: ['action'],
        },
      }),
    )

    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))
    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }

    const wantsBackground = (await $.store.get('background')) !== false
    const scene = await savedScene($)
    await update($, isBackgroundOn, () => wantsBackground)
    await update($, currentScene, () => scene)
    const savedLang = await $.store.get('language')
    await update($, language, () => (isLang(savedLang) ? savedLang : 'en'))
    // The app's own light or dark setting, before the theme: no background follows it.
    await attempt('app look', async () => {
      const look = await readAppLook($).catch((): Look => 'dark')
      await update($, appLook, () => look)
    })
    await attempt('theme.set', async () => {
      const set = await applyTheme($)
      if (!set.isDrawn) {
        throw new Error(`not drawn: ${set.reason}`)
      }
    })

    if ((await $.store.get('dashboard')) !== false) {
      await update($, isDashboardOpen, () => true)
      await attempt('dashboard', () => $.ui.open({ id: PANE, title: paneTitle }))
    }
    void retitle($)

    void refresh($)
    // Keeps the dashboard's reset times current between turns. Reads local figures only.
    idleTick?.cancel()
    idleTick = $.clock.every(60000, () => {
      if (!busy) {
        void refresh($)
      }
    })
    void dump($, 'session.start')

    return next(e)
  })

  on('tool.call', { tool: 'mcp__ops-deck__hud' }, async ($, e) => {
    const input = e as unknown as { action?: string; name?: unknown }
    if (input.action === 'background-on' || input.action === 'background-off') {
      return { result: await setBackground($, input.action === 'background-on') }
    }
    if (input.action === 'scene') {
      const asked = sceneNamed(input.name)
      return {
        result: isSceneName(asked)
          ? await setScene($, asked)
          : `Unknown scene. The scenes are: ${SCENE_NAMES.join(', ')}.`,
      }
    }
    if (input.action === 'dashboard-on' || input.action === 'dashboard-off') {
      return { result: await setDashboard($, input.action === 'dashboard-on') }
    }
    if (input.action === 'demo') {
      return { result: await openDemo($) }
    }
    return { result: await diagnose($) }
  })

  // Slash commands, for the terminal (the desktop app does not run a mod's commands).
  on('command.run', { command: 'hud-debug' }, async $ => ({ text: await diagnose($) }))
  on('command.run', { command: 'hud-background' }, async $ => ({
    text: await setBackground($, !(await read($, isBackgroundOn))),
  }))
  on('command.run', { command: 'hud-scene' }, async ($, e) => {
    const asked = sceneNamed(e.args)
    if (isSceneName(asked)) {
      return { text: await setScene($, asked) }
    }
    const now = await read($, currentScene)
    const after = SCENE_NAMES[(SCENE_NAMES.indexOf(now as SceneName) + 1) % SCENE_NAMES.length] ?? DEFAULT_SCENE
    return { text: await setScene($, after) }
  })
  on('command.run', { command: 'hud-dashboard' }, async $ => ({
    text: await setDashboard($, !(await read($, isDashboardOpen))),
  }))

  // Closing the dashboard with its close mark counts as switching it off.
  on('ui.close', async ($, e, next) => {
    if (e.id === PANE && e.origin.kind === 'person') {
      await $.store.set('dashboard', false)
      await update($, isDashboardOpen, () => false)
      // The help belongs to the dashboard: it closes with it.
      const done = await next(e)
      await $.ui.close({ id: HELP_PANE }).catch(() => undefined)
      return done
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      busy = true
      settleTimer?.cancel()
      settled = false
      tools = 0
      failed = 0
      turnNo += 1
      lastSeconds = 0
      startedAt = await $.clock.now()
      // A turn starts with thinking.
      running = []
      actTimer?.cancel()
      actShown = 'think'
      actChangedAt = startedAt
      await update($, activity, () => 'think')
      clearDone?.cancel()
      await update($, justDone, () => false)
      await update($, isThinking, () => true)
      tick?.cancel()
      tick = $.clock.every(1000, () => void refresh($))
      void refresh($)
    } else {
      await agentStarted($, e.agentId)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      await agentFinished($, e.agentId)
    }
    if (e.agentId === undefined) {
      tick?.cancel()
      tick = undefined
      await refresh($)
      void retitle($)
      busy = false
      settleLater($)
      await update($, isThinking, () => false)
      await update($, workSeconds, total => total + lastSeconds)
      const record: TurnRecord = { at: await $.clock.now(), seconds: lastSeconds, tools, failed }
      await update($, turns, list => [...list, record].slice(-12))
      // A clean finish: a short green flash on the band's frame.
      if (failed === 0 && (await read($, alert)) === null) {
        await update($, justDone, () => true)
        clearDone?.cancel()
        clearDone = $.clock.after(DONE_FLASH_MS, () => void update($, justDone, () => false))
      }
      void dump($, 'turn.complete')
    }
    return next(e)
  })

  // Every tool call: counted per tool, its file noted, and a red alert when it fails or is blocked.
  on('tool.call', async ($, e, next) => {
    tools += 1
    // A helper agent being started gets a row of its own in the dashboard.
    const startsAgent = AGENT_TOOLS.has(e.tool) ? await agentLaunched($, e) : undefined
    const startedCall = await $.clock.now()
    // An MCP server not seen yet: read the settings that say how it is reached.
    await learnMcpServer($, e.tool)
    // The background shows what this call is doing while it runs.
    const kind = activityOf(e.tool, e)
    if (kind !== null) {
      running = [...running, kind]
      await wantActivity($)
    }
    let ran: Awaited<ReturnType<typeof next>>
    try {
      ran = await next(e)
    } finally {
      if (kind !== null) {
        const at = running.lastIndexOf(kind)
        running = at < 0 ? running : [...running.slice(0, at), ...running.slice(at + 1)]
        await wantActivity($)
      }
    }
    const reason = ran.deny !== undefined ? 'blocked' : ran.isError === true ? 'failed' : undefined
    if (startsAgent !== undefined) {
      await agentCallReturned($, startsAgent, reason !== undefined, (await $.clock.now()) - startedCall)
    }
    const callerAgent = agentIdOf(e)
    if (callerAgent !== undefined) {
      await agentCalled($, callerAgent, reason !== undefined, e.tool, e)
    }

    const at = await $.clock.now()
    const target = targetOf(e.tool, e)
    const full = fullOf(e.tool, e)
    await update($, toolUse, counts => {
      const before = counts[e.tool]
      const entry: ToolCount = {
        count: (before?.count ?? 0) + 1,
        failed: (before?.failed ?? 0) + (reason === undefined ? 0 : 1),
        last: at,
        target,
        full,
        ...(reason !== undefined
          ? { failedFull: full, failedReason: reason }
          : before?.failedFull !== undefined
            ? { failedFull: before.failedFull, failedReason: before.failedReason ?? 'failed' }
            : {}),
      }
      return { ...counts, [e.tool]: entry }
    })
    const places = reachOf(e.tool, e)
    if (places.length > 0) {
      await update($, reach, list => {
        let kept = list
        for (const place of places) {
          const before = kept.find(one => one.host === place.host)
          const one: NetReach = {
            host: place.host,
            scope: place.scope,
            tool: e.tool,
            how: target,
            full,
            count: (before?.count ?? 0) + (ran.deny === undefined ? 1 : 0),
            blocked: (before?.blocked ?? 0) + (ran.deny === undefined ? 0 : 1),
            last: at,
          }
          kept = [...kept.filter(other => other.host !== place.host), one]
        }
        return kept.slice(-100)
      })
    }
    const touch = reason === undefined ? touchOf(e.tool, e) : null
    if (touch !== null) {
      await update($, files, list => {
        const before = list.find(one => one.path === touch.path)
        const seenIn = before?.turns ?? []
        const one: FileTouch = {
          path: touch.path,
          read: (before?.read ?? 0) + (touch.kind === 'read' ? 1 : 0),
          edit: (before?.edit ?? 0) + (touch.kind === 'edit' ? 1 : 0),
          write: (before?.write ?? 0) + (touch.kind === 'write' ? 1 : 0),
          last: at,
          turns: seenIn.includes(turnNo) ? seenIn : [...seenIn, turnNo].slice(-20),
        }
        return [...list.filter(other => other.path !== touch.path), one].slice(-200)
      })
    }

    if (reason !== undefined) {
      failed += 1
      $.ui.toast(textsFor(await read($, language)).toast(e.tool, reason))
      await update($, alert, () => ({ tool: e.tool, reason }))
      clearAlert?.cancel()
      clearAlert = $.clock.after(ALERT_MS, () => {
        if (!busy) {
          settleLater($)
        }
        void update($, alert, () => null)
      })
    }
    return ran
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    saw(`Backdrop/${e.surface}/${String(e.props.scene)}`)
    const name = e.props.scene
    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || !isSceneName(name)) {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)
    // Spotlight is still: the app's look picks ivory or blue-black, whatever Claude is doing.
    if (name === 'spotlight') {
      const look: Look = (await read($, appLook)) === 'light' ? 'light' : 'dark'
      return (
        <Svg
          key={`spotlight-${look}`}
          source={SPOTLIGHT[look]}
          alt={look === 'light' ? 'A still ivory studio backdrop, softly lit in the middle' : 'A still blue-black studio backdrop, softly lit in the middle'}
          isInteractive
        />
      )
    }
    const [fault, working, doing] = await Promise.all([read($, alert), read($, isThinking), read($, activity)])
    const act: Activity = ACTIVITIES.includes(doing as Activity) ? (doing as Activity) : 'think'
    const wanted: Mode = fault !== null ? 'alert' : working ? 'busy' : settled ? 'rest' : 'idle'
    // Fading in only from a still screen: back to blue after an alert, or on to another
    // activity, the scene is drawn at once (steady).
    const moving = shownMode === 'busy' || shownMode === 'steady' || shownMode === 'alert'
    const mode: Mode =
      wanted === 'busy' && moving && !(shownMode === 'busy' && shownAct === act) ? 'steady' : wanted
    const now = await $.clock.now()
    if (!moving && shownMode !== 'idle') {
      motionFrom = now
    }
    const key = `${name}-${mode}-${act}`
    if (key !== shownKey) {
      // A new frame starts its motion where the last one had got to.
      shownKey = key
      shownSource = atPhase(sceneFrame(SCENES[name], mode, act), Math.max(0, (now - motionFrom) / 1000))
    }
    shownMode = mode
    shownAct = act
    const what =
      name === 'circuit'
        ? 'A glowing circuit board flying closer'
        : name === 'data-room'
          ? 'A blue data room with drifting data columns and pulses running along a circuit floor'
          : name === 'signal'
            ? 'An oscilloscope: glowing waves sliding across a faint grid, with dots fading in and out'
            : name === 'code-rain'
            ? 'Streams of Japanese characters and code falling down a dark blue screen'
            : name === 'ink-plotter'
            ? 'Contour lines drifting across cream paper, with a pen inking one of them'
            : name === 'halftone-tide'
            ? 'A newspaper dot screen on cream paper, with a wave of bigger dots sliding across'
            : name === 'digital-cream'
            ? 'Soft cream ribbons edged with fine gold lines drifting across warm ivory'
            : name === 'heartline'
            ? 'A warm studio backdrop with a heart monitor trace sweeping along where the wall meets the floor'
            :'A grid floor rolling toward a glowing horizon under stars'
    const alt =
      mode === 'alert'
        ? `${what}, turned red: a tool call failed`
        : mode === 'busy' || mode === 'steady'
          ? what
          : mode === 'idle'
            ? `${what}, fading out`
            : SCENE_LOOK[name] === 'light'
              ? 'A plain cream background'
              : 'A dark, still background'

    return <Svg key={key} source={shownSource} alt={alt} isInteractive />
  })

  // The status band above the prompt: always on.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    saw(`AbovePrompt/${e.surface}`)
    await paintFor($)
    const [stored, fault, working, workDone, panelOpen, reached, done, lang] = await Promise.all([
      read($, readout),
      read($, alert),
      read($, isThinking),
      read($, workSeconds),
      read($, isDashboardOpen),
      read($, reach),
      read($, justDone),
      read($, language),
    ])
    const t = textsFor(lang)
    if (e.props.hasSurvey) {
      return next(e)
    }
    const r: Readout = stored ?? { model: '--', contextPercent: null, usd: null, fiveHour: null, week: null, tools: 0, seconds: 0 }
    const { Box, Text, Button } = directed($.ui.resolve(e), t.dir)
    const cost = r.usd === null ? '--' : `$${r.usd.toFixed(2)}`
    // Network: green while nothing left this PC, amber once something did, red when the
    // only tries were blocked; blocked tries are counted in red beside it.
    const hostsOut = reached.length
    const blockedOut = reached.reduce((sum, one) => sum + one.blocked, 0)
    const wentOut = reached.some(one => one.count > 0)
    const netColor = hostsOut === 0 ? GREEN : wentOut ? AMBER : RED
    // Context: amber from 70%, red with a warning mark from 90% (time to /compact).
    const ctx = r.contextPercent
    const ctxHigh = ctx !== null && ctx >= 70
    // While Claude works, the band says what it is doing (◉ THINKING, FILES, RUNNING, WEB),
    // its word and frame in the activity colour, matching the scene behind it.
    const doingNow = await read($, activity)
    const act: Activity = ACTIVITIES.includes(doingNow as Activity) ? (doingNow as Activity) : 'think'
    const showsDoing = working && fault === null
    const workColor = showsDoing ? ACTIVITY_SHOWN[act] : GREEN

    // One line: the readouts on the left (the model name is left to the app, which shows it
    // under the prompt), the dashboard button against the right edge.
    const row = (
      <Box key="band-row" width="100%" flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
      <Box flexDirection="row" gap={1} flexWrap="nowrap" alignItems="center" flexShrink={1}>
        {fault !== null ? (
          <Text mono bold color={RED}>
            {t.alertLine(fault.tool, fault.reason)}
          </Text>
        ) : (
          <Text mono bold color={working ? workColor : done ? GREEN : CYAN}>
            {showsDoing ? t.doing[act] : working ? t.active : done ? t.done : t.standby}
          </Text>
        )}
        <Text mono dimColor>│</Text>
        <Text key="band-ctx" mono bold={ctxHigh} color={tone(ctx)}>
          CTX {pct(ctx)}{ctx !== null && ctx >= 90 ? ' ⚠' : ''}
        </Text>
        <Text mono dimColor>│</Text>
        <Text key="band-net" mono color={netColor}>
          {hostsOut === 0 ? t.local : `🌐 ${hostsOut}`}
        </Text>
        {blockedOut > 0 && <Text mono bold color={RED}>⛔{blockedOut}</Text>}
        <Text mono dimColor>│</Text>
        <Text mono color={tone(r.fiveHour)}>5H {pct(r.fiveHour)}</Text>
        <Text mono dimColor>│</Text>
        <Text mono color={tone(r.week)}>WK {pct(r.week)}</Text>
        <Text mono dimColor>│</Text>
        <Text mono color={CYAN}>Σ {durationText(workDone + (working ? r.seconds : 0))}</Text>
        <Text mono dimColor>│</Text>
        <Text mono color={CYAN}>OPS {r.tools}</Text>
        <Text mono dimColor>│</Text>
        <Text mono dimColor>API≈{cost}</Text>
      </Box>
      {/* Opens the dashboard, or closes it when it is open: a stacked-bars icon at the
          band's right edge, drawn large, bright while the dashboard is open and dim while
          it is closed. No label, so the icon alone is shown. */}
      <Button key="band-dashboard" plain variant="primary" onPress={() => setDashboard($, !panelOpen)}>
        <Text size="title" weight="bold">☷</Text>
      </Button>
      </Box>
    )
    // Framed while Claude works: green, or red after a tool failed or was blocked, filled
    // solid so the moving background does not show through.
    if (fault === null && !working && !done) {
      return row
    }
    return (
      <Box
        key="band-frame"
        borderStyle="round"
        borderColor={fault !== null ? RED : working ? workColor : GREEN}
        backgroundColor={BAND_FILL}
        paddingX={1}
      >
        {row}
      </Box>
    )
  })

  // The session dashboard pane: context, the files graph and list, the tools, recent turns.
  // (Plan limits and the API estimate are in the band above the prompt.)
  // The same drawing serves the demo tab, from made-up figures (see demoSession).
  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE && e.requestId !== DEMO_PANE) {
      return next(e)
    }
    const isDemo = e.requestId === DEMO_PANE
    saw(`Pane/${e.surface}/${e.props.placement}`)
    await paintFor($)
    const table = $.ui.resolve(e)
    const live = await Promise.all([
      read($, readout),
      read($, turns),
      read($, isBackgroundOn),
      read($, currentScene),
      read($, toolUse),
      read($, files),
      read($, isThinking),
      read($, reach),
      read($, collapsed),
      read($, openTools),
      read($, language),
      read($, agents),
    ])
    const fake = isDemo ? demoSession(await $.clock.now()) : undefined
    const [stored, history, backgroundOn, scene, counts, touched, working, reached, folded, opened, lang, helpers] =
      fake === undefined
        ? live
        : ([fake.readout, fake.turns, live[2], live[3], fake.toolUse, fake.files, false, fake.reach, live[8], live[9], live[10], fake.agents] as const)
    const t = textsFor(lang)
    const { Box, Text, Button, Progress, Select } = directed(table, t.dir)
    const outside = [...reached].sort((a, b) => b.last - a.last)
    const webHosts = outside.filter(one => one.scope === 'web').length
    const lanHosts = outside.filter(one => one.scope === 'lan').length
    const otherHosts = outside.filter(one => one.scope === 'net').length
    const blockedTries = outside.reduce((sum, one) => sum + one.blocked, 0)
    const madeIt = outside.some(one => one.count > 0)
    const netColor = outside.length === 0 ? GREEN : madeIt ? AMBER : RED
    const netGlance = t.netGlance(outside.length)
    // How tall the split line between the network and usage halves is drawn: the taller side.
    // An opened call adds its framed box: the frame and heading, and its text wrapped to
    // about half the pane's width.
    const halfWidth = Math.max(12, Math.floor(e.props.bodyColumns / 2) - 6)
    const openRows = outside
      .slice(0, 15)
      .filter(one => opened.includes(`net:${one.host}`))
      .reduce((sum, one) => sum + 2 + Math.ceil((one.full ?? one.how).length / halfWidth), 0)
    const netRows =
      outside.length === 0 ? 2 : 2 + Math.min(15, outside.length) * 2 + (outside.length > 15 ? 1 : 0) + openRows
    const glanceRows = Math.max(3, netRows)
    const r: Readout = stored ?? { model: '--', contextPercent: null, usd: null, fiveHour: null, week: null, tools: 0, seconds: 0 }
    const toolRows = Object.entries(counts).sort((a, b) => b[1].count - a[1].count)
    const totalTools = toolRows.reduce((sum, [, c]) => sum + c.count, 0)

    // Minimized to a widget: a glance.
    if (e.props.placement === 'widget') {
      return (
        <Box flexDirection="column">
          <Text mono color={tone(r.contextPercent)}>CTX {pct(r.contextPercent)}</Text>
          <Text mono color={CYAN}>{touched.length} {t.filesWord}</Text>
          <Text mono color={CYAN}>{totalTools} {t.ops}</Text>
          <Text mono color={netColor}>{netGlance}</Text>
        </Box>
      )
    }

    const heading = (text: string) => (
      <Text mono bold color={CYAN}>
        {text}
      </Text>
    )
    // A section heading that folds the section away, or opens it again.
    const foldable = (name: string, text: string) => {
      const isShut = folded.includes(name)
      return {
        isShut,
        head: (
          <Button key={`fold:${name}`} plain onPress={() => toggleSection($, name)}>
            <Text mono bold color={CYAN}>
              {isShut ? '▸' : '▾'} {text}
            </Text>
          </Button>
        ),
      }
    }
    const filesFold = foldable('files', t.filesTitle(touched.length))
    const toolsFold = foldable('tools', t.toolsTitle(toolRows.length, totalTools))
    const turnsFold = foldable('turns', t.turnsTitle)
    const agentsFold = foldable('agents', t.agentsTitle(helpers.length))
    // The blue rule between sections.
    const rule = (name: string) => (
      <Text key={`rule:${name}`} mono color={CYAN} dimColor wrap="truncate">
        {'─'.repeat(Math.max(10, e.props.bodyColumns))}
      </Text>
    )
    const tokens =
      r.contextTokens !== null && r.contextTokens !== undefined && r.contextWindow !== null && r.contextWindow !== undefined
        ? `${kilo(r.contextTokens)}/${kilo(r.contextWindow)}`
        : ''
    const now = await $.clock.now()
    const fileRows = [...touched].sort((a, b) => b.last - a.last)
    const FILES_SHOWN = 12
    const topCount = toolRows[0]?.[1].count ?? 0
    // The graph is an SVG, which the desktop and mobile apps draw; the terminal shows the list alone.
    const graph =
      (e.surface === 'desktop' || e.surface === 'mobile') && fileRows.length > 0
        ? (() => {
            const { Svg } = $.ui.resolve(e)
            const canvas = graphWidth(e.props.bodyColumns)
            saw(`Pane columns ${e.props.bodyColumns}`)
            // In a box of its own, so it can be told apart from the logo.
            return (
              <Box key={`files-graph-${canvas}`}>
              <Svg
                key={`graph-${canvas}`}
                source={fileGraph(fileRows, working, { zoom: 1, x: 0, y: 0 }, canvas, t.wholeView, working && backgroundOn)}
                width={canvas}
                height={graphHeight(canvas, false)}
                alt={`A graph of the ${fileRows.length} files touched this session, grouped by folder`}
                isInteractive
              />
              </Box>
            )
          })()
        : null

    // The reset time after the usage bar, marked with a round arrow.
    const withReset = (when: string) => (when === '' ? '' : `↻ ${when}`)
    const pictures = e.surface === 'desktop' || e.surface === 'mobile'
    const logo = pictures ? (
      (() => {
        const { Svg } = $.ui.resolve(e)
        return <Svg key="logo" source={LOGO_SVG} width={180} height={42} alt="ops-deck" />
      })()
    ) : (
      <Box key="logo" flexDirection="row">
        <Text mono bold color={LOGO_GREY}>ops-</Text>
        <Text mono bold color={CYAN}>deck</Text>
      </Box>
    )
    return (
      <Box flexDirection="column" gap={1}>
        {/* The logo with the version against the right edge, then the controls below. */}
        <Box key="brand" width="100%" flexDirection="row" justifyContent="space-between" alignItems="center">
          {logo}
          <Box flexDirection="row" gap={1}>
            {r.model !== '--' && r.model !== '' && <Text mono bold color={CYAN}>{modelName(r.model)}</Text>}
            <Text mono color={MUTED}>v{VERSION}</Text>
          </Box>
        </Box>
        <Box key="top" flexDirection="row" gap={1} flexWrap="wrap" alignItems="center">
          {/* One list for the background: "none" turns it off, a scene turns it on with that scene. */}
          <Select
            key="scene"
            label={t.scene}
            value={backgroundOn ? scene : 'none'}
            options={[
              { value: 'none', label: `${t.none} ${LOOK_MARK.auto}` },
              ...SCENE_NAMES.map(name => ({ value: name, label: `${sceneTitle(name)} ${LOOK_MARK[SCENE_LOOK[name]]}` })),
            ]}
            onSelect={value => {
              if (value === 'none') {
                void setBackground($, false)
              } else if (isSceneName(value)) {
                void setScene($, value)
              }
            }}
          />
          <Select
            key="language"
            label={t.language}
            value={isLang(lang) ? lang : 'en'}
            options={LANGS.map(one => ({ value: one.value, label: one.label }))}
            onSelect={value => {
              if (isLang(value)) {
                void setLanguage($, value)
              }
            }}
          />
          <Button key="help" label={t.help} onPress={() => openHelp($, t)} />
          <Button key="close" label={t.close} onPress={() => (isDemo ? $.ui.close({ id: DEMO_PANE }) : setDashboard($, false))} />
        </Box>
        {rule('usage')}
        {/* Usage on its own rows; each bar stretches to fill the pane's width. */}
        <Box key="glance-usage" flexDirection="column">
          {[
            { key: 'ctx', label: 'CTX', value: r.contextPercent, note: tokens },
            { key: '5h', label: '5H ', value: r.fiveHour, note: withReset(resetText(r.fiveHourResets, now, t)) },
            { key: 'wk', label: 'WK ', value: r.week, note: withReset(resetText(r.weekResets, now, t)) },
          ].map(one => {
            if (one.value === null) {
              return (
                <Text key={`use:${one.key}`} mono color={MUTED}>
                  {one.label.trim()} --
                </Text>
              )
            }
            // Label, bar, percent and note with a space between each, and a little margin.
            const cells = Math.max(USAGE_CELLS, e.props.bodyColumns - 3 - 4 - one.note.length - 6)
            const used = usedCells(one.value, cells)
            return (
              // A thin bar drawn with line characters: heavy for the part used, light for the rest.
              <Box key={`use:${one.key}`} flexDirection="row" gap={1}>
                <Text mono color={MUTED}>{one.label}</Text>
                <Text mono color={tone(one.value)}>
                  {'━'.repeat(used)}
                  <Text dimColor>{'─'.repeat(cells - used)}</Text>
                </Text>
                <Text mono color={tone(one.value)}>{pct(one.value)}</Text>
                {one.note !== '' && <Text mono color={MUTED}>{one.note}</Text>}
              </Box>
            )
          })}
        </Box>
        {rule('outside')}
        <Box key="glance" flexDirection="column">
        <Box key="glance-net" flexDirection="column">
        {/* The folder the session works in, on one line; a long path loses its start, so
            the folder's own name always shows. */}
        {r.folder != null && r.folder !== '' && (
          <Box key="net-folder" flexDirection="row" gap={1} alignItems="center" marginBottom={1}>
            <Box flexShrink={1} minWidth={0}>
              <Text mono color={CYAN} wrap="truncate-start">⌂ {r.folder}</Text>
            </Box>
            {/* Opens the folder itself in Explorer. */}
            <Button key="net-folder-open" label="📂" plain dimColor onPress={() => revealFile($, r.folder ?? '', 'open')} />
          </Box>
        )}
        {outside.length === 0 ? (
          <Box flexDirection="column">
            <Text mono color={GREEN}>{t.stayed}</Text>
            <Text mono color={MUTED}>{t.stayedNote}</Text>
          </Box>
        ) : (
          <Box flexDirection="column" gap={1}>
            <Box flexDirection="row" gap={2} flexWrap="wrap">
              {webHosts > 0 && <Text mono color={AMBER}>◆ WEB {webHosts}</Text>}
              {lanHosts > 0 && <Text mono color={CYAN}>◆ LAN {lanHosts}</Text>}
              {otherHosts > 0 && <Text mono color={MUTED}>◆ {t.networkTag} {otherHosts}</Text>}
              {blockedTries > 0 && <Text mono color={RED}>⛔ {t.blocked(blockedTries)}</Text>}
            </Box>
            <Box flexDirection="column">
              {outside.slice(0, 15).map(one => {
                // ▸ opens the whole last call to this place, with a Copy button, like the tool rows.
                const full = one.full ?? one.how
                const isOpen = full !== '' && opened.includes(`net:${one.host}`)
                return (
                <Box key={`net:${one.host}`} flexDirection="column">
                  <Box flexDirection="row" gap={1}>
                    {full !== '' ? (
                      <Button key={`net-open:${one.host}`} label={isOpen ? '▾' : '▸'} plain onPress={() => toggleTool($, `net:${one.host}`)} />
                    ) : (
                      <Text mono> </Text>
                    )}
                    <Text mono color={one.count === 0 ? RED : one.scope === 'web' ? AMBER : one.scope === 'lan' ? CYAN : MUTED}>
                      {one.count === 0 ? '⛔' : '◆'}
                    </Text>
                    <Text mono bold>{one.host}</Text>
                    <Text mono color={MUTED}>{one.scope === 'net' ? t.network : one.scope.toUpperCase()}</Text>
                    {one.count > 0 && <Text mono>×{one.count}</Text>}
                    {one.blocked > 0 && <Text mono color={RED}>{t.blocked(one.blocked)}</Text>}
                    <Text mono color={MUTED}>{hhmm(one.last)}</Text>
                  </Box>
                  {isOpen ? (
                    <Box flexDirection="column" borderStyle="round" borderColor={CYAN} paddingX={1}>
                      <Box flexDirection="row" gap={1} justifyContent="space-between">
                        <Text mono bold color={CYAN}>{t.lastCall} · {toolLabel(one.tool)} · {hhmm(one.last)}</Text>
                        <Button key={`net-copy:${one.host}`} label={t.copy} plain dimColor onPress={press => copyText($, full, press.surface)} />
                      </Box>
                      <Text mono wrap="wrap">{full}</Text>
                    </Box>
                  ) : (
                    <Text mono color={MUTED} wrap="truncate-end">
                      {'  └ '}
                      {toolLabel(one.tool)}
                      {one.how !== '' ? `: ${one.how}` : ''}
                    </Text>
                  )}
                </Box>
                )
              })}
              {outside.length > 15 && <Text mono color={MUTED}>{t.more(outside.length - 15)}</Text>}
            </Box>
          </Box>
        )}
        </Box>
        </Box>

        {rule('files')}
        {filesFold.head}
        {filesFold.isShut ? null : fileRows.length === 0 ? (
          <Text mono color={MUTED}>{t.noFiles}</Text>
        ) : (
          <Box flexDirection="column" gap={1}>
            {graph}
            <Box flexDirection="row" gap={2}>
              <Text mono color={GREEN}>● {t.written}</Text>
              <Text mono color={AMBER}>● {t.edited}</Text>
              <Text mono color={CYAN}>● {t.read}</Text>
              <Text mono color={FOLDER_YELLOW}>■ {t.folder}</Text>
            </Box>
            <Box flexDirection="column">
              {fileRows.slice(0, FILES_SHOWN).map(f => (
                <Box flexDirection="column">
                  <Box flexDirection="row" gap={1}>
                    <Text mono color={touchColor(f)}>●</Text>
                    <Text mono bold>{nameOf(f.path)}</Text>
                    <Text mono color={MUTED}>{hhmm(f.last)}</Text>
                    <Button key={`reveal:${f.path}`} label="📂" plain dimColor onPress={() => revealFile($, f.path)} />
                  </Box>
                  <Text mono color={MUTED}>
                    {'  '}
                    {shortPath(folderOf(f.path))} · {fileFacts(f, t)}
                  </Text>
                </Box>
              ))}
              {fileRows.length > FILES_SHOWN && <Text mono color={MUTED}>{t.more(fileRows.length - FILES_SHOWN)}</Text>}
            </Box>
          </Box>
        )}

        {rule('tools')}
        {toolsFold.head}
        {toolsFold.isShut ? null : toolRows.length === 0 ? (
          <Text mono color={MUTED}>{t.noTools}</Text>
        ) : (
          <Box flexDirection="column" gap={1}>
            {toolRows.map(([tool, c]) => {
              const hasFull = c.full !== undefined || c.failedFull !== undefined
              const isOpen = hasFull && opened.includes(tool)
              // The ▸ button shows the whole of the last call under the row, wrapped, and of the
              // last failed one; pressing it again hides it. It stands apart from the row so the
              // row keeps its colours (a desktop draws a button's text in its own colour).
              return (
              <Box key={`tool:${tool}`} flexDirection="column">
                <Box flexDirection="row" gap={1}>
                  {hasFull ? (
                    <Button key={`open:${tool}`} label={isOpen ? '▾' : '▸'} plain onPress={() => toggleTool($, tool)} />
                  ) : (
                    <Text mono> </Text>
                  )}
                  <Text mono bold color={CYAN}>{toolLabel(tool)}</Text>
                  <Text mono color={c.failed > 0 ? AMBER : CYAN}>{bar(c.count, topCount)}</Text>
                  <Text mono>×{c.count}</Text>
                  {c.failed > 0 && <Text mono color={RED}>{t.failed(c.failed)}</Text>}
                  <Text mono color={MUTED}>{hhmm(c.last)}</Text>
                </Box>
                {c.target !== '' && !isOpen && (
                  <Text mono color={MUTED} wrap="truncate-end">
                    {'  └ '}
                    {c.target}
                  </Text>
                )}
                {isOpen && (
                  <Box
                    flexDirection="column"
                    borderStyle="round"
                    borderColor={CYAN}
                    paddingX={1}
                  >
                    {c.full !== undefined && (
                      <Box flexDirection="column">
                        {/* The heading on the left, its Copy button against the frame's right edge. */}
                        <Box flexDirection="row" gap={1} justifyContent="space-between">
                          <Text mono bold color={CYAN}>{t.lastCall} · {hhmm(c.last)}</Text>
                          <Button key={`copy:${tool}`} label={t.copy} plain dimColor onPress={press => copyText($, c.full ?? '', press.surface)} />
                        </Box>
                        <Text mono wrap="wrap">{c.full}</Text>
                      </Box>
                    )}
                    {c.failedFull !== undefined && c.failedFull !== c.full && (
                      <Box flexDirection="column">
                        <Box flexDirection="row" gap={1} justifyContent="space-between">
                          <Text mono bold color={RED}>{t.lastFailed(c.failedReason ?? 'failed')}</Text>
                          <Button key={`copy-failed:${tool}`} label={t.copy} plain dimColor onPress={press => copyText($, c.failedFull ?? '', press.surface)} />
                        </Box>
                        <Text mono wrap="wrap" color={RED}>{c.failedFull}</Text>
                      </Box>
                    )}
                    {c.failedFull !== undefined && c.failedFull === c.full && (
                      <Text mono bold color={RED}>{t.sameCommand(c.failedReason ?? 'failed')}</Text>
                    )}
                  </Box>
                )}
              </Box>
              )
            })}
          </Box>
        )}

        {rule('agents')}
        {agentsFold.head}
        {agentsFold.isShut ? null : helpers.length === 0 ? (
          <Text mono color={MUTED}>{t.noAgents}</Text>
        ) : (
          <Box flexDirection="column" gap={1}>
            {pictures &&
              (() => {
                const { Svg } = $.ui.resolve(e)
                const canvas = graphWidth(e.props.bodyColumns)
                return (
                  <Box key={`agents-chart-${canvas}`}>
                    <Svg
                      key={`agents-${canvas}`}
                      // Running bars grow in 15-second steps, so the picture (which the app
                      // reloads whenever it changes) is the same between steps and does not flash.
                      source={agentChart(helpers, Math.floor(now / AGENT_CHART_STEP_MS) * AGENT_CHART_STEP_MS, canvas, r.model, t.unknownModel)}
                      width={canvas}
                      height={agentChartHeight(helpers.length)}
                      alt={`A timeline of the ${helpers.length} helper agents started this session`}
                      isInteractive
                    />
                  </Box>
                )
              })()}
            <Box flexDirection="column">
              {[...helpers].reverse().map(row => {
                const status = agentStatus(row, now)
                const color = AGENT_COLOR[status]
                const mark = status === 'running' ? '◉' : status === 'done' ? '✔' : status === 'failed' ? '✖' : '?'
                const isOpen = row.prompt !== '' && opened.includes(`agent:${row.key}`)
                const took = clockText(Math.round(((row.end ?? now) - row.start) / 1000))
                return (
                  <Box key={`agent:${row.key}`} flexDirection="column">
                    <Box flexDirection="row" gap={1}>
                      {row.prompt !== '' ? (
                        <Button key={`agent-open:${row.key}`} label={isOpen ? '▾' : '▸'} plain onPress={() => toggleTool($, `agent:${row.key}`)} />
                      ) : (
                        <Text mono> </Text>
                      )}
                      <Text mono bold color={color}>{mark} {row.kind}</Text>
                      {/* The model it ran on, in the model's colour (as on the timeline): the one
                          named for it, else the session's own; unknown for an older row. */}
                      <Text mono bold color={modelColor(agentModel(row, r.model))}>
                        {row.model === undefined
                          ? t.unknownModel
                          : row.model !== null && row.model !== ''
                            ? modelName(row.model)
                            : `${agentModel(row, r.model)} · ${t.asSession}`}
                      </Text>
                      <Text mono>{t.agentState(status)}</Text>
                      <Text mono color={CYAN}>{t.calls(row.calls)}</Text>
                      {row.failed > 0 && <Text mono color={RED}>{t.failed(row.failed)}</Text>}
                      <Text mono color={MUTED}>{hhmm(row.start)} · {took}</Text>
                    </Box>
                    {row.description !== '' && !isOpen && (
                      <Text mono color={MUTED} wrap="truncate-end">
                        {'  └ '}
                        {row.description}
                      </Text>
                    )}
                    {isOpen && (
                      // The helper's fact sheet: what it was asked, what it reported, what it did, when.
                      <Box flexDirection="column" borderStyle="round" borderColor={CYAN} paddingX={1} gap={1}>
                        <Box flexDirection="column">
                          <Box flexDirection="row" gap={1} justifyContent="space-between">
                            <Text mono bold color={CYAN}>{t.asked}{row.description !== '' ? ` · ${row.description}` : ''}</Text>
                            <Button key={`agent-copy:${row.key}`} label={t.copy} plain dimColor onPress={press => copyText($, row.prompt, press.surface)} />
                          </Box>
                          <Text mono wrap="wrap">{row.prompt}</Text>
                        </Box>
                        {row.report !== undefined && row.report !== '' && (
                          <Box flexDirection="column">
                            <Box flexDirection="row" gap={1} justifyContent="space-between">
                              <Text mono bold color={GREEN}>{t.report}</Text>
                              <Button key={`agent-copy-report:${row.key}`} label={t.copy} plain dimColor onPress={press => copyText($, row.report ?? '', press.surface)} />
                            </Box>
                            <Text mono wrap="wrap">{row.report}</Text>
                          </Box>
                        )}
                        {row.tools !== undefined && Object.keys(row.tools).length > 0 && (
                          <Box flexDirection="column">
                            <Text mono bold color={CYAN}>{t.toolsUsedBy}</Text>
                            <Text mono wrap="wrap">
                              {Object.entries(row.tools)
                                .sort((a, b) => b[1] - a[1])
                                .map(([name, n]) => `${name} ×${n}`)
                                .join(' · ')}
                            </Text>
                            {row.failed > 0 && <Text mono color={RED}>{t.failed(row.failed)}</Text>}
                          </Box>
                        )}
                        {row.recent !== undefined && row.recent.length > 0 && (
                          <Box flexDirection="column">
                            <Text mono bold color={CYAN}>{t.lastCalls}</Text>
                            {row.recent.map((line, i) => (
                              <Text key={`agent-recent:${row.key}:${i}`} mono color={line.startsWith('✖') ? RED : MUTED} wrap="truncate-end">
                                {line}
                              </Text>
                            ))}
                          </Box>
                        )}
                        <Text mono color={MUTED}>
                          {t.time} {clockAt(row.start)}
                          {row.end !== null ? ` → ${clockAt(row.end)}` : ''} · {took}
                        </Text>
                      </Box>
                    )}
                  </Box>
                )
              })}
            </Box>
          </Box>
        )}

        {rule('turns')}
        {turnsFold.head}
        {turnsFold.isShut ? null : history.length === 0 ? (
          <Text mono color={MUTED}>{t.noTurns}</Text>
        ) : (
          <Box flexDirection="column">
            {[...history].reverse().map(turn => (
              <Box flexDirection="row" gap={2}>
                <Text mono color={MUTED}>{hhmm(turn.at)}</Text>
                <Text mono color={CYAN}>T+{clockText(turn.seconds)}</Text>
                <Text mono color={CYAN}>{turn.tools} {t.ops}</Text>
                {turn.failed > 0 && <Text mono color={RED}>{t.failed(turn.failed)}</Text>}
              </Box>
            ))}
          </Box>
        )}

      </Box>
    )
  })

  // The help, in a pane of its own (opened by the dashboard's Help button), so reading it
  // never changes the dashboard's own height or scroll.
  on('ui.render', { component: 'Pane', requestId: HELP_PANE }, async ($, e) => {
    await paintFor($)
    const t = textsFor(await read($, language))
    const { Box, Text, Button } = directed($.ui.resolve(e), t.dir)
    const heading = (text: string) => (
      <Text mono bold color={CYAN}>
        {text}
      </Text>
    )
    // One line of the help: a mark or name in its colour, then what it means.
    const helpLine = (key: string, mark: string, color: string, text: string) => (
      <Box key={`help:${key}`} flexDirection="row" gap={1}>
        <Text mono bold color={color}>{mark}</Text>
        <Text mono color={MUTED} wrap="wrap">{text}</Text>
      </Box>
    )
    return (
      <Box key="help" flexDirection="column" gap={1}>
        <Box key="help-top" width="100%" flexDirection="row" justifyContent="space-between" alignItems="center">
          <Box flexDirection="row">
            <Text mono bold color={LOGO_GREY}>ops-</Text>
            <Text mono bold color={CYAN}>deck</Text>
            <Text mono color={MUTED}> · v{VERSION}</Text>
          </Box>
          <Button key="help-close" label={t.close} onPress={() => $.ui.close({ id: HELP_PANE })} />
        </Box>
        <Box flexDirection="column">
          {heading(t.hBand)}
          {helpLine('state', '◉ ○ ✔', GREEN, t.hState)}
          {helpLine('frame', '▢', GREEN, t.hFrame)}
          {helpLine('ctx', 'CTX', AMBER, t.hCtx)}
          {helpLine('net', '⌂ 🌐 ⛔', CYAN, t.hNet)}
          {helpLine('use', '5H WK', CYAN, t.hUse)}
          {helpLine('time', 'Σ', CYAN, t.hTime)}
          {helpLine('ops', 'OPS API≈', CYAN, t.hOps)}
          {helpLine('deck', '☷', CYAN, t.hDeck)}
        </Box>
        <Box flexDirection="column">
          {heading(t.hColour)}
          {helpLine('think', '■', ACTIVITY_SHOWN.think, t.hThink)}
          {helpLine('files', '■', ACTIVITY_SHOWN.files, t.hFiles)}
          {helpLine('run', '■', ACTIVITY_SHOWN.run, t.hRun)}
          {helpLine('web', '■', ACTIVITY_SHOWN.web, t.hWeb)}
          {helpLine('alert', '■', RED, t.hAlert)}
        </Box>
        <Box flexDirection="column">
          {heading(t.hFilesTools)}
          {helpLine('fw', '●', GREEN, t.hFileDots)}
          {helpLine('ring', '◯', CYAN, t.hRing)}
          {helpLine('zoom', '⤢', CYAN, t.hZoom)}
          {helpLine('bars', '▰▱', CYAN, t.hBars)}
          {helpLine('open', '▸ ⧉', CYAN, t.hOpen)}
        </Box>
        <Box flexDirection="column">
          {heading(t.hSubagents)}
          {helpLine('a-what', '▬', CYAN, t.hAgentWhat)}
          {helpLine('a-opus', '■', modelColor('Opus'), 'Opus')}
          {helpLine('a-sonnet', '■', modelColor('Sonnet'), 'Sonnet')}
          {helpLine('a-haiku', '■', modelColor('Haiku'), 'Haiku')}
          {helpLine('a-fable', '■', modelColor('Fable'), 'Fable')}
          {helpLine('a-mythos', '■', modelColor('Mythos'), 'Mythos')}
          {helpLine('a-unknown', '■', MUTED, t.unknownModel)}
          {helpLine('a-shape', '▬ ◉ ✖', CYAN, t.hAgentShape)}
          {helpLine('a-gap', '//', MUTED, t.hAgentGap)}
          {helpLine('a-sheet', '▸ ⧉', CYAN, t.hAgentSheet)}
        </Box>
        <Box flexDirection="column">
          {heading(t.hAsk)}
          <Text mono color={MUTED} wrap="wrap">
            {t.hAskText}
          </Text>
        </Box>
        <Box flexDirection="column">
          {heading(t.hCredits)}
          {helpLine('by', t.hBy, LOGO_GREY, 'Minas N. Miliaras')}
          {helpLine('code', t.hCode, LOGO_GREY, 'Claude Opus 5.5')}
          {helpLine('logo', t.hLogo, LOGO_GREY, 'Grok 4.6')}
          {/* The address, and a button that opens it in the browser: a globe, which the
              emoji font draws blue (a button's own text is always white). */}
          <Box key="help:repo" flexDirection="row" gap={1} alignItems="center">
            <Text mono bold color={LOGO_GREY}>{t.hRepo}</Text>
            <Text mono color={MUTED} wrap="wrap">{REPO_URL}</Text>
            <Button key="repo-open" label="🌐" plain onPress={() => openRepo($)} />
          </Box>
        </Box>
      </Box>
    )
  })
}
