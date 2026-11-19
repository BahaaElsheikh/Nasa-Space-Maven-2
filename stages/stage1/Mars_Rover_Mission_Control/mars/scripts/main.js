'use strict';
/* ================= CENTRAL CONFIG (all simulation assumptions live here) ================= */
const CFG = {
  TIMESCALE: 60,            // simulated seconds per real second during driving / waiting
  CHARGE_TIMESCALE: 360,    // solar charging runs fast-forwarded
  CELL_M: 2,                // metres per map cell
  SPEED_MPS: 0.055,         // rover cruise speed (assumption)
  TURN_DEG_PER_SIMS: 1.5,
  BATTERY_WH: {batteryS:150, batteryM:250, batteryL:400, none:60}, // ASSUMPTION: designer gives no capacity
  BATTERY_V: 28, RESERVE_FRAC: 0.05, CHARGE_EFF: 0.92, MAX_CHARGE_W: 150,
  SOLAR_W: {solar:140, hybrid:90}, RTG_W: {rtg:60, hybrid:40},      // ASSUMPTIONS
  STANDBY_W: 8, STANDBY_LOW_W: 4, COMM_TX_W: 6, OP_OVERHEAD_W: 5,    // ASSUMPTIONS (computer/radio not in designer)
  DRIVE_BASE_W: 60, DRIVE_W_PER_KG: 0.35, LOWPOWER_DRIVE: 0.5, LOWPOWER_SPEED: 0.7,
  TEMP_K: {none:0.004, thermal:0.002, thermalPlus:0.0012, heater:0.002}, TEMP_C: 0.00625,
  COLD_WARN: -25, HOT_WARN: 55,
  WHEEL_PEN: {smooth:1, cleated:.8, mesh:.85}, WHEEL_CFG_PEN: {wheels4:1, wheels6:.85, rocker:.7},
  U: 0.36,                  // cells per designer unit (rover drawing scale)
  COMM_DELAY_S: [1.2, 1.8, 2.4] // game-model uplink delay per map (real seconds), NOT Earth-Mars light time
};
const MAPS = [
  {name:'Basic Navigation', tag:'Easy', cls:'easy', W:30,H:22, rocks:7, craters:1, targets:1, sand:0, walls:0, hazards:0, storm:false, sun:.9, amb:-45, shade:0, seed:11,
   brief:'Drive to the landing pad and analyze the marked outcrop.'},
  {name:'Obstacle Navigation', tag:'Medium', cls:'med', W:38,H:28, rocks:15, craters:3, targets:2, sand:3, walls:1, hazards:0, storm:false, sun:.85, amb:-55, shade:2, seed:22,
   brief:'Find the gap in the ridge, analyze 2 targets, then reach the pad. Shaded areas cut solar power.'},
  {name:'Advanced Exploration', tag:'Hard', cls:'hard', W:46,H:34, rocks:24, craters:5, targets:3, sand:5, walls:2, hazards:2, storm:true, sun:.8, amb:-65, shade:3, seed:33,
   brief:'Dust devils patrol the field and dust storms cut sunlight and sensor range. Use WAIT and sensors.'}
];
const IMG = {}; ['rock1','rock2','rock3','rockgrey','rockorange','crystal','crystal2','crater_s','crater_l','dome_closed','dome_open','sand1','sand2','sand3','hazard','pad','pad_glow'].forEach(k=>{IMG[k]=new Image();IMG[k].src='assets/'+k+'.png'});
IMG.ground=new Image();IMG.ground.src='assets/ground.jpg';

/* ================= helpers ================= */
const $=id=>document.getElementById(id), clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), rad=d=>d*Math.PI/180;
function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const fmt=(v,d=1)=>(+v).toFixed(d);

/* ================= rover import (rover-import) ================= */
let ROVER=null;
function normalizeRover(obj){
  if(!obj||!Array.isArray(obj.parts))throw new Error('Not a rover file (missing "parts").');
  const parts=obj.parts.map(p=>({section:p.section,name:p.name,type:p.type,mass:+p.mass||0,watts:+p.watts||0}));
  if(!parts.some(p=>p.section==='chassis'))throw new Error('Rover has no chassis.');
  return buildRover(obj.name||'Unnamed Rover',parts);
}
function parseReport(txt){
  const name=(txt.match(/Rover name:\s*(.*)/)||[])[1]||'Imported Rover', parts=[];
  txt.split('\n').forEach(l=>{const m=l.match(/^(\w+):\s*(.+?)\s+—/);if(m){const c=CATALOG.find(c=>c[0]===m[1]&&c[1]===m[2]);if(c)parts.push({section:c[0],name:c[1],type:c[2],mass:c[3],watts:c[4]})}});
  return normalizeRover({name,parts});
}
function buildRover(name,parts){
  const sec=s=>parts.filter(p=>p.section===s), one=s=>sec(s)[0], ty=t=>parts.some(p=>p.type===t);
  const types=new Set(parts.map(p=>p.type)), chassis=one('chassis'), wheels=one('wheels'), wt=one('wheeltype'), power=one('power'), bat=one('battery'), th=one('thermal');
  const sizes={Small:[1.5,.42,1.1],Medium:[1.9,.5,1.3],Large:[2.3,.58,1.55]};
  const size=sizes[(chassis.name.split(' ')[0])]||sizes.Medium;
  const hasSolar=!!power&&(power.type==='solar'||power.type==='hybrid');
  const halfLen=Math.max(size[0]/2,wheels?1.05+.36:.9,hasSolar?1.9:0,(parts.some(p=>p.type==='arm')?1.8:0));
  const r=Math.max(.42,halfLen*CFG.U*.8);
  const cams=parts.filter(p=>p.section==='cameras'), sci=parts.filter(p=>p.section==='science'||p.section==='water');
  const has=(...t)=>t.some(x=>types.has(x));
  const sw=parts.filter(p=>p.watts>=3&&!['chassis','wheels','wheeltype','power','battery','cameras'].includes(p.section)&&p.section!=='tools'&&p.section!=='arm'&&p.section!=='samples'||p.type==='heater').filter((p,i,a)=>a.indexOf(p)===i);
  return {name,parts,types,mass:parts.reduce((a,p)=>a+p.mass,0),size,wheels,wt,power,bat,th,hasSolar,hasRtg:!!power&&(power.type==='rtg'||power.type==='hybrid'),radius:r,
    nWheels:!wheels?0:wheels.type==='wheels4'?4:6, cams, sci, has, switchables:sw,
    capWh:CFG.BATTERY_WH[bat?bat.type:'none'], batAssumed:!bat,
    kTherm:CFG.TEMP_K[th?th.type:'none'],
    wheelPen:(wt?CFG.WHEEL_PEN[wt.type]:1)*(wheels?CFG.WHEEL_CFG_PEN[wheels.type]:1.2),
    colors:{body:'#d8c5a6',dark:'#38243f',metal:'#9a8790',gold:'#f2a35f',blue:'#315d78',glass:'#70d7ce',white:'#f4dfbd',orange:'#d65b45'}};
}
function loadRoverFromText(txt){
  txt=txt.trim(); ROVER=txt[0]==='{'?normalizeRover(JSON.parse(txt)):parseReport(txt);
  try{localStorage.setItem('marsRoverDesign',JSON.stringify({schema:'mars-rover-v1',name:ROVER.name,parts:ROVER.parts}))}catch(e){}
  $('roverName').textContent='Rover: '+ROVER.name; buildPalette(); startMission(M.idx,false); closeModal();
}

/* ================= commands (command-system) ================= */
const CATS={mv:'Movement',ob:'Observation & Sensors',en:'Energy & Systems',sc:'Scientific Operations'};
const R=()=>ROVER, anyCam=()=>R().cams.length>0;
const CMDS={
 fwd:{c:'mv',l:'Move Forward',p:[{k:'n',l:'cells',d:5,min:1,max:30}],desc:'Drive forward N cells (1 cell = 2 m).'},
 back:{c:'mv',l:'Move Backward',p:[{k:'n',l:'cells',d:3,min:1,max:15}],desc:'Reverse N cells.'},
 left:{c:'mv',l:'Turn Left',p:[{k:'n',l:'deg',d:90,min:5,max:180}],desc:'Rotate counter-clockwise.'},
 right:{c:'mv',l:'Turn Right',p:[{k:'n',l:'deg',d:90,min:5,max:180}],desc:'Rotate clockwise.'},
 stop:{c:'mv',l:'Stop',p:[],desc:'Halt and hold position briefly.'},
 wait:{c:'mv',l:'Wait',p:[{k:'n',l:'min',d:5,min:1,max:60}],desc:'Stand by. Standby power still drains (or RTG recharges).'},
 scan:{c:'ob',l:'Scan Surroundings',p:[],desc:'Report obstacles and features within ~6 cells.',req:()=>R().cams.length||R().has('radar','radarHydro','weather')?null:'Needs a camera, radar or weather station'},
 measure:{c:'ob',l:'Measure Distance',p:[],desc:'Distance to the nearest obstacle straight ahead.',req:()=>R().has('navcam','hazcam','radar','radarHydro')?null:'Needs Navcam, Hazcam or Radar'},
 detect:{c:'ob',l:'Detect Obstacles',p:[],desc:'Check a 50° cone ahead for rocks, craters and moving hazards.',req:()=>R().has('navcam','hazcam','radar','radarHydro','seismic')?null:'Needs Navcam, Hazcam, Radar or Seismic sensor'},
 terrain:{c:'ob',l:'Analyze Terrain',p:[],desc:'Report surface type and traction under the rover.',req:()=>R().has('soil','spectrometer','mineral','sampler','mahli','radar','radarHydro','hydrogen')?null:'Needs a soil/mineral instrument, MAHLI or radar'},
 image:{c:'ob',l:'Capture Image',p:[],desc:'Take a photo (logged).',req:()=>anyCam()?null:'Needs a camera'},
 battery:{c:'en',l:'Check Battery',p:[],desc:'Log the battery state.'},
 solar:{c:'en',l:'Solar Charging',p:[{k:'n',l:'min',d:10,min:1,max:60}],desc:'Stop and charge from the panels (fast-forwarded).',req:()=>R().hasSolar?null:'Rover has no solar panels'},
 lowp:{c:'en',l:'Low-Power Mode',p:[{k:'m',l:'mode',sel:['On','Off'],d:'On'}],desc:'Slower driving at lower motor power; lower standby draw.'},
 sysOn:{c:'en',l:'Activate System',p:[{k:'s',l:'system',sys:1}],desc:'Switch on a supported system (draws power while on).',req:()=>R().switchables.length?null:'No switchable systems installed'},
 sysOff:{c:'en',l:'Deactivate System',p:[{k:'s',l:'system',sys:1}],desc:'Switch a system off.',req:()=>R().switchables.length?null:'No switchable systems installed'},
 scanT:{c:'sc',l:'Scan Target',p:[],desc:'Identify a science target within 2.6 cells.',req:()=>anyCam()||R().sci.length?null:'Needs a camera or instrument'},
 analyze:{c:'sc',l:'Analyze Sample',p:[],desc:'Analyze a scanned target in range.',req:()=>R().sci.length?null:'Needs a science/water instrument'},
 record:{c:'sc',l:'Record Observation',p:[],desc:'Log the finding for an analyzed target.'},
 collect:{c:'sc',l:'Collect Sample',p:[],desc:'Collect from an analyzed target (arm tool + storage).',req:()=>R().has('arm')&&R().has('gripper','scoop','drill','abrader')&&R().parts.some(p=>p.section==='samples')?null:'Needs arm + tool + sample storage'}
};
function cmdReason(c){const d=CMDS[c.type];if(d.req){const r=d.req();if(r)return r}
  for(const p of d.p){const v=c.p[p.k];if(p.min!==undefined&&(!(v>=p.min)||v>p.max))return `${p.l} must be ${p.min}–${p.max}`;if(p.sys&&!R().switchables.some(s=>s.name===v))return 'Choose a supported system'}return null}

/* ================= state ================= */
const M={idx:0,seed:0,cur:null,done:[false,false,false]};
let S=null;          // mission state
let program=[];      // [{id,type,p,status,msg}]
let nextId=1, view={zoom:.9,cx:0,cy:0,follow:true,showTraj:true}, selLog=[], predicted=null, drag=null;

/* ================= map generator (map-generator) ================= */
function genMap(def,seed,rv){
  const R_=rv.radius, margin=R_+.3;
  for(let attempt=0;attempt<80;attempt++){
    const r=rng(seed+attempt*977), W=def.W,H=def.H, obs=[], free=(x,y,rr,pad=.25)=>obs.every(o=>Math.hypot(o.x-x,o.y-y)>o.r+rr+pad);
    const start={x:3.6,y:H/2}, goal={x:W-4.2,y:H*.3+r()*H*.4}, targets=[], sand=[], hazards=[], shade=[];
    const keepOut=[start,goal];
    // ridge walls with a gap
    for(let k=0;k<def.walls;k++){const wx=W*(def.walls===1?.5:k?.7:.34)+(r()-.5)*2,gy=3+r()*(H-6),gap=Math.max(2*R_+1.2,2.8);
      for(let y=.8;y<H;y+=1.15){if(Math.abs(y-gy)<gap/2)continue;obs.push({x:wx+Math.sin(y*1.3)*.35,y,r:.62,k:'rock',s:['rock1','rock2','rock3'][(y*7|0)%3]})}}
    for(let i=0;i<def.targets;i++){for(let t=0;t<60;t++){const x=W*(.25+.55*(i+r()*.6)/def.targets),y=3+r()*(H-6);
        if(free(x,y,1.2)&&Math.hypot(x-start.x,y-start.y)>7&&Math.hypot(x-goal.x,y-goal.y)>5){const kind=['crystal','rock','crater'][(i+(r()*3|0))%3];targets.push({x,y,kind,r:.5,scanned:false,analyzed:false,recorded:false,collected:false,name:kind==='crystal'?'Crystal formation':kind==='rock'?'Rock outcrop':'Soil patch',id:i+1});obs.push({x,y,r:.5,k:'target',s:kind});break}}}
    const addObs=(n,kind)=>{for(let i=0;i<n;i++)for(let t=0;t<50;t++){const rr=kind==='crater'?1.15:.55+r()*.35,x=2+r()*(W-4),y=1.5+r()*(H-3);
        if(free(x,y,rr,.5)&&Math.hypot(x-start.x,y-start.y)>rr+4&&Math.hypot(x-goal.x,y-goal.y)>rr+3){obs.push({x,y,r:rr,k:kind,s:kind==='crater'?'crater_l':['rock1','rock2','rock3','rockgrey','rockorange'][r()*5|0]});break}}};
    addObs(def.rocks,'rock');addObs(def.craters,'crater');
    for(let i=0;i<def.sand;i++)sand.push({x:5+r()*(W-12),y:2+r()*(H-8),w:4+r()*2,h:4+r()*2,s:'sand'+(1+i%3)});
    for(let i=0;i<def.shade;i++)shade.push({x:6+r()*(W-12),y:3+r()*(H-6),rx:3+r()*2,ry:2+r()*1.5});
    for(let i=0;i<def.hazards;i++){const hy=4+r()*(H-8),hx=W*(.3+.4*i)+r()*3,L=5+r()*3,vert=i%2===0;
      hazards.push({a:vert?[hx,clamp(hy-L,2,H-2)]:[hx-L,hy],b:vert?[hx,clamp(hy+L,2,H-2)]:[hx+L,hy],spd:.9+r()*.5,r:1.0,ph:r()*10})}
    if(hazards.some(h=>[start,goal,...targets].some(p=>distSeg(p,h)<h.r+R_+2.5)))continue;
    const m={def,W,H,obs,start,goal,targets,sand,hazards,shade,seed:seed+attempt*977};
    const route=checkSolvable(m,R_);if(!route)continue;m.routeCells=route;return m;
  }
  throw new Error('Map generation failed');
}
function distSeg(p,h){const [x1,y1]=h.a,[x2,y2]=h.b,dx=x2-x1,dy=y2-y1,t=clamp(((p.x-x1)*dx+(p.y-y1)*dy)/(dx*dx+dy*dy),0,1);return Math.hypot(p.x-(x1+dx*t),p.y-(y1+dy*t))}
function blockedAt(m,x,y,R_){if(x<R_||y<R_||x>m.W-R_||y>m.H-R_)return true;return m.obs.some(o=>Math.hypot(o.x-x,o.y-y)<o.r+R_+.05)}
function checkSolvable(m,R_){ // A* on a 0.5-cell grid through start -> targets -> goal; returns path length in cells
  const res=.5,gw=Math.floor(m.W/res),gh=Math.floor(m.H/res),sol=m.obs.filter(o=>o.k!=='target');
  const blocked=new Uint8Array(gw*gh);
  for(let j=0;j<gh;j++)for(let i=0;i<gw;i++){const x=i*res+res/2,y=j*res+res/2;blocked[j*gw+i]=(x<R_||y<R_||x>m.W-R_||y>m.H-R_||sol.some(o=>Math.hypot(o.x-x,o.y-y)<o.r+R_+.1))?1:0}
  const cell=p=>[clamp(Math.floor(p.x/res),0,gw-1),clamp(Math.floor(p.y/res),0,gh-1)];
  function astar(a,b){const key=(i,j)=>j*gw+i,g=new Float32Array(gw*gh).fill(1e9),open=[[0,a[0],a[1]]];g[key(a[0],a[1])]=0;
    while(open.length){let bi=0;for(let q=1;q<open.length;q++)if(open[q][0]<open[bi][0])bi=q;const [,i,j]=open.splice(bi,1)[0];
      if(i===b[0]&&j===b[1])return g[key(i,j)]*res;
      for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){if(!di&&!dj)continue;const ni=i+di,nj=j+dj;if(ni<0||nj<0||ni>=gw||nj>=gh||blocked[key(ni,nj)])continue;
        if(di&&dj&&(blocked[key(i+di,j)]||blocked[key(i,j+dj)]))continue;const ng=g[key(i,j)]+(di&&dj?1.414:1);if(ng<g[key(ni,nj)]){g[key(ni,nj)]=ng;open.push([ng+Math.hypot(b[0]-ni,b[1]-nj),ni,nj])}}}return null}
  function approach(t){let best=null,bd=1e9;for(let j=0;j<gh;j++)for(let i=0;i<gw;i++){if(blocked[j*gw+i])continue;const d=Math.hypot(i*res+res/2-t.x,j*res+res/2-t.y);if(d<2.2&&d>t.r+R_*.6&&d<bd){bd=d;best=[i,j]}}return best}
  let pts=[cell(m.start)];for(const t of m.targets){const ap=approach(t);if(!ap)return null;pts.push(ap)}pts.push(cell(m.goal));
  if(blocked[pts[0][1]*gw+pts[0][0]]||blocked[pts[pts.length-1][1]*gw+pts[pts.length-1][0]])return null;
  let total=0;for(let i=0;i<pts.length-1;i++){const d=astar(pts[i],pts[i+1]);if(d==null)return null;total+=d}return total}

/* ================= mission / simulation state ================= */
function newState(){
  const m=M.cur,rv=R();
  return {t:0,sim:0,E:rv.capWh*.95,gen:0,used:0,solarGen:0,collisions:0,cmds:0,images:0,
    rover:{x:m.start.x,y:m.start.y,h:0,v:0,w:0,bob:0,wl:0,wr:0,tilt:0},trail:[[m.start.x,m.start.y]],
    temp:m.def.amb+35,lowp:false,active:new Set(),tx:0,charging:false,storm:0,known:new Set(),
    status:'idle',pc:0,act:null,fail:null,pauseF:false,stepOnly:false,uplink:0,commState:'Link idle',
    lastMeasure:null,lowWarned:false,critWarned:false,tempWarned:false,discoveries:[],hazardSeen:false,sunNow:m.def.sun};
}
function startMission(idx,newLayout){
  M.idx=idx; const def=MAPS[idx]; if(newLayout||!M.seed||M.lastIdx!==idx)M.seed=def.seed+(newLayout?(Math.random()*1e6|0):0);
  M.lastIdx=idx; M.cur=genMap(def,M.seed,R()); S=newState(); selLog=[];
  program.forEach(c=>{c.status='';c.msg=''}); predicted=null; closeModal();
  const d=Math.max(M.cur.W,M.cur.H); fitView(); view.zoom=Math.min(view.zoom*1.6,2.2); view.follow=true; $('bFollow').classList.add('on');
  const need=estimateEnergy(); log('ok',`Mission ${idx+1}: ${def.name} loaded. Layout seed ${M.cur.seed}.`);
  log('info',`Planning aid: shortest safe route ≈ ${fmt(M.cur.routeCells,0)} cells ≈ ${fmt(need,0)} Wh of driving. Usable battery ${fmt(R().capWh*(1-CFG.RESERVE_FRAC),0)} Wh.`);
  buildMaps(); renderProgram(); recomputePredicted(); updateUI(); showTipFor(idx);
}
function driveW(){const rv=R();return (CFG.DRIVE_BASE_W+CFG.DRIVE_W_PER_KG*rv.mass)*(S&&S.lowp?CFG.LOWPOWER_DRIVE:1)}
function estimateEnergy(){const rv=R(),cellsT=CFG.CELL_M/CFG.SPEED_MPS;return M.cur.routeCells*(CFG.DRIVE_BASE_W+CFG.DRIVE_W_PER_KG*rv.mass)*cellsT/3600}
const reserve=()=>R().capWh*CFG.RESERVE_FRAC;
function terrainAt(x,y){const m=M.cur;for(const s of m.sand)if(x>s.x&&x<s.x+s.w&&y>s.y&&y<s.y+s.h)return 'loose';return 'packed'}
function shadeAt(x,y){const m=M.cur;for(const s of m.shade)if(((x-s.x)/s.rx)**2+((y-s.y)/s.ry)**2<1)return .3;return 1}
function stormAt(t){if(!M.cur.def.storm)return 0;return clamp(Math.sin(t*2*Math.PI/75+.8)*1.4-.2,0,1)}
function hazardPos(h,t){const L=Math.hypot(h.b[0]-h.a[0],h.b[1]-h.a[1]),p=((t*h.spd+h.ph)%(2*L)),q=p<L?p:2*L-p,f=q/L;return {x:h.a[0]+(h.b[0]-h.a[0])*f,y:h.a[1]+(h.b[1]-h.a[1])*f}}

/* ================= execution engine (programming-engine) ================= */
function log(type,msg){const e={type,msg,t:S?S.sim:0};selLog.push(e);if(selLog.length>400)selLog.shift();const L=$('log');if(L){const d=document.createElement('div');d.className='le '+type;d.textContent=`[${fmtT(e.t)}] ${msg}`;L.appendChild(d);L.scrollTop=L.scrollHeight}}
function fmtT(s){s=Math.floor(s);return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s%3600/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
function validateAll(){for(const c of program){const r=cmdReason(c);c.inv=r;}return program.find(c=>c.inv)}
function runProgram(step){
  if(S.status==='running'||S.status==='uplink'||S.status==='paused'){return}
  if(S.status==='done'||S.status==='failed')resetRun();
  if(!program.length){flash('Program is empty. Click command labels to add them.');return}
  const bad=validateAll();renderProgram();if(bad){flash('Fix the highlighted command: '+bad.inv);return}
  program.forEach(c=>{c.status='queued';c.msg=''});
  S.pc=0;S.stepOnly=!!step;S.status='uplink';S.uplink=CFG.COMM_DELAY_S[M.idx]*(step?.5:1);S.commState='Uplink in progress';
  log('info',step?'Step: sending next command…':`Program uplink started (${program.length} commands, game delay ${fmt(S.uplink)} s).`);renderProgram();
}
function stepProgram(){ // execute exactly one command, then pause
  if(S.status==='paused'&&S.act){S.pauseF=false;S.status='running';S.stepOnly=true;return}
  if(S.status==='running'||S.status==='uplink')return;
  if(S.status==='done'||S.status==='failed'){resetRun()}
  if(S.status==='idle'&&S.pc===0&&!program.some(c=>c.status==='done')){const bad=validateAll();renderProgram();if(bad){flash('Fix the highlighted command: '+bad.inv);return}program.forEach(c=>{c.status='queued'})}
  if(S.pc>=program.length){flash('End of program');return}
  S.stepOnly=true;S.status='uplink';S.uplink=CFG.COMM_DELAY_S[M.idx]*.5;S.commState='Uplink (step)';renderProgram();
}
function resetRun(){S=Object.assign(newState(),{});program.forEach(c=>{c.status='';c.msg=''});$('log').innerHTML='';selLog=[];log('info','Rover reset to start. Program preserved.');recomputePredicted();renderProgram();updateUI()}
function beginCommand(){
  const c=program[S.pc];if(!c){return finishProgram()}
  c.status='executing';S.cmds++;S.act=makeAction(c);S.commState='Command received';S.tx=.4;log('info',`#${S.pc+1} ${CMDS[c.type].l} ${Object.values(c.p).join(' ')} — executing`);renderProgram();
}
function endCommand(ok,reason){
  const c=program[S.pc];if(!c)return;
  if(!ok){c.status='error';c.msg=reason;return}
  c.status='done';S.act=null;S.pc++;S.tx=.4;S.commState='Confirmation downlinked';
  if(S.pc>=program.length)finishProgram();
  else if(S.stepOnly){S.status='idle';S.stepOnly=false;S.commState='Link idle';}
  else beginCommand();
  renderProgram();
}
function finishProgram(){
  S.act=null;S.status='done';S.commState='Link idle';
  const need=missionState();
  if(need.ok)return;
  failMission('Target not reached',`The program finished but the mission is incomplete: ${need.missing.join('; ')}.`,'Add the missing steps (or re-plan the route) and retry.',null);
}
function missionState(){const m=M.cur,miss=[];const d=Math.hypot(S.rover.x-m.goal.x,S.rover.y-m.goal.y);
  if(d>1.3)miss.push(`rover is ${fmt(d)} cells from the landing pad (needs ≤1.3)`);
  m.targets.forEach(t=>{if(!t.analyzed)miss.push(`target ${t.id} (${t.name}) not analyzed`)});return {ok:!miss.length,missing:miss}}
function failMission(title,cause,advice,cmdIndex){
  if(S.status==='failed'||S.status==='won')return;
  S.status='failed';S.act=null;S.v=0;S.rover.v=0;S.fail={title,cause};
  if(cmdIndex!=null&&program[cmdIndex]){program[cmdIndex].status='error';program[cmdIndex].msg=cause}
  log('error',`MISSION FAILED — ${title}: ${cause}`);renderProgram();
  const card=$('card');card.className='card bad';
  card.innerHTML=`<h2>MISSION FAILED</h2><p><b>${title}</b></p><p>${cause}</p><p class="ok">➜ ${advice}</p>${statsHtml()}
   <p class="mut">Your rover and your whole program are preserved. Edit the program, then retry.</p>
   <div class="btns"><button id="mReview">Review & edit</button><button id="mSame">Retry same map</button><button id="mNew">Retry new map</button></div>`;
  openModal();$('mReview').onclick=()=>{resetRunKeepLog();closeModal()};$('mSame').onclick=()=>startMission(M.idx,false);$('mNew').onclick=()=>startMission(M.idx,true);
}
function resetRunKeepLog(){const old=selLog.slice();S=newState();program.forEach(c=>{if(c.status!=='error')c.status='';});selLog=old;recomputePredicted();renderProgram();updateUI()}
function winMission(){
  S.status='won';S.act=null;M.done[M.idx]=true;buildMaps();log('ok','MISSION COMPLETE — landing pad reached and all targets analyzed.');
  const card=$('card');card.className='card good';
  const score=Math.max(0,Math.round(1000-S.used*2-S.collisions*100-program.length*5+(S.E/R().capWh)*300));
  card.innerHTML=`<h2>VICTORY — ${MAPS[M.idx].name}</h2><p>The mission objectives are complete! You are ready to advance to Stage 2.</p>${statsHtml()}<p>Efficiency score: <b>${score}</b></p>
   <div class="btns">
     <button id="vStage2" style="background:#00F0FF;color:#070B14;font-weight:bold;border:2px solid #00F0FF;padding:7px 16px;border-radius:4px;box-shadow:0 0 12px rgba(0,240,255,0.4);">PROCEED TO STAGE 2 ▶</button>
     <button id="vNext">Play another map</button>
     <button id="vSame">Replay this map</button>
     <button id="vClose">Close</button>
   </div>`;
  openModal();
  $('vNext').onclick=()=>startMission((M.idx+1)%3,true);
  $('vSame').onclick=()=>startMission(M.idx,true);
  $('vClose').onclick=closeModal;
  if ($('vStage2')) {
    $('vStage2').onclick=()=>{
      const normScore = Math.min(100, Math.max(50, Math.round(score / 10)));
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'STAGE_COMPLETE',
          stage: 1,
          score: normScore,
          result: {
            roverConfiguration: 'mission_stage1_rover',
            score: normScore
          }
        }, '*');
      } else {
        window.location.href = '../../stage2/mission_failed_level_2.html';
      }
    };
  }
}
function statsHtml(){const m=M.cur,rv=R();
  return `<div class="kv"><span>Battery left</span><span>${fmt(S.E)} Wh (${fmt(S.E/rv.capWh*100,0)}%)</span><span>Energy consumed</span><span>${fmt(S.used)} Wh</span><span>Solar/RTG generated</span><span>${fmt(S.gen)} Wh (solar ${fmt(S.solarGen)})</span><span>Commands executed</span><span>${S.cmds}</span><span>Collisions</span><span>${S.collisions}</span><span>Mission time</span><span>${fmtT(S.sim)}</span><span>Targets analyzed</span><span>${m.targets.filter(t=>t.analyzed).length}/${m.targets.length}</span><span>Temperature</span><span>${fmt(S.temp,0)} °C</span></div>`}

function nearestTarget(pred){const m=M.cur,r=S.rover;let best=null,bd=1e9;for(const t of m.targets){const d=Math.hypot(t.x-r.x,t.y-r.y);if(pred(t)&&d<bd){bd=d;best=t}}return {t:best,d:bd}}
function opPower(parts){return parts.reduce((a,p)=>a+p.watts,0)+CFG.OP_OVERHEAD_W}
function makeAction(c){
  const rv=R(),r=S.rover,A={c,f:0,real:1,sim:30,P:CFG.OP_OVERHEAD_W,eq:null,kind:'timed',done:()=>{}};
  const camsW=opPower(rv.cams.concat(rv.parts.filter(p=>['radar','radarHydro','weather'].includes(p.type))));
  switch(c.type){
  case 'fwd':case 'back':A.kind='move';A.dir=c.type==='fwd'?1:-1;A.rem=c.p.n;A.speed=0;break;
  case 'left':case 'right':A.kind='turn';A.target=(c.type==='left'?-1:1)*c.p.n;A.rem=Math.abs(c.p.n);A.w=0;break;
  case 'stop':A.real=.5;A.sim=20;A.P=0;break;
  case 'wait':A.real=c.p.n*60/CFG.TIMESCALE;A.sim=c.p.n*60;A.P=0;break;
  case 'solar':A.real=c.p.n*60/CFG.CHARGE_TIMESCALE;A.sim=c.p.n*60;A.P=0;S.charging=true;A.done=()=>{S.charging=false};break;
  case 'scan':A.real=1.2;A.sim=40;A.P=camsW;A.eq='cam';A.done=()=>doScan();break;
  case 'measure':A.real=.8;A.sim=6;A.P=camsW;A.eq='cam';A.done=()=>doMeasure();break;
  case 'detect':A.real=1;A.sim=10;A.P=camsW;A.eq='cam';A.done=()=>doDetect();break;
  case 'terrain':A.real=1.2;A.sim=30;A.P=opPower(rv.sci.concat(rv.parts.filter(p=>['mahli','soil'].includes(p.type))));A.eq='sci';A.done=()=>{const t=terrainAt(r.x,r.y);log('info',`Terrain: ${t==='loose'?'loose sand — reduced traction':'packed regolith — normal traction'}. Wheel traction ${fmt(tractionAt(t)*100,0)}%.`)};break;
  case 'image':A.real=.8;A.sim=8;A.P=opPower(rv.cams);A.eq='cam';A.done=()=>{S.images++;log('info',`Image #${S.images} captured at (${fmt(r.x)}, ${fmt(r.y)}).`)};break;
  case 'battery':A.real=.4;A.sim=2;A.done=()=>log('info',`Battery ${fmt(S.E)} Wh of ${fmt(R().capWh)} Wh (${fmt(S.E/R().capWh*100,0)}%). Net load now ${fmt(loadW())} W.`);break;
  case 'lowp':A.real=.4;A.sim=2;A.done=()=>{S.lowp=c.p.m==='On';log('info',`Low-power mode ${c.p.m}.`)};break;
  case 'sysOn':A.real=.4;A.sim=2;A.done=()=>{S.active.add(c.p.s);log('info',`${c.p.s} activated.`)};break;
  case 'sysOff':A.real=.4;A.sim=2;A.done=()=>{S.active.delete(c.p.s);log('info',`${c.p.s} deactivated.`)};break;
  case 'scanT':{const n=nearestTarget(t=>!t.scanned);A.real=1.5;A.sim=60;A.P=camsW;A.eq='cam';
    if(!n.t||n.d>2.6){A.fail=['Target not in range',n.t?`The nearest unscanned target is ${fmt(n.d)} cells away; you must be within 2.6 cells.`:'There is no unscanned target left.','Drive closer to a target marker (move forward/turn) before scanning.']}
    A.done=()=>{if(A.fail)return;n.t.scanned=true;log('sci',`Target ${n.t.id} identified: ${n.t.name}.`);S.discoveries.push(n.t.name+' (scanned)')};break}
  case 'analyze':{const n=nearestTarget(t=>t.scanned&&!t.analyzed);A.real=2.5;A.sim=600;A.P=opPower(rv.sci.concat(rv.parts.filter(p=>p.section==='water')));A.eq='sci';
    if(!n.t||n.d>2.6)A.fail=['Nothing to analyze',n.t?`The nearest scanned target is ${fmt(n.d)} cells away (limit 2.6).`:'No scanned target is waiting for analysis. Use Scan Target first.','Scan the target first, while within 2.6 cells.'];
    A.done=()=>{if(A.fail)return;n.t.analyzed=true;log('sci',`Analysis of target ${n.t.id} (${n.t.name}) complete. ${findingText(n.t)}`);S.discoveries.push(n.t.name+' (analyzed)')};break}
  case 'record':{const n=nearestTarget(t=>t.analyzed&&!t.recorded);A.real=.8;A.sim=30;
    if(!n.t||n.d>4)A.fail=['Nothing to record','No analyzed target is nearby.','Analyze a target first, then record it.'];
    A.done=()=>{if(A.fail)return;n.t.recorded=true;log('sci',`Observation recorded for target ${n.t.id}.`)};break}
  case 'collect':{const n=nearestTarget(t=>t.analyzed&&!t.collected);A.real=2.5;A.sim=400;A.P=opPower(rv.parts.filter(p=>p.section==='arm'||p.section==='tools'));
    if(!n.t||n.d>2.6)A.fail=['Nothing to collect','No analyzed target within 2.6 cells.','Drive to an analyzed target.'];
    A.done=()=>{if(A.fail)return;n.t.collected=true;log('sci',`Sample collected from target ${n.t.id}.`)};break}
  }
  return A;
}
function findingText(t){return ({crystal:'Translucent crystalline structure observed.',rock:'Layered outcrop surface observed.',crater:'Fine loose soil with a shallow depression observed.'})[t.kind]+' (Game-generated description, not real data.)'}
function tractionAt(t){return t==='loose'?1-.35*R().wheelPen:1}
function doScan(){const r=S.rover,m=M.cur,rng_=6*(1-.5*S.storm);let n=0,near=1e9;
  m.obs.forEach(o=>{if(o.k==='target')return;const d=Math.hypot(o.x-r.x,o.y-r.y)-o.r;if(d<rng_){n++;S.known.add(o);near=Math.min(near,d)}});
  const h=m.hazards.filter(hz=>{const p=hazardPos(hz,S.t);return Math.hypot(p.x-r.x,p.y-r.y)<rng_+2}).length;
  const ts=m.targets.filter(t=>Math.hypot(t.x-r.x,t.y-r.y)<rng_+2).map(t=>t.id);
  log('info',`Scan (range ${fmt(rng_)} cells${S.storm>.3?', reduced by dust':''}): ${n} obstacles${n?`, nearest edge ${fmt(near)} cells`:''}; ${h} hazards; targets nearby: ${ts.length?ts.join(','):'none'}.`)}
function doMeasure(){const r=S.rover,m=M.cur,max=20*(1-.5*S.storm);let d=0;for(;d<max;d+=.1){const x=r.x+Math.cos(r.h)*d,y=r.y+Math.sin(r.h)*d;if(blockedAt(m,x,y,.05)&&m.obs.some(o=>o.k!=='target'&&Math.hypot(o.x-x,o.y-y)<o.r)||x<0||y<0||x>m.W||y>m.H)break}
  S.lastMeasure=d>=max?null:d;log('info',d>=max?`Distance: nothing within ${fmt(max)} cells ahead.`:`Distance ahead: ${fmt(d)} cells to the nearest obstacle or boundary.`)}
function doDetect(){const r=S.rover,m=M.cur,rn=10*(1-.5*S.storm);let list=[];
  m.obs.forEach(o=>{if(o.k==='target')return;const a=Math.atan2(o.y-r.y,o.x-r.x)-r.h,d=Math.hypot(o.x-r.x,o.y-r.y);let da=Math.atan2(Math.sin(a),Math.cos(a));if(Math.abs(da)<rad(25)&&d<rn){list.push(`${o.k} ${fmt(d)}c`);S.known.add(o)}});
  const hz=m.hazards.map((h,i)=>{const L=Math.hypot(h.b[0]-h.a[0],h.b[1]-h.a[1]);return `dust devil ${i+1}: patrols a ${fmt(L)}-cell lane, full cycle ${fmt(2*L/h.spd,0)} s`});
  S.hazardSeen=true;log('info',`Obstacles ahead: ${list.length?list.join(', '):'none'}. ${hz.join('; ')}`)}

function loadW(){const rv=R(),A=S.act;let P=S.lowp?CFG.STANDBY_LOW_W:CFG.STANDBY_W;
  S.active.forEach(n=>{const p=rv.switchables.find(s=>s.name===n);if(p)P+=p.watts});
  if(A){if(A.kind==='move')P+=driveW()*(.25+.75*Math.min(1,Math.abs(S.rover.v)/(vMax()||1)))*(terrainAt(S.rover.x,S.rover.y)==='loose'?1.35:1);else if(A.kind==='turn')P+=driveW()*.6*Math.min(1,Math.abs(S.rover.w)/60+.2);else P+=A.P||0}
  if(S.tx>0)P+=CFG.COMM_TX_W;return P}
function vMax(){const base=CFG.SPEED_MPS/CFG.CELL_M*CFG.TIMESCALE;let k=1;if(S.lowp)k*=CFG.LOWPOWER_SPEED;if(terrainAt(S.rover.x,S.rover.y)==='loose')k*=tractionAt('loose');if(S.temp<CFG.COLD_WARN)k*=.7;if(S.temp>CFG.HOT_WARN)k*=.8;return base*k}
function genW(){const rv=R();let g=0;if(rv.hasRtg)g+=CFG.RTG_W[rv.power.type];
  S.sunNow=M.cur.def.sun*(1-.7*S.storm*(rv.types.has('dustBrush')?.7:1));
  S.solarW=0;if(rv.hasSolar&&S.charging){S.solarW=CFG.SOLAR_W[rv.power.type]*S.sunNow*shadeAt(S.rover.x,S.rover.y);g+=S.solarW}return g}

/* ================= main update (rover-physics + energy-engine + collision) ================= */
function update(dt){
  if(!S||!R())return;
  if(S.status==='uplink'){S.uplink-=dt;S.tx=.2;if(S.uplink<=0){S.status='running';program.forEach(c=>{if(c.status==='queued'&&c===program[S.pc])c.status='received'});beginCommand()}else{powerStep(dt*0,0)}stepIdle(dt);return}
  if(S.status==='failed'||S.status==='won'){S.rover.v=0;return}
  if(S.status==='paused'){return}
  if(S.status==='idle'||S.status==='done'){stepIdle(dt);return}
  // running
  const A=S.act,r=S.rover;if(!A)return;
  let simdt=dt*CFG.TIMESCALE;
  if(A.kind==='move')doMove(A,dt);
  else if(A.kind==='turn')doTurn(A,dt);
  else{const rate=A.sim/A.real;simdt=dt*rate;if(A.fail){A.f+=dt/A.real;if(A.f>=1){failMission(...A.fail.slice(0,1),A.fail[1],A.fail[2],S.pc);return}}else{A.f+=dt/A.real;if(A.f>=1){powerStep(dt,simdt*(1-(A.f-1)/(dt/A.real+1e-9)*0));if(S.status==='failed')return;A.done();return endCommand(true)}}}
  if(S.status!=='running')return;
  powerStep(dt,simdt);
  if(S.status==='running'&&A.kind==='move'&&A.finished){A.done();endCommand(true)}
  else if(S.status==='running'&&A.kind==='turn'&&A.finished){A.done();endCommand(true)}
  if(S.status==='running'||S.status==='idle')checkWin();
}
function stepIdle(dt){const simdt=dt*CFG.TIMESCALE;S.rover.v*=.9;if(S.status==='uplink'||S.status==='idle'||S.status==='done')powerStep(dt,simdt);checkWin()}
function checkWin(){if(S.status==='failed'||S.status==='won')return;const m=M.cur,d=Math.hypot(S.rover.x-m.goal.x,S.rover.y-m.goal.y);if(d<=1.3&&M.cur.targets.every(t=>t.analyzed)&&S.status!=='uplink')winMission()}
function powerStep(dt,simdt){
  const rv=R();S.t+=dt;S.sim+=simdt;S.storm=stormAt(S.t);
  const load=loadW(),gen=genW(),h=simdt/3600,gIn=Math.min(gen,CFG.MAX_CHARGE_W)*CFG.CHARGE_EFF;
  // temperature
  let heat=load-(S.act&&S.act.kind==='move'?driveW()*.9:0)+(S.active.has('Insulation with Heater')?15:0);
  S.temp+=((M.cur.def.amb-S.temp)*rv.kTherm+heat*CFG.TEMP_C)*simdt*(S.act&&S.act.kind==='timed'?1:1);
  S.E+=(gIn-load)*h;S.used+=load*h;S.gen+=gen*h;S.solarGen+=(S.solarW||0)*h;
  if(S.E>rv.capWh)S.E=rv.capWh;
  if(S.tx>0)S.tx-=dt;
  const pct=S.E/rv.capWh;
  if(pct<.2&&!S.lowWarned){S.lowWarned=true;log('warning','Low battery: below 20%.')}
  if(pct<.1&&!S.critWarned){S.critWarned=true;log('warning','CRITICAL battery: below 10%.')}
  if(pct>.3){S.lowWarned=false;S.critWarned=false}
  if(S.temp<CFG.COLD_WARN&&!S.tempWarned){S.tempWarned=true;log('warning',`Cold: ${fmt(S.temp,0)} °C — motors slowed. Activate a heater if installed.`)}
  if(S.temp>CFG.COLD_WARN+5)S.tempWarned=false;
  // hazards collide even with a stationary rover
  const m=M.cur,r=S.rover;for(const hz of m.hazards){const p=hazardPos(hz,S.t);if(Math.hypot(p.x-r.x,p.y-r.y)<hz.r*.8+rv.radius){S.collisions++;return failMission('Collision with dust devil',`A moving dust devil hit the rover at command #${S.pc+1}.`,'Use Detect Obstacles to learn its lane and cycle, then WAIT until the lane is clear.',S.pc)}}
  if(S.E<=reserve()&&gIn<load){S.E=reserve();return failMission('Insufficient energy',`The battery reached its ${fmt(CFG.RESERVE_FRAC*100,0)}% reserve while executing "${S.pc<program.length?CMDS[program[S.pc].type].l:'standby'}".`,rv.hasSolar?'Insert Solar Charging, use Low-Power Mode, or shorten the route.':rv.hasRtg?'Use Low-Power Mode, add WAIT periods so the RTG recharges, or shorten the route.':'Use Low-Power Mode or choose a shorter route.',S.pc)}
}
function doMove(A,dt){
  const r=S.rover,rv=R(),vm=vMax();let tgt=Math.min(vm,Math.sqrt(2*6*Math.max(A.rem,0))+.15);
  r.v+=(A.dir*tgt-r.v)*Math.min(1,dt*7);if(Math.abs(r.v)>vm)r.v=A.dir*vm;
  let d=Math.abs(r.v)*dt;if(d>A.rem){d=A.rem;}
  const nx=r.x+Math.cos(r.h)*d*A.dir,ny=r.y+Math.sin(r.h)*d*A.dir,m=M.cur;
  if(nx<rv.radius||ny<rv.radius||nx>m.W-rv.radius||ny>m.H-rv.radius){S.collisions++;return failMission('Rover outside map boundary',`Command #${S.pc+1} would drive off the map edge.`,'Shorten the move or turn earlier.',S.pc)}
  for(const o of m.obs){if(o.k==='target')continue;if(Math.hypot(o.x-nx,o.y-ny)<o.r+rv.radius*.92){S.collisions++;r.x=nx;r.y=ny;return failMission('Collision detected',`The rover hit a ${o.k==='crater'?'crater edge':'rock'} during command #${S.pc+1}.`,'Use Measure Distance / Scan to find obstacles, then turn or shorten the move. Trajectory preview shows the predicted crash point.',S.pc)}}
  r.x=nx;r.y=ny;A.rem-=d;S.trail.length<4000&&(S.trail[S.trail.length-1]===undefined||Math.hypot(S.trail[S.trail.length-1][0]-r.x,S.trail[S.trail.length-1][1]-r.y)>.15)&&S.trail.push([r.x,r.y]);
  const rr=.36*CFG.U;r.wl+=r.v*dt/rr;r.wr=r.wl;r.bob+=Math.abs(r.v)*dt*6;
  if(A.rem<=1e-4)A.finished=true;
}
function doTurn(A,dt){
  const r=S.rover,maxW=CFG.TURN_DEG_PER_SIMS*CFG.TIMESCALE*(S.lowp?CFG.LOWPOWER_SPEED:1)*(S.temp<CFG.COLD_WARN?.7:1);
  const sgn=Math.sign(A.target),tgtW=Math.min(maxW,Math.sqrt(2*400*Math.max(A.rem,0))+8);
  r.w+=(sgn*tgtW-r.w)*Math.min(1,dt*8);let d=Math.min(Math.abs(r.w)*dt,A.rem);r.h+=rad(d)*sgn;A.rem-=d;
  const rr=.36*CFG.U,track=.8*CFG.U;r.wl+=rad(d)*sgn*track/rr;r.wr=r.wl*-1;r.wl=r.wl;r.bob+=d*.05;
  if(A.rem<=.01){A.finished=true;r.w=0}
}

/* ================= predicted trajectory ================= */
function recomputePredicted(){
  if(!M.cur||!R()){return}const m=M.cur,rv=R();let x=m.start.x,y=m.start.y,h=0,pts=[[x,y]],crash=null;
  for(const c of program){if(cmdReason(c))continue;
    if(c.type==='fwd'||c.type==='back'){const dir=c.type==='fwd'?1:-1;for(let d=.25;d<=c.p.n+1e-6&&!crash;d+=.25){const nx=x+Math.cos(h)*.25*dir,ny=y+Math.sin(h)*.25*dir;
        if(nx<rv.radius||ny<rv.radius||nx>m.W-rv.radius||ny>m.H-rv.radius||m.obs.some(o=>o.k!=='target'&&Math.hypot(o.x-nx,o.y-ny)<o.r+rv.radius*.92)){crash=[nx,ny];break}x=nx;y=ny}pts.push([x,y]);if(crash)break}
    else if(c.type==='left')h-=rad(c.p.n);else if(c.type==='right')h+=rad(c.p.n)}
  predicted={pts,crash};
}

/* ================= rendering (renderer, 2.5D iso) ================= */
const cv=$('cv'),ctx=cv.getContext('2d'),TW=64,TH=32;
function P(x,y,z=0){const dx=(x-view.cx)-(y-view.cy),dy=((x-view.cx)+(y-view.cy))/2;return [cv.width/2+dx*TW/2*view.zoom,cv.height/2+(dy*TH-z*TH*1.0)*view.zoom]}
function resize(){const w=cv.parentElement;cv.width=w.clientWidth;cv.height=w.clientHeight}
function fitView(){const m=M.cur;if(!m)return;resize();view.cx=m.W/2;view.cy=m.H/2;view.zoom=Math.min(cv.width/((m.W+m.H)*TW/2+80),cv.height/((m.W+m.H)*TH/2+120))}
function sprite(k,x,y,wc,anchor='b',alpha=1){const im=IMG[k];if(!im.complete||!im.naturalWidth)return;const [sx,sy]=P(x,y),w=wc*TW*view.zoom,h=w*im.naturalHeight/im.naturalWidth;ctx.globalAlpha=alpha;ctx.drawImage(im,sx-w/2,anchor==='b'?sy-h+h*.12:sy-h/2,w,h);ctx.globalAlpha=1}
function flat(k,x,y,wc,hc){const im=IMG[k];if(!im.complete||!im.naturalWidth)return;ctx.save();const [ox,oy]=P(x,y),[ax,ay]=P(x+1,y),[bx,by]=P(x,y+1);
  ctx.transform((ax-ox)/im.naturalWidth*wc,(ay-oy)/im.naturalWidth*wc,(bx-ox)/im.naturalHeight*hc,(by-oy)/im.naturalHeight*hc,ox,oy);ctx.drawImage(im,0,0);ctx.restore()}
function draw(){
  ctx.imageSmoothingEnabled=false;ctx.fillStyle='#2a1720';ctx.fillRect(0,0,cv.width,cv.height);
  if(!M.cur||!R()){ctx.fillStyle='#f6e6c4';ctx.font='16px monospace';ctx.fillText('Import your rover to begin',20,40);return}
  const m=M.cur;if(view.follow&&S){view.cx+=(S.rover.x-view.cx)*.08;view.cy+=(S.rover.y-view.cy)*.08}
  // ground: tiled texture mapped onto the iso plane
  ctx.save();const [p0x,p0y]=P(0,0),[p1x,p1y]=P(m.W,0),[p2x,p2y]=P(m.W,m.H),[p3x,p3y]=P(0,m.H);
  ctx.beginPath();ctx.moveTo(p0x,p0y);ctx.lineTo(p1x,p1y);ctx.lineTo(p2x,p2y);ctx.lineTo(p3x,p3y);ctx.closePath();
  const edge=(p0y+p2y)/2;ctx.fillStyle='#c9622f';ctx.fill();ctx.clip();
  if(IMG.ground.complete&&IMG.ground.naturalWidth){const step=8;for(let i=0;i<m.W;i+=step)for(let j=0;j<m.H;j+=step){const [ox,oy]=P(i,j),[ax,ay]=P(i+step,j),[bx,by]=P(i,j+step);ctx.save();ctx.transform((ax-ox)/512,(ay-oy)/512,(bx-ox)/512,(by-oy)/512,ox,oy);ctx.drawImage(IMG.ground,0,0);ctx.restore()}}
  // sand patches + shade + goal
  m.sand.forEach(s=>{flat(s.s,s.x,s.y,s.w,s.h)});
  m.shade.forEach(s=>{ctx.beginPath();for(let a=0;a<=6.3;a+=.3){const [x,y]=P(s.x+Math.cos(a)*s.rx,s.y+Math.sin(a)*s.ry);a?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.fillStyle='#1a0f2a66';ctx.fill()});
  const pulse=.5+.5*Math.sin(performance.now()/300);flat(pulse>.5?'pad_glow':'pad',m.goal.x-1.3,m.goal.y-1.3,2.6,2.6);
  // trajectory (predicted) below objects
  if(view.showTraj&&predicted&&predicted.pts.length>1){ctx.setLineDash([8,6]);ctx.strokeStyle='#6fe3ff';ctx.lineWidth=3;ctx.beginPath();predicted.pts.forEach((p,i)=>{const [x,y]=P(p[0],p[1]);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();ctx.setLineDash([])}
  // actual path
  if(S&&S.trail.length>1){ctx.strokeStyle='#ffd27a';ctx.lineWidth=3;ctx.beginPath();S.trail.forEach((p,i)=>{const [x,y]=P(p[0],p[1]);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}
  // hazard lanes
  m.hazards.forEach(h=>{const a=P(h.a[0],h.a[1]),b=P(h.b[0],h.b[1]);ctx.strokeStyle=S&&S.hazardSeen?'#ff7755':'#ff775544';ctx.setLineDash([4,6]);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();ctx.setLineDash([])});
  ctx.restore();
  // map frame posts
  ctx.strokeStyle='#f6e6c4';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p0x,p0y);ctx.lineTo(p1x,p1y);ctx.lineTo(p2x,p2y);ctx.lineTo(p3x,p3y);ctx.closePath();ctx.stroke();
  // depth-sorted objects
  const items=[];
  m.obs.forEach(o=>{if(o.k==='target')return;items.push({d:o.x+o.y,f:()=>{if(o.k==='crater'){ctx.save();const [sx,sy]=P(o.x,o.y);const w=o.r*2.3*TW*view.zoom,im=IMG.crater_l;if(im.complete){ctx.drawImage(im,sx-w/2,sy-w*.3,w,w*.6)}ctx.restore()}else{const [sx,sy]=P(o.x,o.y);ctx.fillStyle='#00000040';ctx.beginPath();ctx.ellipse(sx+4,sy+2,o.r*TW*.42*view.zoom,o.r*TH*.5*view.zoom,0,0,7);ctx.fill();sprite(o.s,o.x,o.y+.3,o.r*1.9);if(S&&S.known.has(o)){ctx.strokeStyle='#6fe3ff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(sx,sy,o.r*TW*.5*view.zoom,o.r*TH*.6*view.zoom,0,0,7);ctx.stroke()}}}})});
  items.push({d:1.6+m.start.y,f:()=>sprite('dome_open',1.9,m.start.y,3.2)});
  m.targets.forEach(t=>items.push({d:t.x+t.y,f:()=>{const [sx,sy]=P(t.x,t.y);const sp=t.kind==='crystal'?'crystal':t.kind==='rock'?'rockgrey':'crater_s';
    if(sp==='crater_s'){const w=1.7*TW*view.zoom,im=IMG.crater_s;ctx.drawImage(im,sx-w/2,sy-w*.2,w,w*.45)}else sprite(sp,t.x,t.y+.3,1.4);
    const col=t.analyzed?'#5cc47a':t.scanned?'#e0b43a':'#c28bf0';ctx.strokeStyle=col;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(sx,sy,(1.15+.1*Math.sin(performance.now()/250))*TW*.5*view.zoom,.6*TH*view.zoom,0,0,7);ctx.stroke();
    ctx.fillStyle=col;ctx.font=`bold ${Math.max(10,13*view.zoom)}px monospace`;ctx.textAlign='center';ctx.fillText(t.scanned?`${t.id}: ${t.name}${t.analyzed?' ✓':''}`:`${t.id}: ?`,sx,sy-TH*1.6*view.zoom);ctx.textAlign='left'}}));
  m.hazards.forEach(h=>{const p=hazardPos(h,S?S.t:0);items.push({d:p.x+p.y,f:()=>{const [sx,sy]=P(p.x,p.y),t=performance.now()/200;ctx.fillStyle='#00000030';ctx.beginPath();ctx.ellipse(sx,sy,h.r*TW*.5*view.zoom,h.r*TH*.5*view.zoom,0,0,7);ctx.fill();
    for(let i=0;i<7;i++){const k=i/7,w=(.4+k*.9)*h.r,yy=sy-k*TH*2.2*view.zoom,xx=sx+Math.sin(t+k*5)*8*view.zoom;ctx.fillStyle=`rgba(${200+k*40|0},${120+k*50|0},${70+k*40|0},${.75-k*.35})`;ctx.beginPath();ctx.ellipse(xx,yy,w*TW*.4*view.zoom,w*TH*.35*view.zoom,0,0,7);ctx.fill()}}})});
  if(S)items.push({d:S.rover.x+S.rover.y,f:drawRover});
  items.sort((a,b)=>a.d-b.d).forEach(i=>i.f());
  // storm overlay + sensor/low power tint
  if(S&&S.storm>0){ctx.fillStyle=`rgba(190,110,60,${S.storm*.5})`;ctx.fillRect(0,0,cv.width,cv.height)}
}
function drawRover(){
  const rv=R(),r=S.rover,U=CFG.U,col=rv.colors,cos=Math.cos(r.h),sin=Math.sin(r.h),parts=[];
  const L=(lx,ly,lz,extra=0)=>{const bob=Math.sin(r.bob)*.015+Math.sin(r.bob*2.3)*.01*Math.min(1,Math.abs(r.v));const X=r.x+(lx*cos-ly*sin)*U,Y=r.y+(lx*sin+ly*cos)*U;return [X,Y,lz*U+(extra?0:bob)]};
  const proj=p=>P(p[0],p[1],p[2]);
  const box=(cx,cy,cz,sx,sy,sz,color,extra)=>{const hx=sx/2,hy=sy/2,hz=sz/2;const c=[];for(const dx of[-1,1])for(const dy of[-1,1])for(const dz of[-1,1])c.push(L(cx+dx*hx,cy+dy*hy,cz+dz*hz,extra));
    // c index: dx,dy,dz -> (dx<0?0:4)+(dy<0?0:2)+(dz<0?0:1)
    const faces=[[[1,3,7,5],[0,0,1]],[[4,5,7,6],[1,0,0]],[[2,3,7,6],[0,1,0]]]; // top, +x side, +y side in local (rotated later)
    const ctr=L(cx,cy,cz,extra);parts.push({d:ctr[0]+ctr[1]+ctr[2]*.7,f:()=>{const pr=c.map(proj);
      const faceList=[[2,3,7,6,1.0],[1,3,7,5,.8],[4,5,7,6,.65],[0,1,3,2,.55],[0,4,6,2,.7],[0,1,5,4,.5]];
      // draw all six faces back-to-front by center depth
      const fl=faceList.map(f=>{const idx=f.slice(0,4);const ys=idx.reduce((a,i)=>a+c[i][0]+c[i][1]+c[i][2]*.7,0)/4;return {idx,sh:f[4],ys}}).sort((a,b)=>a.ys-b.ys);
      // only the three front-most faces are visible; draw them
      fl.slice(1,4).concat(fl.slice(4)).slice(-3).forEach(f=>{ctx.fillStyle=shade(color,f.sh+(f.idx[0]===2?.1:0));ctx.beginPath();f.idx.forEach((i,k)=>k?ctx.lineTo(pr[i][0],pr[i][1]):ctx.moveTo(pr[i][0],pr[i][1]));ctx.closePath();ctx.fill();ctx.strokeStyle='#1b1020';ctx.lineWidth=1;ctx.stroke()})}})};
  const beam=(a,b,w,color)=>{const A=L(...a),B=L(...b);parts.push({d:(A[0]+A[1]+B[0]+B[1])/2+(A[2]+B[2])*.35,f:()=>{const pa=proj(A),pb=proj(B);ctx.strokeStyle=color;ctx.lineWidth=Math.max(1.5,w*U*TW*view.zoom);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(pa[0],pa[1]);ctx.lineTo(pb[0],pb[1]);ctx.stroke()}})};
  const wheel=(x,z,left)=>{const ph=left?r.wl:r.wr,R_=.36,Y0=z;const n=12,ring=(yy)=>Array.from({length:n},(_,i)=>{const a=ph+i*2*Math.PI/n;return L(x+Math.cos(a)*R_,yy,.48+Math.sin(a)*R_)});
    const near=ring(z+.11),far=ring(z-.11),ctr=L(x,z,.48);parts.push({d:ctr[0]+ctr[1]+ctr[2]*.7-.02,f:()=>{const pn=near.map(proj),pf=far.map(proj);
      for(let i=0;i<n;i++){const j=(i+1)%n;ctx.fillStyle=(i%3===0&&rv.wt&&rv.wt.type==='cleated')?col.metal:col.dark;ctx.beginPath();ctx.moveTo(pf[i][0],pf[i][1]);ctx.lineTo(pf[j][0],pf[j][1]);ctx.lineTo(pn[j][0],pn[j][1]);ctx.lineTo(pn[i][0],pn[i][1]);ctx.closePath();ctx.fill();ctx.strokeStyle='#1b1020';ctx.lineWidth=1;ctx.stroke()}
      const side=(ctr[1]*0+1);const face=z>0?pn:pf;ctx.fillStyle=rv.wt&&rv.wt.type==='mesh'?col.metal:'#4a3552';ctx.beginPath();face.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fill();
      const hub=proj(L(x,z>0?z+.12:z-.12,.48)),sp=proj(L(x+Math.cos(ph)*.3,z>0?z+.12:z-.12,.48+Math.sin(ph)*.3));ctx.strokeStyle=col.gold;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(hub[0],hub[1]);ctx.lineTo(sp[0],sp[1]);ctx.stroke();ctx.fillStyle=col.gold;ctx.fillRect(hub[0]-3,hub[1]-3,6,6)}})};
  // shadow
  const [shx,shy]=P(r.x,r.y);ctx.fillStyle='#00000055';ctx.beginPath();ctx.ellipse(shx+3,shy+3,rv.radius*TW*.55*view.zoom,rv.radius*TH*.65*view.zoom,0,0,7);ctx.fill();
  const [sx,sy,sz]=rv.size;
  if(rv.wheels){const n=rv.nWheels,xs=n===4?[-.9,-.9,.9,.9]:[-1.05,0,1.05,-1.05,0,1.05],zs=n===4?[-.78,.78,-.78,.78]:[-.78,-.92,-.78,.78,.92,.78];
    for(let i=0;i<n;i++){wheel(xs[i],zs[i],zs[i]<0);if(rv.wheels.type==='rocker')beam([xs[i]*.8,zs[i]*.8,.55],[xs[i],zs[i],.5],.075,col.metal)}}
  box(0,0,1.05,sx,sz,sy,col.body);box(0,0,1.34,sx*.72,sz*.82,.09,col.dark);
  if(rv.th)box(0,0,1.4,sx*.48,sz*.55,.08,col.white);
  if(rv.hasSolar){for(const sd of[-1,1]){const pnl=rv.switchables.length&&0;box(sd*1.45,0,1.35,.9,.62,.045,col.blue);for(let k=0;k<4;k++)box(sd*1.45-.34+k*.22,0,1.38,.012,.62,.03,col.glass)}beam([-.8,0,1.1],[-1.1,0,1.3],.035,col.metal);beam([.8,0,1.1],[1.1,0,1.3],.035,col.metal)}
  if(rv.hasRtg){box(1.22,-.12,1.05,.55,.5,.5,col.dark);box(1.22,-.12,1.32,.5,.46,.05,col.gold)}
  if(rv.bat)box(-.35,-.15,1.48,.48,.42,.28,col.dark);
  if(rv.cams.length){if(rv.cams.some(c=>['navcam','mastcam','pancam'].includes(c.type))){beam([0,0,1.45],[0,0,2.25],.055,col.metal);box(0,0,2.32,.22,.55,.2,col.dark);box(.1,0,2.34,.1,.4,.12,col.glass)}
    if(rv.has('hazcam')){box(-.55,-.62,.9,.18,.08,.14,col.dark);box(-.55,.62,.9,.18,.08,.14,col.dark)}}
  if(rv.has('arm')){beam([.72,.48,1.1],[1.15,.58,1.35],.09,col.metal);beam([1.15,.58,1.35],[1.38,.72,.85],.075,col.metal);beam([1.38,.72,.85],[1.6,.8,.62],.06,col.gold)}
  rv.sci.forEach((s,i)=>box(-.55+i*.36,-.35,1.48,.25,.28,.22,col.white));
  if(rv.has('radar','radarHydro'))box(-.75,.35,.77,.48,.34,.08,col.dark);
  rv.parts.filter(p=>p.section==='environment').forEach((e,i)=>{box(.35+i*.3,-.4,1.55,.2,.2,.16,e.type==='radiation'?col.orange:col.dark)});
  if(rv.parts.some(p=>p.section==='samples'))box(-.55,.35,1.45,.4,.35,.25,col.white);
  parts.sort((a,b)=>a.d-b.d).forEach(p=>p.f());
  if(S.charging&&rv.hasSolar){const [x,y]=P(r.x,r.y,.4);ctx.fillStyle='#ffe27a';ctx.font='bold 16px monospace';ctx.fillText('☀ +'+fmt(S.solarW,0)+' W',x-24,y-70*view.zoom)}
}
function shade(hex,f){const n=parseInt(hex.slice(1),16),c=v=>clamp(Math.round(v*f),0,255);return `rgb(${c(n>>16)},${c(n>>8&255)},${c(n&255)})`}

/* ================= UI ================= */
function buildMaps(){const el=$('maps');el.innerHTML='';MAPS.forEach((m,i)=>{const b=document.createElement('button');b.className=M.idx===i?'on':'';b.innerHTML=`${i+1}. ${m.name} <span class="badge ${m.cls}">${m.tag}</span>${M.done[i]?' ✓':''}`;b.onclick=()=>{if(R())startMission(i,true)};el.appendChild(b)})}
function buildPalette(){
  const el=$('pal');el.innerHTML='';
  for(const [ck,cn] of Object.entries(CATS)){const d=document.createElement('div');d.className='cat';d.innerHTML=`<h3>${cn}</h3>`;
    for(const [k,c] of Object.entries(CMDS)){if(c.c!==ck)continue;const reason=c.req?c.req():null,b=document.createElement('button');b.className='blk';b.dataset.c=ck;b.disabled=!!reason;b.title=reason?'Unavailable: '+reason:c.desc;b.draggable=!reason;b.textContent=c.l+(reason?' 🔒':'');
      b.onclick=()=>addCmd(k);b.ondragstart=e=>{e.dataTransfer.setData('text/cmd',k)};d.appendChild(b)}
    el.appendChild(d)}
}
function addCmd(k,at){const d=CMDS[k],c={id:nextId++,type:k,p:{},status:'',msg:''};d.p.forEach(p=>{c.p[p.k]=p.sel?p.d:p.sys?R().switchables[0].name:p.d});if(at==null)program.push(c);else program.splice(at,0,c);progChanged()}
function progChanged(){if(S&&(S.status==='idle'||S.status==='done'||S.status==='failed')){program.forEach(c=>{if(c.status!=='')c.status=''})}recomputePredicted();renderProgram()}
function renderProgram(){
  const el=$('list');el.innerHTML='';if(!program.length)el.innerHTML='<div class="mut" style="padding:10px">Drag command labels here or click them to build a program.</div>';
  program.forEach((c,i)=>{const d=CMDS[c.type],row=document.createElement('div');c.inv=R()?cmdReason(c):null;
    row.className='row'+(S&&S.status!=='idle'&&i===S.pc&&c.status==='executing'?' cur':'')+(c.status==='done'?' done':'')+(c.status==='error'?' err':'')+(c.inv?' inv':'');row.dataset.c=d.c;row.draggable=true;
    row.innerHTML=`<span class="h">⠿</span><span class="n">${i+1}</span><b>${d.l}</b>`;
    d.p.forEach(p=>{let inp;if(p.sel){inp=document.createElement('select');p.sel.forEach(o=>{const op=document.createElement('option');op.textContent=o;inp.appendChild(op)});inp.value=c.p[p.k]}
      else if(p.sys){inp=document.createElement('select');R().switchables.forEach(s=>{const op=document.createElement('option');op.textContent=s.name;inp.appendChild(op)});inp.value=c.p[p.k]}
      else{inp=document.createElement('input');inp.type='number';inp.min=p.min;inp.max=p.max;inp.value=c.p[p.k]}
      inp.onchange=()=>{c.p[p.k]=p.sel||p.sys?inp.value:parseFloat(inp.value);progChanged()};const lab=document.createElement('small');lab.textContent=p.l;row.appendChild(inp);row.appendChild(lab)});
    const st=document.createElement('span');st.className='st';st.textContent=c.status||'';row.appendChild(st);
    [['↑',()=>{if(i>0){[program[i-1],program[i]]=[program[i],program[i-1]];progChanged()}}],['↓',()=>{if(i<program.length-1){[program[i+1],program[i]]=[program[i],program[i+1]];progChanged()}}],['✕',()=>{program.splice(i,1);progChanged()}]].forEach(([t,fn])=>{const b=document.createElement('button');b.textContent=t;b.onclick=fn;row.appendChild(b)});
    if(c.inv||c.msg){const m=document.createElement('div');m.className='msg';m.textContent='⚠ '+(c.inv||c.msg);row.appendChild(m)}
    row.ondragstart=e=>{e.dataTransfer.setData('text/move',i)};row.ondragover=e=>e.preventDefault();
    row.ondrop=e=>{e.preventDefault();e.stopPropagation();dropAt(e,i)};el.appendChild(row)});
  const run=S&&(S.status==='running'||S.status==='uplink'||S.status==='paused');
  $('bRun').disabled=!!run;$('bPause').disabled=!(S&&(S.status==='running'));$('bResume').disabled=!(S&&S.status==='paused');$('bStep').disabled=!!(S&&(S.status==='running'||S.status==='uplink'));
  $('prog').textContent=program.length?`${program.filter(c=>c.status==='done').length}/${program.length} done`:'';
}
function dropAt(e,i){const k=e.dataTransfer.getData('text/cmd'),mv=e.dataTransfer.getData('text/move');if(k)addCmd(k,i);else if(mv!==''){const f=+mv;const [c]=program.splice(f,1);program.splice(i>f?i-1:i,0,c);progChanged()}}
$('list').ondragover=e=>{e.preventDefault();$('list').classList.add('over')};$('list').ondragleave=()=>$('list').classList.remove('over');
$('list').ondrop=e=>{e.preventDefault();$('list').classList.remove('over');const k=e.dataTransfer.getData('text/cmd');if(k)addCmd(k)};
$('bRun').onclick=()=>runProgram(false);if($('bAuto'))$('bAuto').onclick=generateAutopilot;$('bStep').onclick=stepProgram;$('bPause').onclick=()=>{if(S.status==='running'){S.status='paused';S.commState='Paused';renderProgram()}};
$('bResume').onclick=()=>{if(S.status==='paused'){S.status='running';S.commState='Link active';renderProgram()}};
$('bReset').onclick=()=>{if(S)resetRun()};$('bClear').onclick=()=>{program=[];if(S&&S.status!=='running')recomputePredicted();renderProgram()};
$('bTraj').onclick=()=>{view.showTraj=!view.showTraj;$('bTraj').textContent='Trajectory: '+(view.showTraj?'ON':'OFF');$('bTraj').classList.toggle('on',view.showTraj)};
$('bFollow').onclick=()=>{view.follow=!view.follow;$('bFollow').classList.toggle('on',view.follow)};$('bFit').onclick=()=>{fitView();view.follow=false;$('bFollow').classList.remove('on')};
$('tT').onclick=()=>{$('cond').style.display='';$('log').style.display='none';$('tT').classList.add('on');$('tL').classList.remove('on')};
$('tL').onclick=()=>{$('cond').style.display='none';$('log').style.display='';$('tL').classList.add('on');$('tT').classList.remove('on')};
cv.addEventListener('wheel',e=>{e.preventDefault();view.zoom=clamp(view.zoom*(e.deltaY<0?1.1:.9),.3,2.5)},{passive:false});
cv.addEventListener('mousedown',e=>{drag=[e.clientX,e.clientY];cv.style.cursor='grabbing'});window.addEventListener('mouseup',()=>{drag=null;cv.style.cursor='grab'});
window.addEventListener('mousemove',e=>{if(!drag)return;const dx=e.clientX-drag[0],dy=e.clientY-drag[1];drag=[e.clientX,e.clientY];if(view.follow){view.follow=false;$('bFollow').classList.remove('on')}
  const a=dx/(TW/2*view.zoom),b=dy/(TH/2*view.zoom);view.cx-=(a+b)/2;view.cy-=(b-a)/2});
function flash(msg){$('hudMsg').style.display='block';$('hudMsg').textContent=msg;clearTimeout(flash.t);flash.t=setTimeout(()=>$('hudMsg').style.display='none',4000)}
function openModal(){$('modal').classList.add('show')}function closeModal(){$('modal').classList.remove('show')}
let tipN=0;const TIPS=['Click a command label (or drag it) to add it to the program. Set numbers in the row, then press RUN.','Watch the Rover condition panel: every number comes from the live simulation. The cyan dashed line is the predicted path.','Moving costs energy. Check battery often; a failed mission never destroys your rover — edit and retry.','Sensors depend on your rover design. Locked labels (🔒) show what hardware is missing.','Drive within 2.6 cells of a target marker, then Scan Target → Analyze Sample. Finish on the glowing pad.'];
function showTipFor(i){const t=$('tip');if(M.tips&&M.tips[i])return;(M.tips=M.tips||{})[i]=1;tipN=0;showTip()}
function showTip(){const t=$('tip');if(tipN>=TIPS.length){t.style.display='none';return}t.style.display='block';t.innerHTML=`${TIPS[tipN]} <button id="tN">${tipN<TIPS.length-1?'Next':'Got it'}</button><button id="tS">Skip</button>`;$('tN').onclick=()=>{tipN++;showTip()};$('tS').onclick=()=>{t.style.display='none'}}
$('bHelp').onclick=()=>{tipN=0;showTip()};
function showMissingRoverNotice(msg) {
  const card = $('card');
  card.className = 'card bad';
  card.innerHTML = `<h2>⚠️ NO ROVER DETECTED</h2>
    <p>Mission Control requires the Rover you assembled in the <b>Rover Workshop</b> before launching surface operations.</p>
    <p class="mut">${msg || 'Rover configuration not found in session memory.'}</p>
    <div class="btns" style="margin-top:16px;">
      <button id="btnReturnWorkshop" style="background:#00F0FF;color:#070B14;font-weight:bold;border:2px solid #00F0FF;padding:9px 18px;border-radius:4px;box-shadow:0 0 12px rgba(0,240,255,0.4);cursor:pointer;">
        🔧 RETURN TO ROVER WORKSHOP ▶
      </button>
      <button id="btnManualImport" style="background:#1d2736;color:#e8eef7;border:2px solid #3b4d6b;padding:9px 16px;border-radius:4px;cursor:pointer;">
        📂 Load File / Paste JSON
      </button>
    </div>`;
  openModal();
  $('btnReturnWorkshop').onclick = () => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'STAGE_GOTO', scene: 'stage1_game' }, '*');
    } else {
      window.location.href = '../../Mars_Rover_Level 1_Design_Workshop.html';
    }
  };
  $('btnManualImport').onclick = () => {
    importDialog();
  };
}

function generateAutopilot() {
  if (!M.cur || !R()) return;
  const m = M.cur;
  resetRun();
  program = [];

  let curX = m.start.x;
  let curY = m.start.y;
  let curHeading = 0; // heading 0 = +X (East)

  const targets = [...m.targets];
  const waypoints = [...targets, { x: m.goal.x, y: m.goal.y, isGoal: true }];

  waypoints.forEach((wp) => {
    const dx = wp.x - curX;
    const dy = wp.y - curY;
    const targetAngle = Math.atan2(dy, dx); // radians
    let diffDeg = Math.round((targetAngle - curHeading) * 180 / Math.PI);
    while (diffDeg > 180) diffDeg -= 360;
    while (diffDeg < -180) diffDeg += 360;

    if (Math.abs(diffDeg) >= 5) {
      if (diffDeg > 0) {
        addCmd('right');
        program[program.length - 1].p.n = diffDeg;
      } else {
        addCmd('left');
        program[program.length - 1].p.n = Math.abs(diffDeg);
      }
      curHeading += diffDeg * Math.PI / 180;
    }

    const dist = Math.hypot(dx, dy);
    // Move towards waypoint (stopping just before target to scan/analyze)
    const moveDist = wp.isGoal ? Math.round(dist) : Math.max(1, Math.round(dist - 1.5));
    if (moveDist > 0) {
      addCmd('fwd');
      program[program.length - 1].p.n = moveDist;
      curX += Math.cos(curHeading) * moveDist;
      curY += Math.sin(curHeading) * moveDist;
    }

    if (!wp.isGoal) {
      addCmd('scanT');
      addCmd('analyze');
      addCmd('record');
    }
  });

  addCmd('stop');
  progChanged();
  flash('Autopilot sequence generated! Press RUN to execute.');
}

function importDialog(){
  const card=$('card');card.className='card';
  card.innerHTML=`<h2>Import your rover</h2><p>Mission Control needs the rover you built in the Rover Workshop.</p>
  <p>1. In the workshop, press <b>Send to Mission Control (rover.json)</b> (use the included <i>rover_designer_with_export.html</i>), or use its <b>Download Build Report</b> .txt.</p>
  <input type="file" id="fIn" accept=".json,.txt"><p class="mut">…or paste rover.json:</p><textarea id="tIn" placeholder='{"schema":"mars-rover-v1", ...}'></textarea>
  <div class="btns"><button id="bPaste">Load pasted JSON</button><button id="bDemo">Use sample rover (demo, not your design)</button></div><p id="impErr" class="crit"></p>`;
  openModal();
  $('fIn').onchange=e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{try{loadRoverFromText(rd.result)}catch(err){$('impErr').textContent=err.message}};rd.readAsText(f)};
  $('bPaste').onclick=()=>{try{loadRoverFromText($('tIn').value)}catch(err){$('impErr').textContent=err.message}};
  $('bDemo').onclick=()=>{fetch('rover.sample.json').then(r=>r.text()).then(loadRoverFromText).catch(()=>{loadRoverFromText(JSON.stringify(SAMPLE))})};
}
const SAMPLE={schema:'mars-rover-v1',name:'Sample Rover (demo)',parts:[{section:'chassis',name:'Medium Chassis',type:'box',mass:55,watts:0},{section:'wheels',name:'6 Wheels with Rocker-Bogie',type:'rocker',mass:44,watts:20},{section:'wheeltype',name:'Cleated Wheel',type:'cleated',mass:15,watts:2},{section:'power',name:'Hybrid System',type:'hybrid',mass:50,watts:0},{section:'battery',name:'Medium Battery',type:'batteryM',mass:13,watts:0},{section:'thermal',name:'Insulation with Heater',type:'heater',mass:17,watts:15},{section:'cameras',name:'Navcams',type:'navcam',mass:4,watts:5},{section:'cameras',name:'Hazcams',type:'hazcam',mass:3,watts:4},{section:'science',name:'Chemical Spectrometer',type:'spectrometer',mass:8,watts:10},{section:'water',name:'Hydrogen Sensor',type:'hydrogen',mass:7,watts:7}]};
$('bImport').onclick=importDialog;

/* ================= dashboard (telemetry) ================= */
let lastUI=0;
function barHtml(p,c){return `<div class="bar"><i style="width:${clamp(p,0,100)}%;background:${c}"></i></div>`}
function eqState(p){const rv=R(),A=S.act;
  if(p.section==='cameras'||p.type==='radar')return A&&A.eq==='cam'?'Active':'Standby';
  if(p.section==='science'||p.section==='water')return A&&A.eq==='sci'?'Active':S.active.has(p.name)?'Active':'Standby';
  if(p.section==='power'){if(p.type==='rtg')return 'Active';return S.charging?'Active':'Standby'}
  if(S.active.has(p.name))return 'Active';if(rv.switchables.includes(p))return 'Inactive';
  if(p.section==='tools'||p.section==='arm'){return rv.has('arm')?'Standby':'Unavailable'}return 'Standby'}
function updateUI(){
  if(!S||!R())return;const rv=R(),usable=Math.max(0,S.E-reserve()),pct=S.E/rv.capWh*100,A=S.act;
  const hud=`<b>MISSION ${M.idx+1}: ${MAPS[M.idx].name}</b><br>${MAPS[M.idx].brief}<br>Targets analyzed: ${M.cur.targets.filter(t=>t.analyzed).length}/${M.cur.targets.length} · Pad: ${fmt(Math.hypot(S.rover.x-M.cur.goal.x,S.rover.y-M.cur.goal.y))} cells away`;
  if($('hudObj').innerHTML!==hud)$('hudObj').innerHTML=hud;
  const cur=program[S.pc];$('hudCmd').innerHTML=`<b>${A&&cur?'▶ '+CMDS[cur.type].l:S.status.toUpperCase()}</b>${A?barHtml(A.kind==='move'?(1-A.rem/Math.max(.01,cur.p.n))*100:A.kind==='turn'?(1-A.rem/Math.max(.01,cur.p.n))*100:A.f*100,'#6fe3ff'):''}<br><small>Sim ${fmtT(S.sim)} · ${S.commState}</small>`;
  const eff=Math.min(1,.0+1)*CFG.CHARGE_EFF;
  const tr=terrainAt(S.rover.x,S.rover.y),trac=tractionAt(tr);
  const eq=rv.parts.filter(p=>!['chassis','wheeltype','battery','thermal','dust','samples','environment'].includes(p.section)||p.section==='environment'||p.section==='samples').map(p=>`<div class="eq"><span>${p.name}</span><span class="s-${eqState(p)}">${eqState(p)}</span></div>`).join('');
  const bc=pct<10?'var(--bad)':pct<20?'var(--warn)':'var(--ok)';
  const load=loadW(),gen=genW();
  $('cond').innerHTML=`
  <div class="sec"><h2>Battery ${pct<10?'<span class="crit">CRITICAL</span>':pct<20?'<span class="warn">LOW</span>':''}</h2>${barHtml(pct,bc)}
   <div class="kv"><span>Charge</span><span>${fmt(pct,0)}%</span><span>Stored</span><span>${fmt(S.E)} Wh</span><span>Usable (above ${fmt(CFG.RESERVE_FRAC*100,0)}% reserve)</span><span>${fmt(usable)} Wh</span><span>Capacity${rv.batAssumed?' (assumed, no battery chosen)':' (assumed value)'}</span><span>${fmt(rv.capWh,0)} Wh @${CFG.BATTERY_V} V</span><span>Load now</span><span>${fmt(load)} W</span><span>Est. runtime at this load</span><span>${load>gen?fmt(usable/(load-gen*CFG.CHARGE_EFF)*60,0)+' min':'∞'}</span><span>Consumed total</span><span>${fmt(S.used)} Wh</span></div></div>
  <div class="sec"><h2>Power generation</h2><div class="kv"><span>Solar panels</span><span>${rv.hasSolar?(S.charging?'<b class=ok>Charging</b>':'Stowed'):'<span class=s-Unavailable>None installed</span>'}</span><span>Solar power now</span><span>${fmt(S.solarW||0)} W</span><span>RTG power</span><span>${rv.hasRtg?fmt(CFG.RTG_W[rv.power.type])+' W':'—'}</span><span>Energy generated</span><span>${fmt(S.gen)} Wh</span><span>Charge efficiency</span><span>${fmt(CFG.CHARGE_EFF*100,0)}%</span><span>Sunlight</span><span>${fmt(S.sunNow*100,0)}%${shadeAt(S.rover.x,S.rover.y)<1?' (shaded)':''}${S.storm>.1?' · dust storm '+fmt(S.storm*100,0)+'%':''}</span></div></div>
  <div class="sec"><h2>Temperature</h2><div class="kv"><span>Internal</span><span class="${S.temp<CFG.COLD_WARN||S.temp>CFG.HOT_WARN?'warn':''}">${fmt(S.temp,0)} °C</span><span>Ambient (map)</span><span>${M.cur.def.amb} °C</span><span>Insulation</span><span>${rv.th?rv.th.name:'None'}</span></div>${S.temp<CFG.COLD_WARN?'<div class="warn">⚠ Cold: drive speed reduced 30%</div>':''}</div>
  <div class="sec"><h2>Wheels</h2><div class="kv"><span>Configuration</span><span>${rv.wheels?rv.wheels.name:'None'}</span><span>Wheel type</span><span>${rv.wt?rv.wt.name:'—'}</span><span>Terrain</span><span>${tr==='loose'?'Loose sand':'Packed regolith'}</span><span>Traction</span><span class="${trac<1?'warn':''}">${fmt(trac*100,0)}%</span><span>Speed</span><span>${fmt(Math.abs(S.rover.v)*CFG.CELL_M/CFG.TIMESCALE*100,1)} cm/s sim</span><span>Damage</span><span>not modelled</span></div></div>
  <div class="sec"><h2>Communication</h2><div class="kv"><span>Status</span><span>${S.commState}</span><span>Uplink delay (game model)</span><span>${fmt(CFG.COMM_DELAY_S[M.idx])} s</span><span>Pending commands</span><span>${program.filter(c=>c.status==='queued'||c.status==='received').length}</span><span>Current command</span><span>${cur&&A?CMDS[cur.type].l:'—'}</span><span>Last distance reading</span><span>${S.lastMeasure!=null?fmt(S.lastMeasure)+' cells':'—'}</span></div></div>
  <div class="sec"><h2>Equipment</h2>${eq}<div class="eq"><span>Computer + radio (assumed)</span><span class="s-Active">${S.tx>0?'Transmitting':'Active'}</span></div></div>
  <details><summary>Simulation assumptions</summary><small>Designer data has no battery capacity, solar rating, speed or comms. Assumed: ${rv.capWh} Wh battery, solar ${rv.hasSolar?CFG.SOLAR_W[rv.power.type]:0} W rated, RTG ${rv.hasRtg?CFG.RTG_W[rv.power.type]:0} W, standby ${CFG.STANDBY_W} W, drive ${fmt(driveW(),0)} W, 1 cell = ${CFG.CELL_M} m. All values live in <code>CFG</code> in scripts/main.js. Component watts come from the designer.</small></details>`;
}

/* ================= boot ================= */
let last=performance.now();
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;try{update(dt);draw();if(now-lastUI>120){lastUI=now;updateUI();if(S&&(S.status==='running'||S.status==='uplink'))renderProgram()}}catch(e){console.error(e)}requestAnimationFrame(frame)}
window.addEventListener('resize',()=>{resize()});
resize();buildMaps();renderProgram();
// TASK 3: Strict sessionStorage contract and safe validation
const savedRover = sessionStorage.getItem("mission_stage1_rover");
let loaded = false;

if (savedRover) {
  try {
    loadRoverFromText(savedRover);
    loaded = true;
    console.log('[MissionControl] Rover loaded from sessionStorage ("mission_stage1_rover") successfully.');
  } catch (err) {
    console.error('[MissionControl] Corrupted rover JSON in sessionStorage:', err);
    showMissingRoverNotice('Corrupted or invalid rover configuration: ' + err.message);
  }
} else {
  // Check backup from same session
  try {
    const backup = localStorage.getItem('marsRoverDesign');
    if (backup) {
      loadRoverFromText(backup);
      loaded = true;
      console.log('[MissionControl] Rover restored from local storage backup.');
    }
  } catch (_) {}

  if (!loaded) {
    showMissingRoverNotice('No active rover design found in sessionStorage ("mission_stage1_rover"). Please assemble your rover in Stage 1 first.');
  }
}
requestAnimationFrame(frame);
window.__game={get S(){return S},get M(){return M},get program(){return program},addCmd,runProgram,loadRoverFromText,startMission};
