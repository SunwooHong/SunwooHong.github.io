/*
 * A little squirrel, an acorn, and a round trip.
 * Dependency-free; works on a static site and with local HTML files.
 * Click the acorn once to lend it, again to have it returned.
 * Click the squirrel itself while it is out and it hands you a hint.
 */
(function () {
  'use strict';

  const button = document.getElementById('acorn-toggle');
  const nav = document.querySelector('.nav');
  if (!button || !nav || button.dataset.squirrelReady === 'true') return;
  button.dataset.squirrelReady = 'true';

  const STORAGE_KEY = 'sunwoo.squirrel.acorn.v1';   // sessionStorage: where the acorn is
  const TRIPS_KEY = 'sunwoo.squirrel.trips.v1';     // localStorage: finished round trips
  const TRIPS_AT_KEY = 'sunwoo.squirrel.trips-at.v1'; // localStorage: when the last one finished
  const OAK_LIFETIME = 60 * 60 * 1000;               // a grown oak disappears an hour later
  const OAK_SEEN_KEY = 'sunwoo.squirrel.oak.v1';    // localStorage: last oak stage shown growing
  const FOUND_KEY = 'sunwoo.squirrel.found.v1';     // localStorage: easter eggs already found
  const HINTS_KEY = 'sunwoo.squirrel.hints.v1';     // localStorage: hints already handed out
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

  function readStore(kind, key) {
    try { return window[kind].getItem(key); } catch (_) { return null; }
  }
  function writeStore(kind, key, value) {
    try { window[kind].setItem(key, value); } catch (_) {}
  }

  // Seasonal and late-night moods. ?squirrel=winter,night forces them for testing.
  const forced = (new URLSearchParams(window.location.search).get('squirrel') || '').split(',');
  const now = new Date();
  const isWinter = forced.indexOf('winter') >= 0 || [11, 0, 1].indexOf(now.getMonth()) >= 0;
  const isNight = forced.indexOf('night') >= 0 || now.getHours() >= 23 || now.getHours() < 5;

  let away = readStore('sessionStorage', STORAGE_KEY) === 'away';
  let busy = false;
  let kind = '';
  let activeController = null;
  let direction = 1;
  let position = { x: 0, y: 0 };
  let tempo = 1;
  let frozen = false;
  let impatience = 0;
  let startleTimer = 0;
  let scale = 88 / 128;
  let spriteWidth = 88;
  let spriteHeight = 71.5;

  const status = document.createElement('span');
  status.className = 'squirrel-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  document.body.appendChild(status);

  // The navigation icon's own drawing, so every acorn on screen is the same acorn.
  const sourceIcon = button.querySelector('.acorn-icon');
  const acornDrawing = sourceIcon.innerHTML;
  // The same outline, coloured in, for the illustrated scenes.
  const NUT_BODY = '<path class="sq-nut-body" transform="rotate(14 12 12)" d="M6.8 10.4c.2 4.6 1.8 7.4 5.2 9.6 3.4-2.2 5-5 5.2-9.6Z"/>';
  const NUT_CAP = '<path class="sq-nut-cap" transform="rotate(14 12 12)" d="M5.5 10.4c.2-3.1 2.5-5 6.5-5s6.3 1.9 6.5 5H5.5Z"/>';
  const nutSvg = function (cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      NUT_BODY + NUT_CAP + acornDrawing + '</svg>';
  };
  const held = '<svg class="sq-held-icon" x="88" y="51" width="28" height="28" viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" ' +
    'stroke-linejoin="round">' + NUT_BODY + NUT_CAP + acornDrawing + '</svg>';

  // Three slightly different wobbles. Cycling them while the squirrel moves gives
  // the "boiling" line of hand-drawn animation; at rest it keeps the first one.
  const roughness = [3, 11, 23].map(function (seed, i) {
    return '<filter id="sq-rough-' + i + '" x="-8%" y="-14%" width="116%" height="128%" ' +
      'color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".08" ' +
      'numOctaves="2" seed="' + seed + '"/><feDisplacementMap in="SourceGraphic" scale="2.1" ' +
      'xChannelSelector="R" yChannelSelector="G"/></filter>';
  }).join('');

  const stage = document.createElement('div');
  stage.className = 'squirrel-stage';
  stage.hidden = true;
  // The drawing below is pre-generated: pencil outline, colour laid a little off
  // the line, colour-pencil texture and a few hatched shadows.
  stage.innerHTML = `
  <button type="button" class="squirrel-actor" aria-label="The squirrel. Click it for a hint.">
    <span class="squirrel-facing">
      <svg class="squirrel-art" viewBox="0 0 128 104" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>${roughness}</defs>
      <g class="sq-figure" filter="url(#sq-rough-0)">
      <defs><clipPath id="sq-clip-tail"><path d="M52 90C38 96 15 92 9.5 73C5 58 10 45 17 36C23 28 23 17 30 10C37 3 52 1.6 59.6 9C66 16 64.4 29 55.4 32.4C49 35 43 38 39 46C34.6 55.6 35.6 67 45 73C49 75.6 52 78 54 82Z"/></clipPath><clipPath id="sq-clip-body"><path d="M76 54C64 52 50 58 46 72C42 84 46 94 58 97C68 99 80 98 86 92C92 85 92 70 86 61C83 57 80 55 76 54Z"/></clipPath><clipPath id="sq-clip-hindfar"><path d="M52 95C48.6 94.6 44.6 94.8 42.4 95.6C40.2 96.4 40.4 99 43 99.2H53Z"/></clipPath><clipPath id="sq-clip-frontfar"><path d="M84.4 85.6C85 89.4 86.4 92 88.4 93C92.2 93.2 95 94.2 94.8 96C94.6 97.2 93 97.6 90.8 97.6H86.6C84.4 97.6 83 96.2 82.6 93.8C82.2 91.2 82.4 88.4 83 85.8Z"/></clipPath><clipPath id="sq-clip-earfar"><path d="M73.6 30.2C71.8 24.2 72.4 18.2 75.2 13.6C78.6 16.6 80.4 21.6 80.6 27Z"/></clipPath><clipPath id="sq-clip-head"><path d="M70.4 40.6C70 28.6 79 21.4 89.4 21.4C100 21.4 107.6 27.8 109 36.6C112 38.4 113.4 42.4 111.4 45.6C109 51.6 101.6 56.8 92 57.6C79.6 58.6 70.8 52 70.4 40.6Z"/></clipPath><clipPath id="sq-clip-hind"><path d="M47.6 87C46.4 76.6 53.8 70.4 62 72C69.2 73.6 72 82.6 67.4 89.4L68 93.6C72.4 94.2 74.4 95.4 74 97.2C73.6 98.6 71.8 99 69 99H51.6C48.2 99 46.6 97.6 47.2 95.6C47.6 94.4 48.6 93.6 49.8 93.2C48.6 91.4 47.8 89.4 47.6 87Z"/></clipPath></defs>
      <path class="sq-ground" d="M38 100.6c12-.7 34-.9 54-.1M47 102.4c8-.4 20-.4 30 .1"/>
      <g class="sq-tail"><path class="sq-paper" d="M52 90C38 96 15 92 9.5 73C5 58 10 45 17 36C23 28 23 17 30 10C37 3 52 1.6 59.6 9C66 16 64.4 29 55.4 32.4C49 35 43 38 39 46C34.6 55.6 35.6 67 45 73C49 75.6 52 78 54 82Z"/><path class="sq-wash" transform="translate(1.6 1.4)" d="M52 90C38 96 15 92 9.5 73C5 58 10 45 17 36C23 28 23 17 30 10C37 3 52 1.6 59.6 9C66 16 64.4 29 55.4 32.4C49 35 43 38 39 46C34.6 55.6 35.6 67 45 73C49 75.6 52 78 54 82Z"/><path class="sq-texture" clip-path="url(#sq-clip-tail)" d="M54.4 12.6L62.7 28.2M50.2 8.9L64.9 36.5M46.7 6.3L65.6 41.8M43.3 4L65.9 46.4M40.9 3.4L65.4 49.6M38.4 2.8L65.3 53.3M36.2 2.8L64.8 56.5M33.9 2.4L64.4 59.9M32.1 3.2L63.6 62.4M29.9 3.1L63.4 66.1M28.2 3.8L62.3 67.9M26.4 4.4L61.6 70.8M24.6 5.1L60.6 72.8M22.7 5.7L59.7 75.3M21.2 6.8L58.4 76.9M19.5 7.7L57.3 78.8M18.2 9.3L56.2 80.7M16.4 10L54.8 82.2M15.3 11.9L53.2 83.3M14 13.5L52 85.1M12.4 14.6L50.6 86.5M11.3 16.6L49.1 87.6M10.3 18.8L47.8 89.3M8.9 20.2L45.8 89.6M7.9 22.4L44.6 91.4M6.7 24.1L42.7 91.8M6.3 27.4L40.8 92.3M5.2 29.4L39 92.9M4.7 32.5L36.9 93.1M3.8 34.8L34.7 93M3.3 37.9L32.7 93.2M2.5 40.5L30.4 92.9M2.6 44.7L28.3 93M2 47.8L25.7 92.3M2.6 52.9L22.6 90.5M2.9 57.4L19.2 88.2M4.2 64L15.6 85.3"/><path class="sq-hatch" clip-path="url(#sq-clip-tail)" d="M21.6 69.8L27.8 79.6M18.7 70L26.6 82.6M15.4 69.8L24.5 84.3M12.9 70.6L22 85.1M10.7 72L19.9 86.7M9.5 75L16.4 86M8.3 77.9L13 85.5"/><path class="sq-line" d="M54 82C52 78 49 75.6 45 73C35.6 67 34.6 55.6 39 46C43 38 49 35 55.4 32.4C64.4 29 66 16 59.6 9C52 1.6 37 3 30 10C23 17 23 28 17 36C10 45 5 58 9.5 73C15 92 38 96 51.6 90.4"/><path class="sq-line" d="M55.4 32.4C48.4 35 41.6 30.4 42.8 24C43.8 19 50.4 17.6 52.4 22C53.4 24.6 51.4 27 49.2 26"/><path class="sq-mark" d="M20.4 47.4c-1.6 2.6-2.2 5.4-2 8.2M24.4 49.2c-1.4 2.4-1.8 4.8-1.6 7.4M33 14.6c1.6-1.6 3.6-2.6 5.8-3M33.8 18c1.4-1.2 3-1.9 4.8-2.2M14.4 78.6c1.6 2 3.4 3.2 5.6 3.8"/><path class="sq-ghost" d="M51 91.6C37 97.4 13.6 93 8.2 73.4C3.6 58 9 45 16 35.6M29.2 9.2C36.6 1.8 52.4.4 60.6 8.2"/></g>
      <g class="sq-hind-far"><path class="sq-paper" d="M52 95C48.6 94.6 44.6 94.8 42.4 95.6C40.2 96.4 40.4 99 43 99.2H53Z"/><path class="sq-wash" transform="translate(0.6 0.6)" d="M52 95C48.6 94.6 44.6 94.8 42.4 95.6C40.2 96.4 40.4 99 43 99.2H53Z"/><path class="sq-shade" d="M52 95C48.6 94.6 44.6 94.8 42.4 95.6C40.2 96.4 40.4 99 43 99.2H53Z"/><path class="sq-hatch" clip-path="url(#sq-clip-hindfar)" d="M52.1 95.1L53.7 97.8M49.7 94.5L51.8 97.9M47.8 94.7L50.4 98.9M45.9 94.9L48.4 98.9M44 95L47.1 100M42.2 95.4L44.9 99.7M40.8 96.3L42.4 98.9"/><path class="sq-line" d="M52 95C48.6 94.6 44.6 94.8 42.4 95.6C40.2 96.4 40.4 99 43 99.2H53Z"/></g>
      <g class="sq-front-far"><path class="sq-paper" d="M84.4 85.6C85 89.4 86.4 92 88.4 93C92.2 93.2 95 94.2 94.8 96C94.6 97.2 93 97.6 90.8 97.6H86.6C84.4 97.6 83 96.2 82.6 93.8C82.2 91.2 82.4 88.4 83 85.8Z"/><path class="sq-wash" transform="translate(0.6 0.6)" d="M84.4 85.6C85 89.4 86.4 92 88.4 93C92.2 93.2 95 94.2 94.8 96C94.6 97.2 93 97.6 90.8 97.6H86.6C84.4 97.6 83 96.2 82.6 93.8C82.2 91.2 82.4 88.4 83 85.8Z"/><path class="sq-shade" d="M84.4 85.6C85 89.4 86.4 92 88.4 93C92.2 93.2 95 94.2 94.8 96C94.6 97.2 93 97.6 90.8 97.6H86.6C84.4 97.6 83 96.2 82.6 93.8C82.2 91.2 82.4 88.4 83 85.8Z"/><path class="sq-hatch" clip-path="url(#sq-clip-frontfar)" d="M92.3 93.2L94 96M89.9 92.5L92.9 97.3M88 92.8L91 97.5M86.3 93.2L89.1 97.7M84.7 93.9L87.3 98.1M83.1 94.6L84.6 96.9"/><path class="sq-line" d="M84.4 85.6C85 89.4 86.4 92 88.4 93C92.2 93.2 95 94.2 94.8 96C94.6 97.2 93 97.6 90.8 97.6H86.6C84.4 97.6 83 96.2 82.6 93.8C82.2 91.2 82.4 88.4 83 85.8Z"/></g>
      <g class="sq-body"><path class="sq-paper" d="M76 54C64 52 50 58 46 72C42 84 46 94 58 97C68 99 80 98 86 92C92 85 92 70 86 61C83 57 80 55 76 54Z"/><path class="sq-wash" transform="translate(1.4 1.2)" d="M76 54C64 52 50 58 46 72C42 84 46 94 58 97C68 99 80 98 86 92C92 85 92 70 86 61C83 57 80 55 76 54Z"/><path class="sq-texture" clip-path="url(#sq-clip-body)" d="M86.3 59.1L93.8 73.1M82.9 56.7L93.8 77.3M79.8 54.9L93.5 80.7M77.1 53.9L92.7 83.2M74.8 53.6L91.3 84.6M72.4 53.2L90.4 87.1M70 52.7L89 88.5M67.8 52.6L88.2 91M65.5 52.3L86.3 91.5M63.9 53.4L84.9 92.9M61.7 53.4L83.8 94.8M59.9 53.9L82.1 95.8M58.3 54.9L80.2 96.1M56.1 54.9L78.4 96.9M54.6 56.1L77.1 98.4M52.7 56.6L75 98.5M51.6 58.6L72.9 98.6M50 59.7L71.2 99.4M48.6 61L68.9 99.2M47.3 62.7L66.8 99.2M46.3 64.7L64.7 99.4M44.6 65.7L62.5 99.3M43.8 68.2L60 98.7M43.2 71.1L57.1 97.3M42.6 74.1L54.4 96.1M42.1 77.2L51.1 94.1M43.3 83.3L46.4 89.3"/><path class="sq-belly" d="M86.4 61.6C92 70 92 84.6 86 92C82.6 95 77.6 95.4 75.6 92.6C80.4 84.6 81.4 70.4 79.2 62C81.6 60.4 84.4 60.2 86.4 61.6Z"/><path class="sq-hatch" clip-path="url(#sq-clip-body)" d="M51.6 83.6L56 90.6M48.6 83.6L54.4 93M46.5 85.2L52.3 94.5M45.5 88.4L48.9 94"/><path class="sq-line" d="M77.6 54.6C65 51.6 50 58 46 72C42 84 46 94 58 97C68 99 80 98 86 92C92 85 92 70 86.4 61.4"/><path class="sq-fine sq-faint" d="M79.4 62.4C81.6 70.4 80.6 84.6 75.8 92.4"/><path class="sq-ghost" d="M76.6 52.8C64.4 50.4 49 57 45 71.4"/></g>
      <g class="sq-hind-near"><path class="sq-paper" d="M47.6 87C46.4 76.6 53.8 70.4 62 72C69.2 73.6 72 82.6 67.4 89.4L68 93.6C72.4 94.2 74.4 95.4 74 97.2C73.6 98.6 71.8 99 69 99H51.6C48.2 99 46.6 97.6 47.2 95.6C47.6 94.4 48.6 93.6 49.8 93.2C48.6 91.4 47.8 89.4 47.6 87Z"/><path class="sq-wash" transform="translate(1.2 1)" d="M47.6 87C46.4 76.6 53.8 70.4 62 72C69.2 73.6 72 82.6 67.4 89.4L68 93.6C72.4 94.2 74.4 95.4 74 97.2C73.6 98.6 71.8 99 69 99H51.6C48.2 99 46.6 97.6 47.2 95.6C47.6 94.4 48.6 93.6 49.8 93.2C48.6 91.4 47.8 89.4 47.6 87Z"/><path class="sq-texture" clip-path="url(#sq-clip-hind)" d="M70.4 75.5L75.8 85.8M67.7 74.5L75.4 89M64.9 73.3L74.4 91.1M62.3 72.5L73 92.5M60.4 72.9L72.1 95M58.3 72.9L70.2 95.5M56.2 73.1L68.7 96.7M54 73.1L67.5 98.3M52.5 74.2L65.2 98M50.9 75.2L63.5 98.9M49.6 76.8L61.7 99.6M48.1 78.1L59.5 99.6M46.4 79L57.1 99.1M45.4 81.1L54.9 98.9M44.4 83.3L52.2 98M44.1 86.8L48.7 95.4"/><path class="sq-line" d="M47.8 88C46.4 76.6 53.8 70.4 62 72C69.2 73.6 72 82.6 67.2 89.6"/><path class="sq-line" d="M58.4 93.4C62 93 65.4 93.2 68 93.6C72.4 94.2 74.4 95.4 74 97.2C73.6 98.6 71.8 99 69 99H51.6C48.2 99 46.6 97.6 47.2 95.6C47.6 94.4 48.6 93.6 49.8 93.2"/><path class="sq-mark" d="M53.4 80.2c1.6-1.6 3.4-2.4 5.2-2.6M55 83.6c1.4-1.2 3-1.8 4.6-1.9"/><path class="sq-fine" d="M66.4 98.8l.4-1.8M69.8 98.8l.2-1.8"/></g>
      <g class="sq-front-near"><path class="sq-paper" d="M78.6 86.4C79 90.6 80.4 93.6 82.6 94.6C86.6 94.6 90 95.6 90 97.4C90 98.8 88.4 99.2 86 99.2H81.4C78.6 99.2 77 97.6 76.6 94.8C76.2 92 76.4 89 77 86.6Z"/><path class="sq-wash" transform="translate(0.8 0.8)" d="M78.6 86.4C79 90.6 80.4 93.6 82.6 94.6C86.6 94.6 90 95.6 90 97.4C90 98.8 88.4 99.2 86 99.2H81.4C78.6 99.2 77 97.6 76.6 94.8C76.2 92 76.4 89 77 86.6Z"/><path class="sq-line" d="M78.6 86.4C79 90.6 80.4 93.6 82.6 94.6C86.6 94.6 90 95.6 90 97.4C90 98.8 88.4 99.2 86 99.2H81.4C78.6 99.2 77 97.6 76.6 94.8C76.2 92.4 76.4 89.6 76.8 87.2"/><path class="sq-fine" d="M85.4 99.1l.3-1.6M87.8 99l.2-1.6"/></g>
      <g class="sq-scarf sq-scarf-end"><path class="sq-paper" d="M76 58C70.6 60.6 65.8 64.6 63 70.4L67.4 71.6C69.8 66.6 73.4 63.4 78.8 61.2Z"/><path class="sq-scarf-wash" d="M76 58C70.6 60.6 65.8 64.6 63 70.4L67.4 71.6C69.8 66.6 73.4 63.4 78.8 61.2Z"/><path class="sq-line sq-thin" d="M76 58C70.6 60.6 65.8 64.6 63 70.4L67.4 71.6C69.8 66.6 73.4 63.4 78.8 61.2M63.4 70.8l-1.3 2.4M65.4 71.4l-.8 2.6M67.2 71.8l-.3 2.6"/></g>
      <g class="sq-head"><path class="sq-paper" d="M73.6 30.2C71.8 24.2 72.4 18.2 75.2 13.6C78.6 16.6 80.4 21.6 80.6 27Z"/><path class="sq-wash" transform="translate(0.6 0.6)" d="M73.6 30.2C71.8 24.2 72.4 18.2 75.2 13.6C78.6 16.6 80.4 21.6 80.6 27Z"/><path class="sq-shade" d="M73.6 30.2C71.8 24.2 72.4 18.2 75.2 13.6C78.6 16.6 80.4 21.6 80.6 27Z"/><path class="sq-hatch" clip-path="url(#sq-clip-earfar)" d="M75.7 14.3L78.8 19.2M73.9 14.7L79.2 23.2M72.9 16.5L78.3 25.2M72.4 19.1L77.8 27.7M71.5 21.1L76.5 29.1M72 25.3L74.9 29.9"/><path class="sq-line" d="M73.6 30.2C71.8 24.2 72.4 18.2 75.2 13.6C78.6 16.6 80.4 21.6 80.6 27Z"/><path class="sq-paper" d="M70.4 40.6C70 28.6 79 21.4 89.4 21.4C100 21.4 107.6 27.8 109 36.6C112 38.4 113.4 42.4 111.4 45.6C109 51.6 101.6 56.8 92 57.6C79.6 58.6 70.8 52 70.4 40.6Z"/><path class="sq-wash" transform="translate(1.4 1.2)" d="M70.4 40.6C70 28.6 79 21.4 89.4 21.4C100 21.4 107.6 27.8 109 36.6C112 38.4 113.4 42.4 111.4 45.6C109 51.6 101.6 56.8 92 57.6C79.6 58.6 70.8 52 70.4 40.6Z"/><path class="sq-texture" clip-path="url(#sq-clip-head)" d="M105.1 24.6L111.8 37.2M101.7 22.3L111.7 41.1M98.7 20.7L110.8 43.4M96.6 20.7L110.3 46.6M93.9 19.7L109.3 48.6M91.6 19.4L108 50.2M89.6 19.7L106.3 51.1M87.6 20L105 52.8M85.3 19.8L103.3 53.5M83.4 20.2L101.8 54.8M81.6 20.8L100.2 55.8M79.8 21.6L98.6 57M78.1 22.3L96.9 57.7M76.8 24.1L94.8 57.8M75.1 24.7L92.8 58.1M73.8 26.4L90.7 58.2M72.6 28.2L88.7 58.5M70.9 29.2L86.5 58.5M70.1 31.5L84 57.8M69.2 34L81.2 56.6M68.6 36.9L78.7 55.9M68.4 40.5L75.2 53.3"/><path class="sq-belly" d="M111.4 45.6C109 51.6 101.6 56.8 92 57.6C88.4 57.8 86.6 54.4 89.6 52C95.6 50.8 101.4 48 105.6 42.6C107.6 40 110 39 111.4 40.6C112.4 42 112.2 44 111.4 45.6Z"/><ellipse class="sq-blush" cx="98.6" cy="47.6" rx="3.4" ry="2.1"/><path class="sq-line" d="M71.2 44C69.6 30.4 78.8 21.4 89.4 21.4C100 21.4 107.6 27.8 109 36.6C112 38.4 113.4 42.4 111.4 45.6C109 51.6 101.6 56.8 92 57.6C83.6 58.2 76.4 55.4 73 50"/><path class="sq-ghost" d="M70.8 37.6C72.6 27.4 80.6 20.4 90 20.6C99.6 20.8 106.6 26.4 108.6 34.4"/><path class="sq-paper" d="M79.4 25.8C79 19.6 80.4 13.2 83.6 8.4C87.4 12.4 89.8 18.2 89.4 24.2Z"/><path class="sq-wash" transform="translate(0.9 0.8)" d="M79.4 25.8C79 19.6 80.4 13.2 83.6 8.4C87.4 12.4 89.8 18.2 89.4 24.2Z"/><path class="sq-line" d="M79.4 25.8C79 19.6 80.4 13.2 83.6 8.4C87.4 12.4 89.8 18.2 89.4 24.2Z"/><path class="sq-fine" d="M82.4 22.6C82.2 18.8 82.8 15.4 84 12.8"/>
      <g class="sq-eye"><ellipse cx="96.2" cy="37.2" rx="3.1" ry="3.5" class="sq-ink-fill sq-feature"/><circle cx="97.3" cy="35.9" r="1.1" class="sq-glint"/></g><ellipse class="sq-ink-fill sq-feature" cx="110.6" cy="41.4" rx="2.3" ry="1.9"/><path class="sq-mark sq-mouth" d="M99.6 46.4C102.8 49.4 107 49.4 109.8 46.6"/><path class="sq-ink-fill sq-feature sq-yawn" d="M101.6 45.6C102.8 50.4 107.4 51 108.8 47.2C106.4 48.2 103.8 47.6 101.6 45.6Z"/><path class="sq-whisker" d="M110.4 44.4C114.6 43.8 118.4 43.8 121.6 44.6M110 45.8C114 46.8 117.4 48.4 120.2 50.4"/></g>
      <g class="sq-scarf"><path class="sq-paper" d="M73.4 51.4C78.4 57 86.4 59 93 57.2L92.6 62.2C85.6 64.6 77.2 62.2 72.2 56.4Z"/><path class="sq-scarf-wash" d="M73.4 51.4C78.4 57 86.4 59 93 57.2L92.6 62.2C85.6 64.6 77.2 62.2 72.2 56.4Z"/><path class="sq-line sq-thin" d="M73.4 51.4C78.4 57 86.4 59 93 57.2L92.6 62.2C85.6 64.6 77.2 62.2 72.2 56.4Z"/><path class="sq-fine" d="M77.6 55.8l-1 4.6M82.4 58l-.6 4.6M87.2 58.6l-.2 4.4"/></g>
      <g class="sq-arm"><path class="sq-paper" d="M79.6 62C83.6 66.4 88.6 68.6 93.6 68.4C97 68.4 97.8 71.8 94.8 72.8C89.2 74.4 82.8 71.8 78.4 67.2Z"/><path class="sq-wash" transform="translate(0.8 0.8)" d="M79.6 62C83.6 66.4 88.6 68.6 93.6 68.4C97 68.4 97.8 71.8 94.8 72.8C89.2 74.4 82.8 71.8 78.4 67.2Z"/><path class="sq-line" d="M79.6 62C83.6 66.4 88.6 68.6 93.6 68.4C97 68.4 97.8 71.8 94.8 72.8C89.2 74.4 82.8 71.8 78.4 67.2Z"/><path class="sq-fine" d="M93.4 72.6l.3-1.6"/></g>
      <g class="sq-reach"><path class="sq-paper" d="M79 64.4C88 62.6 98 58.6 103.2 51.4C106.2 47 106.6 40 106.8 33C106.9 29.6 106.9 27 107.2 25C107.6 20.4 113.6 19.8 114.2 24.4C114.4 26.4 113.6 29 113.2 32C112.6 40.6 112.6 49.6 108.6 56.6C104 64.6 94.4 70 83 71.4Z"/><path class="sq-wash" transform="translate(0.8 0.8)" d="M79 64.4C88 62.6 98 58.6 103.2 51.4C106.2 47 106.6 40 106.8 33C106.9 29.6 106.9 27 107.2 25C107.6 20.4 113.6 19.8 114.2 24.4C114.4 26.4 113.6 29 113.2 32C112.6 40.6 112.6 49.6 108.6 56.6C104 64.6 94.4 70 83 71.4Z"/><path class="sq-line" d="M79 64.4C88 62.6 98 58.6 103.2 51.4C106.2 47 106.6 40 106.8 33C106.9 29.6 106.9 27 107.2 25C107.6 20.4 113.6 19.8 114.2 24.4C114.4 26.4 113.6 29 113.2 32C112.6 40.6 112.6 49.6 108.6 56.6C104 64.6 94.4 70 83 71.4Z"/><path class="sq-fine" d="M109.4 21.6l.4 1.9M111.8 21.7l-.2 1.9"/></g>
      <g class="sq-carried-acorn">${held}</g>
      <g class="sq-holding-paw"><path class="sq-paper" d="M79.4 63.6C84.8 67.4 90.6 70 96.6 69.8C100.4 69.6 101.4 73 98.6 74.4C92.2 77.2 84 74 78.6 68.8Z"/><path class="sq-wash" transform="translate(0.8 0.8)" d="M79.4 63.6C84.8 67.4 90.6 70 96.6 69.8C100.4 69.6 101.4 73 98.6 74.4C92.2 77.2 84 74 78.6 68.8Z"/><path class="sq-line" d="M79.4 63.6C84.8 67.4 90.6 70 96.6 69.8C100.4 69.6 101.4 73 98.6 74.4C92.2 77.2 84 74 78.6 68.8Z"/><path class="sq-fine" d="M96.4 72.4l2.4-1"/></g>
      <g class="sq-exclaim"><path class="sq-line" d="M104.6-10.6C104.1-4.6 103.7-.6 103.4 2.6"/><circle class="sq-ink-fill" cx="103.2" cy="6.6" r="1.25"/><path class="sq-fine" d="M97.2-5l-3.2-2.6M111.4-4.2l3.4-2.2"/></g>
      <g class="sq-zzz"><path class="sq-fine" d="M114 24.4h4.2l-4.2 4.4h4.2"/><path class="sq-fine" d="M120.6 15.4h3l-3 3.2h3"/></g>
      </g>
      </svg>
    </span>
  </button>
  <div class="squirrel-transfer" hidden aria-hidden="true"></div>
  <div class="sq-fortune-nut" hidden aria-hidden="true">
    <svg class="nut-body" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65"
         stroke-linecap="round" stroke-linejoin="round">${NUT_BODY}<g transform="rotate(14 12 12)">
      <path d="M6.8 10.4c.2 4.6 1.8 7.4 5.2 9.6 3.4-2.2 5-5 5.2-9.6"/></g></svg>
    <svg class="nut-cap" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65"
         stroke-linecap="round" stroke-linejoin="round">${NUT_CAP}<g transform="rotate(14 12 12)">
      <path d="M5.5 10.4c.2-3.1 2.5-5 6.5-5s6.3 1.9 6.5 5H5.5Z"/>
      <path d="M12 5.4c-.5-1.4-.1-2.5 1-3.1M8.3 7.5l1 1M11.5 7.1l1 1M14.7 7.5l1 1"/></g></svg>
  </div>
  <div class="sq-fortune-slip" hidden>
    <p class="sq-fortune-text"></p>
    <div class="sq-fortune-foot">
      <button type="button" class="sq-fortune-turn" data-step="-1" aria-label="Previous hint">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg>
      </button>
      <p class="sq-fortune-count"></p>
      <button type="button" class="sq-fortune-turn" data-step="1" aria-label="Next hint">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"/></svg>
      </button>
    </div>
  </div>`;
  document.body.appendChild(stage);

  const actor = stage.querySelector('.squirrel-actor');
  const facing = stage.querySelector('.squirrel-facing');
  const figure = stage.querySelector('.sq-figure');
  const transfer = stage.querySelector('.squirrel-transfer');
  const heldIcon = stage.querySelector('.sq-held-icon');
  const fortuneNut = stage.querySelector('.sq-fortune-nut');
  const fortuneSlip = stage.querySelector('.sq-fortune-slip');
  const fortuneText = stage.querySelector('.sq-fortune-text');
  const fortuneCount = stage.querySelector('.sq-fortune-count');
  const fortuneTurns = Array.from(stage.querySelectorAll('.sq-fortune-turn'));
  const flyingIcon = sourceIcon.cloneNode(true);
  flyingIcon.removeAttribute('class');
  transfer.appendChild(flyingIcon);
  actor.classList.toggle('is-winter', isWinter);

  const TRANSIENT = ['is-running', 'is-reaching', 'is-sniffing', 'is-carrying', 'is-yawning',
    'is-startled', 'is-hurrying', 'is-peeking', 'is-frozen', 'is-presenting', 'is-noticing'];

  /* ---------------- Easter eggs and the hints the squirrel hands out ---------------- */
  const EGGS = [
    { id: 'call', hint: 'Call me by name. Type <kbd>squirrel</kbd> or <kbd>acorn</kbd> anywhere on the page and I’ll pop up from the bottom edge.' },
    { id: 'oak', hint: 'Every round trip plants something at the top, next to About. Look again after one, two and three trips.' },
    { id: 'shower', hint: 'Shake the tree: scroll up and down, hard, a few times in a row. Mind your head.' },
    { id: 'denoise', hint: 'Click my name three times. Its letters get masked, then decoded a few at a time, the way a masked diffusion model writes.' },
    { id: 'hurry', hint: 'In a rush? While I’m out on an errand, press the acorn three more times. I’ll hurry.' },
    { id: 'seek', hint: 'Lend me the acorn, then scroll all the way down. I like to hide near the footer.' },
    { id: 'mood', hint: 'Visit after 11 pm, or sometime in winter. I dress for the occasion.' }
  ];
  const ALL_FOUND = 'That’s all seven. You now know every secret I have, except where I buried last year’s acorns.';

  function foundSet() {
    try { return new Set(JSON.parse(readStore('localStorage', FOUND_KEY) || '[]')); } catch (_) { return new Set(); }
  }
  function markFound(id) {
    const found = foundSet();
    if (found.has(id)) return;
    found.add(id);
    writeStore('localStorage', FOUND_KEY, JSON.stringify(Array.from(found)));
  }

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
    writeStore('sessionStorage', STORAGE_KEY, away ? 'away' : 'home');
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

  // No requestAnimationFrame loop runs while the feature is idle. Time is scaled
  // by `tempo` (a hurried squirrel) and stops while `frozen` (reading a hint).
  function animate(duration, update, signal) {
    return new Promise(function (resolve, reject) {
      if (signal.aborted) { reject(abortError()); return; }
      let last = performance.now();
      let elapsed = 0;
      let frame = 0;
      function cancel() {
        cancelAnimationFrame(frame);
        signal.removeEventListener('abort', cancel);
        reject(abortError());
      }
      function tick(now) {
        if (!frozen) elapsed += Math.max(0, now - last) * tempo;
        last = now;
        const t = Math.min(1, elapsed / duration);
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

  function pause(duration, signal) { return animate(duration, function () {}, signal); }

  let boilTimer = 0;
  let boilFrame = 0;
  function startBoil() {
    if (boilTimer || motionPreference.matches) return;
    boilTimer = setInterval(function () {
      if (frozen) return;
      boilFrame = (boilFrame + 1) % 3;
      figure.setAttribute('filter', 'url(#sq-rough-' + boilFrame + ')');
    }, 130);
  }
  function stopBoil() {
    clearInterval(boilTimer);
    boilTimer = 0;
    boilFrame = 0;
    figure.setAttribute('filter', 'url(#sq-rough-0)');
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

  async function runTo(x, y, duration, leap, signal, onStep) {
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
        if (onStep) onStep(t);
      }, signal);
    } finally { actor.classList.remove('is-running'); }
  }

  // Straight, leg-less movement (rising out of the bottom edge, for instance).
  async function glide(x, y, duration, signal) {
    const start = { x: position.x, y: position.y };
    await animate(duration, function (t) {
      const e = ease(t);
      place(start.x + (x - start.x) * e, start.y + (y - start.y) * e);
    }, signal);
  }

  async function holdClass(name, duration, signal) {
    actor.classList.add(name);
    try { await pause(duration, signal); }
    finally { actor.classList.remove(name); }
  }

  function sniff(duration, signal) { return holdClass('is-sniffing', duration, signal); }

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
    // Its raised paw (drawn at 110.5, 23) meets the exact center of the button.
    const dock = { x: target.x - (110.5 - 64) * scale, y: target.y + (104 - 23) * scale };
    const runway = Math.min(height - 8, nav.getBoundingClientRect().bottom + 44);
    const lowLane = Math.min(height - 8, runway + (width > 700 ? 64 : 23));
    return { width, height, target, iconSize, dock, runway, lowLane };
  }

  async function takeAcorn(g, signal) {
    actor.classList.add('is-reaching');
    await pause(220, signal);
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

  // Late at night the first pause of each visit becomes a yawn.
  async function linger(duration, signal, first) {
    if (first && isNight) {
      markFound('mood');
      await holdClass('is-yawning', duration + 520, signal);
    } else await sniff(duration, signal);
  }

  async function fullVisit(returning, g, signal) {
    actor.classList.toggle('is-carrying', returning);
    if (returning) {
      face(-1);
      place(g.width + spriteWidth, g.lowLane);
      stage.hidden = false;
      await runTo(g.width * .87, g.lowLane, 440, 8, signal);
      await runTo(g.width * .56, g.runway, 650, 18, signal);
      await linger(210, signal, true);
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
      await linger(240, signal, true);
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

  // One performance at a time: visits and every easter egg share this lock,
  // so the page never has two squirrels.
  let notices = 0;
  async function perform(name, script) {
    if (busy) return 'busy';
    busy = true;
    kind = name;
    tempo = 1;
    frozen = false;
    impatience = 0;
    notices = 0;
    const controller = new AbortController();
    activeController = controller;
    button.classList.remove('just-returned');
    syncButton();
    status.textContent = '';
    if (isWinter) markFound('mood');
    startBoil();
    let result = 'done';
    try {
      await script(measure(), controller.signal);
    } catch (error) {
      result = 'interrupted';
      if (error.name !== 'AbortError') console.error('Squirrel animation:', error);
    } finally {
      closeFortune(true);
      stopBoil();
      clearTimeout(startleTimer);
      clearTimeout(noticeTimer);
      stage.hidden = true;
      transfer.hidden = true;
      TRANSIENT.forEach(function (name) { actor.classList.remove(name); });
      tempo = 1;
      frozen = false;
      button.classList.remove('just-returned');
      if (activeController === controller) activeController = null;
      busy = false;
      kind = '';
      syncButton();
    }
    return result;
  }

  async function visit() {
    if (busy) { if (kind === 'visit') growImpatient(); return; }
    const returning = away;
    const result = await perform('visit', function (g, signal) {
      return motionPreference.matches ? quietVisit(returning, g, signal) : fullVisit(returning, g, signal);
    });
    if (result === 'busy') return;
    status.textContent = result === 'interrupted'
      ? (away ? 'The acorn is away. Press again to bring it back.' : 'The acorn is here. Press again to call the squirrel.')
      : (away ? 'The squirrel took the acorn. Press again to bring it back.' : 'The squirrel returned the acorn.');
    if (result === 'done' && returning) countTrip();
  }

  function cancelVisit() { if (activeController) activeController.abort(); }

  /* ---------------- Clicking the squirrel: an acorn fortune ----------------
     The squirrel stops, holds out an acorn, the cap pops off and a paper slip
     unrolls with a hint it has not given before. Arrows on the slip (or the
     arrow keys) turn back to every hint already handed out, so nothing is lost
     once all of them have been found. */
  let fortuneOpen = false;
  let fortuneTimer = 0;
  let fortuneToken = 0;
  let fortunePages = [];
  let fortunePage = 0;
  let fortuneAnchor = null;
  let hintCursor = 0;
  const CHECK = '<svg class="sq-fortune-check" viewBox="0 0 16 16" role="img" aria-label="Found:">' +
    '<path d="M3 8.6 6.4 12 13 4.4"/></svg>';

  function hintSet() {
    try { return new Set(JSON.parse(readStore('localStorage', HINTS_KEY) || '[]')); } catch (_) { return new Set(); }
  }

  // A hint never shown before comes first; after that, the ones still not found.
  function nextHint() {
    const found = foundSet();
    const given = hintSet();
    let egg = EGGS.find(function (item) { return !found.has(item.id) && !given.has(item.id); });
    if (!egg) {
      for (let i = 0; i < EGGS.length; i += 1) {
        const item = EGGS[(hintCursor + i) % EGGS.length];
        if (!found.has(item.id)) { egg = item; break; }
      }
    }
    if (!egg) return null;
    hintCursor = (EGGS.indexOf(egg) + 1) % EGGS.length;
    given.add(egg.id);
    writeStore('localStorage', HINTS_KEY, JSON.stringify(Array.from(given)));
    return egg;
  }

  // Every hint handed out or egg found, in order, then the closing note.
  function buildPages() {
    const found = foundSet();
    const given = hintSet();
    const pages = EGGS.filter(function (item) { return found.has(item.id) || given.has(item.id); })
      .map(function (item) { return { egg: item }; });
    if (EGGS.every(function (item) { return found.has(item.id); })) pages.push({ final: true });
    return pages;
  }

  function layoutSlip() {
    if (!fortuneAnchor) return;
    const hand = fortuneAnchor;
    const nutSize = 30;
    const width = document.documentElement.clientWidth;
    const slipWidth = fortuneSlip.offsetWidth;
    const slipHeight = fortuneSlip.offsetHeight;
    const above = hand.y - nutSize / 2 - 8 - slipHeight > 8;
    fortuneSlip.dataset.side = above ? 'above' : 'below';
    fortuneSlip.style.left = Math.max(10, Math.min(width - slipWidth - 10, hand.x - slipWidth / 2)).toFixed(1) + 'px';
    fortuneSlip.style.top = (above ? hand.y - nutSize / 2 - 8 - slipHeight : hand.y + nutSize / 2 + 8).toFixed(1) + 'px';
  }

  function showPage(index) {
    if (!fortunePages.length) return;
    fortunePage = (index + fortunePages.length) % fortunePages.length;
    const page = fortunePages[fortunePage];
    const found = foundSet();
    const isFound = !page.final && found.has(page.egg.id);
    fortuneText.innerHTML = page.final ? ALL_FOUND : (isFound ? CHECK : '') + page.egg.hint;
    // Each easter egg keeps its own number, so the count changes as you turn.
    fortuneCount.textContent = page.final ? 'All ' + EGGS.length + ' found'
      : 'Hint ' + (EGGS.indexOf(page.egg) + 1) + ' of ' + EGGS.length;
    fortuneTurns.forEach(function (turn) { turn.hidden = fortunePages.length < 2; });
    layoutSlip();
    status.textContent = (isFound ? 'Found. ' : '') + fortuneText.textContent + ' ' + fortuneCount.textContent + '.';
    clearTimeout(fortuneTimer);
    fortuneTimer = setTimeout(function () { closeFortune(); }, 14000);
  }

  function turnPage(step) { if (fortuneOpen) showPage(fortunePage + step); }

  fortuneTurns.forEach(function (turn) {
    turn.addEventListener('click', function (event) {
      event.stopPropagation();
      turnPage(Number(turn.dataset.step));
    });
  });

  function onOutsidePress(event) {
    if (fortuneSlip.contains(event.target) || actor.contains(event.target)) return;
    closeFortune();
  }

  function openFortune() {
    if (fortuneOpen || !busy) return;
    fortuneOpen = true;
    fortuneToken += 1;
    frozen = true;
    clearTimeout(noticeTimer);
    actor.classList.remove('is-noticing');
    actor.classList.add('is-frozen', 'is-presenting');
    const egg = nextHint();
    fortunePages = buildPages();
    // The nut sits in the squirrel's paws; the slip unrolls from it.
    const hand = handPoint(102, 63);
    const nutSize = 30;
    fortuneAnchor = hand;
    fortuneNut.style.left = (hand.x - nutSize / 2).toFixed(1) + 'px';
    fortuneNut.style.top = (hand.y - nutSize / 2).toFixed(1) + 'px';
    // The cap flies off away from the squirrel's face.
    fortuneNut.style.setProperty('--cap-x', (direction > 0 ? 10 : -10) + 'px');
    fortuneNut.style.setProperty('--cap-r', (direction > 0 ? 42 : -42) + 'deg');
    fortuneSlip.style.visibility = 'hidden';
    fortuneSlip.hidden = false;
    fortuneNut.hidden = false;
    showPage(egg ? fortunePages.findIndex(function (page) { return page.egg === egg; }) : fortunePages.length - 1);
    fortuneSlip.style.visibility = '';
    void fortuneSlip.offsetWidth;
    fortuneNut.classList.add('is-open');
    fortuneSlip.classList.add('is-open');
    document.addEventListener('pointerdown', onOutsidePress, true);
  }

  function closeFortune(immediate) {
    if (!fortuneOpen) return;
    fortuneOpen = false;
    clearTimeout(fortuneTimer);
    document.removeEventListener('pointerdown', onOutsidePress, true);
    fortuneNut.classList.remove('is-open');
    fortuneSlip.classList.remove('is-open');
    const token = fortuneToken;
    function finish() {
      if (token !== fortuneToken || fortuneOpen) return;
      fortuneNut.hidden = true;
      fortuneSlip.hidden = true;
      actor.classList.remove('is-presenting', 'is-frozen');
      frozen = false;
    }
    if (immediate || motionPreference.matches) finish();
    else setTimeout(finish, 300);
  }

  actor.addEventListener('click', function (event) {
    event.stopPropagation();
    if (fortuneOpen) closeFortune(); else openFortune();
  });

  // A mouse resting on the squirrel makes it stop and look up for a moment,
  // which is the hint that it can be clicked. Twice per trip at most.
  let noticeTimer = 0;
  actor.addEventListener('pointerenter', function (event) {
    if (event.pointerType !== 'mouse' || fortuneOpen || !busy || notices >= 2 || motionPreference.matches) return;
    notices += 1;
    frozen = true;
    actor.classList.add('is-frozen', 'is-noticing');
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function () {
      if (fortuneOpen) return;
      frozen = false;
      actor.classList.remove('is-frozen', 'is-noticing');
    }, 650);
  });

  /* ---------------- Easter egg: an impatient visitor ---------------- */
  function growImpatient() {
    impatience += 1;
    if (impatience !== 3 || motionPreference.matches) return;
    markFound('hurry');
    tempo = 1.9;
    actor.classList.add('is-startled', 'is-hurrying');
    clearTimeout(startleTimer);
    startleTimer = setTimeout(function () { actor.classList.remove('is-startled'); }, 820);
  }

  /* ---------------- Easter egg: a peek from the bottom edge ---------------- */
  async function peek(g, signal) {
    const carrying = away;
    actor.classList.toggle('is-carrying', carrying);
    actor.classList.add('is-peeking');
    face(-1);
    const x = Math.min(g.width - spriteWidth * .42, Math.max(spriteWidth, g.width * .84));
    const hidden = g.height + spriteHeight + 8;
    const shown = g.height + spriteHeight * (carrying ? .2 : .36);
    place(x, hidden);
    stage.hidden = false;
    if (motionPreference.matches) {
      place(x, shown);
      await pause(1600, signal);
      return;
    }
    await glide(x, shown, 460, signal);
    await sniff(520, signal);
    face(1);
    await pause(420, signal);
    face(-1);
    await sniff(560, signal);
    await glide(x, hidden, 320, signal);
  }

  /* ---------------- Easter egg: an acorn shower ----------------
     Shaking the page (scrolling up and down hard a few times) shakes the tree.
     Acorns rain down, settle along the bottom edge, and the squirrel runs
     through to collect them. Clicking the fully grown oak in the menu does the same. */
  async function shower(g, signal) {
    markFound('shower');
    const small = g.width < 560;
    const count = small ? 16 : 28;
    const size = small ? 18 : 22;
    const floor = g.height - 2;
    const nuts = [];
    for (let i = 0; i < count; i += 1) {
      const el = document.createElement('div');
      el.className = 'sq-falling';
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      el.innerHTML = nutSvg();
      stage.appendChild(el);
      nuts.push({
        el: el,
        x: 16 + Math.random() * (g.width - 32),
        y: -size - Math.random() * g.height * .5,
        vx: (Math.random() - .5) * 30,
        vy: 40 + Math.random() * 140,
        rot: Math.random() * 360,
        vr: (Math.random() - .5) * 420,
        rest: floor - size / 2 - Math.random() * 4,
        still: false,
        gone: false
      });
    }
    function draw(n) {
      n.el.style.transform = 'translate3d(' + (n.x - size / 2).toFixed(1) + 'px,' +
        (n.y - size / 2).toFixed(1) + 'px,0) rotate(' + n.rot.toFixed(0) + 'deg)';
    }
    try {
      place(-spriteWidth * 2, floor);
      nuts.forEach(draw);
      stage.hidden = false;
      if (motionPreference.matches) {
        nuts.forEach(function (n) { n.y = n.rest; n.rot = 0; draw(n); });
        await pause(1200, signal);
        return;
      }
      let last = 0;
      await animate(2700, function (t) {
        const time = t * 2700;
        const dt = Math.min(.05, (time - last) / 1000);
        last = time;
        nuts.forEach(function (n) {
          if (n.still) return;
          n.vy += 1500 * dt;
          n.y += n.vy * dt;
          n.x = Math.max(size / 2, Math.min(g.width - size / 2, n.x + n.vx * dt));
          n.rot += n.vr * dt;
          if (n.y >= n.rest) {
            n.y = n.rest;
            if (n.vy > 170) { n.vy *= -.32; n.vr *= .5; n.vx *= .6; }
            else { n.vy = 0; n.vx = 0; n.vr = 0; n.still = true; }
          }
          draw(n);
        });
      }, signal);
      // The squirrel runs along the bottom and picks every acorn up.
      face(1);
      place(-spriteWidth, floor);
      await runTo(g.width + spriteWidth, floor, Math.max(1500, g.width * 1.45), 5, signal, function () {
        const reach = position.x + spriteWidth * .3;
        nuts.forEach(function (n) {
          if (n.gone || n.x > reach) return;
          n.gone = true;
          n.el.classList.add('is-gathered');
          actor.classList.add('is-carrying');
        });
      });
    } finally {
      nuts.forEach(function (n) { n.el.remove(); });
    }
  }

  /* ---------------- Easter egg: hide-and-seek in the footer ---------------- */
  const footer = document.querySelector('footer');
  let scrolled = false;
  let sought = false;
  let seekTimer = 0;
  window.addEventListener('scroll', function () { scrolled = true; }, { passive: true, once: true });
  if (footer && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      clearTimeout(seekTimer);
      const visible = entries.some(function (entry) { return entry.isIntersecting; });
      if (!visible || sought || !away || !scrolled) return;
      seekTimer = setTimeout(function () {
        if (sought || !away || busy || document.hidden) return;
        sought = true;
        markFound('seek');
        perform('peek', peek);
      }, 850);
    }, { threshold: .6 }).observe(footer);
  }

  /* ---------------- Easter egg: an oak in the menu ----------------
     Squirrels forget many of the acorns they bury, and some become oaks. Every
     finished round trip is counted (in this browser only): one trip grows a
     sprout next to About, two a sapling, three a young oak, which drops acorns
     when clicked. It grows where the visitor is already looking, and it is
     gone again an hour after the last round trip. */
  const OAK = [
    { at: 1, label: 'A sprout from a forgotten acorn',
      art: '<path class="oak-ground" d="M3.4 17.7c4.2-.5 9-.6 13.2 0"/>' +
        '<path d="M7.3 17.4c.3-1.7 1.5-2.7 2.9-2.7s2.5 1 2.8 2.5"/>' +
        '<path d="M10.1 14.8c.1-1.8 0-3.4-.4-5"/>' +
        '<path class="oak-leaf" d="M9.7 10.6C8.2 8.8 6 8.4 4.8 9c.9 1.8 3 2.6 4.9 1.6Z"/>' +
        '<path class="oak-leaf" d="M9.8 9.9c1.4-2 3.6-2.7 5.1-2.2-.8 2-3 3-5.1 2.2Z"/>' },
    { at: 2, label: 'An oak sapling from a forgotten acorn',
      art: '<path class="oak-ground" d="M3 17.7c4.6-.5 9.4-.6 14 0"/>' +
        '<path d="M10 17.6c.2-4.4-.2-9 .4-13.4"/>' +
        '<path class="oak-leaf" d="M10 13.2c-1.8-.4-3.6-1.6-4-3.2 1.8-.4 3.4.8 4 3.2Z"/>' +
        '<path class="oak-leaf" d="M10.1 10.6c1.6-.8 3.6-1 4.8-.2-1.2 1.4-3 1.6-4.8.2Z"/>' +
        '<path class="oak-leaf" d="M10.2 7.4c-1.4-.6-2.6-1.8-2.8-3.2 1.6 0 2.6 1.4 2.8 3.2Z"/>' +
        '<path class="oak-leaf" d="M10.4 5.2c.6-1.4 1.8-2.4 3.2-2.4-.4 1.6-1.6 2.4-3.2 2.4Z"/>' },
    { at: 3, label: 'A young oak, grown from forgotten acorns. Click it to shake it',
      art: '<path class="oak-ground" d="M2.6 17.7c5-.5 9.8-.6 14.8 0"/>' +
        '<path d="M10 17.6c.3-2.2.1-4.2-.3-6.4M9.9 13.6l-1.9-1.7M10 12.7l1.7-1.3"/>' +
        '<path class="oak-leaf" d="M5 10.4C3.6 10 3.2 8 4.6 7.2 4.4 5.4 6.2 4.4 7.6 5.2 8.2 3.6 10.6 3.2 11.8 4.6 13.2 3.8 15.2 4.8 15 6.6 16.6 7.2 16.6 9.4 15 10.2 14.6 11.6 12.6 12 11.6 11.2 10.6 12.2 8.6 12.2 7.8 11.2 6.6 11.8 5.2 11.6 5 10.4Z"/>' +
        '<path d="M13.4 17.4c.2-.9.8-1.4 1.5-1.4s1.3.5 1.4 1.3"/>' }
  ];
  const oakNote = 'Squirrels forget many of the acorns they bury. Some grow into oaks.';

  function lastTripAt() { return parseInt(readStore('localStorage', TRIPS_AT_KEY) || '0', 10) || 0; }
  // Trips older than an hour no longer count; the oak goes with them.
  function tripCount() {
    const count = parseInt(readStore('localStorage', TRIPS_KEY) || '0', 10) || 0;
    if (count && Date.now() - lastTripAt() > OAK_LIFETIME) {
      writeStore('localStorage', TRIPS_KEY, '0');
      writeStore('localStorage', OAK_SEEN_KEY, '0');
      return 0;
    }
    return count;
  }

  function oakStage(trips) {
    let stageIndex = 0;
    OAK.forEach(function (step, i) { if (trips >= step.at) stageIndex = i + 1; });
    return stageIndex;
  }

  let oakObserver = null;
  let oakTimer = 0;
  function renderOak(wilt) {
    const host = nav.querySelector('.nav-links');
    if (!host) return;
    clearTimeout(oakTimer);
    const stageIndex = oakStage(tripCount());
    let oak = host.querySelector('.oak');
    if (oak && oak.classList.contains('is-wilting')) { oak.remove(); oak = null; }
    if (!stageIndex) {
      if (!oak) return;
      // Its hour is up: wilt away if someone is watching, otherwise just go.
      if (wilt && !motionPreference.matches) {
        oak.classList.add('is-wilting');
        setTimeout(function () { oak.remove(); }, 900);
      } else oak.remove();
      return;
    }
    markFound('oak');
    // Check again the moment the hour runs out, in case the page is still open.
    oakTimer = setTimeout(function () { renderOak(true); },
      Math.max(1000, lastTripAt() + OAK_LIFETIME - Date.now() + 500));
    if (!oak) {
      oak = document.createElement('button');
      oak.type = 'button';
      oak.className = 'oak';
      oak.addEventListener('click', function () {
        if (oak.dataset.stage === String(OAK.length)) { perform('shower', shower); return; }
        oak.classList.remove('is-wiggling');
        void oak.offsetWidth;
        oak.classList.add('is-wiggling');
      });
      host.insertBefore(oak, host.firstChild);
    }
    const step = OAK[stageIndex - 1];
    if (oak.dataset.stage === String(stageIndex)) return;
    oak.dataset.stage = String(stageIndex);
    oak.setAttribute('aria-label', step.label + '. ' + oakNote);
    oak.title = oakNote;
    oak.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.1" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + step.art + '</svg>';
    // Play the growing animation once, the first time the new stage is on screen.
    const seen = parseInt(readStore('localStorage', OAK_SEEN_KEY) || '0', 10) || 0;
    if (seen >= stageIndex || !('IntersectionObserver' in window)) return;
    if (oakObserver) oakObserver.disconnect();
    oakObserver = new IntersectionObserver(function (entries) {
      if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
      oakObserver.disconnect();
      oakObserver = null;
      writeStore('localStorage', OAK_SEEN_KEY, String(stageIndex));
      oak.classList.remove('is-growing');
      void oak.offsetWidth;
      oak.classList.add('is-growing');
    }, { threshold: 1 });
    oakObserver.observe(oak);
  }

  function countTrip() {
    const count = tripCount() + 1;
    writeStore('localStorage', TRIPS_KEY, String(count));
    writeStore('localStorage', TRIPS_AT_KEY, String(Date.now()));
    renderOak();
  }

  /* ---------------- Easter egg: a title that gets denoised ----------------
     Clicking the page heading three times (or typing "mask") masks its letters
     and unmasks them a few at a time, the way a masked diffusion model decodes. */
  const heading = document.querySelector('h1.name, h1.page-title');

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = list[i]; list[i] = list[j]; list[j] = swap;
    }
    return list;
  }

  function denoise(el) {
    if (!el || el.dataset.denoising === 'true' || el.children.length) return;
    const text = el.textContent;
    if (!text.trim() || text.length > 48) return;
    markFound('denoise');
    el.dataset.denoising = 'true';
    el.setAttribute('aria-label', text);
    const cells = Array.from(text).map(function (ch) {
      const span = document.createElement('span');
      span.className = 'sq-tok';
      span.textContent = ch;
      span.setAttribute('aria-hidden', 'true');
      return span;
    });
    el.textContent = '';
    cells.forEach(function (cell) { el.appendChild(cell); });
    const tokens = shuffle(cells.filter(function (cell) { return cell.textContent.trim(); }));
    const noiseSteps = 3;
    const decodeSteps = Math.min(5, tokens.length);
    let at = 0;
    // Forward process: mask everything in a few quick steps.
    for (let s = 0; s < noiseSteps; s += 1) {
      const batch = tokens.slice(Math.floor(s * tokens.length / noiseSteps),
        Math.floor((s + 1) * tokens.length / noiseSteps));
      setTimeout(function () {
        batch.forEach(function (cell) { cell.classList.add('is-masked'); });
      }, at);
      at += 90;
    }
    at += 420;
    // Reverse process: several tokens are committed in parallel at each step.
    const order = shuffle(tokens.slice());
    for (let s = 0; s < decodeSteps; s += 1) {
      const batch = order.slice(Math.floor(s * order.length / decodeSteps),
        Math.floor((s + 1) * order.length / decodeSteps));
      setTimeout(function () {
        batch.forEach(function (cell) {
          cell.classList.remove('is-masked');
          cell.classList.add('is-fresh');
        });
        setTimeout(function () {
          batch.forEach(function (cell) { cell.classList.remove('is-fresh'); });
        }, 120);
      }, at);
      at += 190;
    }
    setTimeout(function () {
      el.textContent = text;
      el.removeAttribute('aria-label');
      delete el.dataset.denoising;
    }, at + 700);
  }

  if (heading) {
    let clicks = 0;
    let clickTimer = 0;
    heading.addEventListener('click', function () {
      clicks += 1;
      clearTimeout(clickTimer);
      clickTimer = setTimeout(function () { clicks = 0; }, 700);
      if (clicks < 3) return;
      clicks = 0;
      const selection = window.getSelection && window.getSelection();
      if (selection && selection.removeAllRanges) selection.removeAllRanges();
      denoise(heading);
    });
  }

  /* ---------------- Keyboard and shakes ---------------- */
  let typed = '';

  function isEditable(target) {
    return target && (target.isContentEditable ||
      /^(input|textarea|select)$/i.test(target.tagName || ''));
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      if (fortuneOpen) closeFortune();
      else if (busy) cancelVisit();
      return;
    }
    if (fortuneOpen && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      turnPage(event.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || isEditable(event.target)) return;
    const key = String(event.key || '').toLowerCase();
    if (key.length !== 1 || key < 'a' || key > 'z') return;
    typed = (typed + key).slice(-12);
    if (/(acorn|squirrel)$/.test(typed)) {
      typed = '';
      markFound('call');
      perform('peek', peek);
    } else if (/mask$/.test(typed)) { typed = ''; denoise(heading); }
  });

  // Shaking: five quick reversals of scrolling within 1.6 s.
  let shakeDir = 0;
  let shakeLeg = 0;
  let shakeFlips = [];
  function feedShake(delta) {
    if (!delta) return;
    const dir = delta > 0 ? 1 : -1;
    if (dir === shakeDir) { shakeLeg += Math.abs(delta); return; }
    const moment = performance.now();
    if (shakeDir && shakeLeg >= 24) shakeFlips.push(moment);
    shakeDir = dir;
    shakeLeg = Math.abs(delta);
    shakeFlips = shakeFlips.filter(function (t) { return moment - t < 1600; });
    if (shakeFlips.length >= 5) {
      shakeFlips = [];
      perform('shower', shower);
    }
  }
  window.addEventListener('wheel', function (event) {
    feedShake(event.deltaY * (event.deltaMode === 1 ? 16 : 1));
  }, { passive: true });
  let touchY = null;
  document.addEventListener('touchstart', function (event) {
    touchY = event.touches.length === 1 ? event.touches[0].clientY : null;
  }, { passive: true });
  document.addEventListener('touchmove', function (event) {
    if (touchY === null || event.touches.length !== 1) return;
    const y = event.touches[0].clientY;
    feedShake(touchY - y);
    touchY = y;
  }, { passive: true });

  /* ---------------- Interruptions ---------------- */
  // Width changes cancel anything in progress. A height-only change (a phone's
  // address bar sliding in and out) only cancels a peek from the bottom edge.
  let lastWidth = document.documentElement.clientWidth;
  window.addEventListener('resize', function () {
    const width = document.documentElement.clientWidth;
    if (width !== lastWidth || kind === 'peek') cancelVisit();
    lastWidth = width;
  }, { passive: true });
  window.addEventListener('pagehide', cancelVisit);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) cancelVisit();
    else renderOak(true);
  });
  if (motionPreference.addEventListener) motionPreference.addEventListener('change', cancelVisit);
  else if (motionPreference.addListener) motionPreference.addListener(cancelVisit);
  // Re-sync after the browser restores a document from its back/forward cache.
  window.addEventListener('pageshow', function () {
    if (!busy) {
      away = readStore('sessionStorage', STORAGE_KEY) === 'away';
      syncButton();
      renderOak();
    }
  });

  button.addEventListener('click', visit);
  syncButton();
  renderOak();
  button.hidden = false;
})();
