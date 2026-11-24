'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.join(__dirname,'../../SideQuest');
const popup=fs.readFileSync(path.join(base,'toolbar.js'),'utf8');
const worker=fs.readFileSync(path.join(base,'worker.js'),'utf8');
const signal=()=>({fn:null,addListener(fn){this.fn=fn;}});
function fixture(tabSupported=true) {
  const nodes=new Map(), menus=[], prefs={sqSnoozeUntil:0}, messages=[];
  const installed=signal(), menuClick=signal(), changed=signal();
  let closed=false;
  const make=id=>({id,hidden:false,handlers:{},addEventListener(name,fn){this.handlers[name]=fn;},
    focus(){this.focused=true;},reportValidity(){return Number.isInteger(this.valueAsNumber)&&this.valueAsNumber>=1&&this.valueAsNumber<=10080;}});
  const node=id=>{if(!nodes.has(id))nodes.set(id,make(id));return nodes.get(id);};
  const chrome={runtime:{onInstalled:installed},contextMenus:{onClicked:menuClick,removeAll:async()=>{menus.length=0;},create:spec=>menus.push(spec)},storage:{onChanged:changed,local:{
    get:async()=>({...prefs}),set:async delta=>{Object.assign(prefs,delta);changed.fn?.(Object.fromEntries(Object.entries(delta).map(([key,newValue])=>[key,{newValue}])),'local');},
  }},tabs:{query:async()=>[{id:17}],sendMessage:async(id,msg)=>{messages.push([id,msg.sqCommand]);if(!tabSupported)throw Error('No receiver');return {ok:true};}}};
  return {menuClick,installed,menus,messages,prefs,node,closed:()=>closed,
    load:code=>vm.runInNewContext(code,{document:{getElementById:node},window:{close(){closed=true;}},chrome,Date:{now:()=>10000000},setTimeout:()=>1,clearTimeout(){}})};
}
for(const n of [5,15,30,60])test('popup snoozes for '+n+' minutes',async()=>{
  const f=fixture();f.load(popup);f.node('duration').value=String(n);await f.node('snooze').handlers.click();
  assert.equal(f.prefs.sqSnoozeUntil,10000000+n*60000);assert.match(f.node('status').textContent,new RegExp(n+' min remaining'));
});
test('popup custom duration accepts whole minutes and prevents invalid values',async()=>{
  const f=fixture();f.load(popup);f.node('duration').value='custom';f.node('duration').handlers.change();
  assert.equal(f.node('custom-wrap').hidden,false);assert.equal(f.node('custom').focused,true);
  for(const n of [0,-1,10081,1.5,NaN]){f.node('custom').valueAsNumber=n;await f.node('snooze').handlers.click();assert.equal(f.prefs.sqSnoozeUntil,0);}
  f.node('custom').valueAsNumber=47;await f.node('snooze').handlers.click();assert.equal(f.prefs.sqSnoozeUntil,10000000+47*60000);
  await f.node('enable').handlers.click();assert.equal(f.prefs.sqSnoozeUntil,0);
});
test('toolbar manually opens the current tab arcade',async()=>{
  const f=fixture();f.load(popup);await f.node('open').handlers.click();
  assert.equal(f.closed(),true);assert.deepEqual(f.messages,[[17,'open']]);
});
test('toolbar provides reload instructions if chat adapter is unavailable',async()=>{
  const f=fixture(false);f.load(popup);await f.node('open').handlers.click();
  assert.equal(f.closed(),false);assert.match(f.node('help').textContent,/refresh/);
});
test('context menu resumes invitations and handles a tab without the adapter',async()=>{
  const f=fixture(false);f.load(worker);await f.installed.fn();await f.installed.fn();assert.equal(f.menus.length,1);
  assert.deepEqual(Array.from(f.menus[0].contexts),['action']);f.prefs.sqSnoozeUntil=999999;
  await f.menuClick.fn({menuItemId:'resume'},{id:17});assert.equal(f.prefs.sqSnoozeUntil,0);assert.deepEqual(f.messages,[[17,'enabled']]);
});

test('launch preferences default to floating/random and can be changed in the toolbar',async()=>{
  const f=fixture();f.load(popup);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.node('launch-mode').value,'float');assert.equal(f.node('random-game').checked,true);
  f.node('launch-mode').value='full';await f.node('launch-mode').handlers.change();
  f.node('random-game').checked=false;await f.node('random-game').handlers.change();
  assert.equal(f.prefs.sqLaunchMode,'full');assert.equal(f.prefs.sqRandomGame,false);
});

test('toolbar reset clears only floating window geometry',async()=>{
  const f=fixture();f.load(popup);f.prefs.sqLaunchMode='full';f.prefs.sqFloatBox={width:660};
  await f.node('reset-window').handlers.click();
  assert.equal(f.prefs.sqFloatBox,null);assert.equal(f.prefs.sqLaunchMode,'full');
});
