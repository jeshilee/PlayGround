(() => {
  'use strict';
  const canvas = document.getElementById('view');
  const ctx = canvas.getContext('2d', { alpha: false });
  const $ = (id) => document.getElementById(id);
  const game = $('game');
  const UI = {
    start: $('startScreen'), letter: $('letterScreen'), end: $('endScreen'),
    startButton: $('startButton'), closeLetter: $('closeLetter'), restart: $('restartButton'),
    objective: $('objectiveText'), memory: $('memoryCount'), status: $('statusText'),
    prompt: $('prompt'), promptText: $('promptText'), message: $('message'),
    letterTitle: $('letterTitle'), letterBody: $('letterBody'), endTitle: $('endTitle'), endText: $('endText')
  };
  const W = 19, H = 19;
  const world = Array.from({ length: H }, () => Array(W).fill(1));
  const carve = (x, y) => { if (x > 0 && y > 0 && x < W - 1 && y < H - 1) world[y][x] = 0; };
  // The mansion is arranged around a long gallery and four sealed-off family rooms.
  for (let y = 1; y < 18; y++) for (let x = 8; x <= 10; x++) carve(x, y);
  for (let y = 8; y <= 10; y++) for (let x = 1; x < 18; x++) carve(x, y);
  const room = (x1, y1, x2, y2, doorX, doorY) => {
    for (let y = y1 + 1; y < y2; y++) for (let x = x1 + 1; x < x2; x++) carve(x, y);
    carve(doorX, doorY);
  };
  room(1, 1, 6, 6, 4, 6); carve(4, 7);
  room(12, 1, 17, 6, 12, 4);
  for (let y = 4; y <= 8; y++) carve(11, y);
  room(1, 12, 6, 17, 6, 14); carve(7, 14);
  room(12, 12, 17, 17, 12, 14); carve(11, 14);

  const memories = [
    { x: 3.45, y: 2.2, name: 'The Girl in the Blue Room', title: 'The first memory', body: '“Mother said the house was listening. I told her houses don’t have ears. She put another lock on my door anyway.” The paint is still wet beneath your fingers.', found: false, color: '#526b70' },
    { x: 14.45, y: 3.55, name: 'The Woman at the Window', title: 'The second memory', body: '“I can see the garden from here, but the window only shows me the room. A woman is standing behind my reflection. She has my hands.”', found: false, color: '#855f4e' },
    { x: 3.45, y: 14.45, name: 'The Last Supper', title: 'The last memory', body: '“If anyone finds this: I was not the thing in the pictures. I was the one who kept painting the door shut.” A little brass key slips from the frame.', found: false, color: '#71604f' }
  ];
  const paintings = memories.map((m, i) => ({ ...m, image: makePortrait(m.color, i), important: true }));
  paintings.push({ x: 15.4, y: 14.55, image: makePortrait('#766d59', 3), important: false, name: 'The Empty Frame' });
  paintings.push({ x: 4.9, y: 4.75, image: makePortrait('#514c54', 4), important: false, name: 'A faded portrait' });
  const exit = { x: 9.5, y: 16.65 };
  const ghostImage = makeGhost();
  const wallTexture = makeWallTexture();

  let width = 0, height = 0, lastTime = 0, running = false, paused = false, over = false;
  let player = { x: 9.5, y: 2.5, angle: Math.PI / 2 };
  let ghost = { x: 9.45, y: 6.4, active: false, speed: .62, pathTime: 0, target: null, pulse: 0 };
  let lightOn = true, foundCount = 0, currentTarget = null, messageTimer = 0, bob = 0, stamina = 1, hurtTimer = 0;
  const keys = new Set();
  const joy = { x: 0, y: 0, active: false, id: null };
  let lookTouch = null;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = Math.max(320, Math.floor(innerWidth * dpr));
    height = Math.max(240, Math.floor(innerHeight * dpr));
    canvas.width = width; canvas.height = height;
  }
  window.addEventListener('resize', resize); resize();

  function makeWallTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 128, 0); grad.addColorStop(0, '#30271f'); grad.addColorStop(.48, '#42352a'); grad.addColorStop(1, '#281f1a');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(190,158,121,.07)'; g.fillRect(0, 0, 128, 5); g.fillRect(0, 99, 128, 4);
    g.fillStyle = 'rgba(14,10,8,.35)'; g.fillRect(0, 104, 128, 24);
    for (let y = 108; y < 128; y += 5) { g.strokeStyle = `rgba(174,132,89,${.06 + Math.random() * .07})`; g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${Math.random() > .5 ? '205,173,136' : '5,4,4'},${Math.random() * .08})`; g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 3, 1); }
    g.strokeStyle = 'rgba(216,187,148,.06)'; g.lineWidth = 2; g.strokeRect(4, 8, 120, 84);
    return c;
  }

  function makePortrait(accent, seed) {
    const c = document.createElement('canvas'); c.width = 160; c.height = 224;
    const g = c.getContext('2d');
    const r = (x, y, w, h, color) => { g.fillStyle = color; g.fillRect(x, y, w, h); };
    r(0, 0, 160, 224, '#100d0b');
    const bg = g.createRadialGradient(80, 80, 5, 80, 98, 120); bg.addColorStop(0, accent); bg.addColorStop(1, '#17110f'); r(8, 8, 144, 208, bg);
    r(15, 15, 130, 194, 'rgba(7,6,5,.22)');
    // Gold leaf frame and inset canvas
    g.strokeStyle = '#9b7449'; g.lineWidth = 7; g.strokeRect(4, 4, 152, 216); g.strokeStyle = '#d1ae77'; g.lineWidth = 1; g.strokeRect(10, 10, 140, 204);
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#c39a66' : '#705037'; g.beginPath(); g.arc(i < 2 ? 8 : 152, i % 2 ? 8 : 216, 3, 0, Math.PI * 2); g.fill(); }
    // Shoulder silhouette, collar and face
    g.fillStyle = '#201814'; g.beginPath(); g.ellipse(80, 192, 52, 48, 0, Math.PI, 0); g.fill();
    g.fillStyle = seed % 2 ? '#d0b69b' : '#b99e84'; g.beginPath(); g.ellipse(80, 100, 33, 47, -.04, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#241816'; g.beginPath(); g.ellipse(80, 67, 39, 32, 0, Math.PI, 0); g.fill(); g.fillRect(42, 66, 13, 30); g.fillRect(105, 63, 13, 40);
    g.fillStyle = '#2c211c'; g.beginPath(); g.ellipse(67, 102, 3.7, 2, 0, 0, Math.PI * 2); g.ellipse(93, 102, 3.7, 2, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(83,48,42,.65)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(72, 123); g.quadraticCurveTo(80, 119, 88, 123); g.stroke();
    g.fillStyle = 'rgba(238,207,168,.17)'; g.beginPath(); g.ellipse(68, 87, 18, 9, -.3, 0, 6.28); g.fill();
    g.fillStyle = '#211812'; g.beginPath(); g.moveTo(46, 160); g.lineTo(62, 142); g.lineTo(80, 154); g.lineTo(99, 141); g.lineTo(116, 162); g.lineTo(130, 211); g.lineTo(30, 211); g.closePath(); g.fill();
    g.fillStyle = 'rgba(196,166,130,.26)'; g.beginPath(); g.moveTo(62, 145); g.lineTo(80, 157); g.lineTo(99, 144); g.lineTo(91, 179); g.lineTo(70, 179); g.closePath(); g.fill();
    // Slightly wrong, painterly strokes
    for (let i = 0; i < 24; i++) { g.strokeStyle = `rgba(224,195,154,${Math.random() * .12})`; g.lineWidth = .5 + Math.random() * 2; g.beginPath(); const x = 25 + Math.random() * 110, y = 22 + Math.random() * 185; g.moveTo(x, y); g.lineTo(x + Math.random() * 16 - 8, y + Math.random() * 12 - 6); g.stroke(); }
    if (seed === 3) { g.fillStyle = 'rgba(8,6,5,.8)'; g.fillRect(64, 92, 33, 5); }
    return c;
  }
  function makeGhost() {
    const c = document.createElement('canvas'); c.width = 160; c.height = 260; const g = c.getContext('2d');
    const halo = g.createRadialGradient(80, 110, 4, 80, 120, 115); halo.addColorStop(0, 'rgba(198,180,158,.28)'); halo.addColorStop(1, 'rgba(80,67,61,0)');
    g.fillStyle = halo; g.fillRect(0, 0, 160, 260);
    g.fillStyle = 'rgba(22,18,17,.92)'; g.beginPath(); g.moveTo(80, 38); g.bezierCurveTo(42, 38, 42, 89, 49, 118); g.lineTo(28, 230); g.quadraticCurveTo(48, 220, 60, 238); g.quadraticCurveTo(75, 224, 90, 239); g.quadraticCurveTo(111, 218, 132, 234); g.lineTo(112, 121); g.bezierCurveTo(127, 75, 111, 39, 80, 38); g.fill();
    g.fillStyle = 'rgba(163,147,129,.45)'; g.beginPath(); g.ellipse(80, 76, 24, 35, 0, 0, 6.28); g.fill();
    g.fillStyle = '#100d0c'; g.beginPath(); g.ellipse(71, 79, 3, 5, 0, 0, 6.28); g.ellipse(89, 79, 3, 5, 0, 0, 6.28); g.fill();
    g.fillStyle = 'rgba(223,206,183,.22)'; g.fillRect(69, 78, 3, 3); g.fillRect(87, 78, 3, 3);
    g.strokeStyle = 'rgba(172,155,135,.15)'; g.lineWidth = 2; g.beginPath(); g.moveTo(80, 101); g.lineTo(78, 113); g.stroke();
    return c;
  }

  function castRay(angle) {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let mx = Math.floor(player.x), my = Math.floor(player.y);
    const deltaX = Math.abs(1 / (dx || 1e-10)), deltaY = Math.abs(1 / (dy || 1e-10));
    const stepX = dx < 0 ? -1 : 1, stepY = dy < 0 ? -1 : 1;
    let sideX = (dx < 0 ? player.x - mx : mx + 1 - player.x) * deltaX;
    let sideY = (dy < 0 ? player.y - my : my + 1 - player.y) * deltaY;
    let side = 0, guard = 0;
    while (guard++ < 36) {
      if (sideX < sideY) { sideX += deltaX; mx += stepX; side = 0; }
      else { sideY += deltaY; my += stepY; side = 1; }
      if (mx < 0 || my < 0 || mx >= W || my >= H || world[my][mx]) break;
    }
    let dist = side === 0 ? sideX - deltaX : sideY - deltaY;
    dist = Math.max(.03, dist * Math.cos(angle - player.angle));
    let u = side === 0 ? player.y + dist * Math.sin(angle) : player.x + dist * Math.cos(angle);
    u -= Math.floor(u);
    if ((side === 0 && dx > 0) || (side === 1 && dy < 0)) u = 1 - u;
    return { dist, u, side };
  }

  function drawWorld(now) {
    const horizon = Math.floor(height * (.48 + Math.sin(bob * 2) * .004));
    const sky = ctx.createLinearGradient(0, 0, 0, horizon); sky.addColorStop(0, '#090909'); sky.addColorStop(1, '#201a16');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, horizon);
    const floor = ctx.createLinearGradient(0, horizon, 0, height); floor.addColorStop(0, '#211914'); floor.addColorStop(.18, '#17120f'); floor.addColorStop(1, '#080706');
    ctx.fillStyle = floor; ctx.fillRect(0, horizon, width, height - horizon);
    const columns = Math.min(540, Math.ceil(width / 2));
    const strip = width / columns, z = new Float32Array(columns);
    const fov = 1.12;
    const flashlight = lightOn;
    for (let i = 0; i < columns; i++) {
      const a = player.angle - fov / 2 + (i / columns) * fov;
      const hit = castRay(a); z[i] = hit.dist;
      const wallH = Math.min(height * 2, height * .88 / hit.dist);
      const top = horizon - wallH * .52;
      const sx = Math.min(127, Math.floor(hit.u * 128));
      ctx.drawImage(wallTexture, sx, 0, 1, 128, i * strip, top, strip + 1, wallH);
      let beam = flashlight ? Math.max(0, 1 - Math.abs(a - player.angle) / .62) : .03;
      const falloff = Math.max(.035, 1 / (1 + hit.dist * hit.dist * .14));
      let shade = Math.min(.84, .1 + falloff * (.14 + beam * .95));
      if (hit.side) shade *= .67;
      ctx.fillStyle = `rgba(5,4,4,${1 - shade})`;
      ctx.fillRect(i * strip, top, strip + 1, wallH);
      const glow = Math.max(0, 1 - Math.abs(a - player.angle) / .9) * (flashlight ? .08 : .015) / (hit.dist * .22 + 1);
      if (glow > .001) { ctx.fillStyle = `rgba(203,158,107,${glow})`; ctx.fillRect(i * strip, top, strip + 1, wallH); }
      // Perspective floorboard seams draw the polished age into the gallery.
      if (i % Math.max(1, Math.floor(columns / 20)) === 0) {
        ctx.fillStyle = `rgba(134,94,58,${Math.max(.015, .07 / (hit.dist + 1))})`;
        ctx.fillRect(i * strip, horizon + Math.min(height - horizon, height * .32 / (hit.dist + .15)), strip * 2, 1);
      }
    }
    drawSprites(z, columns, strip, horizon, now);
    if (lightOn) {
      const glow = ctx.createRadialGradient(width / 2, horizon * 1.55, 5, width / 2, horizon * 1.55, width * .48);
      glow.addColorStop(0, 'rgba(218,173,122,.105)'); glow.addColorStop(.35, 'rgba(165,119,79,.04)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
    }
    if (hurtTimer > 0) { ctx.fillStyle = `rgba(86,12,10,${hurtTimer * .28})`; ctx.fillRect(0, 0, width, height); }
  }

  function drawSprites(z, columns, strip, horizon, now) {
    const sprites = paintings.map(p => ({ ...p, kind: 'painting' }));
    if (ghost.active) sprites.push({ x: ghost.x, y: ghost.y, image: ghostImage, kind: 'ghost', important: true });
    sprites.push({ x: exit.x, y: exit.y, kind: 'exit' });
    const sorted = sprites.map(s => {
      const dx = s.x - player.x, dy = s.y - player.y;
      const d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      let delta = a - player.angle; while (delta > Math.PI) delta -= Math.PI * 2; while (delta < -Math.PI) delta += Math.PI * 2;
      return { ...s, d, delta };
    }).filter(s => Math.abs(s.delta) < .92 && s.d > .15).sort((a, b) => b.d - a.d);
    for (const s of sorted) {
      const d = s.d * Math.cos(s.delta);
      if (d < .1) continue;
      const screenX = width / 2 + Math.tan(s.delta) / Math.tan(.56) * width / 2;
      const scale = height / d;
      let w, h, bottom;
      if (s.kind === 'painting') { w = scale * .47; h = scale * .72; bottom = horizon + scale * .29; }
      else if (s.kind === 'exit') { w = scale * .9; h = scale * 1.55; bottom = horizon + scale * .69; }
      else { w = scale * .72; h = scale * 1.16; bottom = horizon + scale * .49 + Math.sin(now / 310) * 3; }
      const left = screenX - w / 2, top = bottom - h;
      const colStart = Math.max(0, Math.floor(left / strip)), colEnd = Math.min(columns - 1, Math.ceil((left + w) / strip));
      const visible = []; for (let i = colStart; i <= colEnd; i++) if (z[i] + .12 >= d) visible.push(i);
      if (!visible.length) continue;
      ctx.save();
      ctx.beginPath();
      for (const i of visible) ctx.rect(i * strip, 0, strip + 1, height);
      ctx.clip();
      if (s.kind === 'painting') {
        const alpha = Math.min(.92, .42 + (lightOn ? .42 : .08) / (d * .2 + .3));
        ctx.globalAlpha = alpha;
        if (s.important && !s.found && d < 3.2) { ctx.shadowBlur = 22; ctx.shadowColor = 'rgba(194,145,91,.58)'; }
        if (s.image) ctx.drawImage(s.image, left, top, w, h);
        ctx.shadowBlur = 0;
        if (s.important && !s.found) { ctx.strokeStyle = 'rgba(216,172,119,.66)'; ctx.lineWidth = Math.max(1, scale * .012); ctx.strokeRect(left, top, w, h); }
      } else if (s.kind === 'ghost') {
        const alpha = Math.max(.17, Math.min(.84, 1.1 - d * .045));
        ctx.globalAlpha = alpha; ctx.shadowBlur = 28; ctx.shadowColor = 'rgba(210,192,169,.35)';
        ctx.drawImage(s.image, left - w * .18, top, w * 1.36, h);
      } else {
        ctx.globalAlpha = .86; ctx.fillStyle = '#312317'; ctx.fillRect(screenX - w * .32, top, w * .64, h);
        ctx.strokeStyle = '#a27c51'; ctx.lineWidth = Math.max(2, w * .06); ctx.strokeRect(screenX - w * .32, top, w * .64, h);
        ctx.fillStyle = foundCount >= 3 ? 'rgba(212,171,111,.65)' : 'rgba(100,77,52,.35)'; ctx.fillRect(screenX - w * .24, top + h * .08, w * .48, h * .84);
        ctx.fillStyle = 'rgba(224,191,146,.75)'; ctx.beginPath(); ctx.arc(screenX + w * .24, top + h * .52, Math.max(2, w * .035), 0, 7); ctx.fill();
      }
      ctx.restore();
    }
  }

  function isBlocked(x, y) { return x < .25 || y < .25 || x >= W - .25 || y >= H - .25 || !!world[Math.floor(y)]?.[Math.floor(x)]; }
  function movePlayer(dx, dy) {
    const radius = .19;
    if (!isBlocked(player.x + dx + Math.sign(dx) * radius, player.y)) player.x += dx;
    if (!isBlocked(player.x, player.y + dy + Math.sign(dy) * radius)) player.y += dy;
  }
  function closestTarget() {
    let best = null, score = Infinity;
    for (const p of paintings) {
      if (!p.important || p.found) continue;
      const dx = p.x - player.x, dy = p.y - player.y, d = Math.hypot(dx, dy);
      let a = Math.atan2(dy, dx) - player.angle; while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2;
      const s = d + Math.abs(a) * 1.25;
      if (d < 2.15 && Math.abs(a) < .72 && s < score) { best = p; score = s; }
    }
    const dx = exit.x - player.x, dy = exit.y - player.y, d = Math.hypot(dx, dy);
    return best || (d < 2.2 ? { exit: true } : null);
  }
  function showMessage(text, duration = 2600) {
    UI.message.textContent = text; UI.message.classList.add('show'); messageTimer = duration;
  }
  function interact() {
    if (!running || paused || over) return;
    const target = currentTarget || closestTarget();
    if (!target) { showMessage('The hallway stretches on in both directions.'); return; }
    if (target.exit) {
      if (foundCount < 3) { showMessage('The door will not open. Something is still unfinished.'); return; }
      finish(true); return;
    }
    target.found = true; foundCount++; UI.memory.textContent = foundCount;
    document.querySelectorAll('.memory-dots i')[foundCount - 1]?.classList.add('found');
    paused = true; ghost.active = true; ghost.speed = .42 + foundCount * .13;
    UI.letterTitle.textContent = target.title; UI.letterBody.textContent = target.body; UI.letter.classList.add('visible');
    if (foundCount === 1) { UI.objective.textContent = 'The house has noticed you. Find the remaining paintings.'; UI.status.textContent = 'SOMETHING IS AWAKE'; }
    if (foundCount === 3) { UI.objective.textContent = 'The brass key is yours. Reach the front door.'; UI.status.textContent = 'THE EXIT IS OPEN'; }
  }
  function finish(won) {
    over = true; running = false; paused = false;
    UI.endTitle.innerHTML = won ? 'THE DOOR<br>IS <em>OPEN</em>' : 'THE HOUSE<br>KEEPS <em>YOU</em>';
    UI.endText.textContent = won ? 'For the first time in years, the house lets you go.' : 'The portrait has a new face now. Yours.';
    UI.end.classList.add('visible');
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function startGame() {
    UI.start.classList.remove('visible'); UI.end.classList.remove('visible'); UI.letter.classList.remove('visible');
    if (over) resetGame();
    running = true; paused = false; over = false; lastTime = performance.now();
    if (matchMedia('(hover:hover) and (pointer:fine)').matches) canvas.requestPointerLock?.();
  }
  function resetGame() {
    memories.forEach(m => m.found = false); paintings.slice(0, 3).forEach((p, i) => p.found = false);
    foundCount = 0; UI.memory.textContent = '0'; document.querySelectorAll('.memory-dots i').forEach(e => e.classList.remove('found'));
    player = { x: 9.5, y: 2.5, angle: Math.PI / 2 }; ghost = { x: 9.45, y: 6.4, active: false, speed: .62, pathTime: 0, target: null, pulse: 0 };
    lightOn = true; stamina = 1; UI.objective.textContent = 'Find the three paintings that remember.'; UI.status.textContent = 'THE HOUSE IS QUIET';
  }
  UI.startButton.addEventListener('click', startGame);
  UI.closeLetter.addEventListener('click', () => { UI.letter.classList.remove('visible'); paused = false; showMessage(foundCount === 1 ? 'A floorboard creaks somewhere behind you.' : foundCount === 3 ? 'The key is warm. The front door waits.' : 'You hear a slow breath in the next room.'); });
  UI.restart.addEventListener('click', () => { resetGame(); startGame(); });
  $('useButton').addEventListener('pointerdown', e => { e.preventDefault(); interact(); });
  $('lightButton').addEventListener('pointerdown', e => { e.preventDefault(); lightOn = !lightOn; showMessage(lightOn ? 'The flashlight flickers to life.' : 'You switch off the light.'); });
  $('runButton').addEventListener('pointerdown', e => { e.preventDefault(); keys.add('Shift'); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => $('runButton').addEventListener(type, () => keys.delete('Shift')));
  $('joystick').addEventListener('pointerdown', e => { e.preventDefault(); joy.active = true; joy.id = e.pointerId; $('joystick').setPointerCapture(e.pointerId); setJoy(e); });
  $('joystick').addEventListener('pointermove', e => { if (joy.active && e.pointerId === joy.id) setJoy(e); });
  const stopJoy = e => { if (!joy.active || (e && e.pointerId !== joy.id)) return; joy.active = false; joy.x = joy.y = 0; $('joyKnob').style.transform = 'translate(0,0)'; };
  $('joystick').addEventListener('pointerup', stopJoy); $('joystick').addEventListener('pointercancel', stopJoy);
  function setJoy(e) { const r = $('joystick').getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = e.clientX - cx, dy = e.clientY - cy; const max = r.width * .37, len = Math.hypot(dx, dy); if (len > max) { dx *= max / len; dy *= max / len; } joy.x = dx / max; joy.y = dy / max; $('joyKnob').style.transform = `translate(${dx}px,${dy}px)`; }
  canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') { lookTouch = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); } });
  canvas.addEventListener('pointermove', e => {
    if (document.pointerLockElement !== canvas && lookTouch && e.pointerId === lookTouch.id) { const dx = e.clientX - lookTouch.x; player.angle += dx * .006; lookTouch.x = e.clientX; lookTouch.y = e.clientY; }
  });
  canvas.addEventListener('pointerup', e => { if (lookTouch?.id === e.pointerId) lookTouch = null; });
  canvas.addEventListener('click', () => { if (!running) return; if (matchMedia('(hover:hover) and (pointer:fine)').matches && !document.pointerLockElement) canvas.requestPointerLock?.(); });
  document.addEventListener('mousemove', e => { if (document.pointerLockElement === canvas) player.angle += e.movementX * .0024; });
  window.addEventListener('keydown', e => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    keys.add(e.key.toLowerCase());
    if (e.key.toLowerCase() === 'e' || e.code === 'Space') { if (UI.letter.classList.contains('visible')) { UI.closeLetter.click(); } else interact(); }
    if (e.key.toLowerCase() === 'f') { lightOn = !lightOn; showMessage(lightOn ? 'The flashlight flickers to life.' : 'You switch off the light.'); }
    if (e.key === 'Escape' && running && !paused) { running = false; UI.start.classList.add('visible'); }
    if (!running && !UI.letter.classList.contains('visible') && !UI.end.classList.contains('visible') && e.key === 'Enter') startGame();
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => { keys.clear(); joy.x = joy.y = 0; });

  function update(dt, now) {
    if (messageTimer > 0) { messageTimer -= dt * 1000; if (messageTimer <= 0) UI.message.classList.remove('show'); }
    if (!running || paused || over) return;
    const forward = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - joy.y;
    const strafe = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0) + joy.x;
    const moving = Math.abs(forward) + Math.abs(strafe) > .05;
    const sprinting = moving && (keys.has('shift') || keys.has('shiftleft')) && stamina > .04;
    stamina = Math.max(0, Math.min(1, stamina + (sprinting ? -dt * .28 : dt * .17)));
    const speed = sprinting ? 3.6 : 2.25;
    const norm = Math.hypot(forward, strafe) || 1;
    if (moving) {
      const f = forward / norm * speed * dt, s = strafe / norm * speed * dt;
      movePlayer(Math.cos(player.angle) * f + Math.cos(player.angle + Math.PI / 2) * s, Math.sin(player.angle) * f + Math.sin(player.angle + Math.PI / 2) * s);
      bob += dt * (sprinting ? 13 : 8);
    }
    if (ghost.active) {
      ghost.pathTime -= dt;
      if (ghost.pathTime <= 0) { ghost.target = findNextStep(Math.floor(ghost.x), Math.floor(ghost.y), Math.floor(player.x), Math.floor(player.y)); ghost.pathTime = .42; }
      if (ghost.target) {
        const tx = ghost.target.x + .5, ty = ghost.target.y + .5, dx = tx - ghost.x, dy = ty - ghost.y, d = Math.hypot(dx, dy);
        const step = Math.min(d, ghost.speed * dt); if (d > .03) { const nx = ghost.x + dx / d * step, ny = ghost.y + dy / d * step; if (!isBlocked(nx, ghost.y)) ghost.x = nx; if (!isBlocked(ghost.x, ny)) ghost.y = ny; }
      }
      ghost.pulse += dt;
      const near = Math.hypot(player.x - ghost.x, player.y - ghost.y);
      if (near < .57) { hurtTimer = Math.min(1, hurtTimer + dt * 2); if (near < .45) finish(false); }
      else hurtTimer = Math.max(0, hurtTimer - dt * .65);
      if (near < 4) UI.status.textContent = 'IT IS RIGHT BEHIND YOU';
      else if (foundCount < 3) UI.status.textContent = 'SOMETHING IS FOLLOWING';
    }
    currentTarget = closestTarget();
    if (currentTarget && !currentTarget.exit) { UI.promptText.textContent = 'EXAMINE PORTRAIT'; UI.prompt.classList.add('show'); }
    else if (currentTarget?.exit) { UI.promptText.textContent = foundCount === 3 ? 'UNLOCK THE FRONT DOOR' : 'THE FRONT DOOR'; UI.prompt.classList.add('show'); }
    else UI.prompt.classList.remove('show');
  }
  function findNextStep(sx, sy, tx, ty) {
    if (sx === tx && sy === ty) return { x: sx, y: sy };
    const queue = [[sx, sy]], seen = new Map([[`${sx},${sy}`, null]]), dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    let end = null;
    for (let i = 0; i < queue.length; i++) {
      const [x,y] = queue[i]; if (x === tx && y === ty) { end = [x,y]; break; }
      for (const [dx,dy] of dirs) { const nx=x+dx, ny=y+dy, k=`${nx},${ny}`; if (nx>=0&&ny>=0&&nx<W&&ny<H&&!world[ny][nx]&&!seen.has(k)) { seen.set(k,[x,y]); queue.push([nx,ny]); } }
    }
    if (!end) return null;
    while (seen.get(`${end[0]},${end[1]}`) && (seen.get(`${end[0]},${end[1]}`)[0] !== sx || seen.get(`${end[0]},${end[1]}`)[1] !== sy)) end = seen.get(`${end[0]},${end[1]}`);
    const parent = seen.get(`${end[0]},${end[1]}`);
    return parent ? { x: end[0], y: end[1] } : null;
  }

  function frame(now) {
    const dt = Math.min(.045, Math.max(0, (now - (lastTime || now)) / 1000)); lastTime = now;
    update(dt, now); drawWorld(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
