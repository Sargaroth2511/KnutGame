#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();
const BUS_DIR = path.join(ROOT, 'agent_bus');
const QUEUE_DIR = path.join(BUS_DIR, 'queue');
const PROCESSED_DIR = path.join(BUS_DIR, 'processed');
function ensureDirs(){for(const p of [BUS_DIR, QUEUE_DIR, PROCESSED_DIR]){ if(!fs.existsSync(p)) fs.mkdirSync(p,{recursive:true}); }}
function parseArgs(argv){const out={_:[]}; for(let i=2;i<argv.length;i++){const a=argv[i]; if(a.startsWith('--')){const [k,v]=a.includes('=')?a.slice(2).split('='):[a.slice(2), argv[i+1]]; out[k]=v===undefined?true:v; if(!a.includes('=')&&v!==undefined&&!v.startsWith('--')) i++;} else out._.push(a);} return out;}
function uuid(){return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);} 
function send({from,to,type,payload}){ensureDirs(); const id=uuid(); const msg={id, ts:new Date().toISOString(), from, to, type, payload}; const file=path.join(QUEUE_DIR, `${Date.now()}_${id}_${from}_to_${to}.json`); fs.writeFileSync(file, JSON.stringify(msg,null,2)); console.log(`Enqueued message ${id} -> ${to}: ${type}`);} 
function deliver(agent, file){const raw=fs.readFileSync(file,'utf8'); let msg; try{msg=JSON.parse(raw);}catch{console.error('Invalid JSON in',file); return;} if(!(msg.to===agent||msg.to==='*'||(Array.isArray(msg.to)&&msg.to.includes(agent)))) return; const inbox=path.join(BUS_DIR,'inbox',agent); fs.mkdirSync(inbox,{recursive:true}); const dest=path.join(inbox, path.basename(file)); fs.copyFileSync(file, dest); console.log(`[${agent}] received:`, msg.type, 'from', msg.from); const processedPath=path.join(PROCESSED_DIR, path.basename(file)); try{fs.renameSync(file, processedPath);}catch{} }
function watch(agent){ensureDirs(); console.log(`[${agent}] watching ${QUEUE_DIR} for messages...`); for(const f of fs.readdirSync(QUEUE_DIR)){ if(!f.endsWith('.json')) continue; deliver(agent, path.join(QUEUE_DIR,f)); } fs.watch(QUEUE_DIR, {persistent:true}, (event, filename)=>{ if(!filename||!filename.endsWith('.json')) return; const full=path.join(QUEUE_DIR, filename); setTimeout(()=>{ if(fs.existsSync(full)) deliver(agent, full); }, 30); }); }
(function main(){ const args=parseArgs(process.argv); const cmd=args._[0]; if(cmd==='send'){ const from=args.from||process.env.AGENT||'anonymous'; const to=args.to||'*'; const type=args.type||'note'; let payload={}; if(args['payload-file']){ payload=JSON.parse(fs.readFileSync(args['payload-file'],'utf8')); } else if(args.payload){ try{ payload=JSON.parse(args.payload);}catch{ payload={text:String(args.payload)}; } } return send({from,to,type,payload}); } if(cmd==='watch'){ const agent=args.agent||process.env.AGENT; if(!agent){ console.error('Provide --agent NAME or set AGENT env var'); process.exit(1);} watch(agent); setInterval(()=>{}, 1<<30); return; } console.log('Usage:
  node tools/agent-bus.js watch --agent NAME
  node tools/agent-bus.js send --from A --to B --type kind --payload "{\"k\":1}"'); })();
