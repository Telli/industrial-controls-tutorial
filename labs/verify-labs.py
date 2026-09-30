"""Live checks for the second-edition guided labs (alarms, disturbance, Modbus TCP device).

Start the simulator first, in another terminal:
    dotnet run --project ./labs/IndustrialLab -- --modbus
Then run:  python labs/verify-labs.py
Uses only the Python standard library. It changes simulated state only (disturbance,
link, Modbus fault switches) and restores each switch before it exits.
"""
import json, socket, struct, time, urllib.request, urllib.error
from pathlib import Path

BASE = 'http://localhost:5088'
results = []

def check(ok, name):
    assert ok, name
    results.append(name)
    print('PASS', name)

def http(path, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, method='GET' if body is None else 'POST',
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=5) as r:
        text = r.read().decode()
        return json.loads(text) if text else None

def fc03(sock, tid, unit=1, start=0, count=10):
    sock.sendall(struct.pack('>HHHBBHH', tid, 0, 6, unit, 3, start, count))
    head = recv_exact(sock, 6)
    rtid, pid, length = struct.unpack('>HHH', head)
    body = recv_exact(sock, length)
    return rtid, body

def recv_exact(sock, n):
    buf = b''
    while len(buf) < n:            # TCP is a byte stream: keep reading until the frame is complete
        part = sock.recv(n - len(buf))
        if not part:
            raise EOFError('peer closed')
        buf += part
    return buf

def registers(body):
    return list(struct.unpack('>' + 'H' * (body[2] // 2), body[3:]))

try:
    root = http('/')
    check(root['mode'] == 'SIMULATION ONLY' and root['modbus'].startswith('127.0.0.1:5502'), 'Service started with --modbus')

    with socket.create_connection(('127.0.0.1', 5502), timeout=3) as s:
        tid, body = fc03(s, 41)
        r = registers(body)
        check(tid == 41 and body[1] == 3 and len(r) == 10, 'FC03 reads the 10-register image')
        temp = struct.unpack('>f', struct.pack('>HH', r[0], r[1]))[0]
        setpoint = struct.unpack('>f', struct.pack('>HH', r[3], r[2]))[0]      # CDAB: low word first
        tenths = struct.unpack('>h', struct.pack('>H', r[7]))[0] / 10
        check(abs(setpoint - 60) < 1e-6, 'Setpoint decodes as 60.0 using CDAB')
        check(abs(temp - tenths) <= 0.051 and r[9] == 1 and r[4] & 0x8000, 'float32 and x10 temperatures agree; map v1; simulated bit')
        _, exc = fc03(s, 42, start=8, count=5)
        check(exc[1] == 0x83 and exc[2] == 0x02, 'Out-of-range read returns exception 02')
        hb1 = r[8]; time.sleep(0.6)
        check(registers(fc03(s, 43)[1])[8] != hb1, 'Heartbeat advances')
        http('/lab/modbus/freeze/true', {})
        a = registers(fc03(s, 44)[1])[8]; time.sleep(0.6); b = registers(fc03(s, 45)[1])[8]
        check(a == b, 'Frozen device answers with an unchanging heartbeat')
        http('/lab/modbus/freeze/false', {})
        http('/lab/link/false', {})
        s.settimeout(0.8)
        try:
            fc03(s, 46); timed_out = False
        except socket.timeout:
            timed_out = True
        check(timed_out, 'Pulled link: request receives no reply')
        http('/lab/link/true', {})

    alarms = http('/api/alarms')
    check(alarms['setC'] == 65 and alarms['clearC'] == 63 and isinstance(alarms['state'], str), 'Alarm endpoint reports limits and a named state')
    try:
        http('/lab/disturbance/99', {}); rejected = False
    except urllib.error.HTTPError as e:
        rejected = e.code == 400
    check(rejected, 'Disturbance range enforced')
finally:
    for path in ('/lab/modbus/freeze/false', '/lab/modbus/chunk/0', '/lab/link/true', '/lab/disturbance/0'):
        try: http(path, {})
        except Exception: pass

out = Path(__file__).with_name('lab-results.json')
out.write_text(json.dumps({'passed': results, 'count': len(results)}, indent=2))
print(f'All {len(results)} live lab checks passed. Saved {out.name}.')
