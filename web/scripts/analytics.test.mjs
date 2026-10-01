import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const source = readFileSync(new URL('../public/analytics.js', import.meta.url), 'utf8')
function setup({ choice, hostname = 'ic.agentqi.dev', reader = false, privacy = false } = {}) {
  const handlers = {}, head = [], body = []
  const element = tag => ({ tag, hidden: false, listeners: {}, setAttribute() {}, focus() {},
    addEventListener(k, f) { this.listeners[k] = f },
    querySelectorAll() { return this.buttons ??= [element('button'), element('button')] },
    querySelector() { return this.querySelectorAll()[0] },
  })
  const window = { addEventListener: (k, f) => { handlers[k] = f } }
  const document = { readyState: 'loading', title: 'PLC handbook', referrer: 'https://example.com/?private=yes', cookie: '',
    head: { append: e => head.push(e) }, body: { append: (...e) => body.push(...e) },
    createElement: element, getElementById: () => reader ? null : {},
    addEventListener: (k, f) => { handlers[k] = f },
  }
  const location = { hostname, origin: 'https://' + hostname, pathname: '/tutorials/handbook.html' }
  const localStorage = { getItem: () => choice, setItem: (_k, v) => { choice = v } }
  runInNewContext(source, { window, document, location, localStorage, navigator: { globalPrivacyControl: privacy }, URL, Date })
  const page = path => handlers['course:pageview']?.({ detail: { path, title: path, group: 'Labs' } })
  const events = () => (window.dataLayer || []).filter(x => x[0] === 'event' && x[1] === 'page_view')
  return { ready: () => handlers.DOMContentLoaded?.(), page, events, head, body, window,
    choose: n => body[0].querySelectorAll()[n].listeners.click(), }
}
test('no Google script or events before consent; allowing sends the current page once', () => {
  const s = setup(); s.page('/labs/scan-cycle'); s.ready()
  assert.equal(s.head.filter(x => x.tag === 'script').length, 0)
  assert.equal(s.events().length, 0)
  s.choose(0)
  assert.equal(s.head.filter(x => x.tag === 'script').length, 1)
  assert.equal(s.events().length, 1)
  assert.equal(s.events()[0][2].page_referrer, 'https://example.com')
  s.page('/labs/scan-cycle'); assert.equal(s.events().length, 1)
  s.page('/tutorials'); assert.equal(s.events().length, 2)
  assert.equal(s.events()[1][2].page_referrer, 'https://ic.agentqi.dev/#/labs/scan-cycle')
})
test('denial and withdrawal suppress tracking', () => {
  const s = setup(); s.ready(); s.choose(1); s.page('/labs'); assert.equal(s.events().length, 0)
  s.choose(0); assert.equal(s.events().length, 1)
  s.choose(1); s.page('/tutorials'); assert.equal(s.events().length, 1)
  assert.equal(s.window['ga-disable-G-GLF0GGX9RJ'], true)
})
test('reader page is recorded without fragment or query data', () => {
  const s = setup({ choice: 'granted', reader: true }); s.ready()
  assert.equal(s.events().length, 1)
  assert.equal(s.events()[0][2].page_location, 'https://ic.agentqi.dev/tutorials/handbook.html')
})
test('localhost and browser privacy preferences never load Google', () => {
  for (const options of [{ hostname: 'localhost', choice: 'granted' }, { privacy: true, choice: 'granted' }]) {
    const s = setup(options); s.ready(); s.page('/labs')
    assert.equal(s.head.filter(x => x.tag === 'script').length, 0)
    assert.equal(s.events().length, 0)
  }
})
test('query text and invalid routes are rejected', () => {
  const s = setup({ choice: 'granted' }); s.ready(); s.page('/labs?email=private'); s.page('/unrecognized')
  assert.equal(s.events().length, 0)
})
