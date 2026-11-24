const fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(require('node:path').join(__dirname,'../../SideQuest/host.js'),'utf8').replace('function finish(reason) {','function finish(reason) { observed.push(reason);').replace(/  scan\(\);\s*\}\)\(\);\s*$/, '  window.testScan=scan;window.testSubmit=rememberSubmit;scan();})();');
function fixture(route){
 let time=100000,stop=null;
 class Element{};
 function turn(key){const copy={getClientRects:()=>[{}]};const e=new Element();return Object.assign(e,{hasAttribute:()=>false,dataset:{turnId:key,testid:'conversation-turn-'+key},getAttribute:k=>k==='data-testid'?'conversation-turn-'+key:k==='data-turn-id'?key:null,closest(sel){return sel==='[data-turn-key]'?null:this},querySelectorAll:()=>[copy]});}
 let last=turn('old');const listeners={};
 const page={querySelectorAll:q=>q.includes('button[data-testid="stop-button"')?stop?[stop]:[]:q.startsWith('[data-message-author-role')?[last]:[],addEventListener:(k,f)=>listeners[k]=f};
 const win={addEventListener(){}},env={window:win,Element,document:page,location:{pathname:route,origin:'https://chatgpt.com'},setTimeout:()=>1,clearTimeout(){},MutationObserver:class{observe(){}},Date:{now:()=>time},chrome:{runtime:{getURL:()=> 'chrome-extension://test/arcade.html',onMessage:{addListener(){}}},storage:{onChanged:{addListener(){}},local:{get:()=>Promise.resolve({})}}},URL,observed:[],getComputedStyle:()=>({visibility:'visible'})};
 win.top=win;vm.createContext(env);vm.runInContext(src,env);
 return {env,win,start(){win.testSubmit();stop={getClientRects:()=>[{}]};win.testScan();},end(){stop=null;win.testScan();time+=901;win.testScan();time+=3500;win.testScan();},replace:k=>last=turn(k),clickLink(path){const e=new Element();Object.assign(e,{origin:env.location.origin,pathname:path,closest(sel){return sel==='a[href]'?this:null;}});listeners.click({target:e,button:0});},go(path){env.location.pathname=path;win.testScan();}};
}
const scenarios=[
 ['Old turn remounted','/c/one','uncertain',f=>{f.start();f.replace('old');f.end();}],
 ['New answer','/c/one','complete',f=>{f.start();f.replace('new');f.end();}],
 ['New chat direct normalize','/','complete',f=>{f.start();f.go('/c/new');f.replace('new');f.end();}],
 ['New chat provisional normalize','/','complete',f=>{f.start();f.go('/c/local-chatgpt%3Afoo');f.go('/c/new');f.replace('new');f.end();}],
 ['History link while previous stop visible - destination history already painted','/','',f=>{f.start();f.clickLink('/c/older');f.replace('history');f.go('/c/older');f.end();}],
 ['History link while previous stop visible - deferred destination paint','/','',f=>{f.start();f.clickLink('/c/older');f.go('/c/older');f.replace('history');f.end();}],
];
for (const [name,route,expected,run] of scenarios) {
  const f=fixture(route);
  run(f);
  require('node:assert/strict').deepEqual(f.env.observed, expected ? [expected] : [], name);
  console.log('PASS',name);
}
