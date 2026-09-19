/**
 * frics-market.js — the FRICS™ marketplace interface (renders from window.FRICS_MARKET).
 *
 *   Project discovery → project information → credit inventory → buyer journey → acquisition →
 *   allocation → impact / retirement.
 *
 * Mount points (all optional, all in index.html):
 *   [data-mk]         listings, filters, project detail, purchase panel
 *   [data-mk-wyg]     "Where your FRICS goes" pathway
 *   [data-mk-port]    MY FRICS portfolio
 *   [data-mk-life]    lifecycle rail + registry
 *
 * State is in-memory only. The purchase panel walks the acquisition path for the visitor; it does
 * not execute a transaction. Prices, inventory and registry records arrive through
 * FRICS_MARKET.update() and re-render everything (event: frics:market-update).
 */
(function () {
  'use strict';
  var M = window.FRICS_MARKET, F = M && M.format;
  if (!M) return;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var S = {
    theme: 'all', impact: 'all', status: 'all', basis: 'all', avail: 'all',
    open: null,                                       // project id shown in detail, null → listings
    qty: 1000, acq: null,                             // acq: { p, q } once the visitor completes the path
    sold: {},                                         // session-only inventory taken by acquisitions
    holdings: [{ p: 'water', q: 600 }, { p: 'crop', q: 400 }],
    wyg: 'water'
  };

  /* ── stroke icons, one per theme ── */
  var IC = {
    water: '<path d="M12 3c2.5 3.4 6 6.6 6 10.2A6 6 0 0 1 6 13.2C6 9.6 9.5 6.4 12 3z"/>',
    soil: '<path d="M3 8c3-2 6 2 9 0s6 2 9 0M3 13c3-2 6 2 9 0s6 2 9 0M3 18c3-2 6 2 9 0s6 2 9 0"/>',
    crop: '<path d="M12 21V11M12 11c0-4-3-6-7-6 0 4 3 6 7 6zM12 14c0-3 2.5-5 6-5 0 3-2.5 5-6 5z"/>',
    livelihood: '<path d="M4 20l3-9h10l3 9M9 11l1-6h4l1 6M8 15.5h8"/>',
    food: '<circle cx="5" cy="12" r="2.4"/><circle cx="12" cy="12" r="2.4"/><circle cx="19" cy="12" r="2.4"/><path d="M7.4 12h2.2M14.4 12h2.2"/>',
    eco: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-14 14zM5 19c3-4 6-7 10-10"/>'
  };
  var icon = function (id) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[id] || '') + '</svg>'; };

  var left = function (p) { return Math.max(0, p.inventory - (S.sold[p.id] || 0)); };
  var statusLabel = function (p) { return p.status === 'available' ? 'Available' : 'Opening'; };

  /* ── filters ── */
  function visible() {
    return M.projects.filter(function (p) {
      if (S.theme !== 'all' && p.theme !== S.theme) return false;
      if (S.impact !== 'all' && p.impactTypes.indexOf(S.impact) < 0) return false;
      if (S.status !== 'all' && p.status !== S.status) return false;
      if (S.basis !== 'all' && p.priceBasis !== S.basis) return false;
      if (S.avail !== 'all' && left(p) < +S.avail) return false;
      return true;
    });
  }
  var filtered = function () { return S.theme !== 'all' || S.impact !== 'all' || S.status !== 'all' || S.basis !== 'all' || S.avail !== 'all'; };

  /* ── marketplace shell ── */
  function stats() {
    var ref = M.reference;
    return '<dl class="frx-mk-s">' +
      '<div><dt>Project types</dt><dd>' + String(M.projects.length).padStart(2, '0') + '</dd></div>' +
      '<div><dt>FRICS available</dt><dd>' + F.int(M.projects.reduce(function (s, p) { return s + (p.status === 'available' ? left(p) : 0); }, 0)) + '</dd></div>' +
      '<div><dt>FRICS price</dt><dd>' + (M.projects.every(function (p) { return F.priced(p.price); }) ? 'Per project' : F.price(null) + '<i> / FRICS</i>') + '</dd></div>' +
      '<div><dt>Market reference</dt><dd class="' + (ref ? '' : 'is-off') + '">' + (ref ? esc(ref.label) + ' · ' + F.price(ref.value) : 'Not connected') + '</dd></div>' +
      '</dl>';
  }

  function filters() {
    var themes = '<button type="button" data-theme="all" aria-pressed="' + (S.theme === 'all') + '">All themes</button>' + M.themes.map(function (t) {
      return '<button type="button" data-theme="' + t.id + '" aria-pressed="' + (S.theme === t.id) + '"><span class="frx-ic">' + icon(t.id) + '</span>' + t.short + '</button>';
    }).join('');
    var sel = function (key, label, opts) {
      return '<label class="frx-sel"><span>' + label + '</span><select data-f="' + key + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (S[key] === String(o[0]) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>';
    };
    return '<div class="frx-fl">' +
      '<div class="frx-chips-t" role="group" aria-label="Resilience theme">' + themes + '</div>' +
      '<div class="frx-fl-r">' +
        sel('impact', 'Impact type', [['all', 'All impact types']].concat(M.impactTypes.map(function (t) { return [t, t]; }))) +
        sel('status', 'Project status', [['all', 'All statuses'], ['available', 'Available'], ['opening', 'Opening']]) +
        sel('basis', 'Price basis', [['all', 'All bases']].concat(Object.keys(M.priceBases).map(function (k) { return [k, M.priceBases[k].name]; }))) +
        sel('avail', 'FRICS availability', [['all', 'Any'], ['10000', '10,000 or more'], ['15000', '15,000 or more'], ['20000', '20,000 or more']]) +
        '<button type="button" class="frx-reset" data-reset' + (filtered() ? '' : ' hidden') + '>Reset</button>' +
      '</div></div>';
  }

  function listing(p) {
    var t = M.theme(p.theme), on = p.status === 'available';
    return '<article class="frx-lst" data-id="' + p.id + '">' +
      '<div class="frx-lst-t"><span class="frx-ic">' + icon(p.theme) + '</span><span class="frx-theme">' + t.name + '</span><em class="frx-status is-' + p.status + '">' + statusLabel(p) + '</em></div>' +
      '<h4>' + esc(p.name) + '</h4>' +
      '<dl class="frx-lst-k"><div><dt>' + (on ? 'FRICS available' : 'FRICS planned') + '</dt><dd>' + F.int(left(p)) + '</dd></div>' +
      '<div><dt>Price</dt><dd>' + F.price(p.price) + '<i> / FRICS</i></dd></div></dl>' +
      '<div class="frx-lst-r"><small>Impact areas</small><span class="frx-tags">' + p.areas.map(function (a) { return '<b>' + esc(a) + '</b>'; }).join('') + '</span></div>' +
      '<div class="frx-lst-r"><small>Interventions</small><ul>' + p.interventions.map(function (i) { return '<li>' + esc(i.n) + '</li>'; }).join('') + '</ul></div>' +
      '<div class="frx-lst-a"><button type="button" class="frx-btn is-primary" data-explore>Explore project</button>' +
      '<button type="button" class="frx-btn" data-buy>' + (on ? 'Buy FRICS' : 'Register interest') + '</button></div>' +
      '</article>';
  }

  function grid() {
    var list = visible();
    return '<div class="frx-count"><span><b>' + list.length + '</b> of ' + M.projects.length + ' project types</span><span>FRICS are acquired against a listed project</span></div>' +
      (list.length ? '<div class="frx-lsts">' + list.map(listing).join('') + '</div>'
        : '<div class="frx-empty"><b>No project types match these filters.</b><button type="button" class="frx-btn" data-reset>Reset filters</button></div>');
  }

  /* ── project detail ── */
  function lifeRail(cur, compact) {
    var idx = M.lifecycle.map(function (s) { return s.id; }).indexOf(cur);
    return '<ol class="frx-life' + (compact ? ' is-compact' : '') + '">' + M.lifecycle.map(function (s, i) {
      return '<li class="' + (i < idx ? 'is-done ' : '') + (i === idx ? 'is-cur ' : '') + (s.gated ? 'is-gated' : '') + '"><span class="frx-life-n">' + String(i + 1).padStart(2, '0') + '</span><b>' + s.name + '</b>' + (compact ? '' : '<p>' + s.line + '</p><small>Recorded in · ' + s.field + '</small>') + '</li>';
    }).join('') + '</ol>';
  }

  function purchase(p) {
    var on = p.status === 'available', a = S.acq && S.acq.p === p.id;
    if (!on) {
      return '<div class="frx-pb"><div class="frx-pb-h"><b>Opening allocation</b><em class="frx-status is-opening">Opening</em></div>' +
        '<p class="frx-pb-p">FRICS for this project type open for acquisition once the project is listed with inventory and a price.</p>' +
        '<dl class="frx-pb-d"><div><dt>FRICS planned</dt><dd>' + F.int(left(p)) + '</dd></div><div><dt>Price basis</dt><dd>' + M.priceBases[p.priceBasis].name + '</dd></div></dl>' +
        '<a class="frx-btn is-primary is-block" href="#contact">Register interest</a></div>';
    }
    if (a) {
      return '<div class="frx-pb is-done"><div class="frx-pb-h"><b>Acquired</b><em class="frx-status is-acquired">Acquired</em></div>' +
        '<div class="frx-ok"><canvas class="frx-mini" data-mini width="104" height="104" aria-hidden="true"></canvas><div><b>' + F.int(S.acq.q) + ' FRICS</b><span>Allocated to ' + esc(p.name) + '</span></div></div>' +
        '<ol class="frx-pb-path"><li class="is-done">Acquired</li><li class="is-done">Allocated</li><li>Capital deployed</li><li>Impact monitored</li></ol>' +
        '<a class="frx-btn is-primary is-block" href="#frics-wyg">Where your FRICS goes</a>' +
        '<a class="frx-btn is-block" href="#frics-portfolio">View my FRICS</a>' +
        '<button type="button" class="frx-link" data-again>Buy more FRICS</button>' +
        '<p class="frx-fine">This view illustrates the acquisition path; no transaction is executed on this page. Eligible companies acquire FRICS through Climactix enterprise access — <a href="enterprise-onboarding.html">request access</a>.</p></div>';
    }
    var q = Math.min(S.qty, left(p));
    return '<div class="frx-pb"><div class="frx-pb-h"><b>Buy FRICS</b><em class="frx-status is-available">Available</em></div>' +
      '<dl class="frx-pb-d"><div><dt>FRICS available</dt><dd>' + F.int(left(p)) + '</dd></div><div><dt>FRICS price</dt><dd>' + F.price(p.price) + '<i> / FRICS</i></dd></div>' +
      '<div><dt>Price basis</dt><dd>' + M.priceBases[p.priceBasis].name + '</dd></div></dl>' +
      '<label class="frx-ql" for="frx-qty">Quantity</label>' +
      '<div class="frx-qty"><button type="button" data-step="-100" aria-label="Decrease quantity">−</button>' +
      '<input id="frx-qty" type="text" inputmode="numeric" autocomplete="off" value="' + F.int(q) + '" data-qty aria-describedby="frx-qmsg"><span>FRICS</span>' +
      '<button type="button" data-step="100" aria-label="Increase quantity">+</button></div>' +
      '<div class="frx-presets" role="group" aria-label="Quantity presets">' + [500, 1000, 5000].map(function (n) { return '<button type="button" data-preset="' + n + '">' + F.int(n) + '</button>'; }).join('') + '</div>' +
      '<p class="frx-qmsg" id="frx-qmsg" data-qmsg aria-live="polite"></p>' +
      '<div class="frx-formula" data-formula>' + formula(p, q) + '</div>' +
      '<div class="frx-total"><small>Total value</small><b data-total>' + F.total(q, p.price) + '</b></div>' +
      '<button type="button" class="frx-btn is-primary is-block" data-acquire>Buy FRICS</button>' +
      '<p class="frx-fine">Open to eligible companies. No Green Rating is required.</p></div>';
  }
  function formula(p, q) { return '<span>' + F.int(q) + '</span> FRICS <i>×</i> <span>' + F.price(p.price) + '</span> / FRICS'; }

  function detail(p) {
    var t = M.theme(p.theme), st = M.stage(p.stage);
    return '<div class="frx-dt">' +
      '<button type="button" class="frx-back" data-back>← All projects</button>' +
      '<div class="frx-dt-g"><div class="frx-dt-m">' +
        '<header class="frx-dt-h"><div class="frx-lst-t"><span class="frx-ic">' + icon(p.theme) + '</span><span class="frx-theme">' + t.name + '</span><em class="frx-status is-' + p.status + '">' + statusLabel(p) + '</em></div>' +
        '<h3>' + esc(p.name) + '</h3><p class="frx-dt-s">Lifecycle stage · <b>' + st.name + '</b></p><a class="frx-jump" href="#frx-buy" data-jump>' + (p.status === 'available' ? 'Buy FRICS' : 'Opening allocation') + ' ↓</a></header>' +

        sec('Project objective', '<p class="frx-obj">' + esc(p.objective) + '</p>') +
        sec('Interventions', '<ul class="frx-iv">' + p.interventions.map(function (i) { return '<li><b>' + esc(i.n) + '</b><span>' + esc(i.d) + '</span></li>'; }).join('') + '</ul>') +
        sec('Impact areas', '<span class="frx-tags">' + p.areas.map(function (a) { return '<b>' + esc(a) + '</b>'; }).join('') + '</span><p class="frx-sub2">Impact types · ' + p.impactTypes.join(' · ') + '</p>') +
        sec('Impact metrics', '<table class="frx-tb"><thead><tr><th>Indicator</th><th>Unit</th><th>Reported value</th></tr></thead><tbody>' +
          p.metrics.map(function (m) { return '<tr><td>' + esc(m.n) + '</td><td>' + esc(m.u) + '</td><td class="is-off">—</td></tr>'; }).join('') +
          '</tbody></table><p class="frx-sub2">Values are reported from project monitoring records once the project is deployed.</p>') +
        sec('Fund allocation', '<div class="frx-fund" role="img" aria-label="Capital is structured across field implementation, monitoring and measurement, and programme delivery">' +
          M.fundStructure.map(function (f) { return '<i></i>'; }).join('') + '</div><ul class="frx-fund-l">' +
          M.fundStructure.map(function (f) { return '<li><b>' + f.name + '</b><span>' + f.line + '</span></li>'; }).join('') + '</ul><p class="frx-sub2">Shares are set per project at listing.</p>') +
        sec('Integrity layer', '<ul class="frx-int">' + M.integrity.map(function (d) { return '<li><div><b>' + d.name + '</b><span>' + d.line + '</span></div><em>Pending</em></li>'; }).join('') + '</ul>' +
          '<p class="frx-sub2">Each record is attached to the project page as it is produced. Nothing is marked verified, certified or audited until that evidence exists.</p>') +
        sec('FRICS lifecycle', lifeRail(p.stage, true)) +
      '</div><aside class="frx-dt-b" id="frx-buy">' + purchase(p) + '</aside></div></div>';
  }
  function sec(h, body) { return '<section class="frx-dt-sec"><h5>' + h + '</h5>' + body + '</section>'; }

  /* ── render: marketplace ── */
  var mk;
  function render() {
    if (!mk) return;
    var p = S.open && M.byId(S.open);
    mk.innerHTML = '<div class="frx-mk-top">' + stats() + '</div>' + (p ? detail(p) : filters() + grid());
    paintMinis();
    renderWyg(); renderPort(); renderLife();
  }

  /* the mini coin is the same artwork as the 3D coin's face */
  var artLoading = false;
  function paintMinis() {
    var cs = $$('[data-mini]');
    if (!cs.length) return;
    function draw() {
      cs.forEach(function (c) { var g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.drawImage(window.FRICSArt.sprite('front', 208), 0, 0, c.width, c.height); });
    }
    if (window.FRICSArt) { window.FRICSArt.loadLogo().then(draw); return; }
    if (artLoading) return; artLoading = true;
    var s = document.createElement('script'); s.src = 'frics-art.js'; s.onload = function () { artLoading = false; paintMinis(); }; document.body.appendChild(s);
  }

  /* ── "Where your FRICS goes" ── */
  function renderWyg() {
    var el = $('[data-mk-wyg]'); if (!el) return;
    var p = M.byId(S.wyg) || M.projects[0], q = S.acq ? S.acq.q : S.qty, t = M.theme(p.theme);
    var nodes = [
      { k: 'Your purchase', st: 'Acquired', b: F.int(q) + ' FRICS', s: F.int(q) + ' × ' + F.price(p.price) + ' = ' + F.total(q, p.price) },
      { k: 'FRICS allocation', st: 'Allocated', b: 'Allocated to project', s: 'Recorded against your holding in the registry' },
      { k: 'Resilience project', st: t.name, b: p.name, s: p.focus },
      { k: 'Implementation', st: 'Capital deployed', b: p.interventions.length + ' interventions', s: p.interventions.map(function (i) { return i.n; }).join(' · ') },
      { k: 'Impact', st: 'Impact monitored', b: 'Measured against a baseline', s: p.metrics.slice(0, 3).map(function (m) { return m.n; }).join(' · ') },
      { k: 'Food-chain resilience', st: 'Downstream', b: 'Farm to consumer', s: 'Farmer · Farm · Food · Supply chain · Company · Consumer' }
    ];
    el.innerHTML =
      '<div class="frx-wyg-h"><div class="frx-wyg-q"><canvas class="frx-mini" data-mini width="104" height="104" aria-hidden="true"></canvas><div><small>Your FRICS</small><b>' + F.int(q) + '</b></div></div>' +
      '<label class="frx-sel"><span>Project</span><select data-wyg-p>' + M.projects.map(function (x) { return '<option value="' + x.id + '"' + (x.id === p.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></label></div>' +
      '<ol class="frx-wyg-l">' + nodes.map(function (n, i) {
        return '<li style="--i:' + i + '"><span class="frx-wyg-n">' + String(i + 1).padStart(2, '0') + '</span><small>' + n.k + '</small><b>' + esc(n.b) + '</b><p>' + esc(n.s) + '</p><em>' + esc(n.st) + '</em></li>';
      }).join('') + '</ol>' +
      '<p class="frx-wyg-f">From purchase to impact, every step is a record — acquisition, allocation, deployment, monitoring, verification and retirement — held against the FRICS you own.</p>';
    paintMinis();
  }

  /* ── MY FRICS ── */
  function renderPort() {
    var el = $('[data-mk-port]'); if (!el) return;
    var held = S.holdings.reduce(function (s, h) { return s + h.q; }, 0), areas = [];
    S.holdings.forEach(function (h) { var p = M.byId(h.p); ['Water', 'Soil', 'Crop', 'Livelihood', 'Food security', 'Supply chain', 'Ecology'].forEach(function (a) { if (p.areas.indexOf(a) >= 0 && areas.indexOf(a) < 0) areas.push(a); }); });
    areas = areas.map(function (a) { return a === 'Food security' ? 'Food' : a; }).filter(function (a) { return a !== 'Supply chain'; });
    el.innerHTML =
      '<div class="frx-port-k"><div class="frx-port-t"><b>My FRICS</b><span>Company impact-credit portfolio</span></div>' +
      '<dl><div><dt>FRICS held</dt><dd>' + F.int(held) + '</dd></div><div><dt>FRICS allocated</dt><dd>' + F.int(held) + '</dd></div><div><dt>Projects</dt><dd>' + String(S.holdings.length).padStart(2, '0') + '</dd></div></dl>' +
      '<div class="frx-port-a"><small>Impact areas</small><span class="frx-tags">' + areas.map(function (a) { return '<b>' + a + '</b>'; }).join('') + '</span></div></div>' +
      '<div class="frx-port-h"><table class="frx-tb"><thead><tr><th>Project</th><th>Theme</th><th class="is-n">FRICS</th><th>Status</th></tr></thead><tbody>' +
      S.holdings.map(function (h) { var p = M.byId(h.p); return '<tr><td>' + esc(p.name) + '</td><td>' + M.theme(p.theme).name + '</td><td class="is-n">' + F.int(h.q) + '</td><td><em class="frx-status is-acquired">Allocated</em></td></tr>'; }).join('') +
      '</tbody></table><p class="frx-sub2">An institutional impact-credit portfolio — not a wallet. Holdings are recorded against registry batches once FRICS are issued.</p></div>';
  }

  /* ── lifecycle + registry ── */
  function renderLife() {
    var el = $('[data-mk-life]'); if (!el) return;
    var R = M.registry, rows = R.batches.length ? R.batches.map(function (b) {
      return '<tr>' + ['batch', 'project', 'quantity', 'price', 'issued', 'owner', 'allocation', 'status', 'impact', 'verification', 'retirement'].map(function (k) { return '<td>' + (b[k] == null ? '—' : esc(b[k])) + '</td>'; }).join('') + '</tr>';
    }).join('') : '<tr class="frx-reg-empty"><td colspan="' + R.fields.length + '"><b>No FRICS batches have been issued.</b> Batch identifiers (' + R.idFormat + ') are assigned at issuance and appear here with their allocation, impact, verification and retirement records.</td></tr>';
    el.innerHTML =
      lifeRail('none', false) +
      '<div class="frx-reg"><div class="frx-reg-h"><div><b>FRICS Registry</b><span>Batch-level record of every FRICS</span></div><em>' + R.idFormat + '</em></div>' +
      '<div class="frx-reg-w"><table class="frx-tb"><thead><tr>' + R.fields.map(function (f) { return '<th title="' + esc(f.line) + '">' + f.name + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }

  /* ── actions ── */
  function open(id, focusBuy) {
    S.open = id; S.wyg = id; render();
    var t = $('#frics-marketplace'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (focusBuy) setTimeout(function () { var i = $('[data-qty]', mk); if (i) i.focus({ preventScroll: true }); }, 350);
  }
  function setQty(v) {
    var p = M.byId(S.open); if (!p) return;
    var n = parseInt(String(v).replace(/[^0-9]/g, ''), 10), max = left(p), msg = $('[data-qmsg]', mk);
    if (isNaN(n) || n < 1) { n = 1; if (msg) msg.textContent = 'Enter a quantity of at least 1 FRICS.'; }
    else if (n > max) { n = max; if (msg) msg.textContent = 'Maximum available: ' + F.int(max) + ' FRICS.'; }
    else if (msg) msg.textContent = '';
    S.qty = n; S.wyg = p.id;
    $('[data-formula]', mk).innerHTML = formula(p, n); $('[data-total]', mk).textContent = F.total(n, p.price);
    renderWyg();
    return n;
  }
  function acquire() {
    var p = M.byId(S.open), n = setQty(($('[data-qty]', mk) || {}).value); if (!p || !n) return;
    S.sold[p.id] = (S.sold[p.id] || 0) + n; S.acq = { p: p.id, q: n }; S.wyg = p.id;
    var h = S.holdings.filter(function (x) { return x.p === p.id; })[0]; if (h) h.q += n; else S.holdings.push({ p: p.id, q: n });
    S.qty = Math.min(1000, left(p)) || 1;
    render();
  }

  function bind() {
    mk.addEventListener('click', function (e) {
      var jm = e.target.closest('[data-jump]'); if (jm) { e.preventDefault(); var bp = $('#frx-buy'); if (bp) bp.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      var t = e.target.closest('button, [data-id]'); if (!t) return;
      var art = e.target.closest('[data-id]'), id = art && art.getAttribute('data-id');
      if (t.hasAttribute('data-explore')) return open(id);
      if (t.hasAttribute('data-buy')) return open(id, true);
      if (t.hasAttribute('data-back')) { S.open = null; S.acq = null; render(); return; }
      if (t.hasAttribute('data-theme')) { S.theme = t.getAttribute('data-theme'); return render(); }
      if (t.hasAttribute('data-reset')) { S.theme = S.impact = S.status = S.basis = S.avail = 'all'; return render(); }
      if (t.hasAttribute('data-step')) { var i = $('[data-qty]', mk); setQty((parseInt(String(i.value).replace(/[^0-9]/g, ''), 10) || 0) + (+t.getAttribute('data-step'))); i.value = F.int(S.qty); return; }
      if (t.hasAttribute('data-preset')) { var j = $('[data-qty]', mk); setQty(t.getAttribute('data-preset')); j.value = F.int(S.qty); return; }
      if (t.hasAttribute('data-acquire')) return acquire();
      if (t.hasAttribute('data-again')) { S.acq = null; return render(); }
    });
    mk.addEventListener('change', function (e) { var k = e.target.getAttribute('data-f'); if (k) { S[k] = e.target.value; render(); } });
    mk.addEventListener('input', function (e) {
      if (!e.target.hasAttribute('data-qty')) return;
      var raw = String(e.target.value).replace(/[^0-9]/g, '');
      if (raw === '') return;                                        // let the field be cleared while typing; focusout restores it
      var n = setQty(raw); if (n !== parseInt(raw, 10)) e.target.value = F.int(n);
    });
    mk.addEventListener('focusout', function (e) { if (e.target.hasAttribute('data-qty')) e.target.value = F.int(S.qty); });
    document.addEventListener('change', function (e) { if (e.target.hasAttribute('data-wyg-p')) { S.wyg = e.target.value; renderWyg(); } });
    $$('[data-frics-buy]').forEach(function (b) { b.addEventListener('click', function () { open(S.open && M.byId(S.open).status === 'available' ? S.open : 'water', true); }); });
    document.addEventListener('frics:market-update', render);
  }

  function boot() {
    mk = $('[data-mk]'); if (!mk) return;
    bind(); render();
    /* the pathway draws once when it scrolls into view */
    var w = $('[data-mk-wyg]');
    if (w && 'IntersectionObserver' in window) { var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { w.classList.add('is-in'); io.disconnect(); } }, { threshold: 0.25 }); io.observe(w); }
    else if (w) w.classList.add('is-in');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.FRICS_UI = { open: open, state: S, render: render };
})();
