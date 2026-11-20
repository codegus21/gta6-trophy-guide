// Leonida Trophy Guide: checklist, tracker and roadmap for the 55 PlayStation 5
// trophies of Grand Theft Auto VI. Static and offline: the only files it loads are
// data/trophies.json and data/roadmap.json from this same folder, by fetch.
// Progress and the spoiler setting live in this browser's localStorage.
(function () {
  'use strict';

  var EARNED_KEY = 'gta6-trophy-guide-earned-v1';
  var SPOILER_KEY = 'gta6-trophy-guide-spoiler-v1';
  var GRADE_ORDER = ['platinum', 'gold', 'silver', 'bronze'];

  var trophies = [];
  var byId = {};
  var roadmap = { stages: [], missable: [], note: '' };
  var missableById = {};
  var earned = new Set();
  var spoilerOn = false;

  var listEl = document.getElementById('list');
  var emptyEl = document.getElementById('empty');
  var searchEl = document.getElementById('search');
  var kindEl = document.getElementById('kind');
  var gradeEl = document.getElementById('grade');
  var statusEl = document.getElementById('status');
  var spoilerEl = document.getElementById('spoiler');
  var statusMsg = document.getElementById('file-status');
  var dialog = document.getElementById('detail');
  var detailBody = document.getElementById('detail-body');

  function loadEarned() {
    try {
      var raw = JSON.parse(localStorage.getItem(EARNED_KEY) || '[]');
      if (Array.isArray(raw)) raw.forEach(function (id) { earned.add(Number(id)); });
    } catch (e) { earned = new Set(); }
  }
  function saveEarned() {
    localStorage.setItem(EARNED_KEY, JSON.stringify(Array.from(earned).sort(function (a, b) { return a - b; })));
  }
  function loadSpoiler() {
    spoilerOn = localStorage.getItem(SPOILER_KEY) === 'on';
    spoilerEl.checked = spoilerOn;
  }
  function saveSpoiler() {
    localStorage.setItem(SPOILER_KEY, spoilerOn ? 'on' : 'off');
  }

  // Kind of a trophy: the data file's kind when it carries one, else a fallback
  // read from the official description (story chapters and missions, collectibles
  // with counts, activities) — anything else falls under the general group.
  function kindOf(t) {
    if (t.kind) return String(t.kind).toLowerCase();
    var d = t.description || '';
    if (/Complete Chapter|final mission|Complete (Gone Fishing|Breakfast Run|The Cartel Heist|Child's Play|Headliners|VCIA Takedown|Operation Savage Glory)|mission for (Andy|Kenton|Billy|Randy|Tyrone)|mission strands/.test(d)) return 'story';
    if (/Collectible Card|WAiNK|Discover \d+ vehicles|Explore all of Leonida|Register \d+ vehicles|garage properties/.test(d)) return 'collectibles';
    if (/Stunts|Shooting Range|Drone Race|races|fishing challenge|arcade game|Meditate|Hunt a unique|Challenges|bowling|Bowl|drive-by/.test(d)) return 'activities';
    return 'other';
  }
  function isMissable(t) {
    if (t.missable === true) return true;
    return Object.prototype.hasOwnProperty.call(missableById, t.id);
  }
  function missableReason(t) {
    if (t.missable_reason) return t.missable_reason;
    if (t.missable_note) return t.missable_note;
    var m = missableById[t.id];
    return m ? m.reason : '';
  }
  function gradeLabel(g) { return g.charAt(0).toUpperCase() + g.slice(1); }

  function renderProgress() {
    var total = trophies.length;
    var done = earned.size;
    var pct = total ? Math.round((done / total) * 100) : 0;
    document.getElementById('earned-count').textContent = done + ' of ' + total + ' earned';
    document.getElementById('earned-pct').textContent = pct + '%';
    var bar = document.getElementById('progress-bar');
    bar.setAttribute('aria-valuenow', String(pct));
    document.getElementById('progress-fill').style.width = pct + '%';
    var parts = GRADE_ORDER.map(function (g) {
      var inGrade = trophies.filter(function (t) { return t.grade === g; });
      var got = inGrade.filter(function (t) { return earned.has(t.id); }).length;
      return gradeLabel(g) + ' ' + got + '/' + inGrade.length;
    });
    document.getElementById('grade-counts').textContent = parts.join(' · ');
    var toward = trophies.filter(function (t) { return t.grade !== 'platinum'; });
    var towardDone = toward.filter(function (t) { return earned.has(t.id); }).length;
    document.getElementById('towards-platinum').textContent =
      towardDone + ' of ' + toward.length + ' trophies towards the platinum' +
      (earned.has(1) ? ' — platinum earned!' : '.');
  }

  function renderRoadmap() {
    var ol = document.getElementById('roadmap');
    ol.replaceChildren();
    roadmap.stages.forEach(function (stage, i) {
      var li = document.createElement('li');
      var h = document.createElement('h3');
      var no = document.createElement('span');
      no.className = 'stage-no';
      no.textContent = 'Stage ' + (i + 1);
      h.append(no, document.createTextNode(stage.title));
      var note = document.createElement('p');
      note.textContent = stage.note || '';
      var names = document.createElement('p');
      names.className = 'stage-trophies';
      var count = document.createElement('b');
      count.textContent = stage.trophies.length + ' trophies: ';
      names.append(count);
      names.append(document.createTextNode(stage.trophies.map(function (id) {
        var t = byId[id];
        return t ? t.name : ('#' + id);
      }).join(' · ')));
      li.append(h, note, names);
      ol.append(li);
    });
    document.getElementById('roadmap-note').textContent = roadmap.note || '';
  }

  function visible(t) {
    var q = searchEl.value.trim().toLowerCase();
    if (q && (t.name + ' ' + (t.description || '')).toLowerCase().indexOf(q) === -1) return false;
    var kind = kindEl.value;
    if (kind === 'missable') { if (!isMissable(t)) return false; }
    else if (kind !== 'all' && kindOf(t) !== kind) return false;
    if (gradeEl.value !== 'all' && t.grade !== gradeEl.value) return false;
    if (statusEl.value === 'earned' && !earned.has(t.id)) return false;
    if (statusEl.value === 'missing' && earned.has(t.id)) return false;
    return true;
  }

  function spoilerHidden(t) {
    return spoilerOn && kindOf(t) === 'story' && !earned.has(t.id);
  }

  function renderList() {
    listEl.replaceChildren();
    var shown = 0;
    trophies.forEach(function (t) {
      if (!visible(t)) return;
      shown++;
      var card = document.createElement('article');
      card.className = 'card' + (earned.has(t.id) ? ' earned' : '');
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', 'Guide for ' + t.name);

      var top = document.createElement('div');
      top.className = 'card-top';
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = earned.has(t.id);
      box.setAttribute('aria-label', 'Mark ' + t.name + ' earned');
      box.addEventListener('click', function (e) { e.stopPropagation(); });
      box.addEventListener('change', function () {
        if (box.checked) earned.add(t.id); else earned.delete(t.id);
        saveEarned();
        renderProgress();
        renderList();
      });
      var title = document.createElement('h3');
      if (spoilerHidden(t)) {
        title.textContent = 'Hidden story trophy';
        title.className = 'spoiled';
      } else {
        title.textContent = t.name;
      }
      top.append(box, title);

      var desc = document.createElement('p');
      desc.className = 'desc';
      desc.textContent = spoilerHidden(t)
        ? 'Story trophy — hidden until earned (spoiler setting is on).'
        : (t.description || '');

      var meta = document.createElement('div');
      meta.className = 'meta';
      var gradeTag = document.createElement('span');
      gradeTag.className = 'tag ' + t.grade;
      gradeTag.textContent = gradeLabel(t.grade);
      meta.append(gradeTag);
      var kindTag = document.createElement('span');
      kindTag.className = 'tag kind';
      kindTag.textContent = kindOf(t);
      meta.append(kindTag);
      if (isMissable(t)) {
        var m = document.createElement('span');
        m.className = 'tag missable';
        m.textContent = 'Missable';
        meta.append(m);
      }
      if (earned.has(t.id)) {
        var e = document.createElement('span');
        e.className = 'tag earned-tag';
        e.textContent = 'Earned ✓';
        meta.append(e);
      }
      card.append(top, desc, meta);
      card.addEventListener('click', function () { openDetail(t); });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(t); }
      });
      listEl.append(card);
    });
    emptyEl.hidden = shown !== 0;
    document.getElementById('shown-count').textContent =
      'Showing ' + shown + ' of ' + trophies.length + ' trophies.';
  }

  // Sources: the data file may carry a source as a name, a {name, url} pair, or a
  // list of either — show each, as a link only where a URL is given. No source
  // yet shows no source line at all.
  function sourceEntries(t) {
    var raw = t.sources || t.source;
    if (!raw) return [];
    var list = Array.isArray(raw) ? raw : [raw];
    return list.map(function (s) {
      if (typeof s === 'string') return { name: s, url: '' };
      return { name: s.name || s.title || 'Source', url: s.url || s.href || '' };
    }).filter(function (s) { return s.name; });
  }

  function openDetail(t) {
    detailBody.replaceChildren();
    var h = document.createElement('h2');
    h.textContent = spoilerHidden(t) ? 'Hidden story trophy' : t.name;
    var meta = document.createElement('div');
    meta.className = 'meta';
    var gradeTag = document.createElement('span');
    gradeTag.className = 'tag ' + t.grade;
    gradeTag.textContent = gradeLabel(t.grade);
    meta.append(gradeTag);
    var kindTag = document.createElement('span');
    kindTag.className = 'tag kind';
    kindTag.textContent = kindOf(t);
    meta.append(kindTag);
    if (isMissable(t)) {
      var m = document.createElement('span');
      m.className = 'tag missable';
      m.textContent = 'Missable';
      meta.append(m);
    }
    detailBody.append(h, meta);

    var official = document.createElement('p');
    official.className = 'official';
    var offLabel = document.createElement('span');
    offLabel.className = 'label';
    offLabel.textContent = 'Official description';
    official.append(offLabel);
    official.append(document.createTextNode(spoilerHidden(t) ? 'Hidden until earned.' : (t.description || '')));
    detailBody.append(official);

    if (isMissable(t) && missableReason(t)) {
      var note = document.createElement('p');
      note.className = 'missable-note';
      var strong = document.createElement('strong');
      strong.textContent = 'Missable — ';
      note.append(strong, document.createTextNode(missableReason(t)));
      detailBody.append(note);
    }

    var guide = document.createElement('div');
    guide.className = 'guide';
    var gLabel = document.createElement('span');
    gLabel.className = 'label';
    gLabel.textContent = 'Guide';
    var gText = document.createElement('p');
    gText.textContent = t.guide || 'No guide written yet.';
    guide.append(gLabel, gText);
    detailBody.append(guide);

    var sources = sourceEntries(t);
    if (sources.length) {
      var sWrap = document.createElement('div');
      sWrap.className = 'sources';
      var sLabel = document.createElement('span');
      sLabel.className = 'label';
      sLabel.textContent = 'Sources';
      var ul = document.createElement('ul');
      sources.forEach(function (s) {
        var li = document.createElement('li');
        if (s.url) {
          var a = document.createElement('a');
          a.href = s.url;
          a.textContent = s.name;
          a.target = '_blank';
          a.rel = 'noopener';
          li.append(a);
        } else {
          li.textContent = s.name;
        }
        ul.append(li);
      });
      sWrap.append(sLabel, ul);
      detailBody.append(sWrap);
    }
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }

  function exportProgress() {
    var data = { version: 1, earned: Array.from(earned).sort(function (a, b) { return a - b; }), spoiler: spoilerOn };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gta6-trophy-progress.json';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    statusMsg.textContent = 'Progress exported (' + earned.size + ' earned).';
  }

  function importProgress(file) {
    if (!file) return;
    file.text().then(function (text) {
      var parsed;
      try { parsed = JSON.parse(text); } catch (e) { statusMsg.textContent = 'That file is not valid JSON.'; return; }
      var ids = [];
      var raw = Array.isArray(parsed) ? parsed : parsed.earned;
      if (!Array.isArray(raw)) { statusMsg.textContent = 'That file holds no progress to import.'; return; }
      raw.forEach(function (v) {
        var n = Number(v);
        if (Number.isInteger(n) && byId[n]) ids.push(n);
        else if (typeof v === 'string') {
          var found = trophies.find(function (t) { return t.name === v; });
          if (found) ids.push(found.id);
        }
      });
      earned = new Set(ids);
      saveEarned();
      if (typeof parsed.spoiler === 'boolean') {
        spoilerOn = parsed.spoiler;
        spoilerEl.checked = spoilerOn;
        saveSpoiler();
      }
      renderProgress();
      renderList();
      statusMsg.textContent = 'Imported progress: ' + earned.size + ' trophies earned.';
    }).catch(function () { statusMsg.textContent = 'Could not read that file.'; });
  }

  function renderAll() { renderProgress(); renderRoadmap(); renderList(); }

  document.getElementById('export').addEventListener('click', exportProgress);
  document.getElementById('import').addEventListener('change', function (e) {
    importProgress(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('reset').addEventListener('click', function () {
    if (!earned.size) { statusMsg.textContent = 'Nothing to reset.'; return; }
    if (window.confirm('Clear all earned trophies?')) {
      earned = new Set();
      saveEarned();
      renderProgress();
      renderList();
      statusMsg.textContent = 'Progress cleared.';
    }
  });
  searchEl.addEventListener('input', renderList);
  kindEl.addEventListener('change', renderList);
  gradeEl.addEventListener('change', renderList);
  statusEl.addEventListener('change', renderList);
  spoilerEl.addEventListener('change', function () {
    spoilerOn = spoilerEl.checked;
    saveSpoiler();
    renderList();
  });

  loadEarned();
  loadSpoiler();
  Promise.all([
    fetch('data/trophies.json').then(function (r) { return r.json(); }),
    fetch('data/roadmap.json').then(function (r) { return r.json(); })
  ]).then(function (docs) {
    var tdoc = docs[0];
    trophies = tdoc.trophies || tdoc;
    trophies.forEach(function (t) { byId[t.id] = t; });
    roadmap = docs[1];
    (roadmap.missable || []).forEach(function (m) { missableById[m.id] = m; });
    renderAll();
  }).catch(function () {
    listEl.replaceChildren();
    emptyEl.hidden = false;
    emptyEl.textContent = 'Could not load the trophy data.';
  });
})();
