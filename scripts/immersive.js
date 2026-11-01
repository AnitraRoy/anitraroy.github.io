(function () {
  'use strict';

  const FX = {
    wide:    true,
    rails:   true,
    hero:    true,
    marquee: true,
    pinned:  true,
    streaks: true,
    mesh:    true,
  };

  // Text and links used by the features above. Edit freely.
  const CONFIG = {
    links: [
      ['GitHub',   'https://github.com/AnitraRoy'],
      ['LinkedIn', 'https://linkedin.com/in/AnitraRoy'],
    ],
    marquee: [
      'Industrial Engineering', 'Data Science', 'AI / ML', 'Full-Stack',
      'Optimization', 'Reinforcement Learning', 'Data Engineering',
    ],
  };

  // Neon streak look. Tweak freely.
  const STREAKS = {
    color:     [168, 178, 198], // colour when no focus area is selected (silver, like the original wallpaper)
    idle:      0.55,            // brightness with no filter (0 to 1)
    active:    1.0,             // brightness once a focus area is picked
    width:     0.07,            // ribbon thickness (fraction of the shorter screen side)
    parallax:  14,              // pixels the ribbons drift with your mouse
    centerDim: 0.5,             // 0 = fully hidden behind the page content, 1 = no dimming
    glass:     true,            // frosted panel behind the content column so text stays readable

    // Light flowing through the ribbons (the ribbons themselves stay put)
    flow:        true,
    flowSpeed:   170,           // how fast the light travels, in pixels per second
    flowLength:  0.30,          // length of each streak of light (fraction of the longer screen side)
    flowSpacing: 1.1,           // distance between streaks on one ribbon (fraction of the longer screen side)
  };

  const root = document.documentElement;
  Object.keys(FX).forEach(k => FX[k] && root.classList.add('fx-' + k));

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clean = location.pathname.replace(/index\.html$/, '').replace(/\/+$/, '') || '/';
  const page = clean === '/' ? 'home' : clean.split('/')[1];
  root.classList.add('page-' + page);

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (FX.hero && page === 'home')        initHero();
    if (FX.marquee && page === 'home')     initMarquee();
    if (FX.pinned && page === 'background') initPinned();
    if (page === 'projects')               initFilterGlider();
    if (FX.rails)                          initRails();
    if (FX.streaks)                        initStreaks();
    else if (FX.mesh)                      initMesh();
  });

  /* ---------------- Hero ---------------- */
  function initHero() {
    const hero = document.querySelector('.hero-section');
    if (!hero) return;

    const cue = el('a', 'scroll-cue',
      '<span>scroll</span><i aria-hidden="true"></i>');
    cue.href = '#about';
    cue.setAttribute('aria-label', 'Scroll to About');
    hero.appendChild(cue);

    if (reduced) return;
    let ticking = false;
    const update = () => {
      ticking = false;
      const p = clamp(window.scrollY / (window.innerHeight * 0.8), 0, 1);
      hero.style.setProperty('--hero-p', p.toFixed(3));
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------------- Marquee ---------------- */
  function initMarquee() {
    const hero = document.querySelector('.hero-section');
    if (!hero) return;
    const group = () => CONFIG.marquee
      .map(t => '<span class="fx-marquee-item">' + t + '</span><span class="fx-marquee-dot" aria-hidden="true"></span>')
      .join('');
    const strip = el('div', 'marquee-strip',
      '<div class="fx-marquee-track" aria-hidden="true">' +
        '<div class="fx-marquee-group">' + group() + '</div>' +
        '<div class="fx-marquee-group">' + group() + '</div>' +
      '</div>');
    strip.setAttribute('role', 'presentation');
    hero.after(strip);

    // JS-driven scroll so the strip can also be dragged
    const track = strip.querySelector('.fx-marquee-track');
    const firstGroup = track.firstElementChild;
    let x = 0, vel = 0, dragging = false, hovering = false;
    let lastX = 0, lastT = 0, prev = performance.now();

    const tick = now => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      const w = firstGroup.offsetWidth;              // one full loop
      if (!dragging && w) {
        const auto = (hovering || reduced) ? 0 : -w / 48;   // same pace as the old 48s animation
        vel += (auto - vel) * Math.min(1, dt * 3);          // momentum eases back to the auto pace
        x += vel * dt;
      }
      if (w) x = ((x % w) - w) % w;                  // wrap seamlessly
      track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    strip.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hovering = true; });
    strip.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hovering = false; });

    strip.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      vel = 0;
      lastX = e.clientX;
      lastT = e.timeStamp;
      strip.setPointerCapture(e.pointerId);
    });
    strip.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dtm = Math.max(1, e.timeStamp - lastT);
      x += dx;
      vel = vel * 0.8 + (dx / dtm * 1000) * 0.2;     // smoothed release speed in px/s
      lastX = e.clientX;
      lastT = e.timeStamp;
    });
    const release = e => {
      if (!dragging) return;
      dragging = false;
      if (e.timeStamp - lastT > 80) vel = 0;         // held still before letting go: no fling
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => strip.addEventListener(t, release));
  }

    /* ---------------- Projects: sliding filter highlight ---------------- */
  function initFilterGlider() {
    const box = document.getElementById('project-filters');
    if (!box) return;

    const glider = el('span', 'filter-glider');
    glider.setAttribute('aria-hidden', 'true');
    box.prepend(glider);

    const place = instant => {
      const btn = box.querySelector('.filter-btn.active');
      if (!btn) return;
      if (instant) glider.classList.add('instant');
      box.style.setProperty('--gx', btn.offsetLeft + 'px');
      box.style.setProperty('--gw', btn.offsetWidth + 'px');
      box.style.setProperty('--g', btn.style.getPropertyValue('--pill-color').trim() || '168,178,198');
      glider.classList.add('ready');
      if (instant) requestAnimationFrame(() => requestAnimationFrame(() => glider.classList.remove('instant')));
    };

    // follow the active button, however it got activated
    new MutationObserver(muts => {
      if (muts.some(m => m.target !== glider)) place(false);
    }).observe(box, { subtree: true, attributes: true, attributeFilter: ['class'] });

    place(true);
    window.addEventListener('resize', () => place(true));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => place(true));
    if ('ResizeObserver' in window) new ResizeObserver(() => place(true)).observe(box);
  }

  /* ---------------- Pinned entries (Background) ---------------- */
  function initPinned() {
    document.querySelectorAll('.entry-list .entry-row').forEach(row => {
      const logo = row.querySelector(':scope > .entry-logo');
      const body = row.querySelector(':scope > .entry-body');
      if (!logo || !body) return;
      const top = body.querySelector(':scope > .entry-top');
      const meta = body.querySelector(':scope > .entry-meta');
      const role = body.querySelector(':scope > .entry-role'); // education rows use a plain role line
      const aside = el('div', 'entry-aside');
      aside.appendChild(logo);
      if (top) aside.appendChild(top);
      if (meta) aside.appendChild(meta);
      else if (role) aside.appendChild(role);
      row.insertBefore(aside, body);
      row.classList.add('is-pinned');
    });
  }

  /* ---------------- Side rails ---------------- */
  function initRails() {
    const wrap = document.querySelector('.wrap');
    const sections = Array.from(document.querySelectorAll('main > section[id]'));
    if (!wrap || !sections.length) return;

    const labelOf = s => {
      const l = s.querySelector('.section-label');
      return (l ? l.textContent : s.id === 'home' ? 'Home' : s.id).trim();
    };

    // Left: section index
    const left = el('nav', 'rail rail-left');
    left.setAttribute('aria-label', 'Page sections');
    const list = el('ol', 'rail-index');
    const items = sections.map((s, i) => {
      const li = el('li');
      const a = el('a', 'rail-link',
        '<b>' + String(i + 1).padStart(2, '0') + '</b><span>' + labelOf(s) + '</span>');
      a.href = '#' + s.id;
      li.appendChild(a);
      list.appendChild(li);
      return a;
    });
    const track = el('div', 'rail-track', '<i></i>');
    left.append(list, track);

    // Projects page: the focus-area filters live here too
    const pageFilters = document.getElementById('project-filters');
    if (pageFilters) {
      const box = el('div', 'rail-filters', '<p class="rail-eyebrow">Focus</p>');
      const mirrors = [];
      pageFilters.querySelectorAll('.filter-btn').forEach(btn => {
        const rgb = btn.style.getPropertyValue('--pill-color').trim();
        const m = el('button', 'rail-filter', '<span>' + btn.textContent.trim() + '</span><i aria-hidden="true"></i>');
        m.type = 'button';
        if (rgb) m.style.setProperty('--c', rgb);
        m.addEventListener('click', () => btn.click());
        box.appendChild(m);
        mirrors.push([btn, m]);
      });
      const syncFilters = () => mirrors.forEach(([b, m]) => m.classList.toggle('active', b.classList.contains('active')));
      pageFilters.addEventListener('click', () => setTimeout(syncFilters, 0));
      syncFilters();
      left.insertBefore(box, track);
    }

    document.body.append(left);

    let on = false;
    function layout() {
      const r = wrap.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const room = Math.floor(r.left);
      on = room >= 150;
      const w = Math.min(190, room - 36);
      left.style.width = w + 'px';
      left.style.right = (vw - r.left + 14) + 'px';
      sync();
    }

    function sync() {
      const y = window.scrollY;
      const vh = window.innerHeight;
      const heroMode = page === 'home' && root.classList.contains('fx-hero');
      const visible = on && (!heroMode || y > vh * 0.45);
      left.classList.toggle('on', visible);

      // step aside while the full-width marquee strip passes behind a rail
      const strip = document.querySelector('.marquee-strip');
      [left].forEach(rail => {
        let behind = false;
        if (strip && visible) {
          const a = strip.getBoundingClientRect(), b = rail.getBoundingClientRect();
          behind = a.bottom > b.top - 10 && a.top < b.bottom + 10;
        }
        rail.classList.toggle('behind', behind);
      });

      // active section
      let active = 0;
      sections.forEach((s, i) => { if (s.getBoundingClientRect().top <= vh * 0.35) active = i; });
      items.forEach((a, i) => a.classList.toggle('active', i === active));

      const max = document.documentElement.scrollHeight - vh;
      const p = max > 0 ? clamp(y / max, 0, 1) : 0;
      track.firstChild.style.transform = 'scaleY(' + p.toFixed(4) + ')';
    }

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; sync(); }); }
    }, { passive: true });
    window.addEventListener('resize', layout);
    window.addEventListener('load', layout);
    layout();
  }

  /* ---------------- Mesh background ---------------- */
  function initMesh() {
    const canvas = document.getElementById('bg-mesh');
    const orig = window.getMeshTriColor;
    if (!canvas || typeof orig !== 'function') return;

    const state = {
      tint: null,        // [r,g,b] we're easing toward (null = none)
      cur: [120, 120, 120],
      amt: 0,            // current tint strength 0..1
      scroll: 0,         // page scroll progress 0..1
    };
    const DRIFT_DARK  = [139, 92, 246];   // violet at the bottom of the page
    const DRIFT_LIGHT = [200, 70, 110];   // rose

    const parse = s => {
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(s);
      return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
    };
    const mix = (a, b, t) => a + (b - a) * t;

    window.getMeshTriColor = function (mx, my) {
      const base = orig(mx, my);
      const c = parse(base);
      if (!c) return base;
      let [r, g, b, a] = c;

      // 1) slow drift toward a second colour as you move down the page
      const drift = state.scroll * 0.4;
      if (drift > 0.001) {
        const d = root.classList.contains('light') ? DRIFT_LIGHT : DRIFT_DARK;
        r = mix(r, d[0], drift); g = mix(g, d[1], drift); b = mix(b, d[2], drift);
      }
      // 2) focus-area tint (project filters / quick-view panel): replaces the base colour outright
      if (state.amt > 0.001) {
        r = mix(r, state.cur[0], state.amt);
        g = mix(g, state.cur[1], state.amt);
        b = mix(b, state.cur[2], state.amt);
        a = a + 0.22 * state.amt;
      }
      return 'rgba(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ',' + a.toFixed(3) + ')';
    };

    // soft colour wash from two corners, painted after the mesh itself
    const origDraw = window.drawMesh;
    if (typeof origDraw === 'function') {
      window.drawMesh = function () {
        origDraw();
        if (state.amt < 0.01 || typeof meshCtx === 'undefined' || !meshCtx) return;
        const W = window.innerWidth, H = window.innerHeight;
        const light = root.classList.contains('light');
        const alpha = (light ? 0.26 : 0.40) * state.amt;
        const c = state.cur.map(Math.round).join(',');
        const R = Math.max(W, H) * 1.0;
        [[0.12, 0.18], [0.9, 0.9], [0.5, 0.5]].forEach(([fx, fy]) => {
          const g = meshCtx.createRadialGradient(W * fx, H * fy, 0, W * fx, H * fy, R);
          g.addColorStop(0, 'rgba(' + c + ',' + alpha.toFixed(3) + ')');
          g.addColorStop(1, 'rgba(' + c + ',0)');
          meshCtx.fillStyle = g;
          meshCtx.fillRect(0, 0, W, H);
        });
      };
    }

    const redraw = () => {
      if (typeof drawMesh === 'function' && typeof meshRunning !== 'undefined' && !meshRunning) drawMesh();
    };

    // scroll: drift + parallax
    if (!reduced) {
      let ticking = false;
      const onScroll = () => {
        ticking = false;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        state.scroll = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
        const cap = window.innerHeight * 0.025;
        canvas.style.setProperty('--mesh-shift', (-clamp(window.scrollY * 0.03, 0, cap)).toFixed(1) + 'px');
        redraw();
      };
      window.addEventListener('scroll', () => {
        if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
      }, { passive: true });
      onScroll();
    }

    // ease tint in/out
    let raf = 0;
    function ease() {
      const target = state.tint ? 1 : 0;
      if (state.tint) state.cur = state.cur.map((v, i) => mix(v, state.tint[i], 0.18));
      state.amt = mix(state.amt, target, 0.12);
      redraw();
      if (Math.abs(state.amt - target) > 0.01) raf = requestAnimationFrame(ease);
      else { state.amt = target; redraw(); raf = 0; }
    }
    const lift = rgb => rgb.map(v => Math.min(255, v + (255 - v) * 0.22));
    function setTint(rgb) {
      if (rgb) rgb = lift(rgb);
      if (rgb) {
        if (!state.tint) state.cur = rgb.slice();
        state.tint = rgb;
      } else {
        state.tint = null;
      }
      if (reduced) { state.amt = rgb ? 1 : 0; state.cur = rgb || state.cur; redraw(); return; }
      if (!raf) raf = requestAnimationFrame(ease);
    }

    bindTintSources(setTint);
  }

  /* ---------------- Shared: where the tint colour comes from ---------------- */
  const toRGB = str => {
    const p = String(str || '').split(',').map(n => parseFloat(n));
    return p.length === 3 && p.every(n => !isNaN(n)) ? p : null;
  };

  function bindTintSources(setTint) {
    // project filters
    const filters = document.getElementById('project-filters');
    const fromFilter = () => {
      const btn = filters && filters.querySelector('.filter-btn.active');
      const f = btn && btn.dataset.filter;
      return f && f !== 'all' ? toRGB(btn.style.getPropertyValue('--pill-color')) : null;
    };
    if (filters) filters.addEventListener('click', () => setTimeout(() => setTint(fromFilter()), 0));

    // quick-view panel (tints to the open project's accent)
    const overlay = document.querySelector('.drawer-overlay');
    const drawer = overlay && overlay.querySelector('.drawer');
    if (overlay && drawer) {
      const check = () => {
        if (overlay.hidden || !overlay.classList.contains('open')) setTint(fromFilter());
        else setTint(toRGB(drawer.style.getPropertyValue('--accent')));
      };
      new MutationObserver(check).observe(overlay, { attributes: true, attributeFilter: ['class', 'hidden'] });
      new MutationObserver(check).observe(drawer, { attributes: true, attributeFilter: ['style'] });
    }
  }

  /* ---------------- Neon streaks ---------------- */
  function initStreaks() {
    // retire the old triangle mesh completely (hide it and stop its loop)
    const oldCanvas = document.getElementById('bg-mesh');
    if (oldCanvas) oldCanvas.style.display = 'none';
    window.tickMesh = function () {};
    window.drawMesh = function () {};

    // Ribbon layout: [u, v] where u runs along the longer screen side and v along the shorter one.
    // Corners are rounded automatically; points outside 0..1 run off-screen.
    // reverse: the light travels the other way along this bundle.
    // The bends sit in the side margins, where the page content does not cover them: each side has a
    // ribbon bundle running down the margin, ducking in behind the content and back out again.
    const SCENE = [
      { lanes: 2, reverse: false, pts: [[0.07, -0.10], [0.07, 0.45], [0.32, 0.45], [0.32, 0.89], [0.07, 0.89], [0.07, 1.10]] },
      { lanes: 2, reverse: true,  pts: [[0.93, 1.10], [0.93, 0.55], [0.68, 0.55], [0.68, 0.11], [0.93, 0.11], [0.93, -0.10]] },
    ];
    // each lane flows a little differently, so the light never moves in lockstep
    const LANE_FEEL = [
      { spd: 1.00, len: 1.00, per: 1.00, phase: 0.00 },
      { spd: 0.82, len: 0.72, per: 1.18, phase: 0.45 },
      { spd: 1.18, len: 1.25, per: 0.92, phase: 0.70 },
      { spd: 0.94, len: 0.85, per: 1.08, phase: 0.20 },
    ];

    const wrapEl = el('div', 'streaks');
    wrapEl.setAttribute('aria-hidden', 'true');
    const breath = el('div', 'streaks-breath');
    wrapEl.appendChild(breath);
    wrapEl.style.setProperty('--center-dim', STREAKS.centerDim);
    if (page === 'home') {
      const heroDim = 0.8, readDim = STREAKS.centerDim;
      let dimTick = false;
      const fadeDim = () => {
        dimTick = false;
        const t = clamp(window.scrollY / (window.innerHeight * 0.6), 0, 1);
        wrapEl.style.setProperty('--center-dim', (heroDim + (readDim - heroDim) * t).toFixed(3));
      };
      window.addEventListener('scroll', () => {
        if (!dimTick) { dimTick = true; requestAnimationFrame(fadeDim); }
      }, { passive: true });
      fadeDim();
    }
    document.body.insertBefore(wrapEl, document.body.firstChild);

    if (STREAKS.glass) {
      const glass = el('div', 'page-glass');
      glass.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(glass, wrapEl.nextSibling);
    }

    const flowCanvas = el('canvas', 'streak-flow');
    breath.appendChild(flowCanvas);

    let current = { rgb: STREAKS.color.slice(), strength: STREAKS.idle };
    let geo = null;
    let lastDims = null;

    const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    const rgba = (c, a) => 'rgba(' + c.map(Math.round).join(',') + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')';
    const mod = (x, m) => ((x % m) + m) % m;

    function dims() {
      const W = window.innerWidth, H = window.innerHeight;
      const S = Math.min(W, H), L = Math.max(W, H);
      return { W, H, landscape: W >= H, S, L };
    }

    // Trace one lane of a ribbon (centre line shifted sideways by `off` px) with rounded corners.
    // `target` is a canvas context or a Path2D.
    function trace(target, pts, off, R) {
      const n = pts.length, U = [], N = [];
      for (let i = 0; i < n - 1; i++) {
        const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1];
        const len = Math.hypot(dx, dy) || 1;
        U.push([dx / len, dy / len]);
        N.push([-dy / len, dx / len]);
      }
      const P = pts.map((p, i) => {
        let ox = 0, oy = 0;
        if (i > 0)     { ox += N[i - 1][0]; oy += N[i - 1][1]; }
        if (i < n - 1) { ox += N[i][0];     oy += N[i][1]; }
        return [p[0] + ox * off, p[1] + oy * off];
      });
      if (target.beginPath) target.beginPath();
      target.moveTo(P[0][0], P[0][1]);
      for (let i = 1; i < n - 1; i++) {
        const cross = U[i - 1][0] * U[i][1] - U[i - 1][1] * U[i][0];
        const r = Math.max(6, R - Math.sign(cross) * off);
        target.arcTo(P[i][0], P[i][1], P[i + 1][0], P[i + 1][1], r);
      }
      target.lineTo(P[n - 1][0], P[n - 1][1]);
    }

    // Geometry for the current window size, shared by the static ribbons and the flowing light.
    function buildGeo() {
      const d = dims();
      const w = STREAKS.width * d.S;
      const R = 0.17 * d.S;
      const gap = w * 1.65;
      const lanes = [];
      SCENE.forEach(b => {
        const pts = b.pts.map(([u, v]) => d.landscape ? [u * d.W, v * d.H] : [v * d.W, u * d.H]);
        for (let k = 0; k < b.lanes; k++) {
          const off = (k - (b.lanes - 1) / 2) * gap;
          const path = new Path2D();
          trace(path, pts, off, R);
          lanes.push({ pts, off, path, dir: b.reverse ? -1 : 1, feel: LANE_FEEL[lanes.length % LANE_FEEL.length] });
        }
      });
      return { d, w, R, lanes };
    }

    /* ---- static ribbons ---- */
    function renderBase(canvas, rgb, strength) {
      const { d, w, R, lanes } = geo;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(d.W * dpr);
      canvas.height = Math.round(d.H * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, d.W, d.H);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const light = root.classList.contains('light');
      const I = strength;
      const white = [255, 255, 255];
      const core = mixc(rgb, white, light ? 0.45 : 0.25);
      const bright = mixc(rgb, white, 0.82);

      const pass = (width, color, blur, glow, dx, dy) => {
        ctx.save();
        ctx.translate(dx || 0, dy || 0);
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.shadowBlur = (blur || 0) * dpr;
        ctx.shadowColor = glow || 'transparent';
        lanes.forEach(l => { trace(ctx, l.pts, l.off, R); ctx.stroke(); });
        ctx.restore();
      };
      if (light) {
        pass(w * 1.5,  rgba(rgb, 0.10 * I), w * 1.4, rgba(rgb, 0.40 * I));
        pass(w,        rgba(mixc(rgb, [0, 0, 0], 0.25), 0.50 * I), 0);
        pass(w * 0.74, rgba(rgb, 0.65 * I), w * 0.25, rgba(rgb, 0.5 * I));
        pass(w * 0.34, rgba(core, 0.85 * I), w * 0.3, rgba(rgb, 0.7 * I), -w * 0.10, -w * 0.12);
        pass(w * 0.10, rgba(white, 0.85 * I), w * 0.12, rgba(white, 0.6 * I), -w * 0.16, -w * 0.18);
      } else {
        pass(w * 1.6,  rgba(rgb, 0.10 * I), w * 1.6, rgba(rgb, 0.60 * I));
        pass(w,        rgba(mixc(rgb, [0, 0, 0], 0.84), 0.92 * I + 0.05), 0);
        pass(w * 0.74, rgba(mixc(rgb, [0, 0, 0], 0.55), 0.85 * I), w * 0.25, rgba(rgb, 0.45 * I));
        pass(w * 0.34, rgba(core, 0.95 * I), w * 0.3, rgba(rgb, 0.85 * I), -w * 0.10, -w * 0.12);
        pass(w * 0.10, rgba(bright, 0.80 * I), w * 0.12, rgba(bright, 0.7 * I), -w * 0.16, -w * 0.18);
      }
    }

    // One canvas per colour, kept (hidden) so switching back is instant.
    const bases = new Map();
    let activeBase = null;
    const keyOf = (rgb, strength) =>
      rgb.map(Math.round).join(',') + '|' + strength + '|' + (root.classList.contains('light') ? 'L' : 'D');
    function baseFor(rgb, strength) {
      const k = keyOf(rgb, strength);
      let c = bases.get(k);
      if (!c) {
        c = el('canvas', 'streak-base');
        renderBase(c, rgb, strength);
        breath.insertBefore(c, flowCanvas);
        bases.set(k, c);
      }
      return c;
    }
    function clearBases() { bases.forEach(c => c.remove()); bases.clear(); activeBase = null; }

    function show(rgb, strength, instant) {
      current = { rgb: rgb.slice(), strength };
      const c = baseFor(rgb, strength);
      if (instant || reduced) bases.forEach(b => b.classList.add('instant'));
      bases.forEach(b => b.classList.toggle('on', b === c));
      activeBase = c;
      if (instant || reduced) requestAnimationFrame(() => bases.forEach(b => b.classList.remove('instant')));
      wrapEl.classList.add('ready');
    }

    /* ---- light flowing through the ribbons ---- */
    let fctx = null;
    let flowClock = 0;
    let lastFrame = 0;
    let frozen = false;
    let flowRGB = STREAKS.color.slice();
    let flowI = STREAKS.idle;

    function sizeFlow() {
      const d = geo.d;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      flowCanvas.width = Math.round(d.W * dpr);
      flowCanvas.height = Math.round(d.H * dpr);
      fctx = flowCanvas.getContext('2d');
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Each streak of light is a tapered comet: a few overlapping dashes that share a leading edge.
    const COMET = [
      { f: 1.00, w: 0.95, a: 0.10 },
      { f: 0.66, w: 0.55, a: 0.20 },
      { f: 0.38, w: 0.30, a: 0.50 },
      { f: 0.16, w: 0.13, a: 0.95 },
    ];

    function drawFlow() {
      if (!fctx || !geo) return;
      const { d, w, lanes } = geo;
      fctx.clearRect(0, 0, d.W, d.H);
      const light = root.classList.contains('light');
      const I = Math.min(1, flowI * 1.15);
      const rgb = flowRGB;
      const hot = mixc(rgb, [255, 255, 255], light ? 0.55 : 0.78);

      fctx.save();
      fctx.lineCap = 'round';
      fctx.lineJoin = 'round';
      fctx.globalCompositeOperation = light ? 'source-over' : 'lighter';

      lanes.forEach(ln => {
        const f = ln.feel;
        const length = STREAKS.flowLength * d.L * f.len;
        const period = STREAKS.flowSpacing * d.L * f.per;
        const head = mod(f.phase * period + ln.dir * STREAKS.flowSpeed * f.spd * flowClock, period);
        COMET.forEach((c, i) => {
          const len = length * c.f;
          fctx.setLineDash([len, Math.max(1, period - len)]);
          fctx.lineDashOffset = ln.dir > 0 ? len - head : -head;
          fctx.lineWidth = w * c.w;
          fctx.strokeStyle = rgba(i >= 2 ? hot : rgb, c.a * I);
          fctx.save();
          fctx.translate(-w * 0.10, -w * 0.12);       // ride the lit ridge of the tube
          fctx.stroke(ln.path);
          fctx.restore();
        });
      });
      fctx.restore();
    }

    function tickFlow(now) {
      requestAnimationFrame(tickFlow);
      if (frozen || document.hidden) { lastFrame = now; return; }
      if (now - lastFrame < 32) return;                    // about 30 frames a second is plenty
      const dt = Math.min((now - lastFrame) / 1000, 0.1);
      lastFrame = now;
      flowClock += dt;
      // ease the light toward the colour we are showing
      flowRGB = mixc(flowRGB, current.rgb, 0.07);
      flowI += (current.strength - flowI) * 0.07;
      drawFlow();
    }

    // test hook: lets the flow be paused at a chosen moment
    wrapEl.__freeze = t => { frozen = true; flowClock = t; flowRGB = current.rgb.slice(); flowI = current.strength; drawFlow(); };

    /* ---- wiring ---- */
    const lift = rgb => rgb.map(v => Math.min(255, v + (255 - v) * 0.12));
    function setTint(rgb) {
      if (rgb) show(lift(rgb), STREAKS.active);
      else show(STREAKS.color, STREAKS.idle);
    }

    // build a focus-area colour ahead of time (hover, idle) without showing it
    const warmFrom = e => {
      const t = e.target.closest && e.target.closest('.filter-btn, .rail-filter');
      if (!t) return;
      const rgb = toRGB(t.style.getPropertyValue('--pill-color') || t.style.getPropertyValue('--c'));
      if (rgb) baseFor(lift(rgb), STREAKS.active);
    };
    ['pointerover', 'focusin', 'touchstart'].forEach(ev => document.addEventListener(ev, warmFrom, { passive: true }));

    function warmPageColours() {
      document.querySelectorAll('#project-filters .filter-btn').forEach((b, i) => {
        const rgb = toRGB(b.style.getPropertyValue('--pill-color'));
        if (rgb) setTimeout(() => baseFor(lift(rgb), STREAKS.active), 2500 + i * 400);
      });
    }

    function setup() {
      geo = buildGeo();
      lastDims = { W: geo.d.W, H: geo.d.H };
      clearBases();
      sizeFlow();
      show(current.rgb, current.strength, true);
      drawFlow();
    }
    setup();
    warmPageColours();
    if (STREAKS.flow && !reduced) requestAnimationFrame(tickFlow);

    // rebuild when the window really changes size, or the theme flips
    let rt = 0;
    const redo = force => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        const d = dims();
        if (!force && lastDims && Math.abs(d.W - lastDims.W) < 40 && Math.abs(d.H - lastDims.H) < 120) return; // mobile URL-bar jitter
        setup();
        warmPageColours();
      }, 200);
    };
    window.addEventListener('resize', () => redo(false));
    new MutationObserver(() => redo(true)).observe(root, { attributes: true, attributeFilter: ['class'] });

    // gentle depth: the ribbons drift opposite to the mouse and the scroll
    if (!reduced && STREAKS.parallax) {
      let mx = 0, my = 0, sy = 0, ticking = false;
      const apply = () => {
        ticking = false;
        breath.style.setProperty('--sx', (-mx * STREAKS.parallax).toFixed(1) + 'px');
        breath.style.setProperty('--sy', (-my * STREAKS.parallax - sy).toFixed(1) + 'px');
      };
      const queue = () => { if (!ticking) { ticking = true; requestAnimationFrame(apply); } };
      window.addEventListener('pointermove', e => {
        mx = e.clientX / window.innerWidth - 0.5;
        my = e.clientY / window.innerHeight - 0.5;
        queue();
      }, { passive: true });
      window.addEventListener('scroll', () => { sy = Math.min(window.scrollY * 0.05, 60); queue(); }, { passive: true });
    }

    bindTintSources(setTint);
  }
})();
