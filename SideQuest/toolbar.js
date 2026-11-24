'use strict';
const byId = id => document.getElementById(id);
const duration = byId('duration');
const custom = byId('custom');
const opening = byId('open');
const help = byId('help');
let refreshTimer, preferenceChanged=false;
function show(until=0) {
  clearTimeout(refreshTimer);
  const left = until-Date.now();
  byId('status').textContent = left>0 ? 'Snoozed · '+Math.ceil(left/60000)+' min remaining' : 'On · offered during longer replies';
  byId('enable').hidden = left<=0;
  if (left>0) refreshTimer = setTimeout(()=>show(until),Math.min(left+50,60000));
}
async function change(until) {
  preferenceChanged=true;
  try {await chrome.storage.local.set({sqSnoozeUntil:until});show(until);help.textContent='';}
  catch {help.textContent='Couldn’t save this preference. Try again.';}
}
duration.addEventListener('change',()=>{
  const customMode = duration.value==='custom';
  byId('custom-wrap').hidden=!customMode;
  if(customMode) custom.focus();
});
byId('snooze').addEventListener('click',()=>{
  if(duration.value==='custom' && !custom.reportValidity()) return;
  const minutes = duration.value==='custom' ? custom.valueAsNumber : Number(duration.value);
  if(Number.isInteger(minutes) && minutes>=1 && minutes<=10080) change(Date.now()+minutes*60000);
});
byId('enable').addEventListener('click',()=>change(0));
opening.addEventListener('click',async()=>{
  try {
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    const result = await chrome.tabs.sendMessage(tab.id,{sqCommand:'open'});
    if (result?.ok) {window.close();return;}
  } catch { /* New installs need ChatGPT to reload its content script. */ }
  help.textContent='Open chatgpt.com in this tab, or refresh your existing conversation after installing SideQuest.';
});
byId('reset-window').addEventListener('click',async()=>{
  try {
    await chrome.storage.local.set({sqFloatBox:null});
    help.textContent='Floating window restored to its default size and position.';
  } catch { help.textContent='Couldn’t reset the window. Try again.'; }
});
const launchMode = byId('launch-mode');
const randomGame = byId('random-game');
const changedLaunchKeys = new Set();
function displayChoice(key, value) {
  if (key === 'sqLaunchMode') launchMode.value = value === 'full' ? 'full' : 'float';
  if (key === 'sqRandomGame') randomGame.checked = value !== false;
}
async function saveChoice(key, value) {
  changedLaunchKeys.add(key);
  try { await chrome.storage.local.set({[key]:value}); help.textContent=''; }
  catch { help.textContent='Couldn’t save this preference. Try again.'; }
}
launchMode.addEventListener('change',()=>saveChoice('sqLaunchMode',launchMode.value));
randomGame.addEventListener('change',()=>saveChoice('sqRandomGame',randomGame.checked));
chrome.storage.onChanged.addListener((changes,area)=>{
  if (area !== 'local') return;
  if (changes.sqSnoozeUntil) {preferenceChanged=true;show(changes.sqSnoozeUntil.newValue);}
  for (const key of ['sqLaunchMode','sqRandomGame']) {
    if (changes[key]) {
      changedLaunchKeys.add(key);
      displayChoice(key,changes[key].newValue);
    }
  }
});
chrome.storage.local.get(['sqSnoozeUntil','sqLaunchMode','sqRandomGame']).then(value=>{
  if (!preferenceChanged) show(Number(value.sqSnoozeUntil)||0);
  for (const key of ['sqLaunchMode','sqRandomGame']) {
    if (!changedLaunchKeys.has(key)) displayChoice(key,value[key]);
  }
}).catch(()=>{help.textContent='Invitation preferences are unavailable.';});
