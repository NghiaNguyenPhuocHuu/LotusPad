// Pure helpers: turn the raw numbers the page collects into a plain-language verdict.
export function newStats() {
  return { events: { pen: 0, mouse: 0, touch: 0 }, penPressures: new Set(), penMax: 0, penMin: 1, tilt: false, forceMax: 0, forceEvents: 0 };
}

export function recordPointer(stats, e) {
  const kind = e.pointerType === 'pen' || e.pointerType === 'touch' ? e.pointerType : 'mouse';
  stats.events[kind] += 1;
  if (kind === 'pen' && e.pressure > 0) {
    stats.penPressures.add(e.pressure.toFixed(2));
    stats.penMax = Math.max(stats.penMax, e.pressure);
    stats.penMin = Math.min(stats.penMin, e.pressure);
    if (e.tiltX || e.tiltY) stats.tilt = true;
  }
}

export function recordForce(stats, force) {
  if (typeof force !== 'number' || Number.isNaN(force)) return;
  stats.forceEvents += 1;
  stats.forceMax = Math.max(stats.forceMax, force);
}

export function summarize(stats) {
  const distinct = stats.penPressures.size;
  let pen;
  if (stats.events.pen === 0) pen = 'no-pen';
  else if (distinct >= 5) pen = 'works';
  else pen = 'flat';
  const trackpadForce = stats.forceMax > 1.05;
  const text = {
    works: `PEN PRESSURE WORKS: ${distinct} different pressure values (${stats.penMin.toFixed(2)} to ${stats.penMax.toFixed(2)})${stats.tilt ? ', tilt reported' : ', no tilt'}.`,
    flat: `PEN SEEN BUT PRESSURE LOOKS FLAT: only ${distinct} distinct value(s). The pressure probably does not reach the web view.`,
    'no-pen': 'NO PEN DETECTED YET: draw with a tablet pen, an Apple Pencil over Sidecar, or try again.'
  }[pen];
  return { pen, trackpadForce, text: text + (trackpadForce ? ` Trackpad force reached ${stats.forceMax.toFixed(2)}.` : '') };
}

export function report(stats, env) {
  const s = summarize(stats);
  return [
    'LotusPad pen spike report',
    `Result: ${s.pen}${s.trackpadForce ? ' (+ trackpad force)' : ''}`,
    s.text,
    `Events: pen ${stats.events.pen}, mouse ${stats.events.mouse}, touch ${stats.events.touch}`,
    `Distinct pen pressures: ${stats.penPressures.size}; tilt: ${stats.tilt}`,
    `Force events: ${stats.forceEvents}, max ${stats.forceMax.toFixed(2)}`,
    `Device pixel ratio: ${env.dpr}`,
    `User agent: ${env.ua}`
  ].join('\n');
}
