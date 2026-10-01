import sources from '../../../sources.json'
import manifest from '../../../english-articles/library-manifest.json'

const base = `${import.meta.env.BASE_URL}tutorials/`
export const HANDBOOK_URL = `${base}Industrial-Controls-Tutorial.html`
export const STUDY_PACK_URL = `${base}Industrial-Controls-Expanded-English-Pack.zip`
export const READING_EDITION_URL = `${base}english-articles/all-articles.html`

const topics = ['Foundations', 'Protocols & data', 'Architecture & operations', 'Architecture & operations', 'Foundations', 'Foundations', 'Foundations', 'Architecture & operations', 'Architecture & operations', 'Protocols & data', 'Protocols & data', 'Protocols & data']
const descriptions = [
  'Place your C# application in the plant, separate commands from feedback, and design your first observation contract.',
  'Compare register access, information models and messaging. Choose a protocol around the problem you need to solve.',
  'Preserve timestamps and quality, choose a storage model, and build workflows that recover after an outage.',
  'Present measurements, alarms and stale data honestly so operators can distinguish a request from a result.',
  'Understand deadlines, jitter and uncertainty before deciding which responsibilities belong in a PLC or an application.',
  'Follow physical inputs through the PLC scan and see why polling can miss an event or read an inconsistent snapshot.',
  'Treat hardware, firmware, addresses and data types as a versioned contract you can test.',
  'Connect supervision, production execution and business planning while keeping each responsibility clear.',
  'Assemble adapters, services, storage, interfaces and bounded agent tools into one complete system.',
  'Decode multi-register values from wire bytes and verify word order with known test vectors.',
  'Interpret coils, status words, signed values and bit numbering without confusing memory with meaning.',
  'Reassemble complete messages from a TCP stream using lengths, timeouts and cancellation instead of sleeps.',
]

export const TUTORIALS = manifest.articles.map((article, index) => ({
  ...article,
  n: String(index + 1).padStart(2, '0'),
  topic: topics[index],
  description: descriptions[index],
  href: `${base}english-articles/${article.filename}`,
}))

const readingsByLab: Record<string, string[]> = {
  'scan-cycle': ['S5', 'S6'], 'byte-order': ['S10'], 'packed-bits': ['S11'],
  'tcp-framing': ['S12'], 'tank-3d': ['S1', 'S7'], 'alarms': ['S4', 'S8'],
  'architecture': ['S3', 'S8', 'S9'], 'protocol-picker': ['S2'],
  'ladder-logic': ['S6', 'S7'], 'timers-counters': ['S5', 'S6'],
  'analog-scaling': ['S7', 'S10'], 'sequencing': ['S3', 'S6'], 'troubleshooting': ['S7', 'S9'],
}
export const tutorialsForLab = (id: string) => TUTORIALS.filter(article => readingsByLab[id]?.includes(article.id))

// Source articles and primary references, credited on the tutorials page.

export const SOURCE_ARTICLES = sources.articles.map(source => ({
  id: source.source_id,
  url: source.url,
  title: source.title,
  date: source.date.slice(0, 10),
  edition: TUTORIALS.find(t => t.id === source.source_id),
}))
export const PRIMARY_REFERENCES = sources.primary_references
export const SOURCES_CHECKED_ON = sources.checked_on
