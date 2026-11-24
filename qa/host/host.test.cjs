'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../../SideQuest/host.js'),'utf8');
const HOME='https://chatgpt.com';
const EXT='chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function harness(startPath='/c/first', initialPrefs={}) {
  let time=1e7, next=1, focus, stop, error, turns=[], readPrefs;
  const timers=new Map(), posts=[], prefs={...initialPrefs};
  const listeners=()=>({callbacks:{},addEventListener(name,fn){(this.callbacks[name]??=[]).push(fn);},
    fire(name,event={}){for(const fn of this.callbacks[name]??[]) fn(event);}});
  const event=()=>({fn:null,addListener(fn){this.fn=fn;}});
  const win=Object.assign(listeners(),{navigation:listeners()});win.top=win;
  const doc=Object.assign(listeners(),{hidden:false});
  const loc={origin:HOME,pathname:startPath};
  const storageChange=event(), runtimeMessage=event();
  const timer=(fn,ms)=>{const id=next++;timers.set(id,{fn,due:time+ms});return id;};
  function advance(ms) {
    const limit=time+ms;
    for (;;) {
      const job=[...timers].filter(([,j])=>j.due<=limit).sort((a,b)=>a[1].due-b[1].due)[0];
      if(!job)break;
      const [id,j]=job;timers.delete(id);time=j.due;j.fn();
    }
    time=limit;
  }
  class El{
    constructor(tag='div'){
      Object.assign(this,listeners());this.tag=tag;this.children=[];this.attr={};this.style={};this.className='';
      this.hidden=false;this.isConnected=true;
      if(tag==='iframe')this.contentWindow={postMessage:(p,origin)=>posts.push([p,origin])};
    }
    append(...nodes){for(const n of nodes){this.children.push(n);n.parent=this;}}
    remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
    attachShadow(){this.shadow=new El('shadow');return this.shadow;}
    setAttribute(k,v){this.attr[k]=v;}getAttribute(k){return this.attr[k]??null;}
    removeAttribute(k){delete this.attr[k];}hasAttribute(k){return k in this.attr;}
    getClientRects(){return this.hidden?[]:[{}];}
    getBoundingClientRect(){return {width:parseFloat(this.style.width)||480,height:parseFloat(this.style.height)||440,left:parseFloat(this.style.left)||0,top:parseFloat(this.style.top)||0,toJSON(){return this;}};}
    setPointerCapture(){}
    showModal(){this.open=true;this.modal=true;}show(){this.open=true;this.modal=false;}close(){this.open=false;}
    focus(){focus=this;}contains(n){return n===this || this.children.some(c=>c.contains(n));}
    closest(q){
      if(q==='a[href]') return this.tag==='a'?this:null;
      if(q.includes('stop-button'))return this===stop?this:null;
      if(q.includes('send-button'))return this.tag==='send'?this:null;
      if(q==='[data-turn-key]')return this.tag==='turn'?this:null;
      if(q.includes('article[data-turn]'))return this.tag==='turn'?this:null;
      return null;
    }
    querySelectorAll(q){if(q.includes('copy-turn-action-button'))return this.copy?[this.copy]:[];return [];}
    querySelector(q){return q==='button'?walk(this,n=>n.tag==='button'):null;}
    reportValidity(){return true;}
  }
  function walk(root,cond){if(!root)return null;if(cond(root))return root;for(const child of [...root.children,root.shadow].filter(Boolean)){const found=walk(child,cond);if(found)return found;}return null;}
  doc.documentElement=new El('html');doc.body=new El('body');doc.documentElement.append(doc.body);doc.activeElement=doc.body;
  const composer=new El('composer'), send=new El('send');
  doc.querySelectorAll=q=>q.includes('button[data-testid="stop-button"')?(stop?[stop]:[]):q.startsWith('[data-message-author-role')?turns:q.includes('message-error')?(error?[error]:[]):[];
  doc.querySelector=q=>q.includes('prompt-textarea')?composer:null;
  doc.createElement=tag=>new El(tag);
  let observer;const storage={get:()=>new Promise(resolve=>{readPrefs=()=>resolve(prefs);}),set:async changes=>{Object.assign(prefs,changes);storageChange.fn?.(Object.fromEntries(Object.entries(changes).map(([k,v])=>[k,{newValue:v}])),'local');}};
  const chrome={runtime:{id:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',getURL:p=>EXT+'/'+p,onMessage:runtimeMessage},storage:{local:storage,onChanged:storageChange}};
  const sandbox={document:doc,window:win,location:loc,chrome,URL,Element:El,HTMLFormElement:El,Date:{now:()=>time},
    setTimeout:timer,clearTimeout:id=>timers.delete(id),MutationObserver:class{constructor(fn){observer=fn;}observe(){}},
    getComputedStyle:()=>({visibility:'visible'}),innerWidth:1200,innerHeight:850};
  const notify=()=>{observer();advance(111);};
  function turn(key,state='complete',copyPresent=true){const n=new El('turn');n.attr['data-turn-key']=key;n.attr['data-talvt-turn-state']=state;n.copy=copyPresent?new El('copy'):null;return n;}
  const frame=()=>walk(doc.documentElement,e=>e.tag==='iframe');
  const find=label=>walk(doc.documentElement,e=>e.textContent===label);
  const bridge=(type,extra={},origin=EXT,source=frame()?.contentWindow)=>win.fire('message',{origin,source,data:{sq:'sidequest',type,...extra}});
  const cmd=sqCommand=>runtimeMessage.fn({sqCommand},{id:chrome.runtime.id},()=>{});
  turns=[turn('old')];
  vm.runInNewContext(source,sandbox);
  return {find,posts,prefs,advance,frame,bridge,turn,doc,notify,storage,
    viewport:(width,height)=>{sandbox.innerWidth=width;sandbox.innerHeight=height;win.fire("resize");},
    settlePrefs:async()=>{readPrefs();await new Promise(resolve=>setImmediate(resolve));advance(111);},
    start:()=>{doc.fire('click',{target:send});stop=new El('button');notify();},
    add:(key,state='complete',copy=true)=>{turns.push(turn(key,state,copy));notify();},
    remount:()=>{turns=[turn('old')];notify();},
    mutate:(state,copy)=>{const current=turns.at(-1);current.attr['data-talvt-turn-state']=state;current.copy=copy?new El('copy'):null;notify();},
    stop:()=>{stop=null;notify();},cancel:()=>{doc.fire('click',{target:stop});stop=null;notify();},
    fail:()=>{error=new El('error');stop=null;notify();},
    path:(p,user=false)=>{if(user){const a=new El('a');Object.assign(a,{origin:HOME,pathname:p});doc.fire('click',{target:a,button:0});}loc.pathname=p;notify();},
    open:()=>{cmd('open');bridge('ready');},cmd,
    modal:()=>walk(doc.documentElement,n=>n.tag==='dialog'),getFocus:()=>focus,
    reasons:()=>posts.filter(([p])=>p.type==='reply').map(([p])=>p.reason),
  };
}
test('quick reply stays quiet and invitation never steals focus',async()=>{
  const h=harness();await h.settlePrefs();h.start();h.advance(900);h.add('new');h.stop();h.advance(7000);
  assert.equal(h.find('Play now'),null);assert.equal(h.getFocus(),undefined);
});
test('long reply invites; complete sends once to exact frame origin; close restores composer',async()=>{
  const h=harness();await h.settlePrefs();h.start();h.advance(5600);assert.ok(h.find('Play now'));assert.equal(h.getFocus(),undefined);
  h.find('Play now').fire('click');h.bridge('ready');h.add('new');h.stop();h.advance(6000);
  assert.deepEqual(h.reasons(),['complete']);assert.ok(h.posts.every(([,origin])=>origin===EXT));
  h.bridge('close');assert.equal(h.modal(),null);assert.equal(h.getFocus().tag,'composer');
});
test('same iframe survives switching to floating and back; wrong-origin/sender ignored',()=>{
  const h=harness();h.open();const f=h.frame();assert.equal(h.modal().modal,false);
  h.bridge('close',{},'https://chatgpt.com');h.bridge('close',{},EXT,{});assert.equal(h.frame(),f);
  h.bridge('layout',{mode:'full'});assert.equal(h.modal().modal,true);assert.equal(h.frame(),f);
  h.bridge('layout',{mode:'float'});assert.equal(h.modal().modal,false);assert.equal(h.frame(),f);
});
test('prior answer virtualized and remounted remains unconfirmed',()=>{
  const h=harness();h.open();h.start();h.remount();h.stop();h.advance(4600);assert.deepEqual(h.reasons(),['uncertain']);
});
test('cancelled generation wins over a simultaneously mounted Copy button',()=>{
  const h=harness();h.open();h.start();h.add('new');h.cancel();h.advance(900);assert.deepEqual(h.reasons(),['cancelled']);
});
test('new structural error takes priority over a usable action row',()=>{
  const h=harness();h.open();h.start();h.add('new');h.fail();h.advance(900);assert.deepEqual(h.reasons(),['error']);
});
test('retry of existing logical turn needs its own streaming marker',()=>{
  const h=harness();h.open();h.start();h.mutate('streaming',false);h.mutate('complete',true);h.stop();h.advance(900);assert.deepEqual(h.reasons(),['complete']);
});
test('draft to provisional to canonical conversation preserves open game',()=>{
  const h=harness('/');h.start();h.open();const f=h.frame();h.path('/c/local-chatgpt%3Aabc');h.path('/c/uuid');assert.equal(h.frame(),f);
  h.add('new');h.stop();h.advance(900);assert.deepEqual(h.reasons(),['complete']);
});
test('navigation to history closes overlay even while stop remains',()=>{
  const h=harness('/');h.start();h.open();h.path('/c/older',true);assert.equal(h.modal(),null);h.add('history');h.stop();h.advance(6000);assert.deepEqual(h.reasons(),[]);
});
test('unknown transition to different conversation ends overlay',()=>{
  const h=harness();h.open();h.start();h.path('/c/unrelated');assert.equal(h.modal(),null);
});
test('slow child receives queued completion after its ready handshake',()=>{
  const h=harness();h.start();h.cmd('open');h.add('new');h.stop();h.advance(900);assert.deepEqual(h.reasons(),[]);
  h.bridge('ready');assert.deepEqual(h.reasons(),['complete']);h.bridge('ready');assert.deepEqual(h.reasons(),['complete']);
});
test('unresponsive frame retains retry and return actions',()=>{
  const h=harness();h.cmd('open');h.advance(3800);const retry=h.find('Retry');assert.equal(retry.parent.hidden,false);retry.fire('click');assert.equal(retry.parent.hidden,true);
  h.advance(3800);h.find('Return to chat').fire('click');assert.equal(h.modal(),null);
});
test('snooze preset persists; another tab can re-enable from storage',async()=>{
  const h=harness();await h.settlePrefs();h.start();h.advance(5600);h.find('Snooze').fire('click');await h.find('5 min').callbacks.click[0]();
  assert.ok(h.prefs.sqSnoozeUntil>=1e7+300000);assert.equal(h.find('Play now'),null);
  const other=harness('/c/second',{...h.prefs});await other.settlePrefs();other.start();other.advance(6500);assert.equal(other.find('Play now'),null);
  await other.storage.set({sqSnoozeUntil:0});other.advance(1000);assert.ok(other.find('Play now'));
});
test('dismiss only suppresses this generation',async()=>{
  const h=harness();await h.settlePrefs();h.start();h.advance(5600);h.find('Dismiss').fire('click');h.advance(4000);assert.equal(h.find('Play now'),null);
  h.add('new');h.stop();h.advance(1000);h.start();h.advance(5700);assert.ok(h.find('Play now'));
});

test('one click starts random in a non-modal window and retries the same launch',async()=>{
  const h=harness();await h.settlePrefs();h.start();h.advance(5600);
  h.find('Play now').fire('click');
  assert.equal(h.modal().modal,false);
  const source=h.frame().src;
  assert.equal(new URL(source).searchParams.get('start'),'random');
  h.advance(3800);h.find('Retry').fire('click');assert.equal(h.frame().src,source);
});
test('unchecked invitation choice persists, full screen applies on the next launch',async()=>{
  const h=harness();await h.settlePrefs();h.start();h.advance(5600);
  const box=h.find('Play a random game').parent.children[0];
  assert.equal(box.checked,true);
  box.checked=false;await box.callbacks.change[0]();
  await h.storage.set({sqLaunchMode:'full'});
  const other=harness('/c/other',h.prefs);await other.settlePrefs();other.start();other.advance(5600);
  assert.equal(other.find('Play a random game').parent.children[0].checked,false);
  other.find('Play now').fire('click');assert.equal(other.modal().modal,true);
  assert.equal(new URL(other.frame().src).searchParams.has('start'),false);
  other.bridge('layout',{mode:'float'});other.bridge('close');other.open();
  assert.equal(other.modal().modal,true);
});

test('floating position and size survive close, full screen, new tab and reset',async()=>{
  const h=harness();await h.settlePrefs();h.open();
  const grip=h.find('⠿  Move arcade'), left=h.find('◣');
  function drag(handle,x,y,dx,dy) {
    handle.fire('pointerdown',{button:0,pointerId:2,clientX:x,clientY:y});
    handle.fire('pointermove',{pointerId:2,clientX:x+dx,clientY:y+dy});
    handle.fire('lostpointercapture');
  }
  drag(grip,0,0,-95,45);drag(left,0,0,-105,100);
  const saved=JSON.parse(JSON.stringify(h.prefs.sqFloatBox));
  assert.deepEqual(saved,{width:585,height:540,left:504,top:61});
  h.bridge('layout',{mode:'full'});h.bridge('layout',{mode:'float'});
  assert.equal(h.modal().style.left,'504px');
  h.bridge('close');h.open();assert.equal(h.modal().style.height,'540px');
  const next=harness('/c/other',h.prefs);await next.settlePrefs();next.open();
  assert.equal(next.modal().style.width,'585px');
  next.viewport(380,340);assert.equal(next.modal().style.width,'368px');assert.equal(next.modal().style.left,'12px');
  next.viewport(1200,850);assert.equal(next.modal().style.width,'585px');
  next.find('Reset window').fire('click');assert.equal(next.prefs.sqFloatBox,null);
  assert.equal(next.modal().style.width,'480px');assert.equal(next.modal().style.left,'704px');
});
test('keyboard resizing saves, bad geometry falls back, and toolbar reset reaches the active tab',async()=>{
  const h=harness('/c/x',{sqFloatBox:{left:'100',top:0,width:320,height:200}});
  await h.settlePrefs();h.open();assert.equal(h.modal().style.width,'480px');
  h.find('⠿  Move arcade').fire('keydown',{key:'ArrowRight',shiftKey:true,preventDefault(){}});
  assert.equal(h.prefs.sqFloatBox.width,496);
  await h.storage.set({sqFloatBox:null});assert.equal(h.modal().style.width,'480px');
});
