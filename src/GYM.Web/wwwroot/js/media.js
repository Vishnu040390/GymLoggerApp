/* GymLogger — exercise media URLs and generated placeholder artwork.
   Real uploads are served by the API from /media/…. When an exercise has no photo
   (or a file is missing) the UI shows generated artwork instead of a broken image.
   In the prototype (GL.MockApi present) seeded media paths have no files behind
   them, so they always render as artwork. */
(function (G) {
  'use strict';
  const U = G.U;
  const HUES = { Chest: 215, Back: 190, Legs: 28, Shoulders: 262, Arms: 340, Core: 150 };
  const isInline = (url) => /^(data:|blob:)/.test(url || '');
  const servable = (url) => !!url && (isInline(url) || !G.MockApi);

  function placeholder(media, exercise, thumb) {
    const hue = HUES[exercise && exercise.categoryName] || 215;
    const isVideo = media && media.mediaType === 'Video';
    const glyph = '<rect x="-62" y="-26" width="16" height="52" rx="4"/><rect x="46" y="-26" width="16" height="52" rx="4"/><path d="M-46 0H46M-78 -12V12M78 -12V12"/>';
    if (thumb) {
      const t = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="hsl(' + hue + ',30%,22%)"/>' +
        '<g transform="translate(48 48) scale(.42)" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="8" stroke-linecap="round">' + glyph + '</g></svg>';
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(t);
    }
    const name = U.esc(exercise && exercise.name ? exercise.name : 'Exercise');
    const n = (media && media.displayOrder) || 1;
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(' + hue + ',32%,' + (isVideo ? 16 : 24) + '%)"/><stop offset="1" stop-color="hsl(' + ((hue + 30) % 360) + ',30%,' + (isVideo ? 9 : 14) + '%)"/></linearGradient>' +
      '<pattern id="p" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="rgba(255,255,255,.05)"/></pattern></defs>' +
      '<rect width="320" height="200" fill="url(#g)"/><rect width="320" height="200" fill="url(#p)"/>' +
      '<g transform="translate(' + (isVideo ? 160 : 230) + ' ' + (isVideo ? 88 : 96) + ')" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="7" stroke-linecap="round">' + glyph + '</g>' +
      (isVideo ? '' : '<text x="20" y="160" fill="#fff" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="700" font-size="26">' + name + '</text>' +
        '<text x="20" y="182" fill="rgba(255,255,255,.65)" font-family="Barlow, Arial, sans-serif" font-size="12">Photo ' + n + '</text>') +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  G.media = {
    /** Image URL for a photo, a video poster, or artwork when there is nothing to show. */
    src(media, exercise, thumb) {
      if (!media) return placeholder({ mediaType: 'Image', displayOrder: 1 }, exercise, thumb);
      if (media.mediaType === 'Video') return servable(media.thumbnailUrl) ? media.thumbnailUrl : placeholder(media, exercise, thumb);
      return servable(media.fileUrl) ? media.fileUrl : placeholder(media, exercise, thumb);
    },
    /** Playable video URL, or null when playback is not available. */
    videoSrc(media) { return media && servable(media.fileUrl) ? media.fileUrl : null; },
    placeholder,
  };
})(window.GL = window.GL || {});
