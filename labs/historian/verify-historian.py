"""Lab 7 checker: builds a throwaway SQLite historian from schema.sql and exercises queries.sql.
Run from any folder:  python labs/historian/verify-historian.py   (Python standard library only)
It writes only to a new temporary folder and deletes it afterwards."""
import sqlite3, re, os, tempfile, shutil
here=os.path.dirname(os.path.abspath(__file__))
d=tempfile.mkdtemp(prefix='historian-lab-')
db=os.path.join(d,'lab.db')
con=sqlite3.connect(db, isolation_level=None)
print('sqlite', sqlite3.sqlite_version)
schema=open(os.path.join(here,'schema.sql'),encoding='utf-8').read()
con.executescript(schema)
mode=con.execute('PRAGMA journal_mode').fetchone()[0]; assert mode=='wal',mode
q={m.group(1):m.group(2).strip() for m in re.finditer(r'-- (Q\d)[^\n]*\n(?:--[^\n]*\n)*(.*?)(?=\n-- Q\d|\Z)',open(os.path.join(here,'queries.sql'),encoding='utf-8').read(),re.S)}
assert len(q)==7, q.keys()
con.execute("INSERT INTO tag VALUES (1,'tank-01','temperature','degC',1)")
t0=1790726400000
rows=[]
seq=0
for i in range(4*3600):           # one hour at 4 Hz
    t=t0+i*250
    if 1200*4 <= i < 1230*4: continue          # 30 s outage: no rows
    seq+=1
    q_='BadSensor' if i%997==0 else 'Good'
    v=None if q_!='Good' else 25+35*(1-2.718**(-i/4/900)) + (6 if 2400*4<=i<2400*4+8 else 0)
    rows.append(dict(tag_key=1,receive_ms=t,source_ms=None,value=v,quality=q_,sequence=seq,boot_id='b1'))
con.execute('BEGIN'); con.executemany(q['Q1'],rows); con.execute('COMMIT')
n=con.execute('select count(*) from sample').fetchone()[0]
con.executemany(q['Q1'],rows[:10]); assert con.execute('select count(*) from sample').fetchone()[0]==n, 'replay duplicated'
print('rows',n,'replay ignored')
plan=con.execute('EXPLAIN QUERY PLAN '+q['Q2'],dict(tag_key=1,from_ms=t0,to_ms=t0+60000)).fetchall()
print('Q2 plan',plan); assert any('sample_by_time' in r[-1] for r in plan)
summ=con.execute(q['Q3'],dict(tag_key=1,from_ms=t0,to_ms=t0+3600000,expected_per_minute=240)).fetchall()
assert len(summ)==60
m20=[r for r in summ if r[0]==t0+20*60000][0]; print('minute 20',m20); assert m20[1]==120 and m20[2]==119
m40=[r for r in summ if r[0]==t0+40*60000][0]; print('minute 40 (excursion)',m40); assert m40[5]-m40[6] > 3
gaps=con.execute(q['Q4'],dict(tag_key=1,from_ms=t0,to_ms=t0+3600000,stale_ms=2000)).fetchall(); print('gaps',gaps); assert len(gaps)==1 and gaps[0][2]==30250
con.execute("INSERT INTO batch VALUES ('B17','tank-01','Running',0,NULL)")
p=dict(batch_id='B17',quantity=100,now_ms=t0+3600000)
def run_q5(params):
    for stmt in [x.strip() for x in re.sub(r'--[^\n]*','',q['Q5']).split(';') if x.strip()]:
        con.execute(stmt, {k:v for k,v in params.items() if ':'+k in stmt})
for _ in range(2): run_q5(p)
ob=con.execute('select event_id,payload_json from outbox').fetchall(); print('outbox',ob); assert len(ob)==1
# a completion of an unknown batch must not enqueue anything
p2=dict(batch_id='NOPE',quantity=5,now_ms=t0)
run_q5(p2)
assert con.execute('select count(*) from outbox').fetchone()[0]==1
pend=con.execute(q['Q6'],dict(now_ms=t0+3600000)).fetchall(); assert len(pend)==1
print('Q6 plan',con.execute('EXPLAIN QUERY PLAN '+q['Q6'],dict(now_ms=0)).fetchall())
deleted=0
while True:
    c=con.execute(q['Q7'],dict(tag_key=1,cutoff_ms=t0+1800000)).rowcount
    if c==0: break
    deleted+=c
print('retention deleted',deleted); assert con.execute('select min(receive_ms) from sample').fetchone()[0]>=t0+1800000
print('Q7 plan',con.execute('EXPLAIN QUERY PLAN '+q['Q7'],dict(tag_key=1,cutoff_ms=0)).fetchall())
con.close()
shutil.rmtree(d, ignore_errors=True)
print('ALL HISTORIAN CHECKS PASSED')
