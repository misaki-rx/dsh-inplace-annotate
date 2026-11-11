import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../index.js'

const API = '/api/inplace-annotate/pending'

/**
 * One live-Agent stand-in with the public inbox surface inplace-annotate uses.
 * @param id - Session identity.
 * @returns mutable fake agent.
 */
function createAgent(id) {
  const agent = {
    id,
    status: 'idle',
    session: { id },
    inbox: {
      nextStep: [],
      nextTurn: [],
      inject(message) {
        this.nextStep.push(message)
      },
      replace(messageId, message) {
        const index = this.nextStep.findIndex((candidate) => candidate.id === messageId)
        if (index < 0) return false
        this.nextStep[index] = message
        return true
      },
      remove(messageId) {
        const index = this.nextStep.findIndex((candidate) => candidate.id === messageId)
        if (index < 0) return false
        this.nextStep.splice(index, 1)
        return true
      },
    },
    inject(message) {
      this.inbox.inject(message)
    },
  }
  return agent
}

/**
 * Compose a Cordis-shaped Host context around the real plugin.
 * @returns route, agents and event dispatch helpers.
 */
function createHarness() {
  const routes = new Map()
  const listeners = new Map()
  const agents = new Map()
  const ctx = {
    connection: {
      fetch: {
        register(route) {
          routes.set(route.path, route)
          return async () => routes.delete(route.path)
        },
      },
    },
    agents: {
      get: (id) => agents.get(id),
      list: () => [...agents.values()],
    },
    get(name) {
      return name === 'sessions' ? { flush: async () => true } : undefined
    },
    logger: { warn() {} },
    on(name, listener) {
      let set = listeners.get(name)
      if (set === undefined) {
        set = new Set()
        listeners.set(name, set)
      }
      set.add(listener)
      return () => set.delete(listener)
    },
    effect(callback) {
      const disposer = callback()
      return typeof disposer === 'function' ? disposer : () => {}
    },
  }
  apply(ctx)
  const route = routes.get(API)
  return {
    route,
    agents,
    agent(id) {
      const agent = createAgent(id)
      agents.set(id, agent)
      return agent
    },
    emit(name, payload) {
      for (const listener of listeners.get(name) ?? []) listener(payload)
    },
    async request(method, body, sessionId = 's1') {
      const url = `http://dsh.internal${API}${method === 'GET' ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`
      const init = { method }
      if (body !== undefined) {
        init.headers = { 'content-type': 'application/json' }
        init.body = typeof body === 'string' ? body : JSON.stringify(body)
      }
      const response = await route.fetch(new Request(url, init))
      const text = await response.text()
      let parsed = null
      if (text !== '') {
        try {
          parsed = JSON.parse(text)
        } catch {
          parsed = text
        }
      }
      return { status: response.status, body: parsed }
    },
  }
}

const AGREE = { id: 'a1', kind: 'agree', quote: 'First passage' }
const COMMENT = { id: 'a2', kind: 'comment', quote: 'line one\nline two', note: 'Please revise' }
const DISAGREE = { id: 'a3', kind: 'disagree', quote: 'Third passage' }
const QUESTION = { id: 'a5', kind: 'question', quote: 'Unclear passage', note: 'This note must be dropped' }
const ANCHOR = {
  flow: 'node:message-1',
  node: 'node:message-1',
  turn: 4,
  source: 1,
  start: 7,
  end: 20,
}
const ANCHORED = { id: 'a4', kind: 'agree', quote: 'First passage', anchor: ANCHOR }

test('posts, stores, and mirrors annotations into the next step', async () => {
  const harness = createHarness()
  const agent = harness.agent('s1')
  const posted = await harness.request('POST', { sessionId: 's1', annotations: [AGREE, COMMENT] })
  assert.equal(posted.status, 200)
  assert.deepEqual(posted.body.annotations, [AGREE, { ...COMMENT }])

  assert.equal(agent.inbox.nextStep.length, 1)
  const message = agent.inbox.nextStep[0]
  assert.equal(message.role, 'user')
  assert.equal(message.source.kind, 'inplace-annotate')
  assert.deepEqual(message.source.annotations, [AGREE, COMMENT])
  const text = message.content[0].text
  assert.match(text, /\[Review notes from the user\]/u)
  assert.match(text, /1\. AGREE/u)
  assert.match(text, /> First passage/u)
  assert.match(text, /2\. COMMENT/u)
  assert.match(text, /> line one/u)
  assert.match(text, /> line two/u)
  assert.match(text, /Instruction:/u)
  assert.match(text, /  Please revise/u)

  const read = await harness.request('GET')
  assert.equal(read.status, 200)
  assert.deepEqual(read.body.annotations, [AGREE, COMMENT])
})

test('accepts question annotations and asks the model to explain', async () => {
  const harness = createHarness()
  const agent = harness.agent('s1')
  const expected = { id: 'a5', kind: 'question', quote: 'Unclear passage' }
  const posted = await harness.request('POST', { sessionId: 's1', annotations: [QUESTION] })
  assert.equal(posted.status, 200)
  assert.deepEqual(posted.body.annotations, [expected])

  assert.equal(agent.inbox.nextStep.length, 1)
  const message = agent.inbox.nextStep[0]
  assert.deepEqual(message.source.annotations, [expected])
  const text = message.content[0].text
  assert.match(text, /1\. QUESTION/u)
  assert.match(text, /unsure about that passage/u)
  assert.match(text, /explain it further/u)
  assert.match(text, /> Unclear passage/u)
  assert.doesNotMatch(text, /This note must be dropped/u)

  const read = await harness.request('GET')
  assert.equal(read.status, 200)
  assert.deepEqual(read.body.annotations, [expected])
})

test('replaces the same inbox message while idle', async () => {
  const harness = createHarness()
  const agent = harness.agent('s1')
  await harness.request('POST', { sessionId: 's1', annotations: [AGREE] })
  const id = agent.inbox.nextStep[0].id
  await harness.request('POST', { sessionId: 's1', annotations: [AGREE, DISAGREE] })
  assert.equal(agent.inbox.nextStep.length, 1)
  assert.equal(agent.inbox.nextStep[0].id, id)
  assert.equal(agent.inbox.nextStep[0].source.annotations.length, 2)
})

test('removes the inbox message when every note is cleared', async () => {
  const harness = createHarness()
  const agent = harness.agent('s1')
  await harness.request('POST', { sessionId: 's1', annotations: [AGREE] })
  assert.equal(agent.inbox.nextStep.length, 1)
  await harness.request('POST', { sessionId: 's1', annotations: [] })
  assert.equal(agent.inbox.nextStep.length, 0)
})

test('holds notes back while the agent is running and injects them at idle', async () => {
  const harness = createHarness()
  const agent = harness.agent('s2')
  agent.status = 'running'
  await harness.request('POST', { sessionId: 's2', annotations: [AGREE] })
  assert.equal(agent.inbox.nextStep.length, 0)
  agent.status = 'idle'
  harness.emit('agent/status', { agent, status: 'idle' })
  assert.equal(agent.inbox.nextStep.length, 1)
})

test('clears stored notes when the mirror message is claimed', async () => {
  const harness = createHarness()
  const agent = harness.agent('s1')
  await harness.request('POST', { sessionId: 's1', annotations: [AGREE] })
  const message = agent.inbox.nextStep[0]
  agent.inbox.nextStep.length = 0
  harness.emit('agent/inbox/claimed', { agent, message })
  const read = await harness.request('GET')
  assert.deepEqual(read.body.annotations, [])
})

test('recovers pending notes from an existing inbox mirror', async () => {
  const harness = createHarness()
  const agent = harness.agent('s3')
  agent.inbox.nextStep.push({
    id: 'inplace-annotate-recovered',
    role: 'user',
    content: [{ type: 'text', text: 'old' }],
    source: { kind: 'inplace-annotate', annotations: [AGREE, COMMENT] },
  })
  harness.emit('agent/created', { agent })
  const read = await harness.request('GET', undefined, 's3')
  assert.deepEqual(read.body.annotations, [AGREE, COMMENT])
  assert.equal(agent.inbox.nextStep.length, 1)
  assert.equal(agent.inbox.nextStep[0].source.kind, 'inplace-annotate')
})

test('normalizes untrusted annotations instead of failing the batch', async () => {
  const harness = createHarness()
  const agent = harness.agent('s1')
  const tooMany = Array.from({ length: 25 }, (_, index) => ({
    id: `n${index}`,
    kind: 'agree',
    quote: `passage ${index}`,
  }))
  const posted = await harness.request('POST', {
    sessionId: 's1',
    annotations: [
      ...tooMany,
      { id: 'bad', kind: 'maybe', quote: 'ignored' },
      { id: 'blank', kind: 'agree', quote: '   ' },
      { id: 'empty-comment', kind: 'comment', quote: 'text', note: '   ' },
      { id: 'dup', kind: 'agree', quote: 'first' },
      { id: 'dup', kind: 'disagree', quote: 'second' },
      { id: 'long', kind: 'comment', quote: 'x'.repeat(4000), note: 'y'.repeat(4000) },
    ],
  })
  assert.equal(posted.status, 200)
  const stored = posted.body.annotations
  assert.equal(stored.length, 20)
  assert.equal(stored.some((annotation) => annotation.id === 'bad'), false)
  assert.equal(stored.some((annotation) => annotation.id === 'blank'), false)
  assert.equal(stored.some((annotation) => annotation.id === 'empty-comment'), false)
  assert.equal(stored.filter((annotation) => annotation.id === 'dup').length, 0)
  assert.equal(agent.inbox.nextStep.length, 1)
})

test('clamps overlong text to the documented ceilings', async () => {
  const harness = createHarness()
  harness.agent('s1')
  const posted = await harness.request('POST', {
    sessionId: 's1',
    annotations: [{ id: 'long', kind: 'comment', quote: 'x'.repeat(4000), note: 'y'.repeat(4000) }],
  })
  const stored = posted.body.annotations[0]
  assert.equal(stored.quote.length, 3000)
  assert.equal(stored.note.length, 3000)
  assert.ok(stored.quote.endsWith('…'))
})

test('round-trips one optional DOM anchor without leaking it into the prompt', async () => {
  const harness = createHarness()
  const agent = harness.agent('s1')
  const posted = await harness.request('POST', { sessionId: 's1', annotations: [ANCHORED] })
  assert.equal(posted.status, 200)
  assert.deepEqual(posted.body.annotations, [ANCHORED])
  assert.equal(agent.inbox.nextStep.length, 1)
  assert.deepEqual(agent.inbox.nextStep[0].source.annotations, [ANCHORED])
  const text = agent.inbox.nextStep[0].content[0].text
  assert.match(text, /> First passage/u)
  assert.doesNotMatch(text, /anchor|node:message-1|"flow"/u)

  const read = await harness.request('GET')
  assert.deepEqual(read.body.annotations, [ANCHORED])
})

test('drops unusable anchors but keeps the annotation', async () => {
  const harness = createHarness()
  harness.agent('s1')
  const posted = await harness.request('POST', {
    sessionId: 's1',
    annotations: [
      { id: 'bad-order', kind: 'comment', quote: 'Target', note: 'Revise', anchor: { start: 9, end: 3 } },
      { id: 'bad-key', kind: 'agree', quote: 'Long key', anchor: { flow: 'f'.repeat(501), start: 0, end: 1 } },
      {
        id: 'partial',
        kind: 'agree',
        quote: 'Optional fields',
        anchor: { node: 'node:ok', turn: -1, source: 1.5, start: 0, end: 2 },
      },
    ],
  })
  assert.equal(posted.status, 200)
  const stored = posted.body.annotations
  assert.equal(stored[0].anchor, undefined)
  assert.equal(stored[1].anchor, undefined)
  assert.deepEqual(stored[2].anchor, { node: 'node:ok', start: 0, end: 2 })
})

test('restores an optional anchor from an inbox mirror', async () => {
  const harness = createHarness()
  const agent = harness.agent('s3')
  agent.inbox.nextStep.push({
    id: 'inplace-annotate-anchored',
    role: 'user',
    content: [{ type: 'text', text: 'old' }],
    source: { kind: 'inplace-annotate', annotations: [ANCHORED] },
  })
  harness.emit('agent/created', { agent })
  const read = await harness.request('GET', undefined, 's3')
  assert.deepEqual(read.body.annotations, [ANCHORED])
  assert.deepEqual(agent.inbox.nextStep[0].source.annotations, [ANCHORED])
})

test('rejects malformed requests', async () => {
  const harness = createHarness()
  harness.agent('s1')
  assert.equal((await harness.request('POST', '{not json')).status, 400)
  assert.equal((await harness.request('POST', { annotations: [AGREE] })).status, 400)
  assert.equal((await harness.request('POST', { sessionId: 's1', annotations: 'nope' })).status, 400)
  assert.equal((await harness.request('PUT', { sessionId: 's1', annotations: [] })).status, 405)
  const huge = await harness.request('POST', 'x'.repeat(70 * 1024))
  assert.equal(huge.status, 413)
  const missing = await harness.request('GET', undefined, '')
  assert.equal(missing.status, 400)
})

test('keeps the note message out of the user prompt path', async () => {
  const harness = createHarness()
  const agent = harness.agent('s1')
  await harness.request('POST', { sessionId: 's1', annotations: [AGREE] })
  assert.equal(agent.inbox.nextStep.length, 1)
  assert.equal(agent.inbox.nextTurn.length, 0)
})
