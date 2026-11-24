/* Flux cartridges. All geometry lives in the arcade's 640 × 360 playfield. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const W = 640, H = 360;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const between = (lo, hi) => lo + Math.random() * (hi - lo);
  const choose = list => list[Math.floor(Math.random() * list.length)];
  const dist = (a,b,c,d) => Math.hypot(a-c,b-d);
  const dirs = {left:[-1,0], right:[1,0], up:[0,-1], down:[0,1]};
  const pink = '#ff728e', mint = '#65ffcc', ice = '#c8f8ff', gold = '#ffda71';
  const format = n => String(n).padStart(2,'0');
  function rect(c,x,y,w,h,fill){ c.fillStyle=fill;c.fillRect(x,y,w,h); }
  function dot(c,x,y,r,fill){c.fillStyle=fill;c.beginPath();c.arc(x,y,Math.max(0,r),0,TAU);c.fill();}
  function ring(c,x,y,r,stroke,width=1,start=0,end=TAU){c.strokeStyle=stroke;c.lineWidth=width;c.beginPath();c.arc(x,y,Math.max(0,r),start,end);c.stroke();}
  function line(c,points,stroke,width=1){c.strokeStyle=stroke;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
  function poly(c,points,fill,stroke){c.fillStyle=fill;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1.6;c.stroke();}}
  function type(c,s,x,y,size=12,color=ice,align='left',weight=700){c.font=weight+' '+size+'px system-ui, sans-serif';c.fillStyle=color;c.textAlign=align;c.textBaseline='middle';c.fillText(s,x,y);}
  function mono(c,s,x,y,size=11,color=ice,align='left'){c.font='bold '+size+'px ui-monospace, monospace';c.fillStyle=color;c.textAlign=align;c.textBaseline='middle';c.fillText(s,x,y);}
  function bg(c,top,bottom){const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,top);g.addColorStop(1,bottom);rect(c,0,0,W,H,g);}
  function stars(c,seed=1,count=58){for(let i=0;i<count;i++){const x=(i*113+seed*31+i*i*19)%W,y=(i*83+i*i*3+seed*47)%H;rect(c,x,y,1+i%2,1+i%2,i%4?'#9bbad349':'#d6eeff97');}}
  function jewel(c,x,y,r,col){poly(c,[[x,y-r],[x+r*.78,y],[x,y+r],[x-r*.78,y]],col);line(c,[[x-r*.48,y],[x,y-r*.58],[x+r*.4,y]],'#ffffffaa',1.5);}
  function crosshair(c,x,y,col){ring(c,x,y,11,col,1.5);for(let i=0;i<4;i++){const a=i*Math.PI/2;line(c,[[x+7*Math.cos(a),y+7*Math.sin(a)],[x+17*Math.cos(a),y+17*Math.sin(a)]],col,2);}}
  function sign(c,text,x=18,y=22){const width=12+text.length*7.1;rect(c,x-6,y-10,width,20,'#070b1acc');mono(c,text,x,y,11,'#e0faff');}
  function add(id,title,hint,controls,color,create){SQ.register({id,title,group:'Flux',hint,controls,color,create});}
  function moveAim(aim,dt,input,speed=245){const dx=+input.has('right')-+input.has('left'),dy=+input.has('down')-+input.has('up');const m=Math.hypot(dx,dy)||1;aim.x=clamp(aim.x+speed*dx*dt/m,16,624);aim.y=clamp(aim.y+speed*dy*dt/m,30,340);}

  add('split-orbit','Split Orbit','Catch the diamonds. Switch orbits before the red mines cross your path.','Action or tap switches orbit. Left / right adjusts speed.','#70e8ff',api=>{
    let a=0,r=68,target=68,items=[],next=.65,live=true,streak=0;
    function flip(){target=target===68?108:68;api.sound('tap');}
    return {press(k){if(k==='action'||k==='up'||k==='down')flip();},tap:flip,update(dt,input){
      if(!live)return;
      const speed=input.has('left')?1.15:input.has('right')?2.3:1.75;
      a+=dt*speed;r+=(target-r)*Math.min(1,dt*14);
      next-=dt;
      if(next<=0){next=between(.85,1.2);const lane=choose([68,108]),angle=a+between(1.3,1.9);
        items.push({angle,lane,good:true});if(Math.random()<.72)items.push({angle,lane:176-lane,good:false});}
      for(const item of items){if(item.used||Math.abs(item.angle-a)>.15||Math.abs(item.lane-r)>13)continue;item.used=true;
        if(item.good){api.score(1);api.sound('good');streak++;}else{live=false;api.sound('hit');api.end('Orbit broken');return;}}
      items=items.filter(e=>!e.used&&e.angle>a-.25);
    },draw(c){
      bg(c,'#07132c','#170c32');stars(c);const cx=320,cy=181;
      for(const lane of [68,108]){ring(c,cx,cy,lane,'#436084',1.8);for(let j=0;j<24;j++){const q=j*TAU/24;dot(c,cx+lane*Math.cos(q),cy+lane*Math.sin(q),1.5,'#8cb1cf');}}
      const g=c.createRadialGradient(cx-10,cy-14,0,cx,cy,36);g.addColorStop(0,'#fff2aa');g.addColorStop(.48,'#ff9976');g.addColorStop(1,'#a83778');dot(c,cx,cy,36,g);
      c.save();c.translate(cx,cy);c.rotate(-.27);c.scale(1,.28);ring(c,0,0,49,'#ffc3cd',4,.05,Math.PI+.2);c.restore();
      items.forEach(e=>{let x=cx+Math.cos(e.angle)*e.lane,y=cy+Math.sin(e.angle)*e.lane;if(e.good)jewel(c,x,y,9,mint);else{for(let j=0;j<6;j++){const q=j*TAU/6;line(c,[[x,y],[x+12*Math.cos(q),y+12*Math.sin(q)]],pink,2);}dot(c,x,y,6,'#a62751');}});
      const x=cx+r*Math.cos(a),y=cy+r*Math.sin(a);ring(c,cx,cy,r,'#53d7fa66',4,a-.29,a);dot(c,x,y,7,'#bdfbff');dot(c,x,y,3,'#318ede');sign(c,'SATELLITE  /  '+format(streak)+' CAPTURES');
    }};
  });

  add('magnet-jack','Magnet Jack','Drop the swinging magnet onto salvage. Skip the red spiked drums.','Action or tap drops the magnet when it lines up.','#ffc571',api=>{
    let t=0,a=0,length=54,mode='swing',held=null,items=[],lifted=0,status='';
    const baseX=320,baseY=40;
    function newItems(){items=[];for(let i=0;i<8;i++)items.push({x:82+i*68+between(-10,10),y:between(204,285),kind:i===2||i===5?'drum':Math.random()<.35?'core':'steel'});}
    newItems();
    function fire(){if(mode==='swing'){mode='drop';api.sound('tap');status='';}}
    return {press(k){if(k==='action'||k==='down')fire();},tap:fire,update(dt){
      t+=dt;if(mode==='swing'){a=Math.sin(t*1.6)*1.06;return;}
      length+=dt*(mode==='drop'?380:held?-228:-440);let x=baseX+Math.sin(a)*length,y=baseY+Math.cos(a)*length;
      if(mode==='drop'){held=items.find(q=>dist(x,y,q.x,q.y)<24)||null;if(held||x<20||x>620||y>317){mode='lift';if(held){items=items.filter(q=>q!==held);api.sound(held.kind==='drum'?'hit':'tap');}}}
      if(mode==='lift'&&length<=54){length=54;mode='swing';if(held){let points=held.kind==='drum'?0:held.kind==='core'?3:1;
        if(points){api.score(points);api.sound('good');lifted++;}status=points?'SALVAGED +'+points:'SCRAP DRUM';held=null;}if(!items.some(q=>q.kind!=='drum'))newItems();}
    },draw(c){
      bg(c,'#132338','#3b293a');for(let i=0;i<14;i++){let x=i*49-7;let h=65+(i*67)%114;rect(c,x,318-h,36,h,'#172032');for(let j=0;j<4;j++)rect(c,x+4,325-h+j*17,14,4,'#bc876044');}
      for(let i=0;i<13;i++){poly(c,[[i*55-19,323],[i*55+11,296-(i%3)*9],[i*55+52,324]],'#35414d');}
      rect(c,0,320,W,40,'#13202a');for(let i=0;i<25;i++)line(c,[[i*29,323],[i*29+12,323]],'#edab5e',4);
      rect(c,0,6,W,12,'#45566b');for(let i=0;i<21;i++)line(c,[[i*33,6],[i*33+13,17]],'#172433',3);
      const x=baseX+Math.sin(a)*length,y=baseY+Math.cos(a)*length;
      function salvage(o,x,y){if(o.kind==='core'){jewel(c,x,y,13,mint);ring(c,x,y,15,'#65ffcc66');}else if(o.kind==='steel'){poly(c,[[x-13,y-7],[x-4,y-14],[x+12,y-8],[x+14,y+6],[x+4,y+13],[x-12,y+7]],'#9bb4bc','#e6e2ce');dot(c,x,y,5,'#3c525c');}else{dot(c,x,y,14,'#b8475d');ring(c,x,y,10,'#ffb2aa');for(let j=0;j<8;j++){let b=j*TAU/8;line(c,[[x+10*Math.cos(b),y+10*Math.sin(b)],[x+18*Math.cos(b),y+18*Math.sin(b)]],pink,2);}type(c,'×',x,y,16,'#fff','center');}}
      items.forEach(o=>salvage(o,o.x,o.y));if(held)salvage(held,x,y+10);
      line(c,[[baseX,baseY],[x,y]],'#c6bd9d',2.5);rect(c,x-11,y-5,22,9,'#ffc571');rect(c,x-11,y+2,5,6,'#ffefe0');rect(c,x+6,y+2,5,6,'#ffefe0');rect(c,baseX-16,16,32,26,'#e9a64f');dot(c,baseX,baseY,6,'#435264');
      sign(c,'DOCK 09  /  '+format(lifted)+' LIFTS',18,43);if(status)mono(c,status,320,338,12,gold,'center');
    }};
  });

  add('bloom-reactor','Bloom Reactor','Plant one pulse. Each mote it touches blooms into another pulse.','Arrows aim. Action releases a pulse, or tap its origin.','#ff83be',api=>{
    let motes=[],rings=[],aim={x:320,y:180},chain=0,wave=0,ready=true,rearm=0,t=0;
    function seed(){wave++;chain=0;ready=true;motes=Array.from({length:21},()=>({x:between(32,608),y:between(60,330),vx:between(-31,31),vy:between(-31,31),t:between(0,TAU)}));}seed();
    function burst(x,y){if(!ready)return;ready=false;chain=0;rings=[{x,y,age:0,max:62}];api.sound('tap');}
    return {press(k){if(k==='action')burst(aim.x,aim.y);},tap(x,y){aim={x,y};burst(x,y);},update(dt,input){
      t+=dt;moveAim(aim,dt,input);for(const p of motes){p.x+=p.vx*dt;p.y+=p.vy*dt;if(p.x<13||p.x>627)p.vx=(p.x<13?1:-1)*Math.abs(p.vx);if(p.y<37||p.y>346)p.vy=(p.y<37?1:-1)*Math.abs(p.vy);}
      if(ready)return;
      for(const r of rings)r.age+=dt;
      const next=[];motes=motes.filter(p=>{if(!rings.some(r=>r.age<.73&&dist(p.x,p.y,r.x,r.y)<=Math.min(r.max,r.age*146)+5))return true;
        next.push({x:p.x,y:p.y,age:0,max:54});chain++;api.score(1);api.sound('good');return false;});
      rings=rings.filter(r=>r.age<.85).concat(next);
      if(!rings.length){rearm+=dt;if(rearm>.53){rearm=0;seed();}}
    },draw(c){
      bg(c,'#1b0d2c','#100e22');stars(c,7,75);
      motes.forEach(p=>{const s=api.reduced?1:1+.16*Math.sin(t*3+p.t);for(let j=0;j<3;j++){let h=p.t+j*TAU/3;dot(c,p.x+Math.cos(h)*3.8,p.y+Math.sin(h)*3.8,2.7*s,'#ff96c7');}dot(c,p.x,p.y,2,'#fff8db');});
      for(const r of rings){const rad=Math.min(r.max,r.age*146);c.save();c.globalAlpha=Math.max(0,1-r.age/.85);dot(c,r.x,r.y,rad,'#d141873b');ring(c,r.x,r.y,rad,'#ffadd6',2);ring(c,r.x,r.y,rad*.70,'#ffc1b740');c.restore();}
      if(ready)crosshair(c,aim.x,aim.y,'#ffe2f3');sign(c,'CULTURE '+format(wave)+'  /  '+(ready?'PULSE ARMED':'CHAIN ×'+chain));
    }};
  });

  function cargoMark(c,i,x,y,r,col){
    if(i===1){jewel(c,x,y,r,col);return;}
    const direction=i===0?-1:1;
    poly(c,[[x+direction*r,y],[x-direction*r*.7,y-r*.8],[x-direction*r*.7,y+r*.8]],col);
  }
  add('cargo-riot','Cargo Riot','Read the front crate and route it to its matching chute before the belt jams.','Left / Action / Right route a crate. Or tap its chute.','#ffab67',api=>{
    let queue=Array.from({length:7},()=>Math.floor(between(0,3))),pressure=.18,anim=0,last=1,streak=0,live=true,t=0;
    const colors=['#72dbfc','#ffcc79','#cd99ff'];
    function route(i){if(!live)return;last=i;anim=1;const ok=i===queue[0];if(ok){pressure=Math.max(0,pressure-.13);streak++;api.score(1);api.sound('good');queue.shift();queue.push(Math.floor(between(0,3)));}else{pressure+=.16;streak=0;api.sound('hit');}if(pressure>=1){live=false;api.end('The belt jammed');}}
    return {press(k){if(k==='left')route(0);if(k==='action'||k==='down')route(1);if(k==='right')route(2);},tap(x){route(Math.min(2,Math.floor(Math.max(0,x)/(640/3))));},update(dt){
      if(!live)return;t+=dt;anim=Math.max(0,anim-dt*4);pressure+=dt*(.073+Math.min(.05,streak*.0015));if(pressure>=1){live=false;api.end('The belt jammed');}
    },draw(c){
      bg(c,'#192331','#242435');for(let j=0;j<12;j++){rect(c,12+j*55,52,31,95,'#293545');rect(c,14+j*55,56,8,5,'#5a6068');}
      rect(c,0,189,W,28,'#344453');for(let i=-1;i<19;i++){const x=i*40+(api.reduced?0:t*42%40);ring(c,x,202,7,'#82919e',2);}
      queue.slice(0,5).forEach((v,i)=>{const x=312+i*82,y=130+i*1.3;rect(c,x-30,y-29,60,58,'#2c3547');rect(c,x-27,y-26,54,52,colors[v]);rect(c,x-22,y-21,44,42,'#242939');cargoMark(c,v,x,y,11,colors[v]);if(!i){line(c,[[x-35,y-35],[x-35,y-40],[x+35,y-40],[x+35,y-35]],'#fff',2);mono(c,'ROUTE',x,y+43,11,'#fff','center');}});
      for(let i=0;i<3;i++){const x=24+i*208;poly(c,[[x,241],[x+176,241],[x+152,314],[x+24,314]],'#151b2b',colors[i]);line(c,[[x+8,248],[x+168,248]],colors[i],last===i&&anim>0?6:2);cargoMark(c,i,x+88,275,13,colors[i]);mono(c,['LEFT','ACTION','RIGHT'][i],x+88,300,9,'#d6e3ef','center');}
      sign(c,'BELT PRESSURE');rect(c,143,17,220,9,'#404051');rect(c,143,17,220*clamp(pressure,0,1),9,pressure>.73?pink:gold);
    }};
  });

  add('static-shepherd','Static Shepherd','Guide the fireflies through the lit hatch. Get behind them and pulse.','Arrows move the emitter. Action pulses, or tap to pulse there.','#b4ff8d',api=>{
    const aim={x:190,y:180};let flies=[],wave=1,burst=0,t=0,gate=178;
    function seed(){flies=Array.from({length:8},()=>({x:between(225,410),y:between(90,275),vx:between(-8,8),vy:between(-8,8),phase:between(0,TAU)}));}seed();
    function pulse(){burst=1;api.sound('tap');for(const p of flies){const dx=p.x-aim.x,dy=p.y-aim.y,d=Math.hypot(dx,dy)||1;if(d>160)continue;let impulse=185*(1-d/210);p.vx+=dx/d*impulse;p.vy+=dy/d*impulse;}}
    return {press(k){if(k==='action')pulse();},tap(x,y){aim.x=x;aim.y=y;pulse();},update(dt,input){
      moveAim(aim,dt,input,300);t+=dt;burst=Math.max(0,burst-dt*2.6);
      flies=flies.filter(p=>{const drag=Math.exp(-.65*dt);p.vx=p.vx*drag+Math.cos(t+p.phase)*dt*2;p.vy=p.vy*drag+Math.sin(t+p.phase)*dt*3;p.x+=dt*p.vx;p.y+=dt*p.vy;
        if(p.x>=604&&Math.abs(p.y-gate)<44){api.score(1);api.sound('good');return false;}
        if(p.x<28||p.x>603){p.x=clamp(p.x,28,603);p.vx*=-.72;}
        if(p.y<46||p.y>329){p.y=clamp(p.y,46,329);p.vy*=-.72;}return true;
      });if(!flies.length){wave++;gate=between(97,263);seed();}
    },draw(c){
      bg(c,'#10252a','#12241f');for(let i=0;i<25;i++){const x=i*29;line(c,[[x,321],[x-5,308-i%4*5],[x+1,314],[x+5,302-i%3*5]],'#295041',2);}
      for(let y=56;y<337;y+=25)for(let x=33;x<608;x+=26)dot(c,x,y,1,'#a4cc9b2c');
      rect(c,604,41,10,288,'#4a5b53');rect(c,599,gate-43,24,86,'#173e39');line(c,[[601,gate-43],[617,gate-43],[617,gate+43],[601,gate+43]],mint,3);type(c,'›',607,gate,30,mint,'center');
      flies.forEach(p=>{const beat=api.reduced?1:Math.sin(t*9+p.phase);dot(c,p.x,p.y,10,'#a8ff8720');poly(c,[[p.x,p.y],[p.x-7,p.y-3*beat-2],[p.x-4,p.y+2]],'#b4e2bc');poly(c,[[p.x,p.y],[p.x+7,p.y-3*beat-2],[p.x+4,p.y+2]],'#b4e2bc');dot(c,p.x,p.y,3.5,'#d8ff83');});
      ring(c,aim.x,aim.y,15,'#93ffe3',2);dot(c,aim.x,aim.y,4,mint);if(burst>0){c.save();c.globalAlpha=burst;ring(c,aim.x,aim.y,10+(1-burst)*145,'#a4ffdc',2);c.restore();}
      sign(c,'HATCH '+format(wave)+'  /  '+flies.length+' FIREFLIES');
    }};
  });

  add('prism-guard','Prism Guard','Turn the shield toward each incoming shard. Three hull hits end the round.','Left / right rotate one sector, or tap the incoming direction.','#b89aff',api=>{
    const cx=320,cy=185,n=6;let face=0,shards=[],cool=.25,lives=3,blink=0,stops=0;
    const angle=i=>-Math.PI/2+i*TAU/n;
    function set(i){face=(i+n)%n;api.sound('tap');}
    return {press(k){if(k==='left')set(face-1);if(k==='right'||k==='action')set(face+1);},tap(x,y){if(dist(x,y,cx,cy)>9)set(Math.round((Math.atan2(y-cy,x-cx)+Math.PI/2)/(TAU/n)));},update(dt){
      if(lives===0)return;blink=Math.max(0,blink-dt);cool-=dt;if(cool<=0){shards.push({dir:Math.floor(between(0,n)),r:148});cool=Math.max(.59,1.32-stops*.025);}
      for(const s of shards){s.r-=dt*(80+Math.min(42,stops*2));if(s.r<=43&&!s.hit){s.hit=true;if(s.dir===face){stops++;api.score(1);api.sound('good');}else{lives--;api.sound('hit');blink=.28;if(!lives){api.end('Hull breached');break;}}}}
      shards=shards.filter(s=>!s.hit);
    },draw(c){
      bg(c,'#10112e','#200e33');stars(c,6);for(let i=0;i<n;i++){const a=angle(i),dx=Math.cos(a),dy=Math.sin(a);line(c,[[cx+dx*52,cy+dy*52],[cx+dx*146,cy+dy*146]],'#614d765d');ring(c,cx+dx*148,cy+dy*148,8,'#a17ea6');}
      const vertices=Array.from({length:n},(_,i)=>[cx+Math.cos(angle(i))*29,cy+Math.sin(angle(i))*29]);poly(c,vertices,blink?'#9f3a56':'#533c88','#c8a9ff');jewel(c,cx,cy,15,'#cfe9ff');ring(c,cx,cy,43,'#463c6a',2);
      ring(c,cx,cy,44,'#906af7',9,angle(face)-.43,angle(face)+.43);ring(c,cx,cy,48,'#efdcff',2,angle(face)-.43,angle(face)+.43);
      shards.forEach(s=>{const a=angle(s.dir),x=cx+Math.cos(a)*s.r,y=cy+Math.sin(a)*s.r;c.save();c.translate(x,y);c.rotate(a);poly(c,[[-9,0],[4,-5],[13,0],[4,5]],'#ff979b');line(c,[[10,0],[22,0]],'#fd769a7a',2);c.restore();});sign(c,'PRISM HULL  /  '+lives+' OF 3');
    }};
  });

  add('tilt-foundry','Tilt Foundry','Roll the steel bearing into the lit socket. Avoid the open vents.','Arrow keys tilt the deck. Tap a destination to steer toward it.','#83e6d1',api=>{
    let x=86,y=190,vx=0,vy=0,aim=null,level=0,alive=true;
    const docks=[[553,280],[70,77],[566,79],[76,280]];
    const vents=[[225,115],[382,242],[457,133],[188,278]];
    return {press(){},tap(X,Y){aim={x:X,y:Y};},update(dt,input){
      if(!alive)return;let ax=+input.has('right')-+input.has('left'),ay=+input.has('down')-+input.has('up');
      if(ax||ay){aim=null;}else if(aim){ax=clamp((aim.x-x)*.055-vx*.012,-1,1);ay=clamp((aim.y-y)*.055-vy*.012,-1,1);}
      let drag=Math.exp(-1.45*dt);vx=(vx+ax*340*dt)*drag;vy=(vy+ay*340*dt)*drag;x+=vx*dt;y+=vy*dt;
      if(x<34||x>606){x=clamp(x,34,606);vx*=-.55;}if(y<56||y>318){y=clamp(y,56,318);vy*=-.55;}
      if(vents.some(([X,Y])=>dist(x,y,X,Y)<14)){api.sound('hit');alive=false;api.end('Bearing lost in a vent');return;}
      const [gx,gy]=docks[level%4];if(dist(x,y,gx,gy)<23){api.score(3);api.sound('good');level++;}
    },draw(c){
      bg(c,'#14232a','#123137');rect(c,19,42,602,291,'#557979');rect(c,24,47,592,281,'#234146');for(let i=34;i<612;i+=28)line(c,[[i,48],[i,326]],'#50656555');for(let j=53;j<326;j+=28)line(c,[[25,j],[615,j]],'#50656555');
      for(const [X,Y] of [[24,46],[615,46],[24,328],[615,328]]){dot(c,X,Y,5,'#a0bfae');line(c,[[X-2,Y+2],[X+2,Y-2]],'#31554d');}
      vents.forEach(([X,Y])=>{dot(c,X,Y,20,'#131d24');ring(c,X,Y,20,'#cc8e6f',2);for(let k=-1;k<=1;k++)line(c,[[X-11,Y+k*5],[X+11,Y+k*5]],'#475457',2);});
      const [gx,gy]=docks[level%4];ring(c,gx,gy,22,'#85ffcf',3);ring(c,gx,gy,15,'#79ddba');jewel(c,gx,gy,6,mint);
      if(aim)crosshair(c,aim.x,aim.y,'#8cccb477');dot(c,x+3,y+5,10,'#0e2026');const g=c.createRadialGradient(x-3,y-4,1,x,y,10);g.addColorStop(0,'#ffffff');g.addColorStop(.3,'#e9efe7');g.addColorStop(.7,'#8ba7ad');g.addColorStop(1,'#394d61');dot(c,x,y,10,g);sign(c,'GRAVITY TABLE  /  SOCKET '+format(level+1));
    }};
  });

  add('cinder-step','Cinder Step','Leap across broken furnace slabs. A second kick in midair extends the jump.','Tap, Up or Action to jump. Jump again in the air.','#ffa67d',api=>{
    const px=128;let y=244,vy=0,t=0,landed=true,jumps=0,live=true,d=0;
    let pads=[{x:-10,w:268,h:245,scored:true}];
    function fill(){while(pads.at(-1).x+pads.at(-1).w<810){const p=pads.at(-1);pads.push({x:p.x+p.w+between(75,124),w:between(85,155),h:clamp(p.h+between(-35,35),193,262),scored:false});}}fill();
    function jump(){if(live&&jumps<2){vy=jumps?-242:-310;landed=false;jumps++;api.sound('tap');}}
    return {press(k){if(k==='up'||k==='action')jump();},tap:jump,update(dt){
      if(!live)return;t+=dt;const speed=162+Math.min(42,d*.002);d+=dt*speed;
      const oldY=y;for(const p of pads)p.x-=speed*dt;pads=pads.filter(p=>p.x+p.w>-20);fill();
      vy+=dt*760;y+=vy*dt;const floor=pads.find(p=>px+7>=p.x&&px-7<=p.x+p.w&&oldY<=p.h+1&&y>=p.h&&vy>=0);
      if(floor){y=floor.h;vy=0;landed=true;jumps=0;if(!floor.scored){floor.scored=true;api.score(1);api.sound('good');}}
      else if(landed){landed=false;jumps=1;}
      if(y>320){live=false;api.sound('hit');api.end('The furnace caught you');}
    },draw(c){
      bg(c,'#251934','#94412e');const sun=c.createLinearGradient(0,64,0,147);sun.addColorStop(0,'#fff4a8');sun.addColorStop(1,'#ee8459');dot(c,467,105,39,sun);
      for(let layer=0;layer<2;layer++){const step=layer?81:63,off=(d*(layer?.14:.07))%step;for(let i=-1;i<12;i++){let x=i*step-off,h=76+(i*23+160)%59;rect(c,x,280-h,step*.74,h,layer?'#64353b':'#7b484a');rect(c,x+7,268-h,5,16,layer?'#64353b':'#7b484a');}}
      rect(c,0,307,W,53,'#f07b44');for(let i=-1;i<18;i++){let x=i*44-(api.reduced?0:t*37%44);line(c,[[x,309+i%3],[x+20,308+i%3]],'#ffe69b',3);}
      pads.forEach(p=>{poly(c,[[p.x,p.h],[p.x+p.w,p.h],[p.x+p.w-11,p.h+28],[p.x+9,p.h+36]],'#493239','#c98570');rect(c,p.x,p.h,p.w,4,'#ffd395');for(let j=14;j<p.w-7;j+=24)line(c,[[p.x+j,p.h+6],[p.x+j-6,p.h+15]],'#9e6055',2);});
      const stride=landed&&!api.reduced?Math.sin(t*18)*4:0;rect(c,px-7,y-22,13,13,'#303043');rect(c,px-4,y-30,13,10,'#f3e1cb');rect(c,px+2,y-27,9,3,'#70e8ef');rect(c,px-6+stride,y-9,4,9,'#f1b17f');rect(c,px+3-stride,y-9,4,9,'#f1b17f');poly(c,[[px-7,y-22],[px-20,y-20],[px-12,y-16]],pink);
      sign(c,'FOUNDRY  /  '+Math.floor(d/10)+' M');
    }};
  });

  add('ricochet-mine','Ricochet Mine','Bank a shot through the crystal seam. One shot can break several gems.','Left / right aim. Action fires. Or tap a point to aim and fire.','#8ed0ff',api=>{
    let gems=[],balls=[],aim=0,stage=0,reload=0,impact=[],t=0;
    const gun={x:320,y:312};
    function load(){stage++;gems=[];for(let row=0;row<3;row++)for(let col=0;col<8;col++){
      if(Math.random()<.24)continue;gems.push({x:71+col*71+(row%2)*14,y:70+row*46,hp:row===0?2:1,shade:row});}
      if(!gems.length)gems.push({x:320,y:100,hp:1,shade:1});}load();
    function fire(){if(reload>0||balls.length>=3)return;reload=.4;balls.push({x:gun.x,y:gun.y-10,vx:Math.sin(aim)*284,vy:-Math.cos(aim)*284,ttl:5.7});api.sound('tap');}
    return {press(k){if(k==='action'||k==='up')fire();},tap(x,y){aim=clamp(Math.atan2(x-gun.x,Math.max(10,gun.y-y)),-1.17,1.17);fire();},update(dt,input){
      t+=dt;reload=Math.max(0,reload-dt);aim=clamp(aim+dt*1.9*(+input.has('right')-+input.has('left')),-1.17,1.17);
      for(const b of balls){b.ttl-=dt;const oldX=b.x,oldY=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.x<22||b.x>618){b.x=clamp(b.x,22,618);b.vx*=-1;}
        if(b.y<36){b.y=36;b.vy=Math.abs(b.vy);}
        for(const gem of gems){if(!gem.hp||dist(gem.x,gem.y,b.x,b.y)>19||b.last===gem)continue;
          const dx=oldX-gem.x,dy=oldY-gem.y,mag=Math.hypot(dx,dy)||1,nx=dx/mag,ny=dy/mag,proj=b.vx*nx+b.vy*ny;
          if(proj<0){b.vx-=2*proj*nx;b.vy-=2*proj*ny;}b.x=gem.x+nx*20;b.y=gem.y+ny*20;b.last=gem;gem.hp--;
          api.sound(gem.hp?'tap':'good');if(!gem.hp){api.score(1);impact.push({x:gem.x,y:gem.y,age:0});}break;}
        if(b.last&&dist(b.x,b.y,b.last.x,b.last.y)>24)b.last=null;
      }balls=balls.filter(b=>b.y<342&&b.ttl>0);gems=gems.filter(p=>p.hp);impact.forEach(p=>p.age+=dt);impact=impact.filter(p=>p.age<.32);if(!gems.length)load();
    },draw(c){
      bg(c,'#101e36','#19213c');for(let i=0;i<12;i++){const x=i*61-20;poly(c,[[x,31],[x+18,59+(i*37)%43],[x+52,30]],i%2?'#243552':'#334765');}
      line(c,[[15,322],[15,32],[625,32],[625,322]],'#6597b5',2);for(let i=0;i<17;i++){let x=i*43;poly(c,[[x,360],[x+19,320-(i*12)%16],[x+50,360]],'#344767');}
      gems.forEach(g=>{const col=['#afacff','#79ecdc','#81bdff'][g.shade];jewel(c,g.x,g.y,15,col);if(g.hp>1)ring(c,g.x,g.y,18,'#dcd8ff88');});
      impact.forEach(p=>{ring(c,p.x,p.y,4+p.age*87,'#9fffe755');});for(const b of balls){line(c,[[b.x,b.y],[b.x-b.vx*.035,b.y-b.vy*.035]],'#a9f8ff88',3);dot(c,b.x,b.y,4,'#fffbd9');}
      const sx=Math.sin(aim),sy=-Math.cos(aim);for(let j=31;j<80;j+=10)dot(c,gun.x+sx*j,gun.y+sy*j,1.3,'#a6e7ffaa');line(c,[[gun.x,gun.y],[gun.x+sx*25,gun.y+sy*25]],'#a1d5e3',9);dot(c,gun.x,gun.y,12,'#547b9d');ring(c,gun.x,gun.y,12,'#d4f4ff',2);sign(c,'SEAM '+format(stage)+'  /  '+(3-balls.length)+' SHOTS READY');
    }};
  });

  add('pressure-club','Pressure Club','Bleed each boiler inside its striped pressure band. A full gauge blows the plant.','Left / right select. Action vents, or tap a gauge.','#ffbd83',api=>{
    let sel=0,live=true,lines=[],t=0;
    const reset=i=>({p:between(.12,.33),v:between(.067,.100),mark:[.58,.65,.55,.63][i],flash:0});
    lines=Array.from({length:4},(_,i)=>reset(i));const left=i=>77+i*132;
    function vent(i){if(!live)return;const p=lines[i];sel=i;if(p.flash>0)return;
      if(p.p>=p.mark&&p.p<=p.mark+.17){api.score(3);api.sound('good');p.p=.08;p.v=between(.07,.12);p.flash=.26;}
      else if(p.p>p.mark+.17){api.score(1);api.sound('tap');p.p=.22;p.flash=.24;}
      else{api.sound('hit');p.p=Math.min(.94,p.p+.10);p.flash=.22;}}
    return {press(k){if(k==='left')sel=(sel+3)%4;if(k==='right')sel=(sel+1)%4;if(k==='action'||k==='down')vent(sel);},tap(x){vent(clamp(Math.round((x-122)/132),0,3));},update(dt){
      if(!live)return;t+=dt;for(const p of lines){p.flash=Math.max(0,p.flash-dt);p.p+=p.v*dt;if(p.p>=1){live=false;api.sound('hit');api.end('Boiler pressure exceeded');break;}}
    },draw(c){
      bg(c,'#292434','#29252c');for(let i=0;i<5;i++){rect(c,0,58+i*53,640,6,'#454049');line(c,[[0,57+i*53],[640,57+i*53]],'#685253',1);}
      for(let i=0;i<4;i++){const p=lines[i],x=left(i),y=68,ww=84,hh=165;
        rect(c,x-6,y-6,ww+12,hh+12,sel===i?'#dfad82':'#665b63');rect(c,x-3,y-3,ww+6,hh+6,'#292a31');rect(c,x,y,ww,hh,'#151e27');
        const gauge=p.p>.86?pink:p.p>=p.mark?gold:'#70ccc3';rect(c,x+4,y+hh-p.p*hh,ww-8,p.p*hh,gauge);
        const bandY=y+hh*(1-p.mark-.17);rect(c,x+2,bandY,ww-4,.17*hh,'#f4f4c222');
        for(let j=0;j<6;j++)line(c,[[x+4+j*13,bandY+5],[x+10+j*13,bandY+1]],'#ffefc3',2);
        line(c,[[x+2,bandY],[x+ww-2,bandY]],'#ffefc3',2);line(c,[[x+2,bandY+.17*hh],[x+ww-2,bandY+.17*hh]],'#ffefc3',2);
        for(let j=1;j<10;j++)line(c,[[x+3,y+j*hh/10],[x+11,y+j*hh/10]],'#43646a',1.5);
        const k=x+ww/2;rect(c,k-8,240,16,18,'#79727a');ring(c,k,275,19,p.flash?'#fff2c4':'#d78e73',6);for(let j=0;j<3;j++){const a=j*TAU/3+(p.flash?1:0);line(c,[[k,275],[k+Math.cos(a)*16,275+Math.sin(a)*16]],'#da9778',4);}
        mono(c,['A','B','C','D'][i],k,311,15,sel===i?gold:ice,'center');
      }sign(c,'STEAM WORKS  /  VENT IN THE STRIPES');
    }};
  });

  add('wire-wyrm','Wire Wyrm','Steer the live wire through diamonds. Avoid your own cable and the edge.','Arrow keys turn. Tap a direction relative to the wire head.','#7effb9',api=>{
    const cols=22,rows=10,size=25,ox=45,oy=50;
    let body=[[9,5],[8,5],[7,5],[6,5]],dir=[1,0],next=dir,charge=[14,5],acc=0,eaten=0,alive=true;
    function steer(dx,dy){if(dx!==-dir[0]||dy!==-dir[1])next=[dx,dy];}
    function spawn(){const free=[];for(let Y=0;Y<rows;Y++)for(let X=0;X<cols;X++)if(!body.some(([x,y])=>x===X&&y===Y))free.push([X,Y]);return free.length?choose(free):null;}
    return {press(k){if(dirs[k])steer(...dirs[k]);},tap(x,y){const dx=x-(ox+(body[0][0]+.5)*size),dy=y-(oy+(body[0][1]+.5)*size);if(Math.abs(dx)>Math.abs(dy))steer(Math.sign(dx),0);else if(dy)steer(0,Math.sign(dy));},update(dt){
      if(!alive)return;acc+=dt;const step=Math.max(.095,.19-eaten*.006);
      while(acc>=step&&alive){acc-=step;dir=next;const x=body[0][0]+dir[0],y=body[0][1]+dir[1];let eat=charge&&charge[0]===x&&charge[1]===y;
        if(x<0||x>=cols||y<0||y>=rows||body.slice(0,eat?body.length:-1).some(p=>p[0]===x&&p[1]===y)){alive=false;api.sound('hit');api.end('Circuit shorted');break;}
        body.unshift([x,y]);if(eat){api.score(2);api.sound('good');eaten++;charge=spawn();if(!charge){alive=false;api.end('Circuit complete');}}else body.pop();}
    },draw(c){
      bg(c,'#102725','#102321');const endX=ox+cols*size,endY=oy+rows*size;rect(c,ox-4,oy-4,endX-ox+8,endY-oy+8,'#5a9180');rect(c,ox,oy,endX-ox,endY-oy,'#102820');
      for(let i=0;i<=cols;i++)line(c,[[ox+i*size,oy],[ox+i*size,endY]],'#36544777');
      for(let j=0;j<=rows;j++)line(c,[[ox,oy+j*size],[endX,oy+j*size]],'#36544777');
      for(let i=0;i<22;i++){rect(c,ox+7+i*size,endY+5,8,6,'#a19868');rect(c,ox+7+i*size,oy-11,8,6,'#a19868');}
      const points=body.map(([x,y])=>[ox+(x+.5)*size,oy+(y+.5)*size]);line(c,points,'#49ad82',13);line(c,points,'#94e7a2',4);for(const [x,y] of points)dot(c,x,y,4,'#c3ffc1');
      const [hx,hy]=points[0];dot(c,hx,hy,9,'#93f4be');dot(c,hx+dir[0]*4,hy+dir[1]*4,3,'#194430');
      if(charge)jewel(c,ox+(charge[0]+.5)*size,oy+(charge[1]+.5)*size,10,gold);sign(c,'LIVE CIRCUIT  /  '+format(eaten)+' NODES');
    }};
  });

  add('storm-drums','Storm Drums','Strike each rail as its note crosses the bright line. Build a clean streak.','Left, Action or Right strike the three rails. Or tap a rail.','#ff91bf',api=>{
    const xs=[196,320,444],cols=['#79e5ff','#ff9dc5','#ffd281'];const hitY=261,top=55;
    let next=.18,notes=[],elapsed=0,feedback='',delay=0,flashes=[0,0,0],combo=0,beat=0,last=-1;
    function strike(i){flashes[i]=.18;const targets=notes.filter(n=>n.i===i&&!n.used).sort((a,b)=>Math.abs(a.y-hitY)-Math.abs(b.y-hitY));
      if(targets.length&&Math.abs(targets[0].y-hitY)<=25){const note=targets[0],perfect=Math.abs(note.y-hitY)<11;note.used=true;combo++;api.score(perfect?3:1);feedback=perfect?'ON BEAT':'GOOD';api.sound('good');}else{combo=0;feedback='OFF BEAT';api.sound('tap');}delay=.5;}
    return {press(k){if(k==='left')strike(0);if(k==='action'||k==='down')strike(1);if(k==='right')strike(2);},tap(x){strike(x<(xs[0]+xs[1])/2?0:x>(xs[1]+xs[2])/2?2:1);},update(dt){
      elapsed+=dt;next-=dt;delay-=dt;flashes=flashes.map(n=>Math.max(0,n-dt));if(next<=0){let lane=Math.floor(between(0,3));if(lane===last&&beat%2)lane=(lane+1)%3;last=lane;notes.push({i:lane,y:top});next+=[.53,.53,.36,.70][beat++%4];}
      for(const n of notes){n.y+=dt*(131+Math.min(28,elapsed*.9));if(!n.used&&n.y>hitY+26){n.used=true;combo=0;feedback='MISSED';delay=.38;}}
      notes=notes.filter(n=>!n.used);
    },draw(c){
      bg(c,'#20112f','#171a36');stars(c,4,30);
      for(let i=0;i<3;i++){const x=xs[i],col=cols[i];poly(c,[[x-32,44],[x+32,44],[x+55,304],[x-55,304]],'#25263a','#60516d');
        for(let j=0;j<7;j++){const y=57+j*34;line(c,[[x-28-j*2,y],[x+28+j*2,y]],'#59506577');}rect(c,x-47,hitY-10,94,20,flashes[i]?'#ffffff':col);rect(c,x-44,hitY-6,88,12,'#3a3244');line(c,[[x-44,hitY],[x+44,hitY]],col,2);mono(c,['LEFT','ACTION','RIGHT'][i],x,324,12,col,'center');
      }
      for(const n of notes){let x=xs[n.i];poly(c,[[x-20,n.y],[x-14,n.y-6],[x+14,n.y-6],[x+20,n.y],[x+14,n.y+6],[x-14,n.y+6]],cols[n.i]);rect(c,x-12,n.y-1,24,2,'#fff9e2');}
      sign(c,'STORM DECK  /  STREAK ×'+combo);if(delay>0)mono(c,feedback,595,24,12,feedback==='MISSED'||feedback==='OFF BEAT'?pink:mint,'right');
    }};
  });
})();
