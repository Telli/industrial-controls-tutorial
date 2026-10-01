import { mkdir, readFile, readdir, copyFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const web = fileURLToPath(new URL('../', import.meta.url))
const repository = dirname(web.replace(/[\\/]$/, ''))
const destination = join(web, 'public/tutorials')
const readerCss = await readFile(new URL('./tutorial-reader.css', import.meta.url), 'utf8')
const readerScript = await readFile(new URL('./tutorial-reader.js', import.meta.url), 'utf8')

// Publish only the authored course files. Source code is available in the curated
// study ZIP; the repository, credentials, build outputs and textbook stay local.
const readingFiles = ['Industrial-Controls-Tutorial.html', 'START-HERE.txt', 'VERIFICATION.txt', 'sources.json', 'Industrial-Controls-Expanded-English-Pack.zip']
for (const name of await readdir(join(repository, 'english-articles'))) {
  if (/\.(html|txt|json)$/.test(name)) readingFiles.push(`english-articles/${name}`)
}

for (const name of readingFiles) {
  const target = join(destination, name)
  await mkdir(dirname(target), { recursive: true })
  if (!name.endsWith('.html')) {
    await copyFile(join(repository, name), target)
    continue
  }
  const prefix = name.startsWith('english-articles/') ? '../../' : '../'
  const toolbar = `<nav class="course-site-bar" aria-label="Course navigation"><a href="${prefix}index.html#/">Industrial Controls</a><a href="${prefix}index.html#/tutorials">← All tutorials</a><a href="${prefix}index.html#/labs">Interactive labs</a><button type="button" id="course-theme-toggle">Dark theme</button></nav>`
  const original = await readFile(join(repository, name), 'utf8')
  const themed = original
    .replace('</head>', `<style>${readerCss}</style><script>${readerScript}</script><script src="${prefix}analytics.js"></script></head>`)
    .replace('<body>', `<body>${toolbar}`)
  await writeFile(target, themed)
}
console.log(`Prepared ${readingFiles.length} tutorial files, including the handbook, article library and offline study pack.`)
