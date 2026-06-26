/**
 * Climactix Enterprise Platform — Shell
 * Injects topbar + sidebar into <div id="pf-shell-root"></div> from a single
 * NAV_ITEMS config, instead of copy-pasting nav HTML on every page (deliberate
 * deviation from the rest of the repo's per-page nav convention — justified by
 * 12 nav rows x many pages creating high drift risk otherwise).
 *
 * Also performs the auth gate: every page that includes this script is
 * blocked behind a valid session (redirects to platform-login.html if none).
 */
(function () {
  'use strict';

  const ICONS = {
    dashboard:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>',
    climate:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
    risk:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg>',
    company:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
    supply:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8 7.5L11 16M16 7.5L13 16"/></svg>',
    regulatory:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 2h6l1 4H8z"/><path d="M5 6h14l-1 14H6z"/><path d="M9 11h6M9 15h6"/></svg>',
    sustain:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 17l5-5 4 4 8-8"/><path d="M14 8h6v6"/></svg>',
    scenarios:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>',
    narrative:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5a8.5 8.5 0 1 1-4-7.2"/><path d="M21 4l-9 9-3-3"/></svg>',
    reports:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M9 13h6M9 17h6"/></svg>',
    government:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10l9-6 9 6M5 10v10M19 10v10M9 10v10M15 10v10M2 20h20"/></svg>',
    settings:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.97 7.97 0 000-2l2-1.6-2-3.4-2.4 1a8 8 0 00-1.7-1L15 3h-6l-.3 2.6a8 8 0 00-1.7 1l-2.4-1-2 3.4L4.6 11a7.97 7.97 0 000 2l-2 1.6 2 3.4 2.4-1a8 8 0 001.7 1L9 21h6l.3-2.6a8 8 0 001.7-1l2.4 1 2-3.4z"/></svg>',
  };

  const NAV_ITEMS = [
    { id: 'dashboard',   label: 'Dashboard',                      href: 'platform-dashboard.html',      icon: ICONS.dashboard,  status: 'live' },
    { id: 'climate',     label: 'Climate Intelligence',           href: 'platform-climate-risk.html',   icon: ICONS.climate,    status: 'stub' },
    { id: 'risk',        label: 'Risk Assessment',                href: 'platform-risk-assessment.html',icon: ICONS.risk,       status: 'stub' },
    { id: 'company',     label: 'Company Profiles',               href: 'platform-company-intel.html',  icon: ICONS.company,    status: 'live' },
    { id: 'supply',      label: 'Supply Chain Intelligence',      href: 'platform-supply-chain.html',   icon: ICONS.supply,     status: 'stub' },
    { id: 'regulatory',  label: 'Regulatory Intelligence',        href: 'platform-regulatory.html',     icon: ICONS.regulatory, status: 'live' },
    { id: 'sustain',     label: 'Sustainability Performance',     href: 'platform-sustainability.html', icon: ICONS.sustain,    status: 'stub' },
    { id: 'scenarios',   label: 'Climate Scenarios',              href: 'platform-scenarios.html',      icon: ICONS.scenarios,  status: 'live' },
    { id: 'narrative',   label: 'Greenwashing Intelligence',      href: 'platform-narrative.html',      icon: ICONS.narrative,  status: 'live' },
    { id: 'reports',     label: 'Reports',                        href: 'platform-reports.html',        icon: ICONS.reports,    status: 'stub' },
    { id: 'government',  label: 'Government Portal',              href: 'platform-government.html',     icon: ICONS.government, status: 'stub' },
    { id: 'settings',    label: 'Settings',                       href: 'platform-settings.html',       icon: ICONS.settings,   status: 'stub' },
  ];

  const WORKSPACES = ['Corporate Workspace', 'Investor Workspace', 'Government Workspace', 'University Workspace'];

  const MOCK_ALERTS = [
    { title: 'NTPC Ltd — transition risk crossed CRITICAL threshold', sub: '2 hours ago' },
    { title: 'Shell plc — SBTi target non-aligned flag raised', sub: '1 day ago' },
    { title: '3 companies missing CSRD disclosure deadline (Q1)', sub: '2 days ago' },
  ];
  const MOCK_NOTIFICATIONS = [
    { title: 'Regulatory Intelligence report ready: ReNew Power Ltd', sub: '34 minutes ago' },
    { title: 'New framework added to registry: TNFD v1.1', sub: '3 days ago' },
  ];

  function currentFile() {
    return window.location.pathname.split('/').pop() || 'platform-dashboard.html';
  }

  function renderSidebar() {
    const file = currentFile();
    const rows = NAV_ITEMS.map(item => {
      const active = item.href === file;
      const stubTag = item.status === 'stub' ? '<span class="pf-rail-stub-tag">SOON</span>' : '';
      return `<a class="pf-rail-item${active ? ' active' : ''}" href="${item.href}">${item.icon}<span class="pf-rail-item-label">${item.label}</span>${stubTag}</a>`;
    }).join('');
    return `
      <div class="pf-rail-section">Platform</div>
      ${rows}
    `;
  }

  function renderTopbar() {
    const savedWorkspace = localStorage.getItem('pf_workspace') || WORKSPACES[0];
    return `
      <a href="platform-dashboard.html" class="pf-brand">
        <img src="Climatix_logo.png" alt="Climactix" onerror="this.style.display='none'" />
        <span>Climactix Platform</span>
      </a>
      <div class="pf-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input type="text" id="pfGlobalSearch" placeholder="Search companies, frameworks, reports…" autocomplete="off" />
      </div>
      <div class="pf-topbar-right">
        <div class="pf-dropdown-wrap" id="pfAlertsWrap">
          <button class="pf-icon-btn" id="pfAlertsBtn" title="Alerts & Notifications">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>
            <span class="pf-badge-count">${MOCK_ALERTS.length + MOCK_NOTIFICATIONS.length}</span>
          </button>
          <div class="pf-dropdown">
            <div class="pf-dropdown-tabs">
              <div class="pf-dropdown-tab active" data-tab="alerts">Alerts</div>
              <div class="pf-dropdown-tab" data-tab="notifications">Notifications</div>
            </div>
            <div id="pfAlertsPane">
              ${MOCK_ALERTS.map(a => `<div class="pf-dropdown-item"><div class="pf-dropdown-item-title">${a.title}</div><div class="pf-dropdown-item-sub">${a.sub}</div></div>`).join('')}
            </div>
            <div id="pfNotifPane" style="display:none">
              ${MOCK_NOTIFICATIONS.map(a => `<div class="pf-dropdown-item"><div class="pf-dropdown-item-title">${a.title}</div><div class="pf-dropdown-item-sub">${a.sub}</div></div>`).join('')}
            </div>
          </div>
        </div>
        <div class="pf-dropdown-wrap" id="pfWorkspaceWrap">
          <div class="pf-workspace-select" id="pfWorkspaceBtn">
            <span id="pfWorkspaceLabel">${savedWorkspace}</span>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="pf-dropdown" style="min-width:220px">
            ${WORKSPACES.map(w => `<div class="pf-dropdown-item" data-workspace="${w}" style="cursor:pointer"><div class="pf-dropdown-item-title">${w}</div></div>`).join('')}
          </div>
        </div>
        <div class="pf-dropdown-wrap" id="pfProfileWrap">
          <div class="pf-profile" id="pfProfileBtn">
            <div class="pf-avatar" id="pfAvatarInitial">…</div>
          </div>
          <div class="pf-dropdown" style="min-width:200px">
            <div class="pf-dropdown-item">
              <div class="pf-dropdown-item-title" id="pfProfileFullName">—</div>
              <div class="pf-dropdown-item-sub" id="pfProfileEmail">—</div>
            </div>
            <div class="pf-dropdown-item" id="pfLogoutBtn" style="cursor:pointer;color:var(--risk)">
              <div class="pf-dropdown-item-title" style="color:var(--risk)">Sign out</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function wireDropdown(wrapId, btnId) {
    const wrap = document.getElementById(wrapId);
    const btn = document.getElementById(btnId);
    if (!wrap || !btn) return;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = wrap.classList.contains('open');
      document.querySelectorAll('.pf-dropdown-wrap.open').forEach(el => el.classList.remove('open'));
      if (!isOpen) wrap.classList.add('open');
    });
  }

  function initShell() {
    // #pf-shell-root IS the .pf-shell grid container (see platform.css); the
    // page's own <main class="pf-main"> already lives inside it as markup,
    // so we prepend topbar+sidebar rather than overwrite with innerHTML.
    const root = document.getElementById('pf-shell-root');
    if (!root) return;
    root.insertAdjacentHTML('afterbegin', `<header class="pf-topbar">${renderTopbar()}</header><nav class="pf-sidebar">${renderSidebar()}</nav>`);

    wireDropdown('pfAlertsWrap', 'pfAlertsBtn');
    wireDropdown('pfWorkspaceWrap', 'pfWorkspaceBtn');
    wireDropdown('pfProfileWrap', 'pfProfileBtn');
    document.addEventListener('click', () => {
      document.querySelectorAll('.pf-dropdown-wrap.open').forEach(el => el.classList.remove('open'));
    });

    // Alerts/Notifications tab switch
    document.querySelectorAll('#pfAlertsWrap .pf-dropdown-tab').forEach(tab => {
      tab.addEventListener('click', e => {
        e.stopPropagation();
        document.querySelectorAll('#pfAlertsWrap .pf-dropdown-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const isAlerts = tab.dataset.tab === 'alerts';
        document.getElementById('pfAlertsPane').style.display = isAlerts ? '' : 'none';
        document.getElementById('pfNotifPane').style.display = isAlerts ? 'none' : '';
      });
    });

    // Workspace selector — cosmetic state only (Phase 1: relabels topbar, no data scoping)
    document.querySelectorAll('#pfWorkspaceWrap [data-workspace]').forEach(item => {
      item.addEventListener('click', e => {
        e.stopPropagation();
        const ws = item.dataset.workspace;
        localStorage.setItem('pf_workspace', ws);
        document.getElementById('pfWorkspaceLabel').textContent = ws;
        document.getElementById('pfWorkspaceWrap').classList.remove('open');
      });
    });

    document.getElementById('pfLogoutBtn').addEventListener('click', async () => {
      try { await window.PLATFORM_AUTH.logout(); } catch (_) { /* ignore */ }
      window.location.href = 'platform-login.html';
    });

    // Global search — Phase 1: filters companies, navigates to Company Profiles
    const searchInput = document.getElementById('pfGlobalSearch');
    if (searchInput) {
      searchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && searchInput.value.trim()) {
          window.location.href = `platform-company-intel.html?q=${encodeURIComponent(searchInput.value.trim())}`;
        }
      });
    }
  }

  async function gateAndInit() {
    initShell();
    try {
      const user = await window.PLATFORM_AUTH.requireSession();
      const initial = (user.full_name || user.email || '?').trim()[0].toUpperCase();
      document.getElementById('pfAvatarInitial').textContent = initial;
      document.getElementById('pfProfileFullName').textContent = user.full_name || user.email;
      document.getElementById('pfProfileEmail').textContent = user.email;
      document.dispatchEvent(new CustomEvent('pf:session', { detail: user }));
    } catch (_) {
      // requireSession already redirected to platform-login.html
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', gateAndInit);
  } else {
    gateAndInit();
  }
})();
