"""Exercise a clean unpacked install with a synthetic ChatGPT tab.

Requires Python Playwright and its Chromium build. Set SIDEQUEST_CHROMIUM to
use another extension-capable Chromium executable. No account is used.
"""
import os
import sys
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

folder = Path(sys.argv[1] if len(sys.argv)>1 else Path(__file__).parents[1]/'SideQuest').resolve()
fixture = """<!doctype html><html><body><main></main><form><textarea id="prompt-textarea"></textarea><button type="button" aria-label="Send">Send</button></form></body></html>"""
with sync_playwright() as pw, tempfile.TemporaryDirectory() as profile:
    opts = {'executable_path': os.environ['SIDEQUEST_CHROMIUM']} if os.environ.get('SIDEQUEST_CHROMIUM') else {'channel':'chromium'}
    browser = pw.chromium.launch_persistent_context(profile, headless=True, ignore_default_args=['--disable-extensions'], args=[
        f'--disable-extensions-except={folder}',f'--load-extension={folder}'], **opts)
    worker = browser.service_workers[0] if browser.service_workers else browser.wait_for_event('serviceworker',timeout=12000)
    assert worker.url.startswith('chrome-extension://') and worker.url.endswith('/worker.js')
    page = browser.new_page()
    url='https://chatgpt.com/c/sidequest-fixture'
    page.route('https://chatgpt.com/**',lambda route:route.fulfill(content_type='text/html',body=fixture))
    page.goto(url)
    page.locator('#prompt-textarea').focus()
    page.evaluate("""() => {
        const b=document.querySelector('form button');
        b.onclick=()=>{b.setAttribute('aria-label','Stop'); b.textContent='Stop';};
        b.click();
        const turn=document.createElement('article');
        turn.dataset.turn='assistant';turn.dataset.testid='conversation-turn-2';
        turn.setAttribute('data-talvt-turn-state','streaming');
        turn.innerHTML='<div data-message-author-role="assistant"></div>';
        document.querySelector('main').append(turn);
    }""")
    invite=page.get_by_role('button',name='Play now')
    expect(invite).to_be_visible(timeout=11000)
    invite.click()
    inner=page.frame_locator('iframe[title="SideQuest arcade"]')
    expect(inner.locator('#game')).to_be_visible()
    expect(inner.locator('#clock')).to_have_text('34 s',timeout=4000)
    assert page.locator('dialog.float').evaluate("dialog => !dialog.matches(':modal')")
    expect(page.get_by_role('button',name='Expand',exact=True)).to_be_visible()
    floating = page.locator('dialog.float')
    grip = floating.locator('.grip')
    grip.focus()
    first = floating.bounding_box()
    grip.press('ArrowLeft')
    grip.press('Shift+ArrowDown')
    moved = floating.bounding_box()
    assert moved['x'] < first['x'] and moved['height'] > first['height']
    page.get_by_role('button',name='Expand',exact=True).click()
    page.evaluate("""() => {
        const turn=document.querySelector('article');
        turn.setAttribute('data-talvt-turn-state','complete');
        turn.insertAdjacentHTML('beforeend','<div class="turn-action-controls"><button aria-label="Copy response" data-testid="copy-turn-action-button">Copy</button></div>');
        document.querySelector('form button').setAttribute('aria-label','Send');
    }""")
    expect(inner.get_by_role('heading',name='Your reply is ready.')).to_be_visible(timeout=6500)
    frozen=inner.locator('#clock').inner_text()
    page.wait_for_timeout(1250)
    assert inner.locator('#clock').inner_text()==frozen
    inner.get_by_role('button',name='Keep playing').click()
    expect(inner.locator('#clock')).not_to_have_text(frozen,timeout=3000)
    inner.get_by_role('button',name='Return to chat',exact=True).click()
    expect(page.locator('iframe[title="SideQuest arcade"]')).to_have_count(0)
    assert page.url==url and page.locator('#prompt-textarea').count()==1
    # Send the same internal open command as the toolbar; click its real reset control.
    popup = browser.new_page()
    popup.goto(worker.url.replace('/worker.js','/toolbar.html'))
    def open_picker():
        # A test popup is a normal tab, so select the fixture as the recipient.
        popup.evaluate("""async () => {
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
                if (tab.id === (await chrome.tabs.getCurrent()).id) continue;
                try { if ((await chrome.tabs.sendMessage(tab.id,{sqCommand:'open'}))?.ok) return; } catch {}
            }
            throw Error('No fixture receiver');
        }""")
    page.reload()
    open_picker()
    expect(floating).to_be_visible()
    expect(floating).to_have_css('height', str(round(moved['height']))+'px')
    expect(floating).to_have_css('left', str(round(moved['x']))+'px')
    popup.locator('#reset-window').click()
    expect(floating).to_have_css('height', str(round(first['height']))+'px')
    expect(floating).to_have_css('left', str(round(first['x']))+'px')
    print('PASS: unpacked extension, invitation, game, float + expand, confirmed reply, frozen clock, resume, same-tab return.')
    browser.close()
