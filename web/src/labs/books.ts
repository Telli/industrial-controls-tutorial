// Books cited by the labs. The labs use original models and exercises; only Kuphaldt's text is
// openly licensed for adaptation. Free-to-read books link to the authors' own copies.

export interface Book {
  cite: string
  title: string
  detail: string
  url?: string
  license?: string
}

export const BOOKS = {
  petruzella: { cite: 'Petruzella', title: 'Programmable Logic Controllers', detail: 'Frank D. Petruzella, 6th edition, McGraw Hill, 2023 (ISBN 978-1-265-15049-5)' },
  kuphaldt: { cite: 'Kuphaldt', title: 'Lessons in Industrial Instrumentation', detail: 'Tony R. Kuphaldt, version 2.33, 2024', url: 'https://www.ibiblio.org/kuphaldt/socratic/sinst/book/liii.pdf', license: 'CC BY 4.0' },
  astromMurray: { cite: 'Åström & Murray', title: 'Feedback Systems: An Introduction for Scientists and Engineers', detail: 'Karl J. Åström and Richard M. Murray, 2nd edition, Princeton University Press, 2021', url: 'https://fbswiki.org/wiki/index.php/Feedback_Systems:_An_Introduction_for_Scientists_and_Engineers', license: 'Free to read online' },
  astromHagglund: { cite: 'Åström & Hägglund', title: 'Advanced PID Control', detail: 'Karl J. Åström and Tore Hägglund, ISA, 2006' },
  erickson: { cite: 'Erickson', title: 'Programmable Logic Controllers: An Emphasis on Design and Application', detail: 'Kelvin T. Erickson, 3rd edition, Dogwood Valley Press, 2016' },
  alarmHandbook: { cite: 'Hollifield & Habibi', title: 'The Alarm Management Handbook', detail: 'Bill Hollifield and Eddie Habibi, 2nd edition, PAS, 2010' },
  hmiHandbook: { cite: 'Hollifield et al.', title: 'The High Performance HMI Handbook', detail: 'Bill Hollifield, Dana Oliver, Ian Nimmo and Eddie Habibi, PAS, 2008' },
  gruhn: { cite: 'Gruhn & Cheddie', title: 'Safety Instrumented Systems: Design, Analysis, and Justification', detail: 'Paul Gruhn and Harry Cheddie, 2nd edition, ISA, 2006; succeeded by Gruhn and Lucchini, Safety Instrumented Systems: A Life-Cycle Approach, ISA, 2018' },
  eip: { cite: 'Hohpe & Woolf', title: 'Enterprise Integration Patterns', detail: 'Gregor Hohpe and Bobby Woolf, Addison-Wesley, 2003' },
  kleppmann: { cite: 'Kleppmann', title: 'Designing Data-Intensive Applications', detail: 'Martin Kleppmann, O’Reilly, 2017' },
  cleary: { cite: 'Cleary', title: 'Concurrency in C# Cookbook', detail: 'Stephen Cleary, 2nd edition, O’Reilly, 2019' },
  mahnke: { cite: 'Mahnke, Leitner & Damm', title: 'OPC Unified Architecture', detail: 'Wolfgang Mahnke, Stefan-Helmut Leitner and Matthias Damm, Springer, 2009' },
} satisfies Record<string, Book>

export type BookId = keyof typeof BOOKS
