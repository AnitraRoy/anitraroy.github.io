// theme toggle with icons
const toggleBtn = document.getElementById("theme-toggle");
const toggleIcon = document.getElementById("theme-icon-btn");
const themeIcons = document.querySelectorAll(".theme-icon");

// initialize theme from localStorage
if(localStorage.getItem("theme") === "light") {
  document.body.classList.add("light");
  toggleIcon.src = "images/icons/moon.svg"; 
} else {
  toggleIcon.src = "images/icons/sun.svg"; 
}

// update footer icons based on theme
function updateIcons() {
  const isLight = document.body.classList.contains("light");
  themeIcons.forEach(icon => {
    icon.src = isLight ? icon.dataset.light : icon.dataset.dark;
  });
}
updateIcons();

// toggle theme with icon swap
toggleBtn.addEventListener("click", () => {
  document.body.classList.toggle("light");
  const isLight = document.body.classList.contains("light");
  localStorage.setItem("theme", isLight ? "light" : "dark");
  toggleIcon.src = isLight ? "images/icons/moon.svg" : "images/icons/sun.svg";
  updateIcons();
});

// hero typing effect
const typedElement = document.getElementById("typed");
const words = ["Industrial Engineer","Process Optimizer","Operations Analyst","Systems Thinker","Data-Driven Problem Solver"];
let i = 0, j = 0, forward = true;

function typeWriter() {
  if (forward) {
    typedElement.textContent = words[i].slice(0, j + 1);
    j++;
    if (j > words[i].length) forward = false;
  } else {
    typedElement.textContent = words[i].slice(0, j - 1);
    j--;
    if (j === 0) {
      forward = true;
      i = (i + 1) % words.length;
    }
  }
  setTimeout(typeWriter, 150);
}
typeWriter();

// image carousel
window.addEventListener("DOMContentLoaded", () => {
  const carouselImages = document.querySelectorAll('.carousel-image');
  let currentIndex = 0;

  function showImage(index) {
    carouselImages.forEach((img, i) => {
      img.classList.toggle('active', i === index);
    });
    currentIndex = index;
  }

  function showNextImage() {
    const nextIndex = (currentIndex + 1) % carouselImages.length;
    showImage(nextIndex);
  }

  setInterval(showNextImage, 3500);

  carouselImages.forEach(img => {
    img.addEventListener('click', showNextImage);
  });
});

// smooth scroll and active nav highlighting
const sections = document.querySelectorAll("section");
const navLinks = document.querySelectorAll(".nav-links a");

window.addEventListener("scroll", () => {
  let current = "";
  sections.forEach(section => {
    const sectionTop = section.offsetTop - 80;
    if (pageYOffset >= sectionTop) current = section.getAttribute("id");
  });
  navLinks.forEach(link => link.classList.remove("active"));
  navLinks.forEach(link => {
    if (link.getAttribute("href") === "#" + current) link.classList.add("active");
  });
});

// hide navbar on scroll down, show on scroll up
let lastScrollY = window.scrollY;
const navbar = document.querySelector(".navbar");
const scrollThreshold = 10; // minimum pixels to trigger hide/show
let ignoreScroll = false;

// disable hide/show briefly after clicking nav link
document.querySelectorAll(".nav-links a").forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const sectionID = link.getAttribute("href");
    const target = document.querySelector(sectionID);
    const offset = 90; // navbar height
    const targetY = target.offsetTop - offset;
    coolScrollTo(targetY);
  });
});

window.addEventListener("scroll", () => {
  if (ignoreScroll) return;
  const currentY = window.scrollY;
  if (Math.abs(currentY - lastScrollY) < scrollThreshold) return;

  if (currentY > lastScrollY) {
    navbar.classList.add("hide"); // scrolling down
  } else {
    navbar.classList.remove("hide"); // scrolling up
  }

  lastScrollY = currentY;
});

// smooth scroll with easing and soft overshoot
function coolScrollTo(targetY, duration = 900) {
  const startY = window.pageYOffset;
  const diff = targetY - startY;
  let start;

  function easeOvershoot(t) {
    const c1 = 1.05; // overshoot strength
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function step(timestamp) {
    if (!start) start = timestamp;
    let time = timestamp - start;
    let progress = Math.min(time / duration, 1);
    window.scrollTo(0, startY + diff * easeOvershoot(progress));
    if (time < duration) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

// particle background
const canvas = document.getElementById("particle-canvas");
const ctx = canvas.getContext("2d");
let particles = [];
const maxParticles = 85;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

class Particle {
  constructor() { this.reset(); }
  reset() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = 1 + Math.random() * 2;
    this.speedX = (Math.random() - 0.5) * 0.5;
    this.speedY = (Math.random() - 0.5) * 0.5;
    this.opacity = 0.1 + Math.random() * 0.5;
  }
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    if (this.x > canvas.width) this.x = 0;
    if (this.x < 0) this.x = canvas.width;
    if (this.y > canvas.height) this.y = 0;
    if (this.y < 0) this.y = canvas.height;
  }
  draw() {
    ctx.beginPath();
    ctx.fillStyle = document.body.classList.contains("light") ?
      `rgba(7,16,31,${this.opacity})` :
      `rgba(245,238,218,${this.opacity})`;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 5;
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function initParticles() {
  particles = [];
  for (let i = 0; i < maxParticles; i++) particles.push(new Particle());
}
initParticles();

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => { p.update(); p.draw(); });
  requestAnimationFrame(animateParticles);
}
animateParticles();

// scroll reveal for fade-in elements
const faders = document.querySelectorAll(".fade-in");
const appearOptions = { threshold: 0.1, rootMargin: "0px 0px -80px 0px" };
const appearOnScroll = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("visible");
    observer.unobserve(entry.target);
  });
}, appearOptions);
faders.forEach(fader => appearOnScroll.observe(fader));

// contact form demo
const form = document.getElementById("contact-form");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  alert("Message sent! (Demo)");
});
