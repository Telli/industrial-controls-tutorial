// Explanatory text for each lab page: a plain-language introduction, background,
// key terms and one question to check understanding. Inline HTML is limited to <b> and <code>.

export interface LabContent {
  intro: string
  background: string[]
  terms: [string, string][]
  check: { q: string; a: string }
}

export const LAB_CONTENT: Record<string, LabContent> = {
  'scan-cycle': {
    intro: 'A PLC does not watch its inputs continuously. It takes a snapshot of them, runs its program, updates its outputs and repeats, typically every few milliseconds. Software that reads from the PLC over a network adds a second, usually much slower, snapshot on top.',
    background: [
      'In each scan the PLC copies its physical inputs into an <b>input image</b>, runs the program against that frozen copy, then writes the output image to the physical outputs. A signal that turns on and off between two input reads never appears in the input image, so no logic can react to it. A pulse is only guaranteed to be seen if it lasts at least one full scan.',
      'A SCADA system or C# service typically polls the PLC every 100 ms to a few seconds. It sees the PLC’s memory only at the instant of each poll. A bit the PLC set for a single scan can appear and disappear between two polls.',
      'The fix depends on where the loss happens. If the PLC misses the pulse, you need a faster task, a high-speed counter or an interrupt input at the source; polling faster cannot recover it. If the poller misses it, have the PLC <b>count</b> or <b>latch</b> the event so the information persists until it has been read.',
      'Counters introduce their own questions: how wide the counter is, when it wraps or resets, and how a restart is detected. A 16-bit counter that goes from 65530 to 4 has advanced by 10 only if it wrapped exactly once.',
    ],
    terms: [
      ['Scan time', 'How long one read–execute–write cycle takes. Often 1–50 ms.'],
      ['Input image', 'The PLC’s copy of its inputs, taken at the start of a scan and used by the whole program.'],
      ['Polling', 'Asking a device for its current values at a fixed interval.'],
      ['Latch', 'A bit that stays on after the event that set it, until something explicitly clears it.'],
      ['Latency', 'Delay between a physical change and when a system observes it.'],
    ],
    check: {
      q: 'A sensor produces 5 ms pulses. The PLC scan is 10 ms and the HMI polls every 200 ms. What has to change for the HMI to report every pulse?',
      a: 'Two things. The PLC must see every pulse: a scan shorter than 5 ms, or a hardware counter input. Then the PLC should expose a running count that the HMI reads, taking the difference between successive readings. Faster HMI polling alone cannot help, because some pulses never reach the PLC’s memory.',
    },
  },
  'byte-order': {
    intro: 'Modbus devices store data in 16-bit registers. A 32-bit value, such as a temperature stored as a floating-point number, needs two registers. Manufacturers disagree about which half goes first.',
    background: [
      'Modbus defines the byte order inside one register (big-endian) but not how to combine registers. Name the four bytes of a 32-bit value <b>A B C D</b>, from most to least significant. Devices send them as ABCD, CDAB (words swapped), BADC (bytes swapped within each word) or DCBA.',
      'Decoding with the wrong order rarely causes an error. You get a valid number that is wrong, and sometimes plausible. The same register pair may also be meant as an unsigned 32-bit counter or a signed integer; the data type comes from the device documentation, not from the bytes.',
      'Many Modbus libraries hand you each register as an already-decoded 16-bit number. Rebuild the wire bytes explicitly before rearranging them; calling a platform conversion such as <code>BitConverter.GetBytes</code> on a register gives little-endian bytes on most PCs and silently adds a second swap.',
      'Verify with a known value. Set the device to a reading you can confirm independently, or read a register with a documented constant, and check it under every layout. Then record the layout in the device mapping and cover it with a test.',
    ],
    terms: [
      ['Register', 'A 16-bit storage location in a Modbus device.'],
      ['Endianness', 'Whether the most significant byte comes first (big-endian) or last (little-endian).'],
      ['Word order', 'Which of two registers holds the high half of a 32-bit value.'],
      ['IEEE 754 float', 'The standard 32-bit floating-point format: sign, exponent and fraction bits.'],
      ['Test vector', 'A known input with a known correct output, used to verify a decoder.'],
    ],
    check: {
      q: 'Two registers read 0x0000 and 0x41CC. Decoded as ABCD the value is about 2.4e-41. What does that suggest?',
      a: 'The high word is in the second register, so the device uses CDAB word order. Read as CDAB, the bytes are 41 CC 00 00, which is exactly 25.5.',
    },
  },
  'packed-bits': {
    intro: 'Machines report many on/off conditions: running, faulted, door open. To save space, devices often pack sixteen of them into one register, one condition per bit.',
    background: [
      'Bit 0 is the least significant bit (value 1) and bit 15 the most significant (value 32768). To test bit <i>n</i>, AND the register with the mask <code>1 &lt;&lt; n</code>. Manuals sometimes number bits from 1, or list them starting at the high end, so confirm the numbering against a known machine state.',
      'If your code reads the register as a signed 16-bit integer, setting bit 15 makes the value negative. Bit tests still work, but range checks and comparisons such as <code>value &gt; 0</code> break.',
      'Changing one bit by reading the register, editing the bit and writing the whole register back is a race. If the PLC changed another bit in between, your write undoes that change. Prefer a write that targets a single bit: Modbus function 05 for coils, function 22 (Mask Write Register) where the device supports it, or a command register that only your application writes.',
    ],
    terms: [
      ['Bit mask', 'A value with only the bits of interest set, used with AND/OR to test or change them.'],
      ['LSB / MSB', 'Least and most significant bit: bit 0 and bit 15 of a 16-bit register.'],
      ['Coil', 'A single read/write bit in the Modbus data model.'],
      ['Status word', 'A register whose bits each report one device condition.'],
      ['Read-modify-write', 'Reading a value, changing part of it and writing it all back. Unsafe if another writer exists.'],
    ],
    check: {
      q: 'A status register reads 0x8004. Which bits are set, and what does a signed 16-bit reading show?',
      a: 'Bits 15 and 2 (0x8000 + 0x0004). Read as unsigned it is 32772; read as signed int16 it is −32764.',
    },
  },
  'tcp-framing': {
    intro: 'Modbus TCP sends each request and reply as a short message of bytes. TCP itself, however, delivers a continuous stream: a reply can arrive in pieces, and two replies can arrive together.',
    background: [
      'Every Modbus TCP message starts with a 7-byte <b>MBAP header</b>: transaction ID, protocol ID (always 0), a length field and the unit ID. The length counts the bytes after it, including the unit ID. After reading the first six bytes you know exactly how many more to wait for.',
      'A common bug is to send a request, sleep for a fixed time, then call <code>Read()</code> once. On a quiet bench the whole reply has usually arrived. On a busy network or through a slow gateway it has not, and the code parses half a frame. A longer sleep only makes the program slower without making it correct.',
      'A correct reader loops until the required number of bytes has arrived, with one timeout for the whole operation, and checks that the reply’s transaction ID and function code match the request. An exception reply sets the high bit of the function code: 0x83 means a function 03 request failed, and the next byte gives the reason.',
    ],
    terms: [
      ['MBAP header', 'Modbus Application Protocol header: the 7 bytes in front of every Modbus TCP message.'],
      ['PDU', 'Protocol data unit: function code plus data, the same as in serial Modbus.'],
      ['Transaction ID', 'A number the client chooses and the server echoes, used to match replies to requests.'],
      ['Byte stream', 'TCP delivers ordered bytes, with no built-in message boundaries.'],
      ['Exception response', 'A reply reporting that the server could not perform the request.'],
    ],
    check: {
      q: 'The first six bytes of a reply are 00 07 00 00 00 07. How many more bytes must you read?',
      a: 'Seven. The length field (0x0007) counts the unit ID, function code and byte count (one byte each) plus the four data bytes of two registers.',
    },
  },
  'tank-3d': {
    intro: 'A controller keeps a process at a target value, here a tank’s temperature, by measuring it and adjusting a heater. Separately, a supervisory system watches the tank over a network link that can fail.',
    background: [
      'The model is a heat balance: up to 12 kW of heating, heat loss proportional to the difference from a 25 °C room, and a time constant of about one minute. With the heater fully on, the tank would settle at 85 °C.',
      '<b>On/off</b> control switches the heater fully on below the setpoint and off above it. The deadband stops it switching too often, at the cost of a temperature that cycles. <b>Proportional (P)</b> control sets heater power in proportion to the error. Because some power is always needed to replace lost heat, P control settles below the setpoint: an error must remain to keep the heater partly on. <b>Integral (PI)</b> control accumulates past error and removes that offset.',
      'When the heater is saturated at 0 % or 100 %, an integral term that keeps growing causes a large overshoot later (integral windup). This model stops integrating while the output is saturated in the same direction as the error.',
      'The controller runs locally and keeps working when the link to SCADA fails, and the supervisory value freezes. A trustworthy display marks that value stale and shows its age instead of presenting the last number as current.',
    ],
    terms: [
      ['Setpoint (SP)', 'The value the controller is trying to reach.'],
      ['Process variable (PV)', 'The measured value, here the tank temperature.'],
      ['Error', 'Setpoint minus process variable.'],
      ['Steady-state offset', 'Error that remains after P-only control has settled.'],
      ['Integral windup', 'Overshoot caused by integral action accumulating while the output is saturated.'],
      ['Stale data', 'A value that has not been refreshed within its expected interval.'],
    ],
    check: {
      q: 'In P mode with a 60 °C setpoint, the tank settles near 54 °C. Why, and what removes the gap?',
      a: 'The heater must supply power to balance the heat loss, and P control produces power only when there is error. A higher gain shrinks the offset but can cause oscillation. Integral action (PI) removes it, because the integral holds the needed output even when the error is zero.',
    },
  },
  alarms: {
    intro: 'An alarm tells an operator that something needs attention now. Alarms that fire constantly on noise teach operators to ignore them, including the ones that matter.',
    background: [
      'A <b>deadband</b> (hysteresis) makes the alarm clear at a lower value than it sets. Here it activates at the limit and returns to normal only at or below limit minus deadband. A noisy signal hovering near the limit then produces one alarm instead of dozens.',
      'An <b>on-delay</b> requires the condition to stay true for a set time before the alarm activates, which filters brief spikes. It also delays real alarms, so keep it short compared with how quickly the process can become dangerous.',
      '<b>Acknowledging</b> records that a person has seen the alarm. It does not clear the condition. The states drawn here (unacknowledged or acknowledged, active or returned to normal) follow the lifecycle described in ISA-18.2.',
      'When communication fails, the alarm system loses its evidence. That is different from the value returning to normal, so the alarm keeps its state and a separate quality indication is raised. Industry guidance (ISA-18.2, EEMUA 191) aims for roughly one alarm per operator every ten minutes in normal operation.',
    ],
    terms: [
      ['Deadband', 'The gap between the set and clear limits. Also called hysteresis.'],
      ['On-delay', 'How long a condition must persist before the alarm activates.'],
      ['Chattering alarm', 'An alarm that repeatedly activates and clears within a short time.'],
      ['Acknowledge', 'An operator action recording that the alarm was seen.'],
      ['Alarm flood', 'More alarms than an operator can respond to, typically during an upset.'],
    ],
    check: {
      q: 'Set limit 65 °C, deadband 2 °C. The value goes 66, 64, 62.5. At which value does the alarm return to normal?',
      a: 'At 62.5 °C, the first value at or below the clear limit of 63 °C. At 64 °C it is inside the deadband and stays active.',
    },
  },
  architecture: {
    intro: 'Plant data passes through several systems on its way from a sensor to a business report. Each hop can fail on its own.',
    background: [
      'The Purdue model (used by ISA-95) numbers the layers: level 0 field devices, level 1 controllers, level 2 supervisory systems such as SCADA and HMIs, level 3 operations such as MES and historians, and level 4 business systems such as ERP. Control stays at the lower levels. Higher levels read data and send requests, not real-time commands.',
      'With <b>store-and-forward</b>, the edge writes each record to a local durable queue (an outbox) before trying to send it. If the uplink fails, records wait. When it recovers they are sent in order. Nothing is lost while the queue has space, so size it for the longest outage you must survive: at 2 records per second, 10,000 slots last about 83 minutes.',
      'Delivery is <b>at least once</b>. If the link drops after the receiver stored a record but before its acknowledgement arrived, the sender cannot tell and sends it again. Consumers must therefore be <b>idempotent</b>: a stable record ID (source, boot ID, sequence number) lets them recognize and ignore a duplicate.',
    ],
    terms: [
      ['Purdue model', 'A reference layering of industrial systems from field devices (0) to business systems (4).'],
      ['Edge gateway', 'A computer near the equipment that collects, converts and forwards data.'],
      ['Outbox', 'A durable local queue of records waiting to be sent.'],
      ['At-least-once delivery', 'Every record arrives, but some may arrive more than once.'],
      ['Idempotent', 'Processing the same message twice has the same effect as processing it once.'],
      ['Historian', 'A database optimized for time-stamped process values.'],
    ],
    check: {
      q: 'Turn off “idempotent consumer”, cut the cloud link for a few seconds, then restore it. Why does a duplicate row appear?',
      a: 'The last record sent before the cut was stored, but its acknowledgement was lost. After reconnecting, the outbox sent it again. Without a check on the record ID, the consumer stored it twice.',
    },
  },
  'protocol-picker': {
    intro: 'Industrial devices speak many protocols. Three come up constantly in software projects: Modbus, OPC UA and MQTT. They solve different problems.',
    background: [
      '<b>Modbus</b>, from 1979, reads and writes numbered registers and bits. It is simple and almost every device supports it, but it carries no names, units, data types or security. All meaning lives in the device manual.',
      '<b>OPC UA</b> adds an information model: named, typed, browsable nodes with engineering units, subscriptions, and built-in security with certificates, signing and encryption. It suits plant-level integration and takes more effort to configure.',
      '<b>MQTT</b> is a lightweight publish/subscribe protocol that runs through a broker. Many consumers can receive one stream, and it copes well with unreliable links. It defines transport, not meaning; conventions such as Sparkplug B add payload structure and device state.',
      'The scores below are a heuristic for thinking through the trade-offs. Most real plants layer the three rather than picking one.',
    ],
    terms: [
      ['Register map', 'The device document listing what each Modbus address means.'],
      ['Information model', 'A structured, self-describing description of the data a server exposes.'],
      ['Publish/subscribe', 'Senders publish to topics; any number of receivers subscribe to them.'],
      ['Broker', 'The MQTT server that routes messages from publishers to subscribers.'],
      ['QoS', 'MQTT delivery guarantee: at most once (0), at least once (1) or exactly once (2).'],
    ],
    check: {
      q: 'A 1990s flow meter must feed both a plant historian and a cloud dashboard. Which protocols would you use, and where?',
      a: 'Modbus between the meter and an edge gateway, since that is likely all the meter supports. From the gateway, publish over MQTT to the cloud and serve the historian through OPC UA or MQTT, depending on what it accepts.',
    },
  },
  'ladder-logic': {
    intro: 'Ladder logic is the most widely used PLC language. It looks like an electrical wiring diagram: power flows from the left rail through contacts to an output coil on the right.',
    background: [
      '<b>XIC</b> (examine if closed, drawn <code>-| |-</code>) is true when its bit is 1. <b>XIO</b> (examine if open, <code>-|/|-</code>) is true when its bit is 0. They test bits in memory, not the physical type of switch. A normally closed stop button gives a 1 while it is healthy, so it is tested with XIC, and a broken wire then stops the motor, which is the safe way to fail.',
      'The Start button is momentary, so a <b>holding branch</b> (seal-in) in parallel with Start keeps the rung true after the button is released. Holding on the contactor’s auxiliary contact rather than the PLC’s own command means the circuit drops out if the contactor never actually pulls in.',
      'An output coil is a request. Only feedback proves that the equipment moved. Comparing command and feedback, with a timeout, catches failed contactors, tripped overloads and lost control power.',
      'Emergency stops are not built this way. They require hard-wired or safety-rated circuits, not ordinary PLC logic.',
    ],
    terms: [
      ['Rung', 'One line of ladder logic: conditions on the left, an output on the right.'],
      ['XIC / XIO', 'Instructions that test a bit for 1 or for 0.'],
      ['Seal-in', 'A branch that keeps an output on after the start condition goes away.'],
      ['Auxiliary contact', 'An extra contact on a contactor that reports whether it has pulled in.'],
      ['Overload relay', 'A device that trips when a motor draws too much current for too long.'],
    ],
    check: {
      q: 'The motor command is on, but feedback stays off for several seconds. What could cause this, and what should the logic do?',
      a: 'A failed contactor coil, a tripped overload, missing control power or a broken feedback wire. After a reasonable timeout the logic should drop the command and raise a “failed to start” alarm instead of commanding indefinitely.',
    },
  },
  'timers-counters': {
    intro: 'Timers and counters give a PLC memory over time: wait five seconds and then act, or count twelve bottles and then close the case.',
    background: [
      '<b>TON</b> (on-delay) times while its input is true and sets its done bit when the accumulated time reaches the preset. If the input goes false it resets at once. <b>TOF</b> (off-delay) keeps its output on for the preset time after the input goes false. <b>RTO</b> (retentive) keeps its accumulated time when the input goes false and needs a separate reset.',
      'In Rockwell-style instructions, <b>EN</b> follows the rung input, <b>TT</b> is on while the timer is timing and <b>DN</b> is on when it is done. IEC 61131-3 function blocks express the same ideas with outputs Q and ET.',
      '<b>CTU</b> counts false-to-true transitions of its input, not scans. If you add 1 on every scan while the input is true, a two-second press with a 10 ms scan adds about 200. A one-shot produces a pulse lasting exactly one scan on a rising edge.',
      'A timer’s resolution is limited by the scan: its bits change only when its rung is executed.',
    ],
    terms: [
      ['Preset (PRE)', 'The target time or count.'],
      ['Accumulator (ACC)', 'The time or count reached so far.'],
      ['Done bit (DN)', 'Set when the accumulator reaches the preset.'],
      ['One-shot', 'An instruction that is true for one scan on a rising edge.'],
      ['Retentive', 'Keeps its value when its input goes false.'],
    ],
    check: {
      q: 'A TON with a 5 s preset sees its input on for 3 s, off for 1 s, then on again. When does DN turn on? What if it were an RTO?',
      a: 'The TON reset when its input went false, so DN turns on 5 s after the input returns: 9 s after the first rising edge. An RTO kept its 3 s and needs 2 s more, so its DN turns on at 6 s.',
    },
  },
  'analog-scaling': {
    intro: 'Many sensors send their measurement as an electrical current between 4 and 20 mA. The PLC converts that current to a number, then scales it to engineering units such as °C.',
    background: [
      'The range starts at 4 mA rather than 0 to provide a <b>live zero</b>: 0 mA means the loop is broken, not that the measurement is at its minimum. Currents well outside 4–20 mA indicate a fault. NAMUR NE 43, for example, treats 3.6 mA or less and 21 mA or more as failure signals.',
      'Scaling is a straight line: <code>value = min + (mA − 4) / 16 × (max − min)</code>. For a 0–100 °C transmitter, 12 mA is 50 °C. If the transmitter and the PLC disagree about the range, the result looks valid and is wrong. Configure the PLC for 0–200 °C and the same 12 mA reads 100 °C.',
      'The converter’s resolution limits the smallest change you can see. A 12-bit converter has 4096 counts; over the 0–24 mA range modeled here, that is about 0.006 mA per count, roughly 0.04 °C on a 0–100 °C transmitter.',
      'Treat quality as part of the value. An out-of-range current should produce a result marked bad, not a number clamped to the edge of the range.',
    ],
    terms: [
      ['4–20 mA loop', 'A two-wire current signal that is robust to electrical noise and long cable runs.'],
      ['Live zero', 'A minimum signal above zero, so that a broken wire can be detected.'],
      ['ADC counts', 'The raw integer produced by the analog-to-digital converter.'],
      ['Scaling', 'Converting raw units to engineering units with a linear formula.'],
      ['Quantization', 'The step size caused by representing a continuous signal with whole counts.'],
    ],
    check: {
      q: 'A 0–150 °C transmitter reads 16 mA. What is the temperature?',
      a: '(16 − 4) / 16 × 150 = 112.5 °C.',
    },
  },
  sequencing: {
    intro: 'Many machines work in steps: fill a tank, mix, drain. A sequence program moves to the next step only when the right conditions are met.',
    background: [
      'Model the sequence as a <b>state machine</b>: one active step at a time, outputs defined for each step, and an explicit condition for each transition. Here Fill ends when the high-level switch confirms the tank is full, not after a fixed time.',
      'Give every step that waits on the process a <b>timeout</b>. If filling takes far longer than expected, a blocked valve or a failed sensor is likely, so the sequence stops and raises an alarm instead of moving on.',
      'For <b>product tracking</b> on a conveyor, an inspection result is stored in a shift register and moved one position each time a position sensor or encoder pulses. When the bit reaches the reject station, the gate fires. Miss one pulse and every tracked decision is one position out: the wrong part is rejected and the faulty one goes through.',
    ],
    terms: [
      ['State machine', 'A program with a set of states and defined transitions between them.'],
      ['Transition condition', 'The evidence required to leave a step.'],
      ['Step timeout', 'A time limit after which a step that has not completed is treated as a fault.'],
      ['Shift register', 'A row of bits moved one position on each clock pulse.'],
      ['Encoder pulse', 'A signal produced each time the conveyor moves a fixed distance.'],
    ],
    check: {
      q: 'Why is “fill for 30 s, then mix” a poor way to end the fill step?',
      a: 'A timer proves only that time passed. If the inlet is blocked, the mixer starts in an empty tank. Use the level switch as the transition condition, and the timer as a fault timeout.',
    },
  },
  troubleshooting: {
    intro: 'When a machine misbehaves, the fault lies somewhere in a chain: field device, wiring, input module, program, output, power supply, load. Good troubleshooting finds the link where two observations stop agreeing.',
    background: [
      'Start in the middle of the chain. If the input LED is on but the program bit is off, the fault is between the module and the program, such as addressing or configuration, and the field device is already proven to work.',
      'Collect evidence on both sides of a suspected fault before replacing parts. A diagnosis supported by a single observation is a guess.',
      'Outputs often switch a separate load supply. An output LED can be on while the load has no power.',
      'On real equipment, follow lockout/tagout procedures and use properly rated meters. The measurements in this lab are simulated.',
    ],
    terms: [
      ['Signal chain', 'Every component a signal passes through from cause to effect.'],
      ['Input indicator', 'The module LED showing that the channel sees voltage.'],
      ['Tag address', 'The I/O point a program variable is mapped to.'],
      ['Load supply', 'The power source that an output switches through to the device.'],
      ['Half-splitting', 'Testing the middle of a chain to rule out half of it at a time.'],
    ],
    check: {
      q: 'An output LED is on and the lamp is dark, but you measure 24 V across the lamp’s terminals. What is left to suspect?',
      a: 'The lamp itself, or its connection. Voltage present at a device that does not respond points to the device or the wiring right at it.',
    },
  },
  'safety-systems': {
    intro: 'Normal control keeps a process where it should be. A safety instrumented system (SIS) is a separate set of sensors, logic and valves whose only job is to bring the process to a safe state when normal control fails.',
    background: [
      'Protection is designed in layers: the basic process control system (BPCS), alarms with an operator response, a safety instrumented system, and finally physical protection such as relief valves and bunds. A layer reduces risk only if it fails independently of the others. A safety function that reads the same transmitter as the control system fails along with it, which is why NIST SP 800-82 describes the SIS as often independent of the BPCS.',
      'An alarm counts as a protection layer only if the operator has time to act. Here the level rises 1 % per second, so an alarm at 90 % leaves 5 seconds before the SIS setpoint. Real processes usually allow longer, but the same arithmetic applies: compare the response time with the time the process allows.',
      'Trip circuits are normally <b>de-energize to trip</b>. The logic holds the shutoff valve open with power, so any loss of power, broken wire or logic failure closes it. Failures then show up as spurious trips instead of silently disabling the protection.',
      'A <b>safety integrity level</b> (SIL) states how dependable a safety function must be. In low-demand mode, SIL 1 means an average probability of failure on demand between 0.01 and 0.1, and each level is ten times stricter. Dangerous failures that diagnostics cannot detect are found only by proof testing, so the test interval appears directly in the calculation.',
      'Voting combines redundant sensors: 1oo2 trips if either of two sensors trips; 2oo3 needs two of three. Redundancy reduces independent random failures but not common-cause ones, such as the same calibration error, the same plugged process connection or the same bypass. In the UK HSE’s analysis of 34 control-system incidents, 44 % of primary causes lay in the specification and 20 % in changes after commissioning, not in subtle hardware faults.',
    ],
    terms: [
      ['BPCS', 'Basic process control system: the everyday control system that runs the process.'],
      ['SIS / SIF', 'Safety instrumented system; each protective function it performs is a safety instrumented function.'],
      ['Layer of protection', 'An independent safeguard that can stop a hazard on its own.'],
      ['PFDavg', 'Average probability that a safety function fails when it is needed.'],
      ['Proof test', 'A periodic test designed to reveal failures that diagnostics cannot detect.'],
      ['MooN voting', 'M out of N channels must agree before the system trips.'],
      ['Common-cause failure', 'One cause that defeats several redundant channels at once; β is the fraction of failures that are common cause.'],
    ],
    check: {
      q: 'In 2oo3 voting, two of the three level switches have failed undetected since the last proof test. What happens on a real high level, and what would have found the problem?',
      a: 'Only one switch can vote and 2oo3 needs two, so the SIS does not trip. A proof test would have revealed the failed switches; that is why the test interval appears in the PFD calculation.',
    },
  },
  'hmi-design': {
    intro: 'Operators supervise hundreds of values on screens like these. The display decides what they notice in time, so its design is a safety question, not decoration.',
    background: [
      'Many older displays use bright colors for normal states: green for running, red for open or stopped, saturated pipes and backgrounds. When everything is colored, an alarm color has nothing to stand out against. High-performance HMI practice uses a muted gray background and reserves strong color for abnormal conditions.',
      'Numbers have to be read and compared with limits held in memory. An analog indicator with a shaded normal range and alarm-limit marks (NUREG-0700 guidelines 1.1-19 and 1.2.4-7) shows deviation at a glance, and a short trend shows direction. In this lab a drifting value leaves its normal range about 14 seconds before it alarms; only the analog view shows that early warning.',
      'Color should never be the only code (NUREG-0700 1.3.8-10). Red–green color-vision deficiency affects roughly one man in twelve, and control-room screens vary. Here, alarm priority is also shown by shape, number and text.',
      'When communication fails, the last value stays on the screen and looks like a steady process. NUREG-0700 14.3-3 and 14.3-4 call for an indication when data are invalid or could not be validated. Here stale values are hatched, marked with their age and shown as uncertain.',
      'Flashing should be reserved for items that need urgent attention (NUREG-0700 1.3.10-9). A display that flashes for routine states teaches people to ignore it.',
    ],
    terms: [
      ['HMI', 'Human-machine interface: the screens operators use to monitor and control the process.'],
      ['High-performance HMI', 'A design approach using muted displays, analog indicators and color reserved for abnormal conditions.'],
      ['Normal range', 'The band a value should stay within during normal operation, narrower than the alarm limits.'],
      ['Alarm priority', 'How urgently an alarm needs a response, coded consistently on every display.'],
      ['Data quality', 'Whether a displayed value is current and valid, or stale, invalid or unvalidated.'],
    ],
    check: {
      q: 'On the legacy display, why might an operator miss the discharge-valve alarm?',
      a: 'The valve’s normal open state is already shown in red, the same color the display uses for alarms, so the alarm does not stand out. Coding priority with shape and text, and using a muted palette for normal states, fixes this.',
    },
  },
}
