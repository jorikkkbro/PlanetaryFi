


import express from 'express';
import cors from 'cors';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

const PORT = process.env.PORT || 3000;
const API_KEY = 'api-key'; 
const MINT = 'your-mint'; 
const RPC_URL = 'https://api.mainnet-beta.solana.com';
const SUPPLY_UI_DEFAULT = 1000000000; 

if (!API_KEY || !MINT) {
  process.exit(1);
}
const STAR_EXTENT = 10000;
const app = express();
app.use(cors());
app.use(express.json());


const PALETTES = [
  ['#58d3ff','#3ca5e0','#ffffff'],
  ['#ff9a3c','#ffd580','#e86000'],
  ['#96ffb3','#4df77a','#e2ffe9'],
  ['#ff7aa2','#ffbfd3','#c73060'],
  ['#f6e7b2','#a38a2f','#fff8d6'],
  ['#bca0ff','#7d5bd1','#e3d6ff'],
  ['#f9d1d1','#b64242','#ffe4e4'],
  ['#a0e9ff','#89cff0','#005f99'],
  ['#ffd6a5','#ffad60','#c75b39'],
  ['#cdeac0','#6bd425','#2b9348'],
  ['#d0bfff','#a29bfe','#6c63ff'],
  ['#ffe5ec','#ffc2d1','#ff8fab'],
  ['#fde2e4','#fad2e1','#c5dedd'],
  ['#fff3b0','#e09f3e','#9e2a2b'],
  ['#d4f1f4','#75e6da','#189ab4'],
  ['#e1e5f2','#bfdbf7','#1f7a8c'],
  ['#f1faee','#a8dadc','#457b9d'],
  ['#e9ff70','#ffd670','#e9a23b']
];

function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }


function makeStars(count = 1200) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: (Math.random() - 0.5) * (STAR_EXTENT * 2), 
      y: (Math.random() - 0.5) * (STAR_EXTENT * 2),
      size: Math.random() < 0.8 ? 1 : 2,
      phase: Math.random() * Math.PI * 2
    });
  }
  return stars;
}
async function fetchPoolsFromTracker(mint) {
  const url = `https://data.solanatracker.io/tokens/${encodeURIComponent(mint)}`;
  const res = await fetch(url, { headers: { 'x-api-key': API_KEY } });
  if (!res.ok) {
    return new Set();
  }
  const json = await res.json();

  
  
  
  const ids = new Set();
  for (const p of (json.pools || [])) {
    const add = v => {
      if (typeof v === 'string') {
        const s = v.trim();
        if (s) ids.add(s);
      }
    };
    add(p.poolId);
    add(p.curve);
  }
  return ids;
}




function holdersToPlanets(accounts) {
  if (!accounts || !accounts.length) return [];

  const maxP = Math.max(...accounts.map(a => a.percentage || 0)) || 1;

  

  const BASE_R  = 350;
  const MAX_R   = 2500;
  const MIN_SIZE = 10;
  const MAX_SIZE = 100;
  
  const SIZE_MAX_PERCENT = 5;
  
  const SIZE_GAMMA = 0.5;

  function percentToSize(percentage) {
    
    const p01 = Math.max(0, percentage) / SIZE_MAX_PERCENT; 
    const tLinear = Math.min(1, p01);                        
    const tGamma = Math.pow(tLinear, SIZE_GAMMA);            
    return Math.round(lerp(MIN_SIZE, MAX_SIZE, tGamma));
  }
  const MIN_GAP_BASE = 75;

  const MIN_SPEED = 0.01;
  const MAX_SPEED = 0.04;
  const MIN_SPIN  = 0.003;
  const MAX_SPIN  = 0.009;
  const placed = [];
  return accounts.map((acc) => {
    const p = Math.max(0, acc.percentage || 0);

    
    const size = percentToSize(p);
    const sizeT = (size - MIN_SIZE) / (MAX_SIZE - MIN_SIZE); 

    
    const speed    = lerp(MAX_SPEED, MIN_SPEED, sizeT);
    const selfSpin = lerp(MAX_SPIN,  MIN_SPIN,  sizeT);

    const stripes = Math.floor(rand(2, 5));
    const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];

    let angle = rand(0, 2 * Math.PI);
    let r = BASE_R + Math.pow(Math.random(), 0.3) * (MAX_R - BASE_R);

    
    const minDist = (MIN_GAP_BASE + size * 1.6);

    for (let tries = 0; tries < 40; tries++) {
      const ok = placed.every(pp => {
        const da = Math.abs(angle - pp.angle);
        const d = Math.sqrt(r*r + pp.r*pp.r - 2*r*pp.r*Math.cos(da));
        const pairGap = MIN_GAP_BASE + (size + (pp.size ?? size)) * 0.9;
        return d >= pairGap;
      });
      if (ok) break;

      angle = rand(0, 2 * Math.PI);
      r = BASE_R + Math.pow(Math.random(), 0.6) * (MAX_R - BASE_R);
    }

    placed.push({ r, angle, size });

    return {
      r,
      angle,
      size,
      colors: palette,
      stripes,
      speed,
      rot: rand(0, Math.PI * 2),
      selfSpin,
      holder: acc.wallet,
      percentage: +p.toFixed(6)
    };
  });
}
let poolsAddresses = new Set();

async function fetchHoldersRPC(mint) {
  const connection = new Connection(RPC_URL, "confirmed");
  const mintPub = new PublicKey(mint);

  const accounts = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
    filters: [
      { dataSize: 165 },
      { memcmp: { offset: 0, bytes: mintPub.toBase58() } },
    ],
  });
  if (!(poolsAddresses instanceof Set) || poolsAddresses.size === 0) {
    poolsAddresses = await fetchPoolsFromTracker(MINT);
  }
  const byOwner = new Map();
  let decimals = null;
  const poolsSet = poolsAddresses;
  for (const acc of accounts) {
    const info = acc.account.data.parsed.info;
    if (info.state !== 'initialized') continue;
    const amountRaw = info.tokenAmount.amount;
    if (!amountRaw || amountRaw === '0') continue;
    const dec = info.tokenAmount.decimals;
    if (decimals === null) decimals = dec;

    
    const owner = String(info.owner || "").trim();
    if (poolsSet.has(owner)) {
      continue;
    }
    const amt = BigInt(amountRaw);
    const prev = byOwner.get(owner);
    if (!prev) {
      byOwner.set(owner, { amount: amt });
    } else {
      byOwner.set(owner, { amount: prev.amount + amt });
    }
  }

  const supplyUi = SUPPLY_UI_DEFAULT;
  
  const result = [];
  for (const [owner, obj] of byOwner) {
    const uiAmount = Number(obj.amount) / Math.pow(10, decimals);
    const percent = (uiAmount / supplyUi) * 100;
    result.push({ wallet: owner, uiAmount, percentage: percent });
  }
  result.sort((a, b) => b.uiAmount - a.uiAmount);

  return result;
}



let PLANETS_CACHE = [];


function updatePlanetsFromHolders(holders) {
  const holdersMap = new Map(holders.map(h => [h.wallet, h]));
  const updated = [];

  for (const planet of PLANETS_CACHE) {
    const h = holdersMap.get(planet.holder);
    if (h) {
      planet.percentage = h.percentage;
      planet.size = percentToSize(h.percentage);

      const sizeT = (planet.size - MIN_SIZE) / (MAX_SIZE - MIN_SIZE);
      planet.speed    = lerp(0.04, 0.01, sizeT);
      planet.selfSpin = lerp(0.009, 0.003, sizeT);

      updated.push(planet.holder);
    } else {
      planet.size = 0;
      planet.percentage = 0;
    }
  }


  
  for (const h of holders) {
    if (!updated.includes(h.wallet)) {
      const [newPlanet] = holdersToPlanets([h]); 
      PLANETS_CACHE.push(newPlanet);
    }
  }

  PLANETS_CACHE = PLANETS_CACHE.filter(p => p.percentage > 0.0001);
}

async function buildScene() {
  const holders = await fetchHoldersRPC(MINT);
  const top = holders.map(h => ({
    wallet: h.wallet,
    percentage: h.percentage,
    uiAmount: h.uiAmount
  }));

  if (PLANETS_CACHE.length === 0) {
    PLANETS_CACHE = holdersToPlanets(top); 
  } else {
    updatePlanetsFromHolders(top); 
  }

  const stars = PLANETS_CACHE.length === 0 ? makeStars(1200) : SCENE.stars;

  const sun = { 
    radius: 160,
    glow: 220,
    color: '#fff7a5',
    core: '#fff7a5',
    mid:  '#ffd36a',
    edge: '#ff9e3d',
    rot:  0,
    spin: 0.0025
  };

  return { stars, sun, planets: PLANETS_CACHE };
}



let SCENE = { stars: [], sun: { radius: 80, glow: 200, color: '#ffff88' }, planets: [], version: 0, updatedAt: 0 };
let lastLoadedAt = 0;
let SCENE_VERSION = 0; 

const ORBIT_K = 0.004;           
let lastSimTs = Date.now();

function simulateStep() {
  const now = Date.now();
  const dt = (now - lastSimTs) / 16.67; 
  lastSimTs = now;

  const ps = SCENE.planets || [];
  for (const p of ps) {
    p.angle = (p.angle || 0) + (p.speed || 0) * ORBIT_K * dt;
    p.rot   = (p.rot   || 0) + (p.selfSpin || 0.005) * dt;
  }

if (SCENE.sun) {
  const s = SCENE.sun;
  s.rot = (s.rot || 0) + (s.spin || 0.0025) * dt;
  if (s.rot > Math.PI * 2) s.rot -= Math.PI * 2;
}
}

setInterval(simulateStep, 50);


let preloadRunning = false;

async function preload() {
  if (preloadRunning) return;
  preloadRunning = true;
  try {
    if (!(poolsAddresses instanceof Set) || poolsAddresses.size === 0) {
      poolsAddresses = await fetchPoolsFromTracker(MINT);
    }
    SCENE = await buildScene();
    lastLoadedAt = Date.now();
    SCENE_VERSION += 1;
    SCENE.version = SCENE_VERSION;
    SCENE.updatedAt = lastLoadedAt;
    console.log(`✅ Scene built: planets=${SCENE.planets.length}, version=${SCENE.version}`);
  } catch (err) {
    console.error('❌ Error loading holders:', err.message);
  } finally {
    preloadRunning = false;
  }
}

const REFRESH_MS = 10000; 
setInterval(preload, REFRESH_MS);

app.get('/api/get-planets', async (req, res) => {
  
  if (!SCENE.planets.length || Date.now() - lastLoadedAt > REFRESH_MS) {
    await preload();
  }
  res.json(SCENE);
});


import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  preload(); 
});
