#!/usr/bin/env node
/** Rebuild the README's illustrative demo; no DSH session or network is used. */
import { execFile } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = join(root, 'docs/assets/preview.gif')
const WIDTH = 756
const HEIGHT = 640
const FPS = 12
const SECONDS = 18
// Keep the annotation timeline in its existing coordinates, shifting the
// conversation and cursor together into a canvas focused on the chat pane.
const CONTENT_OFFSET = 204
// Conversation text and model names are fictional examples.
const C = {
  ink: '#f9fafb', muted: '#adb2b8', line: '#3b3b40', blue: '#7aaaff',
  amber: '#eab547', green: '#78caa2', red: '#ee8d8d', paper: '#232326',
  soft: '#2c2c2e', yellow: '#514825', selection: '#345888', main: '#151517',
}
const question = 'Invalidate the cache after every write.'
const passage = 'Retry failed requests immediately.'
const note = 'Please add exponential backoff.'
const message = 'Please address my review notes.'
const clamp = (v) => Math.max(0, Math.min(1, v))
const progress = (t, start, end) => clamp((t - start) / (end - start))
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
})[c])
const rect = (x, y, w, h, fill, radius = 0, stroke = 'none') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}"/>`
const text = (x, y, value, size = 16, fill = C.ink, weight = 400) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}">${escape(value)}</text>`
const path = (d, color = C.muted, width = 1.5) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`

function glyph(x, y, kind, color, size = 12) {
  const d = kind === 'question'
    ? 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01'
    : 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'
  return `<g transform="translate(${x} ${y}) scale(${size / 24})">${path(d, color, 2)}</g>`
}

function badge(x, y, kind, color) {
  return `<circle cx="${x}" cy="${y}" r="9" fill="${C.paper}" stroke="${C.line}"/>`
    + glyph(x - 5.5, y - 5.5, kind, color, 11)
}

function icon(x, y, name, size = 16, color = C.muted) {
  const shapes = {
    plus: 'M12 5v14 M5 12h14',
    shield: 'M12 3l8 4v5c0 5-8 9-8 9s-8-4-8-9V7z M8 12l3 3 5-6',
  }
  return `<g transform="translate(${x} ${y}) scale(${size / 24})">${path(shapes[name], color, 1.6)}</g>`
}

function shell() {
  return rect(16, 20, WIDTH - 32, 578, '#090b0f', 17)
    + `<g clip-path="url(#window)">`
    + rect(16, 16, WIDTH - 32, 576, C.main)
    + path(`M16 53H${WIDTH - 16}`, '#252528')
    + text(34, 39, 'Cache strategy review', 12, '#cfd3d6')
    + '</g>'
    + rect(16, 16, WIDTH - 32, 576, 'none', 16, '#474b54')
}

function toolbar(y, active) {
  let svg = rect(256, y + 3, 406, 38, '#0b0b0d', 19)
    + rect(256, y, 406, 38, C.paper, 19, '#48484f')
  const buttons = [
    ['Agree', 264, 61, C.green], ['Disagree', 325, 83, C.red],
    ['Question', 408, 83, C.amber], ['Comment', 491, 88, C.blue],
    ['Quote', 589, 64, C.blue],
  ]
  for (const [label, x, width, color] of buttons) {
    if (label === active) svg += rect(x, y + 5, width, 28, C.soft, 14)
    svg += text(x + 10, y + 24, label, 14, label === active ? color : C.ink)
  }
  return svg + path(`M584 ${y + 11}v16`, '#48484f')
}

function editor(t) {
  const typed = note.slice(0, Math.floor(note.length * progress(t, 7.9, 9.5)))
  return rect(556, 218, 352, 176, '#0b0b0d', 12)
    + rect(554, 214, 352, 176, C.paper, 12, '#48484f')
    + rect(570, 229, 2, 24, '#696b74')
    + text(581, 246, passage, 13, C.muted)
    + rect(570, 264, 320, 66, C.main, 8, C.blue)
    + text(581, 289, typed, 14)
    + (t < 9.8 ? text(581 + typed.length * 6.75, 289, '|', 14, C.blue) : '')
    + text(570, 361, `${3000 - typed.length} characters left`, 11, C.muted)
    + rect(756, 343, 62, 30, C.paper, 15, '#54545c')
    + text(766, 363, 'Cancel', 12)
    + rect(827, 343, 63, 30, t >= 10 ? '#30405d' : C.paper, 15, C.blue)
    + text(844, 363, 'Save', 12, C.blue)
}

function dock(count) {
  let svg = rect(256, 398, 652, 106, C.paper, 10, C.line)
    + text(270, 420, 'Review notes', 13, C.ink, 600)
    + rect(360, 406, 22, 20, '#39393e', 10)
    + text(367, 420, count, 12, C.muted)
    + text(394, 420, 'Attached to your next message', 12, C.muted)
    + text(821, 420, 'Clear all', 12, C.blue)
    + path('M885 419l4-4 4 4')
    + path('M270 431H894', C.line)
    + rect(270, 438, 68, 20, C.paper, 10, C.amber)
    + text(279, 452, 'Question', 11, C.amber)
    + text(350, 453, question, 13, C.muted)
    + path('M879 452l8-8 M879 444h8v8')
  if (count === 2) {
    svg += rect(270, 472, 68, 20, C.paper, 10, C.blue)
      + text(277, 486, 'Comment', 11, C.blue)
      + text(350, 475, passage, 12, C.muted)
      + text(350, 493, note, 13)
      + path('M879 485l8-8 M879 477h8v8')
  }
  return svg
}

// Cursor movement and selection share the same timeline, so the pointer always
// leads the selected text and reaches a control before the state changes.
const cursorStops = [
  [0, 815, 337], [1.1, 815, 337], [1.3, 256, 223], [2.3, 535, 223],
  [2.55, 535, 223], [3.05, 450, 196], [3.5, 450, 196],
  [3.85, 815, 361], [5, 815, 361], [5.9, 256, 307], [6.8, 506, 307],
  [7, 506, 307], [7.4, 534, 280], [7.6, 534, 280],
  [7.9, 858, 358], [10.6, 858, 358], [11, 840, 370], [12.2, 840, 370],
  [12.4, 400, 532], [14.15, 400, 532], [14.6, 879, 557],
  [14.8, 879, 557], [15.3, 924, 586], [18, 924, 586],
]

function cursor(t) {
  let i = 1
  while (i < cursorStops.length - 1 && t > cursorStops[i][0]) i++
  const [a, x1, y1] = cursorStops[i - 1]
  const [b, x2, y2] = cursorStops[i]
  let p = progress(t, a, b)
  // Linear dragging keeps the cursor at the selection's edge.
  if (a !== 1.3 && a !== 5.9) p = p * p * (3 - 2 * p)
  const x = (x1 + (x2 - x1) * p).toFixed(1)
  const y = (y1 + (y2 - y1) * p).toFixed(1)
  let svg = ''
  for (const when of [3.42, 7.52, 10.5, 14.7]) {
    if (t >= when && t < when + 0.34) {
      const r = 7 + progress(t, when, when + 0.34) * 10
      svg += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${C.blue}" opacity="${1 - progress(t, when, when + 0.34)}"/>`
    }
  }
  return svg + `<path transform="translate(${x} ${y})" d="M0 0v20l5-5 4 9 4-2-4-8 7-1Z" fill="#f9fafb" stroke="#141416" stroke-width="1.5" stroke-linejoin="round"/>`
}

function frame(t) {
  const sent = t >= 14.8
  const cleared = t >= 16.3
  const hasQuestion = t >= 3.5 && !cleared
  const hasComment = t >= 10.6 && !cleared
  const count = Number(hasQuestion) + Number(hasComment)
  const shift = -70 * progress(t, 14.8, 15.1)
  const step = t < 3.5 ? 0 : t < 10.6 ? 1 : t < 14.8 ? 2 : 3
  const captions = [
    'Select a passage. Ask a question.',
    'Add a specific comment.',
    'Review your notes. Send one message.',
    'Feedback attached. Your message stays clean.',
  ]
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="Arial, Liberation Sans, sans-serif">
    <defs>
      <clipPath id="reply"><rect x="240" y="62" width="684" height="322"/></clipPath>
      <clipPath id="window"><rect x="16" y="16" width="${WIDTH - 32}" height="576" rx="16"/></clipPath>
      <linearGradient id="backdrop" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#263c54"/><stop offset="0.5" stop-color="#172331"/><stop offset="1" stop-color="#0d1117"/>
      </linearGradient>
    </defs>`
  svg += rect(0, 0, WIDTH, HEIGHT, 'url(#backdrop)') + shell()
    + `<g transform="translate(-${CONTENT_OFFSET} 0)">`

  let reply = rect(596, 73, 312, 32, C.soft, 16)
    + text(612, 94, 'Review this cache and retry strategy.', 14)
    + text(256, 137, 'Thought for a while', 12, C.muted)
    + path('M370 129l4 4-4 4', C.muted, 1.2)
    + text(256, 169, "Here's a lightweight cache and retry strategy:", 17)
    + text(256, 203, '1. Cache policy', 14, C.ink, 600)
    + text(256, 253, 'Keep a short TTL as a safety net.', 15, C.muted)
    + text(256, 286, '2. Error handling', 14, C.ink, 600)
    + text(256, 337, 'Stop after three attempts.', 15, C.muted)

  if (t >= 1.3 && t < 3.5) {
    reply += rect(255, 212, 280 * progress(t, 1.3, 2.3), 22, C.selection, 2)
  }
  if (hasQuestion) reply += rect(255, 212, 280, 22, C.yellow, 2)
    + path('M256 235H535', C.amber)
    + badge(541, 212, 'question', C.amber)
  if (t >= 5.9 && t < 10.6) {
    reply += rect(255, 296, 251 * progress(t, 5.9, 6.8), 22, C.selection, 2)
  }
  if (hasComment) reply += rect(255, 296, 251, 22, C.yellow, 2)
    + path('M256 319H506', C.blue)
    + badge(512, 296, 'comment', C.blue)
  reply += text(256, 228, question, 17) + text(256, 312, passage, 17)
  svg += `<g clip-path="url(#reply)"><g transform="translate(0 ${shift})">${reply}</g></g>`

  if (sent) svg += rect(566, 352, 342, 32, C.soft, 16)
    + text(582, 373, message, 16)
  if (count > 0) svg += dock(count)
  svg += rect(256, 512, 652, 64, C.soft, 16, t >= 12.4 && !sent ? '#657fa7' : '#333337')
  const typedMessage = message.slice(0, Math.floor(message.length * progress(t, 12.5, 14.05)))
  svg += text(270, 536, sent || t < 12.4
    ? 'Describe what you want to build, / commands, @ files or sessions' : typedMessage,
    sent || t < 12.4 ? 12 : 14, sent || t < 12.4 ? '#85858c' : C.ink)
  svg += `<circle cx="276" cy="558" r="10" fill="#353638"/>`
    + icon(269, 551, 'plus', 14, '#cfd3d6')
    + icon(300, 550, 'shield', 14, '#cfd3d6')
    + text(319, 561, 'Workspace Write', 11, '#cfd3d6')
    + path('M414 555l3 3 3-3', '#a3a3aa', 1.1)
    + text(729, 561, 'Demo Model', 11, '#cfd3d6')
    + text(801, 561, 'High', 11, '#85858c')
    + path('M834 555l3 3 3-3', '#a3a3aa', 1.1)
    + `<circle cx="879" cy="557" r="14" fill="${t >= 12.5 && !sent ? '#7aaaff' : '#3b5177'}"/>`
    + path('M879 563v-12 M874 556l5-5 5 5', t >= 12.5 && !sent ? '#151517' : '#8c9ab1', 1.8)
  if (t >= 2.3 && t < 3.5) svg += toolbar(173, t >= 2.9 ? 'Question' : '')
  if (t >= 6.8 && t < 7.6) svg += toolbar(257, t >= 7.2 ? 'Comment' : '')
  if (t >= 7.6 && t < 10.6) svg += editor(t)
  svg += '</g>'

  svg += text(20, 621, String(step + 1).padStart(2, '0'), 13, C.blue, 600)
    + text(50, 621, captions[step], 14, '#e0e5ed')
    + text(648, 621, 'Illustrative demo', 11, C.muted)
  for (let i = 0; i < 4; i++) svg += rect(494 + i * 34, 612, 24, 4, i <= step ? C.blue : '#3d4755', 2)
  return svg + `<g transform="translate(-${CONTENT_OFFSET} 0)">${cursor(t)}</g></svg>`
}

async function main() {
  for (const [command, flag] of [['magick', '-version'], ['ffmpeg', '-version'], ['rsvg-convert', '--version']]) {
    try { await run(command, [flag]) } catch {
      throw new Error(`Install ${command} and make sure it is available on PATH.`)
    }
  }
  const temp = await mkdtemp(join(tmpdir(), 'comment-it-preview-'))
  try {
    const rendered = new Map()
    for (let i = 0; i < FPS * SECONDS; i++) {
      const svg = frame(i / FPS)
      const png = join(temp, `frame-${String(i).padStart(4, '0')}.png`)
      if (rendered.has(svg)) await copyFile(rendered.get(svg), png)
      else {
        const source = join(temp, 'frame.svg')
        const raster = join(temp, 'raster.png')
        await writeFile(source, svg)
        // Use librsvg explicitly: ImageMagick's internal SVG renderer varies by
        // installation and can omit strokes or ignore the reply's clipping path.
        await run('rsvg-convert', ['-o', raster, source])
        await run('magick', [raster, '-strip', '-depth', '8', png])
        rendered.set(svg, png)
      }
      if ((i + 1) % 36 === 0) console.log(`Rendered ${i + 1}/${FPS * SECONDS} frames`)
    }
    const gif = join(temp, 'preview.gif')
    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS),
      '-i', join(temp, 'frame-%04d.png'), '-filter_complex',
      '[0:v]split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle',
      '-loop', '0', '-y', gif,
    ])
    await mkdir(dirname(output), { recursive: true })
    await copyFile(gif, output)
    const { size } = await stat(output)
    console.log(`Created ${output} (${WIDTH}x${HEIGHT}, ${SECONDS}s, ${(size / 1024 / 1024).toFixed(2)} MiB)`)
    if (size > 3 * 1024 * 1024) console.warn('Preview exceeds the 3 MiB target; review palette and frame rate.')
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
