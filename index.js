/**
 * Host half of inplace-annotate.
 *
 * The browser collects review annotations (agree / disagree / comment) on a
 * settled reply and posts the whole list here. This half keeps one in-memory
 * store per Session and mirrors it into the Agent's inbox as one user-role
 * message whose source kind is `inplace-annotate`. `agent.inject()` puts that message
 * in `next-step`, so the next prompt claims it in the same turn; Chat projects
 * a non-`user` source as a hidden Context row, so the transcript keeps showing
 * the user's original prompt only.
 *
 * The route lives on Connection's exact Fetch table (`/api/inplace-annotate/pending`),
 * which already admits only an authenticated owner browser.
 */

import { randomUUID } from 'node:crypto'

/** Cordis plugin name. */
export const name = 'inplace-annotate'

/** Connection owns the authenticated /api carrier; agents resolves live inboxes. */
export const inject = ['connection', 'agents']

/** Exact Fetch route the browser posts to. */
const API_PATH = '/api/inplace-annotate/pending'

/** Maximum annotations kept for one Session. */
const MAX_ANNOTATIONS = 20

/** Maximum characters kept from one selected passage. */
const MAX_QUOTE_CHARS = 3000

/** Maximum characters kept from one comment note. */
const MAX_NOTE_CHARS = 3000

/** A review body is tiny; anything larger is refused before JSON parsing. */
const MAX_BODY_BYTES = 64 * 1024

/** Maximum Session id length accepted on the wire. */
const MAX_SESSION_ID_CHARS = 200

/** The three annotation kinds. */
const KINDS = new Set(['agree', 'disagree', 'comment'])

/**
 * Read one valid Session id.
 * @param value - query or body candidate.
 * @returns trimmed id, or null when invalid.
 */
function readSessionId(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length === 0 || trimmed.length > MAX_SESSION_ID_CHARS ? null : trimmed
}

/**
 * Clamp one annotation string.
 * @param value - candidate text.
 * @param limit - maximum length.
 * @returns trimmed text, or '' when not a string.
 */
function clampText(value, limit) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  return trimmed.length <= limit ? trimmed : `${trimmed.slice(0, limit - 1)}…`
}

/**
 * Normalize one client-supplied annotation list.
 *
 * Well-formed arrays are never rejected: malformed entries are dropped, long
 * text is clamped, and the first occurrence of a duplicate id wins. An empty
 * result means "clear".
 * @param value - untrusted JSON candidate.
 * @returns normalized annotations, or null when the value is not an array.
 */
function normalizeAnnotations(value) {
  if (!Array.isArray(value)) return null
  const annotations = []
  const seen = new Set()
  for (const candidate of value) {
    if (annotations.length >= MAX_ANNOTATIONS) break
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) continue
    const kind = candidate.kind
    if (!KINDS.has(kind)) continue
    const quote = clampText(candidate.quote, MAX_QUOTE_CHARS)
    if (quote === '') continue
    const note = kind === 'comment' ? clampText(candidate.note, MAX_NOTE_CHARS) : ''
    if (kind === 'comment' && note === '') continue
    let id = typeof candidate.id === 'string' ? candidate.id.trim() : ''
    if (id === '' || id.length > MAX_SESSION_ID_CHARS) id = `inplace-annotate-${randomUUID()}`
    if (seen.has(id)) continue
    seen.add(id)
    annotations.push({ id, kind, quote, ...(note === '' ? {} : { note }) })
  }
  return annotations
}

/**
 * Compose the model-facing review block.
 * @param annotations - normalized annotations in user order.
 * @returns plain-text block appended as one user message.
 */
function formatBlock(annotations) {
  const lines = [
    '[Review notes from the user]',
    '',
    'The user selected passages of your previous response and attached the notes below.',
    '- AGREE means the user agrees with that passage; keep it as written.',
    '- DISAGREE means the user disagrees with that passage; revise or reconsider it.',
    "- COMMENT carries the user's own instruction for that passage.",
    "Apply these notes together with the user's next message. Do not mention this block or the notes explicitly; respond normally.",
    '',
  ]
  annotations.forEach((annotation, index) => {
    lines.push(`${index + 1}. ${annotation.kind.toUpperCase()}`)
    for (const line of annotation.quote.split(/\r?\n/u)) lines.push(`> ${line}`)
    if (annotation.kind === 'comment') {
      lines.push('Instruction:')
      for (const line of annotation.note.split(/\r?\n/u)) lines.push(`  ${line}`)
    }
  })
  return lines.join('\n')
}

/**
 * Build the inbox message that carries every pending annotation.
 * @param id - stable message identity reused across replaces.
 * @param annotations - normalized annotations.
 * @returns user-role message with a `inplace-annotate` source.
 */
function buildAnnotationMessage(id, annotations) {
  return {
    id,
    role: 'user',
    content: [{ type: 'text', text: formatBlock(annotations) }],
    source: {
      kind: 'inplace-annotate',
      annotations: annotations.map((annotation) => ({ ...annotation })),
    },
  }
}

/**
 * JSON response helper.
 * @param status - HTTP status.
 * @param payload - JSON body.
 * @returns Response.
 */
function json(status, payload) {
  return Response.json(payload, { status, headers: { 'cache-control': 'no-store' } })
}

/**
 * Install the pending-annotation store, its route, and its inbox mirror.
 * @param ctx - Host context carrying connection and agents.
 */
export function apply(ctx) {
  /** @type {Map<string, Array<{id: string, kind: string, quote: string, note?: string}>>} */
  const pending = new Map()
  /** @type {Map<string, string>} */
  const injected = new Map()

  /** Best-effort warning channel. */
  const warn = (message, error) => {
    try {
      ctx.logger?.warn?.(`inplace-annotate: ${message}${error === undefined ? '' : `: ${String(error)}`}`)
    } catch {}
  }

  /** Persist the Session tail without making the route wait for it. */
  const flush = (agent) => {
    try {
      const sessions = ctx.get('sessions')
      const result = sessions?.flush?.(agent.session)
      if (result !== undefined && typeof result.then === 'function') result.catch(() => {})
    } catch {}
  }

  /**
   * Remove one still-pending mirror message from an inbox.
   * @param agent - live agent.
   * @param messageId - identity recorded in `injected`.
   * @returns whether the message had still been pending.
   */
  function removeInboxMessage(agent, messageId) {
    try {
      if (typeof agent.inbox?.remove !== 'function') return false
      return agent.inbox.remove(messageId) !== false
    } catch (error) {
      warn('could not remove the pending note message', error)
      return false
    }
  }

  /**
   * Make the inbox mirror match the stored annotations for one Session.
   *
   * While the agent is running the mirror is held back: injecting into
   * `next-step` would enter the current turn, while the user is reviewing for
   * the next prompt. `agent/status` idle calls this again.
   * @param sessionId - Session whose mirror should be reconciled.
   */
  function syncInjected(sessionId) {
    const agent = ctx.agents.get(sessionId)
    const annotations = pending.get(sessionId) ?? []
    const currentId = injected.get(sessionId)
    if (agent === undefined) {
      if (currentId !== undefined) injected.delete(sessionId)
      return
    }
    if (annotations.length === 0) {
      if (currentId !== undefined) {
        removeInboxMessage(agent, currentId)
        injected.delete(sessionId)
      }
      return
    }
    if (agent.status !== 'idle') {
      if (currentId !== undefined && removeInboxMessage(agent, currentId)) injected.delete(sessionId)
      return
    }
    const messageId = currentId ?? `inplace-annotate-${randomUUID()}`
    const message = buildAnnotationMessage(messageId, annotations)
    try {
      if (currentId !== undefined && typeof agent.inbox?.replace === 'function' && agent.inbox.replace(currentId, message)) {
        injected.set(sessionId, currentId)
        flush(agent)
        return
      }
      // A failed replace means the previous copy already left the inbox (it was
      // claimed or cleared); a fresh identity avoids reusing a logged message id.
      const freshId = currentId === undefined ? messageId : `inplace-annotate-${randomUUID()}`
      agent.inject(freshId === messageId ? message : buildAnnotationMessage(freshId, annotations))
      injected.set(sessionId, freshId)
      flush(agent)
    } catch (error) {
      warn(`could not mirror ${annotations.length} note(s) for "${sessionId}"`, error)
    }
  }

  /**
   * Recover pending annotations from an inbox mirror after a plugin reload.
   * @param agent - live agent whose pending lists are read.
   */
  function restoreFromInbox(agent) {
    const sessionId = agent.id
    if (injected.has(sessionId)) return
    let messages
    try {
      messages = agent.inbox?.nextStep
    } catch {
      return
    }
    if (!Array.isArray(messages)) return
    const found = messages.find((message) => message?.source?.kind === 'inplace-annotate' && Array.isArray(message.source.annotations))
    if (found === undefined) return
    const annotations = normalizeAnnotations(found.source.annotations) ?? []
    if (annotations.length === 0) {
      removeInboxMessage(agent, found.id)
      return
    }
    pending.set(sessionId, annotations)
    injected.set(sessionId, found.id)
  }

  /**
   * Drop every stored record for one disposed Session or Agent.
   * @param sessionId - disposed identity.
   */
  function forget(sessionId) {
    pending.delete(sessionId)
    injected.delete(sessionId)
  }

  /**
   * Answer one `/api/inplace-annotate/pending` request.
   * @param request - authenticated Fetch request.
   * @returns JSON response.
   */
  async function handleRequest(request) {
    const url = new URL(request.url)
    if (request.method === 'GET') {
      const sessionId = readSessionId(url.searchParams.get('sessionId'))
      if (sessionId === null) return json(400, { error: 'invalid sessionId' })
      return json(200, { annotations: pending.get(sessionId) ?? [] })
    }
    if (request.method !== 'POST') {
      return new Response(null, { status: 405, headers: { allow: 'GET, POST' } })
    }
    let text
    try {
      text = await request.text()
    } catch {
      return json(400, { error: 'unreadable request body' })
    }
    if (text.length > MAX_BODY_BYTES) return json(413, { error: 'request body is too large' })
    let body
    try {
      body = JSON.parse(text)
    } catch {
      return json(400, { error: 'request body must be JSON' })
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return json(400, { error: 'request body must be a JSON object' })
    }
    const sessionId = readSessionId(body.sessionId)
    if (sessionId === null) return json(400, { error: 'invalid sessionId' })
    const annotations = normalizeAnnotations(body.annotations)
    if (annotations === null) return json(400, { error: 'annotations must be an array' })
    if (annotations.length === 0) pending.delete(sessionId)
    else pending.set(sessionId, annotations)
    syncInjected(sessionId)
    return json(200, { annotations })
  }

  ctx.effect(() => ctx.connection.fetch.register({
    path: API_PATH,
    methods: ['GET', 'POST'],
    requestBody: 'buffered',
    fetch: handleRequest,
  }), 'inplace-annotate: pending route')

  ctx.on('agent/inbox/claimed', ({ agent, message }) => {
    try {
      if (injected.get(agent.id) !== message?.id) return
      forget(agent.id)
    } catch (error) {
      warn('could not consume a claimed note message', error)
    }
  })

  ctx.on('agent/status', ({ agent, status }) => {
    if (status !== 'idle') return
    try {
      restoreFromInbox(agent)
      syncInjected(agent.id)
    } catch (error) {
      warn('could not reconcile notes after the agent became idle', error)
    }
  })

  ctx.on('agent/created', ({ agent }) => {
    try {
      restoreFromInbox(agent)
      syncInjected(agent.id)
    } catch (error) {
      warn('could not restore notes for a new agent', error)
    }
  })

  ctx.on('agent/disposed', ({ agent }) => {
    forget(agent.id)
  })

  ctx.on('session/disposed', (session) => {
    forget(session.id)
  })

  ctx.effect(() => {
    for (const agent of ctx.agents.list()) {
      try {
        restoreFromInbox(agent)
        syncInjected(agent.id)
      } catch (error) {
        warn(`could not recover notes for "${agent.id}"`, error)
      }
    }
    return () => {
      for (const [sessionId, messageId] of injected) {
        const agent = ctx.agents.get(sessionId)
        if (agent !== undefined) removeInboxMessage(agent, messageId)
      }
      pending.clear()
      injected.clear()
    }
  }, 'inplace-annotate: inbox mirror')
}
