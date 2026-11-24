(() => {
  'use strict';

  const tau = Math.PI * 2;
  const ink = '#e8f5fa', mist = '#a1b6c9', navy = '#0e162e';
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const wrap = (n, length) => (n % length + length) % length;
  const random = (a, b) => a + Math.random() * (b - a);
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const near = (x, y, p, r) => Math.hypot(x - p.x, y - p.y) <= r;
  const held = (keys, key) => !!keys?.has(key);

  function circle(c, x, y, r, fill, stroke, width = 2) {
    c.beginPath(); c.arc(x, y, Math.max(0, r), 0, tau);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
  }
  function path(c, points, stroke, width = 2, fill = null, closed = false) {
    if (!points.length) return;
    c.beginPath(); c.moveTo(...points[0]);
    points.slice(1).forEach(p => c.lineTo(...p));
    if (closed) c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
  }
  function label(c, text, x, y, size = 15, color = ink, align = 'center') {
    c.fillStyle = color; c.font = '600 ' + size + 'px system-ui, sans-serif';
    c.textAlign = align; c.textBaseline = 'middle'; c.fillText(text, x, y);
  }
  function box(c, x, y, w, h, fill, stroke, radius = 8) {
    c.beginPath(); c.roundRect(x, y, w, h, radius);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); }
  }
  function background(c, top, bottom) {
    const g = c.createLinearGradient(0, 0, 640, 360);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    c.fillStyle = g; c.fillRect(0, 0, 640, 360);
  }
  // Fixed decorative layers stay still while the player is deciding the next move.
  function glow(c, x, y, radius, color) {
    const light = c.createRadialGradient(x, y, 0, x, y, radius);
    light.addColorStop(0, color); light.addColorStop(1, color.slice(0, 7) + '00');
    c.fillStyle = light; c.fillRect(x-radius, y-radius, radius*2, radius*2);
  }
  function frond(c, x, y, height, lean, color) {
    const points = [];
    for (let i = 0; i <= 7; i++) {
      const v = i / 7;
      const px = x + lean * v * v, py = y - height * v;
      points.push([px, py]);
      if (i < 2) continue;
      const spread = 15 * (1 - .6 * v);
      for (const side of [-1, 1]) {
        path(c, [[px,py+2], [px+spread*side,py-6], [px+(spread+3)*side,py-15]], color, 1.8);
      }
    }
    path(c, points, color, 2);
  }
  function stars(c, color = '#aac9ee', count = 42) {
    c.save(); c.fillStyle = color;
    for (let i = 1; i <= count; i++) {
      c.globalAlpha = .18 + (i % 5) * .08;
      c.fillRect((37 + i * i * 23) % 637, (13 + i * i * 7 + 41 * i) % 347, 1 + i % 2, 1 + i % 2);
    }
    c.restore();
  }
  function register(id, title, color, hint, controls, build, speakMoves = false) {
    SQ.register({ id, title, group: 'Drift', color, hint, controls, speakMoves,
      create(api) {
        let t = 0, feedback = '', left = 0;
        const particles = [];
        const fx = {
          get t() { return t; },
          get reduced() { return !!api.reduced; },
          note(message) { feedback = message; left = 1.4; },
          burst(x, y, color) {
            if (api.reduced) return;
            for (let i = 0; i < 12; i++) {
              const a = i * tau / 12, v = random(17, 41);
              particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .52, color });
            }
          },
          gain(points, x, y, message) {
            api.score(points); api.sound('good'); this.burst(x, y, color); this.note(message);
          },
          tap() { api.sound('tap'); }
        };
        const game = build(fx);
        return {
          ...(game.describe ? {describe: () => game.describe()} : {}),
          press(key) { game.press?.(key); }, tap(x, y) { game.tap?.(x, y); },
          update(dt, keys) {
            t += dt; left -= dt;
            for (let i = particles.length - 1; i >= 0; i--) {
              const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
              if (p.life <= 0) particles.splice(i, 1);
            }
            game.update?.(dt, keys);
          },
          draw(c) {
            c.save(); game.draw(c);
            for (const p of particles) {
              c.globalAlpha = clamp(p.life * 2, 0, 1); circle(c, p.x, p.y, 2.5, p.color);
            }
            c.globalAlpha = 1;
            if (left > 0) {
              c.font = '600 14px system-ui, sans-serif';
              const width = Math.max(68, c.measureText(feedback).width + 26);
              box(c, (640 - width) / 2, 8, width, 26, '#11182eef', color, 13);
              label(c, feedback, 320, 21, 14);
            }
            c.restore();
          }
        };
      }
    });
  }

  register('ripple-relay', 'Ripple Relay', '#93f7cc',
    'Drop one ripple near a cluster. Each flower it touches sends another wave.',
    'Move the ring with arrows. Space or tap the water to cast.', fx => {
      const cursor = { x: 320, y: 180 }, waves = [];
      let buds = [], cooldown = 0, chain = 0;
      function seed() {
        buds = [];
        for (let i = 0; i < 14; i++) {
          const a = i * 2.4 + random(-.2,.2), d = 36 + (i % 5) * 25;
          buds.push({ x: 320 + Math.cos(a) * d * 1.7, y: 180 + Math.sin(a) * d * .86, lit: 0, used: false });
        }
      }
      seed();
      function cast(x, y) {
        if (cooldown > 0 || waves.length) return;
        cursor.x = x; cursor.y = y; chain = 0; cooldown = .35; waves.push({x,y,r:0,limit:78}); fx.tap();
      }
      return {
        press(k) { if (k === 'action') cast(cursor.x, cursor.y); },
        tap(x,y) { cast(x,y); },
        update(dt, keys) {
          cursor.x = clamp(cursor.x + 195 * dt * (held(keys,'right') - held(keys,'left')), 18, 622);
          cursor.y = clamp(cursor.y + 195 * dt * (held(keys,'down') - held(keys,'up')), 40, 317);
          cooldown -= dt;
          for (let i = waves.length - 1; i >= 0; i--) {
            const w = waves[i]; w.r += 133 * dt;
            for (const b of buds) if (!b.used && dist(b,w) <= w.r) {
              b.used = true; b.lit = 1; chain++;
              waves.push({x:b.x,y:b.y,r:0,limit:67});
              fx.gain(1,b.x,b.y,'Bloom chain ×' + chain);
            }
            if (w.r > w.limit) waves.splice(i,1);
          }
          for (const b of buds) b.lit = Math.max(0,b.lit - dt * .7);
          if (!waves.length && buds.every(b=>b.used)) seed();
        },
        draw(c) {
          background(c,'#082b35','#102339'); stars(c,'#74d8d1');
          glow(c,340,169,192,'#3c9e7d25');
          for(let i=0;i<9;i++){
            const y=26+(i%4)*82, x=i%2?632:8;
            frond(c,x,y+65,48+(i%3)*16,i%2?-22:22,'#255552');
          }
          for (let i=0;i<13;i++) {
            const x=(i*79+24)%640,y=48+(i*57)%260;
            path(c,[[x-23,y],[x-12,y-1],[x+14,y+1],[x+23,y]],'#1d424c',1);
          }
          for (const b of buds) {
            for (let j=0;j<5;j++) {
              const a=j*tau/5;
              circle(c,b.x+Math.cos(a)*6,b.y+Math.sin(a)*6,5,b.used ? '#49726c' : '#ace7c5');
            }
            circle(c,b.x,b.y,4,b.used ? '#a7c3a6' : '#ffe5a3');
            if (b.lit) circle(c,b.x,b.y,12+b.lit*7,null,'#a9fbd5',1.5);
          }
          for (const w of waves) { c.globalAlpha=clamp(1-w.r/w.limit,.1,1); circle(c,w.x,w.y,w.r,null,'#aeffda',2); }
          c.globalAlpha=1; circle(c,cursor.x,cursor.y,14,null,ink,1.5);
          path(c,[[cursor.x-4,cursor.y],[cursor.x+4,cursor.y]],ink);
          label(c, waves.length ? 'Ripples travelling…' : 'Cast beside the pale flowers',320,335,14,mist);
        }
      };
    });

  register('koi-current','Koi Current','#ffb984',
    'Guide the koi through each gold gate from either side.',
    'Arrows steer. Tap the pond to set a destination.', fx => {
      const fish={x:130,y:185}, target={...fish}, trail=[];
      let angle=0, tail=0, gate=0;
      const gates=[{x:378,y:139},{x:520,y:237},{x:245,y:275},{x:115,y:91},{x:445,y:80}];
      return {
        tap(x,y) { target.x=x; target.y=y; fx.tap(); },
        update(dt,keys) {
          let dx=held(keys,'right')-held(keys,'left'),dy=held(keys,'down')-held(keys,'up');
          if (dx||dy) { target.x=fish.x; target.y=fish.y; }
          else if (dist(fish,target)>5) { dx=target.x-fish.x; dy=target.y-fish.y; }
          const mag=Math.hypot(dx,dy);
          if (mag) {
            angle=Math.atan2(dy,dx); tail+=dt*12;
            fish.x=clamp(fish.x+dx/mag*132*dt,22,618);
            fish.y=clamp(fish.y+dy/mag*132*dt,28,318);
            if (!trail.length || dist(fish,trail[trail.length-1])>4) {
              trail.push({...fish}); if(trail.length>17)trail.shift();
            }
          }
          if (dist(fish,gates[gate])<23) { fx.gain(3,fish.x,fish.y,'Gate crossed'); gate=(gate+1)%gates.length; }
        },
        draw(c) {
          background(c,'#123242','#102435');
          glow(c,405,175,225,'#79ae7721');
          for(let i=0;i<5;i++){frond(c,23+i*14,334,62+i*7,-18+i*9,'#29514e');frond(c,546+i*17,352,46+i*10,-35+i*10,'#254747');}
          for(let i=0;i<10;i++) {
            const x=(i*151)%640,y=(i*119+16)%315;
            c.beginPath(); c.arc(x,y,13+i%8,.55,tau+.04); c.lineTo(x,y);c.fillStyle='#244b4b';c.fill();
          }
          const g=gates[gate]; circle(c,g.x,g.y,26,null,'#ffcb8f',3);circle(c,g.x,g.y,32,null,'#8e7359',1);
          label(c,'◇',g.x,g.y,18,'#ffd49e');
          trail.forEach((p,i)=>{c.globalAlpha=(i+1)/trail.length*.18;circle(c,p.x,p.y,3+i*.35,'#f0d3ad');});c.globalAlpha=1;
          if(dist(fish,target)>17) circle(c,target.x,target.y,6,null,'#c5e0dc',1);
          c.save();c.translate(fish.x,fish.y);c.rotate(angle);
          const swish=fx.reduced?0:Math.sin(tail)*4;
          path(c,[[-10,0],[-29,-11+swish],[-24,swish],[-30,11+swish]],null,1,'#f3b281',true);
          path(c,[[-3,-4],[-13,-14],[4,-9],[9,-4]],null,1,'#dd9472',true);
          path(c,[[-3,4],[-13,14],[4,9],[9,4]],null,1,'#dd9472',true);
          c.beginPath();c.ellipse(1,0,19,8,0,0,tau);c.fillStyle='#ffe0b8';c.fill();
          circle(c,5,-1,5,'#e17e59');circle(c,-7,2,3,'#dc8556');circle(c,13,-3,1.8,navy);c.restore();
          label(c,'Follow the gold ring',320,336,14,mist);
        }
      };
    });

  register('moon-kiln','Moon Kiln','#ffc799',
    'Shape the clay until all four bands touch their dotted guides, then fire the vessel.',
    'Up/down selects a band; left/right shapes it. Space fires. Tap a band to shape, then tap Fire.', fx=>{
      let widths=[45,55,55,34], wanted=[], sel=0, batch=0;
      const ys=[92,144,196,248], center=309;
      function mold(){ wanted=ys.map((_,i)=>pick(i===0?[30,40,50]:[40,50,60,70,80])); widths=wanted.map(w=>w+pick([-20,-10,10,20])); }
      mold();
      function fire(){
        if(widths.every((w,i)=>Math.abs(w-wanted[i])<=3)){batch++;fx.gain(8,center,180,'Fired vessel '+batch);mold();}
        else fx.note('Match each band to its guide');
      }
      function shape(d){widths[sel]=clamp(widths[sel]+d,10,110);fx.tap();}
      return {
        press(k){if(k==='up'||k==='down')sel=wrap(sel+(k==='down'?1:-1),4);if(k==='left'||k==='right')shape(k==='right'?10:-10);if(k==='action')fire();},
        tap(x,y){if(y>285){fire();return;}sel=clamp(Math.round((y-92)/52),0,3);widths[sel]=clamp(Math.round(Math.abs(x-center)/10)*10,10,110);fx.tap();},
        draw(c){
          background(c,'#34283b','#172033');stars(c,'#deaa8c',29);
          const outer=widths.map((w,i)=>[center-w,ys[i]]).concat(widths.map((w,i)=>[center+w,ys[i]]).reverse());
          const fill=c.createLinearGradient(center-92,0,center+100,0);fill.addColorStop(0,'#82536a');fill.addColorStop(.47,'#e6a485');fill.addColorStop(1,'#a86976');
          path(c,outer,'#e4a38b',2,fill,true);
          ys.forEach((y,i)=>{
            path(c,[[center-widths[i],y],[center+widths[i],y]],i===sel?ink:'#ab7280',i===sel?2:1);
            for(const side of [-1,1]){const x=center+side*wanted[i];path(c,[[x,y-8],[x,y+8]],'#ffe1ac',3);}
            const match=widths[i]===wanted[i];
            label(c,match?'✓':String(i+1),147,y,16,match?'#9ae7c0':i===sel?ink:mist);
            label(c,i===sel?'◀':'·',468,y,17,i===sel?'#ffca9f':mist);
          });
          box(c,228,261,162,7,'#8e7083',null,3);box(c,252,269,115,6,'#524255',null,3);
          box(c,258,295,105,36,'#3d3244','#b98d7f',18);label(c,'Fire vessel',311,313,15);
        }
      };
    });

  register('moon-mobile','Moon Mobile','#cfb1ff',
    'Balance the hanging sculpture. Move the loose moon to the peg that levels the beam.',
    'Left/right moves the moon. Space tests the balance. Tap a peg to place and test.', fx=>{
      const loc=[-3,-2,-1,1,2,3];let fixed=[],sel=3,solution=1,tilt=0;
      function reset(){
        solution=pick(loc); const options=[];
        for(const a of loc)for(const b of loc)for(const m of [1,2,3])for(const n of [1,2,3]) {
          if(a!==b&&a!==solution&&b!==solution&&a*m+b*n===-solution)options.push([{p:a,m},{p:b,m:n}]);
        }
        fixed=pick(options);sel=loc.indexOf(pick(loc.filter(p=>p!==solution)));
      }
      reset();
      function attempt(){if(loc[sel]===solution){fx.gain(5,320,180,'Perfect balance');reset();}else fx.note('Slide toward the high side');}
      return {
        press(k){if(k==='left'||k==='right'){sel=wrap(sel+(k==='right'?1:-1),6);fx.tap();}if(k==='action')attempt();},
        tap(x){let best=0;loc.forEach((p,i)=>{if(Math.abs(320+p*53-x)<Math.abs(320+loc[best]*53-x))best=i;});sel=best;attempt();},
        update(dt){const d=(loc[sel]-solution)*.047;tilt=fx.reduced?d:tilt+(d-tilt)*Math.min(1,dt*7);},
        draw(c){
          background(c,'#17192f','#2f2747');stars(c);
          glow(c,320,167,135,'#9673c62e');
          c.save();c.setLineDash([3,6]);path(c,[[97,116],[543,116]],'#645578',1);c.restore();
          path(c,[[320,26],[320,103]],'#9d91bc',2);
          c.save();c.translate(320,116);c.rotate(tilt);
          path(c,[[-188,0],[188,0]],'#decae9',4);
          loc.forEach((p,i)=>circle(c,p*53,0,5,i===sel?'#ffe6a3':'#52465f','#baa8ce',1));
          const orbs=[...fixed,{p:loc[sel],m:1,loose:true}];
          orbs.forEach(o=>{
            const x=o.p*53+(o.loose?5:0), length=o.loose?97:46,rr=9+3*o.m;
            path(c,[[x,0],[x,length]],o.loose?'#f7d38e':'#9f91aa',1);
            circle(c,x,length+rr,rr,o.loose?'#ffd99a':'#af91d0');
            label(c,o.m,x,length+rr,13,navy);
          });
          c.restore();circle(c,320,116,7,'#d9c8dd','#463951');
          label(c,'Gold moon weighs 1',320,291,16);label(c,'Distance from the center multiplies each weight',320,321,14,mist);
        }
      };
    });

  register('sea-glass','Sea Glass','#86e6d7','Clear touching groups of matching sea glass. Larger clusters score more.',
    'Arrows select, Space clears. Tap a matching group.',fx=>{
      const cols=9,rows=5,size=47,x0=108,y0=65,types=['#95e8cc','#e6a3be','#f4c97f','#92c1f4'];
      let board=[],col=4,row=2;
      const cell=(x,y)=>y*cols+x;
      function newBoard(){board=Array.from({length:rows*cols},()=>Math.floor(Math.random()*4));board[1]=board[0];}
      newBoard();
      function cluster(x,y){
        const result=new Set([cell(x,y)]),q=[[x,y]],v=board[cell(x,y)];
        while(q.length){
          const [ax,ay]=q.pop();
          for(const [nx,ny] of [[ax-1,ay],[ax+1,ay],[ax,ay-1],[ax,ay+1]]){
            const k=cell(nx,ny);
            if(nx>=0&&nx<cols&&ny>=0&&ny<rows&&!result.has(k)&&board[k]===v){q.push([nx,ny]);result.add(k);}
          }
        }
        return result;
      }
      function clear(){
        const touched=cluster(col,row);if(touched.size<2){fx.note('Choose two or more touching pieces');return;}
        fx.gain(touched.size-1,x0+col*size+23,y0+row*size+23,touched.size+' pieces');
        for(let x=0;x<cols;x++){
          const kept=[];
          for(let y=0;y<rows;y++)if(!touched.has(cell(x,y)))kept.push(board[cell(x,y)]);
          while(kept.length<rows)kept.unshift(Math.floor(Math.random()*4));
          kept.forEach((v,y)=>board[cell(x,y)]=v);
        }
        const hasGroup=board.some((v,i)=>(i%cols<cols-1&&board[i+1]===v)||(i<cols*(rows-1)&&board[i+cols]===v));
        if(!hasGroup)newBoard();
      }
      return {
        press(k){if(k==='left')col=wrap(col-1,cols);if(k==='right')col=wrap(col+1,cols);if(k==='up')row=wrap(row-1,rows);if(k==='down')row=wrap(row+1,rows);if(k==='action')clear();},
        tap(x,y){const nx=Math.floor((x-x0)/size),ny=Math.floor((y-y0)/size);if(nx>=0&&nx<cols&&ny>=0&&ny<rows){col=nx;row=ny;clear();}},
        draw(c){
          background(c,'#0d3038','#192a3c');stars(c,'#80cabb',52);
          board.forEach((v,i)=>{
            const x=x0+i%cols*size+size/2,y=y0+Math.floor(i/cols)*size+size/2;
            const shapes=[[[0,-17],[14,-8],[16,9],[1,17],[-14,8],[-15,-6]],[[0,-17],[16,0],[0,17],[-16,0]],[[-15,-12],[13,-14],[16,12],[-11,16]],[[-15,13],[0,-16],[16,12]]];
            const points=shapes[v].map(([dx,dy])=>[x+dx,y+dy]);path(c,points,types[v],2,types[v]+'9a',true);
            path(c,[[x-6,y],[x-3,y-5],[x+2,y-6]],'#e8fff0',1.3);
          });
          box(c,x0+col*size+1,y0+row*size+1,size-2,size-2,null,ink,9);
          label(c,'Match touching shapes',320,326,14,mist);
        }
      };
    });

  register('echo-grove','Echo Grove','#d5b5ff',
    'Rebuild a wind chime. Swap brass tubes until their ends meet all four guide marks.',
    'Left/right selects a chime. Space picks up or swaps. Or tap two chimes to swap them.', fx=>{
      const lengths=[50,81,112,143], colors=['#c5eed3','#f5d299','#e5bacb','#c4c8f8'];
      const slotX=i=>163+i*104, top=94;
      let target=[],bars=[],cursor=0,picked=-1,chord=0,ringTime=0;
      function mount(){
        target=[0,1,2,3];
        for(let i=3;i>0;i--){const j=Math.floor(random(0,i+1));[target[i],target[j]]=[target[j],target[i]];}
        // A rotated order guarantees every new mounting starts unsolved.
        const offset=pick([1,2,3]);bars=target.map((_,i)=>target[(i+offset)%4]);picked=-1;
      }
      function select(i){
        if(ringTime>0)return;
        cursor=i;fx.tap();
        if(picked<0){picked=i;return;}
        [bars[picked],bars[cursor]]=[bars[cursor],bars[picked]];picked=-1;
        if(bars.every((v,n)=>target[n]===v)){
          chord++;ringTime=.78;fx.gain(6,slotX(cursor),170,'Chord '+chord+' restored');
        }
      }
      mount();
      return {
        describe(){return 'Chime '+(cursor+1)+', length '+(bars[cursor]+1)+', needs '+(target[cursor]+1)+'. '+(picked<0?'Choose a tube.':'Holding chime '+(picked+1)+'. Choose a destination.')+' Tubes '+bars.map(n=>n+1).join(', ')+'. Guides '+target.map(n=>n+1).join(', ')+'.';},
        press(k){if(ringTime>0)return;if(k==='left'||k==='right')cursor=wrap(cursor+(k==='right'?1:-1),4);if(k==='action')select(cursor);},
        tap(x,y){const i=Math.round((x-163)/104);if(i>=0&&i<4&&y>63&&y<307&&Math.abs(x-slotX(i))<43)select(i);},
        update(dt){if(ringTime<=0)return;ringTime-=dt;if(ringTime<=0)mount();},
        draw(c){
          background(c,'#30253e','#12333b');stars(c,'#d4c9e8',48);
          glow(c,320,142,225,'#916b9d31');
          for(let i=0;i<6;i++){frond(c,12+i*13,350,54+i*16,-19+i*9,'#31494d');frond(c,553+i*14,352,75+i*12,17-i*7,'#354850');}
          path(c,[[114,61],[524,61]],'#a8a69b',5);path(c,[[133,61],[161,33],[478,33],[508,61]],'#706a77',2);
          for(let i=0;i<4;i++){
            const x=slotX(i), index=bars[i], color=colors[index], valid=index===target[i];
            const yTarget=top+lengths[target[i]], selected=picked===i;
            const swing=ringTime>0&&!fx.reduced?Math.sin(ringTime*15+i*.8)*ringTime*4:0;
            path(c,[[x,63],[x+swing,top]],'#a69f9c',1.5);
            const brass=c.createLinearGradient(x-11,0,x+13,0);brass.addColorStop(0,'#6e6b7a');brass.addColorStop(.24,color);brass.addColorStop(.56,'#e4d9bc');brass.addColorStop(1,'#796a76');
            box(c,x-10+swing,top,20,lengths[index],brass,selected?'#fff2c8':'#ac9890',5);
            path(c,[[x-18,yTarget-4],[x-18,yTarget+4],[x-12,yTarget+4]],valid?'#b0e5c9':'#ffd996',2);
            path(c,[[x+18,yTarget-4],[x+18,yTarget+4],[x+12,yTarget+4]],valid?'#b0e5c9':'#ffd996',2);
            if(cursor===i)box(c,x-33,75,66,183,null,selected?'#f6d78c':'#b3a6c7',8);
            label(c,String(index+1)+' / '+String(target[i]+1),x,278,15,valid?'#b1edca':ink);
          }
          label(c,picked<0?'Choose a tube to move':'Choose its swap partner',320,328,16,ink);
        }
      };
    },true);

  register('paper-meridian','Paper Meridian','#eab3a1',
    'Fold the printed seal onto its outline. Choose the crease that mirrors them.',
    'Left/right selects a crease. Space folds. Tap a crease symbol, then Fold.',fx=>{
      const cx=320,cy=149,half=91;
      const directions=[[0,1],[1,0],[Math.SQRT1_2,Math.SQRT1_2],[Math.SQRT1_2,-Math.SQRT1_2]];
      const corners=[[-half,-half],[half,-half],[half,half],[-half,half]];
      let source,target,solution,selected,elapsed=0,folding=false,won=false,edition=0;
      function distance(p,d){return p[0]*d[1]-p[1]*d[0];}
      function mirror(p,d){
        const n=distance(p,d);
        return [p[0]-2*n*d[1],p[1]+2*n*d[0]];
      }
      function deal(){
        solution=Math.floor(random(0,4));
        source=pick([[-56,-23],[24,-59],[58,26],[-21,58]]);
        target=mirror(source,directions[solution]);
        selected=(solution+pick([1,2,3]))%4;
        folding=false;elapsed=0;
      }
      function fold(){
        if(folding)return;
        folding=true;elapsed=0;won=selected===solution;
        if(won){edition++;fx.gain(5,cx+target[0],cy+target[1],'Seal registered · fold '+edition);}
        else{fx.tap();fx.note('Seals missed · try another crease');}
      }
      function sidePolygon(d,sign){
        const poly=[];
        for(let i=0;i<4;i++){
          const a=corners[i],b=corners[(i+1)%4],da=distance(a,d)*sign,db=distance(b,d)*sign;
          if(da>=0)poly.push(a);
          if((da>0&&db<0)||(da<0&&db>0)){
            const f=da/(da-db);poly.push([a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])]);
          }
        }
        return poly;
      }
      deal();
      return {
        press(k){if(folding)return;if(k==='left'||k==='right'){selected=wrap(selected+(k==='right'?1:-1),4);fx.tap();}if(k==='action')fold();},
        tap(x,y){if(folding||y<252||y>317)return;if(x>=377&&x<=465){fold();return;}
          const i=Math.round((x-206)/44);if(i>=0&&i<4&&Math.abs(x-(206+i*44))<=20){selected=i;fx.tap();}},
        update(dt){if(folding){elapsed+=dt;if(elapsed>.72){if(won)deal();else folding=false;}}},
        draw(c){
          background(c,'#2c283c','#483039');glow(c,320,150,172,'#c2896a2c');
          const d=directions[selected],sgn=Math.sign(distance(source,d))||1;
          const progress=folding?(fx.reduced?1:Math.min(1,elapsed/.46)):0;
          const f=(1-Math.cos(progress*Math.PI))/2;
          const lift=p=>{const r=mirror(p,d);return [p[0]+(r[0]-p[0])*f,p[1]+(r[1]-p[1])*f];};
          c.save();c.translate(cx,cy);
          const face=sidePolygon(d,-sgn),flap=sidePolygon(d,sgn);
          path(c,face,'#d6b298',1.5,'#efcfb1',true);
          path(c,flap.map(lift),'#e0b79c',1.5,progress>.5?'#cd9a91':'#e7bba7',true);
          c.setLineDash([4,4]);const extent=half/Math.max(Math.abs(d[0]),Math.abs(d[1]));
          path(c,[[-extent*d[0],-extent*d[1]],[extent*d[0],extent*d[1]]],'#885d65',2);c.setLineDash([]);
          circle(c,target[0],target[1],13,null,'#644551',2);circle(c,target[0],target[1],9,null,'#644551',1);
          const p=lift(source);circle(c,p[0],p[1],8,'#a8445a');path(c,[[p[0]-3,p[1]],[p[0],p[1]-3],[p[0]+3,p[1]],[p[0],p[1]+3]],null,1,'#f9d1bd',true);
          c.restore();
          for(let i=0;i<4;i++){const x=206+i*44;box(c,x-19,262,38,38,selected===i?'#644a59':'#352e42',selected===i?'#f2c59c':'#775e70',7);const [dx,dy]=directions[i];path(c,[[x-10*dx,281-10*dy],[x+10*dx,281+10*dy]],ink,2);}
          box(c,381,262,78,38,'#55414a','#cda78d',18);label(c,'Fold',420,281,15);
          label(c,'Find the crease between the two seals',320,331,15,mist);
        }
      };
    });

  register('tidepool-line','Tidepool Line','#95dfcc',
    'Drop the lure ahead of a passing fish. Reel when the hook ring touches it.',
    'Left/right moves the rod. Space drops or reels. Tap the water to cast, then tap again to reel.',fx=>{
      let rod=320,hookY=57,casting=false,catchCount=0;
      const fish=[
        {x:172,y:119,v:54,size:15,col:'#f5c689'},
        {x:428,y:165,v:-57,size:19,col:'#d89fc7'},
        {x:246,y:209,v:42,size:13,col:'#91dbce'},
        {x:529,y:245,v:-49,size:17,col:'#b7c5ee'}
      ];
      function nearby(){return fish.find(f=>Math.hypot((f.x-rod)*.82,f.y-hookY)<f.size+12);}
      function cast(){
        if(!casting){casting=true;hookY=57;fx.tap();return;}
        const f=nearby();
        if(f){
          catchCount++;fx.gain(3,rod,hookY,'Catch '+catchCount+' · released');
          f.x=f.v>0?-24:664;
        }else{fx.tap();fx.note('Empty hook · cast again');}
        casting=false;hookY=57;
      }
      return {
        press(k){if(k==='action')cast();if(k==='left'||k==='right')rod=clamp(rod+(k==='left'?-10:10),25,615);},
        tap(x){if(!casting)rod=clamp(x,25,615);cast();},
        update(dt,keys){
          rod=clamp(rod+dt*149*(held(keys,'right')-held(keys,'left')),25,615);
          for(const f of fish){f.x+=dt*f.v;if(f.x>670)f.x=-29;if(f.x < -30)f.x=669;}
          if(casting){hookY+=dt*69;if(hookY>=282){casting=false;hookY=57;fx.note('Reached the seabed · cast again');}}
        },
        draw(c){
          background(c,'#18505a','#162d45');glow(c,320,70,239,'#6ac7ab34');
          for(let i=0;i<7;i++){
            const x=13+i*100;
            path(c,[[x,65],[x+16,62],[x+37,64],[x+49,63]],'#4c8989',1.5);
          }
          path(c,[[0,283],[44,275],[94,288],[176,279],[237,293],[333,279],[424,292],[526,278],[585,286],[640,271],[640,360],[0,360]],null,1,'#203c49',true);
          for(let i=0;i<6;i++){frond(c,35+i*13,292,27+i*4,-16+i*6,'#346360');frond(c,522+i*15,290,24+i*5,17-i*6,'#396362');}
          for(const f of fish){
            c.save();c.translate(f.x,f.y);if(f.v<0)c.scale(-1,1);
            const wiggle=fx.reduced?0:Math.sin(fx.t*6+f.y)*2;
            path(c,[[-f.size+3,0],[-f.size-8,-7+wiggle],[-f.size-8,7+wiggle]],null,1,f.col,true);
            c.fillStyle=f.col;c.beginPath();c.ellipse(0,0,f.size,f.size*.41,0,0,tau);c.fill();
            path(c,[[-4,-2],[-8,-10],[4,-6]],null,1,f.col,true);circle(c,f.size*.6,-2,1.8,'#254453');
            c.restore();
          }
          path(c,[[rod-24,30],[rod+2,42],[rod,hookY]],'#d8e5cf',1.5);
          box(c,rod-26,27,12,6,'#c29877',null,2);circle(c,rod,hookY,5,'#e0a37f');
          if(casting){const bite=nearby();circle(c,rod,hookY,15,null,bite?'#f6db98':'#92b9ac',bite?3:1);if(bite)label(c,'Reel!',rod,hookY-24,14,'#ffdc9f');}
          label(c,casting?'Reel when the hook meets a fish':'Cast ahead of a passing fish',320,328,15,ink);
        }
      };
    });

  register('starlight-loom','Starlight Loom','#a9c4ff',
    'Weave the pictured constellation. Visit the numbered stars in order without breaking the thread.',
    'Steer the shuttle with arrows. Tap a star to guide the shuttle there.',fx=>{
      let shuttle={x:252,y:218},dest={...shuttle},nodes=[],next=0,pattern=0;
      const shapes=[[[0,0],[.7,-.8],[1,0],[.5,.9],[-.3,.45],[-1,.6]], [[0,-1],[.35,-.1],[1,.2],[.4,.8],[-.8,.5],[-.4,-.3]], [[-1,0],[-.6,-.6],[0,-.85],[.5,-.4],[1,.6],[.1,.8]]];
      function start(){nodes=shapes[pattern%shapes.length].map(([x,y])=>({x:331+x*171,y:169+y*96}));next=0;}
      start();
      return {tap(x,y){dest={x,y};fx.tap();},
        update(dt,keys){
          let dx=held(keys,'right')-held(keys,'left'),dy=held(keys,'down')-held(keys,'up');
          if(dx||dy)dest={...shuttle};else if(dist(shuttle,dest)>1){dx=dest.x-shuttle.x;dy=dest.y-shuttle.y;}
          const mag=Math.hypot(dx,dy);if(mag){const step=Math.min(188*dt,mag>1.5?mag:188*dt);shuttle.x=clamp(shuttle.x+dx/mag*step,15,625);shuttle.y=clamp(shuttle.y+dy/mag*step,35,307);}
          if(near(shuttle.x,shuttle.y,nodes[next],16)){
            fx.gain(1,nodes[next].x,nodes[next].y,'Thread '+(next+1)+' / '+nodes.length);next++;
            if(next===nodes.length){fx.gain(4,shuttle.x,shuttle.y,'Constellation woven');pattern++;start();}
          }
        },
        draw(c){background(c,'#1c2045','#0b2436');stars(c,'#d2def3',86);
          for(let i=1;i<nodes.length;i++){
            const a=nodes[i-1],b=nodes[i];c.setLineDash(i<next?[]:[3,7]);path(c,[[a.x,a.y],[b.x,b.y]],i<next?'#b9ccff':'#53637c',i<next?3:1);
          }c.setLineDash([]);
          if(next>0)path(c,[[nodes[next-1].x,nodes[next-1].y],[shuttle.x,shuttle.y]],'#8e9dcc',1);
          nodes.forEach((p,i)=>{circle(c,p.x,p.y,i===next?18:13,i<next?'#7586b3':'#283651',i===next?'#efe7bc':'#7b89a7',i===next?2:1);label(c,String(i+1),p.x,p.y,14,i===next?'#fff1b9':ink);});
          path(c,[[shuttle.x,shuttle.y-7],[shuttle.x+5,shuttle.y],[shuttle.x,shuttle.y+7],[shuttle.x-5,shuttle.y]],ink,1,'#fff5d4',true);
          label(c,'Guide the shuttle to star '+(next+1),320,331,15,ink);
        }};
    });

  register('sand-script','Sand Script','#f4ca8a',
    'Pour sand into the seven molds. Match each dotted fill line; empty an overfilled mold to retry.',
    'Left/right selects, Space pours one scoop, Down empties. Tap a mold to pour; tap its base to empty.',fx=>{
      const n=7;let target=[],level=[],sel=3,fall=[],batch=0;
      const cx=i=>122+i*66,base=263;
      function reset(){target=Array.from({length:n},()=>1+Math.floor(Math.random()*4));level=Array(n).fill(0);}reset();
      function empty(){level[sel]=0;fx.note('Mold emptied');fx.tap();}
      function pour(){if(level[sel]>=5){fx.note('Empty this mold from its base');return;}level[sel]++;fx.tap();
        if(!fx.reduced)for(let i=0;i<8;i++)fall.push({x:cx(sel)+random(-9,9),y:62-random(0,22),v:random(120,170),low:base-level[sel]*27});
        if(level[sel]===target[sel])fx.burst(cx(sel),base-level[sel]*27,'#ffe1a2');
        if(level.every((v,i)=>v===target[i])){batch++;fx.gain(12,320,173,'Landscape '+batch+' cast');reset();}
      }
      return {press(k){if(k==='left')sel=wrap(sel-1,n);if(k==='right')sel=wrap(sel+1,n);if(k==='action')pour();if(k==='down')empty();},
        tap(x,y){const i=Math.round((x-122)/66);if(i<0||i>=n||Math.abs(cx(i)-x)>31)return;sel=i;if(y>=base+4)empty();else pour();},
        update(dt){fall=fall.filter(p=>{p.v+=dt*450;p.y+=dt*p.v;return p.y<p.low;});},
        draw(c){background(c,'#392b3a','#253046');stars(c,'#e4bd97');
          for(let i=0;i<n;i++){
            const x=cx(i),h=level[i]*27;
            box(c,x-25,111,50,base-110,'#282235',i===sel?'#f5cf99':'#655364',3);
            if(h){const colors=['#e9c88b','#c99575','#d2a882','#bf8c7b','#b7a188'];for(let j=0;j<level[i];j++)box(c,x-22,base-(j+1)*27,44,26,colors[j],null,2);}
            c.setLineDash([4,3]);path(c,[[x-28,base-target[i]*27],[x+28,base-target[i]*27]],'#fff1b9',2);c.setLineDash([]);
            label(c,level[i]===target[i]?'✓':level[i]+'/'+target[i],x,280,14,level[i]===target[i]?'#bbebc9':ink);
          }
          path(c,[[cx(sel)-17,47],[cx(sel)+17,47],[cx(sel)+4,68],[cx(sel)-4,68]],'#dfb883',2,'#9c754e',true);
          fall.forEach(p=>circle(c,p.x,p.y,2,'#e8c58e'));label(c,'Match the seven fill lines',320,329,15,mist);
        }};
    });

  register('wave-dial','Wave Dial','#9adfea',
    'Surf the aqua pocket. Trim up and down to stay in the foam. Lift at a gold crest for a bonus.',
    'Up/down trims the board. Space lifts. Tap above or below to trim; tap the board to lift.',fx=>{
      const riderX=203;
      let rideY=206,pointerY=null,pocketTime=0,lift=0,swellUsed=-1;
      const angle=(x,t)=>(x-riderX)*.012 + t*1.58;
      const surface=(x,t)=>172+Math.cos(angle(x,t))*29+Math.sin(x*.007-t*.7)*6;
      const pocket=(x,t)=>surface(x,t)+24;
      let target=pocket(riderX,0);
      function isGold(){return Math.cos(angle(riderX,fx.t))<-.64;}
      function inside(){return Math.abs(rideY-target)<=13;}
      function crest(){
        if(lift>0)return;
        const cycle=Math.floor(angle(riderX,fx.t)/tau);
        if(inside()&&isGold()&&swellUsed!==cycle){
          swellUsed=cycle;lift=.6;fx.gain(4,riderX,rideY-8,'Crest lift +4');
        }else{fx.note(isGold()?'Trim into the aqua pocket':'Lift at the gold crest');fx.tap();}
      }
      return {
        describe(){return (rideY<target-13?'Trim down. ':rideY>target+13?'Trim up. ':'Riding the pocket. ')+(isGold()?'Gold crest now.':'Swell rolling.');},
        press(k){if(k==='action')crest();if(k==='up'||k==='down'){pointerY=null;rideY=clamp(rideY+(k==='up'?-4:4),128,258);}},
        tap(x,y){if(Math.abs(x-riderX)<46&&Math.abs(y-rideY)<25){crest();return;}pointerY=clamp(y,128,258);},
        update(dt,keys){
          target=pocket(riderX,fx.t);const direct=held(keys,'down')-held(keys,'up');
          if(direct){pointerY=null;rideY+=direct*105*dt;}
          else if(pointerY!==null)rideY+=clamp(pointerY-rideY,-105*dt,105*dt);
          rideY=clamp(rideY,128,258);lift=Math.max(0,lift-dt);
          pocketTime+=inside()?dt:0;if(pocketTime>=1.15){pocketTime-=1.15;fx.gain(1,riderX,rideY,'Foam ride +1');}
        },
        draw(c){
          background(c,'#41375e','#60939d');stars(c,'#e2cfdd',33);
          const sun=c.createLinearGradient(0,54,0,140);sun.addColorStop(0,'#ffdec2');sun.addColorStop(1,'#eea1a8');
          circle(c,487,91,28,sun);
          path(c,[[0,149],[75,134],[113,142],[179,119],[233,140],[278,127],[341,143],[376,137],[411,144],[485,131],[566,144],[619,122],[640,127],[640,180],[0,180]],null,1,'#595579',true);
          const edge=[],lower=[],middle=[],foamBand=[];
          for(let x=0;x<=640;x+=5){const y=surface(x,fx.t);edge.push([x,y]);middle.push([x,y+12]);foamBand.push([x,y+36]);lower.push([x,y+60]);}
          path(c,[...edge,[640,360],[0,360]],'#b7e2d5',2,'#2c727e',true);
          path(c,[...middle,...foamBand.slice().reverse()],null,1,'#65b5ae',true);
          path(c,lower,'#4b9295',2);
          for(let i=0;i<8;i++){const x=i*83+12,y=surface(x,fx.t);path(c,[[x,y+4],[x+10,y+3],[x+15,y+5]],'#a8d8cc',1.5);}
          const gold=isGold();
          if(gold)path(c,[[riderX-20,target+12],[riderX,target+17],[riderX+21,target+12]],'#ffd78a',3);
          const hop=fx.reduced?0:Math.sin(Math.PI*Math.min(1,lift/.6))*27;
          c.save();c.translate(riderX,rideY-hop);c.rotate(inside()?-0.1:0.03);
          path(c,[[-24,2],[-17,5],[13,5],[26,1],[29,-3],[13,0]],'#eff0d2',2,'#e5b985',true);
          path(c,[[-12,-1],[-8,-10],[-2,-14],[3,-9],[12,-1]],'#30334e',3);
          path(c,[[-3,-12],[0,-23],[7,-26]],'#efb197',4);
          path(c,[[0,-21],[-7,-18],[-14,-20]],'#f4c5a5',2.5);
          circle(c,6,-29,4.4,'#f7d1b8');c.restore();
          const read=!inside()?'Trim '+(rideY<target?'down':'up'):gold?(swellUsed===Math.floor(angle(riderX,fx.t)/tau)?'Crest cleared':'Gold crest · lift!'):'In the pocket';
          box(c,242,275,156,36,'#245663',gold?'#f4cd8d':'#8fcdc3',18);label(c,read,320,293,14);
          label(c,'Follow the pale foam stripe',320,334,14,'#deeeed');
        }
      };
    });

  register('pearl-passage','Pearl Passage','#aae7dc',
    'Dive through branching reefs for pearls. Every step uses one air. Surface to bank your haul before air runs out.',
    'Left/right chooses a branch; Space or Down dives. Up surfaces. Tap a reef or Surface.',fx=>{
      let air=5,haul=0,depth=0,sel=0,options=[],last='';
      function choices(){options=[0,1].map(()=>({gems:1+Math.floor(Math.random()*3),bubble:Math.random()<.24}));}
      function reset(){air=5;haul=0;depth=0;sel=0;choices();}reset();
      function surface(){if(!depth){fx.note('Dive for a pearl first');return;}fx.gain(haul,320,120,haul+' pearls banked');last='Last haul '+haul;reset();}
      function dive(){const o=options[sel];air--;haul+=o.gems;depth++;if(o.bubble)air=Math.min(5,air+1);fx.tap();
        if(!air){fx.note('Out of air · pearls drifted away');last='Last dive lost';reset();return;}
        fx.burst(sel?435:204,211,'#a9ebd8');choices();}
      return {press(k){if(k==='left')sel=0;if(k==='right')sel=1;if(k==='action'||k==='down')dive();if(k==='up')surface();},
        tap(x,y){if(y<111){surface();return;}if(y>=137&&y<=277){sel=x<320?0:1;dive();}},
        draw(c){background(c,'#104250','#172743');stars(c,'#9ecfcf',43);
          for(let i=0;i<7;i++){
            frond(c,5+i*12,360,75+i*8,-14+i*4,'#22626a');
            frond(c,553+i*13,360,48+i*14,-18+i*6,'#255760');
          }
          c.save();for(let i=0;i<7;i++){c.globalAlpha=.035+(i%2)*.02;path(c,[[45+i*100,0],[79+i*100,0],[-12+i*100,295],[-83+i*100,295]],null,1,'#b9f6e8',true);}c.restore();
          box(c,265,58,110,40,'#1c525f','#8dccc5',20);label(c,'↑ Surface',320,78,15);
          for(let i=0;i<5;i++)circle(c,71+i*17,63,5,i<air?'#b6edea':null,'#7cacb1',1);label(c,'AIR',101,43,11,mist);
          label(c,haul+' pearls',521,64,16);label(c,last,525,87,11,mist);
          path(c,[[320,118],[320,130],[205,180]],'#598197',2);path(c,[[320,130],[435,180]],'#598197',2);
          options.forEach((o,i)=>{const x=i?435:205,y=210;
            circle(c,x,y,53,i===sel?'#2a5e68':'#244754',i===sel?'#b5edda':'#61858d',i===sel?3:1);
            for(let j=0;j<o.gems;j++){const px=x+(j-(o.gems-1)/2)*13;circle(c,px,y,6,'#f6dcc8');circle(c,px-1.5,y-2,2,ink);}
            c.beginPath();c.ellipse(x,y+10,24,9,0,0,Math.PI);c.strokeStyle='#dad4bf';c.lineWidth=2;c.stroke();
            if(o.bubble){circle(c,x+26,y-25,9,null,'#a1edf0',2);label(c,'+',x+26,y-25,11);}
            label(c,o.bubble?'Pearls + air':'Pearl reef',x,278,13,mist);
          });
          label(c,'Depth '+depth+'   ·   '+(air<=2?'Surface soon':'Choose the next reef'),320,329,15,air<=2?'#ffcd9f':ink);
        }};
    });
})();
