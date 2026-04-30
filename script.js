const canvas = document.getElementById('rain');
const ctx = canvas.getContext('2d');

const MATRIX_BASE = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const MATRIX_HALF_KATAKANA = (() => {
  let s = '';
  for (let cp = 0xff66; cp <= 0xff9f; cp += 1) s += String.fromCodePoint(cp);
  return s;
})();

const toSuperscript = (str) => str.normalize('NFKD').split('').map((c) => {
  if (c >= '0' && c <= '9') return String.fromCodePoint(0x2070 + (c === '1' ? 0 : Number(c)));
  const map = { a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ', k: 'ᵏ', l: 'ˡ', m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', r: 'ʳ', s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ' };
  return map[c.toLowerCase()] || c;
}).join('');

const toSubscript = (str) => str.split('').map((c) => {
  const m = {0:'₀',1:'₁',2:'₂',3:'₃',4:'₄',5:'₅',6:'₆',7:'₇',8:'₈',9:'₉',a:'ₐ',e:'ₑ',h:'ₕ',i:'ᵢ',j:'ⱼ',k:'ₖ',l:'ₗ',m:'ₘ',n:'ₙ',o:'ₒ',p:'ₚ',r:'ᵣ',s:'ₛ',t:'ₜ',u:'ᵤ',v:'ᵥ',x:'ₓ'};
  return m[c.toLowerCase()] || c;
}).join('');

const defaultChars = MATRIX_BASE + MATRIX_HALF_KATAKANA + toSuperscript(MATRIX_BASE) + toSubscript(MATRIX_BASE);

const state = {
  color: '#4dff4d',
  speed: 24,
  tail: 18,
  chars: defaultChars,
  drops: [],
  glyphSize: 17,
};

function resize() {
  const dpr = devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.drops = Array.from({ length: Math.ceil(innerWidth / 12) * 2 }, () => newDrop());
}

function newDrop() {
  return {
    x: Math.random() * innerWidth,
    y: Math.random() * -innerHeight,
    size: 12 + Math.random() * 12,
    speed: (state.speed * 0.4) + Math.random() * state.speed,
    length: Math.max(3, Math.round((state.tail * 0.6) + Math.random() * state.tail)),
  };
}

function randomChar() {
  const i = Math.floor(Math.random() * state.chars.length);
  return state.chars[i] || '0';
}

let last = performance.now();
function draw(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  ctx.fillStyle = 'rgba(2,4,2,0.2)';
  ctx.fillRect(0, 0, innerWidth, innerHeight);

  state.drops.forEach((d) => {
    d.y += d.speed * dt * 18;
    for (let i = 0; i < d.length; i += 1) {
      const y = d.y - i * d.size;
      if (y < -d.size || y > innerHeight + d.size) continue;
      const alpha = 1 - i / d.length;
      ctx.fillStyle = i === 0 ? `rgba(220,255,220,${alpha})` : hexToRgba(state.color, alpha);
      ctx.font = `${d.size}px monospace`;
      ctx.fillText(randomChar(), d.x + (Math.random() - 0.5) * 3, y);
    }
    if (d.y - d.length * d.size > innerHeight + 20) Object.assign(d, newDrop(), { y: -20 });
  });

  requestAnimationFrame(draw);
}

function hexToRgba(hex, a) {
  const x = hex.replace('#', '');
  const n = Number.parseInt(x.length === 3 ? x.split('').map((c) => c + c).join('') : x, 16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}

const rabbitBtn = document.getElementById('rabbitBtn');
const modal = document.getElementById('settingsModal');
const colorInput = document.getElementById('colorInput');
const speedInput = document.getElementById('speedInput');
const tailInput = document.getElementById('tailInput');
const charsInput = document.getElementById('charsInput');
const speedValue = document.getElementById('speedValue');
const tailValue = document.getElementById('tailValue');

function syncInputs() {
  colorInput.value = state.color;
  speedInput.value = state.speed;
  tailInput.value = state.tail;
  charsInput.value = state.chars;
  speedValue.textContent = state.speed;
  tailValue.textContent = state.tail;
}

rabbitBtn.addEventListener('click', () => {
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
});
document.getElementById('closeBtn').addEventListener('click', () => {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
});
document.getElementById('resetBtn').addEventListener('click', () => {
  state.chars = defaultChars;
  syncInputs();
});
modal.addEventListener('click', (e) => {
  if (e.target === modal) document.getElementById('closeBtn').click();
});

colorInput.addEventListener('input', () => { state.color = colorInput.value; });
speedInput.addEventListener('input', () => { state.speed = Number(speedInput.value); speedValue.textContent = state.speed; });
tailInput.addEventListener('input', () => { state.tail = Number(tailInput.value); tailValue.textContent = state.tail; });
charsInput.addEventListener('input', () => { state.chars = charsInput.value || defaultChars; });

window.addEventListener('mousemove', (e) => {
  const r = rabbitBtn.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const d = Math.hypot(e.clientX - cx, e.clientY - cy);
  rabbitBtn.style.opacity = String(Math.min(1, Math.max(0.18, 1 - d / 700)));
});

window.addEventListener('resize', resize);
resize();
syncInputs();
requestAnimationFrame(draw);
