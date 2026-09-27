/* GymLogger prototype — inline SVG icon set (24px grid, 2px stroke, currentColor).
   Usage: GL.icon('plus') or GL.icon('trash', { label: 'Delete set' }).
   Decorative by default (aria-hidden). Pass a label only when the icon is the
   sole content of a control and the control has no other accessible name. */
(function (G) {
  'use strict';

  const P = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    'chevron-left': '<path d="M15 5l-7 7 7 7"/>',
    'chevron-right': '<path d="M9 5l7 7-7 7"/>',
    'chevron-down': '<path d="M6 9l6 6 6-6"/>',
    'chevron-up': '<path d="M6 15l6-6 6 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    dumbbell: '<rect x="3.5" y="7" width="3.5" height="10" rx="1"/><rect x="17" y="7" width="3.5" height="10" rx="1"/><path d="M7 12h10M1.5 10v4M22.5 10v4"/>',
    home: '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
    history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5"/><path d="M3.5 3.5v5h5"/><path d="M12 7.5V12l3 2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    chart: '<path d="M4 4v16h16"/><path d="M7.5 15l3.5-4 3 3 5-6.5"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    logout: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M9 17l-5-5 5-5M4 12h11"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" stroke-linejoin="round"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    video: '<rect x="2.5" y="6" width="13.5" height="12" rx="2"/><path d="M16 10.5l5.5-3.5v10L16 13.5z"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    'arrow-up': '<path d="M12 19V5M6 11l6-6 6 6"/>',
    'arrow-down': '<path d="M12 5v14M6 13l6 6 6-6"/>',
    equal: '<path d="M6 9.5h12M6 14.5h12"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="M3 3l18 18"/><path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5h.01"/>',
    alert: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.2h.01"/>',
    'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/>',
    'wifi-off': '<path d="M3 3l18 18"/><path d="M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.7M19 12.9a10 10 0 0 0-2.6-1.8M2 9a15 15 0 0 1 4.3-2.6M22 9a15 15 0 0 0-11-3.9"/><path d="M12 20h.01"/>',
    cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.8-8.9A6 6 0 0 1 17.7 8.4 4 4 0 0 1 17 18.5z"/><path d="M9.5 13.5l2 2 3.5-3.5"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.7-3.9L4 9M4 4v5h5M4 13a8 8 0 0 0 14.7 3.9L20 15M20 20v-5h-5"/>',
    more: '<circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none"/>',
    compare: '<path d="M7 7h12l-3.5-3.5M17 17H5l3.5 3.5"/>',
    flag: '<path d="M5 21V4M5 4h12l-2.5 4.5L17 13H5"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    flask: '<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7 15h10"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke-width="3"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    database: '<ellipse cx="12" cy="5.5" rx="8" ry="2.5"/><path d="M4 5.5v13c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-13M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  };

  G.icon = function (name, opts) {
    const o = opts || {};
    const size = o.size || 24;
    const body = P[name] || P.info;
    const a11y = o.label ? 'role="img" aria-label="' + G.U.esc(o.label) + '"' : 'aria-hidden="true" focusable="false"';
    return '<svg ' + a11y + ' width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' + (o.cls ? ' class="' + o.cls + '"' : '') + '>' + body + '</svg>';
  };
  G.icon.names = Object.keys(P);
})(window.GL = window.GL || {});
