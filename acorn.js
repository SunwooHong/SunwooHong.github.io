/*
 * A little squirrel, an acorn, and a round trip.
 * Dependency-free; works on a static site and with local HTML files.
 * Click once to lend the acorn. Click again to have it returned.
 */
(function () {
  'use strict';

  const button = document.getElementById('acorn-toggle');
  const nav = document.querySelector('.nav');
  if (!button || !nav || button.dataset.squirrelReady === 'true') return;
  button.dataset.squirrelReady = 'true';

  const STORAGE_KEY = 'sunwoo.squirrel.acorn.v1';
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let away = false;
  try { away = sessionStorage.getItem(STORAGE_KEY) === 'away'; } catch (_) {}
  let busy = false;
  let activeController = null;
  let direction = 1;
  let position = { x: 0, y: 0 };
  let scale = 88 / 128;
  let spriteWidth = 88;
  let spriteHeight = 71.5;

  const status = document.createElement('span');
  status.className = 'squirrel-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  document.body.appendChild(status);

  // Reuse the actual navigation icon, so the acorn in its paws is identical.
  const sourceIcon = button.querySelector('.acorn-icon');
  const acornDrawing = sourceIcon.innerHTML;
  const stage = document.createElement('div');
  stage.className = 'squirrel-stage';
  stage.hidden = true;
  stage.setAttribute('aria-hidden', 'true');
  stage.innerHTML = `
    <div class="squirrel-actor">
      <div class="squirrel-facing">
        <svg class="squirrel-art" viewBox="0 0 128 104" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="64" cy="99" rx="28" ry="2.4" fill="var(--sq-outline)" opacity=".09"/>
          <g class="sq-tail sq-outline">
            <path d="M51 79C33 86 11 77 8 59 5 43 18 34 22 26 28 16 22 9 16 12 12 14 12 19 15 22 4 21 3 11 10 6 22-4 42 9 45 26 49 44 31 51 32 63 33 70 41 72 51 71Z" fill="var(--sq-tail)"/>
            <path d="M42 76C24 75 18 65 20 55 23 41 39 34 35 21 33 14 27 10 22 11" stroke="var(--sq-tail-light)" stroke-width="5"/>
            <path d="M13 54c-1 8 3 14 8 17M34 33c-2 7-8 10-11 17" stroke="var(--sq-outline)" stroke-width="1.1" opacity=".35"/>
          </g>
          <g class="sq-hind-far sq-outline" fill="var(--sq-fur-shade)">
            <path d="M52 78c-3 6-10 11-12 15h-8c-3 0-4 4 0 4h15l14-14Z"/>
          </g>
          <g class="sq-front-far sq-outline" fill="var(--sq-fur-shade)">
            <path d="M78 73l-5 19h-6c-3 0-4 4 0 4h13l7-20Z"/>
          </g>
          <path class="sq-outline" d="M43 76c-1-11 5-21 16-23 9-1 19 3 24 12 5 8 5 18-2 24-8 7-28 7-36-1-3-3-4-7-2-12Z" fill="var(--sq-fur)"/>
          <path d="M75 59c13 6 18 23 8 30-5 4-10 4-13 1 5-10 5-19 0-27Z" fill="var(--sq-belly)"/>
          <g class="sq-hind-near sq-outline" fill="var(--sq-fur)">
            <path d="M48 75c-8 3-8 15 1 18l-4 1h-5c-4 0-4 4 0 4h18c5 0 7-3 5-6l-5-6"/>
            <path d="M48 96h3m3 0h3" stroke-width="1.1"/>
          </g>
          <g class="sq-front-near sq-outline" fill="var(--sq-fur)">
            <path d="M78 75c0 7 4 13 8 17l9 1c4 0 4 5 0 5H83c-6-5-11-11-13-18"/>
            <path d="M90 96h2m-6 0h1" stroke-width="1.1"/>
          </g>
          <g class="sq-head">
            <path class="sq-outline" d="M72 37c-4-7-4-17 0-21 6 2 10 9 10 16" fill="var(--sq-fur-shade)"/>
            <path class="sq-outline" d="M82 34c0-9 4-18 9-19 5 6 4 16 0 23" fill="var(--sq-fur)"/>
            <path d="M86 32c0-5 2-10 4-12 2 4 1 8 0 12" fill="var(--sq-ear)"/>
            <path class="sq-outline" d="M72 38c6-8 19-9 25-1 4 4 4 8 6 10l9 5c2 2 0 6-4 7l-11 2c-4 5-11 6-17 3-11-4-14-15-8-26Z" fill="var(--sq-fur)"/>
            <path d="M94 49c7-1 10 2 16 4 0 5-9 6-13 7-3 3-6 3-9 2" fill="var(--sq-belly)"/>
            <ellipse class="sq-eye" cx="93" cy="43" rx="2.7" ry="3.1" fill="var(--sq-eye)"/>
            <circle cx="93.8" cy="42" r=".85" fill="#fff"/>
            <path d="M107 50c4-1 7 1 5 3-1 2-4 1-5-3Z" fill="var(--sq-eye)"/>
            <path d="M104 56c-2 2-4 2-6 1M105 59l5 1" stroke="var(--sq-outline)" stroke-width="1.2" stroke-linecap="round"/>
            <path d="M73 44l-4 1m5 4-4 2" stroke="var(--sq-fur-shade)" stroke-width="1.3" stroke-linecap="round"/>
          </g>
          <g class="sq-arm sq-outline">
            <path d="M80 63c4 5 10 7 15 7 4 1 4 5 0 6-8 1-16-3-20-8" fill="var(--sq-fur)"/>
            <path d="M93 73h3" stroke-width="1.1"/>
          </g>
          <g class="sq-reach sq-outline">
            <path d="M80 65c7-8 11-21 18-38l2-6c1-3 5-2 5 1l-1 8c-3 16-11 33-18 39" fill="var(--sq-fur)"/>
            <path d="M100 23l3 1" stroke-width="1.1"/>
          </g>
          <g class="sq-carried-acorn">
            <svg class="sq-held-icon" x="88" y="51" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${acornDrawing}</svg>
          </g>
          <g class="sq-holding-paw sq-outline">
            <path d="M79 65c6 3 11 6 17 5 4-1 5 3 2 5-6 4-17 0-22-5" fill="var(--sq-fur)"/>
            <path d="M95 73l3-1" stroke-width="1.1"/>
          </g>
        </svg>
      </div>
    </div>
    <div class="squirrel-transfer" hidden></div>`;
  document.body.appendChild(stage);

  const actor = stage.querySelector('.squirrel-actor');
  const facing = stage.querySelector('.squirrel-facing');
  const transfer = stage.querySelector('.squirrel-transfer');
  const heldIcon = stage.querySelector('.sq-held-icon');
  const flyingIcon = sourceIcon.cloneNode(true);
  flyingIcon.removeAttribute('class');
  transfer.appendChild(flyingIcon);

  function syncButton() {
    button.dataset.acorn = away ? 'away' : 'home';
    button.setAttribute('aria-pressed', String(away));
    button.setAttribute('aria-busy', String(busy));
    button.setAttribute('aria-disabled', String(busy));
    button.classList.toggle('is-busy', busy);
    button.title = busy ? 'The squirrel is on its way…' :
      (away ? 'Ask the squirrel to bring the acorn back' : 'Let the squirrel take the acorn');
  }

  function setAway(next) {
    away = next;
    // Per-tab state: navigation between these pages keeps the same acorn.
    try { sessionStorage.setItem(STORAGE_KEY, away ? 'away' : 'home'); } catch (_) {}
    syncButton();
  }

  function abortError() {
    const error = new Error('Squirrel animation cancelled');
    error.name = 'AbortError';
    return error;
  }

  function checkSignal(signal) {
    if (signal.aborted) throw abortError();
  }

  // No requestAnimationFrame loop is running while the feature is idle.
  function animate(duration, update, signal) {
    return new Promise(function (resolve, reject) {
      if (signal.aborted) { reject(abortError()); return; }
      const started = performance.now();
      let frame = 0;
      function cancel() {
        cancelAnimationFrame(frame);
        signal.removeEventListener('abort', cancel);
        reject(abortError());
      }
      function tick(now) {
        const t = Math.min(1, Math.max(0, (now - started) / duration));
        try { update(t); } catch (error) {
          signal.removeEventListener('abort', cancel);
          reject(error);
          return;
        }
        if (t < 1) frame = requestAnimationFrame(tick);
        else { signal.removeEventListener('abort', cancel); resolve(); }
      }
      signal.addEventListener('abort', cancel, { once: true });
      frame = requestAnimationFrame(tick);
    });
  }

  function pause(duration, signal) {
    return new Promise(function (resolve, reject) {
      if (signal.aborted) { reject(abortError()); return; }
      const timer = setTimeout(function () {
        signal.removeEventListener('abort', cancel);
        resolve();
      }, duration);
      function cancel() {
        clearTimeout(timer);
        signal.removeEventListener('abort', cancel);
        reject(abortError());
      }
      signal.addEventListener('abort', cancel, { once: true });
    });
  }

  function face(next) {
    direction = next < 0 ? -1 : 1;
    facing.style.transform = 'scaleX(' + direction + ')';
  }

  // Coordinates are relative to the viewport; position is the feet's center.
  function place(x, y) {
    position = { x: x, y: y };
    actor.style.transform = 'translate3d(' + (x - spriteWidth / 2).toFixed(2) +
      'px,' + (y - spriteHeight).toFixed(2) + 'px,0)';
  }

  function handPoint(x, y) {
    return {
      x: position.x - spriteWidth / 2 + (direction > 0 ? x : 128 - x) * scale,
      y: position.y - spriteHeight + y * scale
    };
  }

  function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  async function runTo(x, y, duration, leap, signal) {
    checkSignal(signal);
    const start = { x: position.x, y: position.y };
    if (Math.abs(x - start.x) > 1) face(x - start.x);
    actor.classList.add('is-running');
    try {
      await animate(duration, function (t) {
        const e = ease(t);
        const hop = Math.sin(Math.PI * t) * leap;
        const step = Math.abs(Math.sin(t * duration / 66)) * 2 * Math.sin(Math.PI * t);
        place(start.x + (x - start.x) * e, start.y + (y - start.y) * e - hop - step);
      }, signal);
    } finally { actor.classList.remove('is-running'); }
  }

  async function sniff(duration, signal) {
    actor.classList.add('is-sniffing');
    try { await pause(duration, signal); }
    finally { actor.classList.remove('is-sniffing'); }
  }

  function putTransferAt(point, iconSize, angle) {
    transfer.style.transform = 'translate3d(' + (point.x - iconSize / 2).toFixed(2) +
      'px,' + (point.y - iconSize / 2).toFixed(2) + 'px,0) rotate(' + angle + 'deg)';
  }

  async function moveAcorn(from, to, geometry, signal) {
    putTransferAt(from, geometry.iconSize, 0);
    transfer.hidden = false;
    await animate(380, function (t) {
      const e = ease(t);
      putTransferAt({
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e - Math.sin(Math.PI * t) * 7
      }, geometry.iconSize, Math.sin(Math.PI * t) * -12);
    }, signal);
  }

  function measure() {
    const width = document.documentElement.clientWidth;
    const height = window.innerHeight;
    spriteWidth = width <= 700 ? 78 : 88;
    scale = spriteWidth / 128;
    spriteHeight = 104 * scale;
    actor.style.width = spriteWidth + 'px';
    actor.style.height = spriteHeight + 'px';
    const rect = sourceIcon.getBoundingClientRect();
    const target = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const iconSize = rect.width || 19;
    const rawIconSize = iconSize / scale;
    heldIcon.setAttribute('x', 102 - rawIconSize / 2);
    heldIcon.setAttribute('y', 65 - rawIconSize / 2);
    heldIcon.setAttribute('width', rawIconSize);
    heldIcon.setAttribute('height', rawIconSize);
    transfer.style.width = iconSize + 'px';
    transfer.style.height = iconSize + 'px';
    // Its raised paw meets the exact center of the button, not a hardcoded x.
    const dock = { x: target.x - (104 - 64) * scale, y: target.y + (104 - 23) * scale };
    const runway = Math.min(height - 8, nav.getBoundingClientRect().bottom + 44);
    const lowLane = Math.min(height - 8, runway + (width > 700 ? 64 : 23));
    return { width, height, target, iconSize, dock, runway, lowLane };
  }

  async function takeAcorn(g, signal) {
    actor.classList.add('is-reaching');
    await pause(200, signal);
    // The visible object transfers to the squirrel exactly at the handoff.
    putTransferAt(g.target, g.iconSize, 0);
    transfer.hidden = false;
    setAway(true);
    await moveAcorn(g.target, handPoint(102, 65), g, signal);
    actor.classList.remove('is-reaching');
    actor.classList.add('is-carrying');
    transfer.hidden = true;
  }

  async function returnAcorn(g, signal) {
    const hand = handPoint(102, 65);
    putTransferAt(hand, g.iconSize, 0);
    transfer.hidden = false;
    actor.classList.remove('is-carrying');
    actor.classList.add('is-reaching');
    await moveAcorn(hand, g.target, g, signal);
    setAway(false);
    transfer.hidden = true;
    actor.classList.remove('is-reaching');
    button.classList.add('just-returned');
  }

  async function fullVisit(returning, g, signal) {
    actor.classList.toggle('is-carrying', returning);
    if (returning) {
      face(-1);
      place(g.width + spriteWidth, g.lowLane);
      stage.hidden = false;
      await runTo(g.width * .87, g.lowLane, 440, 8, signal);
      await runTo(g.width * .56, g.runway, 650, 18, signal);
      await sniff(210, signal);
      await runTo(g.width * .38, g.runway, 460, 5, signal);
      await sniff(180, signal);
      await runTo(g.dock.x, g.dock.y, 770, 12, signal);
    } else {
      face(1);
      place(-spriteWidth, g.lowLane);
      stage.hidden = false;
      await runTo(g.width * .14, g.lowLane, 430, 8, signal);
      await runTo(g.width * .23, g.runway, 460, 20, signal);
      await runTo(g.width * .43, g.runway, 560, 5, signal);
      await sniff(240, signal);
      await runTo(g.width * .31, g.runway, 330, 5, signal);
      await sniff(150, signal);
      await runTo(g.dock.x - 36, g.runway, 590, 8, signal);
      await runTo(g.dock.x, g.dock.y, 300, 6, signal);
    }
    face(1);
    await sniff(130, signal);
    if (returning) await returnAcorn(g, signal);
    else await takeAcorn(g, signal);
    await pause(180, signal);
    // Leave the viewport completely; the overlay is removed from rendering.
    if (returning) await runTo(-spriteWidth, g.runway, 1000, 19, signal);
    else await runTo(g.width + spriteWidth, g.runway, 920, 18, signal);
  }

  async function quietVisit(returning, g, signal) {
    // Respect reduced-motion preferences: a stationary visitor, no running.
    face(1);
    place(g.dock.x, g.dock.y);
    actor.classList.add('is-reaching');
    actor.classList.toggle('is-carrying', returning);
    stage.hidden = false;
    await pause(140, signal);
    setAway(!returning);
    actor.classList.toggle('is-carrying', !returning);
    await pause(180, signal);
  }

  async function visit() {
    if (busy) return; // Repeated clicks never spawn overlapping squirrels.
    busy = true;
    const returning = away;
    const controller = new AbortController();
    activeController = controller;
    button.classList.remove('just-returned');
    syncButton();
    status.textContent = '';
    let interrupted = false;
    try {
      const geometry = measure();
      if (motionPreference.matches) await quietVisit(returning, geometry, controller.signal);
      else await fullVisit(returning, geometry, controller.signal);
    } catch (error) {
      interrupted = true;
      if (error.name !== 'AbortError') console.error('Squirrel animation:', error);
    } finally {
      stage.hidden = true;
      transfer.hidden = true;
      actor.classList.remove('is-running', 'is-reaching', 'is-sniffing', 'is-carrying');
      button.classList.remove('just-returned');
      if (activeController === controller) activeController = null;
      busy = false;
      syncButton();
      status.textContent = interrupted
        ? (away ? 'The acorn is away. Press again to bring it back.' : 'The acorn is here. Press again to call the squirrel.')
        : (away ? 'The squirrel took the acorn. Press again to bring it back.' : 'The squirrel returned the acorn.');
    }
  }

  function cancelVisit() { if (activeController) activeController.abort(); }
  button.addEventListener('click', visit);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && busy) cancelVisit();
  });
  window.addEventListener('resize', cancelVisit, { passive: true });
  window.addEventListener('pagehide', cancelVisit);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) cancelVisit();
  });
  if (motionPreference.addEventListener) motionPreference.addEventListener('change', cancelVisit);
  else if (motionPreference.addListener) motionPreference.addListener(cancelVisit);
  // Re-sync after the browser restores a document from its back/forward cache.
  window.addEventListener('pageshow', function () {
    if (!busy) {
      try { away = sessionStorage.getItem(STORAGE_KEY) === 'away'; } catch (_) {}
      syncButton();
    }
  });
  syncButton();
  button.hidden = false;
})();
