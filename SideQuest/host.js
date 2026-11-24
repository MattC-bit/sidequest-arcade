/* Isolated-world adapter. It observes UI controls and element identity only. */
(() => {
  'use strict';
  if (window !== window.top) return;
  const EMBED = chrome.runtime.getURL('arcade.html');
  const EXT_ORIGIN = new URL(EMBED).protocol + '//' + new URL(EMBED).host;
  const STOP = [
    'button[data-testid="stop-button"]', '[role="button"][data-testid="stop-button"]',
    'button[aria-label="Stop generating" i]', 'button[aria-label="Stop streaming" i]',
    'button[aria-label="Arrêter la génération" i]', 'button[aria-label="Arrêter la diffusion" i]',
    'form button[aria-label="Stop" i]', 'form button[aria-label="Arrêter" i]',
    'form button[aria-label="Interrompre" i]', 'form button[aria-label="Arrêter de générer" i]'
  ].join(',');
  const ASSISTANT = '[data-message-author-role="assistant"],[data-turn="assistant"],[data-talvt-turn-state]';
  const TURN = 'article[data-turn],article[data-testid^="conversation-turn"],section[data-turn],section[data-testid^="conversation-turn"],[data-testid^="conversation-turn-"],[data-talvt-turn-state]';
  const COPY = '[data-testid="copy-turn-action-button"], button[aria-label="Copy response" i], button[aria-label="Copier la réponse" i], .turn-action-controls button[aria-label="Copy" i], .turn-action-controls button[aria-label="Copier" i]';
  const ERROR = '[data-talvt-turn-state="error"],[data-talvt-turn-state="failed"],[data-testid="conversation-turn-error"],[data-testid="conversation-error"],[data-testid="message-error"],[role="alert"] [data-testid="retry-button"]';
  const COMPOSER = '#prompt-textarea, [data-testid="composer-text-input"], [contenteditable="true"][role="textbox"]';
  const GRACE = 5500, SETTLE = 750, UNCONFIRMED = 4200;
  let active = null, quietBaseline = null, cachedBaseline = false, route = location.pathname;
  let previousRouteStop = null, preferenceChanged = false;
  let tick = 0, refresh = 0, snoozed = Infinity, pressedStop = false;
  let host, root, notice, panel, frame, floatBar, previousFocus;
  let launchMode = 'float', randomGame = true, inviteCheckbox;
  const changedLaunchKeys = new Set();
  let mode = 'float', childReady = false, awaitingReply = null, floatBox = null;
  let savedBoxChanged = false;
  let acknowledgementTimer = 0, loadTimer = 0, recovery;
  const visible = el => el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const shown = selector => Array.from(document.querySelectorAll(selector)).find(visible);
  const element = (tag, props = {}) => Object.assign(document.createElement(tag), props);
  function button(label, action, className = '') {
    const b = element('button', {type:'button', textContent:label, className});
    b.addEventListener('click', action);
    return b;
  }

  // ChatGPT variants place response controls next to the authored message.
  function snapshot() {
    const nodes = document.querySelectorAll(ASSISTANT);
    const author = nodes[nodes.length - 1];
    const turn = author?.closest(TURN) || author || null;
    // Keys are transient, in-memory equality checks. Nothing about a conversation is saved.
    const key = turn?.closest('[data-turn-key]')?.getAttribute('data-turn-key') ||
      author?.getAttribute('data-message-id') || turn?.getAttribute('data-turn-id') ||
      turn?.getAttribute('data-testid') || null;
    const state = turn?.getAttribute('data-talvt-turn-state');
    const copy = turn && (!state || state === 'complete') &&
      Array.from(turn.querySelectorAll(COPY)).find(visible);
    return {turn,key,count:nodes.length,state,copy,error:shown(ERROR)};
  }
  function finishedFreshTurn(current, run) {
    if (!current.copy) return false;
    const prior = run.baseline;
    if (!prior.turn) return true;
    if (current.key && prior.key && current.key !== prior.key) return true;
    if (current.count > prior.count) return true;
    // A retry can regenerate in place. Require a seen streaming state for that turn.
    return run.busyTurn && (current.key ? current.key === run.busyKey : current.turn === run.busyTurn);
  }
  function cleanNotice() {
    clearTimeout(acknowledgementTimer);
    if (notice) notice.remove();
    notice = null;
    inviteCheckbox = null;
  }
  function cleanRound() {
    active = null;
    pressedStop = false;
    clearTimeout(tick);
    cleanNotice();
  }
  function ensureRoot() {
    if (host?.isConnected) return;
    host = element('div');
    host.setAttribute('data-sidequest-host','');
    host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483646!important;display:block!important';
    root = host.attachShadow({mode:'open'});
    const style = element('style');
    style.textContent = `
      *{box-sizing:border-box} :host,button,input{font:500 14px/1.4 system-ui,sans-serif;color:#eeeef9}
      button,input{border-radius:7px;border:1px solid #535469;background:#242133;padding:7px 11px}
      button{cursor:pointer}button:hover{background:#38344a}button:focus-visible,input:focus-visible{outline:3px solid #9efbe1;outline-offset:2px}
      .notice{pointer-events:auto;position:absolute;bottom:clamp(18px,13vh,130px);right:18px;width:min(330px,calc(100vw - 32px));padding:16px;border:1px solid #625570;border-radius:15px;background:linear-gradient(120deg,#24203a,#141421);color:#f2effb;box-shadow:0 12px 48px #0007}
      .brand{font:700 10px/1.3 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.19em;color:#abebcf;margin-bottom:5px}.question{font-size:17px;font-weight:680;letter-spacing:-.02em;margin-bottom:12px}.row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.primary{background:#c7fca8;color:#172017;border-color:#c7fca8;font-weight:750}.primary:hover{background:#dbffc4}
      .game-choice{display:flex;align-items:center;gap:7px;margin:0 0 13px;color:#e1dbea;font-size:13px;cursor:pointer}.game-choice input{accent-color:#c7fca8;margin:0}
      .quiet{color:#ccc5db;background:transparent;border-color:transparent}.snooze{display:grid;gap:8px;margin-top:11px;padding-top:10px;border-top:1px solid #444052}.snooze[hidden]{display:none}.snooze label{display:flex;gap:9px;align-items:center}.snooze input{width:74px;min-width:0}
      dialog{pointer-events:auto;position:fixed;inset:0;margin:auto;padding:0;width:100vw;height:100dvh;max-width:none;max-height:none;border:0;background:#0b0a15;color:#efedfa;overflow:hidden}
      dialog[open]{display:flex;flex-direction:column}dialog::backdrop{background:#090713dc}
      dialog.float{border-radius:14px;border:1px solid #81718c;box-shadow:0 16px 60px #0009;inset:auto;min-width:min(300px,95vw);min-height:min(235px,85dvh);max-width:100vw;max-height:100dvh;margin:0;padding-bottom:16px}
      .corner{display:none;position:absolute;bottom:0;width:27px;height:22px;line-height:20px;text-align:center;color:#b5a7ca;touch-action:none;user-select:none}
      .float .corner{display:block}.sw{left:0;cursor:nesw-resize}.se{right:0;cursor:nwse-resize}
      iframe{flex:1;min-height:0;display:block;width:100%;border:0;background:#0b0a15}
      .recovery:not([hidden]){padding:12px;display:flex;align-items:center;flex-wrap:wrap;gap:10px;background:#302638}.recovery[hidden]{display:none}
      .bar{display:none;align-items:center;justify-content:space-between;gap:8px;padding:2px 6px 2px 12px;background:#242034;font:650 11px/1.3 system-ui,sans-serif;letter-spacing:.08em;user-select:none}
      .float .bar{display:flex}.grip{cursor:move;touch-action:none;flex:1;line-height:30px;color:#d8d1ed}.bar button{padding:3px 8px;font-size:12px}
      @media(max-width:480px){.notice{bottom:86px;right:12px}}
    `;
    root.append(style);
    document.documentElement.append(host);
  }

  function invite() {
    if (notice || panel || !active || active.dismissed || Date.now() < snoozed || document.hidden) return;
    ensureRoot();
    notice = element('section',{className:'notice'});
    notice.setAttribute('aria-label','SideQuest invitation');
    const title = element('div',{className:'question',textContent:'Play a game while you wait?'});
    title.setAttribute('role','status');
    const row = element('div',{className:'row'});
    const choices = element('div',{className:'snooze',hidden:true});
    const toggle = button('Snooze',() => {
      choices.hidden = !choices.hidden;
      toggle.setAttribute('aria-expanded',String(!choices.hidden));
      if (!choices.hidden) choices.querySelector('button').focus();
    });
    toggle.setAttribute('aria-expanded','false');
    async function snooze(minutes) {
      const until = Date.now() + minutes*60000;
      try { await chrome.storage.local.set({sqSnoozeUntil:until}); }
      catch { title.textContent='Couldn’t save snooze. Try again.'; return; }
      snoozed = until;
      if (active) active.dismissed = true;
      cleanNotice();
    }
    const presets = element('div',{className:'row'});
    [5,15,30,60].forEach(n => presets.append(button(n+' min',() => snooze(n),n===5?'primary':'')));
    const custom = element('input',{type:'number',min:'1',max:'10080',step:'1',value:'5',required:true});
    const label = element('label',{textContent:'Custom minutes'});
    label.append(custom);
    choices.append(presets,label,button('Snooze for this duration',() => {
      if (custom.reportValidity() && custom.valueAsNumber >= 1) snooze(custom.valueAsNumber);
    }));
    const randomLabel = element('label',{className:'game-choice'});
    const checkbox = element('input',{type:'checkbox',checked:randomGame});
    inviteCheckbox = checkbox;
    randomLabel.append(checkbox, element('span',{textContent:'Play a random game'}));
    checkbox.addEventListener('change', async () => {
      try { await chrome.storage.local.set({sqRandomGame:checkbox.checked}); }
      catch { title.textContent='This choice will apply just this time.'; }
    });
    row.append(button('Play now',() => openArcade(checkbox.checked),'primary'),toggle,button('Dismiss',() => {
      if (active) active.dismissed = true;
      cleanNotice();
    },'quiet'));
    notice.append(element('div',{className:'brand',textContent:'SideQuest'}),title,randomLabel,row,choices);
    root.append(notice);
  }
  function post(type,data={}) {
    if (frame && childReady) frame.contentWindow.postMessage({sq:'sidequest',type,...data},EXT_ORIGIN);
  }
  function closeArcade(restore=true) {
    if (!panel) return;
    clearTimeout(loadTimer);
    panel.close();
    panel.remove();
    panel = frame = floatBar = recovery = null;
    awaitingReply = null;
    childReady = false;
    if (active) active.dismissed = true;
    if (restore) {
      let target = previousFocus?.isConnected && previousFocus !== document.body && !host?.contains(previousFocus) ? previousFocus : document.querySelector(COMPOSER);
      target?.focus({preventScroll:true});
    }
    previousFocus = null;
  }
  function setFloatBounds(saved) {
    const width = Math.min(Math.max(300,saved?.width ?? 480),Math.max(1,innerWidth-12));
    const height = Math.min(Math.max(235,saved?.height ?? 440),Math.max(1,innerHeight-12));
    const left = Math.max(0,Math.min(saved?.left ?? innerWidth-width-16,innerWidth-width));
    const top = Math.max(0,Math.min(saved?.top ?? 16,innerHeight-height));
    Object.assign(panel.style,{width:width+'px',height:height+'px',left:left+'px',top:top+'px'});
    return {width,height,left,top};
  }
  function validBox(value) {
    return value && ['width','height','left','top'].every(k=>Number.isFinite(value[k])) &&
      value.width > 0 && value.height > 0;
  }
  function rememberBox(box) {
    savedBoxChanged = true;
    floatBox = box;
    chrome.storage.local.set({sqFloatBox:box}).catch(()=>{
      if (floatBar) floatBar.title='Window preference could not be saved on this device.';
    });
  }
  function resetWindow() {
    setFloatBounds(null);
    rememberBox(null);
  }
  function setMode(wanted) {
    if (!panel || !['full','float'].includes(wanted)) return;
    if (panel.open && mode === wanted) {post('state',{mode});return;}
    const wasFocused = document.activeElement === host;
    if (panel.open) panel.close();
    mode = wanted;
    panel.className = mode;
    panel.removeAttribute('style');
    if (mode === 'float') {setFloatBounds(floatBox);panel.show();}
    else panel.showModal();
    if (wasFocused || mode === 'full') frame.focus({preventScroll:true});
    post('state',{mode});
  }
  function installPointerControl(handle, edge) {
    let start = null, changed = null;
    handle.addEventListener('pointerdown', e=>{
      if (e.button !== 0 || start) return;
      start = {x:e.clientX,y:e.clientY,box:panel.getBoundingClientRect(),id:e.pointerId};
      changed = null;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', e=>{
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX-start.x, dy = e.clientY-start.y, b = start.box;
      if (!edge) changed=setFloatBounds({...b.toJSON(),left:b.left+dx,top:b.top+dy});
      else {
        const width = Math.max(300,b.width+(edge==='sw' ? -dx : dx));
        changed=setFloatBounds({width,height:b.height+dy,top:b.top,left:edge==='sw' ? b.left+b.width-width : b.left});
      }
    });
    handle.addEventListener('lostpointercapture', ()=>{
      if (changed && panel && mode==='float') rememberBox(changed);
      start = changed = null;
    });
  }
  function installDrag(grip) {
    installPointerControl(grip);
    grip.addEventListener('keydown',e=>{
      const movement = {ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]}[e.key];
      if (!movement) return;
      e.preventDefault();
      const {left,top,width,height} = panel.getBoundingClientRect();
      const [dx,dy] = movement;
      const bounds = e.shiftKey ? {left,top,width:width+dx,height:height+dy} : {width,height,left:left+dx,top:top+dy};
      rememberBox(setFloatBounds(bounds));
    });
  }
  function openArcade(startRandom = false) {
    if (panel) {frame.focus();return;}
    previousFocus = document.activeElement;
    cleanNotice();
    ensureRoot();
    panel = element('dialog');
    panel.setAttribute('aria-label','SideQuest arcade');
    floatBar = element('div',{className:'bar'});
    const grip = element('span',{className:'grip',textContent:'⠿  Move arcade',tabIndex:0});
    grip.title = 'Drag or use arrow keys to move. Shift + arrows to resize.';
    grip.setAttribute('aria-label',grip.title);
    installDrag(grip);
    floatBar.append(grip, button('Reset window',resetWindow), button('Expand',() => setMode('full')), button('Close',() => closeArcade()));
    const source = EMBED + '?embedded=1&layout=' + launchMode + (startRandom ? '&start=random' : '');
    frame = element('iframe',{title:'SideQuest arcade',src:source});
    panel.addEventListener('cancel',e=>{e.preventDefault();closeArcade();});
    recovery = element('div',{className:'recovery',hidden:true});
    const recoveryMessage = element('span',{textContent:'The arcade hasn’t started.'});
    recoveryMessage.setAttribute('role','status');
    recovery.append(recoveryMessage,button('Retry',()=>{
      childReady=false;
      frame.src=source;
      waitForShell();
    }),button('Return to chat',()=>closeArcade()));
    panel.append(floatBar,recovery,frame);
    for (const edge of ['sw','se']) {
      const corner=element('span',{className:'corner '+edge,textContent:edge==='sw'?'◣':'◢',title:'Drag to resize the game window'});
      corner.setAttribute('aria-hidden','true');
      installPointerControl(corner,edge);
      panel.append(corner);
    }
    root.append(panel);
    setMode(launchMode);
    waitForShell();
    frame.focus({preventScroll:true});
  }
  function waitForShell() {
    clearTimeout(loadTimer);
    recovery.hidden=true;
    loadTimer=setTimeout(()=>{if(panel && !childReady) recovery.hidden=false;},3500);
  }
  window.addEventListener('message',event => {
    if (!frame || event.source !== frame.contentWindow || event.origin !== EXT_ORIGIN || event.data?.sq !== 'sidequest') return;
    const {type,mode:desired} = event.data;
    if (type === 'ready') {
      clearTimeout(loadTimer);recovery.hidden=true;
      childReady = true;
      post('state',{mode});
      if (awaitingReply) {post('reply',{reason:awaitingReply});awaitingReply=null;}
    } else if (type === 'close') closeArcade();
    else if (type === 'layout') setMode(desired || (mode === 'full'?'float':'full'));
  });
  window.addEventListener('resize',()=>{if(panel && mode==='float')setFloatBounds(floatBox);});
  chrome.runtime.onMessage.addListener((msg, sender, respond)=>{
    if (sender.id !== chrome.runtime.id) return;
    if (msg?.sqCommand==='open') {openArcade();respond({ok:true});}
    if (msg?.sqCommand==='enabled') {
      ensureRoot();cleanNotice();
      notice = element('div',{className:'notice',textContent:'SideQuest invitations enabled'});
      notice.setAttribute('role','status');root.append(notice);
      if (active) active.dismissed = false;
      acknowledgementTimer = setTimeout(()=>{cleanNotice();scan();},1500);
      respond({ok:true});
    }
  });

  function finish(reason) {
    cleanRound();
    if (!panel) return;
    if (childReady) post('reply',{reason});
    else awaitingReply = reason;
  }
  function conversation(path) {return path.match(/(?:^|\/)c\/([^/]+)(?:\/|$)/)?.[1] || null;}
  function scan() {
    clearTimeout(tick);
    const path = location.pathname;
    const stop = shown(STOP);
    if (path!==route) {
      // An initially untitled chat can acquire its conversation ID on first submit.
      const oldId = conversation(route), newId = conversation(path);
      const sameDraft = oldId && /^local-chatgpt(?:%3a|:)/i.test(oldId) && newId && !/^local-chatgpt(?:%3a|:)/i.test(newId);
      const firstDraft = !oldId && newId && (stop || /^local-chatgpt(?:%3a|:)/i.test(newId));
      const adopt = (firstDraft || sameDraft) && (active || submitMoment > Date.now()-12000) && Date.now() > navigationIntentUntil && !traversing;
      if (!adopt) {
        previousRouteStop = active?.stopElement || null;
        cleanRound();closeArcade(false);cachedBaseline=false;quietBaseline=null;
        submitMoment = 0;
      }
      route=path;
    }
    traversing = false;
    if (previousRouteStop && stop === previousRouteStop) {
      tick=setTimeout(scan,500);
      return;
    }
    previousRouteStop=null;
    if (stop) {
      const now = snapshot();
      if (!active) {
        active = {start:Date.now(),baseline:cachedBaseline ? quietBaseline : now,stopElement:stop,busyTurn:null,busyKey:null,dismissed:false,stoppedAt:0};
        pressedStop = false;
      }
      active.stopElement = stop;
      active.stoppedAt = 0;
      if (now.turn && !now.copy && (now.state && !['complete','error','failed','cancelled','stopped'].includes(now.state) ||
          (now.turn === active.baseline.turn && active.baseline.copy))) {
        active.busyTurn = now.turn;
        active.busyKey = now.key;
      }
      if (Date.now()-active.start >= GRACE) invite();
      const remaining = GRACE - (Date.now()-active.start);
      tick=setTimeout(scan,remaining > 0 ? Math.min(700,remaining) : 700);
      return;
    }
    if (active) {
      if (!active.stoppedAt) active.stoppedAt = Date.now();
      const elapsed = Date.now()-active.stoppedAt;
      const now = snapshot();
      if (elapsed>=SETTLE) {
        if (pressedStop || ['stopped','cancelled'].includes(now.state)) finish('cancelled');
        else if (now.error && now.error!==active.baseline?.error) finish('error');
        else if (finishedFreshTurn(now,active)) finish('complete');
        else if (elapsed >= UNCONFIRMED) finish('uncertain');
      }
      if (active) {tick=setTimeout(scan,elapsed<SETTLE ? Math.max(50,SETTLE-elapsed) : 300);return;}
    }
    quietBaseline=snapshot();
    cachedBaseline=true;
  }
  function schedule() {
    if (!refresh) refresh=setTimeout(()=>{refresh=0;scan();},110);
  }
  let submitMoment = 0, traversing = false, navigationIntentUntil = 0;
  function rememberSubmit() {
    previousRouteStop = null;
    if (active) return;
    quietBaseline=snapshot();cachedBaseline=true;submitMoment=Date.now();schedule();
  }
  document.addEventListener('submit',e=>{
    if(e.target instanceof HTMLFormElement && e.target.querySelector(COMPOSER)) rememberSubmit();
  },true);
  document.addEventListener('click',event=>{
    const el=event.target;
    if (!(el instanceof Element)) return;
    const link = el.closest('a[href]');
    if (link && link.origin === location.origin && link.pathname !== location.pathname && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0)
      navigationIntentUntil = Date.now()+4000;
    if(el.closest(STOP)) {
      if(!active) scan();
      if(active) pressedStop=true;
    }
    if(el.closest('[data-testid="send-button"],[data-testid="regenerate-response-button"],form button[aria-label="Send" i],form button[aria-label="Envoyer" i]')) rememberSubmit();
  },true);
  document.addEventListener('keydown',e=>{
    if (e.key==='Enter' && !e.shiftKey && !e.isComposing && e.target instanceof Element && e.target.closest(COMPOSER)) rememberSubmit();
  },true);
  window.addEventListener('popstate',()=>{traversing=true;schedule();});
  window.navigation?.addEventListener('navigatesuccess',schedule);
  window.addEventListener('pageshow',schedule);
  document.addEventListener('visibilitychange',schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-testid','data-turn','data-message-author-role','data-talvt-turn-state','aria-label','hidden','aria-hidden']});
  chrome.storage.onChanged.addListener((changes,area)=>{
    if (area !== 'local') return;
    for (const key of ['sqLaunchMode','sqRandomGame']) {
      if (changes[key]) {
        changedLaunchKeys.add(key);
        applyLaunchPreference(key, changes[key].newValue);
      }
    }
    if (changes.sqFloatBox) {
      savedBoxChanged = true;
      const value = changes.sqFloatBox.newValue;
      floatBox = validBox(value) ? value : null;
      if (!floatBox && panel && mode==='float') setFloatBounds(null);
    }
    if (changes.sqSnoozeUntil) {
      preferenceChanged=true;
      const wasSnoozed = Date.now() < snoozed;
      snoozed=Number(changes.sqSnoozeUntil.newValue)||0;
      if (active && wasSnoozed && !snoozed) active.dismissed=false;
      if (Date.now()<snoozed) cleanNotice();
      schedule();
    }
  });
  function applyLaunchPreference(key,value) {
    if (key === 'sqLaunchMode') launchMode = value === 'full' ? 'full' : 'float';
    if (key === 'sqRandomGame') {
      randomGame = value !== false;
      if (inviteCheckbox) inviteCheckbox.checked = randomGame;
    }
  }
  chrome.storage.local.get(['sqSnoozeUntil','sqLaunchMode','sqRandomGame','sqFloatBox']).then(value=>{
    if (!savedBoxChanged && validBox(value.sqFloatBox)) {
      floatBox = value.sqFloatBox;
      if (panel && mode==='float') setFloatBounds(floatBox);
    }
    if (!preferenceChanged) snoozed = Number(value.sqSnoozeUntil)||0;
    for (const key of ['sqLaunchMode','sqRandomGame']) {
      if (!changedLaunchKeys.has(key)) applyLaunchPreference(key,value[key]);
    }
    schedule();
  }).catch(()=>{if(!preferenceChanged)snoozed=0;schedule();});
  scan();
})();
