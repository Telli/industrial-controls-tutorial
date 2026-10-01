import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const manifest = JSON.parse(await readFile(new URL('../../english-articles/library-manifest.json', import.meta.url), 'utf8'))
const required = ['Industrial-Controls-Tutorial.html', 'Industrial-Controls-Expanded-English-Pack.zip', 'START-HERE.txt', 'VERIFICATION.txt', 'english-articles/index.html', 'english-articles/all-articles.html', 'english-articles/all-articles.txt', ...manifest.articles.flatMap(a => [`english-articles/${a.filename}`, `english-articles/${a.text_filename}`])]
for (const file of required) assert((await stat(join(dist, 'tutorials', file))).size > 0, `Missing tutorial asset: ${file}`)

const htmlFiles = ['Industrial-Controls-Tutorial.html', ...(await readdir(join(dist, 'tutorials/english-articles'))).filter(f => f.endsWith('.html')).map(f => `english-articles/${f}`)]
let checked = 0
const cache = new Map()
for (const file of htmlFiles) {
  const html = await readFile(join(dist, 'tutorials', file), 'utf8')
  assert(html.includes('aria-label="Course navigation"'), `Missing site navigation in ${file}`)
  for (const [, href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(?:[a-z]+:|\/\/)/i.test(href)) continue
    const url = new URL(href.replaceAll('&amp;', '&'), `https://course.invalid/tutorials/${file}`)
    const path = join(dist, decodeURIComponent(url.pathname))
    assert((await stat(path)).isFile(), `Broken local link in ${file}: ${href}`)
    if (url.hash && !url.hash.startsWith('#/') && url.pathname.endsWith('.html')) {
      if (!cache.has(path)) cache.set(path, await readFile(path, 'utf8'))
      const id = decodeURIComponent(url.hash.slice(1))
      assert(cache.get(path).includes(`id="${id}"`), `Broken section link in ${file}: ${href}`)
    }
    checked++
  }
}
console.log(`Tutorial publication verified: ${manifest.articles.length} articles, handbook, study ZIP, and ${checked} local links/anchors.`)
