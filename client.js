window.__ModuleLoader__.load({
  id: '@local/dsh-inplace-annotate',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Locale namespace owned by this plugin. */
    const NS = 'inplaceAnnotate'

    /** Exact Fetch endpoint mounted by the Host half on Connection. */
    const API = '/api/inplace-annotate/pending'

    /** Keep in step with the Host normalization ceiling. */
    const MAX_ANNOTATIONS = 20
    const MAX_NOTE_CHARS = 3000
    const MAX_ANCHOR_KEY_CHARS = 500
    const MAX_ANCHOR_OFFSET = 10_000_000
    const MAX_ANCHOR_SOURCE = 1000

    /** Pending notes are consumed by the Host on claim; poll while visible. */
    const POLL_MS = 1500

    /** CSS Custom Highlight registry names owned by this plugin. */
    const HIGHLIGHT_NAMES = {
      agree: 'inplace-annotate-agree',
      disagree: 'inplace-annotate-disagree',
      comment: 'inplace-annotate-comment',
    }
    const FOCUS_HIGHLIGHT = 'inplace-annotate-focus'
    const HIGHLIGHT_KINDS = ['agree', 'disagree', 'comment']

    /** Inline SVG path data shared by React controls and the DOM badge layer. */
    const GLYPHS = {
      agree: [
        'M7 10v12',
        'M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z',
      ],
      disagree: [
        'M17 14V2',
        'M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z',
      ],
      comment: [
        'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
      ],
      'chevron-down': ['m6 9 6 6 6-6'],
      'chevron-up': ['m6 15 6-6 6 6'],
      jump: ['M7 17 17 7', 'M7 7h10v10'],
    }

    /** Shared empty snapshot keeps `useSyncExternalStore` reference-stable. */
    const EMPTY = Object.freeze([])

    /** English dictionary. */
    const en = {
      'actions.label': 'Review notes',
      'actions.agree': 'Agree',
      'actions.disagree': 'Disagree',
      'actions.comment': 'Comment',
      'actions.quote': 'Quote',
      'comment.placeholder': 'What should change?',
      'comment.save': 'Save',
      'comment.cancel': 'Cancel',
      'comment.remaining': 'characters left',
      'dock.title': 'Review notes',
      'dock.hint': 'Attached to your next message',
      'dock.clear': 'Clear all',
      'dock.confirm': 'Confirm clear',
      'dock.edit': 'Edit',
      'dock.remove': 'Remove',
      'dock.save': 'Save',
      'dock.cancel': 'Cancel',
      'dock.collapse': 'Collapse list',
      'dock.expand': 'Expand list',
      'dock.jump': 'Jump to text',
      'dock.jumpAria': 'Jump to the annotated passage',
      'dock.notFound': 'The annotated passage is not visible. In Chat view, scroll to load it or expand that section.',
      'kind.agree': 'Agree',
      'kind.disagree': 'Disagree',
      'kind.comment': 'Comment',
      'limit.reached': 'At most 20 notes can be attached.',
      'error.save': 'Review notes were not saved. Check the connection and try again.',
      'error.load': 'Review notes could not be loaded.',
      'quote.failed': 'The selected text could not be quoted.',
    }

    /** Simplified Chinese dictionary. */
    const zh = {
      'actions.label': '评论批注',
      'actions.agree': '同意',
      'actions.disagree': '不同意',
      'actions.comment': '批注',
      'actions.quote': '引用',
      'comment.placeholder': '这条内容应该怎么改？',
      'comment.save': '保存',
      'comment.cancel': '取消',
      'comment.remaining': '字剩余',
      'dock.title': '待发送批注',
      'dock.hint': '将随下一条消息一起发送',
      'dock.clear': '清空',
      'dock.confirm': '确认清空',
      'dock.edit': '编辑',
      'dock.remove': '删除',
      'dock.save': '保存',
      'dock.cancel': '取消',
      'dock.collapse': '收起列表',
      'dock.expand': '展开列表',
      'dock.jump': '跳到原文',
      'dock.jumpAria': '跳到批注对应的原文',
      'dock.notFound': '批注对应的原文当前不可见，请在 Chat 视图滚动加载或展开对应段落。',
      'kind.agree': '同意',
      'kind.disagree': '不同意',
      'kind.comment': '批注',
      'limit.reached': '最多只能附加 20 条批注。',
      'error.save': '批注未保存，请检查连接后重试。',
      'error.load': '批注加载失败。',
      'quote.failed': '无法引用所选文字。',
    }

    /** Theme-token-only styling for the floating bar and the review dock. */
    const CSS = `
.ann-bar{display:flex;align-items:center;gap:2px;padding:4px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;font-size:13px;line-height:16px;color:var(--dsw-alias-label-primary);white-space:nowrap}
.ann-action{border:none;background:transparent;color:inherit;font:inherit;padding:5px 9px;border-radius:999px;cursor:pointer;white-space:nowrap}
.ann-action:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ann-action[data-kind="agree"]:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-success-primary)}
.ann-action[data-kind="disagree"]:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-state-error-primary)}
.ann-action[data-kind="comment"]:hover,.ann-action[data-kind="quote"]:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary)}
.ann-action:disabled{opacity:.5;cursor:default}
.ann-sep{width:1px;height:16px;background:var(--dsw-alias-border-l1);margin:0 2px}
.ann-comment{width:min(320px,100%);box-sizing:border-box;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px;font-size:12px;line-height:17px;color:var(--dsw-alias-label-primary)}
.ann-quote{max-height:64px;overflow:auto;border-left:2px solid var(--dsw-alias-border-l2);padding-left:8px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word}
.ann-input{width:100%;box-sizing:border-box;resize:vertical;min-height:64px;max-height:160px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;padding:8px}
.ann-input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:0}
.ann-foot{display:flex;align-items:center;gap:8px}
.ann-hint{color:var(--dsw-alias-label-secondary);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.ann-error{color:var(--dsw-alias-state-error-primary)}
.ann-btn{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;padding:4px 10px;border-radius:999px;cursor:pointer}
.ann-btn:hover{background:var(--dsw-alias-bg-layer-2)}
.ann-btn:disabled{opacity:.5;cursor:default}
.ann-btn--primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.ann-dock{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:10px;padding:8px 10px;font-size:12px;line-height:17px;color:var(--dsw-alias-label-primary)}
.ann-head{display:flex;align-items:center;gap:8px}
.ann-title{font-weight:600}
.ann-count{min-width:18px;height:18px;padding:0 5px;box-sizing:border-box;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px;text-align:center}
.ann-head-hint{flex:1;min-width:0;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ann-link{border:none;background:transparent;color:var(--dsw-alias-brand-primary);font:inherit;padding:0 2px;cursor:pointer;border-radius:4px}
.ann-link:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ann-list{list-style:none;display:flex;flex-direction:column;gap:6px;max-height:180px;overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable;margin:8px 0 0;padding:0}
.ann-list[hidden]{display:none}
.ann-row{display:flex;flex-direction:column;gap:4px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:6px}
.ann-row-head{display:flex;align-items:center;gap:6px}
.ann-row-actions{margin-left:auto;display:flex;gap:8px}
.ann-badge{font-size:11px;line-height:16px;padding:0 6px;border-radius:999px;border:1px solid currentColor}
.ann-badge--agree{color:var(--dsw-alias-state-success-primary)}
.ann-badge--disagree{color:var(--dsw-alias-state-error-primary)}
.ann-badge--comment{color:var(--dsw-alias-brand-primary)}
.ann-row-quote{color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.ann-row-note{white-space:pre-wrap;word-break:break-word}
.ann-icon-btn{border:none;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;padding:2px;border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex:none}
.ann-icon-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.ann-icon-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.ann-row-jump{border:none;background:transparent;color:inherit;font:inherit;text-align:left;padding:0;display:flex;align-items:flex-start;gap:8px;width:100%;cursor:pointer;border-radius:6px}
.ann-row-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.ann-row-jump-icon{flex:none;color:var(--dsw-alias-label-secondary);opacity:.65;padding-top:1px}
.ann-row-jump:hover .ann-row-quote,.ann-row-jump:hover .ann-row-jump-icon{color:var(--dsw-alias-brand-primary)}
.ann-row-jump:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.ann-row[data-active]{background:var(--dsw-alias-bg-layer-2);border-radius:6px;border-top-color:transparent}
.ann-row[data-active] .ann-row-quote{color:var(--dsw-alias-label-primary)}
.ann-layer{position:fixed;inset:0;z-index:7;pointer-events:none;overflow:hidden}
.ann-marker{position:absolute;width:18px;height:18px;box-sizing:border-box;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);box-shadow:0 1px 2px color-mix(in srgb,var(--dsw-alias-label-primary) 18%,transparent);pointer-events:none;color:var(--dsw-alias-brand-primary)}
.ann-marker svg{width:11px;height:11px;display:block}
.ann-marker--agree{color:var(--dsw-alias-state-success-primary)}
.ann-marker--disagree{color:var(--dsw-alias-state-error-primary)}
.ann-marker--comment{color:var(--dsw-alias-brand-primary)}
.ann-marker--focus{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
::highlight(inplace-annotate-agree){background-color:rgba(255,213,0,.28);background-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 24%,transparent);text-decoration:underline;text-decoration-color:var(--dsw-alias-state-success-primary);text-decoration-thickness:1.5px;text-underline-offset:2px}
::highlight(inplace-annotate-disagree){background-color:rgba(255,213,0,.28);background-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 24%,transparent);text-decoration:underline;text-decoration-color:var(--dsw-alias-state-error-primary);text-decoration-thickness:1.5px;text-underline-offset:2px}
::highlight(inplace-annotate-comment){background-color:rgba(255,213,0,.28);background-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 24%,transparent);text-decoration:underline;text-decoration-color:var(--dsw-alias-brand-primary);text-decoration-thickness:1.5px;text-underline-offset:2px}
::highlight(inplace-annotate-focus){background-color:rgba(59,130,246,.32);background-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,transparent);text-decoration:underline;text-decoration-color:var(--dsw-alias-brand-primary);text-decoration-thickness:2px;text-underline-offset:2px}
`

    /**
     * Copy one text dictionary into the locale service.
     * @param ctx - Client context.
     */
    const dictionaries = { en, zh }

    /** One immutable annotation list per Session with its listeners. */
    const stores = new Map()

    /**
     * Read (and lazily create) one Session's store.
     * @param sessionId - Session identity.
     * @returns mutable store record.
     */
    function storeFor(sessionId) {
      let store = stores.get(sessionId)
      if (store === undefined) {
        store = {
          annotations: EMPTY,
          rev: 0,
          writing: 0,
          loaded: false,
          error: null,
          listeners: new Set(),
        }
        stores.set(sessionId, store)
      }
      return store
    }

    /** Publish one store change to its React subscribers. */
    function notify(store) {
      for (const listener of [...store.listeners]) {
        try {
          listener()
        } catch {}
      }
    }

    /**
     * Subscribe a listener to one Session's annotation list.
     * @param sessionId - Session identity.
     * @param listener - React invalidation callback.
     * @returns unsubscribe callback.
     */
    function subscribe(sessionId, listener) {
      const store = storeFor(sessionId)
      store.listeners.add(listener)
      return () => store.listeners.delete(listener)
    }

    /**
     * Read one Session's annotation list with a stable snapshot.
     * @param sessionId - Session identity.
     * @returns current annotations.
     */
    function useAnnotations(sessionId) {
      const subscribeFn = React.useCallback((listener) => subscribe(sessionId, listener), [sessionId])
      const read = React.useCallback(() => storeFor(sessionId).annotations, [sessionId])
      return React.useSyncExternalStore(subscribeFn, read, read)
    }

    /**
     * Read one Session's last synchronization error.
     * @param sessionId - Session identity.
     * @returns error text, or null.
     */
    function useStoreError(sessionId) {
      const subscribeFn = React.useCallback((listener) => subscribe(sessionId, listener), [sessionId])
      const read = React.useCallback(() => storeFor(sessionId).error, [sessionId])
      return React.useSyncExternalStore(subscribeFn, read, read)
    }

    /**
     * Compare two optional anchors by content.
     * @param left - current anchor.
     * @param right - candidate anchor.
     * @returns whether both describe the same passage.
     */
    function sameAnchor(left, right) {
      if (left === right) return true
      if (left === null || right === null || left === undefined || right === undefined) return false
      return left.flow === right.flow
        && left.node === right.node
        && left.turn === right.turn
        && left.source === right.source
        && left.start === right.start
        && left.end === right.end
    }

    /**
     * Compare two normalized annotation lists by content.
     * @param left - current list.
     * @param right - candidate list.
     * @returns whether they carry the same notes.
     */
    function sameAnnotations(left, right) {
      if (left === right) return true
      if (left.length !== right.length) return false
      for (let index = 0; index < left.length; index += 1) {
        const a = left[index]
        const b = right[index]
        if (a.id !== b.id || a.kind !== b.kind || a.quote !== b.quote || (a.note ?? '') !== (b.note ?? '')) return false
        if (!sameAnchor(a.anchor, b.anchor)) return false
      }
      return true
    }

    /** @returns a fresh annotation identity. */
    function newAnnotationId() {
      try {
        return `inplace-annotate-${crypto.randomUUID()}`
      } catch {
        return `inplace-annotate-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
      }
    }

    /**
     * Strip all whitespace for text comparisons.
     * @param value - text to normalize.
     * @returns text without whitespace.
     */
    function normalizeText(value) {
      return typeof value === 'string' ? value.replace(/\s+/gu, '') : ''
    }

    /**
     * Whether one element is renderer chrome excluded from selectable text.
     * @param element - text parent candidate.
     * @returns whether the element and its ancestors are excluded.
     */
    function excludedForAnchor(element) {
      if (element.closest('[data-text-interaction-exclude], [hidden], .sr-only, .katex-mathml') !== null) return true
      const hidden = element.closest('[aria-hidden="true"]')
      if (hidden !== null && element.closest('.katex-html') === null) return true
      const button = element.closest('button')
      return button !== null && button.closest('code') === null
    }

    /**
     * Collect visible text nodes under one interaction source.
     * @param root - source element or a detached holder.
     * @returns text nodes in document order.
     */
    function visibleTextNodes(root) {
      if (typeof document === 'undefined' || root === null) return []
      const nodes = []
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (node.data.length === 0) return NodeFilter.FILTER_REJECT
          const parent = node.parentElement
          if (parent === null || excludedForAnchor(parent)) return NodeFilter.FILTER_REJECT
          return NodeFilter.FILTER_ACCEPT
        },
      })
      while (walker.nextNode()) nodes.push(walker.currentNode)
      return nodes
    }

    /**
     * Read the visible text covered by one Range.
     * @param range - live browser range.
     * @returns filtered visible text, with renderer chrome removed.
     */
    function visibleTextForRange(range) {
      try {
        const holder = document.createElement('div')
        holder.append(range.cloneContents())
        return visibleTextNodes(holder).map((node) => node.data).join('')
      } catch {
        return ''
      }
    }

    /**
     * Build the flat visible-text index for one source.
     * @param source - text interaction source.
     * @returns nodes, prefix offsets, node index, and total length.
     */
    function visibleTextIndex(source) {
      const nodes = visibleTextNodes(source)
      const starts = []
      const index = new Map()
      let total = 0
      nodes.forEach((node, position) => {
        starts.push(total)
        index.set(node, position)
        total += node.data.length
      })
      return { nodes, starts, index, total }
    }

    /**
     * Map one DOM position to a flat visible-text offset.
     * @param node - Range container.
     * @param offset - Range offset.
     * @param index - visibleTextIndex result.
     * @param bias - whether this is a start or end boundary.
     * @returns flat offset, or null for an element boundary.
     */
    function flatTextOffset(node, offset, index, bias) {
      if (node.nodeType === 3) {
        const position = index.index.get(node)
        if (position !== undefined) return index.starts[position] + Math.max(0, Math.min(offset, node.data.length))
        for (let cursor = 0; cursor < index.nodes.length; cursor += 1) {
          if ((node.compareDocumentPosition(index.nodes[cursor]) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0) {
            if (bias === 'end' && cursor > 0) return index.starts[cursor - 1] + index.nodes[cursor - 1].data.length
            return index.starts[cursor]
          }
        }
        return index.total
      }
      return null
    }

    /**
     * Capture the browser selection as a portable, display-only anchor.
     *
     * The anchor stores flat offsets into the source's visible text nodes, plus
     * the nearest Chat keys. It is validated against the surface's own selected
     * text, so a stale or mismatched selection simply saves without an anchor.
     * @param text - text returned by the active interaction surface.
     * @returns normalized anchor, or null.
     */
    function captureAnchor(text) {
      if (typeof window === 'undefined' || typeof document === 'undefined') return null
      if (typeof text !== 'string' || text === '') return null
      const selection = window.getSelection()
      if (selection === null || selection.rangeCount !== 1 || selection.isCollapsed) return null
      const range = selection.getRangeAt(0)
      const sourceOf = (node) => (node instanceof Element ? node : node.parentElement)?.closest('[data-text-interaction-source]') ?? null
      const source = sourceOf(range.startContainer)
      if (source === null || source !== sourceOf(range.endContainer)) return null
      if (!source.contains(range.startContainer) || !source.contains(range.endContainer)) return null
      if (source.closest('[hidden], [inert], [data-text-interaction-exclude]') !== null) return null
      const index = visibleTextIndex(source)
      if (index.nodes.length === 0) return null
      const start = flatTextOffset(range.startContainer, range.startOffset, index, 'start')
      const end = flatTextOffset(range.endContainer, range.endOffset, index, 'end')
      if (start === null || end === null || end <= start) return null
      if (normalizeText(visibleTextForRange(range)) !== normalizeText(text)) return null
      const flowElement = source.closest('[data-chat-anchor-key]')
      const nodeElement = source.closest('[data-chat-node-key]')
      const flowValue = flowElement?.getAttribute('data-chat-anchor-key') ?? ''
      const nodeValue = nodeElement?.getAttribute('data-chat-node-key') ?? ''
      const flow = flowValue !== '' && flowValue.length <= MAX_ANCHOR_KEY_CHARS ? flowValue : undefined
      const nodeKey = nodeValue !== '' && nodeValue.length <= MAX_ANCHOR_KEY_CHARS ? nodeValue : undefined
      if (flow === undefined && nodeKey === undefined) return null
      if (start > MAX_ANCHOR_OFFSET || end > MAX_ANCHOR_OFFSET) return null
      const turnElement = source.closest('[data-chat-turn]')
      const turnValue = turnElement?.getAttribute('data-chat-turn') ?? ''
      const turn = /^\d+$/.test(turnValue) ? Number(turnValue) : undefined
      const scope = flowElement ?? source.closest('[data-chat-flow]') ?? source.ownerDocument
      const ordinal = [...scope.querySelectorAll('[data-text-interaction-source]')].indexOf(source)
      return {
        ...(flow === undefined ? {} : { flow }),
        ...(nodeKey === undefined ? {} : { node: nodeKey }),
        ...(turn === undefined || turn > 1_000_000_000 ? {} : { turn }),
        ...(ordinal < 0 || ordinal > MAX_ANCHOR_SOURCE ? {} : { source: ordinal }),
        start,
        end,
      }
    }

    /**
     * Create one inline SVG glyph for DOM-rendered markers.
     * @param kind - glyph key.
     * @returns SVG element.
     */
    function createGlyph(kind) {
      const namespace = 'http://www.w3.org/2000/svg'
      const svg = document.createElementNS(namespace, 'svg')
      svg.setAttribute('viewBox', '0 0 24 24')
      svg.setAttribute('fill', 'none')
      svg.setAttribute('stroke', 'currentColor')
      svg.setAttribute('stroke-width', '2')
      svg.setAttribute('stroke-linecap', 'round')
      svg.setAttribute('stroke-linejoin', 'round')
      svg.setAttribute('aria-hidden', 'true')
      svg.setAttribute('focusable', 'false')
      for (const path of GLYPHS[kind] ?? []) {
        const shape = document.createElementNS(namespace, 'path')
        shape.setAttribute('d', path)
        svg.append(shape)
      }
      return svg
    }

    /**
     * Resolve the CSS Custom Highlight registry when the browser supports it.
     * @returns registry, or null.
     */
    function highlightRegistry() {
      if (typeof window === 'undefined') return null
      const browserCSS = window.CSS
      if (browserCSS === undefined || browserCSS.highlights === undefined) return null
      if (typeof Highlight !== 'function') return null
      return browserCSS.highlights
    }

    /** Remove every highlight registry name owned by this plugin. */
    function clearHighlights() {
      const registry = highlightRegistry()
      if (registry === null) return
      for (const name of Object.values(HIGHLIGHT_NAMES)) registry.delete(name)
      registry.delete(FOCUS_HIGHLIGHT)
    }

    /**
     * Publish one annotation list to the CSS Custom Highlight registry.
     * @param annotations - current annotations.
     * @param focusId - annotation to emphasize, or null.
     * @param ranges - resolved annotation ranges.
     */
    function syncHighlights(annotations, focusId, ranges) {
      const registry = highlightRegistry()
      if (registry === null) return
      const groups = { agree: [], disagree: [], comment: [] }
      let focused = null
      for (const annotation of annotations) {
        const located = ranges.get(annotation.id)
        if (located === undefined) continue
        if (annotation.id === focusId) {
          focused = located.range
          continue
        }
        const group = groups[annotation.kind]
        if (group !== undefined) group.push(located.range)
      }
      for (const kind of HIGHLIGHT_KINDS) {
        const name = HIGHLIGHT_NAMES[kind]
        const list = groups[kind]
        if (list.length === 0) {
          registry.delete(name)
          continue
        }
        try {
          registry.set(name, new Highlight(...list))
        } catch {
          registry.delete(name)
        }
      }
      if (focused === null) {
        registry.delete(FOCUS_HIGHLIGHT)
        return
      }
      try {
        const highlight = new Highlight(focused)
        highlight.priority = 1
        registry.set(FOCUS_HIGHLIGHT, highlight)
      } catch {
        registry.delete(FOCUS_HIGHLIGHT)
      }
    }

    /**
     * Find every mounted source that could belong to one anchor.
     * @param root - Chat flow column.
     * @param anchor - normalized annotation anchor.
     * @returns candidate sources, preferring the recorded ordinal.
     */
    function sourceCandidates(root, anchor) {
      const holders = []
      const holderSeen = new Set()
      const collect = (attribute, value) => {
        if (typeof value !== 'string' || value === '') return
        for (const element of root.querySelectorAll(`[${attribute}]`)) {
          if (element.getAttribute(attribute) !== value) continue
          if (holderSeen.has(element)) continue
          holderSeen.add(element)
          holders.push(element)
        }
      }
      collect('data-chat-node-key', anchor.node)
      collect('data-chat-anchor-key', anchor.flow)
      if (holders.length === 0) return []
      const sources = []
      const seen = new Set()
      const add = (source) => {
        if (!(source instanceof Element) || !source.hasAttribute('data-text-interaction-source') || seen.has(source)) return
        seen.add(source)
        sources.push(source)
      }
      for (const holder of holders) {
        add(holder)
        for (const source of holder.querySelectorAll('[data-text-interaction-source]')) add(source)
      }
      if (typeof anchor.source === 'number' && anchor.source >= 0 && anchor.source < sources.length) {
        const preferred = sources.splice(anchor.source, 1)[0]
        sources.unshift(preferred)
      }
      return sources.slice(0, 60)
    }

    /**
     * Map one flat visible-text offset back to a DOM position.
     * @param index - visibleTextIndex result.
     * @param offset - flat offset.
     * @param bias - start or end boundary.
     * @returns node and offset, or null.
     */
    function positionAt(index, offset, bias) {
      const { nodes, starts, total } = index
      if (nodes.length === 0 || offset < 0 || offset > total) return null
      let low = 0
      let high = nodes.length - 1
      let position = 0
      while (low <= high) {
        const middle = (low + high) >> 1
        if (starts[middle] <= offset) {
          position = middle
          low = middle + 1
        } else {
          high = middle - 1
        }
      }
      if (bias === 'end' && offset === starts[position] && position > 0) position -= 1
      const node = nodes[position]
      return { node, offset: Math.max(0, Math.min(node.data.length, offset - starts[position])) }
    }

    /**
     * Rebuild one annotation range from its flat visible-text offsets.
     * @param source - mounted interaction source.
     * @param anchor - annotation anchor.
     * @returns live Range, or null.
     */
    function rangeFromAnchor(source, anchor) {
      if (typeof document === 'undefined') return null
      const index = visibleTextIndex(source)
      const start = positionAt(index, anchor.start, 'start')
      const end = positionAt(index, anchor.end, 'end')
      if (start === null || end === null) return null
      try {
        const range = document.createRange()
        range.setStart(start.node, start.offset)
        range.setEnd(end.node, end.offset)
        return range.collapsed ? null : range
      } catch {
        return null
      }
    }

    /**
     * Check that one rebuilt range still describes the saved passage.
     * @param range - rebuilt range.
     * @param quote - saved selected text (possibly clamped by the Host).
     * @returns whether the visible text still matches.
     */
    function rangeMatchesQuote(range, quote) {
      const actual = normalizeText(visibleTextForRange(range))
      const expected = normalizeText(quote)
      if (actual === '' || expected === '') return false
      if (actual === expected) return true
      return expected.endsWith('…') && actual.startsWith(expected.slice(0, -1))
    }

    /**
     * Locate one quote inside a single text node.
     * @param source - mounted interaction source.
     * @param quote - saved selected text.
     * @returns live Range, or null.
     */
    function findExactQuoteRange(source, quote) {
      if (typeof document === 'undefined' || typeof quote !== 'string' || quote === '') return null
      const candidates = quote.endsWith('…') && quote.length > 1 ? [quote, quote.slice(0, -1)] : [quote]
      for (const node of visibleTextNodes(source)) {
        for (const candidate of candidates) {
          const start = node.data.indexOf(candidate)
          if (start < 0) continue
          try {
            const range = document.createRange()
            range.setStart(node, start)
            range.setEnd(node, start + candidate.length)
            return range
          } catch {
            continue
          }
        }
      }
      return null
    }

    /**
     * Locate one quote across text-node boundaries, ignoring whitespace.
     * @param source - mounted interaction source.
     * @param quote - saved selected text.
     * @returns live Range, or null.
     */
    function findNormalizedQuoteRange(source, quote) {
      if (typeof document === 'undefined' || typeof quote !== 'string' || quote === '') return null
      const candidates = (quote.endsWith('…') && quote.length > 1 ? [quote, quote.slice(0, -1)] : [quote])
        .map((candidate) => normalizeText(candidate))
        .filter((candidate) => candidate !== '')
      if (candidates.length === 0) return null
      const positions = []
      let text = ''
      for (const node of visibleTextNodes(source)) {
        for (let offset = 0; offset < node.data.length; offset += 1) {
          const character = node.data.charAt(offset)
          if (/\s/u.test(character)) continue
          positions.push({ node, offset })
          text += character
        }
      }
      for (const candidate of candidates) {
        const startIndex = text.indexOf(candidate)
        if (startIndex < 0) continue
        const start = positions[startIndex]
        const end = positions[startIndex + candidate.length - 1]
        if (start === undefined || end === undefined) continue
        let endOffset = end.offset + 1
        const codePoint = end.node.data.codePointAt(end.offset)
        if (codePoint !== undefined && codePoint > 0xffff) endOffset += 1
        try {
          const range = document.createRange()
          range.setStart(start.node, start.offset)
          range.setEnd(end.node, Math.min(end.node.data.length, endOffset))
          return range
        } catch {
          continue
        }
      }
      return null
    }

    /**
     * Locate one quote with exact then normalized fallbacks.
     * @param source - mounted interaction source.
     * @param quote - saved selected text.
     * @returns live Range, or null.
     */
    function findQuoteRange(source, quote) {
      return findExactQuoteRange(source, quote) ?? findNormalizedQuoteRange(source, quote)
    }

    /**
     * Whether one range currently produces visible line boxes.
     * @param range - live range.
     * @returns whether a non-empty rectangle exists.
     */
    function rangeHasLayout(range) {
      try {
        return [...range.getClientRects()].some((rect) => rect.width > 0 && rect.height > 0)
      } catch {
        return false
      }
    }

    /**
     * Prefer assistant-step sources when a quote alone has to be located.
     * @param source - interaction source.
     * @returns sort weight.
     */
    function sourceRank(source) {
      const kind = source.closest('[data-chat-flow-kind]')?.getAttribute('data-chat-flow-kind')
      if (kind === 'assistant-step') {
        const part = source.closest('[data-chat-group-part]')?.getAttribute('data-chat-group-part')
        return part === 'reasoning' ? 2 : 4
      }
      if (kind === 'user') return 1
      return 0
    }

    /**
     * Collect sources for a quote-only fallback, scoped to a Turn when known.
     * @param root - Chat flow column.
     * @param turn - optional Turn number.
     * @returns candidate sources, assistant replies first.
     */
    function quoteCandidates(root, turn) {
      const sources = []
      const seen = new Set()
      const add = (source) => {
        if (!(source instanceof Element) || !source.hasAttribute('data-text-interaction-source') || seen.has(source)) return
        seen.add(source)
        sources.push(source)
      }
      if (typeof turn === 'number') {
        const wanted = String(turn)
        for (const row of root.querySelectorAll('[data-chat-turn]')) {
          if (row.getAttribute('data-chat-turn') !== wanted) continue
          for (const source of row.querySelectorAll('[data-text-interaction-source]')) add(source)
        }
      } else {
        for (const source of root.querySelectorAll('[data-text-interaction-source]')) add(source)
      }
      sources.sort((left, right) => sourceRank(right) - sourceRank(left))
      return sources.slice(0, 120)
    }

    /**
     * Match one anchor's sources, preferring a visible range.
     * @param sources - anchor-scoped sources.
     * @param anchor - normalized anchor.
     * @param quote - saved selected text.
     * @returns range and source, or null.
     */
    function matchAnchorSources(sources, anchor, quote) {
      let hidden = null
      for (const source of sources) {
        const range = rangeFromAnchor(source, anchor)
        if (range === null || !rangeMatchesQuote(range, quote)) continue
        if (rangeHasLayout(range)) return { range, source }
        if (hidden === null) hidden = { range, source }
      }
      for (const source of sources) {
        const range = findQuoteRange(source, quote)
        if (range === null) continue
        if (rangeHasLayout(range)) return { range, source }
        if (hidden === null) hidden = { range, source }
      }
      return hidden
    }

    /**
     * Locate one quote without a usable anchor (old notes or stale keys).
     * @param quote - saved selected text.
     * @param root - Chat flow column.
     * @param turn - optional Turn number.
     * @returns range and source, or null.
     */
    function matchQuoteOnly(quote, root, turn) {
      let hidden = null
      for (const source of quoteCandidates(root, turn)) {
        const range = findQuoteRange(source, quote)
        if (range === null) continue
        if (rangeHasLayout(range)) return { range, source }
        if (hidden === null) hidden = { range, source }
      }
      return hidden
    }

    /**
     * Resolve one annotation back to a live Range in the current Chat DOM.
     * @param annotation - normalized annotation.
     * @param root - optional Chat flow column.
     * @returns range and source, or null.
     */
    function locateAnnotation(annotation, root) {
      if (typeof document === 'undefined') return null
      const chatRoot = root ?? document.querySelector('[data-chat-flow]')
      if (chatRoot === null) return null
      const anchor = annotation.anchor
      if (anchor !== undefined && anchor !== null) {
        const located = matchAnchorSources(sourceCandidates(chatRoot, anchor), anchor, annotation.quote)
        if (located !== null) return located
      }
      return matchQuoteOnly(annotation.quote, chatRoot, anchor?.turn)
    }

    /**
     * Find the scrollport that owns one source.
     * @param source - interaction source.
     * @returns marked conversation scroller, nearest scrollable ancestor, or null.
     */
    function nearestScroller(source) {
      const marked = source.closest('[data-conversation-scroll]')
      if (marked !== null) return marked
      if (typeof getComputedStyle !== 'function') return null
      for (let element = source.parentElement; element !== null; element = element.parentElement) {
        const style = getComputedStyle(element)
        if (/(auto|scroll|overlay)/u.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1) return element
      }
      return null
    }

    /**
     * Scroll the Chat scroller so one resolved range is centered.
     * @param range - annotation range.
     * @param source - interaction source containing it.
     * @returns whether the range currently has layout.
     */
    function scrollRangeIntoView(range, source) {
      if (typeof document === 'undefined') return false
      const readRects = () => {
        try {
          return [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0)
        } catch {
          return []
        }
      }
      let rects = readRects()
      if (rects.length === 0) return false
      const nested = source.closest('[data-step-process-body]')
      if (nested !== null && nested.scrollHeight > nested.clientHeight + 1) {
        const nestedRect = nested.getBoundingClientRect()
        const first = rects[0]
        const delta = first.top - nestedRect.top - nested.clientHeight / 2 + first.height / 2
        nested.scrollTop = Math.max(0, nested.scrollTop + delta)
        rects = readRects()
        if (rects.length === 0) return false
      }
      const scroller = nearestScroller(source)
      if (scroller === null) return true
      const scrollerRect = scroller.getBoundingClientRect()
      const first = rects[0]
      const top = scroller.scrollTop + first.top - scrollerRect.top - scroller.clientHeight / 2 + first.height / 2
      const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
      try {
        scroller.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' })
      } catch {
        scroller.scrollTop = Math.max(0, top)
      }
      return true
    }

    /**
     * Find the mounted holder for one anchor.
     * @param root - Chat flow column.
     * @param anchor - annotation anchor.
     * @returns nearest matching holder, or null.
     */
    function holderForAnchor(root, anchor) {
      if (typeof anchor.flow === 'string' && anchor.flow !== '') {
        for (const element of root.querySelectorAll('[data-chat-anchor-key]')) {
          if (element.getAttribute('data-chat-anchor-key') === anchor.flow) return element
        }
      }
      if (typeof anchor.node === 'string' && anchor.node !== '') {
        for (const element of root.querySelectorAll('[data-chat-node-key]')) {
          if (element.getAttribute('data-chat-node-key') === anchor.node) return element
        }
      }
      return null
    }

    /**
     * Click a collapsed disclosure whose controlled body contains a holder.
     * @param holder - mounted anchor holder.
     * @returns whether a disclosure was toggled.
     */
    function expandDisclosureIn(holder) {
      for (let ancestor = holder; ancestor !== null; ancestor = ancestor.parentElement) {
        for (const button of ancestor.querySelectorAll('button[aria-expanded="false"][aria-controls]')) {
          const targetId = button.getAttribute('aria-controls')
          if (targetId === null) continue
          const target = button.ownerDocument.getElementById(targetId)
          if (target === null) continue
          if (!target.contains(holder) && !holder.contains(target)) continue
          button.click()
          return true
        }
        if (ancestor.matches('[data-chat-flow]')) break
      }
      return false
    }

    /**
     * Expand the nearest collapsed disclosure containing a source.
     * @param source - interaction source.
     * @returns whether a disclosure was toggled.
     */
    function expandForSource(source) {
      for (let ancestor = source.parentElement; ancestor !== null; ancestor = ancestor.parentElement) {
        for (const button of ancestor.querySelectorAll('button[aria-expanded="false"][aria-controls]')) {
          const targetId = button.getAttribute('aria-controls')
          if (targetId === null) continue
          const target = button.ownerDocument.getElementById(targetId)
          if (target === null || !target.contains(source)) continue
          button.click()
          return true
        }
        if (ancestor.matches('[data-chat-flow]')) break
      }
      return false
    }

    /**
     * Expand a collapsed section when only the anchor holder is mounted.
     * @param anchor - annotation anchor.
     * @returns whether a disclosure was toggled.
     */
    function expandForAnchor(anchor) {
      if (typeof document === 'undefined' || anchor === undefined || anchor === null) return false
      const root = document.querySelector('[data-chat-flow]')
      if (root === null) return false
      const holder = holderForAnchor(root, anchor)
      return holder === null ? false : expandDisclosureIn(holder)
    }

    /**
     * Intersect two viewport rectangles.
     * @param a - first rectangle.
     * @param b - second rectangle.
     * @returns intersection, or null.
     */
    function intersectRect(a, b) {
      const left = Math.max(a.left, b.left)
      const top = Math.max(a.top, b.top)
      const right = Math.min(a.right, b.right)
      const bottom = Math.min(a.bottom, b.bottom)
      return right <= left || bottom <= top ? null : { left, top, right, bottom }
    }

    /**
     * Read the visible line rectangles for one range inside a clip box.
     * @param range - annotation range.
     * @param bounds - viewport clip.
     * @returns clipped rectangles.
     */
    function rectsWithin(range, bounds) {
      let rects
      try {
        rects = [...range.getClientRects()]
      } catch {
        return []
      }
      const result = []
      for (const rect of rects) {
        if (rect.width <= 0 || rect.height <= 0) continue
        const clipped = intersectRect({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }, bounds)
        if (clipped !== null && clipped.right - clipped.left >= 2 && clipped.bottom - clipped.top >= 2) result.push(clipped)
      }
      return result
    }

    /**
     * Compute the viewport clip for one source: conversation scrollport, composer
     * top, and any nested process body that scrolls independently.
     * @param root - Chat flow column.
     * @param source - interaction source.
     * @returns clip rectangle in viewport coordinates.
     */
    function boundsFor(root, source) {
      const scroller = root.closest('[data-conversation-scroll]')
      const viewport = scroller ?? document.documentElement
      const view = document.defaultView
      const rect = viewport.getBoundingClientRect()
      const scrollbar = Math.max(0, (viewport.offsetWidth ?? 0) - (viewport.clientWidth ?? 0))
      let bounds = {
        left: Math.max(0, rect.left),
        top: Math.max(0, rect.top),
        right: Math.min(view?.innerWidth ?? rect.right, rect.right - scrollbar),
        bottom: Math.min(view?.innerHeight ?? rect.bottom, rect.bottom),
      }
      const composer = scroller !== null ? scroller.querySelector('[data-composer-seat]') : document.querySelector('[data-composer-seat]')
      if (composer !== null) bounds.bottom = Math.min(bounds.bottom, composer.getBoundingClientRect().top - 6)
      const dock = document.querySelector('[data-slot="conversation.input.dock"]')
      if (dock !== null) bounds.bottom = Math.min(bounds.bottom, dock.getBoundingClientRect().top - 6)
      const nested = source.closest('[data-step-process-body]')
      if (nested !== null) {
        const nestedRect = nested.getBoundingClientRect()
        const clipped = intersectRect(bounds, { left: nestedRect.left, top: nestedRect.top, right: nestedRect.right, bottom: nestedRect.bottom })
        if (clipped !== null) bounds = clipped
      }
      return bounds
    }

    /**
     * Place one badge at the top-right of a passage, avoiding earlier badges.
     * @param top - top of the visible passage.
     * @param right - right edge of the visible passage.
     * @param bounds - clip rectangle.
     * @param placed - already placed badge boxes.
     * @returns badge box, or null when no room is available.
     */
    function placeMarker(top, right, bounds, placed) {
      const size = 18
      if (bounds.right - bounds.left < size || bounds.bottom - bounds.top < size) return null
      const baseLeft = Math.min(Math.max(bounds.left, right + 4), bounds.right - size)
      const baseTop = Math.min(Math.max(bounds.top, top - 2), bounds.bottom - size)
      for (let row = 0; row < 7; row += 1) {
        for (let column = 0; column < 7; column += 1) {
          const box = {
            left: Math.min(Math.max(bounds.left, baseLeft - column * 20), bounds.right - size),
            top: Math.min(Math.max(bounds.top, baseTop + row * 20), bounds.bottom - size),
          }
          const candidate = { ...box, right: box.left + size, bottom: box.top + size }
          const collides = placed.some((other) => candidate.left < other.right + 2 && candidate.right > other.left - 2 && candidate.top < other.bottom + 2 && candidate.bottom > other.top - 2)
          if (!collides) return candidate
        }
      }
      return null
    }

    /**
     * Whether an active text-selection surface is open in Chat.
     * @returns whether the floating action bar is visible.
     */
    function selectionSurfaceActive() {
      if (typeof document === 'undefined') return false
      const surface = document.querySelector('[data-text-interaction-surface]')
      return surface !== null && surface.getAttribute('aria-hidden') === 'false'
    }

    /**
     * Create the highlight/badge controller for one mounted dock.
     * @returns controller with start, update, and destroy methods.
     */
    function createDecorationController() {
      let layer = null
      let root = null
      let annotations = EMPTY
      let focusId = null
      let ranges = new Map()
      let frame = 0
      let pendingHighlights = false
      let mutation = null
      let resize = null
      let heartbeat = 0
      let started = false

      const onScroll = () => schedule(false)
      const onResize = () => schedule(false)
      const onSelectionChange = () => schedule(false)

      /**
       * Coalesce one decoration refresh into the next animation frame.
       * @param updateHighlights - whether to resolve ranges and rebuild highlights.
       */
      function schedule(updateHighlights) {
        if (!started) return
        pendingHighlights = pendingHighlights || updateHighlights
        if (frame !== 0) return
        frame = requestAnimationFrame(() => {
          frame = 0
          const runHighlights = pendingHighlights
          pendingHighlights = false
          render(runHighlights)
        })
      }

      /** Refresh ranges only when a cached range or its anchor is no longer valid. */
      function resolveRanges() {
        const keep = new Set(annotations.map((annotation) => annotation.id))
        for (const id of ranges.keys()) if (!keep.has(id)) ranges.delete(id)
        for (const annotation of annotations) {
          const cached = ranges.get(annotation.id)
          if (cached !== undefined && sameAnchor(cached.anchor, annotation.anchor) && cached.range.startContainer.isConnected && cached.range.endContainer.isConnected) continue
          ranges.delete(annotation.id)
          const located = locateAnnotation(annotation, root)
          if (located !== null) ranges.set(annotation.id, { ...located, anchor: annotation.anchor })
        }
      }

      /** Paint one badge per visible annotation. */
      function paintBadges() {
        if (layer === null) return
        layer.replaceChildren()
        if (root === null || annotations.length === 0 || selectionSurfaceActive()) return
        if (root.closest('[inert], [aria-hidden="true"]') !== null) return
        const placed = []
        for (const annotation of annotations) {
          const located = ranges.get(annotation.id)
          if (located === undefined) continue
          const bounds = boundsFor(root, located.source)
          const rects = rectsWithin(located.range, bounds)
          if (rects.length === 0) continue
          let top = Infinity
          let right = -Infinity
          for (const rect of rects) {
            if (rect.top < top) top = rect.top
            if (rect.right > right) right = rect.right
          }
          const box = placeMarker(top, right, bounds, placed)
          if (box === null) continue
          placed.push(box)
          const marker = document.createElement('div')
          marker.className = `ann-marker ann-marker--${annotation.kind}${annotation.id === focusId ? ' ann-marker--focus' : ''}`
          marker.dataset.kind = annotation.kind
          marker.style.left = `${box.left}px`
          marker.style.top = `${box.top}px`
          marker.append(createGlyph(annotation.kind))
          layer.append(marker)
        }
      }

      /**
       * Refresh decorations.
       * @param updateHighlights - whether to rebuild ranges and CSS highlights.
       */
      function render(updateHighlights) {
        if (root === null) {
          clearHighlights()
          if (layer !== null) layer.replaceChildren()
          return
        }
        if (updateHighlights) {
          resolveRanges()
          syncHighlights(annotations, focusId, ranges)
        }
        paintBadges()
      }

      /** Reattach observers when Chat mounts, unmounts, or is replaced. */
      function attachObservers() {
        if (mutation !== null) {
          mutation.disconnect()
          mutation = null
        }
        if (resize !== null) {
          resize.disconnect()
          resize = null
        }
        if (root === null) return
        mutation = new MutationObserver(() => schedule(true))
        mutation.observe(root, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['aria-hidden', 'hidden', 'data-expanded', 'data-group-expanded-mode', 'data-chat-anchor-key', 'data-chat-turn'],
        })
        if (typeof ResizeObserver === 'function') {
          resize = new ResizeObserver(() => schedule(false))
          resize.observe(root)
          const scroller = root.closest('[data-conversation-scroll]')
          if (scroller !== null) resize.observe(scroller)
        }
      }

      /** @returns whether the Chat flow root changed. */
      function ensureRoot() {
        const next = document.querySelector('[data-chat-flow]')
        if (next === root) return false
        root = next
        ranges = new Map()
        clearHighlights()
        if (layer !== null) layer.replaceChildren()
        attachObservers()
        return true
      }

      /** Start decoration ownership for the current dock lifetime. */
      function start() {
        if (started || typeof document === 'undefined') return
        started = true
        layer = document.createElement('div')
        layer.className = 'ann-layer'
        layer.setAttribute('aria-hidden', 'true')
        document.body.append(layer)
        ensureRoot()
        document.addEventListener('scroll', onScroll, true)
        window.addEventListener('resize', onResize)
        document.addEventListener('selectionchange', onSelectionChange)
        heartbeat = window.setInterval(() => {
          if (ensureRoot()) schedule(true)
        }, 1000)
      }

      /**
       * Replace the current annotation list and focus.
       * @param nextAnnotations - current annotations.
       * @param nextFocusId - focused annotation identity, or null.
       */
      function update(nextAnnotations, nextFocusId) {
        annotations = Array.isArray(nextAnnotations) ? nextAnnotations : EMPTY
        focusId = nextFocusId
        const keep = new Set(annotations.map((annotation) => annotation.id))
        for (const id of ranges.keys()) if (!keep.has(id)) ranges.delete(id)
        schedule(true)
      }

      /** Release every registry name, observer, listener, and layer node. */
      function destroy() {
        started = false
        clearHighlights()
        if (frame !== 0) {
          cancelAnimationFrame(frame)
          frame = 0
        }
        if (heartbeat !== 0) {
          clearInterval(heartbeat)
          heartbeat = 0
        }
        if (mutation !== null) {
          mutation.disconnect()
          mutation = null
        }
        if (resize !== null) {
          resize.disconnect()
          resize = null
        }
        if (typeof document !== 'undefined') document.removeEventListener('scroll', onScroll, true)
        if (typeof window !== 'undefined') window.removeEventListener('resize', onResize)
        if (typeof document !== 'undefined') document.removeEventListener('selectionchange', onSelectionChange)
        if (layer !== null) {
          layer.remove()
          layer = null
        }
        ranges = new Map()
        root = null
      }

      return { start, update, destroy }
    }

    /**
     * Own the highlight/badge controller for one dock lifetime.
     * @param annotations - current annotation list.
     * @param focusId - annotation to emphasize, or null.
     */
    function useAnnotationDecorations(annotations, focusId) {
      const controllerRef = React.useRef(null)
      React.useEffect(() => {
        if (typeof document === 'undefined') return undefined
        const controller = createDecorationController()
        controllerRef.current = controller
        controller.start()
        return () => {
          controller.destroy()
          controllerRef.current = null
        }
      }, [])
      React.useEffect(() => {
        controllerRef.current?.update(annotations, focusId)
      }, [annotations, focusId])
    }

    /**
     * One inline SVG glyph.
     * @param props - glyph kind and pixel size.
     * @returns SVG element.
     */
    function Glyph({ kind, size = 14 }) {
      const paths = GLYPHS[kind] ?? []
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        focusable: false,
      }, paths.map((path, index) => h('path', { key: index, d: path })))
    }

    /**
     * Read the Host's current annotations for one Session.
     * @param sessionId - Session identity.
     * @returns normalized annotations.
     */
    async function readPending(sessionId) {
      const response = await fetch(`${API}?sessionId=${encodeURIComponent(sessionId)}`, {
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const body = await response.json()
      return Array.isArray(body?.annotations) ? body.annotations : []
    }

    /**
     * Replace the Host's annotation list for one Session.
     * @param sessionId - Session identity.
     * @param annotations - complete desired list.
     * @returns host-normalized annotations.
     */
    async function writePending(sessionId, annotations) {
      const response = await fetch(API, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sessionId, annotations }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const body = await response.json()
      return Array.isArray(body?.annotations) ? body.annotations : []
    }

    /**
     * Refresh one Session from the Host unless a local write is newer.
     * @param sessionId - Session identity.
     */
    async function refresh(sessionId) {
      const store = storeFor(sessionId)
      const rev = store.rev
      try {
        const server = await readPending(sessionId)
        if (store.rev !== rev || store.writing > 0) return
        const changed = !sameAnnotations(store.annotations, server)
        const recovered = store.error !== null
        if (changed) store.annotations = server
        store.error = null
        if (changed || recovered) notify(store)
      } catch (error) {
        if (store.rev !== rev) return
        store.error = String(error)
        notify(store)
      }
    }

    /**
     * Hydrate one Session once after its dock first mounts.
     * @param sessionId - Session identity.
     */
    function ensureLoaded(sessionId) {
      const store = storeFor(sessionId)
      if (store.loaded) return
      store.loaded = true
      void refresh(sessionId)
    }

    /**
     * Apply one optimistic change and push the complete list to the Host.
     * @param sessionId - Session identity.
     * @param next - complete desired annotations.
     */
    function commit(sessionId, next) {
      const store = storeFor(sessionId)
      store.rev += 1
      store.annotations = next
      store.error = null
      notify(store)
      const rev = store.rev
      store.writing += 1
      void writePending(sessionId, next)
        .then((server) => {
          if (store.rev !== rev) return
          const changed = !sameAnnotations(store.annotations, server)
          const recovered = store.error !== null
          if (changed) store.annotations = server
          store.error = null
          if (changed || recovered) notify(store)
        })
        .catch((error) => {
          if (store.rev !== rev) return
          store.error = String(error)
          notify(store)
        })
        .finally(() => {
          store.writing -= 1
        })
    }

    /**
     * Append one annotation unless the Session is already at the ceiling.
     * @param sessionId - Session identity.
     * @param annotation - new annotation.
     * @returns whether it was added.
     */
    function addAnnotation(sessionId, annotation) {
      const store = storeFor(sessionId)
      if (store.annotations.length >= MAX_ANNOTATIONS) return false
      commit(sessionId, [...store.annotations, annotation])
      return true
    }

    /**
     * Replace one comment note.
     * @param sessionId - Session identity.
     * @param id - annotation identity.
     * @param note - replacement note.
     */
    function updateAnnotation(sessionId, id, note) {
      const store = storeFor(sessionId)
      commit(sessionId, store.annotations.map((annotation) => annotation.id === id ? { ...annotation, note } : annotation))
    }

    /**
     * Remove one annotation.
     * @param sessionId - Session identity.
     * @param id - annotation identity.
     */
    function removeAnnotation(sessionId, id) {
      const store = storeFor(sessionId)
      commit(sessionId, store.annotations.filter((annotation) => annotation.id !== id))
    }

    /**
     * Remove every pending annotation for one Session.
     * @param sessionId - Session identity.
     */
    function clearAnnotations(sessionId) {
      commit(sessionId, [])
    }

    /**
     * Session eligibility shared by the selection surface and the quote plugin.
     * @param session - Session snapshot.
     * @returns whether this Session accepts review notes.
     */
    function sessionWritable(session) {
      if (session.removed) return false
      if (session.subagent === null) return true
      return session.subagent.address.mode === 'continuable' && session.subagent.parentAvailable === true
    }

    /**
     * One selectable action button.
     * @param props - label, kind and click handler.
     * @returns toolbar button.
     */
    function ActionButton({ kind, label, onClick, disabled }) {
      return h('button', {
        type: 'button',
        className: 'ann-action',
        'data-kind': kind,
        disabled: disabled === true,
        onPointerDown: (event) => {
          event.preventDefault()
        },
        onClick: onClick,
      }, label)
    }

    /**
     * Floating Agree / Disagree / Comment / Quote surface.
     *
     * Registered for the `quote` key so it replaces the built-in quote pill
     * (the single Chat surface admits the first interaction that opens), and for
     * the `inplace-annotate` key as the fallback when message-quotes is unavailable.
     * @param props - text interaction surface plus standard Session props.
     * @returns the action bar or the comment editor.
     */
    function SelectionActions(props) {
      const { readText, dismiss, clearSelection, inputActions, useSession, sessionId, t } = props
      const [text] = React.useState(() => readText())
      const [mode, setMode] = React.useState('actions')
      const [note, setNote] = React.useState('')
      const [notice, setNotice] = React.useState(null)
      const anchorRef = React.useRef(null)
      const annotations = useAnnotations(sessionId)
      const writable = useSession((session) => sessionWritable(session))
      const full = annotations.length >= MAX_ANNOTATIONS

      React.useLayoutEffect(() => {
        anchorRef.current = captureAnchor(text)
      }, [text])

      React.useEffect(() => {
        if (text === null) dismiss()
      }, [text, dismiss])

      React.useEffect(() => {
        if (!writable) dismiss()
      }, [writable, dismiss])

      if (text === null || !writable) return null

      const save = (kind, value) => {
        const trimmed = value.trim()
        if (kind === 'comment' && trimmed === '') return
        const anchor = anchorRef.current ?? captureAnchor(text)
        const added = addAnnotation(sessionId, {
          id: newAnnotationId(),
          kind,
          quote: text,
          ...(anchor === null || anchor === undefined ? {} : { anchor }),
          ...(kind === 'comment' ? { note: trimmed } : {}),
        })
        if (!added) {
          setNotice(t('limit.reached'))
          return
        }
        clearSelection()
        dismiss()
      }

      const quote = () => {
        if (typeof inputActions?.insertQuote !== 'function') {
          setNotice(t('quote.failed'))
          return
        }
        if (!inputActions.insertQuote(text)) {
          setNotice(t('quote.failed'))
          return
        }
        clearSelection()
        dismiss()
      }

      const back = () => {
        setMode('actions')
        setNote('')
        setNotice(null)
      }

      const onCommentKeyDown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          back()
          return
        }
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
          save('comment', note)
        }
      }

      if (mode === 'comment') {
        return h('div', { className: 'ann-comment', onKeyDown: onCommentKeyDown }, [
          h('div', { className: 'ann-quote' }, text),
          notice === null ? null : h('div', { className: 'ann-error' }, notice),
          h('textarea', {
            className: 'ann-input',
            value: note,
            maxLength: MAX_NOTE_CHARS,
            autoFocus: true,
            placeholder: t('comment.placeholder'),
            onChange: (event) => setNote(event.target.value),
          }),
          h('div', { className: 'ann-foot' }, [
            h('span', { className: 'ann-hint' }, `${MAX_NOTE_CHARS - note.length} ${t('comment.remaining')}`),
            h('button', { type: 'button', className: 'ann-btn', onClick: back }, t('comment.cancel')),
            h('button', {
              type: 'button',
              className: 'ann-btn ann-btn--primary',
              disabled: note.trim() === '',
              onClick: () => save('comment', note),
            }, t('comment.save')),
          ]),
        ])
      }

      return h('div', { className: 'ann-bar', role: 'toolbar', 'aria-label': t('actions.label') }, [
        notice === null ? null : h('span', { className: 'ann-error', role: 'status' }, notice),
        h(ActionButton, { kind: 'agree', label: t('actions.agree'), disabled: full, onClick: () => save('agree', '') }),
        h(ActionButton, { kind: 'disagree', label: t('actions.disagree'), disabled: full, onClick: () => save('disagree', '') }),
        h(ActionButton, { kind: 'comment', label: t('actions.comment'), disabled: full, onClick: () => setMode('comment') }),
        h('span', { className: 'ann-sep', 'aria-hidden': true }),
        h(ActionButton, { kind: 'quote', label: t('actions.quote'), onClick: quote }),
      ])
    }

    /**
     * One review row with an explicit jump target and optional inline editing.
     * @param props - annotation, jump/edit/remove callbacks, and active state.
     * @returns list item.
     */
    function ReviewRow({ annotation, t, onEdit, onRemove, onJump, active }) {
      return h('li', { className: 'ann-row', 'data-active': active ? 'true' : undefined }, [
        h('div', { className: 'ann-row-head' }, [
          h('span', { className: `ann-badge ann-badge--${annotation.kind}` }, t(`kind.${annotation.kind}`)),
          h('span', { className: 'ann-row-actions' }, [
            annotation.kind === 'comment' ? h('button', {
              type: 'button',
              className: 'ann-link',
              onClick: onEdit,
            }, t('dock.edit')) : null,
            h('button', {
              type: 'button',
              className: 'ann-link',
              onClick: onRemove,
            }, t('dock.remove')),
          ]),
        ]),
        h('button', {
          type: 'button',
          className: 'ann-row-jump',
          title: t('dock.jump'),
          'aria-label': `${t('dock.jumpAria')}: ${annotation.quote.slice(0, 120)}`,
          onClick: onJump,
        }, [
          h('span', { className: 'ann-row-text' }, [
            h('span', { className: 'ann-row-quote' }, annotation.quote),
            annotation.kind === 'comment' && annotation.note ? h('span', { className: 'ann-row-note' }, annotation.note) : null,
          ]),
          h('span', { className: 'ann-row-jump-icon', 'aria-hidden': true }, h(Glyph, { kind: 'jump', size: 14 })),
        ]),
      ])
    }

    /**
     * Review dock above the composer: the temporary store the user reviews.
     * @param props - Session id and locale translator.
     * @returns the dock, or null while nothing is pending.
     */
    function PendingReviewDock({ sessionId, t }) {
      const annotations = useAnnotations(sessionId)
      const error = useStoreError(sessionId)
      const [open, setOpen] = React.useState(true)
      const [editingId, setEditingId] = React.useState(null)
      const [draft, setDraft] = React.useState('')
      const [confirmClear, setConfirmClear] = React.useState(false)
      const [focusId, setFocusId] = React.useState(null)
      const [jumpNotice, setJumpNotice] = React.useState(null)
      const listId = React.useId()
      const focusTimer = React.useRef(null)
      const noticeTimer = React.useRef(null)
      const hasEntries = annotations.length > 0

      useAnnotationDecorations(annotations, focusId)

      React.useEffect(() => {
        ensureLoaded(sessionId)
      }, [sessionId])

      React.useEffect(() => {
        if (!hasEntries) return undefined
        const timer = setInterval(() => {
          void refresh(sessionId)
        }, POLL_MS)
        return () => clearInterval(timer)
      }, [sessionId, hasEntries])

      React.useEffect(() => () => {
        if (focusTimer.current !== null) clearTimeout(focusTimer.current)
        if (noticeTimer.current !== null) clearTimeout(noticeTimer.current)
      }, [])

      React.useEffect(() => {
        if (focusId !== null && !annotations.some((annotation) => annotation.id === focusId)) setFocusId(null)
        if (jumpNotice !== null) setJumpNotice(null)
      }, [annotations])

      if (!hasEntries) return null

      const armFocus = (id) => {
        setFocusId(id)
        if (focusTimer.current !== null) clearTimeout(focusTimer.current)
        focusTimer.current = setTimeout(() => {
          focusTimer.current = null
          setFocusId(null)
        }, 1800)
      }

      const showNotice = () => {
        setFocusId(null)
        setJumpNotice(t('dock.notFound'))
        if (noticeTimer.current !== null) clearTimeout(noticeTimer.current)
        noticeTimer.current = setTimeout(() => {
          noticeTimer.current = null
          setJumpNotice(null)
        }, 4000)
      }

      const jumpTo = (annotation) => {
        let attempts = 0
        const attempt = () => {
          const located = locateAnnotation(annotation)
          if (located !== null && scrollRangeIntoView(located.range, located.source)) {
            if (noticeTimer.current !== null) {
              clearTimeout(noticeTimer.current)
              noticeTimer.current = null
            }
            setJumpNotice(null)
            armFocus(annotation.id)
            return
          }
          if (attempts < 3) {
            const expanded = located !== null ? expandForSource(located.source) : expandForAnchor(annotation.anchor)
            if (expanded) {
              attempts += 1
              setTimeout(attempt, 80)
              return
            }
          }
          showNotice()
        }
        attempt()
      }

      const startEdit = (annotation) => {
        setEditingId(annotation.id)
        setDraft(annotation.note ?? '')
      }

      const cancelEdit = () => {
        setEditingId(null)
        setDraft('')
      }

      const saveEdit = (id) => {
        const trimmed = draft.trim()
        if (trimmed === '') return
        updateAnnotation(sessionId, id, trimmed)
        cancelEdit()
      }

      const clear = () => {
        if (!confirmClear) {
          setConfirmClear(true)
          return
        }
        setConfirmClear(false)
        setJumpNotice(null)
        setFocusId(null)
        clearAnnotations(sessionId)
      }

      return h('div', { className: 'ann-dock' }, [
        h('div', { className: 'ann-head' }, [
          h('span', { className: 'ann-title' }, t('dock.title')),
          h('span', { className: 'ann-count' }, String(annotations.length)),
          h('span', { className: 'ann-head-hint' }, t('dock.hint')),
          h('button', {
            type: 'button',
            className: 'ann-link',
            onClick: clear,
          }, confirmClear ? t('dock.confirm') : t('dock.clear')),
          h('button', {
            type: 'button',
            className: 'ann-icon-btn',
            title: open ? t('dock.collapse') : t('dock.expand'),
            'aria-label': open ? t('dock.collapse') : t('dock.expand'),
            'aria-expanded': open,
            'aria-controls': listId,
            onClick: () => setOpen((value) => !value),
          }, h(Glyph, { kind: open ? 'chevron-up' : 'chevron-down', size: 14 })),
        ]),
        jumpNotice !== null
          ? h('div', { className: 'ann-error', role: 'status' }, jumpNotice)
          : error === null ? null : h('div', { className: 'ann-error', role: 'status' }, `${t('error.save')} (${error})`),
        h('ul', { className: 'ann-list', id: listId, hidden: !open }, annotations.map((annotation) => {
          if (editingId === annotation.id) {
            return h('li', { className: 'ann-row', key: annotation.id }, [
              h('div', { className: 'ann-row-head' }, [
                h('span', { className: `ann-badge ann-badge--${annotation.kind}` }, t(`kind.${annotation.kind}`)),
                h('span', { className: 'ann-row-actions' }, [
                  h('button', { type: 'button', className: 'ann-link', onClick: cancelEdit }, t('dock.cancel')),
                  h('button', {
                    type: 'button',
                    className: 'ann-link',
                    disabled: draft.trim() === '',
                    onClick: () => saveEdit(annotation.id),
                  }, t('dock.save')),
                ]),
              ]),
              h('div', { className: 'ann-row-quote' }, annotation.quote),
              h('textarea', {
                className: 'ann-input',
                value: draft,
                maxLength: MAX_NOTE_CHARS,
                onChange: (event) => setDraft(event.target.value),
              }),
            ])
          }
          return h(ReviewRow, {
            key: annotation.id,
            annotation,
            t,
            active: annotation.id === focusId,
            onJump: () => jumpTo(annotation),
            onEdit: () => startEdit(annotation),
            onRemove: () => removeAnnotation(sessionId, annotation.id),
          })
        })),
      ])
    }

    /** Services needed for the interaction, slot, and locale seats. */
    const inject = ['slots', 'locale', 'sessions', 'uiConversation']

    /**
     * Register dictionaries, the review surface, and the pending dock.
     * @param ctx - Client root context.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, dictionaries), 'inplace-annotate: dictionaries')

      ctx.effect(() => {
        if (typeof document === 'undefined') return () => {}
        const selector = 'style[data-plugin="inplace-annotate"]'
        const existing = document.querySelector(selector)
        if (existing !== null) existing.remove()
        const tag = document.createElement('style')
        tag.dataset.plugin = 'inplace-annotate'
        tag.textContent = CSS
        document.head.appendChild(tag)
        return () => {
          tag.remove()
        }
      }, 'inplace-annotate: styles')

      ctx.effect(() => ctx.uiConversation.interactions.register({
        id: 'inplace-annotate',
        onInteraction(request) {
          if (request.trigger !== 'selection' || request.readText() === null) return
          const binding = ctx.sessions.binding(request.sessionId)
          if (binding === undefined) return
          if (!sessionWritable(binding.session.getSnapshot())) return
          request.open()
        },
      }), 'inplace-annotate: selection interaction')

      // The Chat surface admits the first interaction that opens; replacing the
      // built-in quote cell keeps one bar with Quote preserved as an action.
      ctx.slots.inject('conversation.chat.text-interaction', () => ctx.slots.register({
        name: 'conversation.chat.text-interaction',
        key: 'quote',
        locale: NS,
        priority: -1,
      }, SelectionActions))

      ctx.slots.inject('conversation.chat.text-interaction', () => ctx.slots.register({
        name: 'conversation.chat.text-interaction',
        key: 'inplace-annotate',
        locale: NS,
      }, SelectionActions))

      ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
        name: 'conversation.input.dock',
        id: 'inplace-annotate',
        order: 10,
        locale: NS,
      }, PendingReviewDock))
    }

    return { name: 'inplace-annotate', inject, apply }
  },
})
