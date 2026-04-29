/**
 * globe-gis.js — GIS intelligence layer for Climactix hero globe
 * Adds country boundaries, hover detection, and climate data tooltips.
 * Requires: THREE.js, topojson-client (loaded before this file)
 */

/* ── ISO numeric → country name ──────────────────────────────────── */
const GIS_COUNTRY_NAMES = {
  '4':'Afghanistan','8':'Albania','12':'Algeria','24':'Angola','32':'Argentina',
  '36':'Australia','40':'Austria','50':'Bangladesh','56':'Belgium','68':'Bolivia',
  '76':'Brazil','100':'Bulgaria','116':'Cambodia','120':'Cameroon','124':'Canada',
  '152':'Chile','156':'China','170':'Colombia','180':'Congo (DRC)','188':'Costa Rica',
  '191':'Croatia','204':'Benin','208':'Denmark','218':'Ecuador','818':'Egypt',
  '231':'Ethiopia','246':'Finland','250':'France','276':'Germany','288':'Ghana',
  '300':'Greece','320':'Guatemala','332':'Haiti','360':'Indonesia','364':'Iran',
  '368':'Iraq','372':'Ireland','376':'Israel','380':'Italy','388':'Jamaica',
  '392':'Japan','400':'Jordan','398':'Kazakhstan','404':'Kenya','410':'South Korea',
  '418':'Laos','422':'Lebanon','426':'Lesotho','430':'Liberia','434':'Libya',
  '454':'Malawi','458':'Malaysia','466':'Mali','484':'Mexico','504':'Morocco',
  '508':'Mozambique','516':'Namibia','524':'Nepal','528':'Netherlands','558':'Nicaragua',
  '562':'Niger','566':'Nigeria','578':'Norway','586':'Pakistan','591':'Panama',
  '604':'Peru','608':'Philippines','616':'Poland','620':'Portugal','630':'Puerto Rico',
  '646':'Rwanda','682':'Saudi Arabia','686':'Senegal','694':'Sierra Leone',
  '706':'Somalia','710':'South Africa','728':'South Sudan','724':'Spain',
  '144':'Sri Lanka','729':'Sudan','752':'Sweden','756':'Switzerland','760':'Syria',
  '764':'Thailand','768':'Togo','780':'Trinidad and Tobago','788':'Tunisia',
  '792':'Turkey','800':'Uganda','804':'Ukraine','784':'UAE','826':'United Kingdom',
  '840':'United States','858':'Uruguay','862':'Venezuela','704':'Vietnam',
  '887':'Yemen','894':'Zambia','716':'Zimbabwe',
};

/* ── Country climate intelligence data ──────────────────────────── */
/* co2: GtCO₂/yr (2022 est.)  risk: ND-GAIN style 0–10  projects: Climactix coverage */
const GIS_COUNTRY_DATA = {
  '4':  { co2:'0.01', risk:8.2, projects:1 },
  '12': { co2:'0.20', risk:6.8, projects:3 },
  '24': { co2:'0.09', risk:7.5, projects:2 },
  '32': { co2:'0.20', risk:4.2, projects:8 },
  '36': { co2:'0.41', risk:3.8, projects:14 },
  '40': { co2:'0.07', risk:2.6, projects:6 },
  '50': { co2:'0.09', risk:8.5, projects:3 },
  '56': { co2:'0.10', risk:2.4, projects:9 },
  '68': { co2:'0.02', risk:6.2, projects:2 },
  '76': { co2:'1.62', risk:5.5, projects:18 },
  '116':{ co2:'0.02', risk:7.8, projects:1 },
  '124':{ co2:'0.57', risk:3.1, projects:22 },
  '152':{ co2:'0.09', risk:4.8, projects:5 },
  '156':{ co2:'12.6', risk:5.8, projects:45 },
  '170':{ co2:'0.09', risk:5.9, projects:6 },
  '208':{ co2:'0.04', risk:2.2, projects:8 },
  '818':{ co2:'0.28', risk:7.0, projects:4 },
  '231':{ co2:'0.03', risk:7.9, projects:2 },
  '246':{ co2:'0.04', risk:2.0, projects:7 },
  '250':{ co2:'0.32', risk:2.9, projects:28 },
  '276':{ co2:'0.68', risk:2.8, projects:35 },
  '288':{ co2:'0.03', risk:7.2, projects:2 },
  '300':{ co2:'0.07', risk:4.5, projects:5 },
  '360':{ co2:'0.73', risk:7.2, projects:9 },
  '364':{ co2:'0.75', risk:7.5, projects:3 },
  '380':{ co2:'0.35', risk:3.4, projects:18 },
  '392':{ co2:'1.07', risk:3.5, projects:32 },
  '404':{ co2:'0.02', risk:7.8, projects:3 },
  '410':{ co2:'0.62', risk:3.2, projects:20 },
  '484':{ co2:'0.44', risk:5.2, projects:14 },
  '504':{ co2:'0.07', risk:6.4, projects:4 },
  '508':{ co2:'0.02', risk:7.9, projects:2 },
  '528':{ co2:'0.15', risk:2.3, projects:12 },
  '566':{ co2:'0.12', risk:7.5, projects:5 },
  '578':{ co2:'0.04', risk:1.9, projects:10 },
  '586':{ co2:'0.23', risk:7.8, projects:4 },
  '604':{ co2:'0.05', risk:5.8, projects:3 },
  '608':{ co2:'0.14', risk:8.1, projects:6 },
  '616':{ co2:'0.33', risk:3.8, projects:10 },
  '620':{ co2:'0.05', risk:3.6, projects:7 },
  '682':{ co2:'0.74', risk:5.8, projects:6 },
  '686':{ co2:'0.01', risk:7.6, projects:1 },
  '710':{ co2:'0.45', risk:6.2, projects:8 },
  '724':{ co2:'0.25', risk:4.1, projects:20 },
  '144':{ co2:'0.03', risk:6.5, projects:2 },
  '752':{ co2:'0.04', risk:1.9, projects:11 },
  '756':{ co2:'0.04', risk:2.1, projects:9 },
  '764':{ co2:'0.35', risk:6.8, projects:8 },
  '792':{ co2:'0.48', risk:5.8, projects:7 },
  '800':{ co2:'0.01', risk:7.9, projects:1 },
  '804':{ co2:'0.20', risk:6.9, projects:4 },
  '784':{ co2:'0.24', risk:5.0, projects:5 },
  '826':{ co2:'0.33', risk:2.5, projects:38 },
  '840':{ co2:'4.97', risk:3.2, projects:72 },
  '858':{ co2:'0.03', risk:4.0, projects:3 },
  '704':{ co2:'0.38', risk:7.0, projects:7 },
  '887':{ co2:'0.01', risk:9.1, projects:1 },
  /* India — added explicitly */
  '356':{ co2:'2.61', risk:6.8, projects:24 },
  '643':{ co2:'1.69', risk:5.5, projects:12 },
};
GIS_COUNTRY_NAMES['356'] = 'India';
GIS_COUNTRY_NAMES['643'] = 'Russia';

/* ── Minimal point-in-polygon (ray casting) ─────────────────────── */
function _pip(lat, lng, ring) {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [la_i, ln_i] = ring[i];
    const [la_j, ln_j] = ring[j];
    if (((ln_i > lng) !== (ln_j > lng)) &&
        (lat < (la_j - la_i) * (lng - ln_i) / (ln_j - ln_i) + la_i)) {
      inside = !inside;
    }
  }
  return inside;
}

/* ── Main enhancement function ──────────────────────────────────── */
window.enhanceGlobeGIS = function(opts) {
  /*
   * opts: { earth, llv, camera, canvas, wrap, worldData, THREE }
   * earth    — the THREE.Mesh sphere that rotates
   * llv      — function(lat, lng, r) → THREE.Vector3 on sphere
   * camera   — PerspectiveCamera
   * canvas   — the WebGL canvas element
   * wrap     — parent container (for tooltip positioning)
   * worldData — world-atlas 110m TopoJSON
   * THREE    — the Three.js namespace
   */
  const { earth, llv, camera, canvas, wrap, worldData, THREE } = opts;
  if (!worldData || !earth) return;

  /* ── Materials ────────────────────────────────────────────────── */
  const matDefault = new THREE.LineBasicMaterial({
    color: 0x7A9DB8,
    transparent: true,
    opacity: 0.55,
  });
  const matHighlight = new THREE.LineBasicMaterial({
    color: 0x3B82F6,
    transparent: true,
    opacity: 1.0,
  });

  /* ── State ────────────────────────────────────────────────────── */
  const countryGroups = {};  /* id → THREE.Group of line objects */
  const countryBboxes = {};  /* id → {minLat,maxLat,minLng,maxLng} */
  const countryPolys  = {};  /* id → [[lat,lng][], ...]  outer rings */
  let   hoveredId     = null;
  const raycaster     = new THREE.Raycaster();
  const mouse2d       = new THREE.Vector2();

  /* ── Convert TopoJSON → GeoJSON features ─────────────────────── */
  let features = [];
  try {
    features = topojson.feature(worldData, worldData.objects.countries).features;
  } catch(e) { console.warn('[GIS] topojson parse error:', e); return; }

  /* ── Draw borders ─────────────────────────────────────────────── */
  features.forEach(f => {
    const id  = String(f.id);
    const geo = f.geometry;
    if (!geo) return;

    const group = new THREE.Group();
    group.userData.countryId = id;

    const bbox = { minLat:90, maxLat:-90, minLng:180, maxLng:-180 };
    const polys = [];

    const rings = geo.type === 'Polygon' ? [geo.coordinates] : geo.coordinates;
    rings.forEach(poly => {
      poly.forEach((ring, ri) => {
        /* Clamp to valid ring size */
        if (ring.length < 3) return;

        /* Build 3D points */
        const pts = [];
        ring.forEach(([lng, lat]) => pts.push(llv(lat, lng, 1.006)));
        if (pts.length < 2) return;

        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const line    = new THREE.Line(lineGeo, matDefault);
        group.add(line);

        /* Build bbox and store outer ring for PIP */
        if (ri === 0) {
          const latLngRing = ring.map(([lng, lat]) => [lat, lng]);
          polys.push(latLngRing);
          latLngRing.forEach(([la, ln]) => {
            bbox.minLat = Math.min(bbox.minLat, la);
            bbox.maxLat = Math.max(bbox.maxLat, la);
            bbox.minLng = Math.min(bbox.minLng, ln);
            bbox.maxLng = Math.max(bbox.maxLng, ln);
          });
        }
      });
    });

    if (group.children.length === 0) return;

    earth.add(group);
    countryGroups[id] = group;
    countryBboxes[id] = bbox;
    countryPolys[id]  = polys;
  });

  /* ── Country lookup ───────────────────────────────────────────── */
  function findCountryAt(lat, lng) {
    for (const [id, polys] of Object.entries(countryPolys)) {
      const bb = countryBboxes[id];
      /* Expand bbox slightly for edge hits */
      if (lat < bb.minLat - 1 || lat > bb.maxLat + 1) continue;
      /* Handle dateline-crossing bboxes */
      const lngIn = (bb.maxLng - bb.minLng > 180)
        ? true
        : (lng >= bb.minLng - 1 && lng <= bb.maxLng + 1);
      if (!lngIn) continue;
      for (const ring of polys) {
        if (_pip(lat, lng, ring)) return id;
      }
    }
    return null;
  }

  /* ── Highlight management ─────────────────────────────────────── */
  function setHighlight(id) {
    if (hoveredId === id) return;
    /* Restore previous */
    if (hoveredId && countryGroups[hoveredId]) {
      countryGroups[hoveredId].children.forEach(l => { l.material = matDefault; });
    }
    hoveredId = id;
    /* Apply new */
    if (id && countryGroups[id]) {
      countryGroups[id].children.forEach(l => { l.material = matHighlight; });
    }
  }

  /* ── Tooltip ──────────────────────────────────────────────────── */
  const tip = document.getElementById('globeHoverTip');

  function showCountryTip(id, clientX, clientY) {
    if (!tip) return;
    const name = GIS_COUNTRY_NAMES[id] || ('Region ' + id);
    const d    = GIS_COUNTRY_DATA[id];

    const nameEl     = document.getElementById('ghtCountry');
    const co2El      = document.getElementById('ghtCO2');
    const riskEl     = document.getElementById('ghtRisk');
    const projEl     = document.getElementById('ghtProjects');
    const riskBarEl  = document.getElementById('ghtRiskBar');

    if (nameEl) nameEl.textContent = name;
    if (co2El)  co2El.textContent  = d ? d.co2 + ' Gt' : '—';
    if (riskEl) riskEl.textContent = d ? d.risk.toFixed(1) : '—';
    if (projEl) projEl.textContent = d ? d.projects : '—';
    if (riskBarEl && d) riskBarEl.style.width = (d.risk / 10 * 100) + '%';

    const wrapRect = wrap.getBoundingClientRect();
    tip.style.display = 'block';
    tip.style.left    = (clientX - wrapRect.left + 16) + 'px';
    tip.style.top     = (clientY - wrapRect.top  - 10) + 'px';
  }

  function hideTip() {
    if (tip) tip.style.display = 'none';
    setHighlight(null);
  }

  /* ── Mouse interaction (attaches to canvas) ───────────────────── */
  let _lastCountryId = null;

  canvas.addEventListener('mousemove', function(e) {
    const rect = canvas.getBoundingClientRect();
    mouse2d.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    mouse2d.y = -((e.clientY - rect.top)  / rect.height)  * 2 + 1;
    raycaster.setFromCamera(mouse2d, camera);

    /* Test against the sphere itself (earth mesh, no children) */
    const hits = raycaster.intersectObject(earth, false);
    if (hits.length === 0) {
      hideTip();
      _lastCountryId = null;
      return;
    }

    /* Convert hit point to lat/lng */
    const pt  = hits[0].point.normalize();
    const lat = Math.asin(Math.max(-1, Math.min(1, pt.y))) * (180 / Math.PI);
    /* Rotate back by earth's current Y rotation */
    const angle = earth.rotation.y;
    const rotPt = new THREE.Vector3(
      pt.x * Math.cos(-angle) - pt.z * Math.sin(-angle),
      pt.y,
      pt.x * Math.sin(-angle) + pt.z * Math.cos(-angle)
    );
    const lng = Math.atan2(rotPt.z, -rotPt.x) * (180 / Math.PI) - 180;
    const lngN = ((lng % 360) + 360) % 360 - 180;

    const id = findCountryAt(lat, lngN);
    if (id !== _lastCountryId) {
      setHighlight(id);
      _lastCountryId = id;
    }
    if (id) {
      showCountryTip(id, e.clientX, e.clientY);
    } else {
      if (tip) tip.style.display = 'none';
    }
  });

  canvas.addEventListener('mouseleave', hideTip);

  console.log('[GIS] Country borders loaded —', Object.keys(countryGroups).length, 'territories');
};
