(function () {
  var S = window.AdoptionSim, C = S.CONFIG;
  var results = { baseline: S.simulate('baseline'), improved: S.simulate('improved') };
  var scenario = 'baseline';
  var $ = function (id) { return document.getElementById(id); };
  var NS = 'http://www.w3.org/2000/svg';
  var pct = function (p) { return p < 0.005 ? '<1%' : Math.round(p * 100) + '%'; };
  var r0 = function (x) { return Math.round(x); };

  // Stable y-axis across scenarios so the change is visible.
  var peak = Math.max(C.goal, results.baseline.weeks[1].p90, results.improved.weeks[1].p90);
  var Y_MIN = 40, Y_MAX = Math.ceil((peak + 6) / 20) * 20;

  function series(res) {
    var pts = C.history.map(function (h) { return { week: h.week, actual: h.active }; });
    var proj = [{ week: 2, p10: 80, p50: 80, p90: 80 }].concat(res.weeks);
    return { actual: pts, proj: proj };
  }

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function drawChart() {
    var host = $('chart'), W = Math.max(280, host.clientWidth), small = W < 520;
    var big = W >= 760, H = big ? Math.round(Math.min(560, W * 0.46)) : (small ? 300 : 360);
    var m = { t: 24, r: small ? 16 : 36, b: big ? 40 : 34, l: big ? 52 : 40 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var x = function (w) { return m.l + (w - 1) / 3 * iw; };
    var y = function (v) { return m.t + (1 - (v - Y_MIN) / (Y_MAX - Y_MIN)) * ih; };

    host.innerHTML = '';
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
      'aria-label': 'Line chart of weekly active users for weeks 1 to 4 with projection, 80 percent interval and goal of 120.' }, host);

    for (var v = Y_MIN; v <= Y_MAX; v += 20) {
      el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: '#e6eaf2', 'stroke-width': 1 }, svg);
      el('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, svg).textContent = v;
    }
    for (var w = 1; w <= 4; w++) {
      el('text', { x: x(w), y: H - 12, 'text-anchor': w === 1 ? 'start' : (w === 4 ? 'end' : 'middle') }, svg).textContent = 'Week ' + w;
    }

    // goal line
    el('line', { x1: m.l, x2: W - m.r, y1: y(C.goal), y2: y(C.goal), stroke: '#12234a', 'stroke-width': 2, 'stroke-dasharray': '6 5' }, svg);
    el('text', { x: m.l + 6, y: y(C.goal) - 10, class: 'lbl-strong' }, svg).textContent = 'Goal: 120';

    var cur = series(results[scenario]);

    // interval band
    var up = cur.proj.map(function (p) { return x(p.week) + ',' + y(p.p90); });
    var dn = cur.proj.slice().reverse().map(function (p) { return x(p.week) + ',' + y(p.p10); });
    el('polygon', { points: up.concat(dn).join(' '), fill: 'rgba(10,127,140,0.16)' }, svg);

    // ghost baseline when improved
    if (scenario === 'improved') {
      var g = series(results.baseline).proj;
      el('polyline', { points: g.map(function (p) { return x(p.week) + ',' + y(p.p50); }).join(' '), fill: 'none',
        stroke: '#9aa5bd', 'stroke-width': 2, 'stroke-dasharray': '4 4' }, svg);
      var gl = g[g.length - 1];
      el('text', { x: x(4) - 8, y: y(gl.p50) + 18, 'text-anchor': 'end' }, svg).textContent = 'Baseline ' + r0(gl.p50);
    }

    // projection (median) and actual
    el('polyline', { points: cur.proj.map(function (p) { return x(p.week) + ',' + y(p.p50); }).join(' '), fill: 'none',
      stroke: '#0a7f8c', 'stroke-width': 3, 'stroke-dasharray': '7 5', 'stroke-linecap': 'round' }, svg);
    el('polyline', { points: cur.actual.map(function (p) { return x(p.week) + ',' + y(p.actual); }).join(' '), fill: 'none',
      stroke: '#12234a', 'stroke-width': 3, 'stroke-linejoin': 'round' }, svg);

    cur.actual.forEach(function (p) {
      el('circle', { cx: x(p.week), cy: y(p.actual), r: big ? 6 : 5, fill: '#12234a', stroke: '#fff', 'stroke-width': 2 }, svg);
    });
    cur.proj.slice(1).forEach(function (p) {
      el('circle', { cx: x(p.week), cy: y(p.p50), r: big ? 6 : 5, fill: '#fff', stroke: '#0a7f8c', 'stroke-width': 3 }, svg);
    });
    var last = cur.proj[2];
    el('text', { x: x(4), y: y(last.p90) - 8, 'text-anchor': 'end', class: 'lbl-accent' }, svg)
      .textContent = r0(last.p50) + '  (' + r0(last.p10) + '–' + r0(last.p90) + ')';
    el('text', { x: x(2) - 4, y: y(80) - 12, 'text-anchor': 'end', class: 'lbl-strong' }, svg).textContent = 'Actual 80';

    // hover layer
    var guide = el('line', { y1: m.t, y2: m.t + ih, stroke: '#12234a', 'stroke-width': 1, opacity: 0 }, svg);
    var hit = el('rect', { x: m.l - 10, y: m.t, width: iw + 20, height: ih, fill: 'transparent' }, svg);
    var tip = $('tip');
    function show(ev) {
      var rect = svg.getBoundingClientRect();
      var px = (ev.clientX - rect.left) * (W / rect.width);
      var wk = Math.min(4, Math.max(1, Math.round(1 + (px - m.l) / iw * 3)));
      guide.setAttribute('x1', x(wk)); guide.setAttribute('x2', x(wk)); guide.setAttribute('opacity', 0.35);
      var a = cur.actual.filter(function (p) { return p.week === wk; })[0];
      var p = cur.proj.filter(function (q) { return q.week === wk; })[0];
      tip.innerHTML = '<b>Week ' + wk + '</b><br>' + (wk <= 2
        ? 'Actual: ' + a.actual + ' active'
        : 'Projected: ' + r0(p.p50) + ' active<br>80% range: ' + r0(p.p10) + '–' + r0(p.p90));
      tip.hidden = false;
      var hr = host.getBoundingClientRect(), pr = tip.offsetParent.getBoundingClientRect();
      var left = (hr.left - pr.left) + x(wk) * (rect.width / W) + 12;
      if (left + tip.offsetWidth > pr.width - 8) left -= tip.offsetWidth + 24;
      tip.style.left = Math.max(8, left) + 'px';
      tip.style.top = (hr.top - pr.top + 12) + 'px';
    }
    function hide() { guide.setAttribute('opacity', 0); tip.hidden = true; }
    hit.addEventListener('pointermove', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', hide);
  }

  function update() {
    var res = results[scenario], base = results.baseline;
    var wk4 = res.weeks[1], proj = r0(wk4.p50), gap = C.goal - proj;
    $('k-proj').textContent = proj;
    $('k-proj-sub').textContent = '80% range ' + r0(wk4.p10) + '–' + r0(wk4.p90);
    $('k-gap').textContent = Math.abs(gap);
    $('k-gap-sub').textContent = gap > 0 ? 'users short of goal (median)' : 'users ahead of goal (median)';
    $('k-prob').textContent = pct(res.probability);

    $('assump').innerHTML = 'Weekly retention assumed: <strong>' + Math.round(res.retention * 100) + '%</strong>' +
      (scenario === 'improved' ? ' (baseline ' + Math.round(base.retention * 100) + '%). Everything else is unchanged.' : '. Activation and reactivation held fixed.');

    var t;
    if (scenario === 'baseline') {
      t = 'At today’s repeat use, about ' + Math.round(base.retention * 100) + '% of active people return each week, so new users are largely offset by drop-off. We project ' + proj + ' active users in week four, ' + gap + ' short of 120, with a ' + pct(base.probability) + ' chance of hitting the goal.';
    } else {
      var bp = r0(base.weeks[1].p50), bg = C.goal - bp;
      t = 'Raising weekly retention from ' + Math.round(base.retention * 100) + '% to ' + Math.round(res.retention * 100) + '%, and nothing else, lifts the week-four projection from ' + bp + ' to ' + proj + ', cuts the gap from ' + bg + ' to ' + (gap > 0 ? gap : 0) + ', and moves the chance from ' + pct(base.probability) + ' to ' + pct(res.probability) + '. For the rollout: repeat-use support (habit nudges, in-workflow prompts) is the lever to test, but under these assumptions it improves the odds without making the goal likely.';
    }
    $('takeaway').textContent = t;

    $('btn-baseline').setAttribute('aria-pressed', scenario === 'baseline');
    $('btn-improved').setAttribute('aria-pressed', scenario === 'improved');
    $('leg-base').hidden = scenario !== 'improved';

    var rows = '<tr><th>Week</th><th>Type</th><th>Median</th><th>80% low</th><th>80% high</th></tr>';
    C.history.forEach(function (h) { rows += '<tr><td>' + h.week + '</td><td>Actual</td><td>' + h.active + '</td><td>–</td><td>–</td></tr>'; });
    res.weeks.forEach(function (w) { rows += '<tr><td>' + w.week + '</td><td>Projected</td><td>' + r0(w.p50) + '</td><td>' + r0(w.p10) + '</td><td>' + r0(w.p90) + '</td></tr>'; });
    $('data-table').innerHTML = rows;

    drawChart();
  }

  $('btn-baseline').addEventListener('click', function () { scenario = 'baseline'; update(); });
  $('btn-improved').addEventListener('click', function () { scenario = 'improved'; update(); });
  var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(drawChart, 80); });
  update();
})();
