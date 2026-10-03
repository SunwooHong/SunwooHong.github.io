/*
 * Deluxe secret-door squirrel for the top navigation.
 * Click the acorn once: the squirrel sneaks out and steals it.
 * Click again: it sneaks back and politely returns it.
 * Bonus: drag the acorn and the squirrel will chase it.
 */
(function () {
  'use strict';

  const button = document.getElementById('acorn-toggle');
  const nav = document.querySelector('.nav');
  const mark = document.querySelector('.mark');
  if (!button || !nav || !mark || button.dataset.squirrelReady === 'true') return;
  button.dataset.squirrelReady = 'true';

  const STORAGE_KEY = 'sunwoo.squirrel.deluxe.v3';
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let away = false;
  try { away = sessionStorage.getItem(STORAGE_KEY) === 'away'; } catch (_) {}

  let busy = false;
  let activeController = null;
  let direction = 1;
  let position = { x: 0, y: 0 };
  let mouse = { x: -10000, y: -10000 };
  let scale = 88 / 128;
  let spriteWidth = 88;
  let spriteHeight = 71.5;
  let suppressNextClick = false;
  let transferKind = 'acorn';
  let pointerState = null;

  const status = document.createElement('span');
  status.className = 'squirrel-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  document.body.appendChild(status);

  const sourceIcon = button.querySelector('.acorn-icon');
  const acornDrawing = sourceIcon.innerHTML;
  const stage = document.createElement('div');
  stage.className = 'squirrel-stage';
  stage.hidden = true;
  stage.setAttribute('aria-hidden', 'true');
  stage.innerHTML = `
    <div class="squirrel-burrow" hidden>
      <div class="burrow-shadow"></div>
      <div class="burrow-hole"></div>
      <div class="burrow-door"><span class="burrow-knob"></span></div>
    </div>
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
            <svg class="sq-held-icon sq-held-acorn" x="88" y="51" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${acornDrawing}</svg>
          </g>
          <g class="sq-holding-paw sq-outline">
            <path d="M79 65c6 3 11 6 17 5 4-1 5 3 2 5-6 4-17 0-22-5" fill="var(--sq-fur)"/>
            <path d="M95 73l3-1" stroke-width="1.1"/>
          </g>
          <g class="sq-lantern">
            <ellipse class="sq-lantern-glow" cx="89" cy="70" rx="17" ry="14" fill="#F5D78A" opacity=".30"/>
            <path d="M85 60h8M86.5 60v-3a2.5 2.5 0 0 1 5 0v3" stroke="#E7C16D" stroke-width="1.4" stroke-linecap="round"/>
            <rect x="84" y="60" width="11" height="14" rx="3" fill="#6A513A" stroke="#E7C16D" stroke-width="1.3"/>
            <rect x="86.4" y="63" width="6.2" height="6.7" rx="2" fill="#F6D685" opacity=".95"/>
            <path d="M89.5 71.5v4.5" stroke="#E7C16D" stroke-width="1.3" stroke-linecap="round"/>
          </g>
        </svg>
      </div>
    </div>
    <div class="squirrel-transfer" hidden></div>`;
  document.body.appendChild(stage);

  const actor = stage.querySelector('.squirrel-actor');
  const facing = stage.querySelector('.squirrel-facing');
  const transfer = stage.querySelector('.squirrel-transfer');
  const burrow = stage.querySelector('.squirrel-burrow');
  const heldIcon = stage.querySelector('.sq-held-acorn');

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function acornSvg() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${acornDrawing}</svg>`;
  }
  function pebbleSvg() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"><path d="M6.2 14.2c0-4.8 3.5-8.5 7.8-8.5 3.6 0 5.8 2.4 5.8 5.6 0 4.4-3.7 7.7-8.5 7.7-3.2 0-5.1-1.8-5.1-4.8Z" fill="currentColor" fill-opacity=".18"/><path d="M6.2 14.2c0-4.8 3.5-8.5 7.8-8.5 3.6 0 5.8 2.4 5.8 5.6 0 4.4-3.7 7.7-8.5 7.7-3.2 0-5.1-1.8-5.1-4.8Z"/></svg>`;
  }
  function leafSvg() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"><path d="M18.8 5.4c-6 .1-10.2 2.1-12.2 6.1-2 4 .2 7.7 4.9 8.4 5 .8 8.8-2.2 9.4-8.2.2-2.2-.2-4.3-2.1-6.3Z" fill="currentColor" fill-opacity=".16"/><path d="M7.8 16.6c3.3-2.4 5.7-5 8.8-9.1M12.1 11.2c1.7.1 2.9.8 4.2 1.8M10.2 13.7c1.2.1 2.1.5 3.1 1.2"/></svg>`;
  }

  function setTransferKind(kind) {
    transferKind = kind;
    transfer.innerHTML = kind === 'acorn' ? acornSvg() : (kind === 'pebble' ? pebbleSvg() : leafSvg());
  }
  setTransferKind('acorn');

  function syncButton() {
    button.dataset.acorn = away ? 'away' : 'home';
    button.setAttribute('aria-pressed', String(away));
    button.setAttribute('aria-busy', String(busy));
    button.classList.toggle('is-busy', busy);
    button.title = busy
      ? 'Psst… the squirrel is sneaking about.'
      : (away ? 'Knock to have the squirrel bring the acorn back.' : 'Knock, or drag the acorn for the squirrel to chase it.');
  }

  function setAway(next) {
    away = next;
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

  function place(x, y) {
    position = { x: x, y: y };
    actor.style.transform = 'translate3d(' + (x - spriteWidth / 2).toFixed(2) + 'px,' + (y - spriteHeight).toFixed(2) + 'px,0)';
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
    } finally {
      actor.classList.remove('is-running');
    }
  }

  async function sniff(duration, signal) {
    actor.classList.add('is-sniffing');
    try { await pause(duration, signal); }
    finally { actor.classList.remove('is-sniffing'); }
  }

  async function alertPause(duration, signal) {
    actor.classList.add('is-alert');
    try { await pause(duration, signal); }
    finally { actor.classList.remove('is-alert'); }
  }

  function putTransferAt(point, iconSize, angle) {
    transfer.style.transform = 'translate3d(' + (point.x - iconSize / 2).toFixed(2) + 'px,' + (point.y - iconSize / 2).toFixed(2) + 'px,0) rotate(' + angle + 'deg)';
  }

  async function moveTransfer(from, to, geometry, signal, arc) {
    const lift = typeof arc === 'number' ? arc : 7;
    putTransferAt(from, geometry.iconSize, 0);
    transfer.hidden = false;
    await animate(380, function (t) {
      const e = ease(t);
      putTransferAt({
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e - Math.sin(Math.PI * t) * lift
      }, geometry.iconSize, Math.sin(Math.PI * t) * -12);
    }, signal);
  }

  function setBurrowAt(g) {
    burrow.style.transform = 'translate3d(' + (g.door.x - g.doorWidth / 2).toFixed(2) + 'px,' + (g.door.y - g.doorHeight / 2).toFixed(2) + 'px,0)';
  }
  function openBurrow() {
    burrow.hidden = false;
    burrow.classList.add('is-open');
  }
  function closeBurrow() {
    burrow.classList.remove('is-open');
  }

  function measure() {
    const width = document.documentElement.clientWidth;
    const height = window.innerHeight;
    spriteWidth = width <= 700 ? 78 : 88;
    scale = spriteWidth / 128;
    spriteHeight = 104 * scale;
    actor.style.width = spriteWidth + 'px';
    actor.style.height = spriteHeight + 'px';

    const navRect = nav.getBoundingClientRect();
    const markRect = mark.getBoundingClientRect();
    const rect = sourceIcon.getBoundingClientRect();
    const buttonTarget = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const iconSize = rect.width || 19;
    const rawIconSize = iconSize / scale;
    heldIcon.setAttribute('x', 102 - rawIconSize / 2);
    heldIcon.setAttribute('y', 65 - rawIconSize / 2);
    heldIcon.setAttribute('width', rawIconSize);
    heldIcon.setAttribute('height', rawIconSize);
    transfer.style.width = iconSize + 'px';
    transfer.style.height = iconSize + 'px';

    const dock = { x: buttonTarget.x - (104 - 64) * scale, y: buttonTarget.y + (104 - 23) * scale };
    const runway = Math.min(height - 8, navRect.bottom + (width > 700 ? 34 : 28));
    const lane = Math.min(height - 8, runway + (width > 700 ? 10 : 6));
    const door = {
      x: Math.max(28, markRect.left + markRect.width * 0.84),
      y: Math.min(height - 20, navRect.bottom - 2)
    };
    const doorWidth = width <= 700 ? 42 : 48;
    const doorHeight = width <= 700 ? 28 : 32;
    return { width, height, buttonTarget, iconSize, dock, runway, lane, door, doorWidth, doorHeight, navRect };
  }

  function clampPoint(pt, g) {
    const marginX = 24;
    const minY = g.navRect.bottom + 8;
    const maxY = Math.min(g.height - 26, g.navRect.bottom + (g.width > 700 ? 120 : 90));
    return {
      x: Math.max(marginX, Math.min(g.width - marginX, pt.x)),
      y: Math.max(minY, Math.min(maxY, pt.y))
    };
  }

  async function maybeFreezeIfWatched(point, g, signal) {
    const nearTarget = Math.hypot(mouse.x - point.x, mouse.y - point.y) < (g.width <= 700 ? 86 : 104);
    const nearSelf = Math.hypot(mouse.x - position.x, mouse.y - (position.y - spriteHeight * 0.56)) < (g.width <= 700 ? 82 : 98);
    if (nearTarget || nearSelf) {
      await alertPause(420, signal);
    }
  }

  async function popOut(g, returning, signal) {
    setBurrowAt(g);
    stage.hidden = false;
    openBurrow();
    actor.classList.toggle('is-carrying', returning);
    actor.classList.toggle('is-lantern', isDark());
    face(1);
    place(g.door.x - 4, g.runway + 30);
    actor.classList.add('is-peeking');
    await animate(320, function (t) {
      const e = ease(t);
      place(g.door.x - 4, g.runway + 30 - 24 * e);
    }, signal);
    actor.classList.remove('is-peeking');
    await sniff(180, signal);
    await maybeFreezeIfWatched(g.buttonTarget, g, signal);
  }

  async function tuckIntoBurrow(g, signal) {
    face(-1);
    await runTo(g.door.x + 6, g.runway + 2, 220, 4, signal);
    actor.classList.add('is-peeking');
    await animate(280, function (t) {
      const e = ease(t);
      place(g.door.x - 4, g.runway + 2 + 26 * e);
    }, signal);
    actor.classList.remove('is-peeking');
    closeBurrow();
    await pause(170, signal);
    burrow.hidden = true;
  }

  async function takeAcornFrom(point, g, signal) {
    actor.classList.add('is-reaching');
    await pause(190, signal);
    setTransferKind('acorn');
    putTransferAt(point, g.iconSize, 0);
    transfer.hidden = false;
    button.classList.remove('is-drag-lifted');
    setAway(true);
    await moveTransfer(point, handPoint(102, 65), g, signal);
    actor.classList.remove('is-reaching');
    actor.classList.add('is-carrying');
    transfer.hidden = true;
  }

  async function returnAcorn(g, signal) {
    const hand = handPoint(102, 65);
    setTransferKind('acorn');
    putTransferAt(hand, g.iconSize, 0);
    transfer.hidden = false;
    actor.classList.remove('is-carrying');
    actor.classList.add('is-reaching');
    await moveTransfer(hand, g.buttonTarget, g, signal);
    setAway(false);
    transfer.hidden = true;
    actor.classList.remove('is-reaching');
    button.classList.add('just-returned');
  }

  async function wrongDeliveryGag(g, signal) {
    const hand = handPoint(102, 65);
    actor.classList.remove('is-carrying');
    actor.classList.add('is-reaching');
    setTransferKind(Math.random() < 0.5 ? 'pebble' : 'leaf');
    await moveTransfer(hand, g.buttonTarget, g, signal, 4);
    await pause(180, signal);
    await alertPause(280, signal);
    await moveTransfer(g.buttonTarget, hand, g, signal, 4);
    transfer.hidden = true;
    actor.classList.remove('is-reaching');
    actor.classList.add('is-carrying');
    await runTo(g.door.x + 26, g.runway, 260, 5, signal);
    await runTo(g.dock.x, g.dock.y, 260, 5, signal);
  }

  async function fullVisit(returning, g, signal) {
    await popOut(g, returning, signal);
    if (returning) {
      await runTo(g.width * 0.26, g.runway, 440, 10, signal);
      await sniff(160, signal);
      await runTo(g.dock.x - 42, g.runway, 680, 7, signal);
      await maybeFreezeIfWatched(g.buttonTarget, g, signal);
      await runTo(g.dock.x, g.dock.y, 300, 5, signal);
      await sniff(120, signal);
      const doGag = Math.random() < 0.14;
      if (doGag) await wrongDeliveryGag(g, signal);
      await returnAcorn(g, signal);
      actor.classList.toggle('is-lantern', isDark());
      await pause(130, signal);
      await runTo(g.width * 0.22, g.runway, 720, 12, signal);
      await tuckIntoBurrow(g, signal);
    } else {
      await runTo(g.width * 0.24, g.runway, 460, 10, signal);
      await sniff(140, signal);
      await runTo(g.dock.x - 42, g.runway, 680, 7, signal);
      await maybeFreezeIfWatched(g.buttonTarget, g, signal);
      await runTo(g.dock.x, g.dock.y, 300, 5, signal);
      await sniff(120, signal);
      await takeAcornFrom(g.buttonTarget, g, signal);
      actor.classList.remove('is-lantern');
      await pause(130, signal);
      await runTo(g.width * 0.22, g.runway, 720, 12, signal);
      await tuckIntoBurrow(g, signal);
    }
  }

  async function dragVisit(dropPoint, g, signal) {
    await popOut(g, false, signal);
    await runTo(dropPoint.x - 30, g.runway, 440, 10, signal);
    await maybeFreezeIfWatched(dropPoint, g, signal);
    await runTo(dropPoint.x, dropPoint.y + (104 - 23) * scale, 380, 7, signal);
    await sniff(110, signal);
    await takeAcornFrom(dropPoint, g, signal);
    actor.classList.remove('is-lantern');
    await pause(120, signal);
    await runTo(g.width * 0.22, g.runway, 760, 12, signal);
    await tuckIntoBurrow(g, signal);
  }

  async function quietVisit(returning, g, signal) {
    stage.hidden = false;
    setBurrowAt(g);
    openBurrow();
    face(1);
    place(g.dock.x, g.dock.y);
    actor.classList.add('is-reaching');
    actor.classList.toggle('is-carrying', returning);
    await pause(120, signal);
    setAway(!returning);
    actor.classList.toggle('is-carrying', !returning);
    await pause(120, signal);
    actor.classList.remove('is-reaching');
    closeBurrow();
  }

  async function quietDrag(dropPoint, g, signal) {
    stage.hidden = false;
    setBurrowAt(g);
    openBurrow();
    face(1);
    place(dropPoint.x, dropPoint.y + (104 - 23) * scale);
    actor.classList.add('is-reaching');
    await pause(120, signal);
    button.classList.remove('is-drag-lifted');
    setAway(true);
    actor.classList.add('is-carrying');
    await pause(120, signal);
    actor.classList.remove('is-reaching');
    closeBurrow();
  }

  async function runScenario(mode, payload) {
    if (busy) return;
    busy = true;
    const controller = new AbortController();
    activeController = controller;
    button.classList.remove('just-returned');
    syncButton();
    status.textContent = '';
    let interrupted = false;
    try {
      const geometry = measure();
      if (mode === 'return') {
        if (motionPreference.matches) await quietVisit(true, geometry, controller.signal);
        else await fullVisit(true, geometry, controller.signal);
      } else if (mode === 'take') {
        if (motionPreference.matches) await quietVisit(false, geometry, controller.signal);
        else await fullVisit(false, geometry, controller.signal);
      } else if (mode === 'drag') {
        const dropPoint = clampPoint(payload.point, geometry);
        setTransferKind('acorn');
        putTransferAt(dropPoint, geometry.iconSize, 0);
        transfer.hidden = false;
        if (motionPreference.matches) await quietDrag(dropPoint, geometry, controller.signal);
        else await dragVisit(dropPoint, geometry, controller.signal);
      }
    } catch (error) {
      interrupted = true;
      if (error.name !== 'AbortError') console.error('Squirrel animation:', error);
    } finally {
      stage.hidden = true;
      burrow.hidden = true;
      transfer.hidden = true;
      button.classList.remove('is-drag-lifted');
      actor.classList.remove('is-running', 'is-reaching', 'is-sniffing', 'is-carrying', 'is-alert', 'is-peeking', 'is-lantern');
      button.classList.remove('just-returned');
      if (activeController === controller) activeController = null;
      busy = false;
      syncButton();
      status.textContent = interrupted
        ? (away ? 'The squirrel still has the acorn. Press again to ask for it back.' : 'The acorn is at home. Click or drag it again whenever you like.')
        : (away ? 'The squirrel quietly borrowed the acorn.' : 'The squirrel returned the acorn and slipped back inside.');
    }
  }

  function handleClick() {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    if (busy) return;
    runScenario(away ? 'return' : 'take', null);
  }

  function cancelVisit() {
    if (activeController) activeController.abort();
    if (pointerState && pointerState.cleanup) pointerState.cleanup();
  }

  function startPointerDrag(event) {
    if (busy || away) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const start = { x: event.clientX, y: event.clientY };
    let dragging = false;

    function move(ev) {
      mouse.x = ev.clientX;
      mouse.y = ev.clientY;
      if (!dragging) {
        const dist = Math.hypot(ev.clientX - start.x, ev.clientY - start.y);
        if (dist < 7) return;
        dragging = true;
        suppressNextClick = true;
        button.classList.add('is-drag-lifted');
        stage.hidden = false;
        const g = measure();
        const point = clampPoint({ x: ev.clientX, y: ev.clientY }, g);
        setTransferKind('acorn');
        putTransferAt(point, g.iconSize, 0);
        transfer.hidden = false;
      }
      if (dragging) {
        const g = measure();
        const point = clampPoint({ x: ev.clientX, y: ev.clientY }, g);
        putTransferAt(point, g.iconSize, Math.sin(ev.clientX / 18) * 8);
      }
    }

    function cleanup() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      if (button.hasPointerCapture && button.hasPointerCapture(event.pointerId)) {
        try { button.releasePointerCapture(event.pointerId); } catch (_) {}
      }
      pointerState = null;
    }

    function cancel() {
      button.classList.remove('is-drag-lifted');
      stage.hidden = true;
      transfer.hidden = true;
      cleanup();
    }

    function up(ev) {
      if (!dragging) {
        cleanup();
        return;
      }
      const g = measure();
      const point = clampPoint({ x: ev.clientX, y: ev.clientY }, g);
      cleanup();
      runScenario('drag', { point: point });
    }

    pointerState = { cleanup };
    if (button.setPointerCapture) {
      try { button.setPointerCapture(event.pointerId); } catch (_) {}
    }
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    window.addEventListener('pointercancel', cancel, { passive: true });
  }

  button.addEventListener('click', handleClick);
  button.addEventListener('pointerdown', startPointerDrag);
  document.addEventListener('mousemove', function (event) {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  }, { passive: true });
  document.addEventListener('mouseleave', function () {
    mouse.x = -10000;
    mouse.y = -10000;
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && (busy || pointerState)) cancelVisit();
  });
  window.addEventListener('resize', cancelVisit, { passive: true });
  window.addEventListener('pagehide', cancelVisit);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) cancelVisit();
  });
  if (motionPreference.addEventListener) motionPreference.addEventListener('change', cancelVisit);
  else if (motionPreference.addListener) motionPreference.addListener(cancelVisit);
  window.addEventListener('pageshow', function () {
    if (!busy) {
      try { away = sessionStorage.getItem(STORAGE_KEY) === 'away'; } catch (_) {}
      syncButton();
    }
  });

  syncButton();
  button.hidden = false;
})();
