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

    /** Pending notes are consumed by the Host on claim; poll while visible. */
    const POLL_MS = 1500

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
.ann-list{list-style:none;display:flex;flex-direction:column;gap:6px;max-height:180px;overflow:auto;margin:8px 0 0;padding:0}
.ann-row{display:flex;flex-direction:column;gap:4px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:6px}
.ann-row-head{display:flex;align-items:center;gap:6px}
.ann-row-actions{margin-left:auto;display:flex;gap:8px}
.ann-badge{font-size:11px;line-height:16px;padding:0 6px;border-radius:999px;border:1px solid currentColor}
.ann-badge--agree{color:var(--dsw-alias-state-success-primary)}
.ann-badge--disagree{color:var(--dsw-alias-state-error-primary)}
.ann-badge--comment{color:var(--dsw-alias-brand-primary)}
.ann-row-quote{color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.ann-row-note{white-space:pre-wrap;word-break:break-word}
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
      const annotations = useAnnotations(sessionId)
      const writable = useSession((session) => sessionWritable(session))
      const full = annotations.length >= MAX_ANNOTATIONS

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
        const added = addAnnotation(sessionId, {
          id: newAnnotationId(),
          kind,
          quote: text,
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
     * One review row with optional inline note editing.
     * @param props - annotation and dock callbacks.
     * @returns list item.
     */
    function ReviewRow({ annotation, t, onEdit, onRemove }) {
      return h('li', { className: 'ann-row' }, [
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
        h('div', { className: 'ann-row-quote' }, annotation.quote),
        annotation.kind === 'comment' && annotation.note ? h('div', { className: 'ann-row-note' }, annotation.note) : null,
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
      const hasEntries = annotations.length > 0

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

      if (!hasEntries) return null

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
            'aria-label': t('dock.title'),
            'aria-expanded': open,
            onClick: () => setOpen((value) => !value),
          }, open ? '–' : '+'),
          h('button', {
            type: 'button',
            className: 'ann-link',
            onClick: clear,
          }, confirmClear ? t('dock.confirm') : t('dock.clear')),
        ]),
        error === null ? null : h('div', { className: 'ann-error', role: 'status' }, `${t('error.save')} (${error})`),
        open ? h('ul', { className: 'ann-list' }, annotations.map((annotation) => {
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
            onEdit: () => startEdit(annotation),
            onRemove: () => removeAnnotation(sessionId, annotation.id),
          })
        })) : null,
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
