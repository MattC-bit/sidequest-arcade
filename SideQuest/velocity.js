/* SideQuest · Velocity cartridges. All world positions use the 640 × 360 playfield. */
(() => {
  'use strict';
  const W = 640, H = 360, TAU = Math.PI * 2;
  const aqua = '#66ffe1', pink = '#ff638e', amber = '#ffcb63', white = '#edf9ff';
  const violet = '#a58aff';
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const rand = (low, high) => low + Math.random() * (high - low);
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const register = (id, title, hint, controls, color, create) =>
    SQ.register({ id, title, group: 'Velocity', hint, controls, color, create });
  function box(c, x, y, w, h, color) {
    c.fillStyle = color; c.fillRect(x, y, w, h);
  }
  function line(c, x, y, u, v, color, width = 1) {
    c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(x, y);
    c.lineTo(u, v); c.stroke();
  }
  function shape(c, pts, fill, stroke, width = 1) {
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
  }
  function circle(c, x, y, r, fill, stroke, width = 1) {
    c.beginPath(); c.arc(x, y, Math.max(0, r), 0, TAU);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
  }
  function label(c, str, x, y, color = white, size = 12, align = 'center') {
    c.fillStyle = color; c.font = '700 ' + size + 'px ui-monospace, monospace';
    c.textAlign = align; c.textBaseline = 'middle'; c.fillText(str, x, y);
  }
  function backdrop(c, top = '#10152c', bottom = '#111e34') {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    box(c, 0, 0, W, H, g);
  }
  function stars(c, height = 180) {
    for (let i = 0; i < 48; i++) {
      const x = (i * 149 + 17) % W, y = (i * i * 17 + 3) % height;
      box(c, x, y, i % 8 ? 1 : 2, i % 8 ? 1 : 2, i % 4 ? '#6f84a5' : '#dee5fd');
    }
  }
  function skyline(c, y, color, offset = 0, scale = 1) {
    for (let i = -1; i < 24; i++) {
      const index = i + Math.floor(offset / 34) + 2000;
      const x = i * 34 - offset % 34, h = (12 + (index * 31) % 47) * scale;
      box(c, x, y - h, 29, h, color);
      box(c, x + 4, y - h - 4, 17, 4, color);
      for (let row = 8; row < h - 3; row += 10)
        for (let col = 4; col < 24; col += 9)
          if ((row + index + col) % 3) box(c, x + col, y - h + row, 3, 2, '#737b9b');
    }
  }
  function diamond(c, x, y, r, color) {
    shape(c, [[x,y-r],[x+r,y],[x,y+r],[x-r,y]], '#172d3b', color, 2);
    circle(c,x,y,Math.max(1,r/4),color);
  }
  function status(c, str) {
    const width = 20 + str.length * 8;
    box(c, 12, 12, width, 24, '#101524eb');
    label(c, str, 22, 24, white, 12, 'left');
  }
  function outcome(api, points = 1) { api.score(points); api.sound('good'); }

  register('night-run', 'Night Run', 'Slip through traffic. Catch the cyan diamonds.', 'Left / right · tap a lane', aqua, api => {
    let lane = 1, visualLane = 1, spawn = 0.75, t = 0, hull = 3, flash = 0;
    const traffic = [{lane:2,z:.63,gem:false},{lane:1,z:.63,gem:true},
      {lane:0,z:.17,gem:false},{lane:2,z:.17,gem:true}];
    function project(z, laneOffset = 0) {
      const q = z * z;
      return { x: 320 + laneOffset * (14 + 141 * q), y: 128 + 185 * q, s: 0.14 + 0.86 * q };
    }
    function car(c,x,y,s,enemy) {
      c.save(); c.translate(x,y); c.scale(s,s);
      c.save();c.scale(1,.18);circle(c,0,34,47,'#0c1021');c.restore();
      box(c,-37,3,12,7,'#080d19');box(c,25,3,12,7,'#080d19');
      const paint=c.createLinearGradient(0,-27,0,8);
      paint.addColorStop(0,enemy?'#e690af':'#d7f6fd');paint.addColorStop(.54,enemy?'#af5678':'#8bc0da');
      paint.addColorStop(1,enemy?'#52304d':'#36536c');
      shape(c,[[-45,0],[-41,-13],[-25,-17],[-16,-28],[16,-28],[27,-17],[41,-13],[45,0],[38,7],[-38,7]],paint,enemy?'#eda0bc':'#bdefff',1.2);
      shape(c,[[-22,-16],[-14,-25],[14,-25],[22,-16]],'#212843','#67819f');
      for(let n=0;n<3;n++)line(c,-15-n*2,-23+n*3,15+n*2,-23+n*3,'#404461');
      shape(c,[[-39,-12],[-23,-15],[23,-15],[39,-12],[32,-11],[-32,-11]],'#31405c');
      box(c,-38,-9,76,7,'#212338');box(c,-36,-8,25,4,pink);box(c,11,-8,25,4,pink);
      for(const dir of [-1,1]){
        for(let i=15;i<36;i+=6)line(c,i*dir,-8,i*dir,-4,'#82364d');
        line(c,dir*40,-10,dir*42,-3,enemy?'#e4a8b5':'#b1dded');
      }
      box(c,-6,-7,12,3,enemy?'#925169':'#738da9');
      shape(c,[[-39,1],[-27,0],[-21,2],[21,2],[27,0],[39,1],[35,5],[-35,5]],'#233047');
      box(c,-28,2,7,2,'#7992a2');box(c,21,2,7,2,'#7992a2');
      if(!enemy){line(c,-25,7,25,7,aqua,1.4);}
      c.restore();
    }
    return {
      press(k) { if(k==='left') lane=clamp(lane-1,0,2); if(k==='right') lane=clamp(lane+1,0,2); },
      tap(x) { lane=clamp(Math.floor(x/(W/3)),0,2); },
      update(dt) {
        t+=dt; flash=Math.max(0,flash-dt); visualLane+=(lane-visualLane)*(1-Math.exp(-14*dt));
        if((spawn-=dt)<=0) {
          const blocked=pick([0,1,2]); traffic.push({lane:blocked,z:0,gem:false});
          if(Math.random()<0.85) traffic.push({lane:(blocked+pick([1,2]))%3,z:0,gem:true});
          spawn=1.12;
        }
        for(let i=traffic.length-1;i>=0;i--) {
          const o=traffic[i]; o.z+=dt*(0.38+Math.min(t,28)*0.0025);
          if(o.z>=1) {
            if(o.lane===lane) {
              if(o.gem) outcome(api,3);
              else { hull--;flash=.26;api.sound('hit');if(!hull){api.end('Traffic caught up');return;} }
            } else if(!o.gem) api.score(1);
            traffic.splice(i,1);
          }
        }
      },
      draw(c) {
        backdrop(c,'#161230','#a24b76');
        const horizon=c.createLinearGradient(0,0,0,141);
        horizon.addColorStop(0,'#15132f');horizon.addColorStop(.52,'#4a2c58');horizon.addColorStop(1,'#c46276');
        box(c,0,0,W,141,horizon);stars(c,105);
        const sun=c.createLinearGradient(0,34,0,127);sun.addColorStop(0,'#ffdf86');sun.addColorStop(1,'#ff518f');
        c.save();c.beginPath();c.arc(320,96,59,0,TAU);c.clip();box(c,251,33,139,124,sun);
        for(let y=83;y<150;y+=7)box(c,251,y,139,(y-72)*.075,'#73416b');c.restore();
        shape(c,[[0,86],[57,112],[115,73],[158,104],[198,95],[240,124],[296,116],[389,126],[458,92],[493,100],[544,71],[602,106],[640,80],[640,140],[0,140]],'#3c3158');
        skyline(c,131,'#393150',0,.53);
        for(const [tx,ty] of [[64,92],[176,95],[464,92],[568,85]]){
          box(c,tx-4,ty+5,8,125-ty,'#3a2c4c');line(c,tx,ty-8,tx,ty+5,'#54374e');
          box(c,tx-1,ty-9,2,2,pink);line(c,tx+2,ty+10,tx+2,ty+23,'#a66677');
        }
        box(c,0,131,W,229,'#231a39');
        for(let n=-8;n<=8;n++){line(c,320+n*17,131,320+n*136,360,'#4c2c4e');}
        for(let i=0;i<12;i++) {
          const phase=(i/12+(api.reduced?0:t*.13))%1;
          const y=130+phase*phase*245;line(c,0,y,640,y,'#593451');
        }
        const asphalt=c.createLinearGradient(0,128,0,360);
        asphalt.addColorStop(0,'#68405b');asphalt.addColorStop(.23,'#352940');asphalt.addColorStop(1,'#12192a');
        shape(c,[[299,128],[341,128],[626,360],[14,360]],asphalt);
        for(const n of [-1,0,1]){
          const near=project(1.14,n),far=project(.4,n);
          line(c,far.x,far.y,near.x,near.y,'#34283c');
        }
        for(const l of [-1.5,-.5,.5,1.5]) {
          const edge=Math.abs(l)>1;
          if(edge){line(c,320+l*14,128,320+l*203,360,'#e782bb',2);continue;}
          for(let i=0;i<9;i++){
            const z=(i/9+(api.reduced?0:t*.39))%1.10;
            const a=project(z,l),b=project(Math.min(1.13,z+.043),l);line(c,a.x,a.y,b.x,b.y,'#b5ade3',1+3*z);
          }
        }
        for(let i=0;i<7;i++){
          const z=(i/7+(api.reduced?0:t*.34))%1.1;
          for(const dir of [-1,1]){
            const p=project(z,dir*1.63);
            line(c,p.x,p.y,p.x,p.y-13*p.s,'#664662',Math.max(1,3*p.s));
            box(c,p.x-2*p.s,p.y-14*p.s,4*p.s,3*p.s,amber);
          }
        }
        for(let i=traffic.length-1;i>=0;i--) {
          const o=traffic[i], p=project(o.z,o.lane-1);
          if(o.gem) diamond(c,p.x,p.y-12*p.s,13*p.s,aqua);else car(c,p.x,p.y,p.s*.85,true);
        }
        const p=project(1,visualLane-1);car(c,p.x,p.y+13,1.13,false);
        if(flash>0) { c.strokeStyle=pink;c.lineWidth=5;c.strokeRect(3,3,W-6,H-6); }
        status(c,'HULL '+hull+'/3');
      }
    };
  });

  register('prism-break','Prism Break','Clear the glass wall with your rebound paddle.','Left / right · tap to aim paddle',pink,api=>{
    let px=320,target=320,x=320,y=287,vx=102,vy=-172,delay=.8,lives=3;
    const blocks=[];
    function fill(){for(let r=0;r<4;r++)for(let col=0;col<10;col++)blocks.push({x:25+col*59,y:59+r*23,r});}
    fill();
    return{
      press(){},tap(tx){target=clamp(tx,54,586);},
      update(dt,input){
        target=clamp(target+((input.has('right')?1:0)-(input.has('left')?1:0))*410*dt,54,586);
        px+=(target-px)*(1-Math.exp(-22*dt));
        if(delay>0){delay-=dt;x=px;y=287;return;}
        const prevY=y;x+=vx*dt;y+=vy*dt;
        if(x<15||x>625){vx=(x<15?1:-1)*Math.abs(vx);x=clamp(x,15,625);}
        if(y<43){y=43;vy=Math.abs(vy);}
        if(vy>0&&prevY<=303&&y>=303&&Math.abs(x-px)<50){y=302;vx=(x-px)*4.45;vy=-Math.sqrt(Math.max(130*130,255*255-vx*vx));api.sound('tap');}
        for(let i=blocks.length-1;i>=0;i--){const b=blocks[i];if(x+5>=b.x&&x-5<=b.x+54&&y+5>=b.y&&y-5<=b.y+18){
          if(prevY<=b.y||prevY>=b.y+18){vy=-vy;y=vy<0?b.y-6:b.y+24;}else vx=-vx;
          blocks.splice(i,1);outcome(api,2);break;
        }}
        if(!blocks.length){fill();outcome(api,12);}
        if(y>367){lives--;api.sound('hit');if(!lives){api.end('Last orb spent');return;}delay=.75;vy=-190;vx=pick([-105,105]);}
      },
      draw(c){
        backdrop(c,'#1b1735','#10172a');for(let i=12;i<640;i+=22)for(let j=45;j<360;j+=22)box(c,i,j,1,1,'#534969');
        for(const b of blocks){const tone=[pink,'#ffb66e',aqua,violet][b.r];box(c,b.x,b.y,54,18,'#252641');
          shape(c,[[b.x,b.y+4],[b.x+4,b.y],[b.x+54,b.y],[b.x+49,b.y+11],[b.x+1,b.y+14]],tone);line(c,b.x+3,b.y+16,b.x+49,b.y+16,tone);}
        box(c,px-44,307,88,10,'#265272');box(c,px-43,305,86,4,aqua);box(c,px-30,315,60,2,'#45547c');
        circle(c,x,y,7,'#755380');circle(c,x,y,4,'#fff9d5');status(c,'ORBS '+lives);
      }
    };
  });

  register('starling','Starling','Break the formation. Your cannons fire automatically.','Left / right · tap to steer',amber,api=>{
    let ship=320,target=320,t=0,cool=.1,enemyCool=1.7,hull=3,inv=0;
    const shots=[],bombs=[],fleet=[];
    function formation(){for(let r=0;r<3;r++)for(let j=0;j<8;j++)fleet.push({base:81+j*58,y:61+r*32,r});}
    formation();
    const ex=e=>e.base+47*Math.sin(t*1.3);
    return{
      press(){},tap(x){target=clamp(x,18,622);},
      update(dt,keys){
        t+=dt;inv=Math.max(0,inv-dt);target=clamp(target+((keys.has('right')?1:0)-(keys.has('left')?1:0))*390*dt,18,622);
        ship+=(target-ship)*(1-Math.exp(-20*dt));
        if((cool-=dt)<=0){shots.push({x:ship,y:293});cool=.23;}
        if((enemyCool-=dt)<=0&&fleet.length){const e=pick(fleet);bombs.push({x:ex(e),y:e.y+12});enemyCool=.51;}
        for(let i=shots.length-1;i>=0;i--){const s=shots[i];s.y-=dt*360;
          const hit=fleet.findIndex(e=>Math.abs(ex(e)-s.x)<17&&Math.abs(e.y-s.y)<12);
          if(hit>=0){fleet.splice(hit,1);shots.splice(i,1);outcome(api,2);}else if(s.y<0)shots.splice(i,1);
        }
        for(let i=bombs.length-1;i>=0;i--){const b=bombs[i];b.y+=dt*178;
          if(Math.abs(b.x-ship)<16&&Math.abs(b.y-313)<16){bombs.splice(i,1);if(!inv){inv=1;hull--;api.sound('hit');if(!hull){api.end('Wing lost');return;}}}else if(b.y>370)bombs.splice(i,1);
        }
        if(!fleet.length){outcome(api,8);formation();}
      },
      draw(c){backdrop(c,'#131425','#171b35');stars(c,H);
        circle(c,538,77,47,'#27223d');line(c,469,103,607,51,'#5d4765',3);
        for(const e of fleet){const x=ex(e),y=e.y,co=[pink,amber,violet][e.r];
          shape(c,[[x-15,y+6],[x-13,y-3],[x-5,y-8],[x,y-3],[x+5,y-8],[x+13,y-3],[x+15,y+6],[x+7,y+2],[x,y+8],[x-7,y+2]],'#31294c',co,2);box(c,x-3,y-1,6,3,co);}
        for(const s of shots){box(c,s.x-2,s.y-6,4,12,aqua);}
        for(const b of bombs){diamond(c,b.x,b.y,5,pink);}
        shape(c,[[ship,294],[ship+7,311],[ship+19,323],[ship+5,321],[ship,327],[ship-5,321],[ship-19,323],[ship-7,311]],'#58889d',white,2);
        box(c,ship-2,307,4,11,aqua);if(inv>0)circle(c,ship,314,22,null,aqua);
        status(c,'WINGS '+hull);
      }
    };
  });

  register('roof-runner','Roof Runner','Jump the gaps. Use your second jump in midair.','Space / up · tap to jump',amber,api=>{
    let t=0,x=120,y=250,vy=0,jumps=0,ground=true;
    const roofs=[{x:-50,y:250,w:350,passed:true}];
    function jump(){if(jumps<2){vy=jumps?-244:-305;jumps++;ground=false;api.sound('tap');}}
    return{press(k){if(k==='up'||k==='action')jump();},tap:jump,
      update(dt){t+=dt;const speed=157+Math.min(t*2,56);const old=y;
        for(const r of roofs)r.x-=speed*dt;
        while(roofs[0].x+roofs[0].w<0)roofs.shift();
        let tail=roofs[roofs.length-1];
        while(tail.x+tail.w<760){const ny=clamp(tail.y+rand(-38,38),211,280);
          tail={x:tail.x+tail.w+rand(49,90),y:ny,w:rand(91,169),passed:false};roofs.push(tail);}
        vy+=720*dt;y+=vy*dt;ground=false;
        for(const r of roofs){
          if(x+6>r.x&&x-6<r.x+r.w&&vy>=0&&old<=r.y+1&&y>=r.y){y=r.y;vy=0;jumps=0;ground=true;if(!r.passed){r.passed=true;outcome(api,3);}break;}
        }
        if(!ground&&jumps===0)jumps=1;
        if(y>377)api.end('Missed the roof');
      },
      draw(c){backdrop(c,'#201a3d','#a66070');stars(c,130);circle(c,508,76,36,'#f5c693');
        skyline(c,236,'#443750',api.reduced?0:t*9,.9);skyline(c,262,'#313049',api.reduced?0:t*21,1);
        for(const r of roofs){box(c,r.x,r.y,r.w,H-r.y,'#172037');box(c,r.x,r.y,r.w,4,amber);
          for(let j=9;j<r.w-8;j+=22)for(let k=r.y+17;k<360;k+=21)box(c,r.x+j,k,8,7,'#4f4c60');}
        const stride=ground&&!api.reduced?Math.sin(t*15)*6:3;
        line(c,x-4,y-13,x-7-stride,y-2,aqua,4);line(c,x-1,y-13,x+6+stride,y-2,white,4);
        shape(c,[[x-7,y-12],[x-6,y-25],[x+4,y-27],[x+6,y-17],[x+1,y-12]],'#599aa7',white);
        box(c,x-3,y-34,12,10,'#283546');box(c,x+2,y-31,9,3,aqua);
        shape(c,[[x-4,y-26],[x-24,y-22],[x-14,y-18]],pink);
        status(c,ground?'JUMP READY':(2-jumps)+' AIR JUMP');
      }
    };
  });

  register('orbit-courier','Orbit Courier','Launch along the arrow to catch the next orbit.','Space · tap to release',violet,api=>{
    let a=-2.35,t=0,attached=true,flight=0,vx=0,vy=0,x=0,y=0,ports=0;
    let home={x:144,y:190},dest={x:372,y:146};
    function reset(){attached=true;a=Math.atan2(dest.y-home.y,dest.x-home.x)-Math.PI/2-.7;}
    function launch(){if(attached){attached=false;flight=0;vx=-Math.sin(a)*310;vy=Math.cos(a)*310;api.sound('tap');}}
    function position(){x=home.x+Math.cos(a)*40;y=home.y+Math.sin(a)*40;}position();
    return{press(k){if(k==='action'||k==='up')launch();},tap:launch,
      update(dt){t+=dt;
        if(attached){a+=dt*1.65;position();}else{x+=vx*dt;y+=vy*dt;flight+=dt;
          if(Math.hypot(x-dest.x,y-dest.y)<55){
            home=dest;dest={x:home.x>320?rand(100,230):rand(395,535),y:rand(103,250)};
            a=Math.atan2(y-home.y,x-home.x);attached=true;ports++;outcome(api,5);position();
          }else if(x<0||x>W||y<0||y>H||flight>2.2){api.sound('hit');reset();position();}
        }
      },
      draw(c){backdrop(c,'#151327','#151d38');stars(c,H);
        for(const [p,k] of [[home,0],[dest,1]]) {
          circle(c,p.x,p.y,40,null,k?aqua:'#615786',2);circle(c,p.x,p.y,25,k?'#295867':'#574868');
          c.save();c.beginPath();c.arc(p.x,p.y,25,0,TAU);c.clip();
          for(let i=-2;i<3;i++)line(c,p.x-28,p.y+i*10,p.x+28,p.y-8+i*10,k?'#39747a':'#766082',3);c.restore();
          if(k){circle(c,p.x,p.y,54,null,'#398485');label(c,'DOCK',p.x,p.y+70,aqua);}
        }
        const angle=attached?a+Math.PI/2:Math.atan2(vy,vx);
        c.save();c.translate(x,y);c.rotate(angle);
        if(attached){
          const dx=dest.x-x,dy=dest.y-y,fx=Math.cos(angle),fy=Math.sin(angle);
          const linedUp=dx*fx+dy*fy>0&&Math.abs(dx*fy-dy*fx)<52;
          const guide=linedUp?aqua:amber;
          for(let i=18;i<(linedUp?100:65);i+=9)box(c,i,-1,5,2,guide);
          shape(c,[[66,0],[58,-4],[58,4]],guide);
          if(linedUp){c.save();c.rotate(-angle);label(c,'RELEASE',0,-19,aqua,10);c.restore();}
        }
        shape(c,[[11,0],[-7,-6],[-4,0],[-7,6]],white,aqua);c.restore();status(c,'DELIVERIES '+ports);
      }
    };
  });

  register('wake-rider','Wake Rider','Carve between the buoys. Your hydrofoil carries momentum.','Left / right · tap a heading',aqua,api=>{
    let x=320,vx=0,t=0,wait=.2,streak=0,target=null,next=320;const gates=[];
    return{press(){},tap(tx){target=tx;},
      update(dt,keys){t+=dt;let input=(keys.has('right')?1:0)-(keys.has('left')?1:0);
        if(input)target=null;else if(target!==null)input=clamp((target-x)/30,-1,1);
        vx=(vx+input*870*dt)*Math.exp(-3.9*dt);x=clamp(x+vx*dt,35,605);
        if((wait-=dt)<=0){next=clamp(next+rand(-140,140),100,540);gates.push({x:next,y:-12,done:false});wait=1.3;}
        for(let i=gates.length-1;i>=0;i--){const g=gates[i];g.y+=142*dt;
          if(!g.done&&g.y>=274){g.done=true;if(Math.abs(g.x-x)<=55){streak++;outcome(api,1+Math.min(streak,4));}else{streak=0;api.sound('hit');}}
          if(g.y>385)gates.splice(i,1);
        }
      },draw(c){backdrop(c,'#122a46','#22576a');
        for(let i=0;i<15;i++){const yy=(i*29+(api.reduced?0:t*72))%390-15;
          for(let j=0;j<7;j++){const xx=(j*97+i*51)%660;line(c,xx,yy,xx+19,yy+3,'#397281');}}
        for(const g of gates){line(c,g.x-58,g.y,g.x+58,g.y,'#457783');for(const [off,col] of [[-60,pink],[60,aqua]]){
          circle(c,g.x+off,g.y+4,9,'#193b51');circle(c,g.x+off,g.y,7,col);box(c,g.x+off-3,g.y-2,6,3,'#153943');}}
        c.save();c.translate(x,273);c.rotate(vx/1400);
        shape(c,[[-9,9],[-22,55],[-5,27],[0,62],[6,28],[24,55],[9,9]],'#78bad0');
        shape(c,[[0,-24],[11,5],[9,18],[-9,18],[-11,5]],white,'#112738',2);
        shape(c,[[0,-12],[6,4],[4,11],[-4,11],[-6,4]],'#327c84');c.restore();status(c,'GATE CHAIN '+streak);
      }
    };
  });

  register('crane-drop','Crane Drop','Release the swinging freight onto the landing pad.','Space · tap to release',amber,api=>{
    let t=0,a=0,angle=0,x=0,y=0,vx=0,vy=0,phase='swing',delay=0,target=389,result='',count=0;
    function rig(){angle=.87*Math.sin(a);x=320+Math.sin(angle)*176;y=31+Math.cos(angle)*176;}
    rig();
    function drop(){if(phase==='swing'){
      vx=Math.cos(angle)*176*.87*Math.cos(a)*1.25;vy=-Math.sin(angle)*176*.87*Math.cos(a)*1.25;
      phase='fall';api.sound('tap');
    }}
    return{press(k){if(k==='action'||k==='down')drop();},tap:drop,
      update(dt){t+=dt;if(phase==='swing'){a+=1.25*dt;rig();}else if(phase==='fall'){vy+=420*dt;x+=vx*dt;y+=vy*dt;
        if(y>=282){y=282;phase='result';delay=.7;const diff=Math.abs(target-x);
          if(diff<42){count++;outcome(api,diff<15?5:3);result=diff<15?'DEAD CENTER':'DELIVERED';}
          else{api.sound('hit');result='MISSED PAD';}}
        }else if((delay-=dt)<=0){phase='swing';target=rand(134,504);a+=.6;rig();}
      },draw(c){backdrop(c,'#23213c','#5c4d66');skyline(c,302,'#493c58',0,1.25);
        box(c,0,300,640,60,'#181c2d');for(let i=-10;i<660;i+=34)line(c,i,329,i+15,317,'#38394a',4);
        box(c,92,17,454,13,'#374155');for(let i=96;i<535;i+=22)line(c,i,28,i+17,18,amber,2);
        box(c,305,12,30,19,amber);circle(c,320,31,5,'#2d3141');
        if(phase==='swing'){line(c,320,31,x,y-16,white,2);line(c,x,y-16,x-16,y-8,amber);line(c,x,y-16,x+16,y-8,amber);}
        box(c,target-48,294,96,8,'#3db4a6');box(c,target-44,289,88,4,aqua);label(c,'LAND',target,317,aqua);
        box(c,x-18,y-11,36,22,'#c78350');c.strokeStyle=amber;c.lineWidth=2;c.strokeRect(x-18,y-11,36,22);
        for(let i=-13;i<18;i+=6)line(c,x+i,y-8,x+i,y+8,'#805544',2);
        if(phase==='result')label(c,result,320,87,white,16);status(c,'LOADS '+count);
      }
    };
  });

  register('switchyard','Switchyard','Read the train number. Set its track before the junction.','↑ 1 · Space 2 · ↓ 3 · tap a track',aqua,api=>{
    let selected=1,next=1,delivered=0;const tracks=[105,185,265], colors=[amber,aqua,pink],trains=[];
    function railY(x,d){if(x<270)return 185;if(x>420)return tracks[d];return 185+(tracks[d]-185)*(x-270)/150;}
    function choose(k){selected=k;api.sound('tap');}
    return{press(k){if(k==='up'||k==='left')choose(0);if(k==='action')choose(1);if(k==='down'||k==='right')choose(2);},
      tap(x,y){choose(clamp(Math.round((y-105)/80),0,2));},
      update(dt){if((next-=dt)<=0){trains.push({x:-20,d:pick([0,1,2]),route:null});next=1.82;}
        for(let i=trains.length-1;i>=0;i--){const s=trains[i];s.x+=162*dt;
          if(s.x>=270&&s.route===null){s.route=selected;if(s.route!==s.d)api.sound('hit');}
          if(s.x>593){if(s.route===s.d){delivered++;outcome(api,3);}trains.splice(i,1);}
        }
      },draw(c){backdrop(c,'#162632','#243744');for(let i=0;i<640;i+=32)line(c,i,44,i,335,'#2d424e');
        for(let i=59;i<346;i+=32)line(c,0,i,640,i,'#2d424e');
        for(let k=0;k<3;k++){
          const color=k===selected?colors[k]:'#657583';
          for(const offset of [-5,5]){line(c,0,185+offset,270,185+offset,'#6e8191',2);line(c,270,185+offset,420,tracks[k]+offset,color,3);line(c,420,tracks[k]+offset,640,tracks[k]+offset,color,3);}
          box(c,561,tracks[k]-21,48,15,'#162335');label(c,'0'+(k+1),585,tracks[k]-13,colors[k],12);
        }
        for(const s of trains){const y=railY(s.x,s.route??1);box(c,s.x-34,y-11,48,21,'#141b2c');
          shape(c,[[s.x-31,y-12],[s.x+8,y-12],[s.x+16,y-5],[s.x+16,y+8],[s.x-31,y+8]],colors[s.d]);
          box(c,s.x+4,y-7,7,6,'#243746');label(c,String(s.d+1),s.x-13,y-1,'#182b37',14);}
        circle(c,270,185,6,'#111b2a',white,2);status(c,'TRACK '+(selected+1)+'   SORTED '+delivered);
      }
    };
  });

  register('ion-pinball','Ion Pinball','Flip the ball into the charged bumpers. Both flippers work together.','Space / arrows · tap to flip',pink,api=>{
    let x=342,y=85,vx=83,vy=20,flip=0,lives=3,delay=.45,t=0;
    const bumpers=[[221,103,21],[321,145,24],[418,103,21],[176,193,16],[466,193,16]];
    const cooldowns=bumpers.map(()=>0);
    // Rounded line segment collision; resolve normal velocity and leave the surface.
    function collide(ax,ay,bx,by,radius,kick=0){
      const dx=bx-ax,dy=by-ay,q=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy),0,1);
      const ux=x-(ax+q*dx),uy=y-(ay+q*dy),len=Math.hypot(ux,uy);
      if(len>=radius||len<.001)return;
      const nx=ux/len,ny=uy/len,dot=vx*nx+vy*ny;
      x+=nx*(radius-len+.1);y+=ny*(radius-len+.1);
      if(dot<0){vx-=1.87*dot*nx;vy-=1.87*dot*ny;}
      if(kick&&y>230){vy=-265;vx+=(320-x)*1.4;api.sound('tap');}
    }
    function swing(){if(delay<=0){flip=.19;api.sound('tap');}}
    function arms(){const lift=flip>0?-22:18;return [[235,283,305,283+lift],[405,283,335,283+lift]];}
    return{press(k){if(['left','right','up','action'].includes(k))swing();},tap:swing,
      update(dt){t+=dt;flip=Math.max(0,flip-dt);if(delay>0){delay-=dt;return;}
        for(let step=0;step<3;step++){const d=dt/3;vy+=226*d;x+=vx*d;y+=vy*d;
          if(x<128||x>512){x=clamp(x,128,512);vx=(x===128?1:-1)*Math.abs(vx)*.95;}
          if(y<45){y=45;vy=Math.abs(vy);}
          for(let i=0;i<bumpers.length;i++){const [cx,cy,r]=bumpers[i],dx=x-cx,dy=y-cy,dist=Math.hypot(dx,dy);
            if(dist<r+6&&dist>.001){x=cx+dx/dist*(r+6.2);y=cy+dy/dist*(r+6.2);vx=dx/dist*228;vy=dy/dist*228;
              if(t>=cooldowns[i]){cooldowns[i]=t+.18;outcome(api,2);}}}
          collide(124,225,235,283,10);collide(516,225,405,283,10);
          for(const arm of arms())collide(...arm,11,flip>0);
          vx=clamp(vx,-335,335);vy=clamp(vy,-380,380);
          if(y>357){api.sound('hit');if(!--lives){api.end('Table drained');return;}x=rand(273,363);y=62;vx=pick([-87,87]);vy=27;delay=.55;break;}
        }
      },draw(c){backdrop(c,'#1b1534','#3b2145');
        shape(c,[[113,341],[113,63],[143,30],[497,30],[527,63],[527,341]],'#161829','#bb638a',3);
        for(let i=0;i<5;i++){line(c,153+i*9,53,183+i*9,53,'#493452',2);line(c,487-i*9,53,457-i*9,53,'#493452',2);}
        for(const [i,[cx,cy,r]] of bumpers.entries()){const co=[aqua,pink,amber,violet,aqua][i];circle(c,cx,cy,r+4,null,'#473952',2);circle(c,cx,cy,r,'#31324a',co,3);
          diamond(c,cx,cy,r*.5,co);}
        line(c,124,225,235,283,'#a56084',8);line(c,516,225,405,283,'#a56084',8);
        for(const [ax,ay,bx,by] of arms()){line(c,ax,ay,bx,by,aqua,9);circle(c,ax,ay,7,'#2c5461',white);}
        circle(c,x,y,7,'#dae9f2','#899dc0',2);circle(c,x-2,y-2,2,'#fff');status(c,'BALLS '+lives);
      }
    };
  });

  register('faultline','Faultline','Cross four conveyor belts to reach the safe ledge.','Arrow keys · tap toward a tile',amber,api=>{
    const rows=[309,260,211,162,113,64],dirs=[1,-1,1,-1],speeds=[76,115,98,124];
    let col=4,row=0,t=0,inv=0,hearts=3,crossed=0;
    const pos=()=>54+col*66;
    function step(key){let c=col,r=row;
      if(key==='left')c--;if(key==='right')c++;if(key==='up'||key==='action')r++;if(key==='down')r--;
      col=clamp(c,0,8);row=clamp(r,0,5);if(row===5){outcome(api,6);crossed++;row=0;}else if(c===col&&r===row)api.sound('tap');
    }
    function bots(i){const cycle=222+i*13,offset=i*57+dirs[i]*t*speeds[i],o=((offset%cycle)+cycle)%cycle;
      const xs=[];for(let x=o-cycle;x<W+cycle;x+=cycle)xs.push(x);return xs;}
    return{press:step,tap(tx,ty){const dx=tx-pos(),dy=ty-rows[row];step(Math.abs(dy)>Math.abs(dx)?(dy<0?'up':'down'):(dx<0?'left':'right'));},
      update(dt){t+=dt;inv=Math.max(0,inv-dt);if(row>0&&row<5&&!inv&&bots(row-1).some(b=>Math.abs(b-pos())<34)){
        row=0;hearts--;inv=.75;api.sound('hit');if(!hearts)api.end('Conveyor collision');}
      },draw(c){backdrop(c,'#21283c','#1d2231');
        for(let r=0;r<rows.length;r++){const y=rows[r];box(c,0,y-20,640,39,r===0||r===5?'#224646':'#34354b');
          if(!r||r===5){for(let i=0;i<640;i+=33)line(c,i,y+17,i+20,y+2,'#367066',4);continue;}
          for(let i=9;i<640;i+=50){const d=dirs[r-1];shape(c,[[i,y-4],[i+6*d,y],[i,y+4]],null,'#626377');}
          for(const xx of bots(r-1)){box(c,xx-24,y-12,48,24,'#8a5a59');box(c,xx-21,y-10,42,18,amber);
            box(c,xx-10,y-5,20,8,'#473646');box(c,xx+dirs[r-1]*19-2,y-6,4,10,white);}
        }
        const x=pos(),y=rows[row];circle(c,x,y,12,'#182e39',aqua,3);box(c,x-6,y-5,12,6,white);
        if(inv>0)circle(c,x,y,16,null,aqua);status(c,'SUITS '+hearts+'   CROSSED '+crossed);
      }
    };
  });

  register('aegis','Aegis','Turn your shield toward each incoming bolt.','Arrows · tap a direction',violet,api=>{
    const angles=[-Math.PI/2,0,Math.PI/2,Math.PI],keys=['up','right','down','left'];
    let face=0,t=0,wait=.35,charge=4,flare=0;const bolts=[];
    function turn(i){face=i;api.sound('tap');}
    return{press(k){if(keys.includes(k))turn(keys.indexOf(k));else if(k==='action')turn((face+1)%4);},
      tap(x,y){const dx=x-320,dy=y-184;turn(Math.abs(dx)>Math.abs(dy)?dx>0?1:3:dy>0?2:0);},
      update(dt){t+=dt;flare=Math.max(0,flare-dt);if((wait-=dt)<=0){bolts.push({d:pick([0,1,2,3]),r:148});wait=Math.max(.62,1.24-t*.014);}
        for(let i=bolts.length-1;i>=0;i--){const b=bolts[i];b.r-=dt*111;
          if(b.r<=37){if(b.d===face){outcome(api,2);flare=.15;}else{api.sound('hit');if(!--charge){api.end('Core breached');return;}}bolts.splice(i,1);}
        }
      },draw(c){backdrop(c,'#101a2b','#1e213d');stars(c,H);
        for(const r of [58,95,136])circle(c,320,184,r,null,'#353f62');
        for(const [i,a] of angles.entries()){
          const dx=Math.cos(a),dy=Math.sin(a);line(c,320+dx*49,184+dy*49,320+dx*142,184+dy*142,'#485071');
          label(c,['▲','▶','▼','◀'][i],320+dx*157,184+dy*157,'#9ba6c6',13);}
        for(const b of bolts){const a=angles[b.d],dx=Math.cos(a),dy=Math.sin(a),x=320+dx*b.r,y=184+dy*b.r;line(c,x+dx*11,y+dy*11,x,y,pink,4);circle(c,x,y,5,amber);}
        diamond(c,320,184,22,flare?white:violet);
        c.beginPath();c.arc(320,184,36,angles[face]-.63,angles[face]+.63);c.strokeStyle=aqua;c.lineWidth=7;c.stroke();
        status(c,'CORE '+charge+'/4');
      }
    };
  });

  register('soft-landing','Soft Landing','Land on the lit pad below 60 vertical speed and 45 sideways.','← → steer · hold Space / ↑ thrust · tap to pulse',aqua,api=>{
    let x,y,vx,vy,pad,thrust=false,pulse=0,rest=0,result='',count=0;
    function launch(){pad=rand(104,536);x=clamp(pad+pick([-1,1])*rand(45,115),85,555);y=69;vx=0;vy=10;rest=0;}
    launch();
    return{press(){},tap(tx,ty){if(rest<=0){vx=clamp(vx+(tx-x)*.14,-90,90);pulse=.24;}},
      update(dt,k){if(rest>0){if((rest-=dt)<=0)launch();return;}
        pulse=Math.max(0,pulse-dt);thrust=k.has('up')||k.has('action')||pulse>0;
        const dir=(k.has('right')?1:0)-(k.has('left')?1:0);vx=(vx+dir*104*dt)*Math.exp(-.78*dt);vy=clamp(vy+(61-(thrust?149:0))*dt,-78,162);
        x=clamp(x+vx*dt,12,628);y+=vy*dt;if(y<49){y=49;vy=Math.max(vy,0);}
        if(y>=282){y=282;rest=.75;if(Math.abs(x-pad)<41&&vy<=60&&Math.abs(vx)<=45){count++;outcome(api,6);result='SOFT CONTACT';}
          else{api.sound('hit');result=Math.abs(x-pad)>=41?'MISSED PAD':'HARD CONTACT';}}
      },draw(c){backdrop(c,'#101a32','#292a4a');stars(c,245);circle(c,506,84,31,'#474665');circle(c,515,75,27,'#2a2c49');
        shape(c,[[0,263],[38,250],[68,262],[128,233],[186,262],[262,247],[322,264],[381,246],[446,264],[514,240],[575,259],[640,248],[640,360],[0,360]],'#39394f');
        box(c,0,296,640,64,'#22283a');box(c,pad-48,293,96,6,aqua);
        for(const d of [-1,1]){line(c,pad+d*49,294,pad+d*49,273,white);circle(c,pad+d*49,271,3,amber);}
        if(thrust&&!rest)shape(c,[[x-5,y+7],[x,y+23],[x+5,y+7]],amber);
        line(c,x-5,y+3,x-12,y+11,white,2);line(c,x+5,y+3,x+12,y+11,white,2);
        shape(c,[[x-9,y+4],[x-7,y-7],[x-3,y-12],[x+4,y-12],[x+8,y-6],[x+9,y+4]],'#648894',white,2);box(c,x-4,y-7,8,5,'#203847');
        if(rest>0)label(c,result,320,120,result==='SOFT CONTACT'?aqua:amber,15);
        status(c,'DESCENT '+Math.round(vy)+'   DRIFT '+Math.round(Math.abs(vx))+'   LANDINGS '+count);
      }
    };
  });

  register('wall-kick','Wall Kick','Climb the shaft. Cross to the other wall before the spikes reach you.','Space / arrows · tap to switch walls',pink,api=>{
    let side=0,progress=1,traveled=0,spawn=0.1,hearts=3,inv=0,chain=0,lastSide=0;
    const spikes=[];
    function jump(){if(progress>=1){side=1-side;progress=0;api.sound('tap');}}
    return{press(k){if(['left','right','up','action'].includes(k))jump();},tap:jump,
      update(dt){traveled+=dt*97;inv=Math.max(0,inv-dt);progress=Math.min(1,progress+dt*3.9);
        if((spawn-=dt)<=0){lastSide=Math.random()<.7?1-lastSide:lastSide;spikes.push({side:lastSide,y:10,checked:false});spawn=1.05+rand(0,.38);}
        for(let i=spikes.length-1;i>=0;i--){const s=spikes[i];s.y+=dt*119;
          if(!s.checked&&s.y>=239){s.checked=true;
            const x=playerX();if(!inv&&(s.side===0?x<240:x>400)){hearts--;chain=0;inv=.65;api.sound('hit');if(!hearts){api.end('Suit punctured');return;}}
            else{chain++;outcome(api,2);}}
          if(s.y>380)spikes.splice(i,1);}
      },draw(c){backdrop(c,'#1b1732','#2f223d');
        for(const [x,dir] of [[185,-1],[455,1]]){box(c,dir<0?0:x,0,185,H,'#26283b');line(c,x,0,x,H,'#b07799',3);
          for(let i=-1;i<9;i++){const sy=i*49+(api.reduced?0:traveled%49);line(c,x+dir*2,sy,x+dir*172,sy,'#424055',2);
            box(c,x+dir*23-3,sy+9,6,14,'#5f4862');}}
        for(const s of spikes){const wx=s.side?455:185,d=s.side?-1:1;
          for(let i=-1;i<=1;i++) shape(c,[[wx,s.y+i*11-6],[wx+d*(i===0?51:38),s.y+i*11],[wx,s.y+i*11+6]],pink,'#ffd1d6');}
        const x=playerX(),y=243-Math.sin(progress*Math.PI)*37;
        shape(c,[[x-9,y+12],[x-8,y-6],[x+8,y-8],[x+10,y+10]],'#637e97',white,2);
        box(c,x-7,y-16,14,11,'#d1dbea');box(c,x-6,y-13,12,3,'#215463');
        if(inv>0)circle(c,x,y,16,null,aqua);status(c,'SUIT '+hearts+'   CHAIN '+chain);
      }
    };
    function playerX(){const phase=progress*progress*(3-2*progress);return side===1?200+240*phase:440-240*phase;}
  });
})();
