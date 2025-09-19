(() => {

  
  const APPEAR_MS = 500;     
  const DISAPPEAR_MS = 500;  
  const SMOOTH = 0.12;       

  
  const lerp01 = (a, b, t) => a + (b - a) * t;

  let LAST_VERSION = -1;
  const canvas = document.getElementById('space');
  if (!canvas) { console.error('No <canvas id="space">'); return; }
  const ctx = canvas.getContext('2d');

  
  let zoom = 1, camX = 0, camY = 0;
  const MIN_ZOOM = 0.05;   
  const MAX_ZOOM = 8;      
  const clampZoom = v => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v));
  let dragging = false, lastMouse = { x: 0, y: 0 };
  const keys = new Set();

  
  let mouse = { x: 0, y: 0 };
  let hover = null; 
  
  let selected = null;           
  let lastSelectedHolder = null; 
  
  const STAR_EXTENT = 7500
  const TILE = STAR_EXTENT * 2;
  const TAU = Math.PI * 2;
  const mod = (a, n) => ((a % n) + n) % n;
  const frac = x => x - Math.floor(x);
  const STAR_DENSITY = 0.5;
 let STARS = Array.from({length: 1000}, () => ({
   x:(Math.random()-0.5)*STAR_EXTENT*2,
   y:(Math.random()-0.5)*STAR_EXTENT*2,
    size: Math.random()<0.8?1:2,
   phase: Math.random()*Math.PI*2,
   seed: Math.random() 
  }));
let SUN = { 
  radius: 160,      
  glow: 220,        
  color: '#fff7a5', 
  rot: 0,
  spin: 0.002,
  core: '#fff7a5',  
  mid:  '#ffd36a',  
  edge: '#ff9e3d'   
};
  let PLANETS = [];

  
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(dpr, dpr);
  }
  addEventListener('resize', resize);
  resize();

  
  const ws = (wx, wy) => ({
    x: (wx - camX) * zoom + innerWidth / 2,
    y: (wy - camY) * zoom + innerHeight / 2
  });

  document.getElementById('btnTwitter').addEventListener('click', () => {
    window.open('https://twitter.com/PlanetaryFi', '_blank');
  });

  const tip = document.createElement('div');
  tip.classList.add('pixel');
  tip.style.position = 'fixed';
  tip.style.pointerEvents = 'auto';
  tip.style.padding = '14px 16px';
  tip.style.borderRadius = '10px';
  tip.style.background = 'rgba(15, 10, 25, 0.85)'; 
  tip.style.color = '#a5b4fc';  
  tip.style.fontSize = '16px';
  tip.style.lineHeight = '1.5';
  tip.style.textShadow = '0 0 6px rgba(165,180,252,0.9), 0 0 10px rgba(80,180,255,0.6)';
  tip.style.boxShadow = '0 0 14px rgba(120,150,255,0.4)';
  tip.style.border = '1px solid rgba(165,180,252,0.4)';
  tip.style.opacity = '0';
  tip.style.transition = 'opacity 150ms ease, transform 150ms ease';
  tip.style.transform = 'scale(0.95)';
  tip.style.whiteSpace = 'nowrap';
  document.body.appendChild(tip);
  let hoverLocked = false; 

  tip.addEventListener('mouseenter', () => {
    hoverLocked = true;       
  });
  tip.addEventListener('mouseleave', () => {
    hoverLocked = false;      
  });
  
  tip.innerHTML = `
    <div id="tipAddr"></div>
    <div id="tipShare" style="margin-top:6px;">SHARE: </div>
  `;

  
  const tipAddrEl  = tip.querySelector('#tipAddr');
  const tipShareEl = tip.querySelector('#tipShare');

  
function drawBackground() {
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  
  const grd = ctx.createLinearGradient(0, 0, 0, innerHeight);
  grd.addColorStop(0, '#0a0f2a');
  grd.addColorStop(1, '#000814');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, innerWidth, innerHeight);

  
  const halfW = innerWidth  / (2 * zoom);
  const halfH = innerHeight / (2 * zoom);

  
  const cx = Math.floor(camX / TILE);
  const cy = Math.floor(camY / TILE);
  const needX = Math.ceil(halfW / TILE) + 2;
  const needY = Math.ceil(halfH / TILE) + 2;

  for (const s of STARS) {
    
    const bx = mod(s.x + STAR_EXTENT, TILE);
    const by = mod(s.y + STAR_EXTENT, TILE);

    
    const u = bx / TILE; 
    const v = by / TILE; 
    const h = frac(Math.sin((u * 12.9898 + v * 78.233) * TAU) * 43758.5453);
    if (h > STAR_DENSITY) continue;

    
    if (typeof s.phase === 'number') s.phase += 0.03;
    const alpha = s.phase != null ? 0.5 + 0.5 * Math.sin(s.phase) : 0.9;
    const sz = s.size || 1;

    
    for (let tx = cx - needX; tx <= cx + needX; tx++) {
      const ox = tx * TILE - STAR_EXTENT;
      for (let ty = cy - needY; ty <= cy + needY; ty++) {
        const oy = ty * TILE - STAR_EXTENT;

        const { x, y } = ws(bx + ox, by + oy);
        
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;

        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillRect(x, y, sz, sz);
      }
    }
  }
}


let tipAnim = { addr: null, share: null };

function typeIn(el, text, totalMs = 220) {
  
  const len = text.length || 1;
  const minPerChar = 6;   
  const maxPerChar = 22;  
  const perChar = Math.max(minPerChar, Math.min(maxPerChar, Math.floor(totalMs / len)));

  
  if (tipAnim[el.id]) clearTimeout(tipAnim[el.id]);

  let i = 0;
  el.textContent = ''; 
  function step() {
    
    const chunk = Math.max(1, Math.ceil(len / 12)); 
    i = Math.min(len, i + chunk);
    el.textContent = text.slice(0, i);
    if (i < len) {
      tipAnim[el.id] = setTimeout(() => requestAnimationFrame(step), perChar);
    }
  }
  requestAnimationFrame(step);
}

  
function drawSun() {
  const { x, y } = ws(0, 0);
  const size = (SUN.radius || 50) * zoom; 

  
  ctx.imageSmoothingEnabled = false;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(SUN.rot || 0);

  
  const coreColors = ['#ff7a1f', '#ff9e3d', '#ffd36a', '#fff7a5']; 
  const coreSteps = coreColors.length;
  for (let i = 0; i < coreSteps; i++) {
    const t = 1 - i / coreSteps;             
    const s = Math.round(size * t);          
    ctx.fillStyle = coreColors[i];
    ctx.fillRect(-s, -s, s * 2, s * 2);
  }

  
  const auraSteps = 3;
  const auraMax = Math.round(size * 1.35);
  for (let i = 0; i < auraSteps; i++) {
    const k = 1 + (i + 1) * 0.12;            
    const s = Math.round(size * k);
    const alpha = 0.18 - i * 0.05;           
    ctx.fillStyle = `rgba(255, 247, 165, ${alpha.toFixed(3)})`;
    ctx.fillRect(-s, -s, s * 2, s * 2);
  }

  ctx.restore();
}

function drawPlanet(p) {
  
  if (p.speed) p.angle += p.speed * 0.004;
  p.rot = (p.rot ?? 0) + (p.selfSpin || 0.005);

  
  if (typeof p.tSize === 'number') {
    p.size = lerp01(p.size ?? p.tSize, p.tSize, SMOOTH);
  }
  if (typeof p.tAlpha === 'number') {
    p.alpha = lerp01(p.alpha ?? p.tAlpha, p.tAlpha, SMOOTH);
  }

  const wx = Math.cos(p.angle || 0) * (p.r || 0);
  const wy = Math.sin(p.angle || 0) * (p.r || 0);
  const { x, y } = ws(wx, wy);

  ctx.save();
  ctx.globalAlpha = p.alpha ?? 1;
  ctx.translate(x, y);
  ctx.rotate(p.rot);

  let s = (p.size || 20) * zoom * (p.hoverScale || 1);

  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.8);
  glow.addColorStop(0, 'rgba(255,255,255,0.15)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-s * 0.9, -s * 0.9, s * 1.8, s * 1.8);

  const cols = Array.isArray(p.colors) && p.colors.length ? p.colors : ['#58d3ff','#3ca5e0','#ffffff'];
  const stripeCount = p.stripes || 3;
  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = cols[i % cols.length];
    ctx.fillRect(-s / 2, -s / 2 + i * (s / stripeCount), s, s / stripeCount);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(-s / 3, -s / 6, s / 4, s / 4);
  ctx.fillRect(s / 6, -s / 4, s / 5, s / 5);

  ctx.restore();
}


function indexByHolder(arr) {
  const m = new Map();
  for (const p of arr) {
    
    m.set(p.holder, p);
  }
  return m;
}





function reconcilePlanets(serverPlanets) {
  const byHolder = indexByHolder(serverPlanets);
  const now = performance.now();

  const next = [];
  for (const p of PLANETS) {
    const target = byHolder.get(p.holder);
    if (target) {
      
      p.tSize = target.size;              
      p.percentage = target.percentage;
      p.tAlpha = 1;
      p._state = 'alive';
      p._updatedAt = now;
      next.push(p);
      byHolder.delete(p.holder);
    } else {
      
      if (p._state !== 'dying') {
        p._state = 'dying';
        p._until = now + DISAPPEAR_MS;
        p.tAlpha = 0;
        p.tSize = 0;
      }
      if (now < (p._until || 0)) next.push(p);
    }
  }

  
  for (const [holder, t] of byHolder.entries()) {
    const angle = Math.random() * Math.PI * 2;
    const r = 350 + Math.pow(Math.random(), 0.3) * (2500 - 350);
    const np = {
      holder,
      r, angle,
      size: 0,
      tSize: t.size,
      tAlpha: 1,
      alpha: 0,
      speed: t.speed,
      selfSpin: t.selfSpin,
      colors: t.colors,
      stripes: t.stripes,
      percentage: t.percentage,
      rot: Math.random() * Math.PI * 2,
      hoverScale: 1,
      _state: 'appearing',
      _until: now + APPEAR_MS,
      _updatedAt: now
    };
    next.push(np);
  }

  PLANETS = next;
}

  
  function drawHoverHighlight() {
    if (!hover || selected) return; 
    const { x, y, s } = hover;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, s * 0.6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  
  function render() {
    drawBackground();
    drawSun();
    for (const p of PLANETS) drawPlanet(p);
  }

  
  function tick() {
    const speed = 5 / zoom;
    if (keys.has('arrowleft') || keys.has('a')) camX -= speed;
    if (keys.has('arrowright') || keys.has('d')) camX += speed;
    if (keys.has('arrowup') || keys.has('w')) camY -= speed;
    if (keys.has('arrowdown') || keys.has('s')) camY += speed;

    
    render();
    placeTooltipAtSelected();
    SUN.rot = (SUN.rot || 0) + (SUN.spin || 0.002);
    requestAnimationFrame(tick);
  }
  tick();

  
  addEventListener('keydown', (e) => {
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','w','a','s','d','r','+','-','='].includes(e.key))
      e.preventDefault();
    if (e.key === 'r' || e.key === 'R') { camX = 0; camY = 0; zoom = 1; }
    if (e.key === '+' || e.key === '=') zoom = clampZoom(zoom * 1.1);
    if (e.key === '-')                   zoom = clampZoom(zoom / 1.1);
    keys.add(e.key.toLowerCase());
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

  canvas.addEventListener('mousedown', (e) => {
    dragging = true; canvas.classList.add('dragging');
    lastMouse = { x: e.clientX, y: e.clientY };
  });

  addEventListener('mouseup', () => { 
    dragging = false; 
    canvas.classList.remove('dragging'); 
  });

  
  canvas.addEventListener('click', (e) => {
    mouse = { x: e.clientX, y: e.clientY };
    const hit = findPlanetAtMouse();
    if (hit && hit.p) {
      showTipForPlanet(hit.p);
    } else {
      hideTip();
    }
  });

  
  document.addEventListener('click', (e) => {
    if (e.target === canvas) return;
    if (tip.contains(e.target)) return;  
    hideTip();
  });

  addEventListener('mousemove', (e) => {
    mouse = { x: e.clientX, y: e.clientY }; 
    if (!dragging) {
      if (!selected) {           
        updateHover();
      }
      return;
    }
    camX -= (e.clientX - lastMouse.x) / zoom;
    camY -= (e.clientY - lastMouse.y) / zoom;
    lastMouse = { x: e.clientX, y: e.clientY };
    if (!selected) {             
      updateHover();
    }
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const prevZoom = zoom;

    const worldBefore = {
      x: (mouse.x - innerWidth/2)/prevZoom + camX,
      y: (mouse.y - innerHeight/2)/prevZoom + camY
    };

    zoom = clampZoom( zoom * (e.deltaY > 0 ? 0.9 : 1.1) );

    const worldAfter = {
      x: (mouse.x - innerWidth/2)/zoom + camX,
      y: (mouse.y - innerHeight/2)/zoom + camY
    };
    camX += worldBefore.x - worldAfter.x;
    camY += worldBefore.y - worldAfter.y;
    
    if (!selected) updateHover();
  }, { passive: false });


let lastHoverHolder = null; 

function placeTooltipAtSelected() {
  if (!selected || !selected.p) return;
  const p = selected.p;

  
  const wx = (p.x != null && p.y != null) ? p.x : Math.cos(p.angle || 0) * (p.r || 0);
  const wy = (p.x != null && p.y != null) ? p.y : Math.sin(p.angle || 0) * (p.r || 0);
  const { x, y } = ws(wx, wy);

  const pad = 12;
  let left = x + 16; 
  let top  = y - 10; 

  
  const rect = tip.getBoundingClientRect();
  if (left + rect.width + pad > innerWidth)  left = innerWidth - rect.width - pad;
  if (top + rect.height + pad > innerHeight) top  = innerHeight - rect.height - pad;
  if (left < pad) left = pad;
  if (top  < pad) top  = pad;

  tip.style.left = left + 'px';
  tip.style.top  = top  + 'px';
}


function findPlanetAtMouse() {
  let best = null;
  let bestDist = Infinity;
  for (const p of PLANETS) {
    const wx = (p.x != null && p.y != null) ? p.x : Math.cos(p.angle || 0) * (p.r || 0);
    const wy = (p.x != null && p.y != null) ? p.y : Math.sin(p.angle || 0) * (p.r || 0);
    const { x, y } = ws(wx, wy);
    const s = (p.size || 20) * zoom;
    const dx = mouse.x - x;
    const dy = mouse.y - y;
    const dist = Math.hypot(dx, dy);
    const hitR = s * 0.65;
    if (dist <= hitR && dist < bestDist) {
      best = { p, x, y, s };
      bestDist = dist;
    }
  }
  return best; 
}

function showTipForPlanet(p) {
  selected = { p };
  const addrFull = p.holder || '';
  const shareStr = (p.percentage != null ? p.percentage.toFixed(4) : '0.0000') + '%';

  if (lastSelectedHolder !== addrFull) {
    lastSelectedHolder = addrFull;
    typeIn(tipAddrEl, addrFull, 220);
    
    tipShareEl.innerHTML = `<span style="
      background: linear-gradient(90deg,#80d0ff,#a5b4fc,#d8b4fe);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-weight: 600;">SHARE:</span> ${shareStr}`;
  }

  tip.style.opacity = '1';
  tip.style.transform = 'scale(1)';
}

function hideTip() {
  selected = null;
  lastSelectedHolder = null;
  tip.style.opacity = '0';
  tip.style.transform = 'scale(0.95)';
}


function updateHover() {
  if (selected) return;

  let best = null;
  let bestDist = Infinity;

  for (const p of PLANETS) {
    const wx = (p.x != null && p.y != null) ? p.x : Math.cos(p.angle || 0) * (p.r || 0);
    const wy = (p.x != null && p.y != null) ? p.y : Math.sin(p.angle || 0) * (p.r || 0);
    const { x, y } = ws(wx, wy);
    const s = (p.size || 20) * zoom;
    const dx = mouse.x - x;
    const dy = mouse.y - y;
    const dist = Math.hypot(dx, dy);
    const hitR = s * 0.65;
    if (dist <= hitR && dist < bestDist) {
      best = { p, x, y, s };
      bestDist = dist;
    }
  }

  hover = best;

  
  for (const p of PLANETS) {
    if (p.hoverScale == null) p.hoverScale = 1; 
    const target = hover && hover.p === p ? 1.2 : 1; 
    
    p.hoverScale += (target - p.hoverScale) * 0.2;
  }
}


  
  function placeTooltip() {
    if (!hover) return;
    const pad = 12;
    let x = mouse.x + 14;
    let y = mouse.y + 14;

    
    const rect = tip.getBoundingClientRect();
    if (x + rect.width + pad > innerWidth)  x = innerWidth - rect.width - pad;
    if (y + rect.height + pad > innerHeight) y = innerHeight - rect.height - pad;

    tip.style.left = x + 'px';
    tip.style.top  = y + 'px';
  }


const btnInfo = document.getElementById('btnInfo');
const btnSearch = document.getElementById('btnSearch');
const searchWrap = document.querySelector('.search-wrap');
const searchInput = document.getElementById('searchInput');

const infoPanel = document.getElementById('infoPanel');

if (btnInfo && infoPanel) {
  btnInfo.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = infoPanel.classList.toggle('open');
    infoPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
  });

  document.addEventListener('click', (e) => {
    if (!infoPanel.classList.contains('open')) return;
    if (infoPanel.contains(e.target)) return;
    if (btnInfo.contains(e.target)) return;
    infoPanel.classList.remove('open');
    infoPanel.setAttribute('aria-hidden', 'true');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && infoPanel.classList.contains('open')) {
      infoPanel.classList.remove('open');
      infoPanel.setAttribute('aria-hidden', 'true');
    }
  });
}

btnSearch.addEventListener('click', () => {
  const open = searchWrap.classList.toggle('open');
  if (open) {
    searchInput.classList.remove('error');
    searchInput.value = '';
    setTimeout(() => searchInput.focus(), 0);
  } else {
    searchInput.blur();
  }
});


searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const q = (searchInput.value || '').trim();
    if (!q) return;
    const found = findPlanetByAddress(q);
    if (found) {
      
      flyToPlanet(found);
      showTipForPlanet(found);
      searchInput.classList.remove('error');
    } else {
      
      searchInput.classList.add('error');
      
      searchWrap.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }],
        { duration: 180, iterations: 1 }
      );
    }
  }
});


function findPlanetByAddress(addr) {
  const target = addr.toLowerCase();
  return PLANETS.find(p => (p.holder || '').toLowerCase() === target) || null;
}


function flyToPlanet(p, targetZoom = 2.0, ms = 450) {
  const wx = (p.x != null && p.y != null) ? p.x : Math.cos(p.angle || 0) * (p.r || 0);
  const wy = (p.x != null && p.y != null) ? p.y : Math.sin(p.angle || 0) * (p.r || 0);

  const start = { x: camX, y: camY, z: zoom };
  const end   = { x: wx,   y: wy,   z: clampZoom(targetZoom) };

  const t0 = performance.now();
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  function step(t) {
    const dt = Math.min(1, (t - t0) / ms);
    const k = easeOutCubic(dt);
    camX = start.x + (end.x - start.x) * k;
    camY = start.y + (end.y - start.y) * k;
    zoom = start.z + (end.z - start.z) * k;
    if (dt < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
  
  async function loadScene() {
    const API_BASE = location.origin;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(`${API_BASE}/api/get-planets`, { signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      if (typeof data.version === 'number' && data.version !== LAST_VERSION) {
        LAST_VERSION = data.version;
        STARS = STARS;
        if (data.sun) {
          SUN.radius = data.sun.radius ?? SUN.radius;
          SUN.glow   = data.sun.glow   ?? SUN.glow;
          SUN.color  = data.sun.color  ?? SUN.color;
          SUN.core   = data.sun.core   ?? SUN.core;
          SUN.mid    = data.sun.mid    ?? SUN.mid;
          SUN.edge   = data.sun.edge   ?? SUN.edge;
          SUN.spin   = data.sun.spin   ?? SUN.spin;
        }
        if (Array.isArray(data.planets)) {
          reconcilePlanets(data.planets);
        }
        if (!selected) updateHover();
      }
    } catch (err) {
      console.error('Failed to load /api/get-planets:', err);
    } finally {
      clearTimeout(t);
      setTimeout(loadScene, 5000);
    }
  }
  
  loadScene();
})();
