
// ==UserScript==
// @name         Amazon Business Prime - HVA Library + Query Counter
// @namespace    http://tampermonkey.net/
// @version      4.1.0
// @description  Combined script: (1) searchable HVA Library modal for the Custom HVA field, (2) floating query counter tracking feedback panel submissions. Active only when the URL contains showDevConsole=true, on any page/path, including SPA navigation without full reloads.
// @author       Internal Eval Tools / arvindon / piyush
// @match        https://pre-prod.amazon.com/*
// @match        https://de-pre-prod.amazon.com/*
// @match        https://it-pre-prod.amazon.com/*
// @match        https://fr-pre-prod.amazon.com/*
// @match        https://es-pre-prod.amazon.com/*
// @match        https://ca-pre-prod.amazon.com/*
// @match        https://mx-pre-prod.amazon.com/*
// @match        https://uk-pre-prod.amazon.com/*
// @match        https://in-pre-prod.amazon.com/*

// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     ACTIVATION CHECK
     The script matches every page on this domain
     (so it works regardless of which tool/page you're on),
     but the HVA Library + Query Counter only mount when
     the URL carries the dev-console activation query string.
     See the ACTIVATION CONTROLLER near the bottom of this
     file for the mount/unmount logic, including SPA support.
  ───────────────────────────────────────────── */
  function isToolActivated() {
    const params = new URLSearchParams(window.location.search);
    return params.get('showDevConsole') === 'true';
  }

  /* ═════════════════════════════════════════════
     MODULE A: HVA LIBRARY
  ═════════════════════════════════════════════ */
  const HVALibraryModule = (function () {
    let initialized = false;

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
    }
    .hva-item:hover,
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
    .hva-item .hva-icon.hva-icon-dot {
      font-size: 22px;
      line-height: 1;
      width: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      opacity: 0.5;
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

    /* ── Delete button on custom items ── */
    .hva-delete {
      opacity: 0;
      cursor: pointer;
      color: #DC2626;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.15s ease;
      margin-left: auto;
    }
    .hva-delete:hover {
      background: #FEE2E2;
    }
    .hva-item:hover .hva-delete,
    .hva-item.hva-focused .hva-delete {
      opacity: 1;
    }

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
      transition: opacity 0.2s ease, transform 0.2s ease;
      white-space: nowrap;
      max-width: 90vw;
    }
    #hva-toast.hva-toast-show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    /* ── Status badge ── */
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
    }

    /* ── Custom HVA popup overlay ── */
    #custom-hva-overlay {
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
    #custom-hva-text:focus {
      outline: none;
      border-color: #FF9900;
      box-shadow: 0 0 0 3px rgba(255,153,0,0.25);
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
      font-size: 14px;
      transition: filter 0.15s;
    }
    .custom-btn:hover { filter: brightness(0.95); }
    .fill-btn {
      background: #f3f4f6;
      border: 1px solid #D5D9D9;
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
    .cancel-btn:hover { background: #232F3E; }

    /* ── Duplicate warning ── */
    #hva-duplicate-warning {
      font-size: 12px;
      color: #c0392b;
      margin-top: 6px;
      display: none;
    }
  `;

  /* ─────────────────────────────────────────────
     3. STATE
  ───────────────────────────────────────────── */
  let overlayEl      = null;
  let searchEl       = null;
  let listWrapEl     = null;
  let toastEl        = null;
  let toastTimer     = null;
  let focusedIndex   = -1;
  let visibleItems   = [];

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
  ───────────────────────────────────────────── */
  function findCustomHVAInput() {
    const byAttr = document.querySelector(
      'textarea[aria-label*="custom" i], textarea[placeholder*="custom" i], ' +
      'textarea[aria-label*="hva" i], textarea[placeholder*="hva" i]'
    );
    if (byAttr && isVisible(byAttr)) return byAttr;

    const labels = Array.from(document.querySelectorAll('label'));
    for (const label of labels) {
      if (/custom/i.test(label.textContent)) {
        const forId = label.getAttribute('for');
        if (forId) {
          const el = document.getElementById(forId);
          if (el && isVisible(el)) return el;
        }
        const wrapped = label.querySelector('textarea, input[type="text"]');
        if (wrapped && isVisible(wrapped)) return wrapped;
      }
    }

    const textareas = document.querySelectorAll('textarea');
    if (textareas.length > 1 && isVisible(textareas[1])) return textareas[1];

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

    const proto = input.tagName === 'TEXTAREA'
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;

    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(input, value);

    ['input', 'change', 'blur'].forEach(type =>
      input.dispatchEvent(new Event(type, { bubbles: true }))
    );

    console.log('[HVA] Filled:', value);
    return true;
  }

  /* ─────────────────────────────────────────────
     7. TOAST
  ───────────────────────────────────────────── */
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
    toastEl.textContent = `✔ ${msg}`;
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

    const q = (query || '').trim().toLowerCase();

    const customHVAs = getCustomHVAs();
    const ALL_HVAS = [
      ...HVA_LIST,
      ...customHVAs.filter(c => !HVA_LIST.includes(c))
    ];

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
          deleteBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6L18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
              <path d="M10 11v6"></path>
              <path d="M14 11v6"></path>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
            </svg>
          `;

          deleteBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (!confirm(`Delete "${hva}"?`)) return;
            deleteCustomHVA(hva);
            renderList(searchEl?.value || '');
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
    customLabel.textContent = 'Custom HVA';

    customItem.appendChild(customIcon);
    customItem.appendChild(customLabel);
    customItem.addEventListener('click', openCustomForm);
    listWrapEl.appendChild(customItem);

    visibleItems = Array.from(listWrapEl.querySelectorAll('.hva-item'));
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

  /* ─────────────────────────────────────────────
     CUSTOM HVA POPUP
  ───────────────────────────────────────────── */
  function showCustomHVAPopup() {
    if (document.getElementById('custom-hva-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'custom-hva-overlay';

    overlay.innerHTML = `
      <div id="custom-hva-modal">
        <div id="custom-hva-header">Custom HVA</div>
        <div id="custom-hva-body">
          <label style="display:block;margin-bottom:8px;font-weight:600;">
            Type Your Custom HVA
          </label>
          <input id="custom-hva-text" type="text" placeholder="Enter HVA…" autocomplete="off">
          <div id="hva-duplicate-warning">
            ⚠ This HVA already exists in the library.
          </div>
          <div id="custom-hva-actions">
            <button class="custom-btn fill-btn">Fill Now</button>
            <button class="custom-btn save-btn">Save &amp; Fill</button>
          </div>
          <button class="back-btn">← Back to Library</button>
          <button class="cancel-btn">✕ Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = overlay.querySelector('#custom-hva-text');
    const warning = overlay.querySelector('#hva-duplicate-warning');
    setTimeout(() => input.focus(), 100);

    input.addEventListener('input', () => {
      const val = input.value.trim();
      const allHVAs = [...HVA_LIST, ...getCustomHVAs()];
      warning.style.display =
        val && allHVAs.some(h => h.toLowerCase() === val.toLowerCase())
          ? 'block' : 'none';
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') overlay.querySelector('.fill-btn').click();
    });

    overlay.querySelector('.fill-btn').addEventListener('click', () => {
      const value = input.value.trim();
      if (!value) { input.focus(); return; }
      fillCustomHVA(value);
      overlay.remove();
      hideHVAPopup();
      createToast(`Filled: ${value}`);
    });

    overlay.querySelector('.save-btn').addEventListener('click', () => {
      const value = input.value.trim();
      if (!value) { input.focus(); return; }
      saveCustomHVA(value);
      fillCustomHVA(value);
      overlay.remove();
      hideHVAPopup();
      createToast(`Saved & filled: ${value}`);
    });

    overlay.querySelector('.back-btn').addEventListener('click', () => {
      overlay.remove();
      if (overlayEl && document.body.contains(overlayEl)) {
        renderList(searchEl?.value || '');
      } else {
        showHVAPopup();
      }
    });

    overlay.querySelector('.cancel-btn').addEventListener('click', () => {
      overlay.remove();
      hideHVAPopup();
    });

    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });
  }

  function showHVAPopup() {
    injectStyles();
    if (overlayEl && document.body.contains(overlayEl)) return;

    overlayEl = document.createElement('div');
    overlayEl.id = 'hva-overlay';
    overlayEl.addEventListener('mousedown', e => {
      if (e.target === overlayEl) hideHVAPopup();
    });

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
    emptyEl.innerHTML = `
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
           stroke="#999" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      No HVAs matched your search.
    `;

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
    overlayEl    = null;
    searchEl     = null;
    listWrapEl   = null;
    focusedIndex = -1;
    visibleItems = [];
    document.removeEventListener('keydown', handleGlobalKeydown);
  }

  /* ─────────────────────────────────────────────
     9. KEYBOARD NAVIGATION
  ───────────────────────────────────────────── */
  function setFocus(idx) {
    visibleItems = listWrapEl
      ? Array.from(listWrapEl.querySelectorAll('.hva-item'))
      : [];
    visibleItems.forEach((el, i) => el.classList.toggle('hva-focused', i === idx));
    if (visibleItems[idx]) visibleItems[idx].scrollIntoView({ block: 'nearest' });
    focusedIndex = idx;
  }

  function handleKeydown(e) {
    visibleItems = listWrapEl
      ? Array.from(listWrapEl.querySelectorAll('.hva-item'))
      : [];
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
     10. CLICK DETECTION
  ───────────────────────────────────────────── */
  function handleCustomOptionClick(e) {
    const option = e.target.closest('[data-key="Custom"]');
    if (!option) return;
    console.log('[HVA] Custom option clicked');
    setTimeout(() => showHVAPopup(), 150);
  }

  /* ─────────────────────────────────────────────
     11. EXPOSE HELPERS TO CONSOLE
  ───────────────────────────────────────────── */
  function createStatusIndicator() {
    if (document.getElementById('hva-status')) return;
    const badge = document.createElement('div');
    badge.id = 'hva-status';
    badge.textContent = 'HVA Library ON';
    document.body.appendChild(badge);
  }

  function init() {
    if (initialized) return;
    initialized = true;
    injectStyles();
    ensureToast();
    createStatusIndicator();
    document.addEventListener('click', handleCustomOptionClick, true);
    console.info('[HVA Library] module initialized');
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
    console.info('[HVA Library] module destroyed');
  }

  window.__HVALibrary = {
    showHVAPopup,
    hideHVAPopup,
    findCustomHVAInput,
    fillCustomHVA,
    createToast,
    getCustomHVAs,
    saveCustomHVA,
    deleteCustomHVA,
  };

  return { init, destroy };
  })(); // ── end HVALibraryModule factory ──

  /* ═════════════════════════════════════════════
     MODULE B: QUERY COUNTER (FIXED)
  ═════════════════════════════════════════════ */
  const QueryCounterModule = (function () {
    let initialized = false;
    let queryCount = 0;
    let counterEl = null;
    let styleEl = null;
    let observer = null;
    let onMouseDown, onMouseMove, onMouseUp, onResetClick;

    /* ─────────────────────────────────────────────
       VALIDATION HELPER:
       Only count a submission when ALL visible fields
       in the feedback panel are filled.
    ───────────────────────────────────────────── */
    function areAllFieldsFilled(submitBtn) {
      // Find the closest form or panel container holding the submit button
      const container = submitBtn.closest('form') ||
                        submitBtn.closest('[role="dialog"]') ||
                        submitBtn.closest('[role="region"]') ||
                        submitBtn.closest('.feedback-panel') ||
                        submitBtn.closest('[class*="panel"]') ||
                        submitBtn.closest('[class*="form"]') ||
                        submitBtn.parentElement?.closest('div');

      if (!container) return false;

      // Gather all visible input elements within the container
      const inputs = container.querySelectorAll(
        'input[type="text"], input[type="email"], input[type="number"], ' +
        'input[type="url"], input[type="tel"], textarea, select'
      );

      // If no fields found at all, don't count (prevents random button clicks)
      if (inputs.length === 0) return false;

      // Check each visible field has a value
      for (const input of inputs) {
        // Skip hidden/invisible fields
        if (input.offsetParent === null) continue;
        const style = window.getComputedStyle(input);
        if (style.display === 'none' || style.visibility === 'hidden') continue;

        const value = input.value.trim();
        if (!value) return false;
      }

      // Also check for any required radio button groups
      const radioGroups = new Set();
      container.querySelectorAll('input[type="radio"]').forEach(r => {
        if (r.name) radioGroups.add(r.name);
      });
      for (const groupName of radioGroups) {
        const checked = container.querySelector(`input[type="radio"][name="${groupName}"]:checked`);
        if (!checked) return false;
      }

      // Check for any unchecked required checkboxes (if marked required)
      const requiredCheckboxes = container.querySelectorAll('input[type="checkbox"][required]');
      for (const cb of requiredCheckboxes) {
        if (!cb.checked) return false;
      }

      return true;
    }

    function init() {
      if (initialized) return;
      initialized = true;

      // ─── Load persisted count ─────────────────────────────────────────
      queryCount = GM_getValue('queryCount', 0);
      let lastResetDate = GM_getValue('lastResetDate', null);

      const today = new Date().toDateString();
      if (lastResetDate !== today) {
        queryCount = 0;
        GM_setValue('queryCount', 0);
        GM_setValue('lastResetDate', today);
      }

      // Guard against double-mount
      if (document.getElementById('query-counter')) return;

      // ─── Create floating counter UI ─────────────────────────────────
      counterEl = document.createElement('div');
      counterEl.id = 'query-counter';
      counterEl.innerHTML = `
        <div id="qc-header">📊 Query Counter</div>
        <div id="qc-body">
          <span id="qc-count">${queryCount}</span>
          <span id="qc-label"> queries today</span>
        </div>
        <button id="qc-reset">Reset</button>
      `;

      styleEl = document.createElement('style');
      styleEl.id = 'query-counter-styles';
      styleEl.textContent = `
        #query-counter {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #232F3E;
          color: #fff;
          padding: 12px 16px;
          border-radius: 10px;
          font-family: Arial, sans-serif;
          font-size: 14px;
          z-index: 999999;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          min-width: 160px;
          text-align: center;
          cursor: move;
          user-select: none;
        }
        #qc-header {
          font-weight: bold;
          font-size: 13px;
          margin-bottom: 6px;
          color: #FF9900;
        }
        #qc-count {
          font-size: 32px;
          font-weight: bold;
          color: #FF9900;
          transition: color 0.3s ease;
        }
        #qc-label {
          font-size: 12px;
          color: #ccc;
        }
        #qc-reset {
          margin-top: 8px;
          background: #FF9900;
          border: none;
          color: #232F3E;
          padding: 4px 12px;
          border-radius: 5px;
          cursor: pointer;
          font-weight: bold;
          font-size: 12px;
          width: 100%;
          transition: background 0.2s ease;
        }
        #qc-reset:hover {
          background: #e68a00;
        }
        #qc-reset[data-confirming] {
          background: #cc0000;
          color: #fff;
        }
        #qc-reset[data-confirming]:hover {
          background: #aa0000;
        }
      `;

      document.head.appendChild(styleEl);
      document.body.appendChild(counterEl);

      // ─── Normalize position to top/left immediately after mount ───────
      requestAnimationFrame(() => {
        if (!counterEl) return;
        const rect = counterEl.getBoundingClientRect();
        counterEl.style.top = rect.top + 'px';
        counterEl.style.left = rect.left + 'px';
        counterEl.style.bottom = 'auto';
        counterEl.style.right = 'auto';
      });

      // ─── Make counter draggable ──────────────────────────────────────
      let isDragging = false, offsetX, offsetY;

      onMouseDown = (e) => {
        if (e.target.id === 'qc-reset') return;
        isDragging = true;
        offsetX = e.clientX - counterEl.getBoundingClientRect().left;
        offsetY = e.clientY - counterEl.getBoundingClientRect().top;
      };

      onMouseMove = (e) => {
        if (!isDragging) return;
        counterEl.style.left = `${e.clientX - offsetX}px`;
        counterEl.style.top = `${e.clientY - offsetY}px`;
      };

      onMouseUp = () => isDragging = false;

      counterEl.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      // ─── Reset button — inline two-step confirm ───────────────────────
      onResetClick = () => {
        const btn = document.getElementById('qc-reset');
        if (btn.dataset.confirming) {
          queryCount = 0;
          GM_setValue('queryCount', 0);
          document.getElementById('qc-count').textContent = 0;
          btn.textContent = 'Reset';
          delete btn.dataset.confirming;
        } else {
          btn.dataset.confirming = 'true';
          btn.textContent = 'Confirm?';
          setTimeout(() => {
            if (btn.dataset.confirming) {
              btn.textContent = 'Reset';
              delete btn.dataset.confirming;
            }
          }, 3000);
        }
      };
      document.getElementById('qc-reset').addEventListener('click', onResetClick);

      // ─── MutationObserver: watch for Submit button ─────────────────────
      // FIX: Only increment counter when ALL fields are filled
      observer = new MutationObserver(() => {
        const submitButtons = document.querySelectorAll('button');
        submitButtons.forEach((btn) => {
          if (
            btn.innerText.trim().toLowerCase() === 'submit' &&
            !btn.dataset.qcListening
          ) {
            btn.dataset.qcListening = 'true';
            btn.addEventListener('click', () => {
              // Wait briefly for React/form state to settle, then validate
              setTimeout(() => {
                if (areAllFieldsFilled(btn)) {
                  updateCount();
                } else {
                  console.log('[Query Counter] Submit clicked but not all fields are filled — skipping count.');
                }
              }, 500);
            });
          }
        });
      });

      observer.observe(document.body, { childList: true, subtree: true });

      console.info('[Query Counter] module initialized');
    }

    // ─── Flash animation on count increment ────────────────────────────
    function updateCount() {
      queryCount++;
      GM_setValue('queryCount', queryCount);
      const countEl = document.getElementById('qc-count');
      if (!countEl) return;
      countEl.textContent = queryCount;
      countEl.style.color = '#FF9900';
      countEl.style.transition = 'transform 0.2s ease';
      countEl.style.transform = 'scale(1.4)';
      setTimeout(() => countEl.style.transform = 'scale(1)', 300);
    }

    function destroy() {
      if (!initialized) return;
      initialized = false;

      if (observer) { observer.disconnect(); observer = null; }
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
  })(); // ── end QueryCounterModule factory ──

  /* ═════════════════════════════════════════════
     ACTIVATION CONTROLLER
  ═════════════════════════════════════════════ */
  let currentlyActive = false;

  function syncActivation() {
    const shouldBeActive = isToolActivated();
    if (shouldBeActive && !currentlyActive) {
      currentlyActive = true;
      HVALibraryModule.init();
      QueryCounterModule.init();
      console.info('[Combined Script] Activated (showDevConsole=true detected)');
    } else if (!shouldBeActive && currentlyActive) {
      currentlyActive = false;
      HVALibraryModule.destroy();
      QueryCounterModule.destroy();
      console.info('[Combined Script] Deactivated (showDevConsole left the URL)');
    }
  }

  // Initial check on page load
  syncActivation();

  // ── Watch for SPA navigation (pushState/replaceState/popstate) ──
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

    window.addEventListener('popstate', () => {
      window.dispatchEvent(new Event('hva-url-changed'));
    });

    window.addEventListener('hva-url-changed', syncActivation);

    setInterval(syncActivation, 1000);
  })();

  console.info('[Combined Script] HVA Library + Query Counter loaded (waiting for activation)');
})();

