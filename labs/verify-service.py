from urllib.request import Request, urlopen
from urllib.error import HTTPError
from pathlib import Path
import json, time, uuid

base = 'http://localhost:5088'
results=[]
def check(ok,name):
    assert ok,name
    results.append(name)
    print('PASS',name)
def request(path, body=None, headers=None):
    h={'Accept':'application/json, text/event-stream'}
    h.update(headers or {})
    data=None if body is None else json.dumps(body).encode()
    if data is not None: h['Content-Type']='application/json'
    with urlopen(Request(base+path,data=data,headers=h),timeout=10) as r:
        text=r.read().decode()
        if 'text/event-stream' in r.headers.get('Content-Type',''):
            return json.loads(next(line[6:] for line in text.splitlines() if line.startswith('data: ')))
        return json.loads(text) if text else None

init=request('/mcp',{'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'study-test','version':'1'}}})
check('result' in init,'MCP initialization')
listing=request('/mcp',{'jsonrpc':'2.0','id':2,'method':'tools/list','params':{}})
names={t['name'] for t in listing['result']['tools']}
check(names=={'get_machine_snapshot','get_recent_samples','propose_setpoint'},'Exact MCP tool allowlist')
snapshot_result=request('/mcp',{'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'get_machine_snapshot','arguments':{}}})
snap=json.loads(snapshot_result['result']['content'][0]['text'])
check(snap['quality']=='Good' and snap['sample']['simulated'],'MCP returns simulated quality and provenance')
args={'assetId':'tank-01','targetC':55,'evidenceSequence':snap['sample']['sequence'],'requestId':str(uuid.uuid4()),'reason':'Integration exercise'}
proposal_result=request('/mcp',{'jsonrpc':'2.0','id':4,'method':'tools/call','params':{'name':'propose_setpoint','arguments':args}})
proposal=json.loads(proposal_result['result']['content'][0]['text'])
check(proposal['executed'] is False and proposal['status']=='ProposedOnly','MCP proposal does not execute')
check(request('/api/snapshot')['sample']['setpointC']==60,'Setpoint remains unchanged')
request('/lab/link/false',{})
check(request('/api/snapshot')['quality']=='BadCommunication','HTTP fault injection changes quality')
bad=request('/mcp',{'jsonrpc':'2.0','id':5,'method':'tools/call','params':{'name':'propose_setpoint','arguments':{**args,'requestId':str(uuid.uuid4())}}})
check(bad['result'].get('isError',False),'MCP rejects proposal with bad current data')
request('/lab/link/true',{})
time.sleep(.4)
check(request('/api/snapshot')['quality']=='Good','Fresh acquisition restores quality')
try:
    request('/api/snapshot',headers={'Origin':'https://example.invalid'})
    raise AssertionError('Unexpected cross-origin access')
except HTTPError as e:
    check(e.code==403,'Browser Origin rejected')
(Path(__file__).resolve().parent/'service-results.json').write_text(json.dumps({'passed':len(results),'checks':results},indent=2))
