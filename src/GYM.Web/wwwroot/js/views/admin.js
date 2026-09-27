/* Screens: SCR-ADM-01 Exercise management · SCR-ADM-02 Exercise editor (details, content, media)
            SCR-ADM-03 Reference data (categories, muscle groups, equipment) */
(function (G) {
  'use strict';
  const { U, UI, Api, App } = G;
  const D = G.Domain;
  const esc = U.esc;
  const icon = G.icon;
  const V = (G.Views = G.Views || {});

  const fmtBytes = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

  /* ---- SCR-ADM-01 Exercise management ---------------------------------------------- */
  V.adminExercises = ({ main, query }) => {
    App.title('Exercise management');
    const page = document.createElement('div');
    page.className = 'page';
    main.appendChild(page);
    const f = { q: query.q || '', status: query.status || 'all', category: query.category || '' };
    UI.load(page, () => Promise.all([Api.exercises({ scope: 'admin', status: 'all' }), Api.reference()]), ([res, ref]) => {
      let all = res.items;
      page.innerHTML = UI.pageHead({
        eyebrow: 'Admin', title: 'Exercise management', sub: 'The exercise library every user picks from. Inactive exercises stay in history but can\'t be added to new workouts.',
        actions: '<a class="btn btn-primary" href="#/admin/exercises/new">' + icon('plus') + 'Add exercise</a>',
      }) +
        '<form class="toolbar" role="search" aria-label="Filter exercises" data-filters>' +
        '<div class="input-wrap">' + icon('search') + '<input class="input" type="search" name="q" aria-label="Search exercises" placeholder="Search name, muscle or equipment" value="' + esc(f.q) + '"></div>' +
        '<label class="sr-only" for="adm-status">Status</label><select class="select" id="adm-status" name="status"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>' +
        '<label class="sr-only" for="adm-cat">Category</label><select class="select" id="adm-cat" name="category"><option value="">All categories</option>' + ref.categories.map((c) => '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>').join('') + '</select>' +
        '</form><p class="small muted" role="status" data-count></p><div data-list style="margin-top:12px"></div>';
      const form = page.querySelector('[data-filters]');
      form.addEventListener('submit', (e) => e.preventDefault());
      form.status.value = f.status;
      form.category.value = f.category;
      const list = page.querySelector('[data-list]');

      const draw = () => {
        const t = f.q.trim().toLowerCase();
        const rows = all.filter((x) => (f.status === 'all' || (f.status === 'active') === x.isActive) && (!f.category || x.categoryId === f.category) &&
          (!t || [x.name, x.muscleGroupName, x.equipmentName, x.categoryName].some((v) => v.toLowerCase().includes(t))));
        page.querySelector('[data-count]').textContent = rows.length + ' of ' + U.plural(all.length, 'exercise') + ' · ' + all.filter((x) => x.isActive).length + ' active';
        if (!rows.length) {
          list.innerHTML = UI.empty({ icon: 'search', title: 'No exercises match', text: 'Change the filters or add a new exercise.', action: '<a class="btn btn-primary" href="#/admin/exercises/new">' + icon('plus') + 'Add exercise</a>' });
          return;
        }
        const media = (x) => '<span class="media-icons"><span title="Photos">' + icon('image') + x.imageCount + '<span class="sr-only"> photos</span></span><span title="Videos">' + icon('video') + x.videoCount + '<span class="sr-only"> videos</span></span></span>';
        const toggle = (x) => '<button type="button" class="btn btn-sm ' + (x.isActive ? 'btn-ghost' : 'btn-soft') + '" data-toggle="' + esc(x.id) + '">' + (x.isActive ? 'Deactivate' : 'Activate') + '<span class="sr-only"> ' + esc(x.name) + '</span></button>';
        list.innerHTML =
          '<div class="table-wrap admin-table-view"><table class="table"><caption class="sr-only">Exercises</caption><thead><tr><th scope="col" class="num">Order</th><th scope="col">Exercise</th><th scope="col">Category</th><th scope="col">Muscle</th><th scope="col">Media</th><th scope="col">Status</th><th scope="col" class="actions"><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
          rows.map((x) => '<tr><td class="num">' + x.displayOrder + '</td><td><div class="admin-name">' + UI.thumb(x.primaryImage, x) + '<div><a href="#/admin/exercises/' + esc(x.id) + '"><b>' + esc(x.name) + '</b></a>' +
            '<div class="xsmall muted">' + esc(x.equipmentName) + ' · updated ' + esc(U.fmtShort(U.toISODate(new Date(x.modifiedDate)))) + '</div></div></div></td>' +
            '<td>' + esc(x.categoryName) + '</td><td>' + esc(x.muscleGroupName) + '</td><td>' + media(x) + '</td><td>' + UI.activeBadge(x.isActive) + '</td>' +
            '<td class="actions"><a class="btn btn-sm btn-ghost" href="#/admin/exercises/' + esc(x.id) + '">' + icon('edit') + 'Edit<span class="sr-only"> ' + esc(x.name) + '</span></a>' + toggle(x) + '</td></tr>').join('') +
          '</tbody></table></div>' +
          '<div class="admin-cards admin-card-view">' + rows.map((x) => '<article class="card admin-card">' + UI.thumb(x.primaryImage, x) +
            '<div class="stack-sm"><div class="row-between"><a href="#/admin/exercises/' + esc(x.id) + '"><b>' + esc(x.name) + '</b></a>' + UI.activeBadge(x.isActive) + '</div>' +
            '<p class="small muted">' + esc(x.categoryName) + ' · ' + esc(x.muscleGroupName) + ' · ' + esc(x.equipmentName) + '</p>' + media(x) +
            '<div class="row-tight"><a class="btn btn-sm" href="#/admin/exercises/' + esc(x.id) + '">' + icon('edit') + 'Edit</a>' + toggle(x) + '</div></div></article>').join('') + '</div>';
      };
      draw();
      const sync = () => history.replaceState(null, '', '#/admin/exercises' + U.qs({ q: f.q, status: f.status === 'all' ? '' : f.status, category: f.category }));
      form.q.addEventListener('input', U.debounce(() => { f.q = form.q.value; sync(); draw(); }, 150));
      form.addEventListener('change', (e) => { if (e.target.name !== 'q') { f[e.target.name] = e.target.value; sync(); draw(); } });
      list.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-toggle]');
        if (!b) return;
        const x = all.find((y) => y.id === b.dataset.toggle);
        if (x.isActive && !(await UI.confirm({ title: 'Deactivate ' + x.name + '?', message: 'People won\'t be able to add it to new workouts. Past sessions that include it are kept and still shown in history.', confirmLabel: 'Deactivate', danger: true, returnFocus: b }))) return;
        UI.busy(b, true, x.isActive ? 'Deactivating…' : 'Activating…');
        try {
          const upd = await Api.setExerciseStatus(x.id, !x.isActive);
          all = all.map((y) => (y.id === x.id ? { ...y, isActive: upd.isActive, modifiedDate: upd.modifiedDate } : y));
          draw();
          UI.toast(upd.name + (upd.isActive ? ' is active again.' : ' is now inactive.'));
          const again = list.querySelector('[data-toggle="' + CSS.escape(x.id) + '"]');
          if (again && again.offsetParent) again.focus();
        } catch (err) { UI.busy(b, false); UI.toast(err.message, { type: 'error' }); }
      });
      App.focus();
    });
  };

  /* ---- SCR-ADM-02 Exercise editor ----------------------------------------------------------- */
  V.adminExerciseForm = ({ main, params, query }) => {
    const isNew = !params.id;
    App.title(isNew ? 'Add exercise' : 'Edit exercise');
    const page = document.createElement('div');
    page.className = 'page';
    main.appendChild(page);
    let dirty = false;
    let ex = null;

    // Unsaved-changes guard for in-app links.
    const guard = async (e) => {
      const a = e.target.closest('a[href^="#/"]');
      if (!dirty || !a || e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      if (await UI.confirm({ title: 'Discard unsaved changes?', message: 'Your changes to this exercise haven\'t been saved.', confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', danger: true })) {
        dirty = false; U.go(a.getAttribute('href').slice(1));
      }
    };
    document.addEventListener('click', guard, true);
    const beforeUnload = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);

    UI.load(page, () => Promise.all([isNew ? null : Api.exercise(params.id, { scope: 'admin' }), Api.reference()]), ([loaded, ref]) => {
      ex = loaded;
      if (ex) App.title('Edit ' + ex.name);
      const v = ex || { name: '', categoryId: '', muscleGroupId: '', equipmentId: '', description: '', instructions: '', displayOrder: '', isActive: true };
      const sel = (name, label, list, value) => '<div class="field"><label for="f-' + name + '">' + label + '<span class="req" aria-hidden="true">*</span></label><select class="select" id="f-' + name + '" name="' + name + '" required aria-required="true"><option value="">Choose…</option>' +
        list.map((r) => '<option value="' + esc(r.id) + '"' + (r.id === value ? ' selected' : '') + (r.isActive || r.id === value ? '' : ' disabled') + '>' + esc(r.name) + (r.isActive ? '' : ' (inactive)') + '</option>').join('') + '</select></div>';
      page.innerHTML = UI.pageHead({
        back: { href: '#/admin/exercises', label: 'Exercise management' }, eyebrow: 'Admin',
        title: isNew ? 'Add exercise' : ex.name,
        sub: isNew ? 'Details first. You can add photos and videos after saving.' : 'Last updated ' + esc(U.fmtDate(U.toISODate(new Date(ex.modifiedDate)))) + ' at ' + esc(U.fmtTime(ex.modifiedDate)) + ' &nbsp; ' + UI.activeBadge(ex.isActive),
      }) +
        (query.created ? '<div class="banner banner--success" role="status" style="margin-bottom:16px">' + icon('check') + '<div class="grow"><b>Exercise created.</b><span>Now add photos and a tutorial video below.</span></div></div>' : '') +
        '<form class="stack-lg" novalidate data-form style="max-width:960px">' +
        '<section class="card stack" aria-labelledby="s-details"><h2 class="card-title" id="s-details">Details</h2><div class="form-grid">' +
        '<div class="field span-2"><label for="f-name">Exercise name<span class="req" aria-hidden="true">*</span></label><input class="input" id="f-name" name="name" maxlength="100" required aria-required="true" value="' + esc(v.name) + '" autocomplete="off"></div>' +
        sel('categoryId', 'Category', ref.categories, v.categoryId) + sel('muscleGroupId', 'Muscle group', ref.muscleGroups, v.muscleGroupId) + sel('equipmentId', 'Equipment', ref.equipment, v.equipmentId) +
        '<div class="field"><label for="f-order">Display order</label><input class="input" id="f-order" name="displayOrder" type="number" inputmode="numeric" min="0" max="9999" value="' + esc(v.displayOrder) + '" aria-describedby="f-order-hint"><p class="hint" id="f-order-hint">Lower numbers appear first. Leave empty to add at the end.</p></div>' +
        '<div class="field span-2"><span class="field-label" id="f-status-l">Status</span><label class="switch"><input type="checkbox" name="isActive" aria-describedby="f-status-hint"' + (v.isActive ? ' checked' : '') + '><span class="track" aria-hidden="true"></span><span data-status-text>' + (v.isActive ? 'Active' : 'Inactive') + '</span></label><p class="hint" id="f-status-hint">Only active exercises can be added to new workouts.</p></div>' +
        '</div></section>' +
        '<section class="card stack" aria-labelledby="s-content"><h2 class="card-title" id="s-content">Description and instructions</h2>' +
        '<div class="field"><label for="f-desc">Description</label><textarea class="textarea" id="f-desc" name="description" maxlength="2000" rows="3" aria-describedby="f-desc-c">' + esc(v.description) + '</textarea><p class="counter" id="f-desc-c" data-counter="description"></p></div>' +
        '<div class="field"><label for="f-inst">Instructions</label><textarea class="textarea" id="f-inst" name="instructions" maxlength="4000" rows="6" aria-describedby="f-inst-hint f-inst-c">' + esc(v.instructions) + '</textarea>' +
        '<p class="hint" id="f-inst-hint">Write one step per line. Steps are numbered for people automatically.</p><p class="counter" id="f-inst-c" data-counter="instructions"></p></div>' +
        '<details><summary class="small" style="cursor:pointer;font-weight:600">Preview steps</summary><div data-preview style="margin-top:12px"></div></details></section>' +
        '<div class="sticky-save"><span class="grow" data-dirty>' + (isNew ? 'New exercise' : 'No unsaved changes') + '</span><a class="btn" href="#/admin/exercises">Cancel</a><button type="submit" class="btn btn-primary">' + icon('check') + (isNew ? 'Create exercise' : 'Save changes') + '</button></div>' +
        '</form>' +
        '<section class="card stack" aria-labelledby="s-media" style="max-width:960px;margin-top:24px" data-media-section></section>';

      const form = page.querySelector('[data-form]');
      const counters = () => U.$$('[data-counter]', form).forEach((c) => { const el = form[c.dataset.counter]; c.textContent = el.value.length.toLocaleString('en-GB') + ' / ' + Number(el.maxLength).toLocaleString('en-GB'); });
      const preview = () => { page.querySelector('[data-preview]').innerHTML = form.instructions.value.trim() ? '<ol class="steps">' + form.instructions.value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => '<li><span>' + esc(l) + '</span></li>').join('') + '</ol>' : '<p class="muted small">No steps yet.</p>'; };
      counters(); preview();
      form.addEventListener('input', (e) => {
        dirty = true;
        page.querySelector('[data-dirty]').textContent = 'Unsaved changes';
        if (e.target.name === 'isActive') page.querySelector('[data-status-text]').textContent = e.target.checked ? 'Active' : 'Inactive';
        counters();
        if (e.target.name === 'instructions') preview();
      });
      form.addEventListener('change', (e) => { if (e.target.name === 'isActive') { dirty = true; page.querySelector('[data-status-text]').textContent = e.target.checked ? 'Active' : 'Inactive'; } });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errors = {};
        const n = D.validateExerciseName(form.name.value); if (n) errors.name = n;
        if (!form.categoryId.value) errors.categoryId = 'Choose a category.';
        if (!form.muscleGroupId.value) errors.muscleGroupId = 'Choose a muscle group.';
        if (!form.equipmentId.value) errors.equipmentId = 'Choose the equipment.';
        if (Object.keys(errors).length) { UI.showFieldErrors(form, errors, 'Fix the highlighted fields and save again.'); return; }
        UI.clearFieldErrors(form);
        const body = {
          name: form.name.value, categoryId: form.categoryId.value, muscleGroupId: form.muscleGroupId.value, equipmentId: form.equipmentId.value,
          description: form.description.value, instructions: form.instructions.value,
          displayOrder: form.displayOrder.value === '' ? null : Number(form.displayOrder.value), isActive: form.isActive.checked,
        };
        if (ex && ex.isActive && !body.isActive && !(await UI.confirm({ title: 'Deactivate ' + ex.name + '?', message: 'People won\'t be able to add it to new workouts. Past sessions are kept.', confirmLabel: 'Save and deactivate', danger: true }))) return;
        const btn = form.querySelector('[type="submit"]');
        UI.busy(btn, true, 'Saving…');
        try {
          if (isNew) {
            const created = await Api.createExercise(body);
            dirty = false;
            U.go('/admin/exercises/' + created.id + '?created=1');
            UI.toast(created.name + ' created.');
          } else {
            ex = await Api.updateExercise(ex.id, body);
            dirty = false;
            UI.busy(btn, false);
            page.querySelector('[data-dirty]').textContent = 'All changes saved';
            page.querySelector('.page-head h1').textContent = ex.name;
            UI.toast('Changes saved.');
          }
        } catch (err) {
          UI.busy(btn, false);
          UI.applyApiError(form, err);
        }
      });

      const mediaSection = page.querySelector('[data-media-section]');
      if (isNew) {
        mediaSection.innerHTML = '<h2 class="card-title" id="s-media">Photos and tutorial videos</h2><div class="banner">' + icon('info') + '<div class="grow">Create the exercise first, then add photos and videos here.</div></div>';
      } else {
        mediaManager(mediaSection, ex);
      }
      App.focus();
    });

    return () => {
      document.removeEventListener('click', guard, true);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  };

  /* ---- Media manager (part of SCR-ADM-02) ---------------------------------------------------- */
  function mediaManager(section, ex) {
    let media = (ex.media || []).slice().sort((a, b) => a.displayOrder - b.displayOrder);
    const R = D.MEDIA_RULES;
    section.innerHTML = '<div class="row-between"><h2 class="card-title" id="s-media">Photos and tutorial videos</h2><span class="small muted" data-mcount></span></div>' +
      '<label class="dropzone" data-drop><input type="file" class="sr-only" multiple accept="' + R.image.mimeTypes.concat(R.video.mimeTypes).join(',') + '" data-file aria-describedby="drop-hint">' +
      icon('upload') + '<b>Drop files here or choose files</b><span class="small muted" id="drop-hint">JPG, PNG or WebP up to 5 MB · MP4 or WebM up to 100 MB. Files are checked for type, content and size.</span></label>' +
      '<div class="upload-errors" data-errors role="alert"></div>' +
      '<div class="media-grid" data-grid></div>' +
      '<p class="hint">The first active photo is used as the thumbnail. Hidden media stays stored but is not shown to people.</p>';
    const grid = section.querySelector('[data-grid]');
    const errors = section.querySelector('[data-errors]');
    const input = section.querySelector('[data-file]');
    const drop = section.querySelector('[data-drop]');

    const card = (m, i) => {
      const img = m.mediaType === 'Image';
      return '<article class="media-card' + (m.isActive ? '' : ' is-inactive') + '" data-m="' + esc(m.id) + '">' +
        '<div class="media-prev">' + (!img && G.media.videoSrc(m) ? '<video src="' + esc(G.media.videoSrc(m)) + '" muted preload="metadata"></video>' : '<img src="' + esc(G.media.src(m, ex)) + '" alt="" data-fallback>') +
        '<span class="badge ' + (img ? '' : 'badge--done') + '">' + icon(img ? 'image' : 'video') + (img ? 'Photo' : 'Video') + '</span><span class="badge order">#' + (i + 1) + '</span></div>' +
        '<div class="media-body"><span class="fname" title="' + esc(m.fileName) + '">' + esc(m.fileName) + '</span><span class="xsmall muted">' + esc(m.mimeType) + ' · ' + fmtBytes(m.sizeBytes) + (m.isActive ? '' : ' · Hidden') + '</span>' +
        '<div class="field"><label class="xsmall" for="alt-' + esc(m.id) + '">' + (img ? 'Alt text (describes the photo)' : 'Video title') + '</label><input class="input" id="alt-' + esc(m.id) + '" data-meta="' + (img ? 'altText' : 'title') + '" value="' + esc(img ? m.altText : m.title) + '" maxlength="150"></div></div>' +
        '<div class="media-actions"><button type="button" class="btn btn-ghost btn-icon btn-sm" data-move="-1" aria-label="Move ' + esc(m.fileName) + ' earlier"' + (i === 0 ? ' disabled' : '') + '>' + icon('chevron-up') + '</button>' +
        '<button type="button" class="btn btn-ghost btn-icon btn-sm" data-move="1" aria-label="Move ' + esc(m.fileName) + ' later"' + (i === media.length - 1 ? ' disabled' : '') + '>' + icon('chevron-down') + '</button>' +
        '<span class="grow"></span><button type="button" class="btn btn-ghost btn-sm" data-vis>' + icon(m.isActive ? 'eye-off' : 'eye') + (m.isActive ? 'Hide' : 'Show') + '<span class="sr-only"> ' + esc(m.fileName) + '</span></button>' +
        '<button type="button" class="btn btn-danger-ghost btn-icon btn-sm" data-delm aria-label="Delete ' + esc(m.fileName) + '">' + icon('trash') + '</button></div></article>';
    };
    const draw = (focusSel) => {
      grid.innerHTML = media.length ? media.map(card).join('') : UI.empty({ icon: 'image', title: 'No media yet', text: 'Add at least one photo so people recognise the exercise.', compact: true });
      section.querySelector('[data-mcount]').textContent = media.filter((m) => m.mediaType === 'Image').length + ' photos · ' + media.filter((m) => m.mediaType === 'Video').length + ' videos';
      if (focusSel) { const f = grid.querySelector(focusSel); if (f) f.focus(); }
    };
    draw();

    const readAsDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    async function upload(files) {
      errors.innerHTML = '';
      const list = Array.from(files);
      for (const file of list) {
        const check = D.validateMedia(file);
        if (check.error) { errors.insertAdjacentHTML('beforeend', '<div class="banner banner--error">' + icon('alert-circle') + '<div class="grow">' + esc(check.error) + '</div></div>'); continue; }
        const ph = document.createElement('div');
        ph.className = 'media-card';
        ph.innerHTML = '<div class="media-prev" style="display:grid;place-items:center"><span class="spinner"></span></div><div class="media-body"><span class="fname">' + esc(file.name) + '</span><span class="xsmall muted">Uploading…</span></div>';
        if (!media.length) grid.innerHTML = '';
        grid.appendChild(ph);
        try {
          // Prototype only: small images persist in browser storage; larger files and videos preview for this visit.
          // The real API receives the file itself as multipart/form-data.
          const url = !G.MockApi ? null : check.kind === 'image' && file.size < 1.5 * 1048576 ? await readAsDataUrl(file) : URL.createObjectURL(file);
          const m = await Api.uploadMedia(ex.id, { file, fileName: file.name, mimeType: file.type, sizeBytes: file.size, dataUrl: url, altText: ex.name + ': photo', title: ex.name + ' tutorial', idempotencyKey: Api.newKey() });
          media.push(m);
          UI.toast(file.name + ' uploaded.' + (check.kind === 'image' ? ' Check its alt text.' : ''));
        } catch (err) {
          errors.insertAdjacentHTML('beforeend', '<div class="banner banner--error">' + icon('alert-circle') + '<div class="grow">' + esc(file.name) + ': ' + esc(err.message) + '</div></div>');
        }
        ph.remove();
        draw();
      }
      input.value = '';
    }
    input.addEventListener('change', () => upload(input.files));
    ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
    drop.addEventListener('drop', (e) => upload(e.dataTransfer.files));

    grid.addEventListener('change', async (e) => {
      const f = e.target.closest('[data-meta]');
      if (!f) return;
      const m = media.find((x) => x.id === f.closest('[data-m]').dataset.m);
      try {
        const upd = await Api.updateMedia(ex.id, m.id, { [f.dataset.meta]: f.value });
        Object.assign(m, upd);
        f.removeAttribute('aria-invalid');
        UI.toast(f.dataset.meta === 'altText' ? 'Alt text saved.' : 'Title saved.');
      } catch (err) { f.setAttribute('aria-invalid', 'true'); UI.toast(err.message, { type: 'error' }); }
    });
    grid.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const cardEl = b.closest('[data-m]');
      if (!cardEl) return;
      const m = media.find((x) => x.id === cardEl.dataset.m);
      const i = media.indexOf(m);
      try {
        if (b.matches('[data-move]')) {
          const j = i + Number(b.dataset.move);
          const next = media.slice();
          [next[i], next[j]] = [next[j], next[i]];
          media = await Api.reorderMedia(ex.id, next.map((x) => x.id));
          draw('[data-m="' + CSS.escape(m.id) + '"] [data-move="' + b.dataset.move + '"]:not([disabled]), [data-m="' + CSS.escape(m.id) + '"] [data-move]:not([disabled])');
        } else if (b.matches('[data-vis]')) {
          const upd = await Api.updateMedia(ex.id, m.id, { isActive: !m.isActive });
          Object.assign(m, upd);
          draw('[data-m="' + CSS.escape(m.id) + '"] [data-vis]');
          UI.toast(m.isActive ? 'Shown to people again.' : 'Hidden from people. It is still stored.');
        } else if (b.matches('[data-delm]')) {
          if (!(await UI.confirm({ title: 'Delete ' + m.fileName + '?', message: 'The file is removed from this exercise permanently. To keep it but stop showing it, choose Hide instead.', confirmLabel: 'Delete file', danger: true, returnFocus: b }))) return;
          await Api.deleteMedia(ex.id, m.id);
          media = media.filter((x) => x !== m);
          media.forEach((x, k) => { x.displayOrder = k + 1; });
          draw();
          input.focus();
          UI.toast(m.fileName + ' deleted.', { icon: 'trash' });
        }
      } catch (err) { UI.toast(err.message, { type: 'error' }); }
    });
  }

  /* ---- SCR-ADM-03 Reference data ------------------------------------------------------------- */
  V.adminReference = ({ main }) => {
    App.title('Reference data');
    const page = document.createElement('div');
    page.className = 'page';
    main.appendChild(page);
    const TYPES = [['categories', 'categories', 'Categories', 'Body area used to group exercises.'], ['muscle-groups', 'muscleGroups', 'Muscle groups', 'Primary muscle trained.'], ['equipment', 'equipment', 'Equipment', 'What the exercise needs.']];
    UI.load(page, () => Api.reference(), (ref) => {
      page.innerHTML = UI.pageHead({ eyebrow: 'Admin', title: 'Reference data', sub: 'Options offered in the exercise editor. Inactive options stay on existing exercises but can\'t be chosen for new ones.' }) +
        '<div class="ref-lists">' + TYPES.map(([type, key, title, desc]) => '<section class="card stack" data-type="' + type + '" aria-labelledby="rh-' + type + '"><div><h2 class="card-title" id="rh-' + type + '">' + title + '</h2><p class="small muted">' + desc + '</p></div>' +
          '<ul class="list" data-rows></ul><form class="row-tight" novalidate data-add><div class="field grow"><label class="sr-only" for="add-' + type + '">New ' + title.toLowerCase() + ' name</label><input class="input" id="add-' + type + '" name="name" placeholder="Add ' + title.toLowerCase().replace(/s$/, '') + '…" maxlength="50"></div><button class="btn" type="submit">' + icon('plus') + 'Add</button></form></section>').join('') + '</div>';
      const rows = (type, key) => ref[key].map((r) => '<li class="list-item" data-id="' + esc(r.id) + '"><div class="grow"><b data-name>' + esc(r.name) + '</b><div class="xsmall muted">' + U.plural(r.usage || 0, 'exercise') + '</div></div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-rename>' + icon('edit') + 'Rename<span class="sr-only"> ' + esc(r.name) + '</span></button>' +
        '<label class="switch"><input type="checkbox" data-active' + (r.isActive ? ' checked' : '') + ' aria-label="' + esc(r.name) + ' active"><span class="track" aria-hidden="true"></span></label></li>').join('');
      TYPES.forEach(([type, key]) => { page.querySelector('[data-type="' + type + '"] [data-rows]').innerHTML = rows(type, key); });
      page.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sec = e.target.closest('[data-type]');
        const type = sec.dataset.type;
        const key = TYPES.find((t) => t[0] === type)[1];
        const form = e.target;
        if (form.matches('[data-add]')) {
          const b = form.querySelector('button');
          UI.busy(b, true, 'Adding…');
          try {
            const row = await Api.addReference(type, form.name.value);
            ref[key].push({ ...row, usage: 0 });
            sec.querySelector('[data-rows]').innerHTML = rows(type, key);
            form.reset(); UI.clearFieldErrors(form);
            UI.toast('"' + row.name + '" added.');
          } catch (err) { UI.applyApiError(form, err); } finally { UI.busy(b, false); form.name.focus(); }
        }
        if (form.matches('[data-rename-form]')) {
          const li = form.closest('[data-id]');
          const r = ref[key].find((x) => x.id === li.dataset.id);
          try {
            const upd = await Api.updateReference(type, r.id, { name: form.name.value });
            r.name = upd.name;
            sec.querySelector('[data-rows]').innerHTML = rows(type, key);
            const btn = sec.querySelector('[data-id="' + CSS.escape(r.id) + '"] [data-rename]');
            if (btn) btn.focus();
            UI.toast('Renamed to "' + upd.name + '".');
          } catch (err) { UI.applyApiError(form, err); }
        }
      });
      page.addEventListener('click', (e) => {
        const b = e.target.closest('[data-rename], [data-rename-cancel]');
        if (!b) return;
        const sec = b.closest('[data-type]');
        const key = TYPES.find((t) => t[0] === sec.dataset.type)[1];
        const li = b.closest('[data-id]');
        if (b.matches('[data-rename-cancel]')) { sec.querySelector('[data-rows]').innerHTML = rows(sec.dataset.type, key); return; }
        const r = ref[key].find((x) => x.id === li.dataset.id);
        li.innerHTML = '<form class="row-tight grow" novalidate data-rename-form><div class="field grow"><label class="sr-only" for="rn-' + esc(r.id) + '">New name for ' + esc(r.name) + '</label><input class="input" id="rn-' + esc(r.id) + '" name="name" value="' + esc(r.name) + '" maxlength="50"></div>' +
          '<button class="btn btn-primary btn-sm" type="submit">Save</button><button class="btn btn-ghost btn-sm" type="button" data-rename-cancel>Cancel</button></form>';
        const inp = li.querySelector('input');
        inp.focus(); inp.select();
      });
      page.addEventListener('change', async (e) => {
        if (!e.target.matches('[data-active]')) return;
        const sec = e.target.closest('[data-type]');
        const key = TYPES.find((t) => t[0] === sec.dataset.type)[1];
        const r = ref[key].find((x) => x.id === e.target.closest('[data-id]').dataset.id);
        try {
          const upd = await Api.updateReference(sec.dataset.type, r.id, { isActive: e.target.checked });
          r.isActive = upd.isActive;
          UI.toast('"' + r.name + '" is ' + (r.isActive ? 'active.' : 'inactive.'));
        } catch (err) { e.target.checked = !e.target.checked; UI.toast(err.message, { type: 'error' }); }
      });
      App.focus();
    });
  };
})(window.GL);
