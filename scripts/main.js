// -- Theme toggle --
const themeBtn = document.getElementById('theme-toggle');

function isLight() {
  return document.documentElement.classList.contains('light');
}

function setTheme(light) {
  document.documentElement.classList.toggle('light', light);
  localStorage.setItem('theme', light ? 'light' : 'dark');
  updateLogoIcons();
  // Trigger dot color re-read
  readDotColor();
  if (!rafRunning) drawDots();
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
    if (href === '#' + currentSection) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

window.addEventListener('scroll', updateActiveNav, { passive: true });
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

// -- Dot-grid canvas with cursor attraction --
const SPACING  = 28;
const DOT_R    = 1;
const RADIUS   = 130;
const STRENGTH = 0.52;
const SPRING_K = 0.12;
const DAMPING  = 0.75;
const IDLE_EPS = 0.01;

let canvas = document.getElementById('bg-dots');
let ctx = canvas ? canvas.getContext('2d') : null;
let dots = [];
let mouse = { x: -9999, y: -9999 };
let rafId = 0;
let rafRunning = false;
let dotColor = '';
let resizeRaf = 0;

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// -- Color probe: reads CSS - dot variable as rgba for canvas --
let probe = null;

function ensureProbe() {
  if (!probe || !probe.isConnected) {
    probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none;background:var(--dot)';
    document.body.appendChild(probe);
  }
  return probe;
}

function readDotColor() {
  const p = ensureProbe();
  const resolved = getComputedStyle(p).backgroundColor;
  dotColor = (resolved && resolved !== 'rgba(0, 0, 0, 0)') ? resolved : (isLight() ? 'rgb(180,175,165)' : 'rgb(50,50,60)');
}

function buildGrid() {
  if (!canvas) return;
  dots = [];
  const ox = SPACING / 2, oy = SPACING / 2;
  const cols = Math.ceil(window.innerWidth  / SPACING) + 2;
  const rows = Math.ceil(window.innerHeight / SPACING) + 2;
  for (let r = -1; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      const hx = ox + c * SPACING;
      const hy = oy + r * SPACING;
      dots.push({ hx, hy, x: hx, y: hy, vx: 0, vy: 0 });
    }
  }
}

function drawDots() {
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = dotColor;
  ctx.beginPath();
  for (const d of dots) {
    ctx.moveTo(d.x + DOT_R, d.y);
    ctx.arc(d.x, d.y, DOT_R, 0, Math.PI * 2);
  }
  ctx.fill();
}

function tickDots() {
  let anyActive = mouse.x > -1000;

  for (const d of dots) {
    const dx = mouse.x - d.hx;
    const dy = mouse.y - d.hy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let tx = d.hx, ty = d.hy;
    if (dist > 0 && dist < RADIUS) {
      const falloff = 1 - dist / RADIUS;
      tx = d.hx + dx * STRENGTH * falloff;
      ty = d.hy + dy * STRENGTH * falloff;
    }

    d.vx = (d.vx + (tx - d.x) * SPRING_K) * DAMPING;
    d.vy = (d.vy + (ty - d.y) * SPRING_K) * DAMPING;
    d.x += d.vx;
    d.y += d.vy;

    if (!anyActive && (
      Math.abs(d.vx) > IDLE_EPS || Math.abs(d.vy) > IDLE_EPS ||
      Math.abs(d.x - d.hx) > IDLE_EPS || Math.abs(d.y - d.hy) > IDLE_EPS
    )) anyActive = true;
  }

  drawDots();

  if (anyActive) {
    rafId = requestAnimationFrame(tickDots);
  } else {
    rafRunning = false;
  }
}

function startDotTick() {
  if (!rafRunning) {
    rafRunning = true;
    rafId = requestAnimationFrame(tickDots);
  }
}

function resizeCanvas() {
  if (!canvas || !ctx) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = window.innerWidth  * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildGrid();
  if (!rafRunning) drawDots();
}

// Init canvas
requestAnimationFrame(() => {
  if (canvas && ctx) {
    readDotColor();
    resizeCanvas();
  }
});

window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(resizeCanvas);
}, { passive: true });

// Mouse tracking
if (!prefersReduced) {
  document.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    startDotTick();
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });

  // Touch support
  document.addEventListener('touchmove', e => {
    const t = e.touches[0];
    mouse.x = t.clientX;
    mouse.y = t.clientY;
    startDotTick();
  }, { passive: true });

  document.addEventListener('touchend', () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });
}

// Watch for theme class changes and re-read dot color
new MutationObserver(() => {
  if (!canvas || !ctx) return;
  readDotColor();
  if (!rafRunning) drawDots();
}).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

// Mobile menu toggle
const navToggle = document.querySelector('.nav-toggle');
const navLinksContainer = document.querySelector('.nav-links');

if (navToggle && navLinksContainer) {
  navToggle.addEventListener('click', () => {
    navLinksContainer.classList.toggle('open');
  });

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navLinksContainer.classList.remove('open');
    });
  });
}