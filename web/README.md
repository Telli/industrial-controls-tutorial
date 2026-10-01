# Industrial Controls Lab (web)

A separate React site that turns the course material in this repository into interactive visualizations.

```bash
cd web
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in web/dist (relative base, hash routing: host anywhere)
npm test         # unit tests for the simulation libraries
```

Production hosting and DNS instructions are in [DEPLOYMENT.md](DEPLOYMENT.md).

## Tutorials and handbook

`/#/tutorials` contains the 12 English study articles, the complete 17-chapter
handbook, the 14-exercise C# workbook, combined reading editions and the downloadable
study pack. The main navigation, landing page, lab catalog and individual labs
link to these readings. The standalone readers share the site's navy theme and
provide navigation back to tutorials and interactive labs.

`predev` and `prebuild` run `scripts/sync-tutorials.mjs`, which copies the authored
files from the repository root and `english-articles/` into the generated
`public/tutorials/` directory. Edit those original course files, not generated
copies. The published readers retain chapter anchors, model answers, calculators
and print behavior. The curated study ZIP includes the runnable C# source; no
textbook PDF is published.

After every production build, `scripts/check-tutorials.mjs` verifies required
reading assets and local links/anchors in the generated site. A missing handbook,
article, download or linked section fails the build.

## Stack

| Need | Library |
| --- | --- |
| UI, routing | React 19, React Router (hash routes, so static hosting works) |
| 3D scenes | three.js via `@react-three/fiber` and `@react-three/drei` |
| Node/edge diagrams | `@xyflow/react` (React Flow) |
| Timelines and charts | Hand-written SVG (keeps the bundle small and the visuals exact) |

Heavy libraries are code-split: three.js loads for the landing explorer, tank, motor and sequence scenes; React Flow only for the architecture lab. The lesson models run independently of the 3D renderer.

## Labs

| Lab | Visual | Companion implementation / reading |
| --- | --- | --- |
| 01 Scan cycle and polling | SVG timeline | `ScanSimulator.cs` |
| 02 Byte order decoder | Byte tiles | `Wire.cs` |
| 03 Booleans and packed bits | Bit register | `Wire.cs` |
| 04 Modbus TCP framing | Annotated frame | `Wire.cs` |
| 05 Tank and control loop | three.js 3D | `Machine.cs` |
| 06 Alarm lifecycle | Live chart and state machine | `Alarms.cs` |
| 07 Plant architecture and outage | React Flow | `Outbox.cs` |
| 08 Protocol picker | Scored bars | article 02 |
| 09 Ladder logic and motor control | Scan stepper + 3D motor | `src/lib/plc.ts` |
| 10 Timers, counters and memory | Timer flags + timing traces | `src/lib/plc.ts` |
| 11 Analog signals and scaling | Measurement chain + current gauge | `src/lib/plc.ts` |
| 12 Sequences and product tracking | 3D batch + conveyor/shift register | `src/lib/plc.ts` |
| 13 Find the fault | Evidence notebook + diagnostic cases | `src/lib/troubleshoot.ts` |
| 14 Safety instrumented systems | Overfill layers, trip circuits, voting/PFD chart | `src/lib/safety.ts` |
| 15 Operator display design | Legacy vs high-performance HMI, timed rounds | `src/lib/hmi.ts` |

The simulation logic lives in `src/lib` (`scan.ts`, `wire.ts`, `alarm.ts`, `plc.ts`, `tank.ts`, `troubleshoot.ts`, `safety.ts`, `hmi.ts`) and is unit-tested. These are teaching models, not certified control software.

## Adding a lab

1. Create `src/labs/MyLab.tsx` with a default-exported component.
2. Add an entry to `src/labs/registry.tsx` (title, goal, things to try, real-world note). The landing page, index and navigation pick it up automatically.
3. Add the lab's explanatory text to `src/labs/content.ts`: a plain-language intro, background paragraphs, key terms and a check question. The lab page renders these below the experiment.

## Citations

Each lab can cite books and free primary sources in `src/labs/registry.tsx`:

- `books: [{ id, where }]` uses ids from `src/labs/books.ts`. Give the section, chapter or printed page range in `where`; never invent page numbers for a book you haven't checked.
- `primary: [{ id, where }]` uses `primary_references` ids from the repository's `sources.json` (the numbering matches Appendix B of the handbook; P30–P36 cover the Modbus TCP guide, NIST SP 800-82r3, Sparkplug 3.0, NUREG-0700 Rev. 4, HSE HSG238, Buncefield and the CSB Texas City investigation). Add a new reference to both places with the next free number.

The lab page renders both lists, and the Tutorials page lists every book and reference.

## Credits

The written course is adapted from Wackysoft's .NET industrial-controls series. Each reading credits its source in its References section rather than at the top, the handbook lists all sources in Appendix F, and the site lists them on the Tutorials page (`#references`). `sources.json` at the repository root is the single source for those links.

## Themes and scene controls

The site opens in the light navy theme. The header toggle switches between light and dark navy palettes and remembers the choice locally. Charts, byte diagrams, the architecture map and all 3D scenes follow the selected theme.

The landing-page system explorer has five selectable layers, drag-to-orbit controls, a data-flow pause button and a view reset. It uses instanced packets, a capped pixel ratio and demand rendering when paused, outside the viewport or in a hidden tab. Reduced-motion preferences pause its animation by default.

The tank lab runs its teaching model independently of WebGL. Pause/resume controls stop the model, while Reset view resets only the camera. If WebGL is unavailable or its context is lost, the controls, readings and chart remain usable. All scenes clean up their context-loss listeners when unmounted.

The lab catalog supports topic filters and title/description search, including a resettable empty state.

## PLC foundations and book references

The five new lessons and expanded tank lab use original models, diagrams and exercises informed by Frank D. Petruzella, *Programmable Logic Controllers*, sixth edition, McGraw Hill, 2023 (ISBN 978-1-265-15049-5). The supplied complete edition was inspected; printed page references appear in each lesson's Book connection panel. No textbook pages or images are distributed with the site.

- Motor control: sections 5.2, 5.8 and 6.8–6.9, pp. 70–71, 81–82, 105–106. Input read, logic execution and output write are separate phases; input snapshots persist between phases. A normally closed stop device produces a true healthy bit, examined with XIC. The holding branch can use actual contactor feedback or the command to compare failure behavior. This model represents ordinary control, not a safety circuit.
- Timing: sections 7.2–7.5 and 8.2, pp. 122–134, 146–153. TON resets on a false rung, TOF delays falling output, RTO retains accumulated time and CTU counts rising edges. Time is in seconds with a 100 ms teaching scan; no vendor-specific power-cycle behavior is implied.
- Analog signals: sections 2.3 and 11.6, pp. 22–25, 227–228; p. 295. A stated 0–24 mA ADC model preserves observation of under/over-range current. Expected signal range is 4–20 mA. Quality gates the engineering result; an independently wrong configured range can still produce a valid-looking wrong number.
- Control: sections 14.3–14.4, pp. 294–298. The tank implements a heat balance with 12 kW maximum heater power, 12 kJ/°C heat capacity, 0.2 kW/°C heat loss and 25 °C ambient. On/off has a selectable deadband; P exposes steady-state offset; PI adds conditional-integration anti-windup. Changing modes clears the integrator and is explicitly not bumpless transfer. A heater trip removes applied power; a supervisory communications fault does not stop local control.
- Sequencing: sections 12.2–12.4, pp. 239–255. A batch requires high-level evidence to enter Mix and times out on blocked filling. Output states are mutually exclusive. Reset empties the virtual vessel. The conveyor shifts reject bits with position pulses and demonstrates drift when a pulse is missed.
- Diagnostics: section 13.9, pp. 275–279. Four one-fault cases require a supporting pair of observations before accepting a diagnosis. Measurements are simulated.

New lessons use a predict/run/inspect/explain prompt; the catalog provides a recommended learning path. Counts are derived from the registry. Simulations pause in hidden tabs, and machine animations honor reduced motion and stop rendering offscreen. Machine view resets do not reset the underlying experiment.

`npm test` covers physical feedback, scan order, timer retention, event counting, quantization, invalid ranges, closed-loop equilibrium, heater trips, anti-windup, link loss, sequence interlocks, tracking drift and diagnostic evidence requirements.
