"use strict";
(() => {
  const $=s=>document.querySelector(s);
  const main=$("#main"), modal=$("#dialog"), dialogBody=$("#dialog-body"), notice=$("#announce");
  const embedded=location.protocol==="chrome-extension:" && window.parent!==window && new URLSearchParams(location.search).get("embedded")==="1";
  const hostOrigin="https://chatgpt.com";
  const bridge=(type,data={})=>{if(embedded)parent.postMessage({sq:"sidequest",type,...data},hostOrigin)};
  const groups={Velocity:["#83e8ff","Reflex & speed"],Flux:["#ff9dc9","Fast chaos"],Signal:["#d9ff74","Puzzles & precision"],Drift:["#ffc786","Play at your pace"]};
  const all=()=>Array.from(SQ.games.values());
  const escape=v=>String(v).replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[s]);
  const img=g=>window.SQ_ART?.[g] || "art/"+g.toLowerCase()+".webp";
  const btn=(label,action,primary=false)=>'<button class="btn '+(primary?'primary':'')+'" data-do="'+action+'">'+label+'</button>';
  let page="home",filter="All",query="",returnPage="home",round=null,frame=0,lastTick=0,layout="full",dialogType="",focusBefore=null;
  let simulated=false,demoPhase="",inviteTimer=0,replyTimer=0,answered=false,lastId="",demoSnooze=0;
  const held=new Set();
  const artCache=new Map();
  const pads=["left","up","down","right","action"];
  const keymap={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down",a:"left",d:"right",w:"up",s:"down",q:"left",z:"up"," ":"action",Enter:"action"};
  function say(message){notice.textContent=message}
  function nav(next){
    page=next;
    document.querySelectorAll(".navitem").forEach(b=>{if(b.dataset.do===page)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});
    document.body.classList.toggle("round-active",page==="game");
    $("#close-btn").hidden=!embedded&&!simulated&&page!=="chat";
    $("#layout-btn").hidden=!embedded&&page!=="game";
    if(page!=="game")SQ.music(false);
  }
  function focusMain(){main.focus({preventScroll:true});window.scrollTo(0,0);$("#desktop").scrollTop=0}
  // Pick once per opening. Keep the rotation separate from favorites and settings.
  let featuredGame;
  const featureKey = "sidequest.featured.v1";
  function pickFeature() {
    const games = all();
    let history = [];
    try {
      const saved = JSON.parse(localStorage.getItem(featureKey));
      if (Array.isArray(saved)) history = saved.filter(id => SQ.games.has(id));
    } catch { /* A fresh rotation also works without storage. */ }
    let choices = games.filter(game => !history.includes(game.id));
    // The previous release always featured Night Run. Give upgrades a fresh first pick.
    if (!history.length && choices.length > 1) choices = choices.filter(game => game.id !== "night-run");
    if (!choices.length) {
      choices = games.filter(game => game.id !== history.at(-1));
      if (!choices.length) choices = games;
      history = [];
    }
    const game = choices[Math.floor(Math.random() * choices.length)];
    try { localStorage.setItem(featureKey, JSON.stringify([...history, game.id])); } catch {}
    return game;
  }
  function showFeature() {
    const slot = $("#featured");
    function render() {
      if (!slot.isConnected) return;
      featuredGame ??= pickFeature();
      const game = featuredGame;
      slot.innerHTML = '<img class="hero-art" alt="" src="' + thumbnail(game) + '">' +
        '<div class="hero-copy"><div class="tag"><i></i> Featured cartridge · ' + escape(game.group) +
        '</div><h2 class="feature-name">' + escape(game.title) + '</h2><p>' + escape(game.hint) +
        '</p><button class="btn primary" data-start="' + escape(game.id) + '">▶ Play ' +
        escape(game.title) + '</button></div>';
    }
    if (!featuredGame && window.navigator?.locks) {
      window.navigator.locks.request(featureKey, render).catch(render);
    } else render();
  }
  function toHome(){
    stopRound();nav("home");
    main.innerHTML = '<section id="featured" class="hero" aria-label="Featured cartridge"></section>';
    showFeature();
    const collections=Object.entries(groups).map(([g,[t,desc]])=>'<button class="collection" data-group="'+g+'" style="--tint:'+t+'"><img alt="" src="'+img(g)+'"><div><span class="group-meta">'+all().filter(x=>x.group===g).length+' games</span><strong>'+g+'</strong><small>'+desc+'</small><span class="go" aria-hidden="true">↗</span></div></button>').join("");
    main.insertAdjacentHTML("beforeend",'<div class="sectionhead"><h2>Collections</h2><button class="section-link" data-do="library">All '+all().length+' games →</button></div><div class="collections">'+collections+'</div><section class="console-strip"><span class="console-icon" aria-hidden="true">✣</span><div><b>'+(embedded?'Surprise me':'Try the waiting arcade')+'</b><p>'+(embedded?'Pick a random cartridge and jump straight in.':'Send a demo prompt, play a round, then catch the reply.')+'</p></div>'+btn(embedded?'Pick a game ↗':'Try the demo →',embedded?'random':'demo')+'</section>');
    focusMain();
  }
  function thumbnail(g){
    if(artCache.has(g.id))return artCache.get(g.id);
    const c=document.createElement("canvas");c.width=320;c.height=180;
    const cx=c.getContext("2d");let url=img(g.group);
    try{cx.scale(.5,.5);const game=g.create({score(){},end(){},sound(){},reduced:true});const idle=new Set();for(let i=0;i<42;i++)game.update(1/60,idle);game.draw(cx);url=c.toDataURL("image/webp",.77)}catch{}
    artCache.set(g.id,url);return url;
  }
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){const im=entry.target;im.src=thumbnail(SQ.games.get(im.dataset.preview));observer.unobserve(im)}}},{rootMargin:"170px"});
  function library(next="library",g="All",keep=false){
    stopRound();nav(next);filter=g;if(!keep)query="";
    main.innerHTML='<div class="sectionhead"><h1>'+(next==="saved"?'Saved games':'Game library')+'</h1>'+btn('⤨ Surprise me','random')+'</div><div class="library-tools"><input class="search" id="search" type="search" aria-label="Search games" placeholder="Search cartridges" maxlength="65">'+["All",...Object.keys(groups)].map(n=>'<button class="pill" data-filter="'+n+'" aria-pressed="'+(filter===n)+'">'+n+'</button>').join("")+'</div><div class="grid" id="cards"></div>';
    if (next === "library") {
      main.insertAdjacentHTML("afterbegin",'<section id="featured" class="hero" aria-label="Featured cartridge"></section>');
      showFeature();
    }
    $("#search").value=query;$("#search").addEventListener("input",e=>{query=e.target.value;cards()});cards();focusMain();
  }
  function matched(){const needle=query.trim().toLowerCase();
    return all().filter(g=>(page!=="saved"||SQ.prefs.saved.includes(g.id))&&(filter==="All"||g.group===filter)&&(!needle||(g.title+" "+g.hint+" "+g.group).toLowerCase().includes(needle)));
  }
  function cards(){
    const feature = $("#featured");
    if (feature) feature.hidden = filter !== "All" || !!query.trim();
    observer.disconnect();const list=matched();
    $("#cards").innerHTML=list.map(g=>{const saved=SQ.prefs.saved.includes(g.id);return '<article class="game-card" style="--tint:'+groups[g.group][0]+'"><img class="game-image" src="'+img(g.group)+'" data-preview="'+g.id+'" alt=""><div class="cardcopy"><span class="group-meta">'+g.group+'</span><strong>'+escape(g.title)+'</strong><small>'+escape(g.hint)+'</small></div><div class="card-actions"><button class="playcard" data-start="'+g.id+'" aria-label="Play '+escape(g.title)+'">▶ Play</button><button class="star" data-save="'+g.id+'" aria-label="'+(saved?'Unsave ':'Save ')+escape(g.title)+'" aria-pressed="'+saved+'">'+(saved?'★':'☆')+'</button></div></article>'}).join("")||'<p class="empty">'+(page==="saved"&&!SQ.prefs.saved.length?'Use ☆ on a cartridge to save it here.':'No games match these filters.')+'</p>';
    document.querySelectorAll("[data-preview]").forEach(im=>observer.observe(im));say(list.length+" games");
  }
  function stopRound(){
    cancelAnimationFrame(frame);frame=0;held.clear();round=null;lastTick=0;SQ.music(false);observer.disconnect();
  }
  function updateRoundFavorite(button, saved) {
    button.textContent = saved ? "★" : "☆";
    button.setAttribute("aria-pressed", String(saved));
    button.title = saved ? "Remove from favorites" : "Add to favorites";
  }
  function start(id){
    const g=SQ.games.get(id);if(!g)return;
    if(page!=="game"&&page!=="chat")returnPage=page;
    stopRound();nav("game");lastId=id;
    main.innerHTML='<section class="round-shell"><div class="breadcrumbs"><button class="back" data-do="leave">← Back to arcade</button></div><div class="game-heading"><div><span class="group-meta" style="--tint:'+groups[g.group][0]+'">'+g.group+'</span><h1>'+escape(g.title)+'</h1><p id="goal">'+escape(g.hint)+'</p></div></div><div class="hud"><span>Score <b id="score">0</b></span><span id="clock">35 s</span><div class="round-tools"><button type="button" class="iconbtn round-favorite" data-save="'+id+'" aria-label="Favorite '+escape(g.title)+'"></button><button class="iconbtn" data-do="pause" aria-label="Pause game" title="Pause game (P)">Ⅱ</button></div></div><div class="stage"><canvas id="game" width="640" height="360" tabindex="0" role="img" aria-label="'+escape(g.title)+' playfield" aria-describedby="goal keys"></canvas><div id="mask" hidden></div></div><p class="instructions" id="keys">'+escape(g.controls)+'</p><div class="controls" aria-label="Game controls">'+pads.map((n,i)=>'<button data-key="'+n+'" aria-label="'+n+'">'+['←','↑','↓','→','Action'][i]+'</button>').join("")+'</div>'+(!embedded&&!simulated?'<button class="linkbtn" data-do="simulate">Simulate a reply arriving →</button>':'')+'</section>';
    updateRoundFavorite($(".round-favorite"), SQ.prefs.saved.includes(id));
    const c=$("#game"),ctx=c.getContext("2d");
    round={g,c,ctx,instance:null,points:0,left:35,paused:false,ended:false};
    const r=round;
    r.instance=g.create({score:(v=1)=>{if(round===r&&!r.ended){r.points+=v;$("#score").textContent=r.points}},sound:SQ.sound,get reduced(){return SQ.reduced()},end:message=>{if(round===r)finish(message)}});
    if(typeof r.instance.describe==="function"){
      const read=document.createElement("button");read.className="linkbtn";read.dataset.do="read-board";read.textContent="Read board (V)";
      document.querySelector(".controls").after(read);
    }
    c.addEventListener("pointerdown",e=>{if(r.paused||r.ended||modal.open)return;e.preventDefault();c.focus({preventScroll:true});const b=c.getBoundingClientRect(),s=Math.min(b.width/640,b.height/360);const x=(e.clientX-b.left-(b.width-640*s)/2)/s,y=(e.clientY-b.top-(b.height-360*s)/2)/s;if(x>=0&&x<=640&&y>=0&&y<=360){r.instance.tap?.(x,y);if(r.g.speakMoves&&r.instance.describe)say(r.instance.describe(true))}});
    for(const pad of document.querySelectorAll("[data-key]")){
      pad.addEventListener("pointerdown",e=>{e.preventDefault();pad.setPointerCapture(e.pointerId);press(pad.dataset.key);c.focus({preventScroll:true})});
      for(const name of ["pointerup","pointercancel","lostpointercapture"])pad.addEventListener(name,()=>release(pad.dataset.key));
      pad.addEventListener("click",e=>{if(e.detail===0){press(pad.dataset.key);release(pad.dataset.key)}});
    }
    focusMain();c.focus({preventScroll:true});draw();SQ.unlock();SQ.music(!modal.open);
    if(!modal.open)frame=requestAnimationFrame(tick);
    say(g.title+". "+g.hint+". "+g.controls);
    if(simulated&&demoPhase==="playing"&&!answered&&!replyTimer)replyTimer=setTimeout(()=>{replyTimer=0;answered=true;reply("complete")},11000);
  }
  function draw(){if(!round)return;round.ctx.save();try{round.instance.draw(round.ctx)}finally{round.ctx.restore()}}
  function tick(now){
    if(!round||round.paused||round.ended||modal.open)return;
    const r=round,dt=lastTick?Math.min((now-lastTick)/1000,.12):0;lastTick=now;
    // Small steps keep collision behavior stable on slower devices.
    let rest=dt;while(rest>0&&!r.ended){const d=Math.min(rest,1/60);r.instance.update(d,held);rest-=d}
    if(!r.ended){r.left=Math.max(0,r.left-dt);$("#clock").textContent=Math.ceil(r.left)+" s";if(r.left<=0)finish("Time’s up")}
    draw();if(!r.ended)frame=requestAnimationFrame(tick);
  }
  function press(key){if(!round||round.paused||round.ended||modal.open||held.has(key))return;held.add(key);document.querySelector('[data-key="'+key+'"]')?.classList.add("down");round.instance.press?.(key);if(round.g.speakMoves&&round.instance.describe)say(round.instance.describe(true))}
  function release(key){held.delete(key);document.querySelector('[data-key="'+key+'"]')?.classList.remove("down")}
  function pause(){if(!round)return;round.paused=true;cancelAnimationFrame(frame);pads.forEach(release);lastTick=0;SQ.music(false)}
  function resume(){if(!round||round.ended||modal.open)return;round.paused=false;lastTick=0;cancelAnimationFrame(frame);frame=requestAnimationFrame(tick);SQ.music(true);round.c.focus({preventScroll:true})}
  function finish(message){
    if(!round||round.ended)return;round.ended=true;pause();SQ.sound("good");
    $("#mask").className="stage-mask";$("#mask").hidden=false;$("#mask").innerHTML='<strong>'+escape(message||'Round complete')+'</strong><p>Score '+round.points+'</p><div class="result-actions">'+btn('Play again','again',true)+btn('Pick a game','leave')+
      '<button type="button" class="iconbtn dice" data-do="next-random" aria-label="Play a random game" title="Play a random game"><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><g transform="rotate(-12 12 12)"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8" cy="8" r="1.5"/><circle cx="16" cy="8" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="8" cy="16" r="1.5"/><circle cx="16" cy="16" r="1.5"/></g></svg></button></div>';
    say((message||"Round complete")+". Score "+round.points);$("#mask button").focus({preventScroll:true});
  }
  function sheet(type,html){
    if(!modal.open)focusBefore=document.activeElement;
    pause();dialogType=type;dialogBody.innerHTML=html;
    if(!modal.open)modal.showModal();
    const focus=dialogBody.querySelector('[autofocus],.dialog-actions .primary,button,input');focus?.focus({preventScroll:true});
  }
  function unsheet(continueRound=true){
    if(modal.open)modal.close();
    dialogType="";
    if(continueRound&&round&&!round.ended)resume();
    else if(focusBefore?.isConnected)focusBefore.focus({preventScroll:true});
  }
  function paused(){
    if(!round||round.ended||modal.open)return;
    sheet("pause",'<span class="eyebrow">Cartridge paused</span><h2 id="dialog-title">'+escape(round.g.title)+'</h2><p>Your round is held here.</p><div class="dialog-actions">'+btn("Resume","resume",true)+btn("Game library","exit-library")+'</div>');
  }
  function reply(reason){
    const text={complete:["Your reply is ready.","ChatGPT has finished its response."],cancelled:["Generation stopped.","The response was stopped."],error:["ChatGPT hit a problem.","Check the conversation for details."],uncertain:["Check your chat.","SideQuest lost the generation signal."]};
    const [title,detail]=text[reason]||text.uncertain;if(!embedded)$("#context-answer").textContent="My picks are Night Run, Violet Apex and Afterglow Circuit.";
    sheet("reply",'<span class="eyebrow">'+(embedded?'ChatGPT':'Simulated reply')+'</span><h2 id="dialog-title">'+title+'</h2><p>'+detail+(round&&!round.ended?' Your round is paused.':'')+'</p><div class="dialog-actions">'+btn("Return to chat","close",true)+btn("Keep playing","resume")+'</div>');say(title);
  }
  function settings(){
    const p=SQ.prefs;
    const channel=(key,label)=>'<div class="setting"><label><input type="checkbox" data-pref="'+key+'" '+(p[key]?'checked':'')+'> '+label+'</label><label><span class="sr">'+label+' volume</span><input type="range" min="0" max="100" value="'+Number(p[key+'Volume'])+'" data-pref="'+key+'Volume"></label><output>'+Number(p[key+'Volume'])+'%</output></div>';
    sheet("settings",'<span class="eyebrow">Arcade controls</span><h2 id="dialog-title">Settings</h2>'+channel('sfx','Sound effects')+channel('music','Music')+'<div class="setting"><label for="motion">Visual motion</label><select id="motion" data-pref="motion"><option value="system">System setting</option><option value="reduce">Reduced</option></select></div><div class="dialog-actions">'+btn('Done','resume',true)+'</div>');$("#motion").value=p.motion;
  }
  dialogBody.addEventListener("input",e=>{
    const k=e.target.dataset.pref;if(!k)return; SQ.unlock();
    const value=e.target.type==="checkbox"?e.target.checked:e.target.type==="range"?Number(e.target.value):e.target.value;
    if(e.target.type==="range")e.target.closest(".setting").querySelector("output").value=e.target.value+"%";
    SQ.save(k,value);if(k.toLowerCase().includes("sfx"))SQ.sound("tap");
  });
  function resetDemo(){$("#context-answer").textContent="Generating a demo reply…";clearTimeout(inviteTimer);clearTimeout(replyTimer);inviteTimer=0;replyTimer=0;simulated=false;answered=false;demoPhase="";setLayout("full")}
  function demo(phase="start"){
    stopRound();nav("chat");demoPhase=phase;simulated=true;$("#close-btn").hidden=true;
    const content=phase==="start"?'<p class="sub">Try SideQuest inside a sample conversation.</p>'+btn('Send demo prompt','demo-send',true):
      '<div class="user-bubble">Give me three names for a neon racing game.</div><div class="chat-answer">'+(phase==="returned"&&answered?'My picks are <strong>Night Run</strong>, <strong>Violet Apex</strong> and <strong>Afterglow Circuit</strong>.':'Generating a demo reply…')+'</div>'+
      (phase==="invite"?'<div class="demo-invite"><b>Play a game while you wait?</b>'+btn('Open arcade','demo-play',true)+btn('Snooze 5 min','demo-snooze')+'</div>':phase==="snoozed"?'<p>Invitations snoozed for 5 minutes.</p>'+btn('Enable invitations','demo-enable'):phase==="returned"?btn('Back to arcade','demo-end',true):'');
    main.innerHTML='<section class="chat-wrap"><span class="eyebrow demo-label">Interactive demo · simulated chat</span><h1 class="page-title">Your conversation</h1>'+content+'</section>';focusMain();
  }
  function closeArcade(){
    if(embedded){pause();bridge("close");return}
    if(modal.open)unsheet(false);
    if(simulated){clearTimeout(replyTimer);replyTimer=0;clearTimeout(inviteTimer);setLayout("full");demo("returned");if(!answered){replyTimer=setTimeout(()=>{answered=true;replyTimer=0;if(page==="chat")demo("returned")},1500)}}
    else {if(round)stopRound();resetDemo();toHome()}
  }
  function setLayout(value){if(value!=="float")$("#desktop").removeAttribute("style");layout=value==="float"?"float":"full";document.body.dataset.layout=layout;document.body.classList.toggle("demo-float",!embedded&&layout==="float");$("#layout-btn").title=layout==="float"?"Expand arcade":"Float arcade";$("#layout-btn").setAttribute("aria-label",$("#layout-btn").title)}
  function enterPage(next,g="All"){
    const go=()=>{if(simulated)resetDemo();if(next==="home")toHome();else library(next,g)};
    if(round&&!round.ended){sheet("leave",'<h2 id="dialog-title">Leave this round?</h2><p>Your current score is '+round.points+'.</p><div class="dialog-actions">'+btn('Keep playing','resume',true)+'<button class="btn" data-destination="'+next+'" data-collection="'+g+'">Leave round</button></div>')}
    else go();
  }
  function handle(action){
    switch(action){
      case "home":case "saved":case "library":enterPage(action);break;
      case "random":{const list=(page==="library"||page==="saved")?matched():all();if(list.length)start(list[Math.floor(Math.random()*list.length)].id);else say("No games available in this selection");break}
      case "settings":settings();break;
      case "pause":paused();break;
      case "resume":unsheet();break;
      case "next-random": {
        if (!round?.ended) break;
        const others = all().filter(game => game.id !== round.g.id);
        if (others.length) start(others[Math.floor(Math.random() * others.length)].id);
        break;
      }
      case "again":start(lastId);break;
      case "leave":enterPage(returnPage==="saved"?"saved":"library",returnPage==="home"?"All":filter);break;
      case "exit-library":unsheet(false);if(simulated)resetDemo();library();break;
      case "close":closeArcade();break;
      case "layout":{const mode=layout==="full"?"float":"full";if(embedded)bridge("layout",{mode});else setLayout(mode);break}
      case "read-board":if(round?.instance.describe)say(round.instance.describe());break;
      case "simulate":simulated=true;answered=true;reply("complete");break;
      case "demo":resetDemo();demo();break;
      case "demo-send":demo("waiting");inviteTimer=setTimeout(()=>demo(Date.now()<demoSnooze?"snoozed":"invite"),1100);break;
      case "demo-play":demoPhase="playing";returnPage="home";start("night-run");break;
      case "demo-snooze":demoSnooze=Date.now()+300000;demo("snoozed");break;
      case "demo-enable":demoSnooze=0;demo("invite");break;
      case "demo-end":resetDemo();toHome();break;
    }
  }
  document.addEventListener("click",e=>{
    const b=e.target.closest("button");if(!b||b.disabled)return;
    SQ.unlock();
    if(b.dataset.destination){unsheet(false);if(simulated)resetDemo();if(b.dataset.destination==="home")toHome();else library(b.dataset.destination,b.dataset.collection);return}
    if(b.dataset.start){start(b.dataset.start);return}
    if(b.dataset.group){library("library",b.dataset.group);return}
    if(b.dataset.filter){filter=b.dataset.filter;document.querySelectorAll("[data-filter]").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.filter===filter)));cards();return}
    if (b.dataset.save) {
      const id = b.dataset.save;
      const saved = SQ.toggleSaved(id);
      if (page === "game") {
        updateRoundFavorite(b, saved);
        if (e.detail > 0 && !round.ended) round.c.focus({preventScroll:true});
      } else {
        cards();
        (document.querySelector('[data-save="'+id+'"]') || $("#search")).focus({preventScroll:true});
      }
      say(saved ? "Game added to favorites" : "Game removed from favorites");
      return;
    }
    if(b.dataset.do)handle(b.dataset.do);
  });
  modal.addEventListener("cancel",e=>{e.preventDefault();if(dialogType!=="reply")unsheet()});
  document.addEventListener("keydown",e=>{
    if(e.metaKey||e.ctrlKey||e.altKey||modal.open||!round||round.ended)return;
    if(e.key.toLowerCase()==="v"&&round.instance.describe){e.preventDefault();say(round.instance.describe());return}
    if(e.key==="Escape"||e.key.toLowerCase()==="p"){e.preventDefault();paused();return}
    if(e.target.closest("button,input,select")&&[" ","Enter"].includes(e.key))return;
    const k=keymap[e.key]||keymap[e.key.toLowerCase()];if(k){e.preventDefault();if(!e.repeat)press(k)}
  });
  document.addEventListener("keyup",e=>{const k=keymap[e.key]||keymap[e.key.toLowerCase()];if(k)release(k)});
  window.addEventListener("blur",()=>{pads.forEach(release)});
  document.addEventListener("visibilitychange",()=>{if(document.hidden)paused()});
  window.addEventListener("message",e=>{
    if(!embedded||e.source!==parent||e.origin!==hostOrigin||e.data?.sq!=="sidequest")return;
    if(e.data.type==="reply")reply(e.data.reason);
    if(e.data.type==="state")setLayout(e.data.mode);
  });
  window.addEventListener("sidequestprefs",()=>{
    if(page==="library"||page==="saved")cards();
    if (round) {
      updateRoundFavorite($(".round-favorite"), SQ.prefs.saved.includes(round.g.id));
      SQ.music(!round.paused && !round.ended && !modal.open);
    }
  });
  const grip=document.querySelector(".float-grip"),desktop=$("#desktop");
  let drag=null;
  function moveFloat(x,y){
    const box=desktop.getBoundingClientRect();
    desktop.style.left=Math.max(0,Math.min(innerWidth-box.width,x))+"px";
    desktop.style.top=Math.max(0,Math.min(innerHeight-44,y))+"px";
    desktop.style.right="auto";desktop.style.bottom="auto";
  }
  grip.addEventListener("pointerdown",e=>{if(e.button!==0)return;const b=desktop.getBoundingClientRect();drag=[e.clientX-b.left,e.clientY-b.top];grip.setPointerCapture(e.pointerId)});
  grip.addEventListener("pointermove",e=>{if(drag)moveFloat(e.clientX-drag[0],e.clientY-drag[1])});
  grip.addEventListener("lostpointercapture",()=>{drag=null});
  grip.addEventListener("keydown",e=>{const d={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]}[e.key];if(!d)return;e.preventDefault();e.stopPropagation();const b=desktop.getBoundingClientRect();if(e.shiftKey){desktop.style.width=Math.min(innerWidth,Math.max(310,b.width+d[0]))+"px";desktop.style.height=Math.min(innerHeight,Math.max(270,b.height+d[1]))+"px"}else moveFloat(b.x+d[0],b.y+d[1])});
  const launch = new URLSearchParams(location.search);
  setLayout(embedded ? launch.get("layout") : "full");
  if (embedded && launch.get("start") === "random") handle("random");
  else if (embedded) library();
  else toHome();
  bridge("ready");
})();
