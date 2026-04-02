/**
 * ESG Narrative Intelligence Layer — script.js
 * ─────────────────────────────────────────────
 * Rule-based ESG narrative engine.
 * No external APIs. All generation is local & deterministic.
 *
 * Architecture:
 *  1. DATA_PROFILES  — simulated sensor/operational datasets per theme
 *  2. NARRATIVE_TEMPLATES — professional ESG writing templates
 *  3. generateNarrative()  — assembles data + text into structured output
 *  4. renderPage()         — injects generated content into generate.html
 *  5. initHomepage()       — wires button clicks on index.html
 */

'use strict';

/* ══════════════════════════════════════════════════════════
   1. SIMULATED DATA PROFILES
   Each profile mimics what IoT sensors / ESG systems return.
   Values are intentionally realistic for FY2024 context.
══════════════════════════════════════════════════════════ */


const DATA_PROFILES = {

  climate: {
    topic: 'Climate & Emissions',
    icon: '🌍',
    colorClass: 'climate',
    frameworks: ['GRI 305', 'TCFD', 'ISSB IFRS S2', 'CSRD/ESRS E1', 'SBTi'],
    keyMetrics: [
      { pillar: 'E', value: '18,450', unit: ' tCO₂e', label: 'Total Scope 1 Emissions', change: '−11.2%', dir: 'down' },
      { pillar: 'E', value: '72,100', unit: ' tCO₂e', label: 'Scope 2 (market-based)', change: '−14.8%', dir: 'down' },
      { pillar: 'E', value: '1.5°C', unit: '',        label: 'SBTi Pathway Alignment', change: 'Confirmed', dir: 'flat' },
      { pillar: 'G', value: '96%',   unit: '',        label: 'Data Assurance Level',   change: '3rd-party verified', dir: 'flat' },
      { pillar: 'E', value: '2038',  unit: '',        label: 'Net-Zero Target Year',   change: '2yrs ahead of plan', dir: 'up' },
      { pillar: 'S', value: '€47M',  unit: '',        label: 'Green CapEx FY2024',     change: '↑ 9.1% of total', dir: 'up' },
    ],
    pullQuote: 'Science-based targets without data-backed performance are promises, not progress. This quarter, the numbers and the narrative finally align.',
    paragraphs: [
      `Aggregate Scope 1 and Scope 2 greenhouse gas emissions fell to <strong>90,550 tCO₂e</strong> in FY2024 — a <span class="highlight-e">combined reduction of 13.4%</span> versus the prior year, and the steepest annual decline recorded in the company's emissions history. Scope 1 direct combustion emissions reached <strong>18,450 tCO₂e</strong>, driven by the retirement of two legacy gas-fired backup generators and the electrification of on-site fleet vehicles across four manufacturing campuses. Market-based Scope 2 emissions declined to <strong>72,100 tCO₂e</strong>, reflecting active procurement of Guarantees of Origin (GOs) from wind and solar installations meeting the RE100 additionality criteria.`,
      `These outcomes place the organisation on a <span class="highlight-e">1.5°C-compatible trajectory</span> as validated by the Science Based Targets initiative (SBTi) — a commitment independently assessed against the absolute contraction method. Under TCFD's transition risk framework, the company's exposure to the EU Emissions Trading System, now pricing above <strong>€65 per tonne CO₂</strong>, has been meaningfully reduced. Avoided carbon cost in FY2024 is estimated at <strong>€5.9 million</strong> — a figure that amplifies the financial materiality of continued decarbonisation investment.`,
      `Capital allocation to low-carbon infrastructure reached <strong>€47.2 million</strong> — representing 9.1% of total CapEx — spanning rooftop photovoltaic installations, building management system upgrades, and fleet electrification. As required under Article 8 of the EU Taxonomy Regulation, 61% of this expenditure qualifies as Taxonomy-aligned under the "climate change mitigation" environmental objective. The remaining 39% is under Taxonomy review pending updated delegated acts.`,
      `Forward guidance: At current trajectory, Scope 1 and 2 net-zero is projected by <strong>2038</strong>, two years ahead of the 2040 commitment. Scope 3 emissions across the upstream value chain remain the primary outstanding data gap; a supplier engagement programme targeting 80% Scope 3 coverage by FY2026 was launched in Q3. Management affirms that no material gap exists between stated climate ambition and operational performance as at the reporting date.`,
    ],
    integrity: 98,
    audience: 'CSRD Filing · Investor Disclosure',
  },

  energy: {
    topic: 'Energy & Efficiency',
    icon: '⚡',
    colorClass: 'energy',
    frameworks: ['GRI 302', 'ISO 50001', 'EU Taxonomy', 'CDP Energy', 'RE100'],
    keyMetrics: [
      { pillar: 'E', value: '2,140',  unit: ' GWh',  label: 'Total Energy Consumed',   change: '−6.3% YoY', dir: 'down' },
      { pillar: 'E', value: '42%',    unit: '',       label: 'Renewable Energy Mix',    change: '↑ +7 pp YoY', dir: 'up' },
      { pillar: 'E', value: '€4.2M',  unit: '',       label: 'Energy Cost Avoided',     change: 'vs 2022 baseline', dir: 'up' },
      { pillar: 'G', value: '847',    unit: '',       label: 'Active IoT Sensors',      change: '15-sec refresh', dir: 'flat' },
      { pillar: 'E', value: '1.8',    unit: ' tCO₂e', label: 'Carbon Intensity /MWh',  change: '−12% vs prior year', dir: 'down' },
      { pillar: 'S', value: '620',    unit: '',       label: 'Staff Energy Trained',    change: '↑ 34% YoY', dir: 'up' },
    ],
    pullQuote: 'Forty-two per cent renewable energy is not a ceiling — it is the floor from which the next phase of the energy transition begins.',
    paragraphs: [
      `Total energy consumption across all operational boundaries reached <strong>2,140 GWh</strong> in FY2024 — a <span class="highlight-e">6.3% reduction year-over-year</span>, achieved through a combination of ISO 50001-aligned energy management practices, real-time load optimisation via <strong>847 IoT monitoring nodes</strong>, and the elimination of energy-intensive legacy processes across three production lines. The carbon intensity of energy consumed declined to a record-low <strong>1.8 tCO₂e per MWh</strong>, outperforming the sector benchmark of 2.4 tCO₂e/MWh reported by the IEA for comparable manufacturing activities.`,
      `Renewable energy now accounts for <span class="highlight-e">42% of total electricity consumption</span> — up from 35% in FY2023 — representing the single largest year-on-year improvement in the company's renewable portfolio since the RE100 commitment was made in 2021. This was achieved through onsite solar photovoltaic expansion (net addition: 38 MWp), two new Power Purchase Agreements with independently certified wind farms in Northern Europe, and the commissioning of a 12 MWh battery energy storage system enabling renewable dispatch into peak demand windows.`,
      `The financial dimension of energy efficiency is equally material: avoided energy costs in FY2024 reached <strong>€4.2 million</strong> against the 2022 baseline, as efficiency measures reduced total consumption that would otherwise have occurred under business-as-usual assumptions. Energy intensity per unit of production declined by <span class="highlight-e">8.9%</span>, advancing the company's trajectory toward its 2030 target of a 40% reduction in energy intensity. Sub-metering at process level, enabled by the IoT sensor network, has provided granular attribution of savings by facility and shift pattern.`,
      `Looking ahead, the energy roadmap to 2030 targets <span class="highlight-e">65% renewable energy penetration</span>, supported by a committed pipeline of 110 MWp of additional onsite generation and a third PPA under negotiation. The workforce dimension of this transition is equally prioritised: <strong>620 employees</strong> received structured energy efficiency training in FY2024, embedding operational ownership of consumption reduction across the organisation. All energy data in this disclosure is assured to a limited assurance level by an accredited third party under ISAE 3000 standards.`,
    ],
    integrity: 97,
    audience: 'Sustainability Report · CDP Submission',
  },

  operations: {
    topic: 'Operations & IoT ESG',
    icon: '🏭',
    colorClass: 'operations',
    frameworks: ['GRI 303', 'GRI 306', 'SASB', 'UN SDG 9', 'UN SDG 12'],
    keyMetrics: [
      { pillar: 'E', value: '94%',    unit: '',       label: 'Waste Diversion Rate',    change: '↑ +3pp YoY', dir: 'up' },
      { pillar: 'E', value: '−6.2%',  unit: '',       label: 'Water Withdrawal YoY',    change: 'vs SBT water target', dir: 'down' },
      { pillar: 'S', value: '0.38',   unit: '',       label: 'TRIR (Safety Rate)',       change: '−28% vs 2021', dir: 'down' },
      { pillar: 'G', value: '99.1%',  unit: '',       label: 'Uptime Across Sites',      change: '12 operating sites', dir: 'flat' },
      { pillar: 'E', value: '78%',    unit: '',       label: 'Circular Material Input',  change: '↑ from 71% (FY23)', dir: 'up' },
      { pillar: 'S', value: '12',     unit: '',       label: 'Sites Monitored Live',     change: 'Real-time IoT', dir: 'flat' },
    ],
    pullQuote: 'When machines communicate ESG data in real time, sustainability stops being a reporting exercise and becomes an operational discipline.',
    paragraphs: [
      `Across <strong>12 manufacturing and logistics sites</strong>, operational performance in FY2024 reflects the deepening integration of IoT sensor infrastructure into ESG management. Real-time monitoring, with a 15-second data refresh cycle across process points and utilities, has enabled continuous rather than periodic ESG tracking — closing the gap between operational reality and disclosed performance. The total recordable incident rate (TRIR) fell to <span class="highlight-s">0.38 per 200,000 hours worked</span>, a 28% reduction since 2021, attributable to predictive maintenance alerts, automated hazard detection, and a strengthened behavioural safety culture embedded through workforce training.`,
      `Water stewardship remains a material topic given the geographic distribution of sites in water-stressed regions. Total water withdrawal declined by <span class="highlight-e">6.2%</span> year-over-year to 1.84 million cubic metres — a result directly enabled by IoT-linked flow sensors triggering automated conservation protocols when consumption approaches site-level budgets. This trajectory aligns with the Science Based Targets Network (SBTN) water framework, targeting a 15% reduction in absolute withdrawal by 2030 from a 2020 baseline. Water recycled and reused within facility boundaries reached <strong>31% of total water processed</strong>, up from 26% in FY2023.`,
      `Circular economy performance advanced substantially. The overall waste diversion rate reached <span class="highlight-e">94%</span> — meaning less than 6% of generated waste was directed to landfill. Circular material inputs, incorporating recycled feedstocks and bio-based materials, now account for <span class="highlight-e">78% of total material input by mass</span>, up from 71% the prior year, advancing alignment with EU Green Deal supply chain standards. Hazardous waste generation declined by 14%, reflecting material substitution decisions guided by lifecycle assessment data embedded in procurement workflows.`,
      `The broader value of IoT-enabled operations lies in the quality of ESG data it produces: <span class="highlight-g">99.1% operational uptime</span> across all monitored sites ensured continuous data capture, reducing the estimation methodologies previously required to bridge sensor gaps. This data completeness directly supports the disclosure integrity requirements of CSRD, ISSB, and SASB frameworks, where material omissions and significant estimation uncertainty are flagged as disclosure risks. Management confirms that no material ESG data was estimated or extrapolated in this period's operational reporting.`,
    ],
    integrity: 96,
    audience: 'Board ESG Report · SASB Industry Filing',
  },

};

/* ══════════════════════════════════════════════════════════
   2. UTILITY — Get today's date in report format
══════════════════════════════════════════════════════════ */

function getReportDate() {
  const d = new Date();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ══════════════════════════════════════════════════════════
   3. HOMEPAGE — Wire button click events
══════════════════════════════════════════════════════════ */

function initHomepage() {
  const buttons = document.querySelectorAll('.theme-card[data-topic]');
  if (!buttons.length) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const topic = btn.getAttribute('data-topic');
      if (!DATA_PROFILES[topic]) return;

      // Show loading overlay briefly for UX realism
      const overlay = document.getElementById('loadingOverlay');
      if (overlay) overlay.classList.add('visible');

      // Store selection in sessionStorage so generate.html can read it
      sessionStorage.setItem('esg_topic', topic);

      // Navigate after a short simulated "processing" delay
      setTimeout(() => {
        window.location.href = 'generate.html';
      }, 1100);
    });

    // Keyboard accessibility
    btn.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
  });
}

/* ══════════════════════════════════════════════════════════
   4. GENERATE PAGE — Build & inject all narrative content
══════════════════════════════════════════════════════════ */

function initGeneratePage() {
  // Read topic from sessionStorage; default to climate if missing
  const topic = sessionStorage.getItem('esg_topic') || 'climate';
  const data  = DATA_PROFILES[topic];
  if (!data) return;

  const today = getReportDate();

  /* ── 4a. Update <head> title ── */
  document.title = `${data.topic} — ESG Narrative Intelligence`;

  /* ── 4b. Topic badge in topbar ── */
  const topicBadge = document.getElementById('topicBadge');
  if (topicBadge) {
    topicBadge.textContent = `${data.icon} ${data.topic}`;
    topicBadge.className = `gen-topic-badge ${data.colorClass}`;
  }

  /* ── 4c. Report date ── */
  const reportDate = document.getElementById('reportDate');
  if (reportDate) reportDate.textContent = today;

  /* ── 4d. Report header class (color strip) ── */
  const reportHeader = document.getElementById('reportHeader');
  if (reportHeader) {
    reportHeader.className = `report-header ${data.colorClass}`;
    document.getElementById('reportTypeTag').className = `report-type-tag ${data.colorClass}`;
    document.getElementById('reportTypeTag').textContent = `${data.icon}  ${data.topic} Narrative`;
  }

  /* ── 4e. Report title & subtitle ── */
  const titles = {
    climate:    {
      title:    'Climate Performance & Decarbonisation Progress: FY2024 Strategic Disclosure',
      subtitle: 'Science-based analysis of greenhouse gas trajectories, net-zero alignment, and carbon-related financial exposure across the enterprise value chain.',
    },
    energy:     {
      title:    'Energy Transition Intelligence: Renewable Integration & Efficiency Performance FY2024',
      subtitle: 'IoT-informed assessment of energy consumption, renewable portfolio expansion, and intensity reduction against 2030 efficiency targets.',
    },
    operations: {
      title:    'Operational ESG Intelligence: IoT-Enabled Sustainability Performance FY2024',
      subtitle: 'Real-time sensor data synthesis across water stewardship, circular economy, workforce safety, and operational integrity metrics.',
    },
  };

  const t = titles[topic];
  document.getElementById('reportTitle').textContent    = t.title;
  document.getElementById('reportSubtitle').textContent = t.subtitle;

  /* ── 4f. ESG Data Cards ── */
  const dataGrid = document.getElementById('dataCardsGrid');
  if (dataGrid) {
    dataGrid.innerHTML = data.keyMetrics.map(m => `
      <div class="esg-data-card ${m.pillar.toLowerCase()}">
        <div class="dc-pillar">● ${m.pillar === 'E' ? 'Environmental' : m.pillar === 'S' ? 'Social' : 'Governance'}</div>
        <div class="dc-value">${m.value}<span style="font-size:14px;font-family:'Source Serif 4',serif;font-weight:300;">${m.unit}</span></div>
        <div class="dc-label">${m.label}</div>
        <div class="dc-change ${m.dir}">${m.dir === 'up' ? '▲' : m.dir === 'down' ? '▼' : '—'} ${m.change}</div>
      </div>
    `).join('');
  }

  /* ── 4g. Narrative paragraphs ── */
  const narrativeBody = document.getElementById('narrativeBody');
  if (narrativeBody) {
    // Insert pull quote after second paragraph
    const paras = data.paragraphs;
    let html = '';
    paras.forEach((p, i) => {
      html += `<p>${p}</p>`;
      if (i === 1) {
        html += `
          <div class="pull-quote ${data.colorClass}">
            <p>"${data.pullQuote}"</p>
          </div>
        `;
      }
    });
    narrativeBody.innerHTML = html;
  }

  /* ── 4h. Framework tags ── */
  const fwContainer = document.getElementById('frameworkTags');
  if (fwContainer) {
    fwContainer.innerHTML = data.frameworks.map(f => `<span class="fw-tag">${f}</span>`).join('');
  }

  /* ── 4i. Integrity bar animation ── */
  const integrityFill  = document.getElementById('integrityFill');
  const integrityLabel = document.getElementById('integrityLabel');
  if (integrityFill && integrityLabel) {
    integrityLabel.textContent = `Narrative Integrity: ${data.integrity}%`;
    // Trigger animation after paint
    requestAnimationFrame(() => {
      setTimeout(() => {
        integrityFill.style.width = `${data.integrity}%`;
      }, 300);
    });
  }

  /* ── 4j. Audience line ── */
  const audience = document.getElementById('audienceLabel');
  if (audience) audience.textContent = data.audience;

  /* ── 4k. Sidebar — trend scores (same for all topics but adapted) ── */
  const trendContainer = document.getElementById('trendContainer');
  if (trendContainer) {
    const trends = {
      climate:    [
        { name: 'CBAM & Carbon Pricing', score: '97' },
        { name: 'Net-Zero Corporate Commitments', score: '94' },
        { name: 'ISSB S2 Global Adoption', score: '88' },
        { name: 'Scope 3 Value Chain Pressure', score: '83' },
      ],
      energy:     [
        { name: 'RE100 Corporate Renewables', score: '91' },
        { name: 'Energy Efficiency Mandates', score: '86' },
        { name: 'Grid Flexibility & Storage', score: '79' },
        { name: 'Green Power Procurement', score: '74' },
      ],
      operations: [
        { name: 'Circular Economy Regulation', score: '88' },
        { name: 'Water Stewardship (SBTN)', score: '82' },
        { name: 'IoT & ESG Data Quality', score: '78' },
        { name: 'UN SDG 12 Supply Chains', score: '73' },
      ],
    };
    trendContainer.innerHTML = trends[topic].map(tr => `
      <div class="trend-row">
        <span class="trend-name-small">${tr.name}</span>
        <span class="trend-score">${tr.score}</span>
      </div>
    `).join('');
  }

  /* ── 4l. Framework alignment sidebar ── */
  const fwAlignContainer = document.getElementById('fwAlignContainer');
  if (fwAlignContainer) {
    const fwStatus = data.frameworks.map((f, i) => ({
      name:   f,
      status: i < 3 ? 'ready' : i === 3 ? 'partial' : 'pending',
      label:  i < 3 ? '✓ Ready' : i === 3 ? '◑ Partial' : '○ Pending',
    }));
    fwAlignContainer.innerHTML = fwStatus.map(f => `
      <div class="fw-align-row">
        <span class="fw-name">${f.name}</span>
        <span class="fw-status ${f.status}">${f.label}</span>
      </div>
    `).join('');
  }

  /* ── 4m. Print / Export button ── */
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      window.print();
    });
  }
}

/* ══════════════════════════════════════════════════════════
   5. BOOT — detect which page is loaded and initialise
══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.getAttribute('data-page');

  if (page === 'home')     initHomepage();
  if (page === 'generate') initGeneratePage();

  /* Live timestamp in header */
  const ts = document.getElementById('headerTimestamp');
  if (ts) {
    const tick = () => {
      const now = new Date();
      ts.textContent = now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    };
    tick();
    setInterval(tick, 1000);
  }
});