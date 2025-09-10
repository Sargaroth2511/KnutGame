#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
function parseArgs(argv){const out={_:[]}; for(let i=2;i<argv.length;i++){const a=argv[i]; if(a.startsWith('--')){const [k,v]=a.includes('=')?a.slice(2).split('='):[a.slice(2), argv[i+1]]; out[k]=v===undefined?true:v; if(!a.includes('=')&&v!==undefined&&!v.startsWith('--')) i++;} else out._.push(a);} return out;}
const ROOT=process.cwd();
const BUS_DIR=path.join(ROOT,'agent_bus');
const INBOX=(agent)=>path.join(BUS_DIR,'inbox',agent);
const PROCESSED=path.join(BUS_DIR,'processed');
const QUEUE=path.join(BUS_DIR,'queue');
function ensureDirs(agent){for(const p of [BUS_DIR, INBOX(agent), PROCESSED, QUEUE]){ if(!fs.existsSync(p)) fs.mkdirSync(p,{recursive:true}); }}
function readJson(file){try{ return JSON.parse(fs.readFileSync(file,'utf8')); }catch(e){ console.error('Invalid JSON:', file, e.message); return null; }}
function send(to,type,payload={},from='dispatcher'){ const id=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8); const msg={id, ts:new Date().toISOString(), from, to, type, payload}; const file=path.join(QUEUE, `${Date.now()}_${id}_${from}_to_${Array.isArray(to)?to.join('+'):to}.json`); fs.writeFileSync(file, JSON.stringify(msg,null,2)); console.log(`[bus] ${from} -> ${Array.isArray(to)?to.join(','):to}: ${type}`);} 
function run(cmd,opts={}){ return new Promise((resolve)=>{ const p=exec(cmd,{cwd:ROOT, maxBuffer:10*1024*1024, ...opts},(err,stdout,stderr)=>{ resolve({code: err? (err.code??1):0, stdout, stderr});}); p.stdout?.pipe(process.stdout); p.stderr?.pipe(process.stderr); }); }
async function handle(agent,msg){ const role=agent; const t=msg.type; const pl=msg.payload||{}; if(role==='tester'){ if(t==='ready_for_test'||t==='request_test'){ console.log('[tester] Running tests…'); const server=await run('dotnet test -v minimal'); const client=await run('npm -C src/KnutGame.Client run -s test:run'); send(pl.notify||['supervisor','feature-dev'],'test_results',{ ok: server.code===0 && client.code===0, server: server.code, client: client.code }, 'tester'); return; } }
 if(role==='feature-dev'){ if(t==='assign'){ console.log('[feature-dev] Assignment received:', pl.story||msg); return; } if(t==='review_feedback'){ console.log('[feature-dev] Review feedback:', pl); return; } }
 if(role==='physics'){ if(t==='perf_review_request'){ console.log('[physics] Perf review requested:', pl); return; } }
 if(role==='refactor'){ if(t==='refactor_request'){ console.log('[refactor] Refactor request:', pl); return; } }
 if(role==='supervisor'){ if(t==='test_results'||t==='status'){ console.log('[supervisor]', t, pl); return; } }
 console.log(`[${role}] Unhandled message type:`, t, 'payload:', pl); }
function moveProcessed(file){ try{ const dest=path.join(PROCESSED, path.basename(file)); fs.renameSync(file, dest);}catch{} }
function watch(agent){ const inbox=INBOX(agent); ensureDirs(agent); console.log(`[dispatcher:${agent}] watching ${inbox}`); for(const f of fs.readdirSync(inbox)){ if(!f.endsWith('.json')) continue; const full=path.join(inbox,f); const msg=readJson(full); if(msg) handle(agent,msg).finally(()=>moveProcessed(full)); } fs.watch(inbox,{persistent:true},(event,filename)=>{ if(!filename||!filename.endsWith('.json')) return; const full=path.join(inbox,filename); setTimeout(()=>{ if(!fs.existsSync(full)) return; const msg=readJson(full); if(!msg) return; handle(agent,msg).finally(()=>moveProcessed(full)); },25); }); setInterval(()=>{}, 1<<30); }
(function main(){ const args=parseArgs(process.argv); const agent=args.agent||process.env.AGENT; if(!agent){ console.error('Provide --agent NAME or set AGENT env var'); process.exit(1);} watch(agent); })();
