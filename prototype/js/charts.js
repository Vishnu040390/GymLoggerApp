/* GymLogger prototype — lightweight SVG charts (no library).
   Follows the chart rules in docs/ui-ux/04-design-system.md:
   one series per chart (no legend box; the title names it), 2px line with a
   10% area wash, ≥8px markers with a surface ring, hairline solid grid,
   selective direct label on the endpoint, crosshair/tooltip on hover AND
   keyboard focus, and a table twin rendered by the caller.
   X positions are by session index, not calendar time, so two sessions on
   the same date never collapse into one point. */
(function (G) {
  'use strict';
  const U = G.U;
  const esc = U.esc;
  const NS = 'http://www.w3.org/2000/svg';

  function niceMax(v, ticks) {
    if (v <= 0) return { max: ticks, step: 1 };
    const raw = v / ticks;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
    return { max: step * ticks, step };
  }

  function tooltip(host) {
    let tip = host.querySelector('.chart-tip');
    if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tip'; tip.hidden = true; host.appendChild(tip); }
    return {
      show(x, y, value, key, sub) {
        tip.innerHTML = '<div class="v"></div><div class="k"><i></i><span></span></div>' + (sub ? '<div class="muted xsmall"></div>' : '');
        tip.querySelector('.v').textContent = value;
        tip.querySelector('.k span').textContent = key;
        if (sub) tip.querySelector('.xsmall').textContent = sub;
        const w = host.clientWidth;
        tip.style.left = Math.min(Math.max(x, 80), w - 80) + 'px';
        tip.style.top = y + 'px';
        tip.hidden = false;
      },
      hide() { tip.hidden = true; },
    };
  }

  function observe(el, draw) {
    draw();
    if (!('ResizeObserver' in window)) return () => {};
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => { if (Math.abs(el.clientWidth - w) > 4) { w = el.clientWidth; draw(); } });
    ro.observe(el);
    return () => ro.disconnect();
  }

  /**
   * Line chart. points: [{ value, short, label, sub }]
   * opts: { name: 'Total reps', height }
   */
  function line(el, points, opts) {
    const o = opts || {};
    el.classList.add('chart');
    return observe(el, () => {
      const W = Math.max(280, el.clientWidth || 600);
      const H = o.height || 220;
      const m = { l: 36, r: 44, t: 16, b: 30 };
      const iw = W - m.l - m.r;
      const ih = H - m.t - m.b;
      const values = points.map((p) => p.value);
      const { max, step } = niceMax(Math.max(...values, 1), 4);
      const x = (i) => m.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
      const y = (v) => m.t + ih - (v / max) * ih;

      let g = '';
      for (let v = 0; v <= max + 1e-9; v += step) {
        g += '<line class="grid-line" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
        g += '<text class="axis-text" x="' + (m.l - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + U.fmtNum(Math.round(v)) + '</text>';
      }
      const maxLabels = Math.max(2, Math.floor(iw / 70));
      const every = Math.max(1, Math.ceil(points.length / maxLabels));
      points.forEach((p, i) => {
        if (i % every === 0 || i === points.length - 1) {
          if (i !== points.length - 1 && points.length - 1 - i < every) return; // avoid colliding with the last label
          g += '<text class="axis-text" x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(p.short) + '</text>';
        }
      });
      const d = points.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.value).toFixed(1)).join(' ');
      const area = points.length > 1 ? d + ' L' + x(points.length - 1).toFixed(1) + ' ' + y(0) + ' L' + x(0).toFixed(1) + ' ' + y(0) + ' Z' : '';
      const dots = points.length <= 24
        ? points.map((p, i) => '<circle class="series-dot" cx="' + x(i) + '" cy="' + y(p.value) + '" r="4"/>').join('')
        : '<circle class="series-dot" cx="' + x(points.length - 1) + '" cy="' + y(values[values.length - 1]) + '" r="4"/>';
      const last = points[points.length - 1];
      const endLabel = '<text class="end-label" x="' + (x(points.length - 1) + 10) + '" y="' + (y(last.value) + 4) + '">' + U.fmtNum(last.value) + '</text>';

      el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" tabindex="0" role="img" aria-label="' +
        esc((o.name || 'Values') + ' per session, ' + points.length + ' sessions, latest ' + last.value + '. Use left and right arrow keys to read each session.') + '">' +
        g + (area ? '<path class="series-area" d="' + area + '"/>' : '') + '<path class="series-line" d="' + d + '"/>' + dots + endLabel +
        '<line class="crosshair" x1="0" x2="0" y1="' + m.t + '" y2="' + (m.t + ih) + '" visibility="hidden"/>' +
        '<circle class="series-dot focus-dot" r="6" visibility="hidden"/>' +
        '<rect class="hit" x="' + m.l + '" y="' + m.t + '" width="' + iw + '" height="' + ih + '"/></svg>';

      const svg = el.querySelector('svg');
      const cross = svg.querySelector('.crosshair');
      const fdot = svg.querySelector('.focus-dot');
      const tip = tooltip(el);
      let idx = -1;
      const show = (i) => {
        idx = Math.max(0, Math.min(points.length - 1, i));
        const p = points[idx];
        const scale = el.clientWidth / W;
        cross.setAttribute('x1', x(idx)); cross.setAttribute('x2', x(idx)); cross.setAttribute('visibility', 'visible');
        fdot.setAttribute('cx', x(idx)); fdot.setAttribute('cy', y(p.value)); fdot.setAttribute('visibility', 'visible');
        tip.show(x(idx) * scale, y(p.value) * scale, U.fmtNum(p.value) + ' ' + (o.unit || ''), p.label, p.sub);
      };
      const hide = () => { idx = -1; cross.setAttribute('visibility', 'hidden'); fdot.setAttribute('visibility', 'hidden'); tip.hide(); };
      svg.addEventListener('pointermove', (e) => {
        const r = svg.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * W;
        const i = points.length === 1 ? 0 : Math.round(((px - m.l) / iw) * (points.length - 1));
        show(i);
      });
      svg.addEventListener('pointerleave', hide);
      svg.addEventListener('focus', () => show(idx < 0 ? points.length - 1 : idx));
      svg.addEventListener('blur', hide);
      svg.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1); }
        if (e.key === 'Home') { e.preventDefault(); show(0); }
        if (e.key === 'End') { e.preventDefault(); show(points.length - 1); }
        if (e.key === 'Escape') hide();
      });
    });
  }

  /**
   * Column chart. bars: [{ value, short, label }]
   * opts: { name, unit, height }
   */
  function columns(el, bars, opts) {
    const o = opts || {};
    el.classList.add('chart');
    return observe(el, () => {
      const W = Math.max(280, el.clientWidth || 600);
      const H = o.height || 180;
      const m = { l: 28, r: 8, t: 12, b: 30 };
      const iw = W - m.l - m.r;
      const ih = H - m.t - m.b;
      const maxV = Math.max(...bars.map((b) => b.value), 1);
      const { max, step } = niceMax(maxV, Math.min(4, Math.max(1, maxV)));
      const y = (v) => m.t + ih - (v / max) * ih;
      const band = iw / bars.length;
      const bw = Math.min(24, band - 2);
      let g = '';
      for (let v = 0; v <= max + 1e-9; v += step) {
        g += '<line class="grid-line" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
        g += '<text class="axis-text" x="' + (m.l - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + (Number.isInteger(v) ? v : v.toFixed(1)) + '</text>';
      }
      const every = Math.max(1, Math.ceil(bars.length / Math.max(2, Math.floor(iw / 64))));
      let marks = '';
      bars.forEach((b, i) => {
        const cx = m.l + band * i + band / 2;
        const x0 = cx - bw / 2;
        const top = y(b.value);
        const h = y(0) - top;
        const r = Math.min(4, h, bw / 2);
        const path = h <= 0 ? '' : 'M' + x0 + ' ' + y(0) + ' V' + (top + r) + ' Q' + x0 + ' ' + top + ' ' + (x0 + r) + ' ' + top + ' H' + (x0 + bw - r) + ' Q' + (x0 + bw) + ' ' + top + ' ' + (x0 + bw) + ' ' + (top + r) + ' V' + y(0) + ' Z';
        marks += '<rect class="bar-hit" data-i="' + i + '" x="' + (m.l + band * i) + '" y="' + m.t + '" width="' + band + '" height="' + ih + '" tabindex="0" role="img" aria-label="' + esc(b.label + ': ' + b.value + ' ' + (o.unit || '')) + '"/>';
        marks += path ? '<path class="series-bar" d="' + path + '"/>' : '<path class="series-bar" d=""/>';
        if (i % every === 0) g += '<text class="axis-text" x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(b.short) + '</text>';
      });
      el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="group" aria-label="' + esc(o.name || 'Chart') + '">' + g + marks + '</svg>';
      const tip = tooltip(el);
      const scale = () => el.clientWidth / W;
      U.$$('.bar-hit', el).forEach((hit) => {
        const i = Number(hit.dataset.i);
        const b = bars[i];
        const showTip = () => tip.show((m.l + band * i + band / 2) * scale(), y(b.value) * scale(), b.value + ' ' + (o.unit || ''), b.label);
        hit.addEventListener('pointerenter', showTip);
        hit.addEventListener('focus', showTip);
        hit.addEventListener('pointerleave', () => tip.hide());
        hit.addEventListener('blur', () => tip.hide());
      });
    });
  }

  /** Sparkline as an SVG string (decorative trend next to a number). */
  function spark(values, label) {
    if (!values || values.length < 2) return '<span class="spark" aria-hidden="true"></span>';
    const W = 96, H = 28, pad = 4;
    const min = Math.min(...values), max = Math.max(...values);
    const x = (i) => pad + (i / (values.length - 1)) * (W - pad * 2);
    const y = (v) => (max === min ? H / 2 : pad + (1 - (v - min) / (max - min)) * (H - pad * 2));
    const d = values.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(label || 'Trend: ' + values.join(', ')) + '"><path d="' + d + '"/><circle cx="' + x(values.length - 1) + '" cy="' + y(values[values.length - 1]) + '" r="3"/></svg>';
  }

  G.Charts = { line, columns, spark, NS };
})(window.GL = window.GL || {});
