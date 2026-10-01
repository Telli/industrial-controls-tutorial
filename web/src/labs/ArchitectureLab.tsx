import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BaseEdge, Background, Controls, Handle, MarkerType, Position, ReactFlow, getBezierPath,
  type Edge, type EdgeProps, type Node, type NodeMouseHandler, type NodeProps,
} from '@xyflow/react'
import { Stat } from '../components/ui'
import { useTheme } from '../components/Theme'

interface Info { title: string; layer: string; desc: string; protocols: string; failure: string; color: string }

const INFO: Record<string, Info> = {
  field: { title: 'Sensors and actuators', layer: 'L0 · Field', color: 'var(--accent)', desc: 'Thermocouples, level switches, valves, motors. They produce continuous physical signals.', protocols: '4–20 mA, discrete I/O, IO-Link', failure: 'Wire breaks and drift look like valid numbers unless the PLC range-checks them.' },
  plc: { title: 'PLC / controller', layer: 'L1 · Control', color: 'var(--cyan)', desc: 'Runs a deterministic scan: read inputs, execute logic, write outputs, publish an image of its memory.', protocols: 'Modbus TCP server, OPC UA server, vendor fieldbus', failure: 'A value you read is a snapshot of one scan. Events shorter than a scan or poll can vanish.' },
  gw: { title: 'Edge gateway / poller', layer: 'L2 · Acquisition', color: 'var(--green)', desc: 'Your C# service: reads registers, decodes byte order, stamps time, attaches quality and mapping version.', protocols: 'Modbus TCP client, OPC UA client', failure: 'Wrong byte order gives plausible numbers. Timeouts must become bad quality, not the last good value.' },
  scada: { title: 'SCADA / HMI', layer: 'L2 · Supervisory', color: 'var(--green)', desc: 'Shows operators the plant, evaluates supervisory alarms, sends setpoint requests through guarded paths.', protocols: 'OPC UA, vendor drivers, web UI', failure: 'A frozen screen looks like a stable process. Show age and quality next to every value.' },
  outbox: { title: 'Outbox (store and forward)', layer: 'L3 · Reliability', color: 'var(--accent)', desc: 'A durable queue beside the producer. Records are written once locally, then forwarded until acknowledged.', protocols: 'SQLite / SQL table, file queue', failure: 'At-least-once delivery means duplicates on replay. Consumers must be idempotent.' },
  broker: { title: 'MQTT broker / WAN', layer: 'L3 · Transport', color: 'var(--violet)', desc: 'Decouples producers and consumers. Many subscribers can receive the same stream; survives flaky links with QoS and sessions.', protocols: 'MQTT 3.1.1 / 5, TLS', failure: 'Broker retains messages, not meaning: payload schema and timestamps are your job.' },
  hist: { title: 'Historian / MES', layer: 'L3 · Records', color: 'var(--violet)', desc: 'Stores time-series and turns observations into batches, genealogy and workflows.', protocols: 'SQL, time-series DB, REST', failure: 'Late or out-of-order data must land at its source time, not arrival time.' },
  erp: { title: 'ERP / cloud analytics', layer: 'L4 · Business', color: 'var(--muted)', desc: 'Orders, inventory, costing and analytics. Consumes summaries, not raw scan data.', protocols: 'REST, message bus, batch files', failure: 'Never close a control loop through this layer; its latency is seconds to hours.' },
  agent: { title: 'AI agent (bounded tools)', layer: 'Assist', color: 'var(--pink)', desc: 'Reads evidence with timestamps and quality, and can only propose changes. A person or controller approves and executes.', protocols: 'MCP tools over stdio / HTTP', failure: 'Stale evidence or replayed request IDs must be rejected; proposals expire.' },
}

interface PlantData extends Record<string, unknown> { id: string; body: string; selected: boolean; down: boolean }

const SIDES: [string, Position][] = [['top', Position.Top], ['bottom', Position.Bottom], ['left', Position.Left], ['right', Position.Right]]

function PlantNode({ data }: NodeProps<Node<PlantData>>) {
  const info = INFO[data.id]
  return (
    <div className={`plant${data.selected ? ' selected' : ''}${data.down ? ' down' : ''}`}>
      {SIDES.map(([side, pos]) => (
        <span key={side}>
          <Handle id={`${side}-s`} type="source" position={pos} style={{ opacity: 0 }} />
          <Handle id={`${side}-t`} type="target" position={pos} style={{ opacity: 0 }} />
        </span>
      ))}
      <div className="nt" style={{ color: info.color }}>{info.title}</div>
      <div className="nd">{info.layer}</div>
      {data.body && <div className="nb">{data.body}</div>}
    </div>
  )
}
const nodeTypes = { plant: PlantNode }

// Custom edge that draws a moving packet when active.
function PacketEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })
  const d = data as { active: boolean; color: string; cut: boolean }
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: d.cut ? 'var(--red)' : 'var(--line)', strokeWidth: 2, strokeDasharray: d.cut ? '6 6' : undefined }} />
      {d.active && !d.cut && (
        <circle r="4.5" fill={d.color}>
          <animateMotion dur="1.4s" repeatCount="indefinite" path={path} />
        </circle>
      )}
    </>
  )
}
const edgeTypes = { packet: PacketEdge }

// [id, source, target, color, sourceSide, targetSide]; layers stack upward from the field.
const EDGES: [string, string, string, string, string, string][] = [
  ['e1', 'field', 'plc', 'var(--accent)', 'top', 'bottom'], ['e2', 'plc', 'gw', 'var(--cyan)', 'top', 'bottom'], ['e3', 'gw', 'scada', 'var(--green)', 'right', 'left'],
  ['e4', 'gw', 'outbox', 'var(--accent)', 'top', 'bottom'], ['e5', 'outbox', 'broker', 'var(--violet)', 'top', 'bottom'], ['e6', 'broker', 'hist', 'var(--violet)', 'right', 'left'],
  ['e7', 'hist', 'erp', 'var(--muted)', 'top', 'bottom'], ['e8', 'broker', 'agent', 'var(--pink)', 'top', 'bottom'],
]

export default function ArchitectureLab() {
  const { theme } = useTheme()
  const sim = useRef({ seq: 0, queue: [] as number[], inflight: null as number | null, stored: [] as number[], seen: new Set<number>(), dupes: 0, delivered: 0 })
  const [fieldUp, setFieldUp] = useState(true)
  const [wanUp, setWanUp] = useState(true)
  const [replay, setReplay] = useState(true)
  const [idem, setIdem] = useState(true)
  const [sel, setSel] = useState('outbox')
  const [, force] = useState(0)
  const cfg = useRef({ fieldUp, wanUp, replay, idem })
  const prevWan = useRef(true)
  cfg.current = { fieldUp, wanUp, replay, idem }

  useEffect(() => {
    const id = window.setInterval(() => {
      const s = sim.current
      const c = cfg.current
      if (c.fieldUp) { s.seq++; s.queue.push(s.seq) }
      if (c.wanUp) {
        const batch: number[] = []
        if (!prevWan.current && c.replay && s.inflight !== null) batch.push(s.inflight) // ack lost while the link dropped
        while (batch.length < 4 && s.queue.length) batch.push(s.queue.shift()!)
        for (const q of batch) {
          if (c.idem && s.seen.has(q)) { s.dupes++; continue } // consumer detected and ignored it
          if (s.seen.has(q)) s.dupes++
          s.seen.add(q); s.stored.push(q); s.delivered++
        }
        if (batch.length) s.inflight = batch[batch.length - 1]
      }
      prevWan.current = c.wanUp
      force((f) => f + 1)
    }, 500)
    return () => window.clearInterval(id)
  }, [])

  const s = sim.current
  const stale = !fieldUp
  const uniqueStored = s.seen.size
  const dupStored = s.stored.length - uniqueStored
  const lost = s.seq - uniqueStored - s.queue.length

  const nodes = useMemo<Node<PlantData>[]>(() => {
    const at: [string, number, number, string][] = [
      ['field', 60, 640, '4–20 mA'], ['plc', 60, 510, 'scan 10 ms'], ['gw', 60, 380, 'poll + decode'],
      ['scada', 330, 380, ''], ['outbox', 60, 250, ''], ['broker', 60, 120, 'QoS 1'],
      ['hist', 330, 120, ''], ['erp', 330, -10, ''], ['agent', 60, -10, 'propose-only'],
    ]
    return at.map(([id, x, y, body]) => ({
      id, type: 'plant', position: { x, y },
      data: { id, body, selected: id === sel, down: (id === 'plc' || id === 'scada') && stale },
    }))
  }, [sel, stale])

  const edges = useMemo<Edge[]>(() => EDGES.map(([id, source, target, color, ss, ts]) => {
    const cut = (id === 'e2' && !fieldUp) || (id === 'e5' && !wanUp)
    const downstreamOfWan = ['e6', 'e7', 'e8'].includes(id) && !wanUp
    const upstreamField = ['e3', 'e4'].includes(id) && !fieldUp
    const active = !downstreamOfWan && !upstreamField && !(id === 'e1' && !fieldUp)
    return { id, source, target, sourceHandle: `${ss}-s`, targetHandle: `${ts}-t`, type: 'packet', data: { active, color, cut }, markerEnd: { type: MarkerType.ArrowClosed, color: cut ? 'var(--red)' : 'var(--line)' } }
  }), [fieldUp, wanUp])

  const onClick: NodeMouseHandler = (_, n) => setSel(n.id)
  const info = INFO[sel]

  return (
    <>
      <div className="panel">
        <div className="row">
          <button className={`btn small ${fieldUp ? 'on' : 'danger'}`} onClick={() => setFieldUp(!fieldUp)} aria-pressed={!fieldUp}>
            {fieldUp ? 'PLC ↔ gateway: up' : 'PLC ↔ gateway: CUT'}
          </button>
          <button className={`btn small ${wanUp ? 'on' : 'danger'}`} onClick={() => setWanUp(!wanUp)} aria-pressed={!wanUp}>
            {wanUp ? 'Plant → cloud link: up' : 'Plant → cloud link: CUT'}
          </button>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--muted)', fontSize: '.88rem' }}>
            <input type="checkbox" checked={replay} onChange={(e) => setReplay(e.target.checked)} style={{ accentColor: 'var(--accent)' }} /> replay last item on reconnect
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--muted)', fontSize: '.88rem' }}>
            <input type="checkbox" checked={idem} onChange={(e) => setIdem(e.target.checked)} style={{ accentColor: 'var(--accent)' }} /> idempotent consumer
          </label>
        </div>
      </div>

      <div className="flowbox">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodeClick={onClick}
          fitView fitViewOptions={{ padding: 0.08 }} onInit={(rf) => { window.setTimeout(() => rf.fitView({ padding: 0.08 }), 80) }} minZoom={0.3} nodesConnectable={false} proOptions={{ hideAttribution: true }}
          colorMode={theme}>
          <Background color="var(--line)" gap={24} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <div className="stats">
        <Stat k="Produced at gateway" n={s.seq} s={fieldUp ? 'records flowing' : 'no new data: SCADA is stale'} tone={fieldUp ? undefined : 'bad'} />
        <Stat k="Waiting in outbox" n={s.queue.length} tone={s.queue.length > 5 ? 'warn' : 'ok'} s={wanUp ? 'draining' : 'buffering, nothing lost'} />
        <Stat k="Unique records stored" n={uniqueStored} tone="ok" />
        <Stat k="Duplicate rows stored" n={dupStored} tone={dupStored ? 'bad' : 'ok'} s={`${s.dupes - dupStored} duplicates ignored`} />
        <Stat k="Records lost" n={Math.max(0, lost)} tone={lost > 0 ? 'bad' : 'ok'} />
      </div>

      <div className="panel" style={{ borderColor: info.color }}>
        <h3 style={{ color: info.color }}>{info.layer}</h3>
        <h4 style={{ marginBottom: 6 }}>{info.title}</h4>
        <p>{info.desc}</p>
        <p style={{ marginBottom: 6 }}><b>Protocols:</b> {info.protocols}</p>
        <p style={{ margin: 0 }}><b>Where it bites:</b> {info.failure}</p>
      </div>
      <div className="callout">
        Try: cut the cloud link for a few seconds, restore it, and turn <b>idempotent consumer</b> off. The replayed record becomes a duplicate row. The cure is a stable record ID (source, boot ID, sequence) and an upsert.
      </div>
    </>
  )
}
