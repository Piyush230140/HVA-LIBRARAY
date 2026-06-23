
// ==UserScript==
// @name Amazon Business Prime - HVA Library + Query Counter (FIXED v5.5.2)
// @namespace http://tampermonkey.net/
// @version 5.5.2
// @description Combined script: (1) searchable HVA Library modal for the Custom HVA field with dropdown value capture, (2) floating query counter with drag-to-move. Counts ONLY after "Feedback submitted successfully" popup. Active only when URL contains showDevConsole=true.
// @author Internal Eval Tools / arvindon / piyush
// @match https://pre-prod.amazon.com/*
// @match https://de-pre-prod.amazon.com/*
// @match https://it-pre-prod.amazon.com/*
// @match https://fr-pre-prod.amazon.com/*
// @match https://es-pre-prod.amazon.com/*
// @match https://ca-pre-prod.amazon.com/*
// @match https://mx-pre-prod.amazon.com/*
// @match https://uk-pre-prod.amazon.com/*
// @match https://in-pre-prod.amazon.com/*
// @grant GM_setValue
// @grant GM_getValue
// @run-at document-idle
// ==/UserScript==

(function () {
'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY: Safe GM storage wrapper with localStorage fallback
// ═══════════════════════════════════════════════════════════════════════════════

function safeGMGet(key, defaultVal) {
    try {
        return GM_getValue(key, defaultVal);
    } catch (e) {
        console.warn('[GM] getValue failed, using localStorage fallback:', e);
        try {
            const val = localStorage.getItem('gm_' + key);
            return val !== null ? JSON.parse(val) : defaultVal;
        } catch { return defaultVal; }
    }
}

function safeGMSet(key, value) {
    try {
        GM_setValue(key, value);
    } catch (e) {
        console.warn('[GM] setValue failed, using localStorage fallback:', e);
        try { localStorage.setItem('gm_' + key, JSON.stringify(value)); } catch {}
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// URL ACTIVATION CHECK
// ═══════════════════════════════════════════════════════════════════════════════

let cachedActivationState = null;
let cachedActivationHref = null;

function isToolActivated() {
    // Cache result based on href to avoid creating URLSearchParams every 10s
    if (cachedActivationHref === window.location.href) {
        return cachedActivationState;
    }
    cachedActivationHref = window.location.href;
    const params = new URLSearchParams(window.location.search);
    cachedActivationState = params.get('showDevConsole') === 'true';
    return cachedActivationState;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HVA LIBRARY MODULE
// ═══════════════════════════════════════════════════════════════════════════════

const HVALibraryModule = (function () {
    let initialized = false;

    // Pre-sorted list (no runtime sort needed)
    const HVA_LIST = [
        'AB App Center', 'AB Cart', 'AB Registration', 'AB Search',
        'Amazon Business Payments', 'Approvals', 'Budget Management',
        'Business Giving', 'Business Pricing', 'Business Settings',
        'Enhanced Account Security', 'Groups', 'Savings Agent', 'Services',
        'Socially Responsible Purchasing', 'Spend Anomaly Monitoring',
        'UNSPSC', 'Your Orders',
    ];

    const CUSTOM_HVA_STORAGE_KEY = 'hva_custom_library';

    function getCustomHVAs() {
        try {
            return JSON.parse(localStorage.getItem(CUSTOM_HVA_STORAGE_KEY)) || [];
        } catch {
            return [];
        }
    }

    function saveCustomHVA(hva) {
        const items = getCustomHVAs();
        const allExisting = [...HVA_LIST, ...items];
        if (!allExisting.includes(hva)) {
            items.push(hva);
            localStorage.setItem(CUSTOM_HVA_STORAGE_KEY, JSON.stringify(items));
        }
    }

    function deleteCustomHVA(hva) {
        const items = getCustomHVAs().filter(x => x !== hva);
        localStorage.setItem(CUSTOM_HVA_STORAGE_KEY, JSON.stringify(items));
    }

    const CSS = `
#hva-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.55); z-index: 99999996; display: flex; align-items: center; justify-content: center; font-family: "Amazon Ember", "Helvetica Neue", Helvetica, Arial, sans-serif; animation: hva-fade-in 0.15s ease; }
@keyframes hva-fade-in { from { opacity: 0; } to { opacity: 1; } }
#hva-modal { background: #ffffff; border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.30), 0 2px 8px rgba(0,0,0,0.18); width: 480px; max-width: 95vw; max-height: 82vh; display: flex; flex-direction: column; overflow: hidden; animation: hva-slide-up 0.18s ease; }
@keyframes hva-slide-up { from { transform: translateY(18px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
#hva-header { background: #131921; padding: 14px 18px 12px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
#hva-header h2 { margin: 0; color: #ffffff; font-size: 16px; font-weight: 700; letter-spacing: 0.3px; }
#hva-header h2 span { color: #FF9900; }
#hva-close-btn { background: none; border: none; color: #aaa; cursor: pointer; padding: 2px 6px; font-size: 20px; line-height: 1; border-radius: 4px; transition: color 0.15s, background 0.15s; }
#hva-close-btn:hover { color: #ffffff; background: rgba(255,255,255,0.1); }
#hva-search-wrap { padding: 12px 14px 8px; background: #f8f8f8; border-bottom: 1px solid #e3e6e6; flex-shrink: 0; }
#hva-search { width: 100%; box-sizing: border-box; padding: 8px 12px 8px 36px; border: 1px solid #a0a0a0; border-radius: 4px; font-size: 14px; color: #0F1111; outline: none; background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E") no-repeat 10px center; transition: border-color 0.15s, box-shadow 0.15s; }
#hva-search:focus { border-color: #FF9900; box-shadow: 0 0 0 3px rgba(255,153,0,0.25); }
#hva-list-wrap { overflow-y: auto; flex: 1 1 auto; padding: 6px 0; }
#hva-list-wrap::-webkit-scrollbar { width: 6px; }
#hva-list-wrap::-webkit-scrollbar-thumb { background: #c9c9c9; border-radius: 3px; }
.hva-item { display: flex; align-items: center; gap: 10px; padding: 12px 16px; margin: 6px 12px; background: #ffffff; border: 1px solid #D5D9D9; border-left: 4px solid #FF9900; border-radius: 8px; cursor: pointer; font-size: 14px; color: #0F1111; transition: all 0.15s ease; }
.hva-item:hover, .hva-item.hva-focused { background: #FF9900; border-color: #FF9900; color: #111111; box-shadow: 0 2px 8px rgba(255,153,0,0.35); }
.hva-item .hva-icon { font-size: 16px; flex-shrink: 0; opacity: 0.7; }
.hva-item .hva-icon.hva-icon-dot { font-size: 22px; line-height: 1; width: 16px; display: inline-flex; align-items: center; justify-content: center; opacity: 0.5; }
.hva-item-label { flex: 1; }
.hva-item-label mark { background: #fff0b3; color: #0F1111; border-radius: 2px; padding: 0 1px; }
.hva-custom-entry { border-top: 1px dashed #e3e6e6; margin-top: 4px; padding-top: 4px; color: #007185 !important; font-weight: 600; }
.hva-custom-entry:hover, .hva-custom-entry.hva-focused { background: #eaf6f6 !important; border-left-color: #007185 !important; color: #005B6B !important; }
.hva-delete { opacity: 0; cursor: pointer; color: #DC2626; padding: 4px; border-radius: 4px; transition: all 0.15s ease; margin-left: auto; }
.hva-delete:hover { background: #FEE2E2; }
.hva-item:hover .hva-delete, .hva-item.hva-focused .hva-delete { opacity: 1; }
#hva-empty { padding: 32px 18px; text-align: center; color: #888; font-size: 14px; display: none; }
#hva-empty svg { display: block; margin: 0 auto 10px; opacity: 0.35; }
#hva-toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%) translateY(12px); background: #232F3E; color: #fff; padding: 10px 20px; border-radius: 6px; font-size: 13px; font-family: "Amazon Ember", "Helvetica Neue", Helvetica, Arial, sans-serif; box-shadow: 0 4px 16px rgba(0,0,0,0.28); z-index: 99999998; opacity: 0; pointer-events: none; transition: opacity 0.2s ease, transform 0.2s ease; white-space: nowrap; max-width: 90vw; }
#hva-toast.hva-toast-show { opacity: 1; transform: translateX(-50%) translateY(0); }
#hva-status { position: fixed; bottom: 20px; left: 20px; z-index: 99999998; background: #22C55E; color: #111111; padding: 8px 12px; border-radius: 50%; font-size: 18px; font-weight: 700; font-family: "Amazon Ember", sans-serif; border: 2px solid #111111; box-shadow: 0 4px 12px rgba(0,0,0,0.25); width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
#custom-hva-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 99999997; display: flex; align-items: center; justify-content: center; }
#custom-hva-modal { width: 500px; max-width: 90vw; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,.3); }
#custom-hva-header { background: #131921; color: white; padding: 16px; font-size: 18px; font-weight: 700; }
#custom-hva-body { padding: 20px; }
#custom-hva-text { width: 100%; box-sizing: border-box; padding: 12px; border: 1px solid #ccc; border-radius: 6px; font-size: 14px; }
#custom-hva-text:focus { outline: none; border-color: #FF9900; box-shadow: 0 0 0 3px rgba(255,153,0,0.25); }
#custom-hva-actions { display: flex; gap: 10px; margin-top: 16px; }
.custom-btn { flex: 1; padding: 10px; border: none; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 14px; transition: filter 0.15s; }
.custom-btn:hover { filter: brightness(0.95); }
.fill-btn { background: #f3f4f6; border: 1px solid #D5D9D9; }
.save-btn { background: #FF9900; color: black; }
.back-btn { width: 100%; margin-top: 14px; padding: 12px; background: #F3F4F6; color: #111111; border: 1px solid #D5D9D9; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 14px; transition: all 0.15s ease; }
.back-btn:hover { background: #E5E7EB; border-color: #BFC5C5; }
.cancel-btn { width: 100%; margin-top: 10px; padding: 12px; background: #131921; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 14px; transition: all 0.15s ease; }
.cancel-btn:hover { background: #232F3E; }
#hva-duplicate-warning { font-size: 12px; color: #c0392b; margin-top: 6px; display: none; }
`;

    let overlayEl = null;
    let searchEl = null;
    let listWrapEl = null;
    let toastEl = null;
    let toastTimer = null;
    let focusedIndex = -1;
    let visibleItems = [];

    function injectStyles() {
        if (document.getElementById('hva-styles')) return;
        const style = document.createElement('style');
        style.id = 'hva-styles';
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    // ✅ FIX v5.5.2: Uses XPath for efficient text-based element lookup
    // instead of iterating all label/div/span/p elements.
    function findCustomHVAInput() {

        // ═══ STRATEGY 1: XPath to find "Custom HVA" label text efficiently ═══
        try {
            const xpath = "//label[normalize-space(.)='Custom HVA:' or normalize-space(.)='Custom HVA']" +
                          " | //span[normalize-space(.)='Custom HVA:' or normalize-space(.)='Custom HVA']" +
                          " | //div[normalize-space(.)='Custom HVA:' or normalize-space(.)='Custom HVA']";
            const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

            for (let i = 0; i < result.snapshotLength; i++) {
                const label = result.snapshotItem(i);
                // Ensure it's a tight label (not a large container)
                if ((label.textContent || '').trim().length > 20) continue;

                // Check inside the label
                const inside = label.querySelector('textarea');
                if (inside && isVisible(inside)) {
                    console.log('[HVA] ✓ Found via XPath label (inside)');
                    return inside;
                }
                // Check parent container
                const parent = label.parentElement;
                if (parent) {
                    const inParent = parent.querySelector('textarea');
                    if (inParent && isVisible(inParent)) {
                        console.log('[HVA] ✓ Found via XPath label parent');
                        return inParent;
                    }
                    const grandParent = parent.parentElement;
                    if (grandParent) {
                        const inGrandParent = grandParent.querySelector('textarea');
                        if (inGrandParent && isVisible(inGrandParent)) {
                            console.log('[HVA] ✓ Found via XPath label grandparent');
                            return inGrandParent;
                        }
                    }
                }
                // Check next siblings
                let sibling = label.nextElementSibling;
                for (let j = 0; j < 5 && sibling; j++) {
                    if (sibling.matches && sibling.matches('textarea') && isVisible(sibling)) {
                        console.log('[HVA] ✓ Found via XPath label sibling');
                        return sibling;
                    }
                    const inSibling = sibling.querySelector && sibling.querySelector('textarea');
                    if (inSibling && isVisible(inSibling)) {
                        console.log('[HVA] ✓ Found via XPath label sibling container');
                        return inSibling;
                    }
                    sibling = sibling.nextElementSibling;
                }
            }
        } catch (xpathErr) {
            console.warn('[HVA] XPath strategy failed:', xpathErr);
        }

        // ═══ STRATEGY 2: Find container with BOTH "Select an HVA" and "Custom HVA" ═══
        const sectionSelectors = 'fieldset, [class*="field"], [class*="form"], [class*="panel"], [class*="section"], [class*="hva" i]';
        const sections = document.querySelectorAll(sectionSelectors);
        for (const container of sections) {
            const text = container.textContent || '';
            if (
                text.includes('Select an HVA') &&
                text.includes('Custom HVA')
            ) {
                const textarea = container.querySelector('textarea');
                if (textarea && isVisible(textarea) && !isOurElement(textarea)) {
                    console.log('[HVA] ✓ Found via HVA section container');
                    return textarea;
                }
            }
        }

        // ═══ STRATEGY 3: Find textarea inside feedback-tab (left panel) ═══
        const feedbackSection = document.querySelector(
            '.feedback-tab, [class*="feedback-tab"], [class*="feedback_tab"], [class*="Feedback"], #feedback-tab, .tab-content'
        );
        if (feedbackSection) {
            const textareas = feedbackSection.querySelectorAll('textarea');
            for (const ta of textareas) {
                if (isVisible(ta) && !isOurElement(ta) && !isBotQueryArea(ta)) {
                    console.log('[HVA] ✓ Found via feedback section');
                    return ta;
                }
            }
        }

        // ═══ STRATEGY 4: textarea with data-rac, EXCLUDING bot/chat panel ═══
        const allRacTextareas = Array.from(
            document.querySelectorAll('textarea[data-rac]')
        ).filter(t => isVisible(t) && !isOurElement(t) && !isBotQueryArea(t) && !isSearchElement(t));

        if (allRacTextareas.length > 0) {
            const leftSide = allRacTextareas.filter(t => {
                const rect = t.getBoundingClientRect();
                return (rect.left + rect.width / 2) < window.innerWidth / 2;
            });
            if (leftSide.length > 0) {
                console.log('[HVA] ✓ Found via data-rac on left side');
                return leftSide[leftSide.length - 1];
            }
            console.log('[HVA] ✓ Found via data-rac first match');
            return allRacTextareas[0];
        }

        // ═══ STRATEGY 5: Any visible textarea on LEFT side of screen ═══
        const allTextareas = Array.from(document.querySelectorAll('textarea')).filter(t =>
            isVisible(t) && !isOurElement(t) && !isSearchElement(t) && !isBotQueryArea(t)
        );

        if (allTextareas.length > 0) {
            const leftSide = allTextareas.filter(t => {
                const rect = t.getBoundingClientRect();
                return (rect.left + rect.width / 2) < window.innerWidth / 2;
            });
            if (leftSide.length > 0) {
                console.log('[HVA] ✓ Found via left-side position');
                return leftSide[leftSide.length - 1];
            }
            console.log('[HVA] ✓ Found via first non-bot textarea');
            return allTextareas[0];
        }

        console.warn('[HVA] ✗ Could not find Custom HVA textarea');
        return null;
    }

    // ✅ FIX v5.5.2: Improved bot area detection — requires chat ancestor before position heuristic
    function isBotQueryArea(el) {
        if (!el) return false;

        // Check if inside a chat/bot/copilot panel
        const chatPanel = el.closest(
            '[class*="chat" i], [class*="Chat"], [class*="bot" i], [class*="Bot"], ' +
            '[class*="copilot" i], [class*="Copilot"], [class*="assistant" i], [class*="Assistant"], ' +
            '[class*="conversation" i], [class*="Conversation"], [class*="messenger" i], ' +
            '[role="complementary"], [class*="right-panel" i], [class*="rightPanel" i], ' +
            '[class*="side-panel" i], [class*="sidePanel" i]'
        );
        if (chatPanel) return true;

        // Position heuristic: only apply if placeholder/aria-label suggests it's a chat input
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const viewportWidth = window.innerWidth;

        if (centerX > viewportWidth * 0.6) {
            const placeholder = (el.placeholder || '').toLowerCase();
            const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
            if (
                placeholder.includes('ask') || placeholder.includes('type') ||
                placeholder.includes('message') || placeholder.includes('query') ||
                ariaLabel.includes('ask') || ariaLabel.includes('message') ||
                ariaLabel.includes('chat') || ariaLabel.includes('query')
            ) {
                return true;
            }
            // ✅ FIX v5.5.2: Only classify small textareas as bot input if they ALSO
            // have a chat-like parent (not just position + rows alone)
            if (el.rows <= 2) {
                const nearChatUI = el.closest('[class*="input-area" i], [class*="compose" i], [class*="send" i], footer');
                if (nearChatUI) return true;
            }
        }

        return false;
    }

    function isOurElement(el) {
        return !!(
            el.closest('#hva-overlay') ||
            el.closest('#custom-hva-overlay') ||
            el.id === 'hva-search' ||
            el.id === 'custom-hva-text'
        );
    }

    function isSearchElement(el) {
        const id = (el.id || '').toLowerCase();
        const name = (el.name || '').toLowerCase();
        const placeholder = (el.placeholder || '').toLowerCase();
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
        const role = (el.getAttribute('role') || '').toLowerCase();

        if (
            id.includes('search') || name.includes('search') ||
            placeholder.includes('search') || ariaLabel.includes('search') ||
            role === 'searchbox'
        ) return true;

        const parent = el.closest('[role="search"], [class*="search" i], nav, header');
        if (parent) return true;

        return false;
    }

    function isVisible(el) {
        if (!el) return false;
        const s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    // ✅ FIX v5.5.2: fillCustomHVA now uses a callback for success notification
    // instead of returning true prematurely during retries.
    function fillCustomHVA(value, onSuccess, retryCount = 0) {
        const input = findCustomHVAInput();
        if (!input) {
            if (retryCount < 5) {
                const delay = (retryCount + 1) * 300;
                console.log(`[HVA] Textarea not found, retry ${retryCount + 1}/5 in ${delay}ms`);
                setTimeout(() => fillCustomHVA(value, onSuccess, retryCount + 1), delay);
                return; // ✅ No premature return true
            }
            console.error('[HVA] Failed to find textarea after 5 retries');
            createToast('⚠ Could not find Custom HVA field');
            return;
        }

        console.log('[HVA] Filling element:', input.tagName, 'class:', input.className.substring(0, 50), 'position:', input.getBoundingClientRect().left.toFixed(0) + 'px from left');

        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input.focus();

        // React-compatible value setter
        const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
        if (descriptor && descriptor.set) {
            descriptor.set.call(input, value);
        } else {
            input.value = value;
        }

        const tracker = input._valueTracker;
        if (tracker) tracker.setValue('');

        // ✅ FIX v5.5.2: Use InputEvent for better React 18 compatibility
        input.dispatchEvent(new Event('focus', { bubbles: true }));
        input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));

        console.log('[HVA] ✓ Filled Custom HVA textarea:', value);

        // ✅ FIX v5.5.2: Invoke callback only on actual success
        if (typeof onSuccess === 'function') {
            onSuccess(value);
        }
    }

    function ensureToast() {
        if (document.getElementById('hva-toast')) {
            toastEl = document.getElementById('hva-toast');
            return;
        }
        toastEl = document.createElement('div');
        toastEl.id = 'hva-toast';
        document.body.appendChild(toastEl);
    }

    function createToast(msg) {
        ensureToast();
        toastEl.textContent = msg.startsWith('⚠') ? msg : `✔ ${msg}`;
        toastEl.classList.add('hva-toast-show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('hva-toast-show'), 2800);
    }

    function buildHighlight(text, query) {
        if (!query) return document.createTextNode(text);
        const idx = text.toLowerCase().indexOf(query.toLowerCase());
        if (idx === -1) return document.createTextNode(text);
        const span = document.createElement('span');
        span.appendChild(document.createTextNode(text.slice(0, idx)));
        const mark = document.createElement('mark');
        mark.textContent = text.slice(idx, idx + query.length);
        span.appendChild(mark);
        span.appendChild(document.createTextNode(text.slice(idx + query.length)));
        return span;
    }

    function renderList(query) {
        if (!listWrapEl) return;
        // ✅ FIX v5.5.2: Use replaceChildren() to properly detach event listeners
        listWrapEl.replaceChildren();
        const q = (query || '').trim().toLowerCase();
        const customHVAs = getCustomHVAs();
        const ALL_HVAS = [...HVA_LIST, ...customHVAs.filter(c => !HVA_LIST.includes(c))];
        const filtered = ALL_HVAS.filter(h => !q || h.toLowerCase().includes(q));
        const emptyEl = document.getElementById('hva-empty');
        if (filtered.length === 0 && q) {
            if (emptyEl) emptyEl.style.display = 'block';
        } else {
            if (emptyEl) emptyEl.style.display = 'none';
            filtered.forEach(hva => {
                const item = document.createElement('div');
                item.className = 'hva-item';
                item.dataset.hva = hva;
                const icon = document.createElement('span');
                icon.className = 'hva-icon hva-icon-dot';
                icon.textContent = '•';
                const label = document.createElement('span');
                label.className = 'hva-item-label';
                label.appendChild(buildHighlight(hva, query));
                item.appendChild(icon);
                item.appendChild(label);
                const isCustom = customHVAs.includes(hva);
                if (isCustom) {
                    const deleteBtn = document.createElement('span');
                    deleteBtn.className = 'hva-delete';
                    deleteBtn.title = 'Delete this custom HVA';
                    deleteBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6L18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>`;
                    deleteBtn.addEventListener('click', e => {
                        e.stopPropagation();
                        if (!confirm(`Delete "${hva}"?`)) return;
                        deleteCustomHVA(hva);
                        renderList(searchEl ? searchEl.value : '');
                        createToast(`Deleted: ${hva}`);
                    });
                    item.appendChild(deleteBtn);
                }
                item.addEventListener('click', () => selectHVA(hva));
                listWrapEl.appendChild(item);
            });
        }
        const customItem = document.createElement('div');
        customItem.className = 'hva-item hva-custom-entry';
        customItem.dataset.hva = '__custom__';
        const customIcon = document.createElement('span');
        customIcon.className = 'hva-icon';
        customIcon.textContent = '➕';
        const customLabel = document.createElement('span');
        customLabel.className = 'hva-item-label';
        customLabel.textContent = 'Add New Custom HVA';
        customItem.appendChild(customIcon);
        customItem.appendChild(customLabel);
        customItem.addEventListener('click', openCustomForm);
        listWrapEl.appendChild(customItem);
        visibleItems = Array.from(listWrapEl.querySelectorAll('.hva-item'));
        focusedIndex = -1;
    }

    function selectHVA(hva) {
        hideHVAPopup();
        // ✅ FIX v5.5.2: Toast only fires on actual fill success via callback
        setTimeout(() => {
            fillCustomHVA(hva, (filledValue) => {
                createToast(`HVA set: ${filledValue}`);
            });
        }, 200);
    }

    function openCustomForm() {
        hideHVAPopup();
        setTimeout(() => { showCustomHVAPopup(); }, 150);
    }

    // ✅ FIX v5.5.2: Build custom HVA popup with DOM methods, not innerHTML with user data
    function showCustomHVAPopup(prefilledValue = '') {
        if (document.getElementById('custom-hva-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'custom-hva-overlay';

        const modal = document.createElement('div');
        modal.id = 'custom-hva-modal';

        const header = document.createElement('div');
        header.id = 'custom-hva-header';
        header.textContent = 'Custom HVA';

        const body = document.createElement('div');
        body.id = 'custom-hva-body';

        const labelEl = document.createElement('label');
        labelEl.style.cssText = 'display:block;margin-bottom:8px;font-weight:600;';
        labelEl.textContent = 'Type Your Custom HVA';

        const input = document.createElement('input');
        input.id = 'custom-hva-text';
        input.type = 'text';
        input.placeholder = 'Enter HVA…';
        input.autocomplete = 'off';
        input.value = prefilledValue; // ✅ Safe: .value assignment, no innerHTML

        const warning = document.createElement('div');
        warning.id = 'hva-duplicate-warning';
        warning.textContent = '⚠ This HVA already exists in the library.';

        const actions = document.createElement('div');
        actions.id = 'custom-hva-actions';

        const fillBtn = document.createElement('button');
        fillBtn.className = 'custom-btn fill-btn';
        fillBtn.textContent = 'Fill Now';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'custom-btn save-btn';
        saveBtn.textContent = 'Save & Fill';

        actions.appendChild(fillBtn);
        actions.appendChild(saveBtn);

        const backBtn = document.createElement('button');
        backBtn.className = 'back-btn';
        backBtn.textContent = '← Back to Library';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cancel-btn';
        cancelBtn.textContent = '✕ Cancel';

        body.appendChild(labelEl);
        body.appendChild(input);
        body.appendChild(warning);
        body.appendChild(actions);
        body.appendChild(backBtn);
        body.appendChild(cancelBtn);

        modal.appendChild(header);
        modal.appendChild(body);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        setTimeout(() => { input.focus(); if (prefilledValue) input.select(); }, 100);

        input.addEventListener('input', () => {
            const val = input.value.trim();
            const allHVAs = [...HVA_LIST, ...getCustomHVAs()];
            warning.style.display = val && allHVAs.some(h => h.toLowerCase() === val.toLowerCase()) ? 'block' : 'none';
        });
        input.addEventListener('keydown', e => { if (e.key === 'Enter') fillBtn.click(); });

        fillBtn.addEventListener('click', () => {
            const value = input.value.trim();
            if (!value) { input.focus(); return; }
            overlay.remove();
            setTimeout(() => {
                fillCustomHVA(value, (v) => createToast(`Filled: ${v}`));
            }, 200);
        });

        saveBtn.addEventListener('click', () => {
            const value = input.value.trim();
            if (!value) { input.focus(); return; }
            saveCustomHVA(value);
            overlay.remove();
            setTimeout(() => {
                fillCustomHVA(value, (v) => createToast(`Saved & filled: ${v}`));
            }, 200);
        });

        backBtn.addEventListener('click', () => {
            overlay.remove();
            setTimeout(() => { showHVAPopup(); }, 150);
        });

        cancelBtn.addEventListener('click', () => { overlay.remove(); });
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    }

    function showHVAPopup() {
        injectStyles();
        if (overlayEl && document.body.contains(overlayEl)) return;
        overlayEl = document.createElement('div');
        overlayEl.id = 'hva-overlay';
        overlayEl.addEventListener('mousedown', e => { if (e.target === overlayEl) hideHVAPopup(); });
        const modal = document.createElement('div');
        modal.id = 'hva-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'HVA Library');
        const header = document.createElement('div');
        header.id = 'hva-header';
        header.innerHTML = `<h2><span>HVA</span> Library</h2>`;
        const closeBtn = document.createElement('button');
        closeBtn.id = 'hva-close-btn';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', hideHVAPopup);
        header.appendChild(closeBtn);
        const searchWrap = document.createElement('div');
        searchWrap.id = 'hva-search-wrap';
        searchEl = document.createElement('input');
        searchEl.id = 'hva-search';
        searchEl.type = 'text';
        searchEl.placeholder = 'Search HVAs…';
        searchEl.setAttribute('autocomplete', 'off');
        searchEl.setAttribute('spellcheck', 'false');
        searchEl.addEventListener('input', () => renderList(searchEl.value));
        searchEl.addEventListener('keydown', handleKeydown);
        searchWrap.appendChild(searchEl);
        listWrapEl = document.createElement('div');
        listWrapEl.id = 'hva-list-wrap';
        const emptyEl = document.createElement('div');
        emptyEl.id = 'hva-empty';
        emptyEl.innerHTML = `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>No HVAs matched your search.`;
        modal.appendChild(header);
        modal.appendChild(searchWrap);
        modal.appendChild(emptyEl);
        modal.appendChild(listWrapEl);
        overlayEl.appendChild(modal);
        document.body.appendChild(overlayEl);
        document.addEventListener('keydown', handleGlobalKeydown);
        renderList('');
        requestAnimationFrame(() => { if (searchEl) searchEl.focus(); });
    }

    function hideHVAPopup() {
        if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
        overlayEl = null;
        searchEl = null;
        listWrapEl = null;
        focusedIndex = -1;
        visibleItems = [];
        document.removeEventListener('keydown', handleGlobalKeydown);
    }

    function setFocus(idx) {
        visibleItems = listWrapEl ? Array.from(listWrapEl.querySelectorAll('.hva-item')) : [];
        visibleItems.forEach((el, i) => el.classList.toggle('hva-focused', i === idx));
        if (visibleItems[idx]) visibleItems[idx].scrollIntoView({ block: 'nearest' });
        focusedIndex = idx;
    }

    function handleKeydown(e) {
        visibleItems = listWrapEl ? Array.from(listWrapEl.querySelectorAll('.hva-item')) : [];
        const len = visibleItems.length;
        if (!len) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setFocus((focusedIndex + 1) % len); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setFocus((focusedIndex - 1 + len) % len); }
        else if (e.key === 'Enter' && focusedIndex >= 0) { e.preventDefault(); visibleItems[focusedIndex].click(); }
    }

    function handleGlobalKeydown(e) { if (e.key === 'Escape') hideHVAPopup(); }

    function handleCustomOptionClick(e) {
        let option = e.target.closest('[data-key="Custom"], [data-value="Custom"]');
        if (!option) {
            const clickedEl = e.target.closest('[role="option"], [role="menuitem"], li, [class*="option"], [class*="Option"]');
            if (clickedEl) {
                const text = (clickedEl.textContent || '').trim();
                if (text.toLowerCase() === 'custom' || text.toLowerCase() === 'custom hva') option = clickedEl;
            }
        }
        if (!option) {
            const el = e.target.closest('button, a, [role="button"]');
            if (el) {
                const text = (el.textContent || '').trim();
                if (text.toLowerCase() === 'custom' || text.toLowerCase() === 'custom hva') option = el;
            }
        }
        if (!option) return;
        console.log('[HVA] Custom option selected. Opening HVA Library first.');
        setTimeout(() => { showHVAPopup(); }, 200);
    }

    function handleSelectChange(e) {
        if (e.target.tagName === 'SELECT') {
            const selectedValue = (e.target.value || '').toLowerCase();
            const selectedText = e.target.options[e.target.selectedIndex]
                ? e.target.options[e.target.selectedIndex].text.toLowerCase() : '';
            if (selectedValue.includes('custom') || selectedText.includes('custom')) {
                console.log('[HVA] Custom selected from dropdown. Opening HVA Library first.');
                setTimeout(() => { showHVAPopup(); }, 200);
            }
        }
    }

    function createStatusIndicator() {
        if (document.getElementById('hva-status')) return;
        const badge = document.createElement('div');
        badge.id = 'hva-status';
        badge.textContent = '✓';
        badge.title = 'HVA Library Active — Click to open';
        badge.addEventListener('click', showHVAPopup);
        document.body.appendChild(badge);
    }

    function init() {
        if (initialized) return;
        initialized = true;
        injectStyles();
        ensureToast();
        createStatusIndicator();
        document.addEventListener('click', handleCustomOptionClick, true);
        document.addEventListener('change', handleSelectChange, true);
        console.info('[HVA Library] v5.5.2 module initialized');
    }

    function destroy() {
        if (!initialized) return;
        initialized = false;
        hideHVAPopup();
        const existingCustomOverlay = document.getElementById('custom-hva-overlay');
        if (existingCustomOverlay) existingCustomOverlay.remove();
        const badge = document.getElementById('hva-status');
        if (badge) badge.remove();
        const toast = document.getElementById('hva-toast');
        if (toast) toast.remove();
        document.removeEventListener('click', handleCustomOptionClick, true);
        document.removeEventListener('change', handleSelectChange, true);
        console.info('[HVA Library] module destroyed');
    }

    window.__HVALibrary = {
        showHVAPopup, hideHVAPopup, findCustomHVAInput,
        fillCustomHVA, createToast, getCustomHVAs, saveCustomHVA, deleteCustomHVA,
    };

    return { init, destroy };
})();

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY COUNTER MODULE — v5.5.2 with all fixes applied
// ═══════════════════════════════════════════════════════════════════════════════

const QueryCounterModule = (function () {
    let initialized = false;
    let queryCount = 0;
    let counterEl = null;
    let styleEl = null;
    let observer = null;
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;
    let isDestroyed = false;
    let successObserver = null;
    let isWaitingForSuccess = false;
    let lastCountTimestamp = 0;
    let observationGeneration = 0; // ✅ FIX: cancellation token for observer

    const COOLDOWN_MS = 5000;
    const attachedButtons = new WeakSet();

    // ✅ FIX v5.5.2: Targeted snapshot instead of querySelectorAll('*')
    function waitForFeedbackSuccessPopup(timeout = 10000) {
        const currentGen = ++observationGeneration;

        return new Promise((resolve) => {
            if (isDestroyed) return resolve(false);

            let resolved = false;

            const targetPhrases = [
                'feedback submitted successfully',
                'feedback submitted',
                'successfully submitted',
                'submission successful',
                'successfully sent',
                'thanks for your feedback',
                'thank you for your feedback',
                'response submitted',
                'answer submitted',
            ];

            // ✅ FIX v5.5.2: Narrow snapshot to likely success-message containers only
            const successSelectors = '[role="alert"], [role="status"], [class*="toast" i], [class*="Toast"], ' +
                '[class*="success" i], [class*="Success"], [class*="notification" i], [class*="Notification"], ' +
                '[class*="snackbar" i], [class*="Snackbar"], [class*="banner" i], [class*="message" i], ' +
                '[class*="popup" i], [class*="Popup"], [aria-live]';

            const existingSuccessElements = new WeakSet();
            document.querySelectorAll(successSelectors).forEach(el => {
                const text = (el.textContent || '').toLowerCase().trim();
                for (const phrase of targetPhrases) {
                    if (text.includes(phrase)) {
                        existingSuccessElements.add(el);
                        break;
                    }
                }
            });

            function isNewSuccessElement(el) {
                if (!el || !el.textContent) return false;
                if (existingSuccessElements.has(el)) return false;
                const text = el.textContent.toLowerCase().trim();
                for (const phrase of targetPhrases) {
                    if (text.includes(phrase)) return phrase;
                }
                return false;
            }

            successObserver = new MutationObserver((mutations) => {
                if (resolved || isDestroyed || currentGen !== observationGeneration) {
                    cleanup();
                    if (!resolved) { resolved = true; resolve(false); }
                    return;
                }

                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType !== Node.ELEMENT_NODE) continue;
                        const found = isNewSuccessElement(node);
                        if (found) {
                            resolved = true;
                            cleanup();
                            return resolve(true);
                        }
                        const children = node.querySelectorAll(successSelectors + ', p, span, div');
                        for (const child of children) {
                            const childFound = isNewSuccessElement(child);
                            if (childFound) {
                                resolved = true;
                                cleanup();
                                return resolve(true);
                            }
                        }
                    }

                    if (mutation.type === 'attributes' && mutation.target.nodeType === Node.ELEMENT_NODE) {
                        const el = mutation.target;
                        if (existingSuccessElements.has(el)) continue;
                        const text = (el.textContent || '').toLowerCase().trim();
                        for (const phrase of targetPhrases) {
                            if (text.includes(phrase)) {
                                const style = window.getComputedStyle(el);
                                if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                                    resolved = true;
                                    cleanup();
                                    return resolve(true);
                                }
                            }
                        }
                    }
                }
            });

            successObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class', 'hidden', 'aria-hidden'],
            });

            function cleanup() {
                if (successObserver) {
                    successObserver.disconnect();
                    successObserver = null;
                }
            }

            setTimeout(() => {
                if (!resolved && currentGen === observationGeneration) {
                    resolved = true;
                    cleanup();
                    resolve(false);
                }
            }, timeout);
        });
    }

    function updateStatusIndicator() {
        const statusEl = document.getElementById('qc-state-indicator');
        if (!statusEl) return;
        if (isWaitingForSuccess) {
            statusEl.textContent = '⏳ Watching...';
            statusEl.style.color = '#3B82F6';
        } else {
            statusEl.textContent = '🟢 Ready';
            statusEl.style.color = '#22C55E';
        }
    }

    function onMouseDown(e) {
        if (e.target.id === 'qc-reset') return;
        isDragging = true;
        offsetX = e.clientX - counterEl.getBoundingClientRect().left;
        offsetY = e.clientY - counterEl.getBoundingClientRect().top;
    }

    function onMouseMove(e) {
        if (!isDragging || !counterEl) return;
        counterEl.style.left = `${e.clientX - offsetX}px`;
        counterEl.style.top = `${e.clientY - offsetY}px`;
    }

    function onMouseUp() { isDragging = false; }

    function init() {
        if (initialized) return;
        initialized = true;
        isDestroyed = false;
        queryCount = safeGMGet('queryCount', 0);
        const today = new Date().toDateString();
        if (safeGMGet('lastResetDate', null) !== today) {
            queryCount = 0;
            safeGMSet('queryCount', 0);
            safeGMSet('lastResetDate', today);
        }
        if (document.getElementById('query-counter')) return;
        counterEl = document.createElement('div');
        counterEl.id = 'query-counter';
        counterEl.innerHTML = `
<div id="qc-header">📊 Query Counter</div>
<div id="qc-body">
<span id="qc-count">${queryCount}</span>
<span id="qc-label"> queries today</span>
</div>
<div id="qc-state-indicator" style="font-size:10px;margin-top:4px;color:#22C55E;">🟢 Ready</div>
<button id="qc-reset">Reset</button>
`;
        styleEl = document.createElement('style');
        styleEl.id = 'query-counter-styles';
        styleEl.textContent = `
#query-counter { position: fixed; top: 20px; left: 20px; background: #232F3E; color: #fff; padding: 12px 16px; border-radius: 10px; font-family: Arial, sans-serif; font-size: 14px; z-index: 999999; box-shadow: 0 4px 12px rgba(0,0,0,0.4); min-width: 180px; text-align: center; user-select: none; cursor: move; }
#qc-header { font-weight: bold; font-size: 13px; margin-bottom: 6px; color: #FF9900; }
#qc-count { font-size: 32px; font-weight: bold; color: #FF9900; transition: color 0.3s ease, transform 0.3s ease; display: inline-block; }
#qc-label { font-size: 12px; color: #ccc; }
#qc-state-indicator { font-size: 10px; margin-top: 4px; transition: color 0.3s ease; }
#qc-reset { margin-top: 8px; background: #FF9900; border: none; color: #232F3E; padding: 4px 12px; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 12px; width: 100%; transition: background 0.2s ease; }
#qc-reset:hover { background: #e68a00; }
#qc-reset[data-confirming] { background: #cc0000; color: #fff; }
#qc-reset[data-confirming]:hover { background: #aa0000; }
`;
        document.head.appendChild(styleEl);
        document.body.appendChild(counterEl);
        counterEl.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        document.getElementById('qc-reset').addEventListener('click', () => {
            const btn = document.getElementById('qc-reset');
            if (btn.dataset.confirming) {
                queryCount = 0;
                safeGMSet('queryCount', 0);
                document.getElementById('qc-count').textContent = 0;
                btn.textContent = 'Reset';
                delete btn.dataset.confirming;
                lastCountTimestamp = 0;
                updateStatusIndicator();
            } else {
                btn.dataset.confirming = 'true';
                btn.textContent = 'Confirm?';
                setTimeout(() => {
                    if (btn && btn.dataset.confirming) {
                        btn.textContent = 'Reset';
                        delete btn.dataset.confirming;
                    }
                }, 3000);
            }
        });

        // ✅ FIX v5.5.2: Only inspect addedNodes instead of querying all buttons
        observer = new MutationObserver((mutations) => {
            if (isDestroyed) return;
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    if (node.tagName === 'BUTTON') {
                        attachSubmitListener(node);
                    }
                    const buttons = node.querySelectorAll ? node.querySelectorAll('button') : [];
                    for (const btn of buttons) {
                        attachSubmitListener(btn);
                    }
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Also attach to any existing submit buttons on init
        document.querySelectorAll('button').forEach(attachSubmitListener);

        console.info('[Query Counter] v5.5.2 initialized ✓');
    }

    function attachSubmitListener(btn) {
        const btnText = (btn.innerText || '').trim().toLowerCase();
        if (btnText === 'submit' && !attachedButtons.has(btn)) {
            attachedButtons.add(btn);
            btn.addEventListener('click', handleSubmitClick);
        }
    }

    // ✅ FIX v5.5.2: Proper error handling with try/catch/finally
    async function handleSubmitClick() {
        if (isDestroyed) return;

        console.log('[Query Counter] ════════════════════════════════');
        console.log('[Query Counter] Submit button clicked');

        const now = Date.now();
        if (now - lastCountTimestamp < COOLDOWN_MS) {
            console.log('[Query Counter] ✗ BLOCKED — cooldown active (' + Math.round((COOLDOWN_MS - (now - lastCountTimestamp)) / 1000) + 's remaining)');
            console.log('[Query Counter] ════════════════════════════════');
            return;
        }

        if (isWaitingForSuccess) {
            console.log('[Query Counter] ✗ BLOCKED — already watching');
            console.log('[Query Counter] ════════════════════════════════');
            return;
        }

        isWaitingForSuccess = true;
        updateStatusIndicator();

        console.log('[Query Counter] ⏳ Watching for NEW success popup...');

        try {
            const isSuccess = await waitForFeedbackSuccessPopup(10000);

            if (isDestroyed) return;

            if (isSuccess) {
                console.log('[Query Counter] ✓ INCREMENTING COUNTER ✓');
                incrementCount();
                lastCountTimestamp = Date.now();
            } else {
                console.log('[Query Counter] ✗ No new success popup — NOT counting');
            }
        } catch (err) {
            console.error('[Query Counter] Error during success detection:', err);
        } finally {
            // ✅ FIX v5.5.2: Always reset waiting state even if promise rejects
            isWaitingForSuccess = false;
            if (!isDestroyed) updateStatusIndicator();
        }

        console.log('[Query Counter] ════════════════════════════════');
    }

    function incrementCount() {
        queryCount++;
        safeGMSet('queryCount', queryCount);
        const countEl = document.getElementById('qc-count');
        if (!countEl) return;
        countEl.textContent = queryCount;
        countEl.style.transform = 'scale(1.4)';
        setTimeout(() => { if (countEl) countEl.style.transform = 'scale(1)'; }, 300);
    }

    function destroy() {
        if (!initialized) return;
        initialized = false;
        isDestroyed = true;
        observationGeneration++; // ✅ FIX: Cancel any pending observation
        if (observer) { observer.disconnect(); observer = null; }
        if (successObserver) { successObserver.disconnect(); successObserver = null; }
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        if (counterEl) {
            counterEl.removeEventListener('mousedown', onMouseDown);
            counterEl.remove();
            counterEl = null;
        }
        if (styleEl) { styleEl.remove(); styleEl = null; }
        console.info('[Query Counter] module destroyed');
    }

    return { init, destroy };
})();

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVATION CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

let currentlyActive = false;
let urlCheckInterval = null;

function syncActivation() {
    const shouldBeActive = isToolActivated();
    if (shouldBeActive && !currentlyActive) {
        currentlyActive = true;
        HVALibraryModule.init();
        QueryCounterModule.init();
        console.info('[Combined Script] v5.5.2 Activated');
    } else if (!shouldBeActive && currentlyActive) {
        currentlyActive = false;
        HVALibraryModule.destroy();
        QueryCounterModule.destroy();
        // ✅ FIX v5.5.2: Clear interval on deactivation
        if (urlCheckInterval) {
            clearInterval(urlCheckInterval);
            urlCheckInterval = null;
        }
        console.info('[Combined Script] Deactivated');
    }
}

syncActivation();

(function watchUrlChanges() {
    const _pushState = history.pushState;
    const _replaceState = history.replaceState;
    history.pushState = function (...args) {
        const result = _pushState.apply(this, args);
        window.dispatchEvent(new Event('hva-url-changed'));
        return result;
    };
    history.replaceState = function (...args) {
        const result = _replaceState.apply(this, args);
        window.dispatchEvent(new Event('hva-url-changed'));
        return result;
    };
    window.addEventListener('popstate', () => window.dispatchEvent(new Event('hva-url-changed')));
    window.addEventListener('hva-url-changed', () => {
        cachedActivationHref = null; // ✅ FIX: Invalidate cache on URL change
        syncActivation();
    });
    urlCheckInterval = setInterval(syncActivation, 10000);
})();

console.info('[Combined Script] v5.5.2 HVA Library + Query Counter loaded');
})();

