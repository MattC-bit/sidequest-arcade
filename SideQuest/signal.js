/* Signal cartridge collection. All coordinates are in the arcade's 640 × 360 space. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const ink = '#081020', white = '#edf7ff', muted = '#b0c4d6', amber = '#ffd279', pink = '#ff8fa9';
  const arrows = {left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]};
  const random = n => Math.floor(Math.random()*n);
  const mod = (x,n) => (x%n+n)%n;
  const shuffle = list => {
    const copy = [...list];
    for (let i=copy.length-1;i>0;i--) { const j=random(i+1); [copy[i],copy[j]]=[copy[j],copy[i]]; }
    return copy;
  };
  function text(c, str, x, y, size=16, color=white, align='center', bold=false) {
    c.fillStyle=color; c.font=`${bold?'bold ':''}${size}px ui-monospace, monospace`; c.textAlign=align;
    c.textBaseline='middle'; c.fillText(str,x,y);
  }
  function line(c,x,y,x2,y2,color,width=2) {
    c.beginPath(); c.strokeStyle=color; c.lineWidth=width; c.moveTo(x,y); c.lineTo(x2,y2); c.stroke();
  }
  function circle(c,x,y,r,col,fill=true,w=2) {
    c.beginPath(); c.arc(x,y,r,0,TAU); if(fill){c.fillStyle=col;c.fill();}else{c.lineWidth=w;c.strokeStyle=col;c.stroke();}
  }
  function box(c,x,y,w,h,r,bg,stroke=null) {
    c.beginPath(); c.roundRect(x,y,w,h,r); c.fillStyle=bg; c.fill();
    if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke();}
  }
  function bounds(x,y,b){return x>=b.x&&y>=b.y&&x<b.x+b.w&&y<b.y+b.h;}
  function grid(cols, rows, size, cx=320, cy=178) {
    return {cols,rows,size,x:cx-size*cols/2,y:cy-size*rows/2};
  }
  function pos(g,i){return [g.x+(i%g.cols+.5)*g.size,g.y+(Math.floor(i/g.cols)+.5)*g.size];}
  function at(g,x,y){if(!bounds(x,y,{x:g.x,y:g.y,w:g.cols*g.size,h:g.rows*g.size}))return -1;
    return Math.floor((x-g.x)/g.size)+Math.floor((y-g.y)/g.size)*g.cols;}
  function nav(i,key,cols,rows){const d=arrows[key];if(!d)return i;
    return mod(i%cols+d[0],cols)+cols*mod(Math.floor(i/cols)+d[1],rows);}
  function cursor(c,g,i,color){const [x,y]=pos(g,i),h=g.size/2-1,l=8;
    for(const a of [-1,1])for(const b of [-1,1]){line(c,x+a*h,y+b*h,x+a*(h-l),y+b*h,color,2);line(c,x+a*h,y+b*h,x+a*h,y+b*(h-l),color,2);}}
  function tiles(c,g,fn){for(let i=0;i<g.cols*g.rows;i++){const [x,y]=pos(g,i);fn(i,x,y,g.size);}}
  function plate(c,x,y,s,bg,stroke){box(c,x-s/2+4,y-s/2+4,s-8,s-8,6,bg,stroke);}
  // A common bezel leaves the playfield readable in the floating cabinet as well as fullscreen.
  const stampNames=['diamond','circle','triangle','cross','square','star'];
  const coordinates=(i,cols)=>i<0?'outside':`row ${Math.floor(i/cols)+1} column ${i%cols+1}`;
  const compactCell=(i,cols)=>`${String.fromCharCode(65+i%cols)}${Math.floor(i/cols)+1}`;
  const cellList=(cells,cols)=>cells.map(i=>compactCell(i,cols)).join(', ')||'none';
  function register(meta, init){
    SQ.register({...meta,group:'Signal',create(api){let elapsed=0,level=1,wait=0,msg='',msgTime=0;
      const state={get level(){return level;},get t(){return elapsed;}, color:meta.color,
        get still(){return !!api.reduced;},
        success(label='Signal locked',points=5){if(wait)return;api.score(points);api.sound('good');wait=.75;msg=label;msgTime=.75;},
        warn(label){api.sound('hit');msg=label;msgTime=.8;}, blip(){api.sound('tap');}};
      let play=init(state);
      return {...(play.describe?{describe(short=false){
        const prefix=wait?msg+'. Next stage shortly. ':msgTime>0?msg+'. ':'';
        return prefix+play.describe(short);
      }}:{}),update(dt,input){elapsed+=dt;msgTime=Math.max(0,msgTime-dt);
        if(wait>0){wait-=dt;if(wait<=0){wait=0;level++;play=init(state);}return;}
        play.update?.(dt,input);},press(k){if(!wait)play.press?.(k);},tap(x,y){if(!wait)play.tap?.(x,y);},
        draw(c){c.save();const bg=c.createLinearGradient(0,0,640,360);bg.addColorStop(0,'#151b31');bg.addColorStop(.55,ink);bg.addColorStop(1,'#12192b');c.fillStyle=bg;c.fillRect(0,0,640,360);
          for(let i=0;i<44;i++){const x=(i*137+31)%640,y=(i*i*17+49)%360;c.fillStyle=i%4===0?meta.color+'58':'#7184a238';c.fillRect(x,y,i%5===0?3:1.5,1.5);}
          text(c,meta.title.toUpperCase(),20,21,15,meta.color,'left',true);text(c,`STAGE ${String(level).padStart(2,'0')}`,620,21,13,muted,'right');
          line(c,20,37,620,37,'#33415a',1);play.draw(c);
          if(msgTime>0){box(c,148,304,344,39,9,'#111d31',wait?meta.color:pink);text(c,msg,320,324,16,wait?meta.color:pink);}
          c.restore();}};}});
  }
  function gridControls(g,n,activate){let selected=n;return {get selected(){return selected;},
    press(k){if(k==='action')activate(selected);else selected=nav(selected,k,g.cols,g.rows);},
    tap(x,y){const i=at(g,x,y);if(i>=0){selected=i;activate(i);}}};}

  register({id:'night-switch',speakMoves:true,title:'Night Switch',color:'#72efd5',hint:'Switch every window off. Each press flips a cross.',controls:'Arrows select · Space flips · Tap a window'},s=>{
    const g=grid(3,3,65), a=Array(9).fill(false);
    function flip(i){for(let j=0;j<9;j++)if(Math.abs(i%3-j%3)+Math.abs((i/3|0)-(j/3|0))<=1)a[j]=!a[j];}
    shuffle([...a.keys()]).slice(0,Math.min(5,1+s.level)).forEach(flip);
    const ctl=gridControls(g,4,i=>{flip(i);s.blip();if(!a.includes(true))s.success('Block asleep');});
    return {press:ctl.press,tap:ctl.tap,describe(short){const i=ctl.selected;
      const selection=`${coordinates(i,3)}, ${a[i]?'lit':'dark'}.`;
      return short?selection:`Three by three grid. ${selection} Lit windows: ${cellList(a.flatMap((on,j)=>on?[j]:[]),3)}. Columns A to C, rows 1 to 3. Switch all off.`;},draw(c){
      for(let i=0;i<11;i++){const h=35+(i*73%100);box(c,i*65-5,298-h,56,h,3,'#18243a');c.fillStyle='#466175';for(let j=0;j<3;j++)c.fillRect(i*65+j*14+3,298-h+12,4,4);}
      box(c,g.x-10,g.y-12,215,219,6,'#223249','#466078');tiles(c,g,(i,x,y,z)=>{plate(c,x,y,z,a[i]?s.color:'#0b1625',a[i]?'#c6fff4':'#34465b');line(c,x,y-z*.35,x,y+z*.35,a[i]?'#378779':'#26384b',3);line(c,x-z*.35,y,x+z*.35,y,a[i]?'#378779':'#26384b',3);});cursor(c,g,ctl.selected,white);
      text(c,`${a.filter(Boolean).length} windows lit`,320,324,16,muted);}};
  });

  function stamp(c,i,x,y,col) {
    const r=13;
    if(i===1){circle(c,x,y,r,col);return;}
    if(i===3){line(c,x-r,y,x+r,y,col,6);line(c,x,y-r,x,y+r,col,6);return;}
    if(i===4){box(c,x-r,y-r,2*r,2*r,2,col);return;}
    c.beginPath();
    const n=i===2?3:i===5?8:4;
    for(let j=0;j<n;j++){const a=j*TAU/n-Math.PI/2,rad=i===5&&j%2?r*.4:r;
      const xx=x+rad*Math.cos(a),yy=y+rad*Math.sin(a);if(j)c.lineTo(xx,yy);else c.moveTo(xx,yy);}
    c.closePath();c.fillStyle=col;c.fill();
  }
  register({id:'echo-array',speakMoves:true,title:'Echo Array',color:'#dbabff',hint:'Watch the pulse sequence, then repeat it in order.',controls:'Arrows select · Space plays · Tap a pad'},s=>{
    const g=grid(4,1,82,320,184),seq=Array.from({length:Math.min(6,s.level+2)},()=>random(4));
    let t=0,step=0,recent=-1,flash=0;const beats=.66,total=.55+seq.length*beats;
    const ctl=gridControls(g,0,i=>{if(t<total)return;if(i!==seq[step]){step=0;t=0;s.warn('Listen again');return;}recent=i;flash=.23;s.blip();step++;if(step===seq.length)s.success('Echo matched');});
    return {press:ctl.press,tap:ctl.tap,describe(short){
      const selected=`Pad ${ctl.selected+1}, ${stampNames[ctl.selected]}.`;
      if(t<total)return `Receiving ${seq.length} pulses. Use Read board after the pads stop. ${selected}`;
      if(short)return `${selected} ${step} of ${seq.length} entered.`;
      return `Received: ${seq.map(i=>stampNames[i]).join(', ')}. ${selected} ${step} of ${seq.length} entered. Left to right: diamond, circle, triangle, cross.`;},update(dt){t+=dt;flash-=dt;},draw(c){const beat=Math.floor((t-.55)/beats),lit=t<total&&beat>=0&&((t-.55)%beats)<.46?seq[beat]:flash>0?recent:-1;
      text(c,t<total?'RECEIVING':'TRANSMIT',320,95,19,s.color,'center',true);
      tiles(c,g,(i,x,y,z)=>{plate(c,x,y,z,lit===i?s.color:'#292240',lit===i?white:'#65517c');stamp(c,i,x,y,lit===i?ink:white);});cursor(c,g,ctl.selected,white);
      for(let i=0;i<seq.length;i++)circle(c,320+(i-(seq.length-1)/2)*21,265,5,i<step?s.color:'#40506a');text(c,t<total?'Watch the pads':'Repeat the pattern',320,324,16,muted);}};
  });

  register({id:'phase-radio',speakMoves:true,title:'Phase Radio',color:'#7deaff',hint:'Match the waveform by tuning its frequency and phase.',controls:'← → frequency · ↑ ↓ phase · Tap the dials'},s=>{
    const targetF=2+random(4),targetP=random(4);let f=1,p=mod(targetP+1,4);
    function tune(k){if(k==='left')f=mod(f-2,6)+1;else if(k==='right')f=f%6+1;else if(k==='up')p=(p+1)%4;else if(k==='down')p=mod(p-1,4);else return;
      s.blip();if(f===targetF&&p===targetP)s.success('Carrier aligned');}
    const keys=['left','right','down','up'];return {press:tune,describe(short){
      const state=`Frequency ${f}, phase ${p}.`;
      return short?state:state+` Target frequency ${targetF}, phase ${targetP}.`;
    },tap(x,y){if(y>=235&&y<=295&&x>=60&&x<580)tune(keys[Math.floor((x-60)/130)]);},draw(c){
      box(c,57,60,526,155,12,'#071b28','#335963');for(let i=0;i<12;i++)line(c,72+i*45,70,72+i*45,205,'#183944',1);
      for(let i=0;i<5;i++)line(c,68,80+i*28,572,80+i*28,'#183944',1);
      for(const [a,b,col,w] of [[targetF,targetP,amber,4],[f,p,s.color,2]]){c.beginPath();c.lineWidth=w;c.strokeStyle=col;for(let i=0;i<=490;i+=2){const y=139+Math.sin(i/490*a*TAU+b*TAU/4)*40;if(i)c.lineTo(75+i,y);else c.moveTo(75+i,y);}c.stroke();}
      keys.forEach((k,i)=>{box(c,63+130*i,239,124,48,7,'#203146','#486276');text(c,['FREQ −','FREQ +','PHASE −','PHASE +'][i],125+130*i,263,16,white);});
      text(c,`Gold ${targetF} / ${targetP}     Cyan ${f} / ${p}`,320,324,16,muted);}};
  });

  register({id:'nanogram',speakMoves:true,title:'Nanogram',color:'#c2f879',hint:'Light cells to match the run lengths beside each row and column.',controls:'Arrows select · Space toggles · Tap a cell'},s=>{
    const puzzles=['111010010','110011001','100111001','101111010','111101101','010111010','110110001','101010101'];
    const target=[...puzzles[(s.level-1)%puzzles.length]].map(Number),a=Array(9).fill(0),g=grid(3,3,58,342,187);
    const runs=bits=>bits.join('').split(/0+/).filter(Boolean).map(run=>run.length).join(' ')||'0';
    const rows=x=>[0,1,2].map(i=>runs(x.slice(i*3,i*3+3))),cols=x=>[0,1,2].map(i=>runs([x[i],x[i+3],x[i+6]]));
    const rr=rows(target),cc=cols(target);const ctl=gridControls(g,0,i=>{a[i]^=1;s.blip();if(rows(a).join('|')===rr.join('|')&&cols(a).join('|')===cc.join('|'))s.success('Pattern etched');});
    return {press:ctl.press,tap:ctl.tap,describe(short){const i=ctl.selected;
      const selected=`${coordinates(i,3)}, ${a[i]?'filled':'blank'}. Row clue ${rr[Math.floor(i/3)]}, column clue ${cc[i%3]}.`;
      if(short)return selected;
      return `Three by three nonogram. Row clues: ${rr.join('; ')}. Column clues: ${cc.join('; ')}. Filled cells: ${cellList(a.flatMap((on,j)=>on?[j]:[]),3)}. Columns A to C. ${selected}`;
    },draw(c){tiles(c,g,(i,x,y,z)=>{plate(c,x,y,z,a[i]?s.color:'#18283a','#3d5261');if(a[i]){line(c,x-10,y,x-2,y+8,ink,3);line(c,x-2,y+8,x+12,y-9,ink,3);}else circle(c,x,y,2,'#728499');});cursor(c,g,ctl.selected,white);
      for(let i=0;i<3;i++){text(c,rr[i],g.x-26,pos(g,3*i)[1],18,rows(a)[i]===rr[i]?s.color:muted);text(c,cc[i],pos(g,i)[0],g.y-24,18,cols(a)[i]===cc[i]?s.color:muted);}
      text(c,'Numbers count consecutive lit cells',320,324,16,muted);}};
  });

  const iceMaps=[['......','...#..','.S...#','...#..','.....G'],['...#..','.S....','....#.','.#....','G...#.'],['..G...','.#....','....#.','..S...','...#..']];
  // Pick a reachable stopping square using the actual ice rules. Harder stages travel farther.
  register({id:'ice-relay',speakMoves:true,title:'Ice Relay',color:'#8fd9ff',hint:'Slide until the next wall. Stop on the beacon.',controls:'Arrows slide · Tap a direction beside the drone'},s=>{
    const map=iceMaps[(s.level-1)%iceMaps.length].join(''),g=grid(6,5,43);let pilot=map.indexOf('S'),trail=[];
    function slide(from,[dx,dy]){let x=from%6,y=from/6|0;while(x+dx>=0&&x+dx<6&&y+dy>=0&&y+dy<5&&map[(y+dy)*6+x+dx]!=='#'){x+=dx;y+=dy;}return y*6+x;}
    const reachable=[pilot],dist=new Map([[pilot,0]]);for(let q=0;q<reachable.length;q++)for(const d of Object.values(arrows)){const n=slide(reachable[q],d);if(!dist.has(n)){dist.set(n,dist.get(reachable[q])+1);reachable.push(n);}}
    const target=reachable.filter(n=>dist.get(n)>=Math.min(2+s.level,Math.max(...dist.values())));const goal=target[random(target.length)];
    function move(k){if(!arrows[k])return;const next=slide(pilot,arrows[k]);if(next===pilot)return;trail=[pilot,next];pilot=next;s.blip();if(pilot===goal)s.success('Beacon reached');}
    return {press:move,describe(short){
      const state=`Drone at ${compactCell(pilot,6)}. Beacon at ${compactCell(goal,6)}.`;
      if(short)return state;
      const stops=Object.entries(arrows).map(([k,d])=>k+' to '+compactCell(slide(pilot,d),6)).join('; ');
      return `Six columns A to F, five rows. ${state} Walls: ${cellList([...map].flatMap((v,i)=>v==='#'?[i]:[]),6)}. From here: ${stops}.`;
    },tap(x,y){const [px,py]=pos(g,pilot);if(Math.hypot(x-px,y-py)>10)move(Math.abs(x-px)>Math.abs(y-py)?(x<px?'left':'right'):(y<py?'up':'down'));},draw(c){tiles(c,g,(i,x,y,z)=>{plate(c,x,y,z,map[i]==='#'?'#47647b':'#102c41','#2d4d66');if(map[i]==='#'){line(c,x-9,y+8,x+6,y-7,'#7290a6',3);}else circle(c,x,y,1.7,'#557c91');});if(trail.length){const a=pos(g,trail[0]),b=pos(g,trail[1]);line(c,...a,...b,s.color+'66',4);}const [gx,gy]=pos(g,goal);circle(c,gx,gy,13,amber,false,3);circle(c,gx,gy,5,amber);const [x,y]=pos(g,pilot);box(c,x-13,y-12,26,24,7,s.color);line(c,x-6,y,x+6,y,ink,3);text(c,'Ice carries you to a wall',320,324,16,muted);}};
  });

  register({id:'bit-forge',speakMoves:true,title:'Bit Forge',color:'#ffbc75',hint:'Flip the bit switches to forge the target number.',controls:'← → select · Space flips · Tap a switch'},s=>{
    const g=grid(5,1,75,320,198);let val=0,goal=1+random(s.level===1?15:31);
    const ctl=gridControls(g,4,i=>{val^=1<<(4-i);s.blip();if(val===goal)s.success('Word compiled');});
    return {press:ctl.press,tap:ctl.tap,describe(short){const bit=1<<(4-ctl.selected);
      const detail=`Switch ${bit} ${val&bit?'on':'off'}. Output ${val}; target ${goal}.`;
      return short?detail:`Switches from left to right: ${[16,8,4,2,1].map(n=>n+' '+(val&n?'on':'off')).join(', ')}. ${detail}`;},draw(c){text(c,`TARGET  ${String(goal).padStart(2,'0')}`,320,89,28,s.color,'center',true);
      tiles(c,g,(i,x,y,z)=>{const n=1<<(4-i),on=val&n;box(c,x-26,y-35,52,70,12,'#1d283c',on?s.color:'#536479');box(c,x-20,y+(on?-28:1),40,27,7,on?s.color:'#56647b');text(c,String(n),x,y+61,17,white,'center',true);});cursor(c,g,ctl.selected,white);
      text(c,`OUTPUT  ${String(val).padStart(2,'0')}`,320,324,17,s.color);}};
  });
  // Mirrors are indexed by position; all suggested circuits have a constructive solution.
  const circuits=[{mirror:[7,17],goal:19},{mirror:[6,16,18,8],goal:9},{mirror:[5,20,23,13],goal:14}];
  register({id:'prism-post',speakMoves:true,title:'Prism Post',color:'#ffa1d8',hint:'Rotate the mirrors to carry the beam to the receiver on the right.',controls:'← → select mirror · Space rotates · Tap a mirror'},s=>{
    const g=grid(5,5,43,320,178),layout=circuits[(s.level-1)%3],mirrors=layout.mirror;
    // The intended path always enters from the left and turns down, right, up, right.
    const solved=mirrors.length===2?[1,1]:[1,1,0,0];const orientation=solved.map(v=>v);shuffle([...orientation.keys()]).slice(0,Math.min(s.level,mirrors.length)).forEach(i=>orientation[i]^=1);
    let selected=0;
    function ray(){let x=-1,y=1,dx=1,dy=0;const path=[[x,y]],seen=new Set();
      while(true){x+=dx;y+=dy;path.push([x,y]);if(x===5&&y===(layout.goal/5|0))return {path,ok:true};if(x<0||y<0||x>=5||y>=5)return {path,ok:false};
        const mark=`${x},${y},${dx},${dy}`;if(seen.has(mark))return {path,ok:false};seen.add(mark);const i=mirrors.indexOf(y*5+x);if(i>=0)[dx,dy]=orientation[i]?[dy,dx]:[-dy,-dx];}}
    function rotate(i){orientation[i]^=1;s.blip();if(ray().ok)s.success('Receiver online');}
    return {describe(short){
      const slope=i=>orientation[i]?'backslash':'slash';
      const sel=`Mirror ${selected+1} at ${compactCell(mirrors[selected],5)}, ${slope(selected)}.`;
      if(short)return sel;
      const ends=ray().path.at(-1), destination=ends[0]<0?'west':ends[0]>=5?'east':ends[1]<0?'north':ends[1]>=5?'south':'loop';
      return `Five by five grid. Beam enters from west at A2. Receiver on east of ${compactCell(layout.goal,5)}. Mirrors: ${mirrors.map((n,i)=>compactCell(n,5)+' '+slope(i)).join(', ')}. Beam ends ${destination}. ${sel}`;
    },press(k){if(k==='action')rotate(selected);else if(arrows[k])selected=mod(selected+(['left','up'].includes(k)?-1:1),mirrors.length);},tap(x,y){const i=mirrors.indexOf(at(g,x,y));if(i>=0){selected=i;rotate(i);}},draw(c){tiles(c,g,(i,x,y,z)=>{plate(c,x,y,z,'#1b2136','#363c54');});
      const {path}=ray();for(let i=1;i<path.length;i++){const [a,b]=path[i-1],[d,e]=path[i];const xx=u=>g.x+(u+.5)*g.size,yy=u=>g.y+(u+.5)*g.size;line(c,xx(a),yy(b),xx(d),yy(e),s.color+'44',8);line(c,xx(a),yy(b),xx(d),yy(e),s.color,2);}
      mirrors.forEach((idx,i)=>{const [x,y]=pos(g,idx),slope=orientation[i]?1:-1;line(c,x-12,y-12*slope,x+12,y+12*slope,white,4);});cursor(c,g,mirrors[selected],white);
      const startY=pos(g,5)[1],endY=pos(g,layout.goal)[1];text(c,'TX ▶',g.x-34,startY,14,s.color);text(c,'◉ RX',g.x+g.size*5+31,endY,14,amber);text(c,'Turn a mirror to route the light',320,324,16,muted);}};
  });

  const trails=[{cols:4,rows:3,closed:[3,7],start:0},{cols:4,rows:4,closed:[0,3,7],start:1},{cols:5,rows:3,closed:[0,4],start:1}];
  register({id:'single-stroke',speakMoves:true,title:'Single Stroke',color:'#9af5af',hint:'Paint every open tile in one trail. Backtrack one tile to undo.',controls:'Arrows trace · Tap a neighbor · Space undoes'},s=>{
    const m=trails[(s.level-1)%trails.length],g=grid(m.cols,m.rows,55);const path=[m.start];
    function trace(n){if(path.length>1&&n===path[path.length-2]){path.pop();s.blip();return;}if(path.includes(n)||m.closed.includes(n))return;
      const last=path[path.length-1];if(Math.abs(last%g.cols-n%g.cols)+Math.abs((last/g.cols|0)-(n/g.cols|0))!==1)return;
      path.push(n);s.blip();if(path.length===g.cols*g.rows-m.closed.length)s.success('Rail complete');}
    return {describe(short){
      const here=path.at(-1), state=`At ${compactCell(here,g.cols)}. ${path.length} of ${g.cols*g.rows-m.closed.length} painted.`;
      if(short)return state;
      return `${g.cols} columns, ${g.rows} rows. ${state} Blocked cells: ${cellList(m.closed,g.cols)}. Painted from start: ${cellList(path,g.cols)}. Space undoes the last move.`;
    },press(k){if(k==='action'){if(path.length>1)path.pop();return;}if(arrows[k]){const last=path[path.length-1],[dx,dy]=arrows[k],x=last%g.cols+dx,y=(last/g.cols|0)+dy;if(x>=0&&x<g.cols&&y>=0&&y<g.rows)trace(y*g.cols+x);}},tap(x,y){const n=at(g,x,y);if(n>=0)trace(n);},draw(c){tiles(c,g,(i,x,y,z)=>{if(!m.closed.includes(i)){plate(c,x,y,z,path.includes(i)?'#274f48':'#172b36','#39565c');circle(c,x,y,2,muted);}});
      for(let i=1;i<path.length;i++)line(c,...pos(g,path[i-1]),...pos(g,path[i]),s.color,6);
      const [x,y]=pos(g,path[path.length-1]);circle(c,x,y,12,s.color);circle(c,x,y,5,'#244642');text(c,`${path.length} / ${g.cols*g.rows-m.closed.length} tiles`,320,324,16,muted);}};
  });

  register({id:'ghost-stamps',speakMoves:true,title:'Ghost Stamps',color:'#dec5ff',hint:'Reveal two stamps at a time. Find all the matching pairs.',controls:'Arrows select · Space reveals · Tap a stamp'},s=>{
    const pairs=Math.min(6,s.level+3),g=grid(pairs,2,pairs>5?66:72),deck=shuffle(Array.from({length:pairs*2},(_,i)=>i%pairs));const found=new Set();
    let open=[],checking=0;
    const ctl=gridControls(g,0,i=>{if(checking||found.has(i)||open.includes(i))return;open.push(i);s.blip();if(open.length===2){if(deck[open[0]]===deck[open[1]]){open.forEach(j=>found.add(j));open=[];if(found.size===deck.length)s.success('Archive restored');}else checking=.7;}});
    return {press:ctl.press,tap:ctl.tap,describe(short){
      const i=ctl.selected, describeCell=j=>found.has(j)?'matched '+stampNames[deck[j]]:open.includes(j)?stampNames[deck[j]]:'face down';
      const state=`${coordinates(i,pairs)}, ${describeCell(i)}. ${found.size/2} pairs matched.`;
      if(short)return state;
      return `${pairs} columns, two rows. ${state} Showing: ${open.map(j=>compactCell(j,pairs)+' '+stampNames[deck[j]]).join(', ')||'none'}. Matched cells: ${cellList([...found],pairs)}.`;
    },update(dt){if(checking>0){checking-=dt;if(checking<=0){checking=0;open=[];}}},draw(c){tiles(c,g,(i,x,y,z)=>{const visible=found.has(i)||open.includes(i);plate(c,x,y,z,found.has(i)?'#38414d':visible?'#473857':'#20253d',found.has(i)?'#667b7a':visible?s.color:'#695b83');if(visible){stamp(c,deck[i],x,y,found.has(i)?'#a6c5be':s.color);}else{for(let j=-1;j<=1;j++)line(c,x-11,y+j*6,x+11,y+j*6,'#64597c',2);}});cursor(c,g,ctl.selected,white);
      text(c,`${found.size/2} / ${pairs} matched pairs`,320,324,16,muted);}};
  });

  register({id:'cargo-spires',speakMoves:true,title:'Cargo Spires',color:'#ffcd87',hint:'Move the stack to dock C. Small cargo may sit on larger cargo.',controls:'← → choose dock · Space pick/place · Tap a dock'},s=>{
    const n=s.level===1?2:3,stacks=[Array.from({length:n},(_,i)=>n-i),[],[]];let from=-1,sel=0;
    const xs=[143,320,497];function pick(i){if(from<0){if(stacks[i].length){from=i;s.blip();}return;}if(from===i){from=-1;return;}const src=stacks[from],dst=stacks[i],disc=src[src.length-1];
      if(dst.length&&dst[dst.length-1]<disc){s.warn('Large cargo needs a wider base');return;}dst.push(src.pop());from=-1;s.blip();if(stacks[2].length===n)s.success('Freight delivered');}
    return {describe(short){
      const selected=`Dock ${'ABC'[sel]}, ${stacks[sel].length?'top crate '+stacks[sel].at(-1):'empty'}.`;
      const held=from<0?'Choose a crate.':`Holding crate ${stacks[from].at(-1)} from ${'ABC'[from]}.`;
      if(short)return selected+' '+held;
      return `Goal: move the stack to C. Crates from bottom to top: ${stacks.map((v,i)=>'ABC'[i]+' '+(v.join(', ')||'empty')).join('; ')}. ${selected} ${held}`;
    },press(k){if(k==='left'||k==='right')sel=mod(sel+(k==='left'?-1:1),3);if(k==='action')pick(sel);},tap(x,y){if(y<65||y>298)return;sel=Math.max(0,Math.min(2,Math.floor((x-55)/177)));pick(sel);},draw(c){for(let i=0;i<3;i++){const x=xs[i];line(c,x,132,x,254,'#728294',5);box(c,x-72,254,144,13,6,'#465367',sel===i?s.color:null);text(c,'ABC'[i],x,284,17,sel===i?white:muted,'center',true);
      stacks[i].forEach((disc,j)=>{const held=from===i&&j===stacks[i].length-1;const w=37+disc*24,y=held?100:240-j*25,col=['',s.color,'#8ddccc','#b4aceb'][disc];box(c,x-w/2,y-10,w,20,4,col,held?white:null);for(let mark=0;mark<disc;mark++)line(c,x+(mark-(disc-1)/2)*8,y-3,x+(mark-(disc-1)/2)*8,y+3,'#344051',2);});}
      text(c,from<0?'Pick a top crate':'Choose its destination',320,324,16,muted);}};
  });

  register({id:'orbital-escapement',title:'Orbital Escapement',color:'#ffb392',hint:'Latch three orbiting hands as each enters its gold gate.',controls:'Space or tap to latch the current hand'},s=>{
    let ring=0,t=0,miss=0;const gates=Array.from({length:3},()=>Math.random()*TAU),locks=[];
    const hand=i=>mod(t*(1.45+i*.56+Math.min(1,s.level*.12))*(i===1?-1:1)+gates[i]+Math.PI,TAU);
    function latch(){if(miss>0)return;const diff=Math.abs(mod(hand(ring)-gates[ring]+Math.PI,TAU)-Math.PI);if(diff>.38){miss=.35;s.warn('Catch the gold arc');return;}locks.push(hand(ring));ring++;s.blip();if(ring===3)s.success('Escapement released');}
    return {update(dt){t+=dt;miss=Math.max(0,miss-dt);},press(k){if(k==='action')latch();},tap:latch,draw(c){const cx=320,cy=176;
      for(let i=0;i<3;i++){const r=102-i*25;circle(c,cx,cy,r,i===ring?'#65798c':'#354658',false,2);c.beginPath();c.strokeStyle=i<ring?'#89d9ba':amber;c.lineWidth=8;c.arc(cx,cy,r,gates[i]-.38,gates[i]+.38);c.stroke();const a=i<ring?locks[i]:hand(i);if(i<=ring){const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;circle(c,x,y,i===ring?8:5,i===ring?white:'#89d9ba');}}
      text(c,`${Math.min(ring,3)} / 3`,cx,cy,20,s.color,'center',true);text(c,'Latch when the white hand enters gold',320,324,16,muted);}};
  });

  const words=[['NOVA','A star flares'],['ECHO','A returning sound'],['ORBIT','A path around a world'],['PRISM','It splits a beam'],['COMET','An icy visitor'],['PULSE','One heartbeat'],['FLUX','Continuous change'],['ION','A charged atom'],['LUNAR','Of the moon'],['PIXEL','One point of light'],['LASER','A focused beam'],['STATIC','Radio noise']];
  register({id:'word-wire',speakMoves:true,title:'Word Wire',color:'#94d9ff',hint:'Solve the clue by selecting letters in the right order.',controls:'← → select · Space enters · ↓ undo · Tap letters or Undo'},s=>{
    const [word,clue]=words[(s.level-1)%words.length];let letters=shuffle([...word]);if(letters.join('')===word)letters.push(letters.shift());const g=grid(letters.length,1,68,320,223),entered=[];let sel=0;
    function enter(i){if(entered.includes(i))return;if(letters[i]!==word[entered.length]){s.warn('Try another letter');return;}entered.push(i);s.blip();if(entered.length===letters.length)s.success('Word transmitted');}
    return {describe(short){
      const detail=`Letter ${letters[sel]} at position ${sel+1}, ${entered.includes(sel)?'used':'available'}. Entered ${entered.map(i=>letters[i]).join('')||'nothing'}.`;
      return short?detail:`Clue: ${clue}. Letters from left to right: ${letters.join(', ')}. ${detail}`;
    },press(k){if(k==='action')enter(sel);if(k==='left'||k==='right')sel=mod(sel+(k==='left'?-1:1),letters.length);if(k==='down')entered.pop();},tap(x,y){const i=at(g,x,y);if(i>=0){sel=i;enter(i);}if(bounds(x,y,{x:265,y:272,w:110,h:36}))entered.pop();},draw(c){text(c,clue,320,83,20,white);text(c,[...word].map((_,i)=>i<entered.length?letters[entered[i]]:'_').join(' '),320,143,31,s.color,'center',true);
      tiles(c,g,(i,x,y,z)=>{plate(c,x,y,z,entered.includes(i)?'#162431':'#263c54',entered.includes(i)?'#354450':'#53738c');text(c,letters[i],x,y,28,entered.includes(i)?'#71818e':white,'center',true);});cursor(c,g,sel,white);box(c,265,272,110,34,6,'#1c293b','#455b72');text(c,'↶ Undo',320,290,16,muted);}};
  });

  register({id:'lunar-berth',title:'Lunar Berth',speakMoves:true,color:'#9ae6da',
    hint:'Plan orbit transfers to meet the dock. Inner, middle and outer orbits advance 3, 2 and 1 sectors per burn.',
    controls:'↑ wider · ↓ tighter · → or Space coast / dock · ← undo · Tap commands'},s=>{
    const sectors=8,ringNames=['inner','middle','outer'];
    const starting={ring:1,sector:(s.level-1)%sectors};
    function transfer(p,change){
      const next=p.ring+change;
      if(next<0||next>2)return null;
      return {ring:next,sector:(p.sector+3-next)%sectors};
    }
    const signature=p=>p.ring*sectors+p.sector;
    const equals=(p,q)=>signature(p)===signature(q);
    const paths=[{p:starting,d:0}],dist=new Map([[signature(starting),0]]);
    for(let i=0;i<paths.length;i++){
      const {p,d}=paths[i];
      for(const change of [-1,0,1]){
        const next=transfer(p,change);
        if(!next||dist.has(signature(next)))continue;
        paths.push({p:next,d:d+1});dist.set(signature(next),d+1);
      }
    }
    const desired=Math.min(4,s.level+1),choices=paths.filter(({p,d})=>p.ring!==starting.ring&&d===desired);
    const contract=choices[random(choices.length)]||paths.at(-1),target=contract.p;
    const budget=contract.d+2,log=[starting];let cursor=starting;
    function burn(k){
      if(k==='left'){if(log.length>1){log.pop();cursor=log.at(-1);s.blip();}return;}
      if(!['action','left','right','up','down'].includes(k))return;
      if(equals(cursor,target)&&(k==='action'||k==='right')){s.success('Docking collar secured',8);return;}
      if(log.length-1>=budget){s.warn('Fuel spent · Undo a burn');return;}
      const change=k==='up'?1:k==='down'?-1:0,next=transfer(cursor,change);
      if(!next){s.warn(change>0?'Already on outer orbit':'Already on inner orbit');return;}
      cursor=next;log.push(next);s.blip();
    }
    const locate=p=>ringNames[p.ring]+' orbit, sector '+(p.sector+1);
    const options=[['up','Wider orbit'],['down','Tighter orbit'],['action','Coast'],['left','Undo burn']];
    const cx=195,cy=175;
    function position(p){const a=p.sector*TAU/sectors-Math.PI/2,r=44+30*p.ring;return [cx+r*Math.cos(a),cy+r*Math.sin(a)];}
    return {press:burn,tap(x,y){
      if(x>=380&&x<601&&y>=123&&y<275)burn(options[Math.floor((y-123)/38)][0]);
    },describe(short){
      const here=`Tug: ${locate(cursor)}. Dock: ${locate(target)}. ${budget-log.length+1} burns left.`;
      if(equals(cursor,target))return here+' Aligned. Press Space to dock.';
      if(short)return here;
      const moves=[['Up',1],['Down',-1],['Space',0]].map(([name,n])=>{const next=transfer(cursor,n);return name+': '+(next?locate(next):'unavailable');}).join('. ');
      return here+' Sectors 1 to 8 go clockwise. '+moves+'. Left undoes a burn.';
    },draw(c){
      const moon=c.createRadialGradient(cx-7,cy-8,2,cx,cy,28);moon.addColorStop(0,'#cfdae3');moon.addColorStop(.55,'#8495a6');moon.addColorStop(1,'#344254');
      circle(c,cx,cy,25,moon);circle(c,cx-5,cy-7,6,'#8293a3');circle(c,cx+8,cy+6,4,'#637588');
      for(let ring=0;ring<3;ring++){
        circle(c,cx,cy,44+30*ring,ring===cursor.ring?'#587c86':'#364657',false,ring===cursor.ring?2:1);
        for(let sector=0;sector<sectors;sector++){const [x,y]=position({ring,sector});circle(c,x,y,2.5,'#91a8b7');}
      }
      for(let i=0;i<sectors;i++){const a=i*TAU/sectors-Math.PI/2;text(c,String(i+1),cx+121*Math.cos(a),cy+121*Math.sin(a),14,muted);}
      const [tx,ty]=position(target),[x,y]=position(cursor);
      box(c,tx-11,ty-11,22,22,5,'#493923',amber);line(c,tx-5,ty,tx+5,ty,amber,2);line(c,tx,ty-5,tx,ty+5,amber,2);
      if(log.length>1){const [px,py]=position(log[log.length-2]);line(c,px,py,x,y,s.color+'65',2);}
      circle(c,x,y,8,s.color);circle(c,x,y,3,ink);
      text(c,'RENDEZVOUS',381,71,14,s.color,'left',true);text(c,`${ringNames[target.ring].toUpperCase()}  /  ${target.sector+1}`,380,97,22,amber,'left',true);
      options.forEach(([key,label],i)=>{const yy=124+38*i;const shift=key==='up'?1:key==='down'?-1:0;
        const nxt=key==='left'?log[log.length-2]:transfer(cursor,shift);const latched=equals(cursor,target)&&key==='action';
        box(c,380,yy,220,32,5,latched?'#284742':'#172738',latched?s.color:'#455768');
        text(c,latched?'Dock now':label,390,yy+16,15,latched?s.color:white,'left');
        text(c,latched?'READY':nxt?ringNames[nxt.ring][0].toUpperCase()+' / '+(nxt.sector+1):'—',584,yy+16,14,muted,'right');});
      text(c,`${budget-log.length+1} burns left  ·  ${equals(cursor,target)?'Press Space to dock':'Meet the gold cross'}`,320,324,15,equals(cursor,target)?s.color:muted);
    }};
  });
})();
