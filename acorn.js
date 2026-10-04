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
      'numOctaves="2" seed="' + seed + '"/><feDisplacementMap in="SourceGraphic" scale="1.8" ' +
      'xChannelSelector="R" yChannelSelector="G"/></filter>';
  }).join('');

  // The drawing (traced from Sunwoo's own squirrel). Kept as one string so the
  // first-visit nudge can reuse it with its own ids.
  const ART = `
      <defs><path id="sqp-tail" d="M31.1 -0.3Q27.8 0.0 26.1 0.6Q24.5 1.2 22.9 2.0Q21.4 2.7 19.9 3.8Q18.5 4.9 16.6 7.0Q14.8 9.1 13.7 11.6Q12.6 14.0 12.5 15.1Q12.3 16.3 12.4 19.1Q12.5 21.9 12.9 23.5Q13.4 25.0 14.2 26.4Q15.0 27.7 15.7 28.5Q16.5 29.3 18.5 30.2Q20.4 31.2 22.7 31.3Q25.0 31.4 22.0 35.7Q19.0 39.9 17.6 43.6Q16.1 47.3 15.6 49.4Q15.2 51.6 15.2 52.6Q15.2 53.7 15.0 54.4Q14.8 55.0 14.8 57.0Q14.8 58.9 15.3 62.3Q15.7 65.7 16.5 68.1Q17.3 70.5 18.5 72.8Q19.6 75.0 21.5 77.4Q23.3 79.8 25.0 81.5Q26.8 83.1 28.0 84.1Q29.3 85.1 32.7 86.9Q36.1 88.7 39.5 89.8Q42.9 90.9 45.8 91.3Q48.7 91.7 48.9 91.6Q49.1 91.5 49.0 90.7Q48.9 89.9 46.6 87.8Q44.4 85.6 43.4 83.9Q42.5 82.2 42.1 81.1Q41.7 80.0 41.4 78.4Q41.1 76.7 41.1 74.7Q41.1 72.7 41.5 70.2Q41.9 67.6 42.6 65.5Q43.2 63.4 44.3 61.3Q45.4 59.3 46.6 57.4Q47.9 55.4 49.7 53.2Q51.6 51.0 54.8 48.1Q58.0 45.2 59.5 44.1Q61.1 43.0 63.5 41.8Q65.9 40.5 66.0 37.5Q66.1 34.5 65.8 33.5Q65.5 32.6 65.6 31.2Q65.7 29.9 65.5 28.4Q65.3 27.0 64.3 23.5Q63.2 20.0 61.8 17.3Q60.5 14.6 58.9 12.4Q57.4 10.3 54.6 7.8Q51.8 5.3 49.0 3.7Q46.2 2.2 42.8 1.1Q39.4 0.0 37.0 -0.3Q34.5 -0.5 31.1 -0.3ZM21.3 21.8Q21.2 20.8 21.5 20.2Q21.7 19.6 22.2 19.1Q22.7 18.6 23.1 18.4Q23.5 18.2 24.8 18.2Q26.0 18.2 26.5 18.4Q27.0 18.6 27.7 19.3Q28.3 20.0 28.6 20.9Q28.9 21.7 28.9 22.4Q28.9 23.1 27.8 23.8Q26.6 24.4 25.0 24.5Q23.5 24.6 23.0 24.4Q22.5 24.2 21.9 23.6Q21.4 22.9 21.3 21.8Z"/><path id="sqp-tail-ink" d="M25.3 71.6Q25.0 71.5 25.1 72.2Q25.2 72.9 25.8 74.0Q26.4 75.2 26.6 75.4Q26.8 75.6 27.0 75.6Q27.2 75.6 27.2 75.4Q27.2 75.2 26.5 74.0Q25.8 72.9 25.7 72.3Q25.6 71.7 25.3 71.6ZM26.4 67.8Q26.2 67.8 26.2 68.1Q26.2 68.4 26.9 70.0Q27.6 71.5 27.8 71.5Q27.9 71.5 27.9 71.1Q27.9 70.7 27.3 69.3Q26.6 67.8 26.4 67.8ZM22.5 63.0Q22.3 63.0 22.4 64.2Q22.5 65.5 23.0 66.8Q23.5 68.0 23.8 68.1Q24.1 68.2 23.6 67.0Q23.1 65.7 22.9 64.3Q22.7 63.0 22.5 63.0ZM57.9 21.1Q57.6 21.1 57.8 22.0Q58.0 22.9 58.0 23.6Q58.0 24.2 58.2 24.3Q58.4 24.4 58.5 23.8Q58.6 23.1 58.4 22.1Q58.2 21.1 57.9 21.1ZM53.2 18.3Q52.7 17.3 52.5 17.5Q52.4 17.7 52.8 18.8Q53.3 20.0 53.4 20.8Q53.5 21.5 53.7 21.5Q53.9 21.5 53.8 20.5Q53.7 19.4 53.2 18.3ZM54.2 14.2Q53.9 14.2 54.9 15.6Q55.8 17.1 56.1 17.8Q56.4 18.4 56.7 18.4Q57.0 18.4 56.2 16.9Q55.5 15.3 55.0 14.8Q54.5 14.2 54.2 14.2ZM30.2 0.3Q28.1 0.6 26.3 1.2Q24.5 1.8 23.1 2.5Q21.7 3.1 20.3 4.2Q18.8 5.3 18.0 6.1Q17.1 7.0 16.2 8.2Q15.4 9.3 14.7 10.7Q14.0 12.0 13.4 14.3Q12.8 16.5 12.9 19.1Q13.0 21.7 13.5 23.3Q14.0 24.8 14.7 26.0Q15.4 27.1 16.3 28.1Q17.3 29.1 18.4 29.7Q19.4 30.2 20.6 30.5Q21.7 30.8 23.0 30.8Q24.3 30.8 24.9 30.6Q25.6 30.4 25.8 30.6Q26.0 30.8 22.8 35.6Q19.6 40.3 18.9 41.7Q18.3 43.0 17.5 45.3Q16.7 47.5 16.1 50.8Q15.5 54.1 15.5 57.3Q15.5 60.5 15.9 63.0Q16.3 65.5 17.1 67.9Q17.9 70.3 19.0 72.6Q20.2 74.8 22.0 77.2Q23.9 79.6 25.5 81.2Q27.2 82.7 29.9 84.6Q32.6 86.4 34.6 87.4Q36.7 88.4 39.8 89.3Q42.9 90.3 45.7 90.7Q48.5 91.1 48.4 90.6Q48.3 90.1 48.0 89.9Q47.7 89.7 47.2 89.8Q46.7 89.9 45.0 89.6Q43.2 89.3 39.7 88.2Q36.1 87.0 34.5 86.2Q33.0 85.5 31.3 84.4Q29.7 83.3 28.0 82.0Q26.4 80.6 24.9 79.1Q23.5 77.5 22.2 75.8Q21.0 74.0 20.0 72.2Q19.0 70.3 18.2 67.7Q17.3 65.1 16.9 62.5Q16.5 59.9 16.5 57.5Q16.5 55.0 16.9 52.4Q17.3 49.8 18.3 46.7Q19.2 43.6 20.1 42.1Q21.0 40.5 21.0 40.3Q21.0 40.1 24.7 35.1Q28.3 30.1 29.3 28.2Q30.3 26.4 30.6 25.4Q30.9 24.4 30.9 22.9Q30.9 21.3 30.4 20.3Q29.9 19.2 29.3 18.6Q28.7 18.0 27.8 17.6Q27.0 17.1 25.5 16.8Q24.1 16.5 23.0 16.8Q21.9 17.1 21.7 17.3Q21.4 17.5 20.8 18.1Q20.2 18.8 19.7 20.0Q19.2 21.1 19.2 21.8Q19.2 22.5 19.5 23.3Q19.8 24.1 20.6 24.7Q21.4 25.4 22.3 25.7Q23.3 26.0 24.9 26.0Q26.6 26.0 27.6 25.6Q28.5 25.2 28.7 25.5Q28.9 25.8 28.4 26.9Q27.9 27.9 27.5 28.5Q27.0 29.1 25.8 29.4Q24.7 29.7 23.2 29.7Q21.7 29.7 21.1 29.5Q20.4 29.3 19.3 28.7Q18.3 28.1 17.2 27.1Q16.1 26.0 15.4 24.5Q14.6 23.1 14.2 21.1Q13.8 19.2 13.8 18.0Q13.8 16.9 14.1 15.3Q14.4 13.8 15.0 12.4Q15.5 11.1 16.6 9.6Q17.7 8.2 18.9 7.0Q20.2 5.8 22.4 4.6Q24.7 3.3 26.0 2.8Q27.4 2.4 29.9 1.9Q32.4 1.4 35.1 1.4Q37.8 1.4 39.6 1.7Q41.3 2.0 43.5 2.7Q45.8 3.5 46.9 4.1Q48.1 4.7 49.8 5.8Q51.6 7.0 53.6 8.9Q55.6 10.9 56.7 12.2Q57.8 13.6 58.6 14.8Q59.3 16.1 60.6 18.8Q61.8 21.5 61.8 21.8Q61.8 22.1 62.3 23.3Q62.8 24.4 63.3 26.7Q63.8 28.9 64.0 30.2Q64.2 31.6 64.2 33.1Q64.2 34.5 64.3 34.6Q64.4 34.7 64.3 37.8Q64.2 40.9 64.7 40.6Q65.3 40.3 65.3 39.1Q65.3 37.8 65.4 37.7Q65.5 37.6 65.4 37.5Q65.3 37.4 65.4 37.2Q65.5 37.0 65.5 36.2Q65.5 35.3 65.4 35.2Q65.3 35.1 65.4 34.9Q65.5 34.7 65.4 34.0Q65.3 33.3 65.1 33.1Q64.9 32.8 65.0 31.4Q65.1 30.1 64.8 28.3Q64.6 26.6 63.6 23.4Q62.6 20.2 61.3 17.5Q59.9 14.8 58.4 12.6Q56.8 10.5 55.5 9.2Q54.3 8.0 52.6 6.7Q51.0 5.5 47.8 3.8Q44.6 2.2 42.0 1.4Q39.4 0.6 38.1 0.4Q36.9 0.2 35.8 0.2Q34.7 0.2 34.6 0.1Q34.5 0.0 33.4 0.0Q32.2 0.0 30.2 0.3ZM20.7 21.8Q20.6 20.6 20.9 20.0Q21.2 19.4 21.7 18.8Q22.3 18.2 22.9 17.9Q23.5 17.7 24.8 17.7Q26.0 17.7 26.7 17.9Q27.4 18.2 28.1 19.0Q28.9 19.8 29.2 20.7Q29.5 21.5 29.5 22.4Q29.5 23.3 28.9 23.8Q28.3 24.2 27.5 24.6Q26.6 25.0 25.0 25.1Q23.5 25.2 22.8 24.9Q22.1 24.6 21.5 23.9Q20.8 23.1 20.7 21.8Z"/><path id="sqp-farfoot" d="M88.2 82.0Q86.3 82.0 86.3 85.6Q86.3 89.1 89.1 90.0Q91.9 90.9 92.1 90.8Q92.3 90.7 92.5 90.9Q92.8 91.1 93.0 91.0Q93.2 90.9 93.6 91.1Q94.0 91.3 94.2 91.2Q94.4 91.1 95.8 91.4Q97.3 91.7 99.5 91.7Q101.7 91.7 103.0 91.2Q104.3 90.7 104.7 90.3Q105.0 89.9 104.9 89.0Q104.8 88.2 104.4 87.2Q103.9 86.2 103.5 85.8Q103.1 85.5 101.6 84.6Q100.0 83.7 98.2 83.1Q96.3 82.5 94.6 82.4Q92.8 82.2 92.4 81.9Q91.9 81.6 91.0 81.8Q90.1 82.0 88.2 82.0Z"/><path id="sqp-farfoot-ink" d="M87.9 85.6Q86.8 86.8 86.8 87.8Q86.8 88.7 88.7 89.3Q90.5 89.9 93.9 90.5Q97.3 91.1 99.5 91.1Q101.7 91.1 102.4 90.9Q103.1 90.7 103.8 90.2Q104.5 89.7 104.4 89.0Q104.3 88.4 103.9 87.6Q103.5 86.8 102.3 85.8Q101.2 84.9 99.5 84.2Q97.9 83.5 96.0 83.1Q94.2 82.7 93.5 82.7Q92.8 82.7 92.4 82.5Q91.9 82.4 91.1 82.4Q90.3 82.4 89.6 83.4Q89.0 84.5 87.9 85.6ZM88.0 87.7Q87.8 87.4 88.4 86.8Q89.0 86.2 89.6 85.3Q90.3 84.3 90.8 83.9Q91.3 83.5 91.4 83.6Q91.5 83.7 93.5 83.9Q95.5 84.1 96.7 84.4Q97.9 84.7 99.6 85.6Q101.4 86.6 101.8 87.2Q102.3 87.8 102.5 88.4Q102.7 88.9 102.2 89.4Q101.7 89.9 101.1 90.0Q100.4 90.1 99.0 90.1Q97.7 90.1 97.6 90.0Q97.5 89.9 97.4 90.0Q97.3 90.1 95.0 89.7Q92.6 89.3 92.3 89.1Q91.9 88.9 90.8 88.7Q89.7 88.6 89.0 88.3Q88.2 88.0 88.0 87.7Z"/><path id="sqp-body" d="M101.9 36.8Q101.7 33.7 84.2 33.7Q66.7 33.7 66.8 36.8Q66.9 39.9 66.4 39.9Q65.9 39.9 63.4 41.2Q60.9 42.5 59.7 43.2Q58.6 44.0 56.2 45.8Q53.9 47.7 52.4 49.1Q51.0 50.6 48.5 53.8Q46.0 57.0 44.6 59.4Q43.2 61.8 42.3 64.5Q41.3 67.2 40.9 69.8Q40.5 72.3 40.5 74.7Q40.5 77.1 40.7 78.4Q40.9 79.6 41.4 81.1Q41.9 82.5 42.9 84.3Q43.8 86.0 46.1 88.2Q48.3 90.3 48.4 90.9Q48.5 91.5 49.3 91.6Q50.0 91.7 51.9 92.7Q53.7 93.8 56.5 94.8Q59.3 95.9 64.5 97.1Q69.6 98.2 69.8 98.1Q70.0 98.0 69.9 97.5Q69.8 96.9 70.9 94.4Q71.9 91.8 73.4 91.7Q74.8 91.5 75.2 91.6Q75.6 91.7 75.9 91.5Q76.2 91.3 77.2 91.4Q78.3 91.5 78.6 91.3Q78.9 91.1 81.4 91.1Q83.9 91.1 84.7 90.9Q85.5 90.7 86.2 89.9Q86.8 89.1 86.8 85.8Q86.8 82.5 87.1 82.4Q87.4 82.2 89.5 82.3Q91.7 82.4 92.1 82.2Q92.4 82.0 93.1 80.2Q93.8 78.5 94.2 76.3Q94.6 74.0 93.4 73.3Q92.3 72.5 92.1 60.2Q91.9 47.9 93.0 47.6Q94.2 47.3 94.3 47.4Q94.4 47.5 95.6 47.0Q96.9 46.5 97.2 46.1Q97.5 45.7 99.0 44.8Q100.6 43.8 101.2 44.0Q101.7 44.2 102.5 44.0Q103.3 43.8 103.6 43.5Q103.9 43.2 104.0 42.5Q104.1 41.9 103.9 41.5Q103.7 41.1 102.9 40.5Q102.1 39.9 101.9 36.8ZM65.5 30.7Q65.3 30.6 65.1 30.7Q64.9 30.8 64.9 31.9Q64.9 33.0 65.2 33.3Q65.5 33.5 65.7 33.4Q65.9 33.3 65.8 32.1Q65.7 30.8 65.5 30.7Z"/><path id="sqp-body-ink" d="M83.9 79.5Q83.7 78.9 83.5 79.0Q83.3 79.1 83.4 79.8Q83.5 80.6 83.2 81.7Q82.8 82.7 83.0 82.7Q83.2 82.7 83.4 82.4Q83.7 82.0 83.9 81.1Q84.1 80.2 83.9 79.5ZM81.2 78.3Q81.2 76.7 80.9 76.8Q80.6 76.9 80.6 78.5Q80.6 80.0 80.9 79.9Q81.2 79.8 81.2 78.3ZM93.5 73.9Q93.0 73.6 92.8 75.2Q92.6 76.7 91.7 79.3Q90.7 81.8 91.3 81.7Q91.9 81.6 92.5 79.9Q93.2 78.3 93.6 76.3Q94.0 74.2 93.5 73.9ZM82.3 72.1Q82.0 71.9 81.9 72.2Q81.8 72.5 82.2 73.0Q82.6 73.4 82.8 74.0Q83.0 74.6 83.0 75.4Q83.0 76.2 83.2 76.2Q83.3 76.2 83.4 76.1Q83.5 76.0 83.4 74.9Q83.3 73.8 83.0 73.1Q82.6 72.3 82.3 72.1ZM74.4 55.1Q74.0 55.0 73.9 55.2Q73.7 55.4 73.7 55.7Q73.7 56.0 74.6 57.5Q75.6 58.9 76.6 60.1Q77.5 61.2 77.3 61.4Q77.1 61.6 76.2 61.2Q75.2 60.9 74.2 60.7Q73.3 60.5 71.4 60.5Q69.6 60.5 68.1 60.9Q66.7 61.2 66.1 61.5Q65.5 61.8 65.3 62.1Q65.1 62.4 65.3 62.7Q65.5 63.0 65.9 63.0Q66.3 63.0 66.8 62.7Q67.3 62.4 68.2 62.1Q69.2 61.8 70.9 61.7Q72.7 61.6 74.5 62.1Q76.4 62.6 76.8 62.9Q77.1 63.2 77.5 63.3Q77.9 63.4 79.4 64.4Q80.8 65.5 82.3 67.1Q83.7 68.8 84.1 69.4Q84.5 70.0 85.2 71.5Q85.9 73.1 86.2 74.4Q86.4 75.8 86.4 77.7Q86.4 79.6 86.3 80.8Q86.1 82.0 85.7 83.2Q85.3 84.5 84.5 86.1Q83.7 87.8 82.8 89.1Q81.8 90.5 83.3 90.4Q84.9 90.3 85.6 89.6Q86.3 88.9 86.3 88.2Q86.3 87.4 85.7 88.0Q85.1 88.6 84.9 88.3Q84.7 88.0 85.5 86.4Q86.3 84.9 86.3 83.5Q86.3 82.2 86.4 82.0Q86.6 81.8 86.8 81.8Q87.0 81.8 87.1 81.5Q87.2 81.2 87.3 78.3Q87.4 75.4 87.2 74.3Q87.0 73.3 86.5 71.9Q86.1 70.5 85.0 68.7Q83.9 66.9 84.1 66.7Q84.3 66.5 85.8 67.2Q87.2 68.0 89.4 68.7Q91.7 69.4 91.7 68.8Q91.7 68.2 89.8 67.6Q88.0 67.1 85.5 65.7Q83.0 64.3 82.0 63.6Q81.0 62.8 79.3 61.0Q77.5 59.3 76.2 57.3Q74.8 55.2 74.4 55.1ZM82.7 48.8Q82.4 48.8 82.4 49.4Q82.4 50.0 82.8 51.2Q83.2 52.3 84.1 54.3Q85.1 56.2 86.3 57.9Q87.4 59.5 88.4 60.6Q89.3 61.6 90.4 62.5Q91.5 63.4 91.5 62.6Q91.5 61.8 90.5 61.0Q89.5 60.1 88.4 58.7Q87.2 57.4 85.8 54.8Q84.3 52.3 83.8 50.8Q83.3 49.2 83.2 49.0Q83.0 48.8 82.7 48.8ZM90.8 47.5Q90.1 47.5 90.2 47.6Q90.3 47.7 90.3 50.6Q90.3 53.5 90.9 56.8Q91.5 60.1 91.5 57.1Q91.5 54.1 91.4 54.0Q91.3 53.9 91.3 50.8Q91.3 47.7 91.4 47.6Q91.5 47.5 90.8 47.5ZM65.6 40.8Q65.1 41.1 63.2 42.0Q61.3 42.8 59.4 44.1Q57.6 45.4 55.9 46.7Q54.3 48.1 52.3 50.2Q50.2 52.3 48.4 54.8Q46.5 57.2 45.2 59.6Q43.8 62.0 42.9 64.7Q41.9 67.4 41.5 70.0Q41.1 72.5 41.1 74.7Q41.1 76.9 41.4 78.6Q41.7 80.2 42.7 82.5Q43.6 84.7 44.0 85.3Q44.4 85.8 46.6 88.0Q48.9 90.1 49.0 90.6Q49.1 91.1 49.5 91.1Q50.0 91.1 51.9 92.1Q53.7 93.2 56.5 94.3Q59.3 95.3 64.3 96.5Q69.2 97.7 69.1 97.5Q69.0 97.3 69.2 96.8Q69.4 96.3 65.4 95.4Q61.5 94.6 59.3 93.9Q57.2 93.2 55.0 92.2Q52.7 91.3 50.8 90.0Q48.9 88.7 47.6 87.6Q46.3 86.4 45.2 84.9Q44.0 83.3 43.3 81.8Q42.7 80.2 42.3 78.3Q41.9 76.3 41.9 74.5Q41.9 72.7 42.0 72.6Q42.1 72.5 42.0 72.4Q41.9 72.3 42.3 70.2Q42.7 68.0 43.6 65.4Q44.6 62.8 46.2 60.1Q47.7 57.4 49.8 54.7Q52.0 51.9 53.7 50.2Q55.5 48.5 58.0 46.5Q60.5 44.6 61.3 44.1Q62.0 43.6 64.2 42.6Q66.3 41.7 66.2 41.1Q66.1 40.5 65.6 40.8Z"/><path id="sqp-nearfoot" d="M92.1 96.2Q92.1 95.5 91.9 95.1Q91.7 94.8 90.7 94.0Q89.7 93.2 88.4 92.5Q87.0 91.8 86.1 91.7Q85.1 91.5 85.0 91.3Q84.9 91.1 85.1 91.0Q85.3 90.9 85.3 90.7Q85.3 90.5 85.1 90.4Q84.9 90.3 79.0 90.7Q73.1 91.1 72.1 91.3Q71.1 91.5 70.1 94.6Q69.0 97.7 69.7 98.0Q70.4 98.4 73.8 98.9Q77.1 99.4 79.2 99.9Q81.2 100.4 83.7 100.6Q86.3 100.8 87.3 100.5Q88.4 100.2 88.5 100.3Q88.6 100.4 89.8 99.5Q91.1 98.6 91.6 97.8Q92.1 96.9 92.1 96.2Z"/><path id="sqp-nearfoot-ink" d="M91.5 96.2Q91.5 95.7 91.3 95.3Q91.1 94.9 90.2 94.3Q89.3 93.6 87.8 92.9Q86.3 92.2 85.4 92.0Q84.5 91.8 84.2 91.6Q83.9 91.3 84.1 91.1Q84.3 90.9 84.1 91.0Q83.9 91.1 82.7 91.1Q81.4 91.1 81.3 91.2Q81.2 91.3 78.5 91.4Q75.8 91.5 75.7 91.6Q75.6 91.7 74.7 91.7Q73.9 91.7 73.7 91.8Q73.5 92.0 73.5 92.3Q73.5 92.6 74.0 92.7Q74.6 92.8 75.3 92.6Q76.0 92.4 78.3 92.3Q80.6 92.2 82.4 92.5Q84.1 92.8 86.5 93.7Q89.0 94.6 89.6 95.1Q90.3 95.7 90.4 96.2Q90.5 96.7 89.9 97.4Q89.3 98.0 88.1 98.5Q86.8 99.0 84.2 98.8Q81.6 98.6 78.1 98.0Q74.6 97.5 72.6 97.0Q70.6 96.5 70.3 96.5Q70.0 96.5 69.8 97.0Q69.6 97.5 70.0 97.7Q70.4 97.9 73.8 98.3Q77.1 98.8 79.2 99.3Q81.2 99.8 83.7 100.0Q86.3 100.2 87.2 100.0Q88.2 99.8 89.0 99.4Q89.7 99.0 90.3 98.4Q90.9 97.9 91.2 97.3Q91.5 96.7 91.5 96.2Z"/><path id="sqp-head" d="M93.1 12.1Q92.6 11.5 92.3 11.3Q91.9 11.1 91.1 11.2Q90.3 11.3 89.3 11.8Q88.2 12.4 87.1 13.3Q86.1 14.2 85.4 15.1Q84.7 16.1 82.8 16.0Q80.8 15.9 79.6 16.3Q78.3 16.7 78.2 16.6Q78.1 16.5 77.2 17.0Q76.4 17.5 73.5 15.6Q70.6 13.8 70.0 13.7Q69.4 13.6 69.0 13.9Q68.6 14.2 67.9 15.5Q67.3 16.9 67.0 18.4Q66.7 20.0 66.8 21.2Q66.9 22.5 67.6 24.0Q68.2 25.4 67.8 26.6Q67.3 27.7 66.8 29.8Q66.3 31.8 66.4 35.8Q66.5 39.7 66.2 39.9Q65.9 40.1 66.0 40.8Q66.1 41.5 67.8 42.3Q69.4 43.0 71.4 43.5Q73.5 44.0 76.6 45.1Q79.7 46.1 80.8 46.4Q82.0 46.7 82.2 46.6Q82.4 46.5 83.9 47.0Q85.5 47.5 89.3 47.5Q93.0 47.5 95.2 46.9Q97.3 46.3 98.9 45.3Q100.6 44.2 101.2 44.4Q101.7 44.6 102.2 44.5Q102.7 44.4 103.5 43.9Q104.3 43.4 104.4 42.5Q104.5 41.7 104.3 41.3Q104.1 40.9 103.3 40.3Q102.5 39.7 102.4 37.0Q102.3 34.3 101.7 31.4Q101.2 28.5 99.8 26.0Q98.5 23.5 96.6 21.6Q94.8 19.8 94.7 17.8Q94.6 15.7 94.1 14.3Q93.6 12.8 93.1 12.1Z"/><path id="sqp-head-ink" d="M92.5 12.4Q92.1 11.8 91.3 11.8Q90.5 11.8 89.3 12.5Q88.0 13.2 87.3 13.8Q86.6 14.4 85.9 15.5Q85.1 16.7 84.4 16.6Q83.7 16.5 81.9 16.6Q80.1 16.7 78.7 17.1Q77.3 17.5 76.7 17.9Q76.0 18.2 75.3 17.6Q74.6 16.9 73.7 16.2Q72.7 15.5 71.3 14.8Q70.0 14.2 69.6 14.3Q69.2 14.4 68.6 15.6Q68.0 16.9 67.7 18.5Q67.3 20.2 67.4 21.2Q67.5 22.3 68.2 23.8Q69.0 25.2 68.4 26.6Q67.8 27.9 67.4 30.2Q66.9 32.6 66.9 35.3Q66.9 38.0 67.1 38.9Q67.3 39.7 66.9 40.0Q66.5 40.3 66.7 40.8Q66.9 41.3 67.5 41.2Q68.0 41.1 68.2 40.8Q68.4 40.5 68.1 38.7Q67.8 36.8 67.8 35.0Q67.8 33.2 68.1 31.5Q68.4 29.9 68.8 28.6Q69.2 27.3 69.6 26.8Q70.0 26.2 70.9 26.8Q71.7 27.3 72.0 27.4Q72.3 27.5 72.7 27.4Q73.1 27.3 73.0 27.0Q72.9 26.6 71.9 26.1Q70.9 25.6 70.3 24.9Q69.6 24.2 69.1 23.2Q68.6 22.1 68.7 20.3Q68.8 18.4 69.2 17.3Q69.6 16.1 70.0 15.8Q70.4 15.5 71.1 15.9Q71.9 16.3 73.0 17.1Q74.0 17.9 74.9 18.7Q75.8 19.6 76.6 20.7Q77.3 21.7 77.7 21.6Q78.1 21.5 78.0 21.0Q77.9 20.6 77.4 20.0Q77.0 19.4 77.2 19.0Q77.5 18.6 78.2 18.3Q78.9 18.0 80.5 17.8Q82.2 17.5 82.3 17.6Q82.4 17.7 83.6 17.7Q84.9 17.7 86.6 18.0Q88.4 18.4 90.5 19.4Q92.6 20.4 93.7 21.1Q94.8 21.9 95.9 23.2Q97.1 24.4 98.2 26.4Q99.2 28.3 99.6 29.5Q100.0 30.6 100.4 32.9Q100.8 35.1 100.9 37.3Q101.0 39.5 100.0 40.2Q99.0 40.9 99.1 42.0Q99.2 43.0 98.8 43.4Q98.5 43.8 96.9 44.6Q95.4 45.4 93.6 45.7Q91.9 46.1 89.0 46.0Q86.1 45.9 84.5 45.6Q83.0 45.2 81.7 44.6Q80.4 44.0 80.0 44.0Q79.5 44.0 79.4 44.3Q79.3 44.6 79.5 44.8Q79.7 45.0 80.2 45.3Q80.8 45.6 83.2 46.2Q85.5 46.9 89.3 46.9Q93.0 46.9 95.2 46.3Q97.3 45.7 98.5 45.1Q99.6 44.4 100.0 44.0Q100.4 43.6 101.1 43.8Q101.7 44.0 102.5 43.8Q103.3 43.6 103.5 43.4Q103.7 43.2 103.8 42.5Q103.9 41.9 103.7 41.5Q103.5 41.1 102.7 40.5Q101.9 39.9 101.7 36.4Q101.6 33.0 100.9 30.4Q100.2 27.9 99.7 26.9Q99.2 25.8 98.6 24.7Q97.9 23.7 96.0 21.8Q94.2 20.0 94.1 17.9Q94.0 15.9 93.5 14.5Q93.0 13.0 92.5 12.4ZM86.8 16.8Q86.6 16.5 87.0 15.9Q87.4 15.3 88.3 14.6Q89.2 13.8 89.8 13.4Q90.5 13.0 91.0 12.9Q91.5 12.8 91.8 13.2Q92.1 13.6 92.4 14.7Q92.8 15.7 93.0 17.3Q93.2 18.8 92.9 19.0Q92.6 19.2 91.3 18.5Q89.9 17.9 88.5 17.5Q87.0 17.1 86.8 16.8Z"/><path id="sqp-near-paw" d="M89 66.7C91.4 67.6 94 68 96 67.9C97.8 67.9 98.6 69.6 97.6 70.8C96.6 71.8 94.4 71.8 92 71.5C90.8 71.3 89.8 71.1 89 71Z"/><path id="sqp-top-paw" d="M89.8 51.4C92.4 53.4 94.8 55.6 96.6 57.6C97.8 59 97.4 61 95.8 61.4C94.2 61.8 92.4 60.8 90.4 59.6Z"/><path id="sqp-reach" d="M87.8 48.8C93.6 45.6 98.6 41 102.6 35.6C105.6 31.6 107.8 27.6 109.4 24.2C110.8 21 114.4 19.6 116.8 21.2C119 22.8 118.8 25.8 117.2 28.4C114.6 32.6 111.4 37.4 107.6 41.8C102.6 47.6 96.8 52.8 90.6 57.2Z"/><clipPath id="sq-clip-tail"><use href="#sqp-tail"/></clipPath><clipPath id="sq-clip-body"><use href="#sqp-body"/></clipPath><clipPath id="sq-clip-head"><use href="#sqp-head"/></clipPath><clipPath id="sq-clip-hind"><use href="#sqp-nearfoot"/></clipPath></defs>
      <path class="sq-ground" d="M50 100.6c14-.7 36-.9 54-.1M58 102.4c9-.4 20-.4 30 .1"/>
      <g class="sq-tail"><use href="#sqp-tail" class="sq-paper"/><use href="#sqp-tail" class="sq-wash"/><path class="sq-texture" clip-path="url(#sq-clip-tail)" d="M51.8 5.4L63.8 27.9M48.3 2.9L65.7 35.6M45.1 0.8L66.4 40.9M41.9 -1L66.8 45.7M39.6 -1.3L66.5 49.2M37.4 -1.5L66.4 53.2M35.4 -1.3L66.2 56.7M33.2 -1.4L65.9 60.3M31.6 -0.3L65.3 63.2M29.5 -0.1L65.3 67.1M27.9 0.9L64.3 69.3M26.3 1.9L63.8 72.5M24.6 2.8L62.9 74.8M22.9 3.7L62.2 77.6M21.5 5.1L61.1 79.5M20 6.2L60.1 81.8M18.8 8.2L59.2 84M17.2 9.1L58 85.8M16.2 11.3L56.6 87.2M15.1 13.2L55.5 89.3M13.6 14.5L54.3 91M12.7 16.8L52.9 92.5M11.9 19.3L51.8 94.5M10.6 21L50 95.1M9.8 23.5L49 97.2M8.7 25.5L47.2 97.9M8.4 29.1L45.5 98.8M7.5 31.3L43.8 99.7M7.1 34.7L42 100.2M6.4 37.3L40 100.5M6 40.6L38.1 101M5.3 43.4L36 101.1M5.5 47.8L34.1 101.6M5 51L31.8 101.3M5.7 56.3L29 100.1M5.8 60.6L26 98.5M6.9 66.6L22.9 96.8M8.5 73.6L19 93.4"/><use href="#sqp-tail-ink" class="sq-ink"/><use href="#sqp-tail-ink" class="sq-ink sq-ink-ghost"/></g>
      <g class="sq-hind-far"><use href="#sqp-farfoot" class="sq-paper"/><use href="#sqp-farfoot" class="sq-wash"/><use href="#sqp-farfoot-ink" class="sq-ink"/><use href="#sqp-farfoot-ink" class="sq-ink sq-ink-ghost"/></g>
      <g class="sq-body"><use href="#sqp-body" class="sq-paper"/><use href="#sqp-body" class="sq-wash"/><path class="sq-texture" clip-path="url(#sq-clip-body)" d="M99.1 54.5L106.3 68M95.2 51.1L106.9 73.1M91.7 48.7L106.8 77.1M88.7 47.1L106.2 80M86.2 46.4L105 81.7M83.6 45.5L104.4 84.6M81 44.6L103.1 86.4M78.5 44.1L102.5 89.1M76 43.3L100.8 90M74.2 44L99.5 91.6M71.8 43.6L98.6 93.9M69.7 43.7L97.1 95.2M67.9 44.3L95.3 95.9M65.4 43.7L93.8 97.1M63.6 44.4L92.6 99M61.5 44.5L90.7 99.4M60.1 45.9L88.9 100M58.2 46.4L87.4 101.3M56.4 47L85.5 101.7M54.8 48L83.7 102.3M53.3 49.2L82 103.2M51.1 49.2L80.2 103.9M49.8 50.7L78.3 104.4M48.4 52.3L76 104.1M47 53.6L74.1 104.5M45.3 54.4L72 104.7M43.8 55.7L69.8 104.7M42.7 57.7L67.3 103.8M41.8 60.1L65.3 104.2M40.7 62L62.7 103.3M39.4 63.6L60.3 102.9M38.4 65.7L57.3 101.3M37.7 68.4L54.5 100.1M37.6 72.3L51.8 99M37.4 76.1L48.4 96.7M38 81.2L43.9 92.3"/><path class="sq-belly" d="M85.4 67.6Q84.9 67.4 85.6 68.7Q86.3 70.0 86.5 70.2Q86.8 70.3 86.9 71.1Q87.0 71.9 87.3 72.4Q87.6 72.9 87.7 74.3Q87.8 75.8 88.0 76.1Q88.2 76.3 88.1 78.6Q88.0 80.8 87.8 81.1Q87.6 81.4 87.7 81.9Q87.8 82.4 88.8 82.4Q89.7 82.4 90.3 81.3Q90.9 80.2 91.6 78.1Q92.3 76.0 92.3 75.2Q92.3 74.4 92.4 73.8Q92.6 73.3 92.3 73.0Q91.9 72.7 91.9 71.3Q91.9 70.0 91.1 69.9Q90.3 69.8 90.2 70.2Q90.1 70.5 89.4 70.7Q88.8 70.9 87.8 70.2Q86.8 69.4 86.8 69.0Q86.8 68.6 86.4 68.5Q86.1 68.4 86.0 68.1Q85.9 67.8 85.4 67.6ZM86.2 48.2Q85.3 48.1 84.9 48.6Q84.5 49.0 84.2 49.1Q83.9 49.2 84.2 50.4Q84.5 51.6 86.0 54.2Q87.4 56.8 88.6 58.2Q89.7 59.7 90.5 60.4Q91.3 61.0 91.0 60.2Q90.7 59.3 90.2 56.3Q89.7 53.3 89.7 50.6Q89.7 47.9 88.8 47.8Q87.8 47.7 87.4 48.0Q87.0 48.3 86.2 48.2Z"/><use href="#sqp-body-ink" class="sq-ink"/><use href="#sqp-body-ink" class="sq-ink sq-ink-ghost"/><path class="sq-line" d="M91.6 61.4C91.8 63.2 91.9 65.2 92 67.2"/></g>
      <g class="sq-hind-near"><use href="#sqp-nearfoot" class="sq-paper"/><use href="#sqp-nearfoot" class="sq-wash"/><path class="sq-texture" clip-path="url(#sq-clip-hind)" d="M97.6 90.8L99.8 95M94.9 89.8L99 97.4M92.1 88.6L97.5 98.6M89.5 87.7L95.7 99.3M87.5 88L94.5 101.1M85.3 87.8L92.2 100.9M83.1 87.7L90.4 101.6M80.7 87.4L88.9 102.7M79 88.2L86.3 101.9M77.2 88.8L84.3 102.3M75.6 90L82.3 102.6M74 90.8L80 102.2M72 91.3L77.3 101.3M70.8 93.1L74.8 100.6M70.1 95.7L71.5 98.3"/><use href="#sqp-nearfoot-ink" class="sq-ink"/><use href="#sqp-nearfoot-ink" class="sq-ink sq-ink-ghost"/></g>
      <g class="sq-scarf sq-scarf-end"><path class="sq-paper" d="M68 47.6C63.4 50 59.6 53.6 57.4 58.6L61.6 59.8C63.4 55.6 66.4 52.6 70.6 50.6Z"/><path class="sq-scarf-wash" d="M68 47.6C63.4 50 59.6 53.6 57.4 58.6L61.6 59.8C63.4 55.6 66.4 52.6 70.6 50.6Z"/><path class="sq-line sq-thin" d="M68 47.6C63.4 50 59.6 53.6 57.4 58.6L61.6 59.8C63.4 55.6 66.4 52.6 70.6 50.6M57.8 59l-1.3 2.4M59.8 59.6l-.8 2.6"/></g>
      <g class="sq-head"><use href="#sqp-head" class="sq-paper"/><use href="#sqp-head" class="sq-wash"/><path class="sq-texture" clip-path="url(#sq-clip-head)" d="M100.2 13.6L107.8 28M96.8 11.3L107.7 31.9M93.8 9.7L106.9 34.4M91.7 9.7L106.5 37.7M89 8.7L105.5 39.8M86.6 8.4L104.3 41.6M84.6 8.7L102.7 42.6M82.7 9L101.5 44.4M80.4 8.8L99.8 45.3M78.5 9.2L98.4 46.7M76.6 9.8L96.9 47.8M74.9 10.5L95.4 49.2M73.1 11.3L93.7 50M71.9 13L91.7 50.3M70.1 13.7L89.8 50.7M68.8 15.3L87.8 51.1M67.6 17L85.9 51.5M65.9 17.9L83.8 51.7M64.9 20.2L81.5 51.2M64 22.5L78.9 50.4M63.2 25L76.6 50.2M62.6 27.8L73.6 48.5M62 30.9L70.7 47.1M63.4 37.6L65.8 42"/><use href="#sqp-head-ink" class="sq-ink"/><use href="#sqp-head-ink" class="sq-ink sq-ink-ghost"/>
      <g class="sq-eye"><ellipse class="sq-ink-fill sq-feature" cx="84.02" cy="36.02" rx="2.75" ry="2.9"/><circle class="sq-glint" cx="85.52" cy="36.22" r=".72"/></g><path class="sq-ink-fill sq-feature sq-yawn" d="M89.6 46.4C90.8 49.4 94.4 49.6 95.8 46.8C93.8 47.4 91.6 47.2 89.6 46.4Z"/></g>
      <g class="sq-scarf"><path class="sq-paper" d="M66.4 44.8C72.4 49.8 85 51 99.4 46.6L99.8 51.2C84.8 55.8 71.6 54.6 64.8 49.4Z"/><path class="sq-scarf-wash" d="M66.4 44.8C72.4 49.8 85 51 99.4 46.6L99.8 51.2C84.8 55.8 71.6 54.6 64.8 49.4Z"/><path class="sq-line sq-thin" d="M66.4 44.8C72.4 49.8 85 51 99.4 46.6L99.8 51.2C84.8 55.8 71.6 54.6 64.8 49.4Z"/><path class="sq-fine" d="M72.4 48.8l-1 4.6M79.4 50.6l-.6 4.6M86.6 50.8l-.2 4.4M93.4 49.6l.2 4.2"/></g>
      <g class="sq-carried-acorn">${held}</g>
      <g class="sq-near-paw"><use href="#sqp-near-paw" class="sq-paper"/><use href="#sqp-near-paw" class="sq-wash"/><path class="sq-line" d="M89 66.7C91.4 67.6 94 68 96 67.9C97.8 67.9 98.6 69.6 97.6 70.8C96.6 71.8 94.4 71.8 92 71.5C90.8 71.3 89.8 71.1 89 71"/></g>
      <g class="sq-arm"><use href="#sqp-top-paw" class="sq-paper"/><use href="#sqp-top-paw" class="sq-wash"/><path class="sq-line" d="M89.8 51.4C92.4 53.4 94.8 55.6 96.6 57.6C97.8 59 97.4 61 95.8 61.4C94.2 61.8 92.4 60.8 90.4 59.6"/></g>
      <g class="sq-reach"><use href="#sqp-reach" class="sq-paper"/><use href="#sqp-reach" class="sq-wash"/><path class="sq-line" d="M87.8 48.8C93.6 45.6 98.6 41 102.6 35.6C105.6 31.6 107.8 27.6 109.4 24.2C110.8 21 114.4 19.6 116.8 21.2C119 22.8 118.8 25.8 117.2 28.4C114.6 32.6 111.4 37.4 107.6 41.8C102.6 47.6 96.8 52.8 90.6 57.2"/><path class="sq-fine" d="M112.6 21l.7 1.8M115.4 20.6l.2 1.9"/></g>
      <g class="sq-exclaim"><path class="sq-line" d="M103.6-11.6C103.1-5.6 102.7-1.6 102.4 1.6"/><circle class="sq-ink-fill" cx="102.2" cy="5.6" r="1.25"/><path class="sq-fine" d="M96.2-6l-3.2-2.6M110.4-5.2l3.4-2.2"/></g>
      <g class="sq-zzz"><path class="sq-fine" d="M104 18.4h4.2l-4.2 4.4h4.2"/><path class="sq-fine" d="M110.6 9.4h3l-3 3.2h3"/></g>`;

  const stage = document.createElement('div');
  stage.className = 'squirrel-stage';
  stage.hidden = true;
  // The drawing below is traced from Sunwoo's own squirrel drawing (mirrored to face
  // right, tail and body made a little plumper) and finished like a coloured-pencil sketch.
  stage.innerHTML = `
  <button type="button" class="squirrel-actor" aria-label="The squirrel. Click it for a hint.">
    <span class="squirrel-facing">
      <svg class="squirrel-art" viewBox="0 0 128 104" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>${roughness}</defs>
      <g class="sq-figure" filter="url(#sq-rough-0)">
      ${ART}
      </g>
      </svg>
    </span>
    <span class="sq-bubble" aria-hidden="true"></span>
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
    <p class="sq-fortune-note" hidden></p>
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
  const bubble = stage.querySelector('.sq-bubble');
  const transfer = stage.querySelector('.squirrel-transfer');
  const heldIcon = stage.querySelector('.sq-held-icon');
  const fortuneNut = stage.querySelector('.sq-fortune-nut');
  const fortuneSlip = stage.querySelector('.sq-fortune-slip');
  const fortuneText = stage.querySelector('.sq-fortune-text');
  const fortuneNote = stage.querySelector('.sq-fortune-note');
  const fortuneCount = stage.querySelector('.sq-fortune-count');
  const fortuneTurns = Array.from(stage.querySelectorAll('.sq-fortune-turn'));
  const flyingIcon = sourceIcon.cloneNode(true);
  flyingIcon.removeAttribute('class');
  transfer.appendChild(flyingIcon);
  actor.classList.toggle('is-winter', isWinter);

  const TRANSIENT = ['is-running', 'is-reaching', 'is-sniffing', 'is-carrying', 'is-yawning',
    'is-startled', 'is-hurrying', 'is-peeking', 'is-frozen', 'is-presenting', 'is-noticing', 'is-calling'];

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
  // Once everything is found, this line sits above whichever hint is showing.
  const ALL_FOUND = 'All seven found. The only secret left is where I buried last year’s acorns.';

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
    actor.classList.toggle('faces-left', direction < 0);
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
    // Its raised paw (drawn at 115.3, 22.8) meets the exact center of the button.
    const dock = { x: target.x - (115.3 - 64) * scale, y: target.y + (104 - 22.8) * scale };
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
    if (first) await callOut(signal);
  }

  /* ---------------- "click me!": a speech bubble until the squirrel has been clicked once ----------------
     Mid-errand the squirrel stops, looks out and says so in a comic bubble. The bubble
     stays for the next stretch of the run, and never shows again once someone has
     clicked the squirrel (remembered in localStorage). */
  const CLICKED_KEY = 'sunwoo.squirrel.clicked.v1';
  let callTimer = 0;
  function everClicked() { return readStore('localStorage', CLICKED_KEY) === '1'; }
  function hushCall() { clearTimeout(callTimer); actor.classList.remove('is-calling'); }
  async function callOut(signal) {
    if (everClicked() || motionPreference.matches) return;
    const touch = window.matchMedia && window.matchMedia('(hover: none)').matches;
    bubble.textContent = touch ? 'tap me!' : 'click me!';
    actor.classList.add('is-calling');
    clearTimeout(callTimer);
    callTimer = setTimeout(hushCall, 3200);
    await pause(1150, signal);
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
    endNudge();
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
      clearTimeout(callTimer);
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
    stopNudging();
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
     arrow keys) turn back to every hint already handed out. Once all seven are
     found, it hands them out again in order, numbered as always. */
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
    // All found: hand them out again in order, one per click.
    if (!egg) egg = EGGS[hintCursor % EGGS.length];
    hintCursor = (EGGS.indexOf(egg) + 1) % EGGS.length;
    given.add(egg.id);
    writeStore('localStorage', HINTS_KEY, JSON.stringify(Array.from(given)));
    return egg;
  }

  // Every hint handed out or egg found, in order. Each page is one numbered hint.
  function buildPages() {
    const found = foundSet();
    const given = hintSet();
    return EGGS.filter(function (item) { return found.has(item.id) || given.has(item.id); })
      .map(function (item) { return { egg: item }; });
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
    const isFound = found.has(page.egg.id);
    const allFound = EGGS.every(function (item) { return found.has(item.id); });
    fortuneNote.hidden = !allFound;
    fortuneNote.textContent = allFound ? ALL_FOUND : '';
    fortuneText.innerHTML = (isFound ? CHECK : '') + page.egg.hint;
    // Each easter egg keeps its own number, so the count changes as you turn.
    fortuneCount.textContent = 'Hint ' + (EGGS.indexOf(page.egg) + 1) + ' of ' + EGGS.length;
    fortuneTurns.forEach(function (turn) { turn.hidden = fortunePages.length < 2; });
    layoutSlip();
    status.textContent = (allFound ? ALL_FOUND + ' ' : '') + (isFound ? 'Found. ' : '') +
      fortuneText.textContent + ' ' + fortuneCount.textContent + '.';
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
    hushCall();
    writeStore('localStorage', CLICKED_KEY, '1');
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
    showPage(Math.max(0, fortunePages.findIndex(function (page) { return page.egg === egg; })));
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
  const PROVERB = 'Mighty oaks from little acorns grow.';

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
    const grown = stageIndex === OAK.length;
    oak.setAttribute('aria-label', step.label + '. ' + (grown ? PROVERB : oakNote));
    oak.title = grown ? PROVERB : oakNote;
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
      if (stageIndex === OAK.length) setTimeout(function () { showProverb(oak); }, 950);
    }, { threshold: 1 });
    oakObserver.observe(oak);
  }

  // The reward for growing the oak all the way: the proverb, on a slip under it.
  function showProverb(oak) {
    if (!oak.isConnected) return;
    const slip = document.createElement('div');
    slip.className = 'oak-proverb';
    slip.setAttribute('aria-hidden', 'true');
    slip.textContent = PROVERB;
    document.body.appendChild(slip);
    const r = oak.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    const w = slip.offsetWidth;
    slip.style.left = Math.max(8, Math.min(width - w - 8, r.left + r.width / 2 - w / 2)).toFixed(1) + 'px';
    slip.style.top = (nav.getBoundingClientRect().bottom + 8).toFixed(1) + 'px';
    void slip.offsetWidth;
    slip.classList.add('is-open');
    status.textContent = PROVERB;
    setTimeout(function () {
      slip.classList.remove('is-open');
      setTimeout(function () { slip.remove(); }, 450);
    }, 5200);
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

  /* ---------------- A nudge toward the acorn ----------------
     On every visit (browser tab session) until the acorn is pressed: the squirrel
     hangs upside down from under the menu right below the acorn, eyes it, the
     acorn wobbles, and the squirrel slips back up. At most three times a visit,
     about 3 s after the page opens, then 10 s and 20 s after the previous one.
     It waits while the visitor is scrolling or away from the tab, and stops for
     the rest of the visit once the acorn is pressed. Skipped with reduced motion. */
  const NUDGE_COUNT_KEY = 'sunwoo.squirrel.nudges.v1';   // sessionStorage: nudges shown this visit
  const NUDGE_DONE_KEY = 'sunwoo.squirrel.nudge-done.v1'; // sessionStorage: acorn pressed this visit
  const NUDGE_GAPS = [3000, 10000, 20000];
  const NUDGE_LENGTH = 2950;
  const HANG_ART = ART.replace(/sqp-/g, 'sqhp-').replace(/sq-clip-/g, 'sqh-clip-');
  let hang = null;
  let nudgeTimers = [];
  let nudgeWait = 0;
  let lastScroll = 0;
  window.addEventListener('scroll', function () { lastScroll = Date.now(); }, { passive: true });

  function nudgesShown() { return parseInt(readStore('sessionStorage', NUDGE_COUNT_KEY) || '0', 10) || 0; }
  function nudgesDone() { return readStore('sessionStorage', NUDGE_DONE_KEY) === '1' || motionPreference.matches; }

  function endNudge() {
    nudgeTimers.forEach(clearTimeout);
    nudgeTimers = [];
    button.classList.remove('is-nudged');
    if (hang) { hang.remove(); hang = null; }
  }

  function stopNudging() {
    writeStore('sessionStorage', NUDGE_DONE_KEY, '1');
    clearTimeout(nudgeWait);
    endNudge();
  }

  function scheduleNudge() {
    clearTimeout(nudgeWait);
    const shown = nudgesShown();
    if (nudgesDone() || shown >= NUDGE_GAPS.length) return;
    nudgeWait = setTimeout(tryNudge, NUDGE_GAPS[shown]);
  }

  // Only in a quiet moment: not while scrolling, in another tab, or mid-scene.
  function tryNudge() {
    if (nudgesDone()) return;
    if (document.hidden || busy || away || fortuneOpen || hang || Date.now() - lastScroll < 2000) {
      nudgeWait = setTimeout(tryNudge, 1000);
      return;
    }
    writeStore('sessionStorage', NUDGE_COUNT_KEY, String(nudgesShown() + 1));
    showNudge();
    nudgeWait = setTimeout(scheduleNudge, NUDGE_LENGTH);
  }

  function showNudge() {
    const rect = sourceIcon.getBoundingClientRect();
    const width = document.documentElement.clientWidth <= 700 ? 78 : 88;
    const s = width / 128;
    hang = document.createElement('div');
    hang.className = 'sq-hang';
    hang.setAttribute('aria-hidden', 'true');
    // Its head (drawn around x = 84) hangs right below the acorn.
    hang.style.left = (rect.left + rect.width / 2 - 84 * s).toFixed(1) + 'px';
    hang.style.top = nav.getBoundingClientRect().bottom.toFixed(1) + 'px';
    hang.style.width = width + 'px';
    hang.style.height = (104 * s).toFixed(1) + 'px';
    hang.innerHTML = '<div class="sq-hang-body"><svg class="squirrel-art" viewBox="0 0 128 104" fill="none">' +
      '<defs><filter id="sqh-rough" x="-8%" y="-14%" width="116%" height="128%" color-interpolation-filters="sRGB">' +
      '<feTurbulence type="fractalNoise" baseFrequency=".08" numOctaves="2" seed="3"/>' +
      '<feDisplacementMap in="SourceGraphic" scale="1.8" xChannelSelector="R" yChannelSelector="G"/></filter></defs>' +
      '<g filter="url(#sqh-rough)">' + HANG_ART + '</g></svg></div>';
    document.body.appendChild(hang);
    nudgeTimers.push(setTimeout(function () { button.classList.add('is-nudged'); }, 1150));
    nudgeTimers.push(setTimeout(endNudge, NUDGE_LENGTH));
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
    endNudge();
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
  scheduleNudge();
})();
