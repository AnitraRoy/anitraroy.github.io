// -- Theme toggle --
const themeBtn = document.getElementById('theme-toggle');

function isLight() {
  return document.documentElement.classList.contains('light');
}

function setTheme(light) {
  document.documentElement.classList.toggle('light', light);
  localStorage.setItem('theme', light ? 'light' : 'dark');
  updateLogoIcons();
}

themeBtn?.addEventListener('click', () => setTheme(!isLight()));

// -- Theme-aware logo images --
function updateLogoIcons() {
  const light = isLight();
  document.querySelectorAll('.theme-aware-logo').forEach(img => {
    img.src = light ? img.dataset.light : img.dataset.dark;
  });
}
// Run on load
updateLogoIcons();

// -- Nav active link highlighting on scroll --
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');

function updateActiveNav() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';

  navLinks.forEach(link => {
    const href = link.getAttribute('href');

    // Path-based match for top-level pages (/background, /projects, /photos)
    if (href !== '/' && href.startsWith('/') && path.startsWith(href)) {
      link.classList.add('active');
      return;
    }

    // Exact match for home
    if (href === '/' && path === '/') {
      link.classList.add('active');
      return;
    }

    // Anchor-based match for single-page sections
    if (href.startsWith('#') && sections.length) {
      // handled below
      return;
    }

    link.classList.remove('active');
  });
}

function updateActiveNavScroll() {
  if (!sections.length) return;
  let currentSection = sections[0].id;

  sections.forEach(section => {
    const rect = section.getBoundingClientRect();
    if (rect.top <= window.innerHeight * 0.35) {
      currentSection = section.id;
    }
  });

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href.startsWith('#')) return;
    if (href === '#' + currentSection) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

window.addEventListener('scroll', updateActiveNavScroll, { passive: true });
window.addEventListener('resize', updateActiveNav);
updateActiveNav();

// Smooth scroll on nav link click
navLinks.forEach(link => {
  link.addEventListener('click', e => {
    const href = link.getAttribute('href');

    if (href.startsWith('#')) {
      e.preventDefault();

      const targetId = href.slice(1);
      const target = document.getElementById(targetId);

      if (target) {
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    }
  });
});

// -- Scroll progress indicator --
const scrollFill = document.getElementById('scroll-progress-fill');

function updateScrollProgress() {
  if (!scrollFill) return;
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  scrollFill.style.height = Math.min(pct, 100) + '%';
}

window.addEventListener('scroll', updateScrollProgress, { passive: true });
updateScrollProgress();

// -- About photo carousel --
const carouselImages = document.querySelectorAll('.carousel-image');
let currentCarouselIndex = 0;

function advanceCarousel() {
  carouselImages[currentCarouselIndex].classList.remove('active');
  currentCarouselIndex = (currentCarouselIndex + 1) % carouselImages.length;
  carouselImages[currentCarouselIndex].classList.add('active');
}

if (carouselImages.length) {
  setInterval(advanceCarousel, 3500);
  document.querySelector('.carousel')?.addEventListener('click', advanceCarousel);
}

// -- Scroll-triggered fade-in --
const faders = document.querySelectorAll('.fade-in');
const fadeObserver = new IntersectionObserver((entries, obs) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('visible');
    obs.unobserve(entry.target);
  });
}, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' });

faders.forEach(el => fadeObserver.observe(el));

// -- Low-poly mesh background --
const meshCanvas = document.getElementById('bg-mesh');
const meshCtx    = meshCanvas ? meshCanvas.getContext('2d') : null;

const MESH_SPACING = 72;
const MESH_RADIUS  = 190;
const MESH_PULL    = 0.38;
const MESH_SPRING  = 0.09;
const MESH_DAMP    = 0.74;
const MESH_IDLE    = 0.008;

let meshPts       = [];
let meshTris      = [];
let meshMouse     = { x: -9999, y: -9999 };
let meshRafId     = null;
let meshRunning   = false;
let meshResizeRaf = 0;
let meshClickPulses = []; // { x, y, age, maxAge }

const meshPrefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function buildMesh() {
  if (!meshCanvas) return;
  meshPts  = [];
  meshTris = [];

  const W    = window.innerWidth;
  const H    = window.innerHeight;
  const cols = Math.ceil(W / MESH_SPACING) + 3;
  const rows = Math.ceil(H / (MESH_SPACING * 0.86)) + 3;

  for (let r = -1; r <= rows; r++) {
    for (let c = -1; c <= cols; c++) {
      const jx = (Math.random() - 0.5) * MESH_SPACING * 0.4;
      const jy = (Math.random() - 0.5) * MESH_SPACING * 0.4;
      const hx = c * MESH_SPACING + (r % 2 === 0 ? 0 : MESH_SPACING * 0.5) + jx;
      const hy = r * MESH_SPACING * 0.86 + jy;
      meshPts.push({ hx, hy, x: hx, y: hy, vx: 0, vy: 0 });
    }
  }

  const cols2 = cols + 2;
  for (let r = 0; r < rows + 1; r++) {
    for (let c = 0; c < cols2 - 1; c++) {
      const i  = r * cols2 + c;
      const i1 = r * cols2 + c + 1;
      const i2 = (r + 1) * cols2 + c;
      const i3 = (r + 1) * cols2 + c + 1;
      if (i < meshPts.length && i1 < meshPts.length && i2 < meshPts.length)
        meshTris.push([i, i1, i2]);
      if (i1 < meshPts.length && i2 < meshPts.length && i3 < meshPts.length)
        meshTris.push([i1, i3, i2]);
    }
  }
}

function resizeMeshCanvas() {
  if (!meshCanvas || !meshCtx) return;
  const dpr = window.devicePixelRatio || 1;
  meshCanvas.width  = window.innerWidth  * dpr;
  meshCanvas.height = window.innerHeight * dpr;
  meshCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildMesh();
  if (!meshRunning) drawMesh();
}

function getMeshTriColor(mx, my) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const light = isLight();

  // Horizontal gradient factor 0 (left) → 1 (right)
  const gx = mx / W;

  // Cursor influence
  const cdx = meshMouse.x - mx;
  const cdy = meshMouse.y - my;
  const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
  const cursorInf = Math.max(0, 1 - cdist / MESH_RADIUS);

  // Click pulse influence — sum contributions from all active pulses
  let clickInf = 0;
  for (const p of meshClickPulses) {
    const pdx = p.x - mx;
    const pdy = p.y - my;
    const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
    const pulseRadius = MESH_RADIUS * 2.5 * (p.age / p.maxAge);
    const ring = Math.max(0, 1 - Math.abs(pdist - pulseRadius * 0.6) / (MESH_RADIUS * 0.8));
    const fade = 1 - p.age / p.maxAge;
    clickInf = Math.max(clickInf, ring * fade);
  }

  const totalInf = Math.min(1, cursorInf + clickInf * 0.85);

  if (light) {
    // Light: amber left -> red right
    // Base gradient colors
    const leftR = 235, leftG = 160, leftB = 85; // amber
    const rightR = 175, rightG = 45, rightB = 50; // red

    const baseR = leftR + (rightR - leftR) * gx;
    const baseG = leftG + (rightG - leftG) * gx;
    const baseB = leftB + (rightB - leftB) * gx;

    // On interaction, darken and saturate
    const brighten = totalInf * 0.25;
    const r = Math.round(Math.min(255, baseR + (255 - baseR) * brighten));
    const g = Math.round(Math.min(255, baseG + (255 - baseG) * brighten * 0.7));
    const b = Math.round(Math.min(255, baseB + (255 - baseB) * brighten * 0.5));

    // Alpha: low base, higher near interaction, softer behind content
    const baseAlpha = 0.15 + totalInf * 0.40;
    return `rgba(${r},${g},${b},${baseAlpha})`;
  }
  
  else {
    // Dark: blue left -> teal-green right
    const leftR = 40,  leftG = 70,  leftB = 160;  // blue
    const rightR = 30, rightG = 140, rightB = 120; // teal-green

    const baseR = leftR + (rightR - leftR) * gx;
    const baseG = leftG + (rightG - leftG) * gx;
    const baseB = leftB + (rightB - leftB) * gx;

    const darkening = totalInf * 0.35;
    const r = Math.round(baseR + totalInf * 30);
    const g = Math.round(baseG + totalInf * 35);
    const b = Math.round(baseB + totalInf * 20);

    const baseAlpha = 0.05 + totalInf * 0.2;
    return `rgba(${r},${g},${b},${baseAlpha})`;
  }
}

function drawMesh() {
  if (!meshCanvas || !meshCtx) return;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const light = isLight();

  meshCtx.clearRect(0, 0, W, H);

  // Tick click pulses
  meshClickPulses = meshClickPulses.filter(p => p.age < p.maxAge);
  meshClickPulses.forEach(p => p.age++);

  for (const [ai, bi, ci] of meshTris) {
    const a = meshPts[ai];
    const b = meshPts[bi];
    const c = meshPts[ci];
    if (!a || !b || !c) continue;

    const mx = (a.x + b.x + c.x) / 3;
    const my = (a.y + b.y + c.y) / 3;

    const fill = getMeshTriColor(mx, my);

    meshCtx.beginPath();
    meshCtx.moveTo(a.x, a.y);
    meshCtx.lineTo(b.x, b.y);
    meshCtx.lineTo(c.x, c.y);
    meshCtx.closePath();
    meshCtx.fillStyle = fill;
    meshCtx.fill();

    // Edge — slightly visible at rest, more defined near interaction
    const cdx = meshMouse.x - mx;
    const cdy = meshMouse.y - my;
    const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
    const eInf = Math.max(0, 1 - cdist / MESH_RADIUS);
    meshCtx.strokeStyle = light
      ? `rgba(0,0,0,${0.03 + eInf * 0.07})`
      : `rgba(255,255,255,${0.025 + eInf * 0.055})`;
    meshCtx.lineWidth = 0.5;
    meshCtx.stroke();
  }
}

function tickMesh() {
  let anyActive = meshMouse.x > -1000 || meshClickPulses.length > 0;

  for (const p of meshPts) {
    const dx   = meshMouse.x - p.hx;
    const dy   = meshMouse.y - p.hy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let tx = p.hx, ty = p.hy;

    if (dist > 0 && dist < MESH_RADIUS) {
      const f = (1 - dist / MESH_RADIUS) * MESH_PULL;
      tx = p.hx + dx * f;
      ty = p.hy + dy * f;
    }

    for (const pulse of meshClickPulses) {
      const pdx  = p.hx - pulse.x;
      const pdy  = p.hy - pulse.y;
      const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
      if (pdist < 1) continue;

      const progress    = pulse.age / pulse.maxAge;
      const waveFront   = MESH_RADIUS * 3.5 * progress;
      const ringWidth   = MESH_RADIUS * 1.2;
      const distToRing  = Math.abs(pdist - waveFront);
      const onRing      = Math.max(0, 1 - distToRing / ringWidth);
      const fade        = 1 - progress;
      const force       = onRing * fade * 18;

      tx += (pdx / pdist) * force;
      ty += (pdy / pdist) * force;
    }

    p.vx = (p.vx + (tx - p.x) * MESH_SPRING) * MESH_DAMP;
    p.vy = (p.vy + (ty - p.y) * MESH_SPRING) * MESH_DAMP;
    p.x += p.vx;
    p.y += p.vy;

    if (!anyActive && (
      Math.abs(p.vx) > MESH_IDLE || Math.abs(p.vy) > MESH_IDLE ||
      Math.abs(p.x - p.hx) > MESH_IDLE || Math.abs(p.y - p.hy) > MESH_IDLE
    )) anyActive = true;
  }

  drawMesh();

  if (anyActive) {
    meshRafId = requestAnimationFrame(tickMesh);
  } else {
    meshRunning = false;
  }
}

function startMeshTick() {
  if (!meshRunning && !meshPrefersReduced) {
    meshRunning = true;
    meshRafId   = requestAnimationFrame(tickMesh);
  }
}

// Init
requestAnimationFrame(() => {
  if (meshCanvas && meshCtx) resizeMeshCanvas();
});

window.addEventListener('resize', () => {
  cancelAnimationFrame(meshResizeRaf);
  meshResizeRaf = requestAnimationFrame(resizeMeshCanvas);
}, { passive: true });

// Mouse
if (!meshPrefersReduced) {
  document.addEventListener('mousemove', e => {
    meshMouse.x = e.clientX;
    meshMouse.y = e.clientY;
    startMeshTick();
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    meshMouse.x = -9999;
    meshMouse.y = -9999;
  });

  // Click pulse — single click + hold to repeat
  let holdInterval = null;

  function spawnPulse(x, y) {
    meshClickPulses.push({ x, y, age: 0, maxAge: 80 });
    startMeshTick();
  }

  let holdPos = { x: 0, y: 0 };

  document.addEventListener('mousemove', e => {
    holdPos.x = e.clientX;
    holdPos.y = e.clientY;
  });

  document.addEventListener('mousedown', e => {
    holdPos.x = e.clientX;
    holdPos.y = e.clientY;
    spawnPulse(holdPos.x, holdPos.y);
    holdInterval = setInterval(() => spawnPulse(holdPos.x, holdPos.y), 350);
  });

  document.addEventListener('mouseup', () => {
    clearInterval(holdInterval);
    holdInterval = null;
  });

  document.addEventListener('mouseleave', () => {
    clearInterval(holdInterval);
    holdInterval = null;
  });

  document.addEventListener('touchmove', e => {
    meshMouse.x = e.touches[0].clientX;
    meshMouse.y = e.touches[0].clientY;
    startMeshTick();
  }, { passive: true });

  document.addEventListener('touchend', e => {
    // Treat tap as click pulse
    meshClickPulses.push({
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
      age: 0,
      maxAge: 80
    });
    meshMouse.x = -9999;
    meshMouse.y = -9999;
    startMeshTick();
  });
}

// Theme change
new MutationObserver(() => {
  if (!meshCanvas || !meshCtx) return;
  if (!meshRunning) drawMesh();
}).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

// Custom cursor
const dot = document.querySelector('.cursor-dot');

let mouseX = 0, mouseY = 0;
let cursorVisible = false;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;

  dot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;

  if (!cursorVisible) {
    cursorVisible = true;
    dot.style.visibility = 'visible';
  }
});

// -- Typing tagline --
const taglineTitles = [
  'Industrial Engineer',
  'ML Enthusiast',
  'Data Engineer',
  'Systems Thinker',
  'Operations Analyst'
];

const taglineEl = document.getElementById('typed-tagline');
let taglineIndex = 0;
let charIndex = 0;
let isDeleting = false;
let taglinePause = false;

function typeTagline() {
  if (!taglineEl) return;
  const current = taglineTitles[taglineIndex];

  if (!isDeleting) {
    taglineEl.textContent = current.slice(0, charIndex + 1);
    charIndex++;
    if (charIndex === current.length) {
      taglinePause = true;
      setTimeout(() => { taglinePause = false; isDeleting = true; typeTagline(); }, 1800);
      return;
    }
  } else {
    taglineEl.textContent = current.slice(0, charIndex - 1);
    charIndex--;
    if (charIndex === 0) {
      isDeleting = false;
      taglineIndex = (taglineIndex + 1) % taglineTitles.length;
    }
  }

  const speed = isDeleting ? 60 : 100;
  setTimeout(typeTagline, speed);
}

typeTagline();

// -- Skill bars --
const skillRows = document.querySelectorAll('.skill-bar-row');

const skillObserver = new IntersectionObserver((entries, obs) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const row = entry.target;
    const level = parseInt(row.dataset.level, 10);
    const fill = row.querySelector('.skill-bar-fill');
    const pct  = row.querySelector('.skill-bar-pct');
    let current = 0;
    const duration = 900;
    const start = performance.now();

    function animate(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      current = Math.round(ease * level);
      fill.style.width = current + '%';
      pct.textContent  = current + '%';
      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
    obs.unobserve(row);
  });
}, { threshold: 0.3 });

skillRows.forEach(row => skillObserver.observe(row));

// -- Footer --
async function loadLastCommit() {
  const label = document.getElementById('commit-label');
  if (!label) return;

  try {
    const res = await fetch('https://api.github.com/repos/AnitraRoy/anitraroy.github.io/commits?per_page=1');
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    const commit = data[0];
    const sha     = commit.sha.slice(0, 7);
    const date    = new Date(commit.commit.author.date);
    const msg     = commit.commit.message.split('\n')[0].slice(0, 36);
    const ago     = timeAgo(date);

    label.textContent = '';

    const shaSpan = document.createElement('span');
    shaSpan.className = 'commit-sha';
    shaSpan.textContent = sha;

    const msgSpan = document.createElement('span');
    msgSpan.className = 'commit-msg';
    msgSpan.textContent = msg;

    const agoSpan = document.createElement('span');
    agoSpan.className = 'commit-ago';
    agoSpan.textContent = ago;

    label.appendChild(shaSpan);
    label.appendChild(msgSpan);
    label.appendChild(agoSpan);
  } catch {
    const label = document.getElementById('commit-label');
    if (label) label.textContent = 'last commit: Apr 2026';
  }
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date) / 1000);
  if (seconds < 60)   return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)   return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)     return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30)      return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12)    return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

loadLastCommit();

// -- Skills constellation --
const conCanvas = document.getElementById('constellation-canvas');
const conCtx    = conCanvas ? conCanvas.getContext('2d') : null;

const CON_NODES = [
  { label: 'Python', r: 22 },
  { label: 'SQL',    r: 18 },
  { label: 'Java',   r: 17 },
  { label: 'Excel',  r: 16 },
  { label: 'R',      r: 15 },
  { label: 'Gurobi', r: 18 },
];

const CON_EDGES = [
  [0,1],[0,2],[0,5],[1,3],[1,5],[2,4],[3,4],[4,5],[2,5]
];

let conNodes  = [];
let conAngle  = 0;
let conRaf    = null;
let conActive = false;

function initConstellation() {
  if (!conCanvas || !conCtx) return;

  const W   = conCanvas.offsetWidth;
  const H   = conCanvas.offsetHeight;
  const dpr = window.devicePixelRatio || 1;

  conCanvas.width  = W * dpr;
  conCanvas.height = H * dpr;
  conCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const cx    = W / 2;
  const cy    = H / 2;
  const baseR = Math.min(W * 0.42, H * 0.72);

  conNodes = CON_NODES.map((n, i) => {
    const angle = (i / CON_NODES.length) * Math.PI * 2 - Math.PI / 2;
    return { ...n, baseAngle: angle, dist: baseR, cx, cy };
  });
}

function getConPos(node, globalAngle) {
  const a = node.baseAngle + globalAngle;
  return {
    x: node.cx + Math.cos(a) * node.dist,
    y: node.cy + Math.sin(a) * node.dist * 0.55
  };
}

function drawConstellation() {
  if (!conCanvas || !conCtx) return;
  const W = conCanvas.width / (window.devicePixelRatio || 1);
  const H = conCanvas.height / (window.devicePixelRatio || 1);

  conCtx.clearRect(0, 0, W, H);

  const light = isLight();
  const edgeColor   = light ? 'rgba(0,0,0,0.07)'  : 'rgba(255,255,255,0.07)';
  const nodeColor   = light ? 'rgba(0,0,0,0.12)'  : 'rgba(255,255,255,0.12)';
  const labelColor  = light ? 'rgba(0,0,0,0.35)'  : 'rgba(255,255,255,0.35)';

  const positions = conNodes.map(n => getConPos(n, conAngle));

  // Draw edges
  conCtx.strokeStyle = edgeColor;
  conCtx.lineWidth   = 0.75;
  CON_EDGES.forEach(([a, b]) => {
    const pa = positions[a];
    const pb = positions[b];
    conCtx.beginPath();
    conCtx.moveTo(pa.x, pa.y);
    conCtx.lineTo(pb.x, pb.y);
    conCtx.stroke();
  });

  // Draw nodes + labels
  conNodes.forEach((node, i) => {
    const { x, y } = positions[i];

    conCtx.beginPath();
    conCtx.arc(x, y, 3, 0, Math.PI * 2);
    conCtx.fillStyle = nodeColor;
    conCtx.fill();

    conCtx.font = `11px monospace`;
    conCtx.fillStyle = labelColor;
    conCtx.textAlign = 'center';
    conCtx.fillText(node.label, x, y - 8);
  });

  conAngle += 0.0015;
  conRaf = requestAnimationFrame(drawConstellation);
}

// Only animate when about section is visible
const conObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !conActive) {
      conActive = true;
      initConstellation();
      drawConstellation();
    } else if (!entry.isIntersecting && conActive) {
      conActive = false;
      cancelAnimationFrame(conRaf);
    }
  });
}, { threshold: 0.1 });

const aboutSection = document.getElementById('about');
if (aboutSection) conObserver.observe(aboutSection);

window.addEventListener('resize', () => {
  if (conActive) initConstellation();
});

// Project filters
(function () {
  const filters = document.getElementById('project-filters');
  if (!filters) return;

  const allBtn = filters.querySelector('[data-filter="all"]');
  const projects = document.querySelectorAll('#projects .project-card');

  function updatePillHighlights(activeFilters) {
    projects.forEach(row => {
      const pills = row.querySelectorAll('.skill-pill');

      pills.forEach(pill => {
        const tag = pill.dataset.tag || pill.textContent.trim();
        const match = activeFilters.includes(tag);

        pill.classList.toggle('pill-active', match);
      });
    });
  }
  
  filters.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;

    const filter = btn.dataset.filter;

    const allBtn = filters.querySelector('[data-filter="all"]');

    // One focus area at a time: click to show it, click it again to go back to all
    const wasActive = btn.classList.contains('active');
    filters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (filter === 'all' || wasActive) allBtn.classList.add('active');
    else btn.classList.add('active');

    // collect active filters
    let activeFilters = Array.from(
      filters.querySelectorAll('.filter-btn.active')
    ).map(b => b.dataset.filter);

    // if nothing selected, then fallback to "all"
    if (activeFilters.length === 0) {
      allBtn.classList.add('active');
      activeFilters = ['all'];
    }

    // filter projects
    const projects = document.querySelectorAll('#projects .project-card');

    let visibleIndex = 0;
    projects.forEach(row => {
      const tags = (row.dataset.tags || '').split(' ');

      const match =
        activeFilters.includes('all') ||
        activeFilters.some(f => tags.includes(f));

      if (match) {
        row.classList.remove('hidden', 'visible');
        row.style.opacity = '0';
        row.style.transform = 'translateY(12px)';
        const delay = visibleIndex * 80;
        setTimeout(() => {
          row.style.opacity = '';
          row.style.transform = '';
          row.classList.add('visible');
        }, delay);
        visibleIndex++;
      } else {
        row.classList.add('hidden');
        row.classList.remove('visible');
      }
    });

    // highlight pills inside visible projects
    updatePillHighlights(activeFilters);
  });
})();


// -- Mobile nav toggle --
const navToggle    = document.querySelector('.nav-toggle');
const navLinksMenu = document.querySelector('.nav-links');

navToggle?.addEventListener('click', () => {
  navLinksMenu.classList.toggle('open');
});

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    navLinksMenu.classList.remove('open');
  });
});

(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rows = Array.from(document.querySelectorAll('.entry-row'));

  // ---------- Collapsible bullets ----------
  let uid = 0;
  rows.forEach(row => {
    const ul = row.querySelector('.entry-bullets');
    if (!ul) return;
    const items = Array.from(ul.children);
    if (items.length < 1) return;

    const id = 'more-' + (++uid);
    const more = document.createElement('div');
    more.className = 'bullets-more';
    more.id = id;
    more.setAttribute('inert', '');
    const inner = document.createElement('div');
    inner.className = 'bullets-more-inner';
    const restUl = document.createElement('ul');
    restUl.className = 'entry-bullets';
    items.slice(0).forEach(li => restUl.appendChild(li));
    inner.appendChild(restUl);
    more.appendChild(inner);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'more-btn';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', id);
    const n = items.length;
    btn.innerHTML = `<span class="more-plus">+</span><span class="more-text">${n} more detail${n > 1 ? 's' : ''}</span>`;

    btn.addEventListener('click', () => {
      const open = !more.classList.contains('open');
      more.classList.toggle('open', open);
      open ? more.removeAttribute('inert') : more.setAttribute('inert', '');
      btn.setAttribute('aria-expanded', String(open));
      btn.classList.toggle('open', open);
      btn.querySelector('.more-text').textContent = open ? 'show less' : `${n} more detail${n > 1 ? 's' : ''}`;
    });

    ul.after(more);
    more.after(btn);
  });

  // ---------- Scroll-drawn timeline (Experience) ----------
  const tlList = document.querySelector('#experience .entry-list');
  if (tlList) {
    tlList.classList.add('timeline');
    const tlRows = Array.from(tlList.querySelectorAll('.entry-row'));
    const dots = tlRows.map(r => {
      const d = document.createElement('span');
      d.className = 'tl-dot';
      d.setAttribute('aria-hidden', 'true');
      r.appendChild(d);
      return d;
    });

    function updateTimeline() {
      const rect = tlList.getBoundingClientRect();
      const scrollY = window.scrollY;
      const startScroll = rect.top + scrollY - window.innerHeight * 0.6;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const endScroll = Math.max(startScroll + 1, maxScroll);
      const prog = Math.max(0, Math.min(1, (scrollY - startScroll) / (endScroll - startScroll)));

      tlList.style.setProperty('--tl', reduced ? 1 : prog.toFixed(4));

      tlRows.forEach((r, i) => {
        const dotY = r.getBoundingClientRect().top - rect.top + 36;

        dots[i].classList.toggle(
          'on',
          reduced || dotY <= prog * rect.height
        );
      });
    }
    window.addEventListener('scroll', updateTimeline, { passive: true });
    window.addEventListener('resize', updateTimeline);
    updateTimeline();
  }

  // ---------- Stacked hero photo deck ----------
  const oldCarousel = document.querySelector('.hero-carousel .carousel');
  if (oldCarousel) {
    const carousel = oldCarousel.cloneNode(true); // drops the old fade listeners
    oldCarousel.replaceWith(carousel);
    carousel.classList.add('deck');
    carousel.setAttribute('role', 'button');
    carousel.setAttribute('tabindex', '0');
    carousel.setAttribute('aria-label', 'Photos of Anitra. Click to see the next one');

    let order = Array.from(carousel.querySelectorAll('.carousel-image'));
    order.forEach(img => img.classList.remove('active'));

    function layoutDeck() {
      order.forEach((img, i) => {
        img.style.setProperty('--pos', i);
        img.style.setProperty('--o', i < 3 ? (1 - i * 0.28).toFixed(2) : 0);
      });
    }
    function nextCard() {
      order.push(order.shift());
      layoutDeck();
    }
    layoutDeck();

    let timer = setInterval(nextCard, 4500);
    const restart = () => { clearInterval(timer); timer = setInterval(nextCard, 4500); };
    carousel.addEventListener('click', () => { nextCard(); restart(); });
    carousel.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nextCard(); restart(); }
    });
    carousel.addEventListener('mouseenter', () => clearInterval(timer));
    carousel.addEventListener('mouseleave', restart);
  }
})();

(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Page transitions ----------
  const normPath = p => p.replace(/index\.html$/, '').replace(/\/+$/, '') || '/';

  function navigate(url) {
    const u = new URL(url, location.href);
    // Same page: just scroll to the hash (or top)
    if (u.origin === location.origin && normPath(u.pathname) === normPath(location.pathname) && u.search === location.search) {
      const target = u.hash && document.getElementById(u.hash.slice(1));
      if (target) {
        const top = target.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      }
      return;
    }
    if (reduced) { location.href = u.href; return; }
    document.body.classList.add('page-leaving');
    setTimeout(() => { location.href = u.href; }, 220);
  }

  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin) return;
    e.preventDefault();
    navigate(u.href);
  });

  // Coming back via the browser's back button should never stay faded out
  window.addEventListener('pageshow', e => {
    if (e.persisted) document.body.classList.remove('page-leaving');
  });

  // ---------- Back to top with progress ring ----------
  const CIRC = 2 * Math.PI * 15;
  const topBtn = document.createElement('button');
  topBtn.type = 'button';
  topBtn.className = 'to-top';
  topBtn.setAttribute('aria-label', 'Back to top');
  topBtn.innerHTML =
    '<svg viewBox="0 0 36 36" aria-hidden="true">' +
      '<circle class="to-top-track" cx="18" cy="18" r="15"></circle>' +
      '<circle class="to-top-ring" cx="18" cy="18" r="15" stroke-dasharray="' + CIRC.toFixed(2) + '" stroke-dashoffset="' + CIRC.toFixed(2) + '"></circle>' +
      '<path class="to-top-arrow" d="M18 24V12M12.5 17.5L18 12l5.5 5.5"></path>' +
    '</svg>';
  document.body.appendChild(topBtn);
  const ring = topBtn.querySelector('.to-top-ring');

  function updateToTop() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
    ring.style.strokeDashoffset = (CIRC * (1 - p)).toFixed(2);
    // Short pages get an earlier trigger so the button still appears
    topBtn.classList.toggle('show', max > 80 && window.scrollY > Math.min(400, max * 0.4));
  }
  window.addEventListener('scroll', updateToTop, { passive: true });
  window.addEventListener('resize', updateToTop);
  updateToTop();
  topBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });

  // ---------- Copy email + toast ----------
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);
  let toastTimer = null;

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch (e) { return false; }
    }
  }

  const EMAIL = 'royanitra04@gmail.com';
  async function copyEmail() {
    const ok = await copyText(EMAIL);
    showToast(ok ? 'Email copied to clipboard' : EMAIL);
  }

  document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
    a.title = 'Click to copy email';
    a.addEventListener('click', e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return; // modifier-click still opens mail app
      e.preventDefault();
      copyEmail();
    });
  });

  // ---------- Command palette ----------
  const FILTERS = [
    { slug: 'data-science', label: 'Data Science', kw: 'analytics statistics optimization' },
    { slug: 'ai-ml', label: 'AI/ML', kw: 'machine learning artificial intelligence deep learning' },
    { slug: 'full-stack', label: 'Full-Stack', kw: 'web app frontend backend software' },
  ];
  const openProj = id => (window.openProject ? window.openProject(id) : navigate('/projects#' + id));
  const COMMANDS = [
    // Pages
    { type: 'Page', label: 'Home', kw: 'hero start', run: () => navigate('/') },
    { type: 'Page', label: 'Background', kw: 'education experience resume', run: () => navigate('/background') },
    { type: 'Page', label: 'Projects', kw: 'work portfolio', run: () => navigate('/projects') },
    // Sections
    { type: 'Section', label: 'About', kw: 'bio skills interests', run: () => navigate('/#about') },
    { type: 'Section', label: 'Education', kw: 'university toronto degree', run: () => navigate('/background#background') },
    { type: 'Section', label: 'Experience', kw: 'work jobs ttc uhn iit ottawa', run: () => navigate('/background#experience') },
    // Projects are added automatically from the projects page (see loadProjects below)
    // Focus-area filters
    ...FILTERS.map(f => ({ type: 'Filter', label: 'Show ' + f.label + ' projects', kw: 'filter focus ' + f.label + ' ' + f.kw, run: () => navigate('/projects?filter=' + f.slug) })),
    // Actions
    { type: 'Action', label: 'Toggle light / dark theme', kw: 'mode appearance', run: () => document.getElementById('theme-toggle')?.click() },
    { type: 'Action', label: 'Copy email address', kw: 'contact mail', run: copyEmail },
    { type: 'Action', label: 'Open GitHub', kw: 'code profile', url: 'https://github.com/AnitraRoy' },
    { type: 'Action', label: 'Open LinkedIn', kw: 'profile connect', url: 'https://linkedin.com/in/AnitraRoy' },
    { type: 'Action', label: 'Scroll to top', kw: 'back', run: () => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }) },
  ];

  // Project entries come from the cards on the projects page itself, so they never go stale
  let projectsLoaded = false;
  function addProjectCommands(root) {
    root.querySelectorAll('.project-card').forEach(card => {
      const id = card.id;
      const title = card.querySelector('.pc-title')?.textContent.trim();
      if (!id || !title || COMMANDS.some(c => c.projId === id)) return;
      const tags = Array.from(card.querySelectorAll('.skill-pill')).map(x => x.textContent.trim()).join(' ');
      const summary = card.querySelector('.pc-summary')?.textContent || '';
      COMMANDS.push({ type: 'Project', label: title, kw: tags + ' ' + summary, projId: id, run: () => openProj(id) });
    });
  }
  async function loadProjects() {
    if (projectsLoaded) return;
    projectsLoaded = true;
    if (document.querySelector('.project-card')) {
      addProjectCommands(document);
    } else {
      try {
        const res = await fetch('/projects/');
        if (!res.ok) throw new Error('not ok');
        addProjectCommands(new DOMParser().parseFromString(await res.text(), 'text/html'));
      } catch (e) { projectsLoaded = false; }
    }
    if (typeof overlay !== 'undefined' && !overlay.hidden) render();
  }
  setTimeout(loadProjects, 1200);

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  // Markup
  const overlay = document.createElement('div');
  overlay.className = 'cmdk-overlay';
  overlay.hidden = true;
  overlay.innerHTML =
    '<div class="cmdk" role="dialog" aria-modal="true" aria-label="Command palette">' +
      '<input class="cmdk-input" type="text" placeholder="Search pages, projects, actions…" autocomplete="off" spellcheck="false" ' +
        'role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-autocomplete="list" />' +
      '<ul class="cmdk-list" id="cmdk-list" role="listbox"></ul>' +
      '<div class="cmdk-foot"><span>↑↓ navigate</span><span>↵ select</span><span>esc close</span></div>' +
    '</div>';
  document.body.appendChild(overlay);

  const input = overlay.querySelector('.cmdk-input');
  const list  = overlay.querySelector('.cmdk-list');
  let results = [];
  let sel = 0;

  function score(cmd, q) {
    const label = cmd.label.toLowerCase();
    const hay = (label + ' ' + (cmd.kw || '') + ' ' + cmd.type).toLowerCase();
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    let s = 0;
    for (const t of tokens) {
      if (!hay.includes(t)) return -1;
      s += label.startsWith(t) ? 3 : label.includes(t) ? 2 : 1;
    }
    return s;
  }

  function render() {
    const q = input.value.trim();
    results = q
      ? COMMANDS.map(c => ({ c, s: score(c, q) })).filter(x => x.s >= 0).sort((a, b) => b.s - a.s).map(x => x.c)
      : COMMANDS.filter(c => ['Page', 'Section', 'Action'].includes(c.type));
    sel = 0;
    list.textContent = '';
    if (!results.length) {
      const li = document.createElement('li');
      li.className = 'cmdk-empty';
      li.textContent = 'No results';
      list.appendChild(li);
      input.removeAttribute('aria-activedescendant');
      return;
    }
    results.forEach((c, i) => {
      const li = document.createElement('li');
      li.className = 'cmdk-item';
      li.id = 'cmdk-item-' + i;
      li.setAttribute('role', 'option');
      const l = document.createElement('span');
      l.className = 'cmdk-label';
      l.textContent = c.label;
      const t = document.createElement('span');
      t.className = 'cmdk-type';
      t.textContent = c.url ? c.type + ' ↗' : c.type;
      li.append(l, t);
      li.addEventListener('mousemove', () => { if (sel !== i) { sel = i; highlight(false); } });
      li.addEventListener('click', () => choose(i));
      list.appendChild(li);
    });
    highlight(true);
  }

  function highlight(scroll) {
    list.querySelectorAll('.cmdk-item').forEach((li, i) => {
      const on = i === sel;
      li.classList.toggle('active', on);
      li.setAttribute('aria-selected', String(on));
      if (on) {
        input.setAttribute('aria-activedescendant', li.id);
        if (scroll !== false) li.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function openPalette() {
    if (!overlay.hidden) return;
    loadProjects();
    overlay.hidden = false;
    input.value = '';
    render();
    requestAnimationFrame(() => overlay.classList.add('open'));
    document.body.style.overflow = 'hidden';
    input.focus();
  }

  function closePalette() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => { overlay.hidden = true; }, 180);
  }

  function choose(i) {
    const c = results[i];
    if (!c) return;
    closePalette();
    if (c.url) window.open(c.url, '_blank', 'noopener');
    else setTimeout(c.run, 120);
  }

  input.addEventListener('input', render);
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, results.length - 1); highlight(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); highlight(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(sel); }
    else if (e.key === 'Tab') { e.preventDefault(); }
  });
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) closePalette(); });

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      overlay.hidden ? openPalette() : closePalette();
    } else if (e.key === 'Escape' && !overlay.hidden) {
      closePalette();
    }
  });

  // Nav trigger button
  const group = document.querySelector('.nav-right-group');
  if (group) {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cmdk-trigger';
    trigger.setAttribute('aria-label', 'Open command palette');
    trigger.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5" stroke-linecap="round"/></svg>' +
      '<kbd>' + (isMac ? '⌘K' : 'Ctrl K') + '</kbd>';
    trigger.addEventListener('click', openPalette);
    group.insertBefore(trigger, document.getElementById('theme-toggle'));
  }

  // ---------- Projects page: honour ?filter=data-science (focus-area slug) ----------
  const wanted = new URLSearchParams(location.search).get('filter');
  if (wanted) {
    const btn = document.querySelector('#project-filters .filter-btn[data-filter="' + CSS.escape(wanted) + '"]');
    if (btn) btn.click();
  }
})();

/* -- Projects page: card accents + quick-view drawer -- */
(function () {
  const cards = Array.from(document.querySelectorAll('.project-card'));
  if (!cards.length) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Accent colour follows the card's first focus-area pill, so reassigning pills recolours the card too
  cards.forEach(card => {
    const pill = card.querySelector('.skill-pill');
    if (pill) card.style.setProperty('--accent', pill.style.getPropertyValue('--pill-color').trim());
  });

  // ---- Drawer markup ----
  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.hidden = true;
  overlay.innerHTML =
    '<aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">' +
      '<button type="button" class="drawer-close" aria-label="Close project details">&times;</button>' +
      '<div class="drawer-scroll">' +
        '<div class="pc-cover drawer-cover"><img alt="" /></div>' +
        '<div class="drawer-body">' +
          '<p class="drawer-meta"><span class="drawer-date"></span><span class="drawer-count"></span></p>' +
          '<h3 class="drawer-title" id="drawer-title"></h3>' +
          '<div class="project-tags drawer-tags"></div>' +
          '<ul class="entry-bullets drawer-bullets"></ul>' +
          '<a class="drawer-cta" target="_blank" rel="noopener noreferrer"><span></span><b aria-hidden="true">&#8599;</b></a>' +
        '</div>' +
      '</div>' +
      '<div class="drawer-nav">' +
        '<button type="button" class="drawer-step drawer-prev"><i aria-hidden="true">&larr;</i><span></span></button>' +
        '<button type="button" class="drawer-step drawer-next"><span></span><i aria-hidden="true">&rarr;</i></button>' +
      '</div>' +
    '</aside>';
  document.body.appendChild(overlay);

  const drawer   = overlay.querySelector('.drawer');
  const scroller = overlay.querySelector('.drawer-scroll');
  const q = sel => overlay.querySelector(sel);
  const closeBtn = q('.drawer-close');
  const prevBtn  = q('.drawer-prev');
  const nextBtn  = q('.drawer-next');

  let current = null;
  let opener = null;

  const visible = () => cards.filter(c => !c.classList.contains('hidden'));
  const titleOf = c => c.querySelector('.pc-title').textContent.trim();
  const shortTitle = c => c.dataset.short || titleOf(c).split(/[:(]/)[0].trim();
  const pad2 = n => String(n).padStart(2, '0');

  function fill(card) {
    ['--accent', '--cover-bg', '--cover-fit', '--cover-pad'].forEach(v => {
      const val = card.style.getPropertyValue(v);
      if (val) drawer.style.setProperty(v, val);
    });
    const img = q('.drawer-cover img');
    const src = card.querySelector('.pc-cover img');
    img.src = src.currentSrc || src.src;
    img.alt = src.alt;
    q('.drawer-date').textContent = card.querySelector('.pc-date').textContent;
    q('.drawer-title').textContent = titleOf(card);
    q('.drawer-tags').innerHTML = card.querySelector('.project-tags').innerHTML;
    q('.drawer-bullets').innerHTML = card.querySelector('.pc-detail .entry-bullets').innerHTML;
    const cta = q('.drawer-cta');
    cta.href = card.dataset.link;
    cta.querySelector('span').textContent = card.dataset.cta || 'View project';

    const list = visible();
    const i = list.indexOf(card);
    q('.drawer-count').textContent = i >= 0 ? pad2(i + 1) + ' / ' + pad2(list.length) : '';
    const prev = i > 0 ? list[i - 1] : null;
    const next = i >= 0 && i < list.length - 1 ? list[i + 1] : null;
    prevBtn.disabled = !prev; nextBtn.disabled = !next;
    prevBtn.querySelector('span').textContent = prev ? shortTitle(prev) : '';
    nextBtn.querySelector('span').textContent = next ? shortTitle(next) : '';

    scroller.scrollTop = 0;
    if (!reduced) { scroller.classList.remove('swap'); void scroller.offsetWidth; scroller.classList.add('swap'); }
  }

  function setHash(id) {
    const base = location.pathname + location.search;
    try { history.replaceState(null, '', id ? base + '#' + id : base); } catch (e) {}
  }

  function openCard(card, trigger) {
    if (!card) return;
    // If a filter currently hides this project, reset filters so it can be shown
    if (card.classList.contains('hidden')) document.querySelector('#project-filters [data-filter="all"]')?.click();
    const wasOpen = !overlay.hidden;
    current = card;
    if (trigger) opener = trigger;
    fill(card);
    setHash(card.id);
    if (wasOpen) return;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('open'));
    document.body.style.overflow = 'hidden';
    closeBtn.focus({ preventScroll: true });
  }

  function closeDrawer(skipHash) {
    if (overlay.hidden) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => { overlay.hidden = true; }, 320);
    if (!skipHash) setHash(null);
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    current = null;
  }

  function step(dir) {
    const list = visible();
    const i = list.indexOf(current);
    const target = list[i + dir];
    if (target) openCard(target);
  }

  cards.forEach(card => {
    card.querySelector('.pc-open').addEventListener('click', e => openCard(card, e.currentTarget));
  });

  closeBtn.addEventListener('click', () => closeDrawer());
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) closeDrawer(); });

  document.addEventListener('keydown', e => {
    if (overlay.hidden) return;
    const palette = document.querySelector('.cmdk-overlay');
    if (palette && !palette.hidden) return; // palette has priority
    if (e.key === 'Escape') closeDrawer();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'Tab') {
      const f = Array.from(drawer.querySelectorAll('button:not([disabled]), a[href]'));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Touch: swipe left/right to move between projects
  let sx = null;
  drawer.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  drawer.addEventListener('touchend', e => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 70) step(dx < 0 ? 1 : -1);
    sx = null;
  });

  // Deep links (#tesa) + the palette hook
  const byId = id => cards.find(c => c.id === id);
  window.openProject = id => openCard(byId(id));
  const fromHash = () => {
    const c = byId(location.hash.slice(1));
    if (c) openCard(c); else closeDrawer(true);
  };
  window.addEventListener('hashchange', fromHash);
  if (byId(location.hash.slice(1))) setTimeout(fromHash, 350);
})();
