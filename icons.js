const paths = {
  oven:'<rect x="3.5" y="3" width="17" height="18" rx="2.5"/><path d="M4 8.5h16M7 5.7h1m3 0h1"/><rect x="7" y="12" width="10" height="6" rx="1"/>',
  hob:'<rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="9" cy="12" r="3"/><circle cx="16.5" cy="11" r="1.7"/><path d="M15 16h3"/>',
  cold:'<path d="M3 11h18a9 9 0 0 1-18 0Zm4 9h10M8 10l2-5m3 5 4-7"/>',
  snow:'<path d="M12 2v20m0-16 3-2m-3 2L9 4m3 14 3 2m-3-2-3 2M3.5 7l17 10M7 9l-3 .7M7 9l-.8-3M17 15l.8 3m-.8-3 3-.7M3.5 17l17-10M7 15l-3-.7m3 .7-.8 3M17 9l.8-3M17 9l3 .7"/>',
  ticket: '<path d="M2 5h20v5a2 2 0 0 0 0 4v5H2v-5a2 2 0 0 0 0-4zM16 7v1m0 3v2m0 3v1"/>',
  undo: '<path d="M8 5 3 10l5 5M4 10h10a6 6 0 1 1 0 12" transform="translate(0 -2)"/>',
  brand:
    '<path d="M3 13h18c-.6 5.1-4.2 8-9 8s-8.4-2.9-9-8Z" fill="currentColor" stroke="none"/><path d="M5 10c1.7-.1 2.7-.9 3.5-2.7L10 4M10.5 10c1.8-.6 2.6-1.5 3.4-3.8L15.5 2M16.4 10c1.2-.6 2.2-2 2.7-4.3"/>',
  week: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18m-14 5h3"/>',
  book: '<path d="M3 4.5c4-1 6.5 0 9 1.6 2.5-1.6 5-2.6 9-1.6v15c-4-1-6.5 0-9 1.6-2.5-1.6-5-2.6-9-1.6Zm9 1.6v15"/>',
  bag: '<path d="M4 8h16l1 12H3L4 8Z"/><path d="M8 9V7a4 4 0 0 1 8 0v2"/>',
  sliders:
    '<path d="M3 7h4m4 0h10M3 17h10m4 0h4"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
  fire: '<path d="M13 2c.5 4-3.5 5.5-4 9-1.1-.6-1.6-1.4-1.7-2.5C3 12.2 4.5 21 12 21c7.4 0 10-8.5 4.8-13.7.4 3-1 4.1-1.6 4.8C16 7.2 14.5 4 13 2Z"/>',
  fork: '<path d="M5 3v5c0 2 1 3 3 3s3-1 3-3V3M8 3v17m11-17c-3 2-4 6-4 10h4m0-10v17"/>',
  users:
    '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m2 3c2 .7 3 2 3 5"/>',
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  arrow: '<path d="M4 12h16m-7-7 7 7-7 7"/>',
  open: '<path d="M6 18 18 6M7 6h11v11"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  swap: '<path d="M3 8h16m-4-4 4 4-4 4M21 16H5m4-4-4 4 4 4"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  heart:
    '<path d="M12 20s-8.3-4.7-8.3-10.4a4.5 4.5 0 0 1 8.3-2.3 4.5 4.5 0 0 1 8.3 2.3C20.3 15.3 12 20 12 20Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19"/>',
  cloud:
    '<path d="M4 18h14a3.5 3.5 0 0 0 .4-7 5.5 5.5 0 0 0-10.5-1.5A4.3 4.3 0 0 0 4 18Z"/><path d="M16 3v2m4.5 1-1.2 1.4"/>',
  moon: '<path d="M19 15a8.5 8.5 0 0 1-10-11A8.5 8.5 0 1 0 19 15Z"/>',
  search: '<circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/>',
  copy: '<rect x="8" y="7" width="12" height="14" rx="2"/><path d="M15 4H5a2 2 0 0 0-2 2v10"/>',
  leaf: '<path d="M20 4C10 3 3 7 4 13s9 9 13 2c2-4 2-7 3-11Zm-16 16L15 9"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  minus: '<path d="M4 12h16"/>',
  pot: '<path d="M4 10h16v4a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6Zm-2 1h2m16 0h2M4 7h16M9 6c0-3 6-3 6 0"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
};
function icon(name, size = 20) {
  return (
    '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="' +
    size +
    '" height="' +
    size +
    '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    (paths[name] || "") +
    "</svg>"
  );
}
