export type Readout = {
  model: string
  contextPercent: number | null
  usd: number | null
  // Plan usage windows, percent used; null until the first reply or off a subscription.
  fiveHour: number | null
  week: number | null
  tools: number
  seconds: number
  // For the dashboard; absent in a readout an older version stored.
  fiveHourResets?: string | null
  weekResets?: string | null
  contextTokens?: number | null
  contextWindow?: number | null
  // The session's project folder, absolute; shown in the dashboard's network section.
  folder?: string | null
}

export type Alert = { tool: string; reason: string } | null

// One finished turn, for the dashboard's history.
export type TurnRecord = { at: number; seconds: number; tools: number; failed: number }

// Calls of one tool this session: how many, how many failed, when last, and what on.
// full is the last call's whole command or input; failedFull the last failed one's, and
// failedReason why (absent in counts an older version stored).
export type ToolCount = {
  count: number
  failed: number
  last: number
  target: string
  full?: string
  failedFull?: string
  failedReason?: string
}

// A file a tool read, edited or wrote this session: how often, when last, and in which turns.
export type FileTouch = { path: string; read: number; edit: number; write: number; last: number; turns: number[] }

// A place outside this PC a tool call reached or tried to: web (internet), lan (local
// network) or net (network, host unknown); blocked counts the tries a hook stopped.
export type NetReach = {
  host: string
  scope: 'web' | 'lan' | 'net'
  tool: string
  how: string
  count: number
  blocked: number
  last: number
  // The last call's whole command or input (absent in entries an older version stored).
  full?: string
}

// A helper agent (subagent) started this session: its Agent call, the agent id its own
// turns are reported under (null until the first), when it started, last did something
// and ended (null while running), and its tool calls.
export type AgentRun = {
  key: string
  agentId: string | null
  kind: string
  description: string
  prompt: string
  start: number
  end: number | null
  last: number
  calls: number
  failed: number
  status: 'running' | 'done' | 'failed'
  // The model asked for in the Agent call (null: the same as the session), its report when
  // it handed back, its calls per tool, and its last few calls (absent in older rows).
  model?: string | null
  report?: string
  tools?: Record<string, number>
  recent?: string[]
}

// How the files graph is framed: zoom 1 shows it all; x and y pan in steps when zoomed;
// tall makes it three times as high.
export type GraphView = { zoom: number; x: number; y: number; tall?: boolean }

declare module 'claude-code' {
  interface PluginState {
    'ops-deck': {
      isThinking: boolean
      readout: Readout | null
      alert: Alert
      turns: Shaped<TurnRecord[]>
      // Mirrors of the saved switches, so the band and dashboard redraw when they change.
      isBackgroundOn: boolean
      isDashboardOpen: boolean
      // The background scene's name, mirroring the saved choice.
      currentScene: string
      toolUse: Shaped<Record<string, ToolCount>>
      files: Shaped<FileTouch[]>
      reach: Shaped<NetReach[]>
      // Dashboard sections folded shut, and tools whose last call is shown in full.
      collapsed: Shaped<string[]>
      openTools: Shaped<string[]>
      // Seconds worked this session over all finished turns.
      workSeconds: number
      // A moment after a clean finish, for the band's green flash.
      justDone: boolean
      // What Claude is doing now, for the backgrounds' activity colour: think, files, run or web.
      activity: string
      // The language of the dashboard and the band, mirroring the saved choice: en, el, de, fr, es or it.
      language: string
      // The desktop app's own light or dark setting ('light' or 'dark'), followed with the background off.
      appLook: string
      // The helper agents started this session, newest last.
      agents: Shaped<AgentRun[]>
    }
  }
}
