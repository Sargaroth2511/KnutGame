#!/usr/bin/env node
// Emit bus messages on file changes (no external deps).
const fs = require('fs');
const path = require('path');

function parseArgs(argv){const out={_:[]}; for(let i=2;i<argv.length;i++){const a=argv[i]; if(a.startsWith('--')){const [k,v]=a.includes('=')?a.slice(2).split('='):[a.slice(2), argv[i+1]]; out[k]=v===undefined?true:v; if(!a.includes('=')&&v!==undefined&&!v.startsWith('--')) i++;} else out._.push(a);} return out;}

const ROOT=process.cwd();
const BUS_DIR=path.join(ROOT,'agent_bus');
const QUEUE_DIR=path.join(BUS_DIR,'queue');

function ensure(){ if(!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR,{recursive:true}); }
function uuid(){ return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8); }
function send({from,to,type,payload}){ ensure(); const id=uuid(); const msg={id, ts:new Date().toISOString(), from, to, type, payload}; const file=path.join(QUEUE_DIR, `${Date.now()}_${id}_${from}_to_${Array.isArray(to)?to.join('+'):to}.json`); fs.writeFileSync(file, JSON.stringify(msg,null,2)); console.log(`[emit] ${from} -> ${Array.isArray(to)?to.join(','):to}: ${type}`, payload.path); }

function watchDir(agent, dir, to, type){
  if(!fs.existsSync(dir)) { console.error('watch dir missing:', dir); return; }
  console.log(`[emit:${agent}] watching ${dir}`);
  const debounced = new Map();
  const debounceMs = 75;
  const onChange = (p)=>{
    const now=Date.now();
    const last=debounced.get(p)||0;
    if (now-last<debounceMs) return; debounced.set(p,now);
    send({from:agent,to,type,payload:{path:p}});
  };
  function walk(d){
    for(const f of fs.readdirSync(d)){
      const fp=path.join(d,f);
      try{
        const st=fs.statSync(fp);
        if(st.isDirectory()) walk(fp);
      }catch{}
    }
  }
  walk(dir);
  fs.watch(dir,{persistent:true,recursive:false},(event,filename)=>{
    if(!filename) return; const full=path.join(dir, filename); onChange(full);
  });
}

(function main(){
  const args=parseArgs(process.argv);
  const agent=args.agent||process.env.AGENT||'anonymous';
  const to=(args.to||'*').split(',');
  const type=args.type||'changed';
  const paths=args.paths? (Array.isArray(args.paths)?args.paths:[args.paths]) : args._;
  if(!paths||paths.length===0){
    console.log('Usage: node tools/agent-emit-on-change.js --agent NAME --to tester --type changed --paths src/KnutGame.Client/src src/KnutGame.Server');
    process.exit(1);
  }
  for(const p of paths){ watchDir(agent, path.resolve(p), to, type); }
  setInterval(()=>{}, 1<<30);
})();
