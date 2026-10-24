import { newStats, recordPointer, recordForce, summarize, report } from './analyze.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c'), ctx = canvas.getContext('2d');
const stats = newStats();
let last = null;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = 'round';
}
addEventListener('resize', resize); resize();

function refresh(e) {
  $('kind').textContent = e.pointerType;
  $('pressure').textContent = e.pressure.toFixed(3);
  $('tilt').textContent = `${e.tiltX} / ${e.tiltY}`;
  $('counts').textContent = `${stats.events.pen} / ${stats.events.mouse} / ${stats.events.touch}`;
  $('verdict').textContent = summarize(stats).text;
}

canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); last = e; recordPointer(stats, e); refresh(e); });
canvas.addEventListener('pointermove', (e) => {
  if (e.buttons === 0 && e.pointerType !== 'pen') return;
  const batch = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const p of batch.length ? batch : [e]) {
    recordPointer(stats, p);
    if (last && p.pressure > 0) {
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink');
      ctx.lineWidth = 1 + p.pressure * 12;
      ctx.beginPath(); ctx.moveTo(last.clientX, last.clientY); ctx.lineTo(p.clientX, p.clientY); ctx.stroke();
    }
    last = p;
  }
  refresh(e);
});
const end = (e) => { last = null; refresh(e); };
canvas.addEventListener('pointerup', end);
canvas.addEventListener('pointercancel', end);

// Safari / WKWebView only: Force Touch trackpads and some tablets report force on mouse events.
const force = (e) => { if (e.buttons) { recordForce(stats, e.webkitForce); $('force').textContent = Number(e.webkitForce ?? 0).toFixed(2); } };
canvas.addEventListener('mousedown', force);
canvas.addEventListener('mousemove', force);
canvas.addEventListener('webkitmouseforcechanged', force);

$('clear').onclick = () => ctx.clearRect(0, 0, innerWidth, innerHeight);
const text = () => report(stats, { dpr: devicePixelRatio, ua: navigator.userAgent });
$('show').onclick = () => { const o = $('out'); o.style.display = 'block'; o.value = text(); o.select(); };
$('copy').onclick = async () => {
  $('show').click();
  try { await navigator.clipboard.writeText(text()); $('copy').textContent = 'Copied'; } catch { $('copy').textContent = 'Select the text and press Cmd+C'; }
};
