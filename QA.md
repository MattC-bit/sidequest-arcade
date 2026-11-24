# Testing SideQuest

## Version 1.2.0

The automated release checks exercise the shipped scripts in a simulated ChatGPT page and render all 50 games with a native canvas. They cover short replies, invitations, layout choices, window movement, resizing, persistence across fresh tabs, reset, restoring focus, navigation, pause and resume, 51 picker openings, the keyboard puzzle readouts, in-game favorites in both layouts, and the result controls after a loss or timeout.

Results on this candidate: **28 host and toolbar tests, 16 arcade regression groups, six navigation scenarios, and 120 keyboard puzzle solves passed.** The install and source ZIPs contain identical extension files. Both can be reproduced byte-for-byte with the packaging script. The HTML guide’s internal links and bundled image resolved.

These checks do not establish compatibility with every ChatGPT layout. Installed end-to-end verification of this version in Chrome and other desktop browsers that can load unpacked Chrome extensions is pending. Previous versions observed Send, Stop and completion controls in live Chat and Work. Long-running Work tasks and approval waits can expose different controls.

## Run the checks

With Node 22 or later installed, run these commands from the repository root. Host tests and board readouts use Node alone. The arcade tests and artwork generator use the development dependency listed in package.json.

```sh
node --test qa/host/host.test.cjs qa/host/toolbar.test.cjs
node qa/host/history-regression.cjs
node qa/signal-readouts.cjs
npm install
node qa/arcade-regression.cjs ./SideQuest
```

With Python Playwright and an extension-capable Chromium installed, run `python qa/browser-install.py SideQuest`. Set `SIDEQUEST_CHROMIUM` to the browser executable path if needed. The fixture uses a temporary profile and a local fictional conversation.

## Fresh-browser acceptance

Use the player ZIP, a clean desktop browser profile and a fictional chat. Record browser version, OS, mode and result.

1. Follow START-HERE.html. Confirm the toolbar can open the picker with no build step.
2. In an active chat, verify short replies stay quiet, then trigger a longer reply. Play a random game from the invitation, move it, and resize it with each lower corner. Check that the chat remains usable.
3. Let the reply finish. Check the round pauses, resumes with Keep playing, and closes with Return to chat. Repeat in Work. Verify a cancellation is identified separately.
4. Close and reopen. Refresh the tab and try another chat. Confirm size and placement survive each step. Shrink the browser and return to its original size. Verify the game remains reachable.
5. Try keyboard movement and Shift + arrows. Test Reset window while playing and Reset floating window from the toolbar with the arcade closed. Check that favorites and play preferences survive.
6. Clear Play a random game, snooze and re-enable invitations, and test full-screen launch. Update an existing installation in place. Verify preferences survive and removing the extension removes the overlay after refreshing.
