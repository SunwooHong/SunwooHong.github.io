/*
 * A little squirrel, an acorn, and a round trip, drawn in pen and wash.
 * Dependency-free; works on a static site and with local HTML files.
 * Click once to lend the acorn. Click again to have it returned.
 *
 * It also answers to a few other things. They are listed in README_KO.md,
 * and hinted at (vaguely) in the browser console.
 */
(function () {
  'use strict';

  const button = document.getElementById('acorn-toggle');
  const nav = document.querySelector('.nav');
  if (!button || !nav || button.dataset.squirrelReady === 'true') return;
  button.dataset.squirrelReady = 'true';

  const STORAGE_KEY = 'sunwoo.squirrel.acorn.v1';   // sessionStorage: where the acorn is
  const TRIPS_KEY = 'sunwoo.squirrel.trips.v1';     // localStorage: finished round trips
  const OAK_SEEN_KEY = 'sunwoo.squirrel.oak.v1';    // localStorage: last oak stage shown growing
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
  let spin = 0;
  let tempo = 1;
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

  // Reuse the actual navigation icon, so the acorn in its paws is identical.
  const sourceIcon = button.querySelector('.acorn-icon');
  const acornDrawing = sourceIcon.innerHTML;
  const held = '<svg class="sq-held-icon" x="88" y="51" width="28" height="28" viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" ' +
    'stroke-linejoin="round">' + acornDrawing + '</svg>';

  // Three slightly different wobbles. Cycling them while the squirrel moves gives
  // the "boiling" line of hand-drawn animation; at rest it keeps the first one.
  const roughness = [3, 11, 23].map(function (seed, i) {
    return '<filter id="sq-rough-' + i + '" x="-8%" y="-12%" width="116%" height="124%" ' +
      'color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".085" ' +
      'numOctaves="2" seed="' + seed + '"/><feDisplacementMap in="SourceGraphic" scale="2.2" ' +
      'xChannelSelector="R" yChannelSelector="G"/></filter>';
  }).join('');

  const stage = document.createElement('div');
  stage.className = 'squirrel-stage';
  stage.hidden = true;
  stage.setAttribute('aria-hidden', 'true');
  // The drawing below is pre-generated: ink contours, hatching, fur strokes and
  // an offset wash, all in the page's own colour tokens.
  stage.innerHTML = `
  <div class="squirrel-actor">
    <div class="squirrel-facing">
      <svg class="squirrel-art" viewBox="0 0 128 104" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>${roughness}</defs>
      <g class="sq-figure" filter="url(#sq-rough-0)">
      <defs><clipPath id="sq-clip-tail"><path d="M51 80C33 87 10 78 7 59C4 43 17 34 21 26C26 16 22 9 16 12C12 14 12 19 15 22C4 21 3 11 10 6C22-4 42 9 45 26C49 44 31 51 32 63C33 70 41 73 51 72Z"/></clipPath><clipPath id="sq-clip-body"><path d="M73 52C62 50 48 58 45 72C43 82 46 92 55 95C64 97 76 96 81 90C86 82 86 70 82 62C80 57 77 54 73 52Z"/></clipPath><clipPath id="sq-clip-hind"><path d="M47 84C45 73 54 67 62 70C69 73 70 84 64 90C68 92 71 93 72 94C75 95 75 98 72 98.5L52 98.5C47 98.5 45 95 48 92.5C47 90 47 87 47 84Z"/></clipPath><clipPath id="sq-clip-hindfar"><path d="M50 88C46 92 41 95 37 96C34 97 34 99.5 37 99.5L50 99.5C53 99.5 55 96.5 55 93Z"/></clipPath><clipPath id="sq-clip-frontfar"><path d="M81 73C83 80 86 87 89 91.5L94 92C97 92.3 97 95.5 94 95.6L87.5 95.6C85.4 95.6 84.4 94.5 84 93C82 88 80 82 79 76Z"/></clipPath><clipPath id="sq-clip-earfar"><path d="M75.5 37C72.5 31 72.6 23 75.8 17.5C78.6 21 80.6 27 80.8 33Z"/></clipPath></defs>
      <path class="sq-ground" d="M37 100.4c12-.7 35-.9 55-.1M46 102.2c8-.4 21-.4 31 .1"/>
      <g class="sq-tail"><path class="sq-paper" d="M51 80C33 87 10 78 7 59C4 43 17 34 21 26C26 16 22 9 16 12C12 14 12 19 15 22C4 21 3 11 10 6C22-4 42 9 45 26C49 44 31 51 32 63C33 70 41 73 51 72Z"/><path class="sq-wash" transform="translate(1.8 1.6)" d="M51 80C33 87 10 78 7 59C4 43 17 34 21 26C26 16 22 9 16 12C12 14 12 19 15 22C4 21 3 11 10 6C22-4 42 9 45 26C49 44 31 51 32 63C33 70 41 73 51 72Z"/><path class="sq-hatch" clip-path="url(#sq-clip-tail)" d="M28.1 56.6L33.9 65.9M24.9 55.8L33.4 69.4M21.4 54.5L31.9 71.4M18.5 54.2L30 72.7M15.9 54.4L28.7 75M14 55.7L26.2 75.3M11.5 56.1L24.4 76.7M9.3 56.9L21.9 77M7.5 58.4L19.5 77.5M6 60.2L16.6 77.3M5.1 63.2L13.5 76.7M4.3 66.2L9.7 74.8M34.7 48.3L38.1 53.7M32.5 49.7L38.9 59.9M30.5 51.4L38.4 64.1M30.1 55.7L37.4 67.3M29.1 59L36.2 70.2M29.8 64.9L33.8 71.3"/><path class="sq-fine sq-faint" d="M44 76.5C27 75 18 65 20 55C23 41 38 35 35 21C33 14 27 10 22 11"/><path class="sq-line sq-broken" d="M51 80C33 87 10 78 7 59C4 43 17 34 21 26C26 16 22 9 16 12C12 14 12 19 15 22C4 21 3 11 10 6C22-4 42 9 45 26C49 44 31 51 32 63C33 70 41 73 51 72Z"/><path class="sq-fur" d="M33.5 80.5Q33 84.1 29.8 83.4M32.1 80.3Q32 81.6 30.1 81M27.7 79.2Q26.4 83.2 22.5 81.6M22.1 76.8Q20.1 80.6 16.5 78.3M20.9 76.2Q20.1 77.6 18.2 76.2M15.2 71.7Q12.5 74.3 10.4 71.7M14.2 70.7Q13.2 71.6 12.1 70M10.8 65.6Q7 67.4 5.6 63.6M10.1 64.3Q8.6 65.1 7.8 62.7M8.3 56.4Q4.3 56.7 4.3 52.9M8.1 55Q6.4 55.2 6.5 52.5M8.8 49.1Q5.4 48.2 6.4 45.3M9.1 47.7Q8.1 47.4 8.7 45.9M11.3 42.7Q8.2 41 9.9 38.4M12 41.5Q10.7 40.7 12 38.9M15.7 36.2Q12.2 33.5 15.2 30.1M19 31.9Q15.9 29.5 18.4 26.7M22.2 27.2Q18.8 25.5 20.6 22.6M24.4 21.4Q20.6 20.6 21.7 17.1M7.3 12.7Q3 11.8 2.4 16.2M9.8 8.3Q7.2 5.4 4.8 8M15.7 4.7Q14.7 1.1 11.5 2.2M14.4 5.1Q14 3.6 11.9 4.5M22.3 4.3Q22.9 1.1 20.2 0.8M27.7 6Q29.1 3 26.6 2.1M33.4 9.6Q35.9 6.6 32.9 4.4M32.3 8.7Q33.6 7.2 31.2 5.7M37.5 13.7Q40.2 11.6 38.2 9.4M36.6 12.6Q37.6 11.9 36.3 10.6M41 19Q44.2 17.4 42.6 14.6"/><path class="sq-ghost" d="M50 81.6C32.4 88.2 9.2 79 6 59.4C3.4 43.6 15.8 35 20.2 26.4M10.6 5C22.6-5.2 43.4 8.2 46.2 25.6"/></g>
      <g class="sq-hind-far"><path class="sq-paper" d="M50 88C46 92 41 95 37 96C34 97 34 99.5 37 99.5L50 99.5C53 99.5 55 96.5 55 93Z"/><path class="sq-hatch sq-dense" clip-path="url(#sq-clip-hindfar)" d="M52 92.3L54.9 96.5M49.8 92.1L54 98M47.7 91.9L52.3 98.5M45.6 91.6L51.5 100M43.5 91.5L49.7 100.3M41.7 91.7L47.8 100.3M40.3 92.4L46.1 100.7M38.8 93L44 100.6M37.2 93.5L41.8 100.1M35.3 93.7L40 100.4M34.8 95.7L37 98.9"/><path class="sq-line" d="M50 88C46 92 41 95 37 96C34 97 34 99.5 37 99.5L50 99.5C53 99.5 55 96.5 55 93Z"/></g>
      <g class="sq-front-far"><path class="sq-paper" d="M81 73C83 80 86 87 89 91.5L94 92C97 92.3 97 95.5 94 95.6L87.5 95.6C85.4 95.6 84.4 94.5 84 93C82 88 80 82 79 76Z"/><path class="sq-hatch sq-dense" clip-path="url(#sq-clip-frontfar)" d="M91.5 83.9L95.7 89.9M89 83.1L95.4 92.3M87.3 83.4L94.2 93.3M85.7 83.9L93.1 94.5M84.2 84.6L92 95.7M82.7 85.2L90 95.7M81.6 86.4L88.7 96.6M81 88.4L86.9 96.8M80.4 90.3L84.3 95.9"/><path class="sq-line" d="M81 73C83 80 86 87 89 91.5L94 92C97 92.3 97 95.5 94 95.6L87.5 95.6C85.4 95.6 84.4 94.5 84 93C82 88 80 82 79 76Z"/></g>
      <g class="sq-body"><path class="sq-paper" d="M73 52C62 50 48 58 45 72C43 82 46 92 55 95C64 97 76 96 81 90C86 82 86 70 82 62C80 57 77 54 73 52Z"/><path class="sq-wash" transform="translate(1.6 1.2)" d="M73 52C62 50 48 58 45 72C43 82 46 92 55 95C62 96 68 94 70 88C72 80 72 70 78 60Z"/><path class="sq-hatch" clip-path="url(#sq-clip-body)" d="M52.5 77.8L56.4 83.2M49.7 77.6L56.3 87M47.2 77.8L55.6 89.9M45.5 79.2L54.6 92.2M44.5 81.6L52.6 93.2M43.7 84.3L50.8 94.4M43.4 87.8L47.8 94.1"/><path class="sq-line" d="M74.5 53.2C63 49.6 48.4 57 45.2 71.6C43.2 82 46.2 92 55 95.1"/><path class="sq-line" d="M55 95.1C64 97.2 76 96 81.2 89.6M82.6 61.2C86.4 69 86.6 81.6 81.8 90.2"/><path class="sq-fur" d="M65.2 53Q64.8 51.2 63.3 51.7M56.3 56.7Q55.3 55.3 54.1 56.3M49.2 64Q47.5 62.9 46.6 64.7M46 71.4Q44.1 71 43.9 72.8"/><path class="sq-fine sq-faint" d="M79.4 60.6C75.4 68.4 74.4 80 73.4 90"/><path class="sq-ghost" d="M75.6 52.2C63.4 48.4 47.6 56 44.2 71"/></g>
      <g class="sq-hind-near"><path class="sq-paper" d="M47 84C45 73 54 67 62 70C69 73 70 84 64 90C68 92 71 93 72 94C75 95 75 98 72 98.5L52 98.5C47 98.5 45 95 48 92.5C47 90 47 87 47 84Z"/><path class="sq-wash" transform="translate(1.4 1.2)" d="M47 84C45 73 54 67 62 70C66 72 66.4 78 62.6 82.4C58.6 86.6 52 88 47 84Z"/><path class="sq-hatch" clip-path="url(#sq-clip-hind)" d="M55.7 86.8L58.2 90.3M53.3 86.9L56.7 91.8M50.4 86.5L55.2 93.4M48.6 87.6L53 93.8M46.6 88.3L49.8 93M45.4 90.3L46.6 92.1"/><path class="sq-line" d="M47.2 86C45 74 54 67 62 70C69 73 70.5 83 64.5 90"/><path class="sq-line" d="M58.6 91.2C63.6 92 68 93 72 94C75 95 75 98 72 98.5L52 98.5C48 98.6 45.8 96 48.5 93"/><path class="sq-fine" d="M66.2 98.4l.6-2M69.6 98.4l.3-2"/></g>
      <g class="sq-front-near"><path class="sq-paper" d="M76 73C77 81 80 89 84 94.5L90 95.2C93.5 95.6 93.4 99 90 99L82.5 99C79.8 99 78.7 97.2 78 95C75 88 72.5 81 72.5 75Z"/><path class="sq-line" d="M76 73.5C77 81 80 89 84 94.6L90 95.2C93.5 95.6 93.4 99 90 99L82.5 99C79.8 99 78.7 97.2 78 95C75.6 89 73.6 83 72.8 77.4"/><path class="sq-fine" d="M86.4 98.9l.4-1.8M88.9 98.9l.2-1.8"/></g>
      <g class="sq-scarf sq-scarf-end"><path class="sq-paper" d="M76 58C70.4 60.4 65.4 64.6 62.4 70.6L66.8 71.8C69.2 66.8 72.8 63.6 78.4 61.4Z"/><path class="sq-scarf-wash" d="M76 58C70.4 60.4 65.4 64.6 62.4 70.6L66.8 71.8C69.2 66.8 72.8 63.6 78.4 61.4Z"/><path class="sq-line sq-thin" d="M76 58C70.4 60.4 65.4 64.6 62.4 70.6L66.8 71.8C69.2 66.8 72.8 63.6 78.4 61.4M62.8 71l-1.3 2.4M64.8 71.5l-.8 2.6M66.6 71.9l-.3 2.6"/></g>
      <g class="sq-head"><path class="sq-paper" d="M75.5 37C72.5 31 72.6 23 75.8 17.5C78.6 21 80.6 27 80.8 33Z"/><path class="sq-hatch sq-dense" clip-path="url(#sq-clip-earfar)" d="M76.2 17.3L80.6 23.7M75.2 18.8L80.4 26.3M74.6 21L80.6 29.5M73.6 22.4L80.1 31.8M73.5 25.3L79.7 34.2M73.2 27.8L78.7 35.7M73.6 31.4L77.1 36.4"/><path class="sq-line" d="M75.5 37C72.5 31 72.6 23 75.8 17.5C78.6 21 80.6 27 80.8 33Z"/><path class="sq-paper" d="M72 41C73.5 33 81 28.5 89.5 29.5C96 30.4 100.5 35 103 40.5C105.6 43.6 109.6 46 112.2 49.2C113.6 52.6 110.8 55.8 106.6 57C102.4 59.2 98.2 61 93 62C86 63 79 61.2 75 56.4C71.4 52 70.7 46 72 41Z"/><path class="sq-wash" transform="translate(1.4 1.2)" d="M72 41C73.5 33 81 28.5 89.5 29.5C96 30.4 100.5 35 103 40.5C99 41.4 95 37.6 88.6 38.6C82.4 39.8 78.6 46 79.4 53.6C77.4 56.6 74 55.6 72 50Z"/><path class="sq-line" d="M73.2 38.6C75.6 32.4 81.6 28.6 89.5 29.5C96 30.4 100.5 35 103 40.5C105.6 43.6 109.6 46 112.2 49.2C113.6 52.6 110.8 55.8 106.6 57C102.4 59.2 98.2 61 93 62"/><path class="sq-fine" d="M75.3 56.6C72.6 53.6 71.4 50 71.6 46.4M75 55.6l-3.4 2.2M72.4 51.4l-3.6.8M72 47l-3-.6"/><path class="sq-ghost" d="M73.8 37.6C76.6 31.8 82 28 89.6 28.7C95.6 29.5 100.4 33.8 103 39.4"/><path class="sq-paper" d="M81 34C79.5 26 81.2 18.8 85.4 13.2C88.8 18.6 90.4 25.4 89.6 32.6Z"/><path class="sq-wash" transform="translate(1 0.8)" d="M81 34C79.5 26 81.2 18.8 85.4 13.2C88.8 18.6 90.4 25.4 89.6 32.6Z"/><path class="sq-line" d="M81 34C79.5 26 81.2 18.8 85.4 13.2C88.8 18.6 90.4 25.4 89.6 32.6Z"/><path class="sq-fine" d="M84 30.5C84 25 84.6 21 85.6 17.5"/><path class="sq-fur" d="M85.4 13.6C85 10.6 85.8 8.2 87.6 6.6M85.6 13.4C86.8 11.2 88.4 10.2 90.2 9.8"/><path class="sq-fine sq-faint" d="M89 44.6C89.8 47 92.2 48.2 94.8 47.6"/>
      <g class="sq-eye"><ellipse cx="93" cy="42.6" rx="2.5" ry="2.9" class="sq-ink-fill sq-feature"/><circle cx="93.8" cy="41.6" r=".8" class="sq-glint"/></g><path class="sq-ink-fill sq-feature" d="M109.3 48.6C111.2 47.9 113 48.8 112.6 50.8C111.6 52 109.8 51.2 109.3 48.6Z"/><path class="sq-fine sq-mouth" d="M106.6 55.4C104.8 56.8 102.6 57 100.8 56.2"/><path class="sq-ink-fill sq-feature sq-yawn" d="M100.6 55.4C102.4 60.4 107.2 60.8 108.4 56.6C106 57.6 103 57.2 100.6 55.4Z"/><path class="sq-whisker" d="M108.5 52.5C113 51.4 117.5 51 122 51.6M108.4 53.6C112.6 54.4 116.6 56 120.4 58.4"/></g>
      <g class="sq-scarf"><path class="sq-paper" d="M72.6 52.6C77.4 58.2 84.6 60.4 90.6 58.4L90 63.4C83.4 65.6 75.6 63.2 71 57.2Z"/><path class="sq-scarf-wash" d="M72.6 52.6C77.4 58.2 84.6 60.4 90.6 58.4L90 63.4C83.4 65.6 75.6 63.2 71 57.2Z"/><path class="sq-line sq-thin" d="M72.6 52.6C77.4 58.2 84.6 60.4 90.6 58.4L90 63.4C83.4 65.6 75.6 63.2 71 57.2Z"/><path class="sq-fine" d="M77 56.8l-1 4.6M81.8 59l-.6 4.6M86.4 59.8l-.2 4.4"/></g>
      <g class="sq-arm"><path class="sq-paper" d="M78.5 62.5C81.5 67.5 86.5 70.8 92 71C95.2 71.2 95.8 74.6 92.8 75.4C87.4 76.6 81.6 73.6 77.4 69Z"/><path class="sq-wash" transform="translate(0.8 0.8)" d="M78.5 62.5C81.5 67.5 86.5 70.8 92 71C95.2 71.2 95.8 74.6 92.8 75.4C87.4 76.6 81.6 73.6 77.4 69Z"/><path class="sq-line" d="M78.5 62.5C81.5 67.5 86.5 70.8 92 71C95.2 71.2 95.8 74.6 92.8 75.4C87.4 76.6 81.6 73.6 77.4 69Z"/><path class="sq-fine" d="M92.6 75.3l.3-1.7"/></g>
      <g class="sq-reach"><path class="sq-paper" d="M78 65.6C87 64.6 98 62 104.6 57C108 53.6 108.2 46 107.8 38.6C107.6 33 107.4 28.8 107.6 25.4C107.9 21.9 111.5 21.3 112.4 23.8C112.9 25.6 112.5 28.4 112.3 31.4C112 38.4 113 47.6 110.8 56C108.4 63.6 97 69.4 84 70.8Z"/><path class="sq-wash" transform="translate(0.8 0.8)" d="M78 65.6C87 64.6 98 62 104.6 57C108 53.6 108.2 46 107.8 38.6C107.6 33 107.4 28.8 107.6 25.4C107.9 21.9 111.5 21.3 112.4 23.8C112.9 25.6 112.5 28.4 112.3 31.4C112 38.4 113 47.6 110.8 56C108.4 63.6 97 69.4 84 70.8Z"/><path class="sq-line" d="M78 65.6C87 64.6 98 62 104.6 57C108 53.6 108.2 46 107.8 38.6C107.6 33 107.4 28.8 107.6 25.4C107.9 21.9 111.5 21.3 112.4 23.8C112.9 25.6 112.5 28.4 112.3 31.4C112 38.4 113 47.6 110.8 56C108.4 63.6 97 69.4 84 70.8Z"/><path class="sq-fine" d="M108.8 22l.4 2M111 22.3l-.3 1.9M107.6 58.2C104.6 61 100.6 63 96.4 64.2"/></g>
      <g class="sq-carried-acorn">${held}</g>
      <g class="sq-holding-paw"><path class="sq-paper" d="M79 64.6C84.6 67.8 90.4 71 96 70.2C99.8 69.6 100.8 72.6 98.4 74.4C92.6 78 83.6 74.4 77.8 69.8Z"/><path class="sq-wash" transform="translate(0.8 0.8)" d="M79 64.6C84.6 67.8 90.4 71 96 70.2C99.8 69.6 100.8 72.6 98.4 74.4C92.6 78 83.6 74.4 77.8 69.8Z"/><path class="sq-line" d="M79 64.6C84.6 67.8 90.4 71 96 70.2C99.8 69.6 100.8 72.6 98.4 74.4C92.6 78 83.6 74.4 77.8 69.8Z"/><path class="sq-fine" d="M95.6 73.2l2.6-1"/></g>
      <g class="sq-exclaim"><path class="sq-line" d="M103.6-13.6C103.1-7.6 102.7-3 102.4.6"/><circle class="sq-ink-fill" cx="102.2" cy="4.8" r="1.25"/><path class="sq-fine" d="M96.2-7.8l-3.2-2.6M110.4-7l3.4-2.2"/></g>
      <g class="sq-zzz"><path class="sq-fine" d="M113 30.4h4.2l-4.2 4.4h4.2"/><path class="sq-fine" d="M119.6 21.4h3l-3 3.2h3"/></g>
      </g>
      </svg>
    </div>
  </div>
  <div class="squirrel-transfer" hidden></div>`;
  document.body.appendChild(stage);

  const actor = stage.querySelector('.squirrel-actor');
  const facing = stage.querySelector('.squirrel-facing');
  const figure = stage.querySelector('.sq-figure');
  const transfer = stage.querySelector('.squirrel-transfer');
  const heldIcon = stage.querySelector('.sq-held-icon');
  const flyingIcon = sourceIcon.cloneNode(true);
  flyingIcon.removeAttribute('class');
  transfer.appendChild(flyingIcon);
  actor.classList.toggle('is-winter', isWinter);

  const TRANSIENT = ['is-running', 'is-reaching', 'is-sniffing', 'is-carrying', 'is-yawning',
    'is-startled', 'is-hurrying', 'is-tucked', 'is-peeking'];

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

  // No requestAnimationFrame loop is running while the feature is idle.
  // Time is scaled by `tempo`, so an impatient visitor can hurry the squirrel.
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
        elapsed += Math.max(0, now - last) * tempo;
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

  function pause(duration, signal) {
    return new Promise(function (resolve, reject) {
      if (signal.aborted) { reject(abortError()); return; }
      const timer = setTimeout(function () {
        signal.removeEventListener('abort', cancel);
        resolve();
      }, duration / tempo);
      function cancel() {
        clearTimeout(timer);
        signal.removeEventListener('abort', cancel);
        reject(abortError());
      }
      signal.addEventListener('abort', cancel, { once: true });
    });
  }

  let boilTimer = 0;
  let boilFrame = 0;
  function startBoil() {
    if (boilTimer || motionPreference.matches) return;
    boilTimer = setInterval(function () {
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
      'px,' + (y - spriteHeight).toFixed(2) + 'px,0)' +
      (spin ? ' rotate(' + spin.toFixed(1) + 'deg)' : '');
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
    if (first && isNight) await holdClass('is-yawning', duration + 520, signal);
    else await sniff(duration, signal);
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
  async function perform(name, script) {
    if (busy) return 'busy';
    busy = true;
    kind = name;
    tempo = 1;
    impatience = 0;
    const controller = new AbortController();
    activeController = controller;
    button.classList.remove('just-returned');
    syncButton();
    status.textContent = '';
    startBoil();
    let result = 'done';
    try {
      await script(measure(), controller.signal);
    } catch (error) {
      result = 'interrupted';
      if (error.name !== 'AbortError') console.error('Squirrel animation:', error);
    } finally {
      stopBoil();
      clearTimeout(startleTimer);
      stage.hidden = true;
      transfer.hidden = true;
      TRANSIENT.forEach(function (name) { actor.classList.remove(name); });
      spin = 0;
      tempo = 1;
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

  /* ---------------- Easter egg: an impatient visitor ----------------
     Pressing the acorn three more times during a visit startles the squirrel
     ("!") and it finishes the trip at a hurry. */
  function growImpatient() {
    impatience += 1;
    if (impatience !== 3 || motionPreference.matches) return;
    tempo = 1.9;
    actor.classList.add('is-startled', 'is-hurrying');
    clearTimeout(startleTimer);
    startleTimer = setTimeout(function () { actor.classList.remove('is-startled'); }, 820);
  }

  /* ---------------- Easter egg: a backflip (the Konami code) ---------------- */
  async function backflip(g, signal) {
    actor.classList.toggle('is-carrying', away);
    face(1);
    if (motionPreference.matches) {
      place(g.width / 2, g.runway);
      stage.hidden = false;
      await pause(900, signal);
      return;
    }
    // A lane a little below the usual runway leaves headroom for the jump.
    const lane = Math.min(g.height - 8, g.runway + (g.width > 700 ? 60 : 38));
    place(-spriteWidth, lane);
    stage.hidden = false;
    const takeoff = g.width * .32;
    const landing = Math.min(g.width - spriteWidth, takeoff + Math.max(110, g.width * .16));
    await runTo(takeoff, lane, 640, 10, signal);
    await sniff(200, signal);
    actor.classList.add('is-tucked');
    await animate(760, function (t) {
      spin = -360 * ease(t);
      place(takeoff + (landing - takeoff) * t, lane - Math.sin(Math.PI * t) * 44);
    }, signal);
    spin = 0;
    actor.classList.remove('is-tucked');
    place(landing, lane);
    await sniff(320, signal);
    await runTo(g.width + spriteWidth, lane, 900, 16, signal);
  }

  /* ---------------- Easter egg: a peek from the bottom edge ----------------
     Typing "acorn" or "squirrel" brings it up for a look around. If the acorn is
     away, it peeks while holding it. */
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
      await pause(1100, signal);
      return;
    }
    await glide(x, shown, 460, signal);
    await sniff(420, signal);
    face(1);
    await pause(340, signal);
    face(-1);
    await sniff(380, signal);
    await glide(x, hidden, 320, signal);
  }

  /* ---------------- Easter egg: hide-and-seek in the footer ----------------
     While the acorn is away, scrolling all the way down once per page finds the
     squirrel there with it. */
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
        perform('peek', peek);
      }, 850);
    }, { threshold: .6 }).observe(footer);
  }

  /* ---------------- Easter egg: an oak in the footer ----------------
     Squirrels forget many of the acorns they bury, and some become oaks. Every
     finished round trip is counted (in this browser only), and the footer grows
     a sprout, then a sapling, then a young oak. */
  const OAK = [
    { at: 3, label: 'A sprout from a forgotten acorn',
      art: '<path class="oak-ground" d="M3.4 17.7c4.2-.5 9-.6 13.2 0"/>' +
        '<path d="M7.3 17.4c.3-1.7 1.5-2.7 2.9-2.7s2.5 1 2.8 2.5"/>' +
        '<path d="M10.1 14.8c.1-1.8 0-3.4-.4-5"/>' +
        '<path class="oak-leaf" d="M9.7 10.6C8.2 8.8 6 8.4 4.8 9c.9 1.8 3 2.6 4.9 1.6Z"/>' +
        '<path class="oak-leaf" d="M9.8 9.9c1.4-2 3.6-2.7 5.1-2.2-.8 2-3 3-5.1 2.2Z"/>' },
    { at: 8, label: 'An oak sapling from a forgotten acorn',
      art: '<path class="oak-ground" d="M3 17.7c4.6-.5 9.4-.6 14 0"/>' +
        '<path d="M10 17.6c.2-4.4-.2-9 .4-13.4"/>' +
        '<path class="oak-leaf" d="M10 13.2c-1.8-.4-3.6-1.6-4-3.2 1.8-.4 3.4.8 4 3.2Z"/>' +
        '<path class="oak-leaf" d="M10.1 10.6c1.6-.8 3.6-1 4.8-.2-1.2 1.4-3 1.6-4.8.2Z"/>' +
        '<path class="oak-leaf" d="M10.2 7.4c-1.4-.6-2.6-1.8-2.8-3.2 1.6 0 2.6 1.4 2.8 3.2Z"/>' +
        '<path class="oak-leaf" d="M10.4 5.2c.6-1.4 1.8-2.4 3.2-2.4-.4 1.6-1.6 2.4-3.2 2.4Z"/>' },
    { at: 20, label: 'A young oak, grown from forgotten acorns',
      art: '<path class="oak-ground" d="M2.6 17.7c5-.5 9.8-.6 14.8 0"/>' +
        '<path d="M10 17.6c.3-2.2.1-4.2-.3-6.4M9.9 13.6l-1.9-1.7M10 12.7l1.7-1.3"/>' +
        '<path class="oak-leaf" d="M5 10.4C3.6 10 3.2 8 4.6 7.2 4.4 5.4 6.2 4.4 7.6 5.2 8.2 3.6 10.6 3.2 11.8 4.6 13.2 3.8 15.2 4.8 15 6.6 16.6 7.2 16.6 9.4 15 10.2 14.6 11.6 12.6 12 11.6 11.2 10.6 12.2 8.6 12.2 7.8 11.2 6.6 11.8 5.2 11.6 5 10.4Z"/>' +
        '<path d="M13.4 17.4c.2-.9.8-1.4 1.5-1.4s1.3.5 1.4 1.3"/>' }
  ];
  const oakNote = 'Squirrels forget many of the acorns they bury. Some grow into oaks.';

  function tripCount() { return parseInt(readStore('localStorage', TRIPS_KEY) || '0', 10) || 0; }

  function oakStage(trips) {
    let stageIndex = 0;
    OAK.forEach(function (step, i) { if (trips >= step.at) stageIndex = i + 1; });
    return stageIndex;
  }

  let oakObserver = null;
  function renderOak() {
    const host = footer && footer.querySelector('.wrap > :last-child');
    if (!host) return;
    const stageIndex = oakStage(tripCount());
    let oak = host.querySelector('.oak');
    if (!stageIndex) { if (oak) oak.remove(); return; }
    if (!oak) {
      oak = document.createElement('span');
      oak.className = 'oak';
      oak.setAttribute('role', 'img');
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
    writeStore('localStorage', TRIPS_KEY, String(tripCount() + 1));
    renderOak();
  }

  /* ---------------- Easter egg: a name that gets denoised ----------------
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
    const timers = [];
    let at = 0;
    // Forward process: mask everything in a few quick steps.
    for (let s = 0; s < noiseSteps; s += 1) {
      const batch = tokens.slice(Math.floor(s * tokens.length / noiseSteps),
        Math.floor((s + 1) * tokens.length / noiseSteps));
      timers.push(setTimeout(function () {
        batch.forEach(function (cell) { cell.classList.add('is-masked'); });
      }, at));
      at += 90;
    }
    at += 420;
    // Reverse process: several tokens are committed in parallel at each step.
    const order = shuffle(tokens.slice());
    for (let s = 0; s < decodeSteps; s += 1) {
      const batch = order.slice(Math.floor(s * order.length / decodeSteps),
        Math.floor((s + 1) * order.length / decodeSteps));
      timers.push(setTimeout(function () {
        batch.forEach(function (cell) {
          cell.classList.remove('is-masked');
          cell.classList.add('is-fresh');
        });
        setTimeout(function () {
          batch.forEach(function (cell) { cell.classList.remove('is-fresh'); });
        }, 120);
      }, at));
      at += 190;
    }
    timers.push(setTimeout(function () {
      el.textContent = text;
      el.removeAttribute('aria-label');
      delete el.dataset.denoising;
    }, at + 700));
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

  /* ---------------- Keyboard: Escape, typed words, the Konami code ---------------- */
  const KONAMI = 'arrowup arrowup arrowdown arrowdown arrowleft arrowright arrowleft arrowright b a';
  let recentKeys = [];
  let typed = '';

  function isEditable(target) {
    return target && (target.isContentEditable ||
      /^(input|textarea|select)$/i.test(target.tagName || ''));
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { if (busy) cancelVisit(); return; }
    if (event.ctrlKey || event.metaKey || event.altKey || isEditable(event.target)) return;
    const key = String(event.key || '').toLowerCase();
    recentKeys = recentKeys.concat(key).slice(-10);
    if (recentKeys.join(' ') === KONAMI) {
      recentKeys = [];
      perform('flip', backflip);
      return;
    }
    if (key.length !== 1 || key < 'a' || key > 'z') return;
    typed = (typed + key).slice(-12);
    if (/(acorn|squirrel)$/.test(typed)) { typed = ''; perform('peek', peek); }
    else if (/mask$/.test(typed)) { typed = ''; denoise(heading); }
  });

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

  /* ---------------- Easter egg: a note for people who open the console ---------------- */
  try {
    console.log('%cA squirrel lives in the acorn at the top of this page.%c\n' +
      'It answers to its own name, to a very old cheat code, and to a name clicked three times. ' +
      'Escape sends it home.',
      'font: 600 15px Georgia, serif; color: #8A5A2B;',
      'font: 13px Georgia, serif; color: #7C6D5F;');
  } catch (_) {}
})();
