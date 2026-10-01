import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { BookId } from './books'

/** A citation with a pointer to the relevant part: section, chapter or page range. */
export interface Citation<Id extends string = string> { id: Id; where: string }

export interface LabMeta {
  id: string
  n: string
  title: string
  blurb: string
  goal: string
  tags: ('SVG' | 'three.js' | 'React Flow' | 'Canvas')[]
  tryThis: string[]
  real: string
  companion: string
  /** Books, by id from books.ts. */
  books?: Citation<BookId>[]
  /** Free primary sources, by id from sources.json primary_references. */
  primary?: Citation[]
  Component: LazyExoticComponent<ComponentType>
}

export const LABS: LabMeta[] = [
  {
    id: 'scan-cycle',
    n: '01',
    title: 'Scan cycle and polling',
    blurb: 'Watch a field pulse travel through a PLC scan and an external poller, and see exactly where events disappear.',
    goal: 'Understand why a value you read over Modbus is a snapshot of a snapshot, and why counters beat live bits for events.',
    tags: ['SVG'],
    tryThis: [
      'Set the pulse shorter than the <b>scan time</b>: the PLC never sees some pulses at all.',
      'Raise the <b>poll period</b> above the pulse gap: the live bit is missed, but the counter still catches up.',
      'Slide the <b>poll phase</b> to see latency change without changing the averages much.',
    ],
    real: 'Part counting, reject gates and fast digital inputs. Anything an operator would call an "event" should be a counter or a latched bit, never a level you hope to catch.',
    companion: 'Article 05–06 · labs/IndustrialLab/ScanSimulator.cs',
    primary: [{ id: 'P2', where: 'Sampling and publishing intervals are separate schedules, and the server may revise them.' }],
    Component: lazy(() => import('./ScanCycleLab')),
  },
  {
    id: 'byte-order',
    n: '02',
    title: 'Byte order decoder',
    blurb: 'Two 16-bit registers become one 32-bit number. Four layouts, four answers. Find the right one.',
    goal: 'Learn to reason from wire bytes and the device manual instead of trial and error.',
    tags: ['SVG'],
    tryThis: [
      'Load the <b>25.5 °C, word-swapped</b> example and flip through layouts until the float looks sane.',
      'Switch to the <b>uint32</b> view: the same bytes, a very different number.',
      'Edit registers by hand; the byte tiles show where every byte lands.',
    ],
    real: 'Every gateway and meter integration. Energy meters, flow computers and drives disagree on word order, and a wrong guess still produces a plausible-looking number.',
    companion: 'Article 10 · labs/IndustrialLab/Wire.cs',
    primary: [{ id: 'P25', where: '§4.2 Data Encoding: big-endian within a register. The data model (§4.3) defines 16-bit registers and leaves multi-register values to the device.' }],
    Component: lazy(() => import('./ByteOrderLab')),
  },
  {
    id: 'packed-bits',
    n: '03',
    title: 'Booleans and packed bits',
    blurb: 'Status words pack a dozen flags into one register. Toggle bits and watch the register value change.',
    goal: 'Read and write flags in registers safely, including why a read-modify-write can clobber a neighbor.',
    tags: ['SVG'],
    tryThis: [
      'Click bits to build a status word, then compare hex, decimal and the signed <b>int16</b> reading.',
      'Set bit 15 and notice the register turns negative if you assume signed.',
      'Simulate a <b>stale read-modify-write</b> and see a PLC-side change get overwritten.',
    ],
    real: 'Drive status words, alarm bitfields and device fault registers. Half the bugs are off-by-one bit numbering or sign assumptions.',
    companion: 'Article 11 · labs/IndustrialLab/Wire.cs (Bit)',
    primary: [{ id: 'P25', where: '§6.5 Write Single Coil (05), §6.11 Write Multiple Coils (15) and §6.16 Mask Write Register (22).' }],
    Component: lazy(() => import('./PackedBitsLab')),
  },
  {
    id: 'tcp-framing',
    n: '04',
    title: 'Modbus TCP framing',
    blurb: 'Build a real request frame byte by byte, then see TCP chop a reply into pieces and reassemble it.',
    goal: 'Replace "sleep then read" with length-based framing that survives fragmented and coalesced packets.',
    tags: ['SVG'],
    tryThis: [
      'Change <b>start offset</b> and <b>quantity</b>; each header field highlights and explains itself.',
      'Drop the <b>chunk size</b> to 1 byte: the reassembler still produces one correct frame.',
      'Glue two replies into one chunk to see why <code>Read()</code> returning is not a message boundary.',
    ],
    real: 'Any custom driver or simulator. Sleep-based reads work on the bench and fail on a busy plant network.',
    companion: 'Article 12 · labs/IndustrialLab/Wire.cs (ReadFc03Async)',
    books: [{ id: 'cleary', where: 'Its recipes on cancellation and timeouts apply directly to a read loop that must stop waiting for a missing frame.' }],
    primary: [{ id: 'P30', where: '§3.1.3 MBAP header: transaction identifier, protocol identifier, length and unit identifier.' }, { id: 'P25', where: '§6.3 Read Holding Registers (1 to 125 registers) and §7 exception responses.' }],
    Component: lazy(() => import('./FramingLab')),
  },
  {
    id: 'tank-3d',
    n: '05',
    title: 'Tank and control loop',
    blurb: 'Compare on/off, P and PI control in a 3D heated tank. Trace setpoint, temperature, heater power and data quality.',
    goal: 'Close the loop from measured temperature to heater power, then separate physical truth from the supervisory view.',
    tags: ['three.js', 'Canvas'],
    tryThis: [
      'Compare <b>P</b> and <b>PI</b> after settling. Raise the <b>setpoint</b> to 75 °C to cross the alarm limit.',
      'Cut the <b>link</b>: the tank keeps heating but the supervisory value goes stale.',
      'Trigger a <b>fault</b>: the heater trips and the tank cools toward ambient.',
    ],
    real: 'The exact shape of the C# lab: the equipment keeps moving while communications are down, so the dashboard must show quality and age, not just a number.',
    companion: 'Article 01, 07 · extended thermal control model',
    books: [{ id: 'petruzella', where: 'Sections 14.3–14.4, pp. 294–298: on/off, proportional and integral control.' }, { id: 'astromHagglund', where: 'The standard reference on integrator windup, anti-windup schemes and bumpless transfer between modes.' }, { id: 'astromMurray', where: 'The PID control chapter; free to read online.' }, { id: 'kuphaldt', where: 'Chapter 29, closed-loop control and PID (free, CC BY 4.0).' }],
    Component: lazy(() => import('./TankLab')),
  },
  {
    id: 'alarms',
    n: '06',
    title: 'Alarm lifecycle',
    blurb: 'Hysteresis, on-delay and acknowledgement on a noisy signal, with the state machine drawn live.',
    goal: 'Design alarms that tell an operator something true once, rather than chattering.',
    tags: ['SVG'],
    tryThis: [
      'Narrow the <b>deadband</b> to zero and add noise: the alarm chatters.',
      'Add an <b>on-delay</b> to filter short spikes.',
      'Mark the signal <b>bad quality</b> while active and confirm it does not clear the alarm.',
    ],
    real: 'Alarm floods are a leading operator-overload problem. Good limits, deadbands and delays cut nuisance alarms without hiding real ones.',
    companion: 'Article 08 · labs/IndustrialLab/Alarms.cs',
    books: [{ id: 'alarmHandbook', where: 'Alarm philosophy, rationalization and the alarm-flood problem this lab simulates in miniature.' }],
    primary: [{ id: 'P33', where: 'Section 4, alarm systems: prioritization (4.1.3) and priority coding (4.2.2-3).' }, { id: 'P27', where: 'Commonly cited ISA-18.2 alarm-rate benchmarks per operator.' }],
    Component: lazy(() => import('./AlarmLab')),
  },
  {
    id: 'architecture',
    n: '07',
    title: 'Plant architecture and outage',
    blurb: 'An interactive map from sensor to ERP. Send data through it, then cut links and watch the outbox buffer.',
    goal: 'Hold the whole stack in your head: what lives at each layer, who talks to whom, and what happens when a link fails.',
    tags: ['React Flow'],
    tryThis: [
      'Click any node to read its role and typical protocols.',
      'Cut the <b>plant to cloud</b> link: records queue in the outbox instead of being lost.',
      'Restore it and watch the queue drain in order.',
    ],
    real: 'Store-and-forward is what makes a historian or MES integration survivable. Duplicates on replay are expected, so consumers must be idempotent.',
    companion: 'Article 03, 08, 09 · labs/IndustrialLab/Outbox.cs',
    books: [{ id: 'eip', where: 'The Guaranteed Delivery and Idempotent Receiver patterns are the outbox and duplicate check in this lab.' }, { id: 'kleppmann', where: 'Delivery guarantees, duplicates and event time versus processing time.' }],
    primary: [{ id: 'P31', where: '§2.3 OT architectures and §5.1.2 defense in depth.' }, { id: 'P5', where: 'Delivery semantics, including QoS 1 at-least-once delivery.' }],
    Component: lazy(() => import('./ArchitectureLab')),
  },
  {
    id: 'protocol-picker',
    n: '08',
    title: 'Protocol picker',
    blurb: 'Answer a few questions about your device and network; get a Modbus, OPC UA or MQTT recommendation with reasons.',
    goal: 'Choose protocols from constraints (security, modelling, fan-out) rather than habit.',
    tags: ['SVG'],
    tryThis: [
      'Toggle <b>legacy device</b> and <b>needs browsing/types</b> and watch the scores move.',
      'Require <b>many consumers</b> to see MQTT climb.',
      'Note that real plants often use two or three of them together.',
    ],
    real: 'Real systems are layered: Modbus at the device, OPC UA at the plant, MQTT to the enterprise or cloud.',
    companion: 'Article 02',
    books: [{ id: 'mahnke', where: 'The OPC UA information model, address space and subscriptions in depth.' }],
    primary: [{ id: 'P32', where: 'Birth and death certificates and the Protocol Buffers payload (§6.2).' }, { id: 'P5', where: 'MQTT 5 publish/subscribe and QoS levels.' }, { id: 'P25', where: 'The Modbus data model and function codes.' }],
    Component: lazy(() => import('./ProtocolPicker')),
  },
  {
    id: 'ladder-logic', n: '09', title: 'Ladder logic and motor control',
    blurb: 'Wire a start/stop circuit, step a PLC scan, and compare a motor command with real contactor feedback.',
    goal: 'Separate physical contacts, sampled input bits, ladder conditions and actual equipment state.',
    tags: ['three.js', 'SVG'],
    tryThis: ['Press Start, complete a scan, release Start and scan again. The <b>holding branch</b> keeps the motor on.', 'Break the <b>stop wire</b>, then sample, execute and write separately.', 'Jam the contactor and compare <b>Feedback</b> with <b>Command</b> as the holding source.'],
    real: 'An output bit is a request. Feedback is evidence that the contactor operated. Comparing the two reveals faults that a command-only dashboard misses.',
    companion: 'Original motor-control experiment · discrete I/O and ladder logic',
    books: [{ id: 'petruzella', where: 'Sections 5.2, 5.8 and 6.8–6.9, pp. 70–71, 81–82, 105–106: scan, XIC/XIO, holding and interlocking.' }],
    primary: [{ id: 'P31', where: '§2.3.7: safety systems are independent from the basic process control system.' }],
    Component: lazy(() => import('./LadderLab')),
  },
  {
    id: 'timers-counters', n: '10', title: 'Timers, counters and memory',
    blurb: 'Feed one signal to TON, TOF, RTO and a counter. Compare elapsed time, retained state and rising edges.',
    goal: 'Predict the state of timer bits and counters as inputs turn on, turn off and reset.',
    tags: ['SVG'],
    tryThis: ['Hold the input on: <b>CTU</b> counts once while the timers accumulate.', 'Turn it off early: <b>TON</b> clears, <b>RTO</b> retains, and <b>TOF</b> starts delaying off.', 'Pause and <b>step 100 ms</b> to inspect EN, TT, DN and the one-shot.'],
    real: 'Machine delays and production counts depend on instruction state across scans. Counting high scans instead of input edges produces wildly wrong totals.',
    companion: 'Original timing workbench · seconds-based teaching model',
    books: [{ id: 'petruzella', where: 'Sections 7.2–7.5 and 8.2, pp. 122–134, 146–153: timer behavior, count-up and one-shot instructions.' }],
    Component: lazy(() => import('./TimingLab')),
  },
  {
    id: 'analog-scaling', n: '11', title: 'Analog signals and scaling',
    blurb: 'Follow temperature through a current loop, ADC counts and engineering units. Inject noise and range errors.',
    goal: 'Distinguish electrical quality, quantization and engineering meaning when turning a sensor signal into a number.',
    tags: ['SVG'],
    tryThis: ['Keep a 0–100 °C transmitter at 50 °C, but configure the PLC maximum as <b>200 °C</b>.', 'Compare <b>8, 12 and 16 bits</b>, then add current noise.', 'Open the wire: inspect raw counts, unchecked math and the <b>quality-gated</b> result.'],
    real: 'A correctly decoded, electrically valid register can still be mis-scaled. Calibration and range configuration are part of the data contract.',
    companion: 'Original 4–20 mA experiment · explicit 0–24 mA ADC model',
    books: [{ id: 'petruzella', where: 'Sections 2.3 and 11.6, pp. 22–25, 227–228; section 14.4, p. 295: analog conversion, scaling and live zero.' }, { id: 'kuphaldt', where: '§13.1–13.2: 4 to 20 mA current signals and relating them to process variables (free, CC BY 4.0).' }],
    Component: lazy(() => import('./AnalogLab')),
  },
  {
    id: 'sequencing', n: '12', title: 'Sequences and product tracking',
    blurb: 'Run a fill–mix–drain batch, then follow reject decisions through a conveyor shift register.',
    goal: 'Use state transitions and position-linked data to coordinate equipment without losing the process context.',
    tags: ['three.js', 'SVG'],
    tryThis: ['Start a batch and inspect the <b>output word</b> at each transition.', 'Block the inlet: filling times out instead of starting the mixer on an empty tank.', 'In <b>Part tracking</b>, miss a clock pulse and follow the numbered part to its exit decision.'],
    real: 'A time delay does not prove a process condition, and a stored bit does not know where a product is. Use explicit transition evidence and synchronized tracking.',
    companion: 'Original batch and conveyor models · event-driven sequencing',
    books: [{ id: 'petruzella', where: 'Sections 12.2–12.4, pp. 239–255: sequencer outputs, state charts and bit shift registers.' }, { id: 'erickson', where: 'Systematic sequential design, including state-based methods and IEC 61131-3 Sequential Function Charts.' }],
    Component: lazy(() => import('./SequenceLab')),
  },
  {
    id: 'troubleshooting', n: '13', title: 'Find the fault',
    blurb: 'Inspect a virtual system from field switch to load. Diagnose four faults using observations, not guesses.',
    goal: 'Locate the boundary where physical state, I/O indications, program values and equipment behavior stop agreeing.',
    tags: ['SVG'],
    tryThis: ['Collect observations <b>on both sides</b> of a suspected fault.', 'Compare the channel LED with the <b>program tag address</b>.', 'When the output is on but the lamp is dark, inspect the separate <b>load supply</b>.'],
    real: 'Systematic troubleshooting separates wiring, mapping, logic and power faults. A single status indicator cannot prove the whole chain is healthy.',
    companion: 'Four original diagnostic cases · virtual observations only',
    books: [{ id: 'petruzella', where: 'Section 13.9, pp. 275–279: systematic diagnosis and input/output troubleshooting.' }],
    Component: lazy(() => import('./TroubleshootingLab')),
  },
  {
    id: 'safety-systems', n: '14', title: 'Safety instrumented systems',
    blurb: 'Overfill a storage tank through layers of protection. Fail instruments, bypass the SIS and compare voting architectures.',
    goal: 'See why safety layers must be independent, how trip circuits fail safe, and how redundancy trades failure on demand against spurious trips.',
    tags: ['SVG'],
    tryThis: ['Stick <b>LT-1</b> and give the SIS the same transmitter: every layer goes blind.', 'Set the <b>operator response</b> above 5 s: the alarm is no longer a protection layer.', 'Raise <b>β</b> and watch common cause cancel the benefit of 2oo3 voting.'],
    real: 'Overfills at Buncefield (2005) and Texas City (2005) involved level indication that did not show the true level. Independent sensors, honest proof testing and bypass control are the practical lessons.',
    companion: 'Original overfill and voting models · IEC 61511 concepts, simplified',
    books: [{ id: 'gruhn', where: 'Layers of protection, SIL determination, voting architectures and proof testing.' }, { id: 'kuphaldt', where: '§32.6: safety instrumented functions, SIS sensors, logic solvers and final elements, and Safety Integrity Levels (free, CC BY 4.0).' }],
    primary: [{ id: 'P31', where: '§2.3.7: a SIS is composed of safety instrumented functions and is often independent of the BPCS.' }, { id: 'P34', where: 'Table 2: 44 % of primary causes in specification and 20 % in changes after commissioning, from 34 incidents.' }, { id: 'P35', where: 'Official reports on the 2005 overfill and explosion.' }, { id: 'P36', where: 'Recommendations on level instrumentation and automatic controls to prevent overfilling.' }],
    Component: lazy(() => import('./SafetyLab')),
  },
  {
    id: 'hmi-design', n: '15', title: 'Operator display design',
    blurb: 'Find problems on a legacy screen and on a high-performance one. Switch design principles on one at a time and time yourself.',
    goal: 'Learn which display choices help an operator notice drift, alarms and frozen data, and why color alone is not enough.',
    tags: ['SVG'],
    tryThis: ['Play three rounds in <b>legacy</b>, then three in <b>high-performance</b>, and compare your mean times.', 'Turn on only <b>analog indicators</b>: drifts become visible before they alarm.', 'Enable the <b>color-vision simulation</b> in legacy mode and look for the alarm.'],
    real: 'After the 2005 Texas City explosion, the CSB recommended control-board displays that clearly show a tower’s material balance. What a screen makes obvious decides what operators notice in time.',
    companion: 'Original pump-station display · high-performance HMI principles',
    books: [{ id: 'hmiHandbook', where: 'Gray-scale design, analog indicators with normal ranges, and display hierarchy.' }, { id: 'alarmHandbook', where: 'How alarm priority and presentation affect operator response.' }],
    primary: [{ id: 'P33', where: 'Guidelines 1.3.8-10 (redundant color coding), 1.1-19 (limit marks), 1.2.4-7 (normal range), 1.3.10-9 (flashing), 4.2.2-3 (priority coding), 14.3-3 and 14.3-4 (invalid and unvalidated data).' }, { id: 'P36', where: 'Recommendation to configure control-board displays to show material balance clearly.' }, { id: 'P28', where: 'Display hierarchy levels and color principles from high-performance HMI practice.' }],
    Component: lazy(() => import('./HmiLab')),
  },
]

export const labById = (id: string) => LABS.find((l) => l.id === id)

export const LAB_COUNT = String(LABS.length).padStart(2, '0')
export const LEARNING_PATH = ['scan-cycle', 'ladder-logic', 'timers-counters', 'analog-scaling', 'tank-3d', 'sequencing', 'troubleshooting', 'safety-systems']

