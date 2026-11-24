/* Offline Node.js regression. Run with: node qa/signal-readouts.cjs
   Uses only the declared readouts and gamepad keys to solve every covered stage. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
global.SQ = {games:new Map(),register(def){ this.games.set(def.id,def); }};
require(path.join(__dirname,'..','SideQuest','signal.js'));
const game=(id)=>{let score=0;const round=SQ.games.get(id).create({score(v){score+=v;},sound(){},reduced:true});return {round,score:()=>score};};
const covered=[...SQ.games.values()].filter(g=>g.speakMoves);
assert.equal(covered.length,12);
for(const def of SQ.games.values()){
  const {round}=game(def.id);
  if(!def.speakMoves){assert.equal(typeof round.describe,'undefined');continue;}
  for(let i=0;i<24;i++){
    for(const short of [true,false]){const value=round.describe(short);assert(value.length>7&&!value.includes('undefined'),def.id);}
    round.press(['right','left','up','down','action'][i%5]);round.update(.12,new Set());
  }
}
function solve(id,f){const {round,score}=game(id);f(round,score);assert(score()>0,`${id}: no score from readouts and keys`);}
const cell=(s,cols)=>s.charCodeAt(0)-65+(Number(s.slice(1))-1)*cols;
const list=(s,cols)=>s==='none'?[]:s.split(', ').map(v=>cell(v,cols));
function cursor(g,cols,target){
  for(let i=0;i<cols+10;i++){const m=g.describe(true).match(/row (\d+) column (\d+)/);assert(m);const row=Number(m[1])-1,col=Number(m[2])-1;
    if(row===(target/cols|0)&&col===target%cols)return;g.press(col!==target%cols?'right':'down');}
  throw new Error('Cursor could not reach target');
}
function route(start,key,edges,finish){const queue=[[start,[]]],seen=new Set();for(let i=0;i<queue.length;i++){
  const [v,moves]=queue[i];if(finish(v))return moves;if(seen.has(key(v)))continue;seen.add(key(v));for(const [k,w] of edges(v))queue.push([w,[...moves,k]]);
}throw new Error('Route unavailable');}
const directions=[['left',-1,0],['right',1,0],['up',0,-1],['down',0,1]];
for(let trial=0;trial<10;trial++){
  solve('night-switch',g=>{
    const lights=new Set(list(g.describe().match(/Lit windows: ([^.]+)/)[1],3));
    let solution;for(let mask=0;mask<512;mask++){
      const grid=Array.from({length:9},(_,i)=>lights.has(i));const moves=[];
      for(let i=0;i<9;i++)if((mask>>i)&1){moves.push(i);for(let j=0;j<9;j++)if(Math.abs(i%3-j%3)+Math.abs((i/3|0)-(j/3|0))<=1)grid[j]=!grid[j];}
      if(grid.every(v=>!v)){solution=moves;break;}
    }
    for(const i of solution){cursor(g,3,i);g.press('action');}
  });
  solve('echo-array',g=>{
    for(let i=0;i<180;i++)g.update(1/60,new Set());const seq=g.describe().match(/Received: ([^.]+)\./)[1].split(', ');
    for(const name of seq){for(let i=0;i<4&&!g.describe(true).includes(', '+name+'.');i++)g.press('right');g.press('action');}
  });
  solve('phase-radio',g=>{const target=g.describe().match(/Target frequency (\d+), phase (\d+)/).slice(1).map(Number);
    for(let i=0;i<6&&Number(g.describe(true).match(/Frequency (\d+)/)[1])!==target[0];i++)g.press('right');
    for(let i=0;i<4&&Number(g.describe(true).match(/phase (\d+)/)[1])!==target[1];i++)g.press('up');
  });
  solve('nanogram',g=>{const [_,r,c]=g.describe().match(/Row clues: ([^.]+). Column clues: ([^.]+)\./);const runs=a=>a.join('').split(/0+/).filter(Boolean).map(v=>v.length).join(' ')||'0';
    for(let mask=0;mask<512;mask++){const bits=Array.from({length:9},(_,i)=>(mask>>i)&1);const rows=[0,1,2].map(j=>runs(bits.slice(j*3,j*3+3))).join('; '),cols=[0,1,2].map(j=>runs([bits[j],bits[3+j],bits[6+j]])).join('; ');if(rows!==r||cols!==c)continue;
      bits.forEach((on,i)=>{if(on){cursor(g,3,i);g.press('action');}});break;}
  });
  solve('ice-relay',g=>{const s=g.describe(),start=cell(s.match(/Drone at (\w+)/)[1],6),goal=cell(s.match(/Beacon at (\w+)/)[1],6),walls=new Set(list(s.match(/Walls: ([^.]+)/)[1],6));
    const moves=route(start,v=>v,v=>directions.map(([k,dx,dy])=>{let x=v%6,y=v/6|0;while(x+dx>=0&&x+dx<6&&y+dy>=0&&y+dy<5&&!walls.has((y+dy)*6+x+dx)){x+=dx;y+=dy;}return [k,y*6+x];}),v=>v===goal);moves.forEach(k=>g.press(k));
  });
  solve('bit-forge',g=>{const goal=Number(g.describe().match(/target (\d+)/)[1]);for(let i=0;i<5;i++){const n=Number(g.describe(true).match(/Switch (\d+)/)[1]);if(goal&n)g.press('action');g.press('right');}});
  solve('prism-post',(g,score)=>{
    const s=g.describe(),rx=cell(s.match(/Receiver on east of (\w+)/)[1],5),items=s.match(/Mirrors: ([^.]+)/)[1].split(', ').map(v=>v.split(' ')),base=items.map(v=>v[1]==='backslash');
    for(let mask=0;mask<1<<items.length;mask++){
      let x=-1,y=1,dx=1,dy=0;const seen=new Set();
      while(true){x+=dx;y+=dy;if(x<0||y<0||x>=5||y>=5)break;const tag=[x,y,dx,dy].join();if(seen.has(tag))break;seen.add(tag);
        const m=items.findIndex(v=>cell(v[0],5)===y*5+x);if(m>=0)[dx,dy]=base[m]^((mask>>m)&1)?[dy,dx]:[-dy,-dx];}
      if(!(x===5&&y===(rx/5|0)))continue;
      for(let i=0;i<items.length&&!score();i++){if(mask>>i&1)g.press('action');g.press('right');}break;
    }
  });
  solve('single-stroke',g=>{const s=g.describe(),[cols,rows]=s.match(/(\d+) columns, (\d+) rows/).slice(1).map(Number),blocked=new Set(list(s.match(/Blocked cells: ([^.]+)/)[1],cols)),start=cell(s.match(/At (\w+)/)[1],cols);
    function paint(p){if(p.length===cols*rows-blocked.size)return [];const last=p.at(-1),x=last%cols,y=last/cols|0;
      for(const [k,dx,dy] of directions){const nx=x+dx,ny=y+dy,n=ny*cols+nx;if(nx<0||nx>=cols||ny<0||ny>=rows||p.includes(n)||blocked.has(n))continue;const tail=paint([...p,n]);if(tail)return [k,...tail];}return null;}
    paint([start]).forEach(k=>g.press(k));
  });
  solve('ghost-stamps',(g,score)=>{
    const cols=Number(g.describe().match(/(\d+) columns/)[1]),remember=new Map();
    const reveal=i=>{cursor(g,cols,i);g.press('action');const d=g.describe(true),m=d.match(/column \d+, (?:matched )?(diamond|circle|triangle|cross|square|star)\./);if(m){if(!remember.has(m[1]))remember.set(m[1],new Set());remember.get(m[1]).add(i);}};
    for(let i=0;i<2*cols&&!score();i+=2){reveal(i);reveal(i+1);g.update(.72,new Set());}
    for(const pair of remember.values()){if(score())break;const [a,b]=[...pair];cursor(g,cols,a);if(g.describe(true).includes('matched '))continue;reveal(a);reveal(b);}
  });
  solve('cargo-spires',g=>{for(const dock of 'ABACBC'){for(let i=0;i<3&&!g.describe(true).startsWith('Dock '+dock+',');i++)g.press('right');g.press('action');}});
  solve('word-wire',g=>{assert(g.describe().includes('Clue: A star flares'));for(const letter of 'NOVA'){for(let i=0;i<4&&!g.describe(true).startsWith('Letter '+letter+' ');i++)g.press('right');g.press('action');}});
  solve('lunar-berth',g=>{
    const s=g.describe(),m=s.match(/Tug: (\w+) orbit, sector (\d+). Dock: (\w+) orbit, sector (\d+)/),rings=['inner','middle','outer'];
    const start=[rings.indexOf(m[1]),Number(m[2])-1],goal=[rings.indexOf(m[3]),Number(m[4])-1];const moves=route(start,p=>p.join(),([r,a])=>[['up',1],['down',-1],['right',0]].filter(([,d])=>r+d>=0&&r+d<3).map(([k,d])=>[k,[r+d,(a+3-(r+d))%8]]),p=>p.join()===goal.join());moves.forEach(k=>g.press(k));assert(g.describe().includes('Aligned'));g.press('action');
  });
}
console.log('PASS · 12 board and move readouts, 120 scored keyboard solves from board descriptions, 1 timing game without a textual board.');
