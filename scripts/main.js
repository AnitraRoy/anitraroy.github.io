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
  const projects = document.querySelectorAll('#projects .entry-row');

  function updatePillHighlights(activeFilters) {
    projects.forEach(row => {
      const pills = row.querySelectorAll('.skill-pill');

      pills.forEach(pill => {
        const tag = pill.textContent.trim();
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

    if (filter === 'all') {
      // reset everything
      filters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      allBtn.classList.add('active');
    } else {
      // toggle clicked filter
      btn.classList.toggle('active');

      // remove "all" if any specific filter is active
      allBtn.classList.remove('active');
    }

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
    const projects = document.querySelectorAll('#projects .entry-row');

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