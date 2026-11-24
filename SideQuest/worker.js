'use strict';

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({id: 'resume', title: 'Re-enable arcade invitations', contexts: ['action']});
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'resume') return;
  await chrome.storage.local.set({sqSnoozeUntil: 0});
  if (tab?.id != null) {
    try { await chrome.tabs.sendMessage(tab.id, {sqCommand:'enabled'}); }
    catch { /* The preference also applies to the next ChatGPT tab. */ }
  }
});
