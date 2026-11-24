"use strict";
const SQ = (() => {
  const games = new Map();
  const register = game => {
    if (!game.id || games.has(game.id)) throw new Error("Duplicate or missing cartridge id: " + game.id);
    games.set(game.id, Object.freeze(game));
  };
  const defaults = {sfx:true, music:false, sfxVolume:55, musicVolume:20, motion:"system", saved:[]};
  let preferences;
  try { preferences = JSON.parse(localStorage.getItem("sidequest.arcade.v1") || "{}") || {}; } catch { preferences = {}; }
  const prefs = {...defaults, ...preferences};
  if (!Array.isArray(prefs.saved)) prefs.saved=[];
  const storageKey="sidequest.arcade.v1";
  function currentPrefs(){
    try {return {...defaults,...JSON.parse(localStorage.getItem(storageKey)||"{}")}} catch {return {...prefs}}
  }
  function save(key,value){
    const latest=currentPrefs();
    latest[key]=value; Object.assign(prefs,latest);
    try {localStorage.setItem(storageKey,JSON.stringify(latest))}catch{}
  }
  function toggleSaved(id){
    const values=currentPrefs().saved;
    const latest=Array.isArray(values)?values:[];
    const saved=!latest.includes(id);
    save("saved",saved?[...latest,id]:latest.filter(n=>n!==id)); return saved;
  }
  window.addEventListener("storage",e=>{
    if(e.key!==storageKey)return;
    Object.assign(prefs,currentPrefs());
    window.dispatchEvent(new Event("sidequestprefs"));
  });
  let audio, bus, beat=0, musicTimer=0;
  function unlock() {
    if(!window.AudioContext) return;
    try {
      if(!audio){
        audio=new AudioContext();
        bus=audio.createGain(); bus.gain.value=.72; bus.connect(audio.destination);
      }
      if(audio.state==="suspended") audio.resume().catch(()=>{});
    } catch {}
  }
  function tone(start,end,duration,shape,level,delay=0){
    if(!audio || audio.state!=="running" || level<=0) return;
    const at=audio.currentTime+delay, osc=audio.createOscillator(), gain=audio.createGain();
    osc.type=shape;osc.frequency.setValueAtTime(start,at);osc.frequency.exponentialRampToValueAtTime(end,at+duration);
    gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,level),at+.009);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    osc.connect(gain); gain.connect(bus); osc.start(at);osc.stop(at+duration+.01);
    osc.onended=()=>{osc.disconnect();gain.disconnect()};
  }
  let lastEffect=-100;
  function sound(kind){
    if(!prefs.sfx || performance.now()-lastEffect<28)return;
    lastEffect=performance.now();
    const gain=prefs.sfxVolume/100*.14;
    if(kind==="hit")tone(145,43,.16,"sawtooth",gain*.65);
    else if(kind==="good"){tone(460,720,.09,"sine",gain);tone(740,920,.14,"triangle",gain,.07)}
    else tone(320,430,.065,"triangle",gain);
  }
  function music(active){
    clearInterval(musicTimer);
    if(!active || !prefs.music || !audio) return;
    const notes=[130.81,196,261.63,311.13,116.54,174.61,233.08,261.63,103.83,155.56,207.65,233.08,116.54,174.61,207.65,261.63];
    musicTimer=setInterval(()=>{
      const n=notes[beat%notes.length],level=prefs.musicVolume/100*.11;
      tone(n,n,.26,"triangle",level*.78);
      if(beat%4===0)tone(n/2,n/2,.52,"sine",level);
      beat++;
    },235);
  }
  const reduced=()=>prefs.motion==="reduce" || (prefs.motion==="system" && matchMedia("(prefers-reduced-motion:reduce)").matches);
  return {register,games,prefs,save,toggleSaved,unlock,sound,music,reduced};
})();
