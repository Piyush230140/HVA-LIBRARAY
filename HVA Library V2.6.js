// ==UserScript==
// @name         HVA Library – Custom HVA Picker
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Intercepts the Custom HVA text input and replaces manual typing with a searchable, Amazon-styled HVA Library modal.
// @author       Internal Eval Tools
// @match        https://pre-prod.amazon.com/businessprime*
// @grant        none
// @run-at       document-idle
// ==/UserScript==


(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     1. HVA DATA
  ───────────────────────────────────────────── */
  const HVA_LIST = [
    'Savings Agent',
    'Approvals',
    'Amazon Business Payments',
    'Budget Management',
    'Business Giving',
    'Business Settings',
    'Enhanced Account Security',
    'Groups',
    'Services',
    'Spend Anomaly Monitoring',
    'Socially Responsible Purchasing',
    'UNSPSC',
    'Business Pricing',
    'AB App Center',
    'AB Cart',
    'AB Search',
    'AB Registration',
    'Your Orders',
  ];
HVA_LIST.sort((a, b) => a.localeCompare(b));
const CUSTOM_HVA_STORAGE_KEY = 'hva_custom_library';
function getCustomHVAs() {
  try {
    return JSON.parse(
      localStorage.getItem(CUSTOM_HVA_STORAGE_KEY)
    ) || [];
  } catch {
    return [];
  }
}

function saveCustomHVA(hva) {

  const items = getCustomHVAs();

  if (!items.includes(hva)) {

    items.push(hva);

    localStorage.setItem(
      CUSTOM_HVA_STORAGE_KEY,
      JSON.stringify(items)
    );
  }
}

function deleteCustomHVA(hva) {

  const items = getCustomHVAs()
    .filter(x => x !== hva);

  localStorage.setItem(
    CUSTOM_HVA_STORAGE_KEY,
    JSON.stringify(items)
  );
}
  /* ─────────────────────────────────────────────
     2. CSS INJECTION
  ───────────────────────────────────────────── */
  const CSS = `
    /* ── Overlay ── */
    #hva-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      z-index: 2147483646;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: "Amazon Ember", "Helvetica Neue", Helvetica, Arial, sans-serif;
      animation: hva-fade-in 0.15s ease;
    }
    @keyframes hva-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    /* ── Modal shell ── */
    #hva-modal {
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.30), 0 2px 8px rgba(0,0,0,0.18);
      width: 480px;
      max-width: 95vw;
      max-height: 82vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: hva-slide-up 0.18s ease;
    }
    @keyframes hva-slide-up {
      from { transform: translateY(18px); opacity: 0; }
      to   { transform: translateY(0);   opacity: 1; }
    }

    /* ── Header ── */
    #hva-header {
      background: #131921;
      padding: 14px 18px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    #hva-header h2 {
      margin: 0;
      color: #ffffff;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    #hva-header h2 span {
      color: #FF9900;
    }
    #hva-close-btn {
      background: none;
      border: none;
      color: #aaa;
      cursor: pointer;
      padding: 2px 6px;
      font-size: 20px;
      line-height: 1;
      border-radius: 4px;
      transition: color 0.15s, background 0.15s;
    }
    #hva-close-btn:hover {
      color: #ffffff;
      background: rgba(255,255,255,0.1);
    }

    /* ── Search bar ── */
    #hva-search-wrap {
      padding: 12px 14px 8px;
      background: #f8f8f8;
      border-bottom: 1px solid #e3e6e6;
      flex-shrink: 0;
    }
    #hva-search {
      width: 100%;
      box-sizing: border-box;
      padding: 8px 12px 8px 36px;
      border: 1px solid #a0a0a0;
      border-radius: 4px;
      font-size: 14px;
      color: #0F1111;
      outline: none;
      background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E") no-repeat 10px center;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    #hva-search:focus {
      border-color: #FF9900;
      box-shadow: 0 0 0 3px rgba(255,153,0,0.25);
    }

    /* ── Scrollable list ── */
    #hva-list-wrap {
      overflow-y: auto;
      flex: 1 1 auto;
      padding: 6px 0;
    }
    #hva-list-wrap::-webkit-scrollbar { width: 6px; }
    #hva-list-wrap::-webkit-scrollbar-thumb { background: #c9c9c9; border-radius: 3px; }

  .hva-item {
  display: flex;
  align-items: center;
  gap: 10px;

  padding: 12px 16px;
  margin: 6px 12px;

  background: #ffffff;

  border: 1px solid #D5D9D9;
  border-left: 4px solid #FF9900;

  border-radius: 8px;

  cursor: pointer;

  font-size: 14px;
  color: #0F1111;

  transition: all 0.15s ease;
}   .hva-item:hover,
.hva-item.hva-focused {

  background: #FF9900;

  border-color: #FF9900;

  color: #111111;

  box-shadow: 0 2px 8px rgba(255,153,0,0.35);
}
    .hva-item .hva-icon {
      font-size: 16px;
      flex-shrink: 0;
      opacity: 0.7;
    }
    .hva-item-label {
      flex: 1;
    }
    .hva-item-label mark {
      background: #fff0b3;
      color: #0F1111;
      border-radius: 2px;
      padding: 0 1px;
    }

    /* ── Custom HVA entry (at bottom of list) ── */
    .hva-custom-entry {
      border-top: 1px dashed #e3e6e6;
      margin-top: 4px;
      padding-top: 4px;
      color: #007185 !important;
      font-weight: 600;
    }
    .hva-custom-entry:hover,
    .hva-custom-entry.hva-focused {
      background: #eaf6f6 !important;
      border-left-color: #007185 !important;
      color: #005B6B !important;
    }

    /* ── Inline custom form ── */
    #hva-custom-form {
      padding: 14px 18px 16px;
      background: #f0f8ff;
      border-top: 1px solid #c8e6f5;
      flex-shrink: 0;
    }
    #hva-custom-form label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #555;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    #hva-custom-input-row {
      display: flex;
      gap: 8px;
    }
    #hva-custom-text {
      flex: 1;
      padding: 8px 10px;
      border: 1px solid #a0a0a0;
      border-radius: 4px;
      font-size: 14px;
      color: #0F1111;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    #hva-custom-text:focus {
      border-color: #007185;
      box-shadow: 0 0 0 3px rgba(0,113,133,0.2);
    }
    #hva-custom-insert {
      padding: 8px 16px;
      background: linear-gradient(to bottom, #FFD814, #FFA41C);
      border: 1px solid #FCD200;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 700;
      color: #111;
      cursor: pointer;
      white-space: nowrap;
      transition: filter 0.15s;
    }
    #hva-custom-insert:hover {
      filter: brightness(1.06);
    }
    #hva-custom-cancel {
      background: none;
      border: none;
      font-size: 12px;
      color: #888;
      cursor: pointer;
      padding: 4px 0 0;
      display: block;
      margin-top: 6px;
      text-decoration: underline;
    }
    #hva-custom-cancel:hover { color: #555; }

    /* ── Empty state ── */
    #hva-empty {
      padding: 32px 18px;
      text-align: center;
      color: #888;
      font-size: 14px;
      display: none;
    }
    #hva-empty svg {
      display: block;
      margin: 0 auto 10px;
      opacity: 0.35;
    }

    /* ── Toast ── */
    #hva-toast {
      position: fixed;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%) translateY(12px);
      background: #232F3E;
      color: #fff;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 13px;
      font-family: "Amazon Ember", "Helvetica Neue", Helvetica, Arial, sans-serif;
      box-shadow: 0 4px 16px rgba(0,0,0,0.28);
      z-index: 2147483647;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s, transform 0.2s;
      white-space: nowrap;
      max-width: 90vw;
    }
   #hva-status {
  position: fixed;

  bottom: 10px;
  left: 10px;

  z-index: 2147483647;

  background: #22C55E;

  color: #111111;

  padding: 8px 14px;

  border-radius: 999px;

  font-size: 13px;
  font-weight: 700;

  font-family: "Amazon Ember", sans-serif;

  border: 2px solid #111111;

  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
} #custom-hva-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  z-index: 2147483648;
  display: flex;
  align-items: center;
  justify-content: center;
}

#custom-hva-modal {
  width: 500px;
  max-width: 90vw;
  background: white;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,.3);
}

#custom-hva-header {
  background: #131921;
  color: white;
  padding: 16px;
  font-size: 18px;
  font-weight: 700;
}

#custom-hva-body {
  padding: 20px;
}

#custom-hva-text {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 14px;
}

#custom-hva-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.custom-btn {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 700;
}

.fill-btn {
  background: #f3f4f6;
}

.save-btn {
  background: #FF9900;
  color: black;
}
.back-btn {

  width: 100%;

  margin-top: 14px;

  padding: 12px;

  background: #F3F4F6;

  color: #111111;

  border: 1px solid #D5D9D9;

  border-radius: 8px;

  cursor: pointer;

  font-weight: 700;

  font-size: 14px;

  transition: all 0.15s ease;
}

.back-btn:hover {

  background: #E5E7EB;

  border-color: #BFC5C5;

}

.cancel-btn {

  width: 100%;

  margin-top: 10px;

  padding: 12px;

  background: #131921;

  color: white;

  border: none;

  border-radius: 8px;

  cursor: pointer;

  font-weight: 700;

  font-size: 14px;

  transition: all 0.15s ease;
}

.cancel-btn:hover {

  background: #232F3E;

}`;

  /* ─────────────────────────────────────────────
     3. STATE
  ───────────────────────────────────────────── */
  let overlayEl = null;
  let searchEl = null;
  let listWrapEl = null;
  let customFormEl = null;
  let toastEl = null;
  let toastTimer = null;
  let focusedIndex = -1;
  let visibleItems = []; // NodeList snapshot of currently rendered .hva-item
  let customFormOpen = false;

  /* ─────────────────────────────────────────────
     4. INJECT STYLES
  ───────────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById('hva-styles')) return;
    const style = document.createElement('style');
    style.id = 'hva-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  /* ─────────────────────────────────────────────
     5. FIND THE CUSTOM HVA INPUT
     Heuristics: look for a visible <input> or <textarea>
     whose id / name / placeholder / aria-label suggests "custom hva".
     Falls back to any newly visible text input near a "Custom" label.
  ───────────────────────────────────────────── */
  function findCustomHVAInput() {

    const textareas = document.querySelectorAll('textarea');

    // textarea[1] = Custom HVA field
    if (textareas.length > 1) {
        return textareas[1];
    }

    return null;
}
  function isVisible(el) {
    if (!el || !el.offsetParent) return false;
    const s = window.getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  }

  /* ─────────────────────────────────────────────
     6. FILL INPUT (React-compatible)
  ───────────────────────────────────────────── */
function fillCustomHVA(value) {

    const input = findCustomHVAInput();

    if (!input) {
        console.error('[HVA] No textarea found');
        return false;
    }

    input.focus();

    if (input.tagName === 'TEXTAREA') {

        const setter = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            'value'
        ).set;

        setter.call(input, value);

    } else {

        const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value'
        ).set;

        setter.call(input, value);
    }

    input.dispatchEvent(
        new Event('input', { bubbles: true })
    );

    input.dispatchEvent(
        new Event('change', { bubbles: true })
    );

    input.dispatchEvent(
        new Event('blur', { bubbles: true })
    );

    console.log('[HVA] Filled:', value);

    return true;
}
  /* ─────────────────────────────────────────────
     7. TOAST
  ───────────────────────────────────────────── */
  function ensureToast() {
    if (document.getElementById('hva-toast')) return;
    toastEl = document.createElement('div');
    toastEl.id = 'hva-toast';
    document.body.appendChild(toastEl);
  }

  function createToast(msg) {
    ensureToast();
    toastEl = document.getElementById('hva-toast');
    toastEl.innerHTML = `<span class="hva-toast-check">✔</span>${msg}`;
    toastEl.classList.add('hva-toast-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('hva-toast-show'), 2800);
  }

  /* ─────────────────────────────────────────────
     8. BUILD & SHOW POPUP
  ───────────────────────────────────────────── */
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
    listWrapEl.innerHTML = '';
    customFormOpen = false;
    if (customFormEl) customFormEl.style.display = 'none';

    const q = (query || '').trim().toLowerCase();
    const ALL_HVAS = [
  ...HVA_LIST,
  ...getCustomHVAs()
];

const filtered = ALL_HVAS.filter(
  h => !q || h.toLowerCase().includes(q)
);

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
        icon.className = 'hva-icon';
        icon.textContent = '📁';

        const label = document.createElement('span');
        label.className = 'hva-item-label';
        label.appendChild(buildHighlight(hva, query));
const isCustomHVA = getCustomHVAs().includes(hva);
        item.appendChild(icon);
        item.appendChild(label);
if (isCustomHVA) {

    const deleteBtn = document.createElement('span');

    deleteBtn.className = 'hva-delete';

    deleteBtn.innerHTML = `
<svg width="16" height="16" viewBox="0 0 24 24"
     fill="none"
     stroke="currentColor"
     stroke-width="2"
     stroke-linecap="round"
     stroke-linejoin="round">

  <polyline points="3 6 5 6 21 6"></polyline>

  <path d="M19 6L18 20
           a2 2 0 0 1-2 2H8
           a2 2 0 0 1-2-2L5 6">
  </path>

  <path d="M10 11v6"></path>
  <path d="M14 11v6"></path>

  <path d="M9 6V4
           a1 1 0 0 1 1-1h4
           a1 1 0 0 1 1 1v2">
  </path>

</svg>
`;

    deleteBtn.style.opacity = '0';

    deleteBtn.style.cursor = 'pointer';
deleteBtn.style.color = '#DC2626';

deleteBtn.style.padding = '4px';

deleteBtn.style.borderRadius = '4px';

deleteBtn.style.transition = 'all 0.15s ease';
    deleteBtn.style.marginLeft = 'auto';
deleteBtn.addEventListener('mouseenter', () => {

    deleteBtn.style.background = '#FEE2E2';

});

deleteBtn.addEventListener('mouseleave', () => {

    deleteBtn.style.background = 'transparent';

});
    deleteBtn.addEventListener('click', (e) => {

        e.stopPropagation();

        const confirmed = confirm(
            `Delete "${hva}" ?`
        );

        if (!confirmed) return;

        deleteCustomHVA(hva);

        renderList(searchEl?.value || '');

        createToast(`Deleted: ${hva}`);
    });

    item.appendChild(deleteBtn);

    item.addEventListener('mouseenter', () => {
        deleteBtn.style.opacity = '1';
    });

    item.addEventListener('mouseleave', () => {
        deleteBtn.style.opacity = '0';
    });
}
        item.addEventListener('click', () => selectHVA(hva));
        listWrapEl.appendChild(item);
      });
    }

    // ➕ Custom HVA always at bottom
    const customItem = document.createElement('div');
    customItem.className = 'hva-item hva-custom-entry';
    customItem.dataset.hva = '__custom__';

    const customIcon = document.createElement('span');
    customIcon.className = 'hva-icon';
    customIcon.textContent = '➕';

    const customLabel = document.createElement('span');
    customLabel.className = 'hva-item-label';
    customLabel.textContent = 'Custom HVA';

    customItem.appendChild(customIcon);
    customItem.appendChild(customLabel);
    customItem.addEventListener('click', openCustomForm);
    listWrapEl.appendChild(customItem);

    // Refresh focusable items
    visibleItems = listWrapEl.querySelectorAll('.hva-item');
    focusedIndex = -1;
  }

  function selectHVA(hva) {
    const ok = fillCustomHVA(hva);
    hideHVAPopup();
    if (ok) createToast(`HVA set: ${hva}`);
  }

  function openCustomForm() {

    showCustomHVAPopup();

}
function showCustomHVAPopup() {

    const overlay = document.createElement('div');
    overlay.id = 'custom-hva-overlay';

    overlay.innerHTML = `
        <div id="custom-hva-modal">
            <div id="custom-hva-header">
                Custom HVA
            </div>

            <div id="custom-hva-body">

                <label style="display:block;margin-bottom:8px;font-weight:600;">
                    Type Your Custom HVA
                </label>

                <input
                    id="custom-hva-text"
                    type="text"
                    placeholder="Enter HVA..."
                >

                <div id="custom-hva-actions">

                    <button class="custom-btn fill-btn">
                        Fill Now
                    </button>

                    <button class="custom-btn save-btn">
                        Save & Fill
                    </button>

                </div>

                <button class="back-btn">
    ← Back to Library
</button>

<button class="cancel-btn">
    ✕ Cancel
</button>

            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const input = overlay.querySelector('#custom-hva-text');

    setTimeout(() => input.focus(), 100);

    overlay.querySelector('.fill-btn').onclick = () => {

        const value = input.value.trim();

        if (!value) return;

        fillCustomHVA(value);

        overlay.remove();

        hideHVAPopup();

        createToast(`Filled: ${value}`);
    };

    overlay.querySelector('.save-btn').onclick = () => {

        const value = input.value.trim();

        if (!value) return;

        saveCustomHVA(value);

        fillCustomHVA(value);

        overlay.remove();

        hideHVAPopup();

        createToast(`Saved: ${value}`);
    };

    overlay.querySelector('.back-btn').onclick = () => {
        overlay.remove();
    };
overlay.querySelector('.cancel-btn').onclick = () => {

    overlay.remove();

};
    overlay.addEventListener('click', e => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
}
  function showHVAPopup() {
    injectStyles();
    if (overlayEl && document.body.contains(overlayEl)) return; // already open

    /* ── Overlay ── */
    overlayEl = document.createElement('div');
    overlayEl.id = 'hva-overlay';
    overlayEl.addEventListener('mousedown', e => {
      if (e.target === overlayEl) hideHVAPopup();
    });

    /* ── Modal ── */
    const modal = document.createElement('div');
    modal.id = 'hva-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'HVA Library');

    /* ── Header ── */
    const header = document.createElement('div');
    header.id = 'hva-header';
    header.innerHTML = `<h2><span>HVA</span> Library</h2>`;
    const closeBtn = document.createElement('button');
    closeBtn.id = 'hva-close-btn';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', hideHVAPopup);
    header.appendChild(closeBtn);

    /* ── Search ── */
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

    /* ── List ── */
    listWrapEl = document.createElement('div');
    listWrapEl.id = 'hva-list-wrap';

    /* ── Empty state ── */
    const emptyEl = document.createElement('div');
    emptyEl.id = 'hva-empty';
    emptyEl.innerHTML = `
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
           stroke="#999" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      No HVAs matched your search.
    `;

   /*
customFormEl = document.createElement('div');
customFormEl.id = 'hva-custom-form';
customFormEl.style.display = 'none';
customFormEl.innerHTML = `
  <label>Enter Custom HVA</label>
  <div id="hva-custom-input-row">
    <input id="hva-custom-text" type="text" placeholder="Type your HVA…" autocomplete="off" />
    <button id="hva-custom-insert">Insert</button>
  </div>
  <button id="hva-custom-cancel">Cancel</button>
`;

customFormEl.querySelector('#hva-custom-insert').addEventListener('click', () => {
  const val = (customFormEl.querySelector('#hva-custom-text').value || '').trim();
  if (!val) {
    customFormEl.querySelector('#hva-custom-text').focus();
    return;
  }
  fillCustomHVA(val);
  hideHVAPopup();
  createToast(`Custom HVA set: ${val}`);
});

customFormEl.querySelector('#hva-custom-text').addEventListener('keydown', e => {
  if (e.key === 'Enter')
    customFormEl.querySelector('#hva-custom-insert').click();
});

customFormEl.querySelector('#hva-custom-cancel').addEventListener('click', () => {
  customFormEl.style.display = 'none';
  customFormOpen = false;
  searchEl.focus();
});
*/

    /* ── Assemble ── */
    modal.appendChild(header);
    modal.appendChild(searchWrap);
    modal.appendChild(emptyEl);
    modal.appendChild(listWrapEl);
    // modal.appendChild(customFormEl);
    overlayEl.appendChild(modal);
    document.body.appendChild(overlayEl);

    /* ── Keyboard ── */
    document.addEventListener('keydown', handleGlobalKeydown);

    renderList('');
    requestAnimationFrame(() => { if (searchEl) searchEl.focus(); });
  }

  function hideHVAPopup() {
    if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
    overlayEl = null;
    searchEl = null;
    listWrapEl = null;
    customFormEl = null;
    focusedIndex = -1;
    visibleItems = [];
    document.removeEventListener('keydown', handleGlobalKeydown);
  }

  /* ─────────────────────────────────────────────
     9. KEYBOARD NAVIGATION
  ───────────────────────────────────────────── */
  function setFocus(idx) {
    visibleItems = listWrapEl ? listWrapEl.querySelectorAll('.hva-item') : [];
    visibleItems.forEach((el, i) => el.classList.toggle('hva-focused', i === idx));
    if (visibleItems[idx]) visibleItems[idx].scrollIntoView({ block: 'nearest' });
    focusedIndex = idx;
  }

  function handleKeydown(e) {
    // Called on searchEl keydown
    if (customFormOpen) return;
    visibleItems = listWrapEl ? listWrapEl.querySelectorAll('.hva-item') : [];
    const len = visibleItems.length;
    if (!len) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocus((focusedIndex + 1) % len);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocus((focusedIndex - 1 + len) % len);
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      visibleItems[focusedIndex].click();
    }
  }

  function handleGlobalKeydown(e) {
    if (e.key === 'Escape') hideHVAPopup();
  }

  /* ─────────────────────────────────────────────
     10. DETECT "Custom" CLICK → WAIT FOR INPUT → SHOW POPUP
  ───────────────────────────────────────────── */
  /**
   * We detect the "Custom" HVA option via a delegated click listener.
   * The heuristic: any click on an element whose text is exactly "Custom"
   * (or contains "Custom" and relates to HVA/option) near a radio/checkbox/button.
   *
   * After the click we give the app up to 2 s to render the custom input field,
   * then show the popup.
   */
  const CUSTOM_TEXT_RE = /custom/i;

  function isCustomHVAOption(el) {
    if (!el) return false;

    const selectValue = el.closest('.react-aria-SelectValue');

    if (selectValue) {
        const value = selectValue.textContent.trim();
        return /custom/i.test(value);
    }

    const text = (el.textContent || '').trim();

    if (/custom/i.test(text)) {
        return true;
    }

    return false;
}

  function waitForCustomInput(callback, timeout = 2000) {
    const start = Date.now();

    // Already present?
    const immediate = findCustomHVAInput();
    if (immediate) { callback(immediate); return; }

    const observer = new MutationObserver(() => {
      const input = findCustomHVAInput();
      if (input) {
        observer.disconnect();
        callback(input);
      } else if (Date.now() - start > timeout) {
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    // Safety timeout
    setTimeout(() => observer.disconnect(), timeout + 100);
  }

document.addEventListener('click', function (e) {

    const option = e.target.closest('[data-key="Custom"]');

    if (!option) return;

    console.log('CUSTOM CLICKED');

    setTimeout(() => {
        showHVAPopup();
    }, 150);

}, true);


  /* ─────────────────────────────────────────────
     11. MUTATION OBSERVER – also watch for dynamic
         "Custom" options added after page load
  ───────────────────────────────────────────── */
  const globalObserver = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        // If a new "Custom" option appears already focused/selected, show popup
// disabled
      }
    }
  });
  globalObserver.observe(document.body, { childList: true, subtree: true });

  /* ─────────────────────────────────────────────
     12. EXPOSE HELPERS TO CONSOLE (dev convenience)
  ───────────────────────────────────────────── */
 function createStatusIndicator() {

    if (document.getElementById('hva-status')) return;

    const badge = document.createElement('div');

    badge.id = 'hva-status';

    badge.textContent = 'HVA Library ON';

    document.body.appendChild(badge);
} window.__HVALibrary = {
    showHVAPopup,
    hideHVAPopup,
    findCustomHVAInput,
    fillCustomHVA,
    createToast,
    getCustomHVAs,
    saveCustomHVA,
    deleteCustomHVA
};

  injectStyles();
ensureToast();
createStatusIndicator();

console.info('[HVA Library] Userscript loaded...');
})();
