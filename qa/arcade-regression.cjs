/* Offline application regression. Run node qa/arcade-regression.cjs.
   Uses the real shipped HTML/scripts and native Skia rasterizer. The small DOM adapter has no layout, network or browser engine. */
'use strict';
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), assert=require('node:assert/strict'), crypto=require('node:crypto');
const {createCanvas}=require('@napi-rs/canvas');
function resolveArcadeDirectory(input){
 const queue=[path.resolve(input)];
 while(queue.length){
  const current=queue.shift();
  if(fs.existsSync(path.join(current,'arcade.html'))&&fs.existsSync(path.join(current,'engine.js')))return current;
  for(const item of fs.readdirSync(current,{withFileTypes:true})){
   if(item.isDirectory()&&!item.name.startsWith('.')&&item.name!=='node_modules')queue.push(path.join(current,item.name));
  }
 }
 throw new Error('The extracted package must contain arcade.html and engine.js in the same directory.');
}
const inputPath=path.resolve(process.argv[2]||path.resolve(__dirname,'..'));
const suppliedFile=fs.statSync(inputPath).isFile();
const dir=suppliedFile?path.dirname(inputPath):resolveArcadeDirectory(inputPath);
const mainHtml=suppliedFile?inputPath:path.join(dir,'arcade.html');
const markup=fs.readFileSync(mainHtml,'utf8');
const scripts=[];
const shell=markup.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi,(_,attrs,body)=>{
 const source=attrs.match(/src="([^"]+)"/i)?.[1];
 scripts.push({name:source||'inline script '+(scripts.length+1),code:source?fs.readFileSync(path.join(dir,source),'utf8'):body});
 return '';
}).replace(/<style>[\s\S]*?<\/style>/gi,'');
const VOID=new Set('meta link img input br hr source'.split(' '));
const entity=s=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
class Element {
 constructor(tag,doc){this.tag=tag;this.doc=doc;this.nodes=[];this.attrs={};this.style={};this.dataset=new Proxy({}, {set:(data,key,value)=>{
   data[key]=String(value);this.attrs['data-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())]=String(value);return true;
  }});this.handlers={};this.value='';this.checked=false;this.hidden=false;this.open=false;
  this.classList={contains:c=>this.classes().includes(c),add:c=>this.setAttribute('class',[...new Set([...this.classes(),c])].join(' ')),remove:c=>this.setAttribute('class',this.classes().filter(a=>a!==c).join(' ')),toggle:(c,v)=>v?this.classList.add(c):this.classList.remove(c)};
 }
 classes(){return (this.attrs.class||'').split(/\s+/)}
 set className(v){this.setAttribute('class',v)}
 get className(){return this.attrs.class||''}
 setAttribute(k,v){this.attrs[k]=String(v);if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(m,l)=>l.toUpperCase())]=String(v);if(['value','type','width','height','src'].includes(k))this[k]=v;if(k==='checked')this.checked=true;if(k==='hidden')this.hidden=true;}
 getAttribute(k){return this.attrs[k]??null}
 removeAttribute(k){delete this.attrs[k]}
 get isConnected(){return this===this.doc||!!this.parent?.isConnected}
 get textContent(){return this.nodes.map(x=>typeof x==='string'?x:x.textContent).join('')}
 set textContent(v){this.replaceChildren(String(v))}
 append(n){if(n?.tag==='fragment'){for(const item of n.nodes)this.append(item);return}if(typeof n!=='string')n.parent=this;this.nodes.push(n)}
 after(...items){if(!this.parent)return;const siblings=this.parent.nodes;let slot=siblings.indexOf(this)+1;
  for(const item of items){if(typeof item!=='string'){if(item.parent){const old=item.parent.nodes;const index=old.indexOf(item);if(index>=0){old.splice(index,1);if(old===siblings&&index<slot)slot--}}item.parent=this.parent}siblings.splice(slot++,0,item)}
 }
 replaceChildren(...arr){for(const n of this.nodes){if(typeof n!=='string')n.parent=null}this.nodes=[];for(const n of arr)this.append(n)}
 set innerHTML(html){this.replaceChildren();parseHTML(String(html),this)}
 insertAdjacentHTML(_,html){parseHTML(html,this)}
 cloneNode(deep){const n=new Element(this.tag,this.doc);for(const [k,v] of Object.entries(this.attrs))n.setAttribute(k,v);if(deep)for(const c of this.nodes)n.append(typeof c==='string'?c:c.cloneNode(true));return n}
 get content(){const frag=new Element('fragment',this.doc);frag.nodes=this.nodes;return frag}
 descendants(){if(this.tag==='template')return [];return this.nodes.flatMap(x=>typeof x==='string'?[]:[x,...x.descendants()])}
 querySelectorAll(selector){return this.descendants().filter(e=>selector.split(',').some(s=>e.matches(s.trim())))}
 querySelector(s){return this.querySelectorAll(s)[0]||null}
 matches(selector){const parts=selector.trim().split(/\s+/);const last=parts.pop();const simple=(n,s)=>{
   if(s.startsWith('#'))return n.attrs.id===s.slice(1);if(s.startsWith('.'))return n.classes().includes(s.slice(1));
   const a=s.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);if(a)return Object.hasOwn(n.attrs,a[1])&&(a[2]===undefined||n.attrs[a[1]]===a[2]);return n.tag===s;
  };if(!simple(this,last))return false;let cursor=this.parent;while(parts.length){const part=parts.pop();while(cursor&&!simple(cursor,part))cursor=cursor.parent;if(!cursor)return false;cursor=cursor.parent}return true}
 closest(s){let p=this;while(p){if(s.split(',').some(x=>p.matches(x)))return p;p=p.parent}return null}
 addEventListener(type,fn){(this.handlers[type]??=[]).push(fn)}
 fire(type,props={}){const e={type,target:this,detail:1,key:'',preventDefault(){this.defaultPrevented=true},stopPropagation(){this.cancelBubble=true},...props};for(let p=this;p;){for(const fn of p.handlers[type]||[])fn(e);p=e.cancelBubble||p===p.parent?null:p.parent}return e}
 focus(){this.doc.activeElement=this}
 dispatchEvent(e){return !this.fire(e.type,e).defaultPrevented}
 showModal(){this.open=true}
 close(){this.open=false}
 setPointerCapture(){}
 getBoundingClientRect(){const left=parseFloat(this.style.left)||0,top=parseFloat(this.style.top)||0;return {left,top,x:left,y:top,width:parseFloat(this.style.width)||640,height:parseFloat(this.style.height)||360}}
 getContext(){this.canvas??=createCanvas(Number(this.width)||300,Number(this.height)||150);return this.canvas.getContext('2d')}
 toDataURL(...args){this.getContext();return this.canvas.toDataURL(...args)}
}
function parseHTML(str,root){
 const stack=[root];
 for(const token of str.match(/<!--[\s\S]*?-->|<(?:"[^"]*"|'[^']*'|[^'">])+>|[^<]+/g)||[]){
  if(token.startsWith('<!'))continue;
  if(token.startsWith('</')){const tag=token.slice(2,-1).trim().toLowerCase();let i=stack.findLastIndex(n=>n.tag===tag);if(i>0)stack.length=i;continue}
  if(token.startsWith('<')){const tag=token.match(/^<([\w-]+)/)[1].toLowerCase(),el=new Element(tag,root.doc);const attr=token.slice(tag.length+1,-1);
   for(const m of attr.matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))el.setAttribute(m[1],entity(m[2]??m[3]??m[4]??''));
   stack.at(-1).append(el);if(!VOID.has(tag))stack.push(el);
  }else stack.at(-1).append(entity(token));
 }
}
function app(data=new Map(), launch=""){
 const document=new Element('document');document.doc=document;document.createElement=tag=>new Element(tag,document);parseHTML(shell,document);document.body=document.querySelector('body');document.activeElement=document.body;
 let now=0,counter=0;const timers=new Map(),frames=new Map();
 const timeout=(fn,dt,repeat=false)=>{let id=++counter;timers.set(id,{fn,dt,t:now+dt,repeat});return id};
 function el(s){const n=document.querySelector(s);assert(n,'missing '+s);return n}
 const window=new Element('window',document);
 window.scrollTo=()=>{};window.parent=launch?{postMessage(){}}:window;
 const realm=vm.createContext({document,window,parent:window.parent,location:{protocol:launch?'chrome-extension:':'file:',search:launch},URLSearchParams,console,innerWidth:1280,innerHeight:800,Event:class{constructor(type){this.type=type}},
  localStorage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},matchMedia:()=>({matches:false}),performance:{now:()=>now},
  Date:class extends Date{static now(){return now}},
  IntersectionObserver:class{constructor(cb){this.cb=cb}observe(n){this.cb([{isIntersecting:true,target:n}])}unobserve(){}disconnect(){}},
  setTimeout:(cb,ms)=>timeout(cb,ms),clearTimeout:id=>timers.delete(id),setInterval:(cb,ms)=>timeout(cb,ms,true),clearInterval:id=>timers.delete(id),
  requestAnimationFrame:cb=>{let id=++counter;frames.set(id,cb);return id},cancelAnimationFrame:id=>frames.delete(id)});
 vm.runInContext('let seed=7;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296)',realm);
 for(const {name,code} of scripts)vm.runInContext(code,realm,{filename:name});
 function advance(ms,step=1000/30){const end=now+ms;while(now<end){now=Math.min(end,now+step);for(const [id,t] of Array.from(timers.entries()))if(t.t<=now){if(t.repeat)t.t+=t.dt;else timers.delete(id);t.fn()}const tasks=[...frames.values()];frames.clear();for(const fn of tasks)fn(now)}}
 return {document,window,el,sel:s=>document.querySelector(s),all:s=>document.querySelectorAll(s),click:s=>el(s).fire('click'),advance,data,
  key:(key,type='keydown')=>document.activeElement.fire(type,{key,repeat:false}),
  input:(s,v)=>{const n=el(s);if(n.type==='checkbox')n.checked=v;else n.value=v;n.fire('input')},
  raster:()=>crypto.createHash('sha256').update(el('#game').canvas.toBuffer('image/png')).digest('hex'),value:s=>el(s).textContent,
  ev:src=>vm.runInContext(src,realm)};
}
const checks=[];
function test(name,fn){try{fn();checks.push([name,true]);console.log('PASS '+name)}catch(e){checks.push([name,false,e.message]);console.error(name, String(e))}}
function clickAction(a,n){a.click('[data-do="'+n+'"]')}
test('invitation launch boots straight into a focused game, arcade browsing remains available',()=>{
 const a=app(new Map(),'?embedded=1&layout=float&start=random');
 assert.equal(a.document.body.dataset.layout,'float');
 assert.equal(a.document.activeElement,a.el('#game'));
 a.advance(1500);assert.notEqual(a.value('#clock'),'35 s');
 const b=app(new Map(),'?embedded=1&layout=full');
 assert.equal(b.document.body.dataset.layout,'full');assert.equal(b.sel('#game'),null);
 assert.match(b.value('#main'),/Game library/);
 assert.equal(b.all('.game-card').length,50);
 assert(b.el('#featured .feature-name'));
});
test('feature rotation covers 50 games, avoids boundary repeats and launches the advertised game',()=>{
 const storage=new Map(), seen=new Set();
 let last;
 for(let i=0;i<=50;i++){
   const a=app(storage);
   const id=a.el('#featured button').dataset.start;
   assert.notEqual(id,last);
   if(i<50){assert(!seen.has(id));seen.add(id)}
   last=id;
 }
 const a=app(storage,'?embedded=1&layout=float');
 const card=a.el('#featured button'), title=a.value('#featured .feature-name');
 assert(card.textContent.includes(title));assert(a.el('#featured .hero-art').src.startsWith('data:image/'));
 a.input('#search','xyz');assert.equal(a.el('#featured').hidden,true);
 a.input('#search','');assert.equal(a.el('#featured').hidden,false);
 clickAction(a,'home');assert.equal(a.value('#featured .feature-name'),title);
 a.click('#featured button');assert.equal(a.value('.game-heading h1'),title);
});
test('catalog, search, filters, 50 game previews, favorites + reload',()=>{
 const a=app();assert.equal(a.ev('SQ.games.size'),50);a.click('[data-do="library"]');assert.equal(a.all('.game-card').length,50);
 assert(a.all('[data-preview]').every(n=>n.src.startsWith('data:image/webp')));
 a.click('[data-filter="Signal"]');assert.equal(a.all('.game-card').length,13);a.click('[data-filter="All"]');
 a.input('#search','Night Run');assert.equal(a.all('.game-card').length,1);a.click('[data-save="night-run"]');
 a.click('[data-do="saved"]');assert.equal(a.all('.game-card').length,1);
 const b=app(a.data);clickAction(b,'saved');assert.equal(b.all('.game-card').length,1);b.click('[data-save="night-run"]');assert.match(b.value('#main'),/save it here/);
});
test('audio preferences, volumes, reduced motion persist',()=>{
 const a=app();clickAction(a,'settings');a.input('[data-pref="sfx"]',false);a.input('[data-pref="sfxVolume"]',27);a.input('[data-pref="music"]',true);a.input('[data-pref="musicVolume"]',10);a.input('#motion','reduce');clickAction(a,'resume');
 const b=app(a.data);clickAction(b,'settings');assert.equal(b.el('[data-pref="sfx"]').checked,false);assert.equal(b.el('[data-pref="music"]').checked,true);assert.equal(Number(b.el('[data-pref="sfxVolume"]').value),27);assert.equal(Number(b.el('[data-pref="musicVolume"]').value),10);assert.equal(b.el('#motion').value,'reduce');
});
test('score, key and pointer input, float identity, manual pause, reply freeze, exact continuation',()=>{
 const a=app();clickAction(a,'library');a.click('[data-start="night-run"]');const cv=a.el('#game');a.advance(4500);
 assert(Number(a.value('#score'))>0,'expected deterministic score');a.key('ArrowLeft');a.advance(140);a.key('ArrowLeft','keyup');
 cv.fire('pointerdown',{clientX:620,clientY:300});a.advance(90);let pic=a.raster();const score=a.value('#score');
 clickAction(a,'layout');assert.equal(a.document.body.dataset.layout,'float');assert.equal(a.el('#game'),cv);assert.equal(a.raster(),pic);clickAction(a,'layout');assert.equal(a.document.body.dataset.layout,'full');
 a.key('p');assert.equal(a.el('#dialog').open,true);let timer=a.value('#clock');a.advance(2100);assert.equal(a.value('#clock'),timer);assert.equal(a.raster(),pic);
 clickAction(a,'resume');a.advance(320);assert.notEqual(a.raster(),pic);clickAction(a,'simulate');assert.match(a.value('#dialog-body'),/Your reply is ready/);
 pic=a.raster();timer=a.value('#clock');a.key('ArrowRight');a.advance(2400);assert.equal(a.raster(),pic);assert.equal(a.value('#clock'),timer);
 assert.equal(a.el('#dialog').fire('cancel').defaultPrevented,true);assert.equal(a.el('#dialog').open,true);clickAction(a,'resume');assert.equal(a.el('#game'),cv);assert.equal(a.raster(),pic);a.advance(320);assert.notEqual(a.raster(),pic);assert(Number(a.value('#score'))>=Number(score));
});
test('demo invite, snooze, enable, play, auto-reply, Return to same demo, reset',()=>{
 const a=app();clickAction(a,'demo');clickAction(a,'demo-send');a.advance(1200);assert.match(a.value('#main'),/Play a game while you wait/);
 clickAction(a,'demo-snooze');assert.match(a.value('#main'),/snoozed/);clickAction(a,'demo-enable');clickAction(a,'demo-play');a.advance(11200);assert.match(a.value('#dialog-body'),/Your reply is ready/);
 a.click('#dialog [data-do="close"]');assert.match(a.value('#main'),/My picks are/);clickAction(a,'demo-end');assert.match(a.value('#main'),/Collections/);
});
test('all 50 cartridges render and receive keyboard/pointer through production shell',()=>{
 const a=app();const ids=a.ev('Array.from(SQ.games.keys())');
 for(const id of ids){clickAction(a,'library');a.click('[data-start="'+id+'"]');a.advance(125);a.key('ArrowRight');a.advance(55);a.key('ArrowRight','keyup');a.el('#game').fire('pointerdown',{clientX:320,clientY:160});a.key(' ');a.key(' ','keyup');a.advance(75);
  assert(a.raster().length===64);clickAction(a,'library');if(a.el('#dialog').open)a.click('[data-destination="library"]');
 }
});
test('empty search, empty saved, surprise within current filter',()=>{
 const a=app();clickAction(a,'saved');clickAction(a,'random');assert.equal(a.sel('#game'),null);a.click('[data-do="library"]');
 a.input('#search','no-such-cartridge');clickAction(a,'random');assert.equal(a.sel('#game'),null);a.input('#search','');a.click('[data-filter="Flux"]');clickAction(a,'random');
 assert.equal(a.value('.game-heading .group-meta'),'Flux');
});
test('decline exit preserves canvas, confirm exit clears round',()=>{
 const a=app();clickAction(a,'library');a.click('[data-start="night-run"]');a.advance(250);const cv=a.el('#game'),h=a.raster();clickAction(a,'library');a.advance(1500);assert.equal(a.raster(),h);
 clickAction(a,'resume');assert.equal(a.el('#game'),cv);a.advance(250);assert.notEqual(a.raster(),h);clickAction(a,'library');a.click('[data-destination="library"]');assert.equal(a.sel('#game'),null);
});
test('round ends at timer, replay creates a fresh cartridge',()=>{
 const a=app();clickAction(a,'library');a.click('[data-filter="Drift"]');a.all('[data-start]')[0].fire('click');const cv=a.el('#game');a.advance(36000,100);assert.equal(a.el('#mask').hidden,false);
 clickAction(a,'again');assert.notEqual(a.el('#game'),cv);assert.equal(a.value('#score'),'0');assert.equal(a.value('#clock'),'35 s');
});
test('HUD favorite persists across openings in both layouts without restarting the round', () => {
 const storage = new Map();
 for (const layout of ['float', 'full']) {
   const a = app(storage, '?embedded=1&layout=' + layout);
   a.click('[data-start="night-run"]');
   const canvas = a.el('#game');
   const star = a.el('.hud [data-save="night-run"]');
   const wasSaved = layout === 'full';
   assert.equal(star.getAttribute('aria-pressed'), String(wasSaved));
   star.fire('click');
   assert.equal(star.textContent, wasSaved ? '☆' : '★');
   assert.equal(star.getAttribute('aria-pressed'), String(!wasSaved));
   assert.equal(a.el('#game'), canvas);
   const b = app(storage);
   clickAction(b, 'saved');
   assert.equal(b.all('.game-card').length, wasSaved ? 0 : 1);
 }
});
test('dice starts a different game after a loss and a timeout, keeping the current layout', () => {
 for (const [id, duration, ending, layout] of [
   ['roof-runner', 6000, 'Missed the roof', 'float'],
   ['night-switch', 36000, 'Time’s up', 'full']
 ]) {
   const a = app(new Map(), '?embedded=1&layout=' + layout);
   a.click('[data-start="'+id+'"]');
   assert.equal(a.sel('[data-do="next-random"]'), null);
   a.advance(duration, 100);
   assert.equal(a.value('#mask strong'), ending);
   const title = a.value('.game-heading h1');
   clickAction(a, 'again');
   assert.equal(a.value('.game-heading h1'), title);
   a.advance(duration, 100);
   a.click('#mask [data-do="next-random"]');
   assert.notEqual(a.value('.game-heading h1'), title);
   assert.equal(a.value('#clock'), '35 s');
   assert.equal(a.el('#mask').hidden, true);
   assert.equal(a.document.body.dataset.layout, layout);
   assert.equal(a.document.activeElement, a.el('#game'));
 }
});
test('multiple arcade contexts merge favorite and independent audio settings',()=>{
 const a=app(),b=app(a.data);clickAction(a,'library');a.click('[data-save="night-run"]');clickAction(b,'settings');b.input('[data-pref="musicVolume"]',39);
 a.window.fire('storage',{key:'sidequest.arcade.v1'});clickAction(a,'saved');assert.equal(a.all('.game-card').length,1);clickAction(a,'settings');assert.equal(Number(a.el('[data-pref="musicVolume"]').value),39);
});
test('on-demand board readout with button and V, concise keyboard and pointer move announcements',()=>{
 const a=app();clickAction(a,'library');a.click('[data-start="night-switch"]');const region=a.el('#announce');
 assert.equal(region.getAttribute('aria-live'),'polite');assert.equal(region.getAttribute('role'),'status');
 const button=a.el('[data-do="read-board"]');assert.match(button.textContent,/Read board/);button.fire('click');
 const full=region.textContent;assert.match(full,/Three by three grid/);assert.match(full,/Lit windows:/);a.key('v');assert.equal(region.textContent,full);
 a.key('ArrowRight');a.key('ArrowRight','keyup');assert.match(region.textContent,/lit|dark/);assert(region.textContent.length<full.length);
 a.key('V');assert.match(region.textContent,/Three by three grid/);assert.notEqual(region.textContent,full);
 a.el('#game').fire('pointerdown',{clientX:320,clientY:175});assert.match(region.textContent,/lit|dark/);assert(!region.textContent.includes('Three by three'));
});
test('standalone floating grip pointer drag, arrow movement, keyboard resize + round continuity',()=>{
 const a=app();clickAction(a,'library');a.click('[data-start="night-run"]');a.advance(120);const cv=a.el('#game'), hash=a.raster();
 clickAction(a,'layout');const g=a.el('.float-grip'),box=a.el('#desktop');
 g.fire('pointerdown',{button:0,pointerId:1,clientX:12,clientY:8});g.fire('pointermove',{clientX:132,clientY:88});
 assert.equal(box.style.left,'120px');assert.equal(box.style.top,'80px');g.fire('lostpointercapture');g.fire('pointermove',{clientX:200,clientY:200});assert.equal(box.style.left,'120px');
 g.focus();const moved=g.fire('keydown',{key:'ArrowRight'});assert(moved.defaultPrevented&&moved.cancelBubble);assert.equal(box.style.left,'136px');
 g.fire('keydown',{key:'ArrowDown',shiftKey:true});assert.equal(box.style.height,'376px');
 clickAction(a,'layout');assert.equal(a.el('#game'),cv);assert.equal(a.raster(),hash);
});
test('top navigation away from pending demo stays on selected page',()=>{
 const a=app();clickAction(a,'demo');clickAction(a,'demo-send');clickAction(a,'library');assert.equal(a.all('.game-card').length,50);a.advance(1800);assert.equal(a.all('.game-card').length,50,'pending demo pulled user back into mock chat');
});
console.log(checks.filter(([,pass])=>pass).length+'/'+checks.length+' regression groups passed');
process.exitCode=checks.some(([,pass])=>!pass)?1:0;
