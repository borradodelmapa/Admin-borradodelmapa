/* ═══════════════════════════════════════════
   ADMIN BORRADO DEL MAPA — Lógica principal
   Login + Tabs + Firebase + Dashboard + Usuarios
   ═══════════════════════════════════════════ */

(function() {
  'use strict';

  const SESSION_KEY = 'bdm_admin_token';
  var db = null; // Se inicializa tras login

  // ─── UTILS ───

  async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function daysAgo(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  // ─── DOM REFS ───

  const loginScreen = document.getElementById('login-screen');
  const loginForm = document.getElementById('login-form');
  const loginPassword = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');
  const app = document.getElementById('app');
  const tabsDesktop = document.getElementById('tabs-desktop');
  const mobileMenu = document.getElementById('mobile-menu');
  const hamburger = document.getElementById('hamburger');
  var currentTab = null;

  // ─── FIREBASE ───

  function initFirebase() {
    if (!firebase.apps.length) {
      firebase.initializeApp(ADMIN_CONFIG.FIREBASE);
    }
    db = firebase.firestore();
  }

  // Inicializar Firebase siempre (necesario para auth)
  initFirebase();

  // ─── LOGIN ───

  function showApp() {
    loginScreen.style.display = 'none';
    app.classList.add('active');
    initTabs();
    navigateTo('dashboard');
  }

  // Si ya hay sesión Y Firebase Auth activo, entrar directo
  var appShown = false;
  firebase.auth().onAuthStateChanged(function(user) {
    if (user && sessionStorage.getItem(SESSION_KEY) && !appShown) {
      appShown = true;
      showApp();
    }
  });

  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    loginError.textContent = '';

    var password = loginPassword.value.trim();
    if (!password) {
      loginError.textContent = 'Introduce la contraseña';
      return;
    }

    var hash = await sha256(password);
    if (hash !== ADMIN_CONFIG.PASSWORD_HASH) {
      loginError.textContent = 'Contraseña incorrecta';
      loginPassword.value = '';
      loginPassword.focus();
      return;
    }

    // Autenticar con Firebase Auth
    try {
      await firebase.auth().signInWithEmailAndPassword(ADMIN_CONFIG.ADMIN_EMAIL, password);
      sessionStorage.setItem(SESSION_KEY, Date.now().toString());
      appShown = true;
      showApp();
    } catch (err) {
      loginError.textContent = 'Error de autenticación Firebase';
      console.error('Firebase Auth error:', err);
    }
  });

  // ─── TABS ───

  function initTabs() {
    tabsDesktop.innerHTML = '';
    mobileMenu.innerHTML = '';

    ADMIN_CONFIG.TABS.forEach(function(tab) {
      var btnD = document.createElement('button');
      btnD.className = 'tab-btn';
      btnD.dataset.tab = tab.id;
      btnD.textContent = tab.icon + ' ' + tab.label;
      btnD.addEventListener('click', function() { navigateTo(tab.id); });
      tabsDesktop.appendChild(btnD);

      var btnM = document.createElement('button');
      btnM.className = 'tab-btn';
      btnM.dataset.tab = tab.id;
      btnM.textContent = tab.icon + ' ' + tab.label;
      btnM.addEventListener('click', function() {
        navigateTo(tab.id);
        closeMobileMenu();
      });
      mobileMenu.appendChild(btnM);
    });
  }

  function navigateTo(tabId) {
    document.querySelectorAll('.tab-content').forEach(function(el) {
      el.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(function(el) {
      el.classList.remove('active');
    });

    var section = document.getElementById('tab-' + tabId);
    if (section) section.classList.add('active');

    document.querySelectorAll('.tab-btn[data-tab="' + tabId + '"]').forEach(function(el) {
      el.classList.add('active');
    });

    currentTab = tabId;

    // Cargar datos al entrar en la pestaña (solo si auth activo)
    if (db && firebase.auth().currentUser) {
      if (tabId === 'dashboard') {
        loadDashboard();
        updateSalmaMetric();
      }
      if (tabId === 'usuarios') loadUsuarios();
      if (tabId === 'proyecto') loadProyecto();
      if (tabId === 'marketing') loadMarketing();
      if (tabId === 'contabilidad') loadContabilidad();
      if (tabId === 'analytics') loadAnalytics();
      if (tabId === 'salma') loadSalma();
      if (tabId === 'chat') loadChat();
      if (tabId === 'settings') initSettings();
    }
  }

  // Actualiza m-salma — carga directamente de Firestore admin_logs
  async function updateSalmaMetric() {
    // 1. Intentar localStorage primero (instantáneo)
    try {
      var stored = localStorage.getItem('_salmaLogs');
      if (stored) {
        var logs = JSON.parse(stored);
        var today = new Date().toISOString().slice(0, 10);
        var count = logs.filter(function(l) {
          return l.timestamp && l.timestamp.slice(0, 10) === today;
        }).length;
        document.getElementById('m-salma').textContent = count;
      }
    } catch(e) {}

    // 2. Cargar desde Firestore (actualiza con dato fresco)
    try {
      var snap = await db.collection('admin_logs').orderBy('timestamp', 'desc').limit(500).get();
      var salmaLogs = [];
      snap.forEach(function(doc) { salmaLogs.push(doc.data()); });
      window._salmaLogsCache = salmaLogs;
      try {
        localStorage.setItem('_salmaLogs', JSON.stringify(salmaLogs));
      } catch(e) {}
      var today = new Date().toISOString().slice(0, 10);
      var count = salmaLogs.filter(function(l) {
        return l.timestamp && l.timestamp.slice(0, 10) === today;
      }).length;
      document.getElementById('m-salma').textContent = count;
    } catch(e) {}
  }

  // ─── HAMBURGER ───

  hamburger.addEventListener('click', function(e) {
    e.stopPropagation();
    hamburger.classList.toggle('open');
    mobileMenu.classList.toggle('open');
  });

  function closeMobileMenu() {
    hamburger.classList.remove('open');
    mobileMenu.classList.remove('open');
  }

  document.addEventListener('click', function(e) {
    if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
      closeMobileMenu();
    }
  });

  // ═══════════════════════════════════════════
  //  DASHBOARD
  // ═══════════════════════════════════════════

  var dashboardLoaded = false;

  function loadDashboard() {
    if (dashboardLoaded) return;
    // Esperar a que auth esté listo
    if (!firebase.auth().currentUser) {
      firebase.auth().onAuthStateChanged(function handler(user) {
        if (user && !dashboardLoaded) {
          dashboardLoaded = true;
          loadDashboardMetrics();
          checkWorkerHealth();
        }
      });
      return;
    }
    dashboardLoaded = true;
    loadDashboardMetrics();
    checkWorkerHealth();
  }

  async function loadDashboardMetrics() {
    try {
      var usersSnap = await db.collection('users').get();
      var users = [];
      usersSnap.forEach(function(doc) { users.push(doc.data()); });

      // Total usuarios
      var totalUsers = users.length;
      document.getElementById('m-usuarios').textContent = totalUsers;

      // Registros últimos 7 días para tendencia
      var d7 = daysAgo(7);
      var recent7 = users.filter(function(u) { return u.createdAt && u.createdAt >= d7; }).length;
      var trend7 = document.getElementById('m-usuarios-trend');
      if (recent7 > 0) {
        trend7.textContent = '+' + recent7 + ' esta semana';
        trend7.className = 'metric-trend up';
      }

      // Contar rutas reales desde subcollecciones maps
      var totalRutas = 0;
      var rutasRecientes = 0;
      var realMapCounts = {}; // uid → count real
      var promises = [];
      usersSnap.forEach(function(doc) {
        var uid = doc.id;
        // Total maps
        var p1 = db.collection('users').doc(uid).collection('maps').get()
          .then(function(snap) {
            realMapCounts[uid] = snap.size;
            totalRutas += snap.size;
          });
        // Maps últimos 7 días
        var p2 = db.collection('users').doc(uid).collection('maps')
          .where('createdAt', '>=', d7).get()
          .then(function(snap) { rutasRecientes += snap.size; });
        promises.push(p1, p2);
      });
      await Promise.all(promises);

      // Guardar conteos reales para la tabla de usuarios
      window._realMapCounts = realMapCounts;

      document.getElementById('m-rutas').textContent = totalRutas;

      var trendRutas = document.getElementById('m-rutas-trend');
      if (rutasRecientes > 0) {
        trendRutas.textContent = '+' + rutasRecientes + ' esta semana';
        trendRutas.className = 'metric-trend up';
      }

    } catch (err) {
      console.error('Error cargando métricas dashboard:', err);
    }

    // Actualizar métrica Salma (función reutilizable)
    updateSalmaMetric();
  }

  async function checkWorkerHealth() {
    var dot = document.getElementById('health-worker');
    try {
      // no-cors: si el servidor responde (aunque sea opaque), está online
      var res = await fetch(ADMIN_CONFIG.WORKER_URL, { method: 'HEAD', mode: 'no-cors' });
      dot.className = 'health-dot green';
    } catch (e) {
      dot.className = 'health-dot red';
    }

    // API Anthropic y Google Places: sin datos hasta Fase D (logging en Worker)
    // Se dejan en gris por ahora
  }

  // ═══════════════════════════════════════════
  //  USUARIOS
  // ═══════════════════════════════════════════

  var allUsers = [];       // Cache de todos los usuarios
  var usersLoaded = false;
  var usersSortField = 'createdAt';
  var usersSortDir = 'desc';
  var usersPage = 1;
  var usersPerPage = 20;
  var usersFilter = '';

  function loadUsuarios() {
    if (usersLoaded) return;
    usersLoaded = true;

    // Buscador
    document.getElementById('users-search').addEventListener('input', function(e) {
      usersFilter = e.target.value.toLowerCase().trim();
      usersPage = 1;
      renderUsersTable();
    });

    // Columnas ordenables
    document.querySelectorAll('#users-table .sortable').forEach(function(th) {
      th.addEventListener('click', function() {
        var field = th.dataset.sort;
        if (usersSortField === field) {
          usersSortDir = usersSortDir === 'asc' ? 'desc' : 'asc';
        } else {
          usersSortField = field;
          usersSortDir = field === 'createdAt' || field === 'mapsCount' ? 'desc' : 'asc';
        }
        renderUsersTable();
      });
    });

    fetchUsers();
  }

  async function fetchUsers() {
    var tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '<tr><td colspan="4"><div class="loading">Cargando usuarios...</div></td></tr>';

    try {
      var snap = await db.collection('users').get();
      allUsers = [];
      var promises = [];
      snap.forEach(function(doc) {
        var d = doc.data();
        d._id = doc.id;
        // Usar conteo real del dashboard si existe, si no contar
        if (window._realMapCounts && window._realMapCounts[doc.id] !== undefined) {
          d._realMaps = window._realMapCounts[doc.id];
        } else {
          var p = db.collection('users').doc(doc.id).collection('maps').get()
            .then(function(s) { d._realMaps = s.size; });
          promises.push(p);
        }
        allUsers.push(d);
      });
      await Promise.all(promises);

      renderUsersTable();
      renderUsersMetrics();
    } catch (err) {
      console.error('Error cargando usuarios:', err);
      tbody.innerHTML = '<tr><td colspan="4" style="color:var(--red);padding:20px;">Error al cargar usuarios</td></tr>';
    }
  }

  function getFilteredUsers() {
    var filtered = allUsers;
    if (usersFilter) {
      filtered = allUsers.filter(function(u) {
        var name = (u.name || '').toLowerCase();
        var email = (u.email || '').toLowerCase();
        return name.indexOf(usersFilter) !== -1 || email.indexOf(usersFilter) !== -1;
      });
    }

    // Ordenar
    filtered.sort(function(a, b) {
      var va = a[usersSortField] || '';
      var vb = b[usersSortField] || '';
      if (typeof va === 'number' && typeof vb === 'number') {
        return usersSortDir === 'asc' ? va - vb : vb - va;
      }
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
      if (va < vb) return usersSortDir === 'asc' ? -1 : 1;
      if (va > vb) return usersSortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }

  function renderUsersTable() {
    var filtered = getFilteredUsers();
    var totalPages = Math.max(1, Math.ceil(filtered.length / usersPerPage));
    if (usersPage > totalPages) usersPage = totalPages;

    var start = (usersPage - 1) * usersPerPage;
    var pageUsers = filtered.slice(start, start + usersPerPage);

    // Tabla
    var tbody = document.getElementById('users-tbody');
    if (pageUsers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted);padding:20px;text-align:center;">' +
        (usersFilter ? 'Sin resultados para "' + usersFilter + '"' : 'No hay usuarios') + '</td></tr>';
    } else {
      tbody.innerHTML = pageUsers.map(function(u) {
        return '<tr>' +
          '<td>' + (u.name || '—') + '</td>' +
          '<td>' + (u.email || '—') + '</td>' +
          '<td>' + formatDate(u.createdAt) + '</td>' +
          '<td>' + (u._realMaps || u.mapsCount || 0) + '</td>' +
          '</tr>';
      }).join('');
    }

    // Indicador de orden en headers
    document.querySelectorAll('#users-table .sortable').forEach(function(th) {
      th.classList.remove('asc', 'desc');
      if (th.dataset.sort === usersSortField) {
        th.classList.add(usersSortDir);
      }
    });

    // Paginación
    renderPagination(filtered.length, totalPages);
  }

  function renderPagination(total, totalPages) {
    var container = document.getElementById('users-pagination');
    if (totalPages <= 1) {
      container.innerHTML = '<span class="pagination-info">' + total + ' usuario' + (total !== 1 ? 's' : '') + '</span>';
      return;
    }

    var html = '<button ' + (usersPage <= 1 ? 'disabled' : '') + ' data-page="' + (usersPage - 1) + '">&lt;</button>';

    for (var i = 1; i <= totalPages; i++) {
      if (totalPages > 7 && i > 2 && i < totalPages - 1 && Math.abs(i - usersPage) > 1) {
        if (i === 3 || i === totalPages - 2) html += '<span class="pagination-info">...</span>';
        continue;
      }
      html += '<button class="' + (i === usersPage ? 'active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }

    html += '<button ' + (usersPage >= totalPages ? 'disabled' : '') + ' data-page="' + (usersPage + 1) + '">&gt;</button>';
    html += '<span class="pagination-info">' + total + ' usuarios</span>';

    container.innerHTML = html;

    container.querySelectorAll('button').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var p = parseInt(btn.dataset.page);
        if (p >= 1 && p <= totalPages) {
          usersPage = p;
          renderUsersTable();
        }
      });
    });
  }

  function renderUsersMetrics() {
    var total = allUsers.length;
    var d7 = daysAgo(7);
    var d30 = daysAgo(30);

    var recent7 = allUsers.filter(function(u) { return u.createdAt && u.createdAt >= d7; }).length;
    var recent30 = allUsers.filter(function(u) { return u.createdAt && u.createdAt >= d30; }).length;

    var totalMaps = 0;
    allUsers.forEach(function(u) { totalMaps += (u._realMaps || u.mapsCount || 0); });
    var avgMaps = total > 0 ? (totalMaps / total).toFixed(1) : '0';

    document.getElementById('mu-total').textContent = total;
    document.getElementById('mu-7d').textContent = recent7;
    document.getElementById('mu-30d').textContent = recent30;
    document.getElementById('mu-avg-rutas').textContent = avgMaps;
  }

  // ═══════════════════════════════════════════
  //  PROYECTO
  // ═══════════════════════════════════════════

  var projectLoaded = false;
  var projectData = null;

  function loadProyecto() {
    if (projectLoaded) return;
    projectLoaded = true;
    fetchProjectData();

    document.getElementById('btn-add-changelog').addEventListener('click', function() {
      showModal('Nueva entrada changelog', [
        { name: 'date', label: 'Fecha', type: 'date', value: new Date().toISOString().slice(0, 10) },
        { name: 'change', label: 'Cambio', type: 'text' }
      ], function(data) {
        if (!data.date || !data.change) return;
        projectData.changelog.unshift({ date: data.date, change: data.change });
        saveProjectData().then(renderProyecto);
      });
    });
  }

  async function fetchProjectData() {
    try {
      var doc = await db.collection('admin').doc('project-state').get();
      if (doc.exists) {
        projectData = doc.data();
      } else {
        // Crear datos iniciales
        projectData = getInitialProjectData();
        await db.collection('admin').doc('project-state').set(projectData);
      }
      renderProyecto();
    } catch (err) {
      console.error('Error cargando proyecto:', err);
    }
  }

  function getInitialProjectData() {
    return {
      current_worker_version: 'v1-final + 4 fixes',
      last_deploy: '2026-03-21T06:00:00Z',
      last_deploy_note: 'Fix Google Places key + distance filter',
      phases: {
        F1: { name: 'Estabilizar', status: 'in_progress', tasks: [
          { task: 'Login e2e validation', status: 'done' },
          { task: 'Long routes +7 days', status: 'pending' },
          { task: 'Repo cleanup', status: 'done' }
        ]},
        F2: { name: 'Calidad', status: 'in_progress', tasks: [
          { task: '5-block guide structure', status: 'pending' },
          { task: 'Embudo conversacional Salma', status: 'designed' },
          { task: 'UX renames (rutas→viajes)', status: 'pending' },
          { task: 'Loading messages', status: 'pending' },
          { task: 'Blog content', status: 'pending' }
        ]},
        F3: { name: 'Monetización', status: 'planned', tasks: [
          { task: 'Stripe integration', status: 'pending' },
          { task: 'Bundle system (Básico/Viajero/Nómada)', status: 'pending' },
          { task: 'Paywall + route counter', status: 'pending' }
        ]},
        F4: { name: 'Copilot V2', status: 'planned', tasks: [
          { task: 'Kiwi.com flights integration', status: 'pending' },
          { task: 'Trivago hotels integration', status: 'pending' },
          { task: 'Offline download', status: 'pending' },
          { task: 'Live pricing', status: 'pending' }
        ]}
      },
      changelog: [
        { date: '2026-03-21', change: 'Fix Google Places key + outsideZone Koh/Ko' },
        { date: '2026-03-20', change: 'Limpieza Leaflet, archivos muertos eliminados' },
        { date: '2026-03-19', change: 'Streaming desactivado, JSON parser mejorado' }
      ],
      infrastructure: {
        hosting: 'GitHub Pages → borradodelmapa.com',
        worker: 'Cloudflare Workers → salma-api.paco-defoto.workers.dev',
        database: 'Firebase Firestore',
        auth: 'Firebase Auth',
        maps: 'Google Maps API + Google Places API',
        ai: 'Anthropic Claude API (via Worker)'
      }
    };
  }

  function saveProjectData() {
    return db.collection('admin').doc('project-state').set(projectData);
  }

  function renderProyecto() {
    // System info
    var infoHtml = '';
    infoHtml += '<div class="info-row"><span class="info-label">Worker version</span><span>' + (projectData.current_worker_version || '—') + '</span></div>';
    infoHtml += '<div class="info-row"><span class="info-label">Último deploy</span><span>' + formatDate(projectData.last_deploy) + ' — ' + (projectData.last_deploy_note || '') + '</span></div>';
    if (projectData.infrastructure) {
      Object.keys(projectData.infrastructure).forEach(function(k) {
        infoHtml += '<div class="info-row"><span class="info-label">' + k + '</span><span>' + projectData.infrastructure[k] + '</span></div>';
      });
    }
    document.getElementById('system-info').innerHTML = infoHtml;

    // Roadmap
    var roadmapHtml = '';
    var phases = projectData.phases || {};
    var phaseOrder = ['F1', 'F2', 'F3', 'F4'];
    phaseOrder.forEach(function(phaseId) {
      if (!phases[phaseId]) return;
      var phase = phases[phaseId];
      var tasks = phase.tasks || [];
      var doneCount = tasks.filter(function(t) { return t.status === 'done'; }).length;
      var pct = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

      roadmapHtml += '<div class="phase-card">';
      roadmapHtml += '<div class="phase-header"><span class="phase-name">' + phaseId + ' — ' + phase.name + '</span>';
      roadmapHtml += '<span class="phase-badge ' + phase.status + '">' + phase.status.replace('_', ' ') + '</span></div>';
      roadmapHtml += '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
      roadmapHtml += '<ul class="task-list">';

      tasks.forEach(function(t, i) {
        var icon = t.status === 'done' ? '✅' : t.status === 'in_progress' || t.status === 'designed' ? '🔨' : '⬜';
        var nameClass = t.status === 'done' ? 'task-name done' : 'task-name';
        roadmapHtml += '<li class="task-item">';
        roadmapHtml += '<span class="task-status">' + icon + '</span>';
        roadmapHtml += '<span class="' + nameClass + '">' + t.task + '</span>';
        roadmapHtml += '<button class="task-action" data-phase="' + phaseId + '" data-idx="' + i + '">cambiar</button>';
        roadmapHtml += '</li>';
      });

      roadmapHtml += '</ul>';
      roadmapHtml += '<button class="btn-sm secondary phase-add-task" data-phase="' + phaseId + '">+ Tarea</button>';
      roadmapHtml += '</div>';
    });
    document.getElementById('roadmap').innerHTML = roadmapHtml;

    // Event: cambiar estado de tarea
    document.querySelectorAll('.task-action').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var phaseId = btn.dataset.phase;
        var idx = parseInt(btn.dataset.idx);
        var task = projectData.phases[phaseId].tasks[idx];
        var statuses = ['pending', 'in_progress', 'designed', 'done'];
        var currentIdx = statuses.indexOf(task.status);
        task.status = statuses[(currentIdx + 1) % statuses.length];
        saveProjectData().then(renderProyecto);
      });
    });

    // Event: añadir tarea
    document.querySelectorAll('.phase-add-task').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var phaseId = btn.dataset.phase;
        showModal('Nueva tarea en ' + phaseId, [
          { name: 'task', label: 'Tarea', type: 'text' }
        ], function(data) {
          if (!data.task) return;
          projectData.phases[phaseId].tasks.push({ task: data.task, status: 'pending' });
          saveProjectData().then(renderProyecto);
        });
      });
    });

    // Changelog
    var clHtml = '<div class="changelog-list">';
    (projectData.changelog || []).forEach(function(entry) {
      clHtml += '<div class="changelog-entry"><span class="changelog-date">' + entry.date + '</span><span>' + entry.change + '</span></div>';
    });
    clHtml += '</div>';
    document.getElementById('changelog').innerHTML = clHtml;
  }

  // ═══════════════════════════════════════════
  //  MARKETING
  // ═══════════════════════════════════════════

  var marketingLoaded = false;
  var marketingData = null;

  function loadMarketing() {
    if (marketingLoaded) return;
    marketingLoaded = true;
    fetchMarketingData();

    document.getElementById('btn-add-campaign').addEventListener('click', function() {
      showModal('Nueva campaña', [
        { name: 'date', label: 'Fecha', type: 'date', value: new Date().toISOString().slice(0, 10) },
        { name: 'channel', label: 'Canal', type: 'text' },
        { name: 'action', label: 'Acción', type: 'text' },
        { name: 'result_visits', label: 'Visitas', type: 'number' },
        { name: 'result_signups', label: 'Registros', type: 'number' },
        { name: 'notes', label: 'Notas', type: 'text' }
      ], function(data) {
        data.result_visits = parseInt(data.result_visits) || 0;
        data.result_signups = parseInt(data.result_signups) || 0;
        data.id = 'camp_' + Date.now();
        marketingData.campaigns.push(data);
        saveMarketingData().then(renderMarketing);
      });
    });

    document.getElementById('btn-add-idea').addEventListener('click', function() {
      showModal('Nueva idea', [
        { name: 'idea', label: 'Idea', type: 'text' },
        { name: 'priority', label: 'Prioridad', type: 'select', options: ['high', 'medium', 'low'] }
      ], function(data) {
        if (!data.idea) return;
        data.status = 'pending';
        marketingData.ideas.push(data);
        saveMarketingData().then(renderMarketing);
      });
    });
  }

  async function fetchMarketingData() {
    try {
      var doc = await db.collection('admin').doc('marketing').get();
      if (doc.exists) {
        marketingData = doc.data();
      } else {
        marketingData = { campaigns: [], ideas: [], seo: { notes: '' } };
        await db.collection('admin').doc('marketing').set(marketingData);
      }
      renderMarketing();
    } catch (err) {
      console.error('Error cargando marketing:', err);
    }
  }

  function saveMarketingData() {
    return db.collection('admin').doc('marketing').set(marketingData);
  }

  function renderMarketing() {
    var campaigns = marketingData.campaigns || [];
    var totalVisits = 0, totalSignups = 0;
    var channels = {};
    campaigns.forEach(function(c) {
      totalVisits += (c.result_visits || 0);
      totalSignups += (c.result_signups || 0);
      channels[c.channel] = (channels[c.channel] || 0) + (c.result_visits || 0);
    });
    var bestChannel = '—';
    var bestVal = 0;
    Object.keys(channels).forEach(function(ch) {
      if (channels[ch] > bestVal) { bestVal = channels[ch]; bestChannel = ch; }
    });

    // Métricas
    document.getElementById('marketing-metrics').innerHTML =
      '<div class="metric-card"><span class="metric-icon">📣</span><span class="metric-value">' + campaigns.length + '</span><span class="metric-label">Campañas</span></div>' +
      '<div class="metric-card"><span class="metric-icon">👁️</span><span class="metric-value">' + totalVisits + '</span><span class="metric-label">Visitas generadas</span></div>' +
      '<div class="metric-card"><span class="metric-icon">👥</span><span class="metric-value">' + totalSignups + '</span><span class="metric-label">Registros</span></div>' +
      '<div class="metric-card"><span class="metric-icon">🏆</span><span class="metric-value">' + bestChannel + '</span><span class="metric-label">Mejor canal</span></div>';

    // Tabla campañas
    var tbody = document.getElementById('campaigns-tbody');
    if (campaigns.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-muted);padding:20px;text-align:center;">Sin campañas aún</td></tr>';
    } else {
      tbody.innerHTML = campaigns.map(function(c, i) {
        return '<tr>' +
          '<td>' + (c.date || '') + '</td>' +
          '<td>' + (c.channel || '') + '</td>' +
          '<td>' + (c.action || '') + '</td>' +
          '<td>' + (c.result_visits || 0) + '</td>' +
          '<td>' + (c.result_signups || 0) + '</td>' +
          '<td>' + (c.notes || '') + '</td>' +
          '<td><button class="btn-sm danger del-campaign" data-idx="' + i + '">✕</button></td>' +
          '</tr>';
      }).join('');

      tbody.querySelectorAll('.del-campaign').forEach(function(btn) {
        btn.addEventListener('click', function() {
          marketingData.campaigns.splice(parseInt(btn.dataset.idx), 1);
          saveMarketingData().then(renderMarketing);
        });
      });
    }

    // Ideas
    var ideasHtml = '';
    (marketingData.ideas || []).forEach(function(idea, i) {
      var statusIcon = idea.status === 'done' ? '✅' : '⬜';
      ideasHtml += '<div class="idea-item">';
      ideasHtml += '<span class="idea-priority ' + (idea.priority || 'low') + '">' + (idea.priority || 'low') + '</span>';
      ideasHtml += '<span class="idea-text">' + idea.idea + '</span>';
      ideasHtml += '<button class="task-action toggle-idea" data-idx="' + i + '">' + statusIcon + '</button>';
      ideasHtml += '<button class="btn-sm danger del-idea" data-idx="' + i + '">✕</button>';
      ideasHtml += '</div>';
    });
    document.getElementById('ideas-list').innerHTML = ideasHtml || '<div class="info-box">Sin ideas aún</div>';

    document.querySelectorAll('.toggle-idea').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.dataset.idx);
        marketingData.ideas[idx].status = marketingData.ideas[idx].status === 'done' ? 'pending' : 'done';
        saveMarketingData().then(renderMarketing);
      });
    });

    document.querySelectorAll('.del-idea').forEach(function(btn) {
      btn.addEventListener('click', function() {
        marketingData.ideas.splice(parseInt(btn.dataset.idx), 1);
        saveMarketingData().then(renderMarketing);
      });
    });
  }

  // ═══════════════════════════════════════════
  //  CONTABILIDAD
  // ═══════════════════════════════════════════

  var accountingLoaded = false;
  var accountingData = null;

  function loadContabilidad() {
    if (accountingLoaded) return;
    accountingLoaded = true;
    fetchAccountingData();

    document.getElementById('btn-add-cost').addEventListener('click', function() {
      showModal('Nuevo coste', [
        { name: 'date', label: 'Fecha', type: 'date', value: new Date().toISOString().slice(0, 10) },
        { name: 'concept', label: 'Concepto', type: 'text' },
        { name: 'amount', label: 'Importe (€)', type: 'number' }
      ], function(data) {
        if (!data.concept || !data.amount) return;
        data.amount = parseFloat(data.amount) || 0;
        accountingData.costs.push(data);
        saveAccountingData().then(renderContabilidad);
      });
    });
  }

  async function fetchAccountingData() {
    try {
      var doc = await db.collection('admin').doc('accounting').get();
      if (doc.exists) {
        accountingData = doc.data();
      } else {
        accountingData = { costs: [], model_prices: ADMIN_CONFIG.MODEL_PRICES };
        await db.collection('admin').doc('accounting').set(accountingData);
      }
      renderContabilidad();
    } catch (err) {
      console.error('Error cargando contabilidad:', err);
    }
  }

  function saveAccountingData() {
    return db.collection('admin').doc('accounting').set(accountingData);
  }

  function renderContabilidad() {
    var costs = accountingData.costs || [];
    var totalCosts = 0;
    costs.forEach(function(c) { totalCosts += (c.amount || 0); });

    // Métricas
    document.getElementById('accounting-metrics').innerHTML =
      '<div class="metric-card"><span class="metric-icon">💸</span><span class="metric-value">' + totalCosts.toFixed(2) + '€</span><span class="metric-label">Costes total</span></div>' +
      '<div class="metric-card"><span class="metric-icon">💰</span><span class="metric-value">0€</span><span class="metric-label">Ingresos (F3)</span></div>' +
      '<div class="metric-card"><span class="metric-icon">📊</span><span class="metric-value">' + (-totalCosts).toFixed(2) + '€</span><span class="metric-label">Margen</span></div>';

    // Tabla costes
    var tbody = document.getElementById('costs-tbody');
    if (costs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted);padding:20px;text-align:center;">Sin costes registrados</td></tr>';
    } else {
      tbody.innerHTML = costs.map(function(c, i) {
        return '<tr>' +
          '<td>' + (c.date || '') + '</td>' +
          '<td>' + (c.concept || '') + '</td>' +
          '<td>' + (c.amount || 0).toFixed(2) + '€</td>' +
          '<td><button class="btn-sm danger del-cost" data-idx="' + i + '">✕</button></td>' +
          '</tr>';
      }).join('');

      tbody.querySelectorAll('.del-cost').forEach(function(btn) {
        btn.addEventListener('click', function() {
          accountingData.costs.splice(parseInt(btn.dataset.idx), 1);
          saveAccountingData().then(renderContabilidad);
        });
      });
    }
  }

  // ═══════════════════════════════════════════
  //  ANALYTICS (GA4)
  // ═══════════════════════════════════════════

  var analyticsLoaded = false;
  var ga4Charts = {};

  function loadAnalytics() {
    if (!analyticsLoaded) {
      analyticsLoaded = true;
      document.getElementById('ga4-range').addEventListener('change', function() {
        fetchGA4Data(parseInt(this.value));
      });
    }
    fetchGA4Data(parseInt(document.getElementById('ga4-range').value));
  }

  async function ga4Report(report) {
    var res = await fetch(ADMIN_CONFIG.WORKER_URL + '/ga4', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + ADMIN_CONFIG.ADMIN_CHAT_TOKEN,
      },
      body: JSON.stringify({
        propertyId: ADMIN_CONFIG.GA4_PROPERTY_ID,
        report: report,
      }),
    });
    return await res.json();
  }

  async function fetchGA4Data(days) {
    var startDate = days + 'daysAgo';
    var endDate = 'today';

    try {
      // Lanzar todas las queries en paralelo
      var results = await Promise.all([
        // Sesiones totales + usuarios
        ga4Report({
          dateRanges: [{ startDate: startDate, endDate: endDate }],
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'newUsers' }, { name: 'averageSessionDuration' }],
        }),
        // Visitas por día
        ga4Report({
          dateRanges: [{ startDate: startDate, endDate: endDate }],
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'sessions' }],
          orderBys: [{ dimension: { dimensionName: 'date' } }],
        }),
        // Fuentes de tráfico
        ga4Report({
          dateRanges: [{ startDate: startDate, endDate: endDate }],
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          metrics: [{ name: 'sessions' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 8,
        }),
        // Dispositivos
        ga4Report({
          dateRanges: [{ startDate: startDate, endDate: endDate }],
          dimensions: [{ name: 'deviceCategory' }],
          metrics: [{ name: 'sessions' }],
        }),
        // Países
        ga4Report({
          dateRanges: [{ startDate: startDate, endDate: endDate }],
          dimensions: [{ name: 'country' }],
          metrics: [{ name: 'sessions' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 10,
        }),
        // Páginas
        ga4Report({
          dateRanges: [{ startDate: startDate, endDate: endDate }],
          dimensions: [{ name: 'pagePath' }],
          metrics: [{ name: 'screenPageViews' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 10,
        }),
      ]);

      renderGA4Metrics(results[0]);
      renderGA4Visits(results[1]);
      renderGA4Sources(results[2]);
      renderGA4Devices(results[3]);
      renderGA4Table('ga4-countries', results[4]);
      renderGA4Table('ga4-pages', results[5]);
    } catch (err) {
      console.error('Error GA4:', err);
      document.getElementById('ga4-metrics').innerHTML =
        '<div class="metric-card"><span class="metric-icon">⚠️</span><span class="metric-value">Error</span><span class="metric-label">' + err.message + '</span></div>';
    }
  }

  function getGA4Rows(data) {
    return (data && data.rows) || [];
  }

  function renderGA4Metrics(data) {
    var rows = getGA4Rows(data);
    var sessions = 0, users = 0, newUsers = 0, avgDuration = 0;
    if (rows.length > 0) {
      sessions = parseInt(rows[0].metricValues[0].value) || 0;
      users = parseInt(rows[0].metricValues[1].value) || 0;
      newUsers = parseInt(rows[0].metricValues[2].value) || 0;
      avgDuration = parseFloat(rows[0].metricValues[3].value) || 0;
    }

    document.getElementById('ga4-metrics').innerHTML =
      '<div class="metric-card"><span class="metric-icon">👁️</span><span class="metric-value">' + sessions + '</span><span class="metric-label">Sesiones</span></div>' +
      '<div class="metric-card"><span class="metric-icon">👥</span><span class="metric-value">' + users + '</span><span class="metric-label">Usuarios</span></div>' +
      '<div class="metric-card"><span class="metric-icon">🆕</span><span class="metric-value">' + newUsers + '</span><span class="metric-label">Nuevos</span></div>' +
      '<div class="metric-card"><span class="metric-icon">⏱️</span><span class="metric-value">' + Math.round(avgDuration) + 's</span><span class="metric-label">Duración media</span></div>';
  }

  function renderGA4Visits(data) {
    var rows = getGA4Rows(data);
    var labels = [], values = [];
    rows.forEach(function(r) {
      var d = r.dimensionValues[0].value;
      labels.push(d.slice(4, 6) + '/' + d.slice(6, 8));
      values.push(parseInt(r.metricValues[0].value) || 0);
    });

    if (ga4Charts.visits) ga4Charts.visits.destroy();
    ga4Charts.visits = new Chart(document.getElementById('chart-visits'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{ label: 'Sesiones', data: values, borderColor: '#4361ee', backgroundColor: 'rgba(67,97,238,.1)', fill: true, tension: .3 }],
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#8b8fa3' }, grid: { color: 'rgba(255,255,255,.05)' } }, y: { ticks: { color: '#8b8fa3' }, grid: { color: 'rgba(255,255,255,.05)' }, beginAtZero: true } } },
    });
  }

  function renderGA4Sources(data) {
    var rows = getGA4Rows(data);
    var labels = [], values = [];
    var colors = ['#4361ee', '#06d6a0', '#ffd166', '#ef476f', '#8b8fa3', '#e0b84a', '#4cc9f0', '#f72585'];
    rows.forEach(function(r) {
      labels.push(r.dimensionValues[0].value);
      values.push(parseInt(r.metricValues[0].value) || 0);
    });

    if (ga4Charts.sources) ga4Charts.sources.destroy();
    ga4Charts.sources = new Chart(document.getElementById('chart-sources'), {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length) }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#8b8fa3', font: { size: 11 } } } } },
    });
  }

  function renderGA4Devices(data) {
    var rows = getGA4Rows(data);
    var labels = [], values = [];
    var colors = ['#4361ee', '#06d6a0', '#ffd166'];
    rows.forEach(function(r) {
      labels.push(r.dimensionValues[0].value);
      values.push(parseInt(r.metricValues[0].value) || 0);
    });

    if (ga4Charts.devices) ga4Charts.devices.destroy();
    ga4Charts.devices = new Chart(document.getElementById('chart-devices'), {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length) }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#8b8fa3', font: { size: 11 } } } } },
    });
  }

  function renderGA4Table(tableId, data) {
    var rows = getGA4Rows(data);
    var tbody = document.querySelector('#' + tableId + ' tbody');
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" style="color:var(--text-muted);padding:12px;">Sin datos</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function(r) {
      return '<tr><td>' + r.dimensionValues[0].value + '</td><td>' + (parseInt(r.metricValues[0].value) || 0) + '</td></tr>';
    }).join('');
  }

  // ═══════════════════════════════════════════
  //  SALMA (logs del Worker)
  // ═══════════════════════════════════════════

  var salmaLoaded = false;
  var salmaLogs = [];
  // Inicializar caché global vacío
  if (!window._salmaLogsCache) {
    window._salmaLogsCache = [];
  }

  function loadSalma() {
    if (salmaLoaded) return;
    salmaLoaded = true;

    document.getElementById('salma-filter-type').addEventListener('change', renderSalmaTable);
    document.getElementById('salma-filter-status').addEventListener('change', renderSalmaTable);
    document.getElementById('btn-refresh-salma').addEventListener('click', function() {
      salmaLoaded = false;
      loadSalma();
    });

    // Si hay caché en memoria, usarlo. Si no, cargar desde Firestore
    if (window._salmaLogsCache && window._salmaLogsCache.length > 0) {
      salmaLogs = window._salmaLogsCache;
      renderSalmaMetrics();
      renderSalmaTable();
      renderSalmaAlerts();
    } else {
      fetchSalmaLogs();
    }
  }

  async function fetchSalmaLogs() {
    var tbody = document.getElementById('salma-tbody');
    tbody.innerHTML = '<tr><td colspan="7"><div class="loading">Cargando logs...</div></td></tr>';

    try {
      // Leer admin_logs via Firebase SDK (con auth del admin)
      var snap = await db.collection('admin_logs').orderBy('timestamp', 'desc').limit(200).get();

      salmaLogs = [];
      snap.forEach(function(doc) {
        var d = doc.data();
        salmaLogs.push({
          timestamp: d.timestamp || '',
          type: d.type || '',
          user_message: d.user_message || '',
          chars_out: parseInt(d.chars_out) || 0,
          latency_ms: parseInt(d.latency_ms) || 0,
          status: d.status || '',
          error_detail: d.error_detail || '',
          model: d.model || '',
        });
      });

      // Guardar en localStorage y caché global
      window._salmaLogsCache = salmaLogs;
      try {
        localStorage.setItem('_salmaLogs', JSON.stringify(salmaLogs));
        localStorage.setItem('_salmaLogsTime', new Date().toISOString());
      } catch(e) {}

      renderSalmaMetrics();
      renderSalmaTable();
      renderSalmaAlerts();

      // Actualizar métrica en el dashboard si está cargado
      var salmaMetricEl = document.getElementById('m-salma');
      if (salmaMetricEl) {
        var today = new Date().toISOString().slice(0, 10);
        var salmaCalls = salmaLogs.filter(function(log) {
          return log.timestamp && log.timestamp.slice(0, 10) === today;
        }).length;
        salmaMetricEl.textContent = salmaCalls;
      }
    } catch (err) {
      console.error('Error cargando logs Salma:', err);
      tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-muted);padding:20px;text-align:center;">Sin logs disponibles: ' + err.message + '</td></tr>';
      renderSalmaMetrics();
    }
  }

  function renderSalmaMetrics() {
    var now = new Date();
    var today = now.toISOString().slice(0, 10);
    var weekAgo = daysAgo(7);

    var todayLogs = salmaLogs.filter(function(l) { return l.timestamp.slice(0, 10) === today; });
    var weekLogs = salmaLogs.filter(function(l) { return l.timestamp >= weekAgo; });
    var errorLogs = todayLogs.filter(function(l) { return l.status === 'error'; });

    var totalChars = todayLogs.reduce(function(s, l) { return s + l.chars_out; }, 0);
    var avgLatency = todayLogs.length > 0
      ? Math.round(todayLogs.reduce(function(s, l) { return s + l.latency_ms; }, 0) / todayLogs.length)
      : 0;
    var errorRate = todayLogs.length > 0
      ? Math.round((errorLogs.length / todayLogs.length) * 100)
      : 0;

    document.getElementById('salma-metrics').innerHTML =
      '<div class="metric-card"><span class="metric-icon">📊</span><span class="metric-value">' + todayLogs.length + ' / ' + weekLogs.length + ' / ' + salmaLogs.length + '</span><span class="metric-label">Hoy / Semana / Total</span></div>' +
      '<div class="metric-card"><span class="metric-icon">📝</span><span class="metric-value">' + totalChars.toLocaleString() + '</span><span class="metric-label">Chars generados hoy</span></div>' +
      '<div class="metric-card"><span class="metric-icon">⏱️</span><span class="metric-value">' + (avgLatency > 0 ? (avgLatency / 1000).toFixed(1) + 's' : '—') + '</span><span class="metric-label">Latencia media</span></div>' +
      '<div class="metric-card"><span class="metric-icon">⚠️</span><span class="metric-value">' + errorRate + '%</span><span class="metric-label">Tasa error hoy</span></div>';
  }

  function renderSalmaTable() {
    var filterType = document.getElementById('salma-filter-type').value;
    var filterStatus = document.getElementById('salma-filter-status').value;

    var filtered = salmaLogs.filter(function(l) {
      if (filterType && l.type !== filterType) return false;
      if (filterStatus && l.status !== filterStatus) return false;
      return true;
    });

    var tbody = document.getElementById('salma-tbody');
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-muted);padding:20px;text-align:center;">Sin logs' + (salmaLogs.length === 0 ? '. Despliega el Worker con logging.' : ' con estos filtros.') + '</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.slice(0, 50).map(function(l) {
      var time = l.timestamp ? new Date(l.timestamp).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '—';
      var typeBadge = '<span class="type-badge ' + l.type + '">' + (l.type === 'route' ? 'Ruta' : 'Conv') + '</span>';
      var statusClass = l.status === 'error' ? 'status-error' : 'status-ok';
      var msg = l.user_message.length > 60 ? l.user_message.slice(0, 60) + '...' : l.user_message;
      return '<tr' + (l.status === 'error' ? ' style="background:rgba(239,71,111,.08)"' : '') + '>' +
        '<td>' + time + '</td>' +
        '<td>' + typeBadge + '</td>' +
        '<td title="' + l.user_message.replace(/"/g, '&quot;') + '">' + msg + '</td>' +
        '<td>' + l.chars_out.toLocaleString() + '</td>' +
        '<td>' + (l.latency_ms / 1000).toFixed(1) + 's</td>' +
        '<td style="font-size:11px">' + (l.model || '—').replace('claude-', '') + '</td>' +
        '<td class="' + statusClass + '">' + l.status + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderSalmaAlerts() {
    var alertEl = document.getElementById('salma-alert');
    var now = new Date();
    var twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();
    var sixHoursAgo = new Date(now - 6 * 60 * 60 * 1000).toISOString();

    var recentLogs = salmaLogs.filter(function(l) { return l.timestamp >= twoHoursAgo; });
    var recentErrors = recentLogs.filter(function(l) { return l.status === 'error'; });
    var errorRate = recentLogs.length > 0 ? (recentErrors.length / recentLogs.length) * 100 : 0;

    var lastLog = salmaLogs.length > 0 ? salmaLogs[0].timestamp : '';
    var hour = now.getHours();
    var isBusinessHours = hour >= 8 && hour <= 23;

    if (errorRate > 10 && recentLogs.length >= 3) {
      alertEl.style.display = 'block';
      alertEl.className = 'salma-alert red';
      alertEl.textContent = 'Tasa de error alta: ' + Math.round(errorRate) + '% en las últimas 2 horas (' + recentErrors.length + '/' + recentLogs.length + ' peticiones)';
    } else if (isBusinessHours && lastLog && lastLog < sixHoursAgo) {
      alertEl.style.display = 'block';
      alertEl.className = 'salma-alert yellow';
      alertEl.textContent = 'Sin peticiones en las últimas 6 horas (último log: ' + new Date(lastLog).toLocaleString('es-ES') + ')';
    } else {
      alertEl.style.display = 'none';
    }
  }

  // ═══════════════════════════════════════════
  //  CHAT con Claude
  // ═══════════════════════════════════════════

  var chatLoaded = false;
  var chatHistory = []; // { role, content }
  var chatSystemPrompt = '';

  function loadChat() {
    if (chatLoaded) return;
    chatLoaded = true;

    buildSystemPrompt();

    document.getElementById('chat-form').addEventListener('submit', function(e) {
      e.preventDefault();
      sendChatMessage();
    });

    // Auto-resize textarea
    var input = document.getElementById('chat-input');
    input.addEventListener('input', function() {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    // Enter para enviar, Shift+Enter para nueva línea
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });

    document.getElementById('btn-new-chat').addEventListener('click', function() {
      chatHistory = [];
      document.getElementById('chat-messages').innerHTML = '<div class="chat-welcome">Chat limpio. Pregúntame lo que necesites.</div>';
    });

    document.getElementById('btn-refresh-context').addEventListener('click', function() {
      buildSystemPrompt();
      addChatMessage('system', 'Contexto del proyecto actualizado.');
    });
  }

  function buildSystemPrompt() {
    var parts = [];
    parts.push('Eres el asistente técnico del proyecto Borrado del Mapa. Tu rol es ayudar al propietario (Paco) con desarrollo, debugging, decisiones de producto y estado del proyecto.');
    parts.push('Stack: HTML/CSS/JS vanilla + Firebase 8.10.1 (Auth + Firestore) + Cloudflare Worker → Anthropic Claude API + Google Maps/Places.');
    parts.push('Repo: github.com/borradodelmapa/borradodelmapa');
    parts.push('Normas: No API keys en código público. Commits en español. No refactorizar sin confirmar. Revertir antes de parchear.');

    // Estado del proyecto si está cargado
    if (projectData) {
      parts.push('\n--- ESTADO DEL PROYECTO ---');
      parts.push('Worker version: ' + (projectData.current_worker_version || '?'));
      parts.push('Último deploy: ' + (projectData.last_deploy_note || '?'));
      var phases = projectData.phases || {};
      Object.keys(phases).forEach(function(pid) {
        var p = phases[pid];
        var tasks = p.tasks || [];
        var done = tasks.filter(function(t) { return t.status === 'done'; }).length;
        parts.push('\n' + pid + ' ' + p.name + ' (' + p.status + '): ' + done + '/' + tasks.length + ' tareas');
        tasks.forEach(function(t) {
          var icon = t.status === 'done' ? '✅' : t.status === 'in_progress' ? '🔨' : t.status === 'designed' ? '📐' : '⬜';
          parts.push('  ' + icon + ' ' + t.task + ' [' + t.status + ']');
        });
      });
      if (projectData.changelog && projectData.changelog.length > 0) {
        parts.push('\nÚltimos cambios:');
        projectData.changelog.slice(0, 5).forEach(function(c) {
          parts.push('- ' + c.date + ': ' + c.change);
        });
      }
    }

    // Métricas si hay
    var mUsuarios = document.getElementById('m-usuarios');
    var mRutas = document.getElementById('m-rutas');
    if (mUsuarios && mUsuarios.textContent !== '—') {
      parts.push('\n--- MÉTRICAS ---');
      parts.push('Usuarios: ' + mUsuarios.textContent);
      parts.push('Rutas: ' + mRutas.textContent);
    }

    chatSystemPrompt = parts.join('\n');
  }

  function addChatMessage(role, content) {
    var container = document.getElementById('chat-messages');
    var welcome = container.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    var div = document.createElement('div');
    div.className = 'chat-msg ' + (role === 'user' ? 'user' : role === 'system' ? 'thinking' : 'assistant');
    div.textContent = content;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  }

  async function sendChatMessage() {
    var input = document.getElementById('chat-input');
    var message = input.value.trim();
    if (!message) return;

    input.value = '';
    input.style.height = 'auto';

    addChatMessage('user', message);
    chatHistory.push({ role: 'user', content: message });

    var thinkingDiv = addChatMessage('assistant', 'Pensando...');
    document.getElementById('chat-send').disabled = true;

    try {
      var res = await fetch(ADMIN_CONFIG.WORKER_URL + '/admin-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + ADMIN_CONFIG.ADMIN_CHAT_TOKEN,
        },
        body: JSON.stringify({
          system: chatSystemPrompt,
          messages: chatHistory,
          model: 'claude-sonnet-4-6',
        }),
      });

      var data = await res.json();

      if (data.error) {
        thinkingDiv.textContent = 'Error: ' + data.error;
        thinkingDiv.className = 'chat-msg thinking';
      } else {
        var reply = (data.content && data.content[0] && data.content[0].text) || 'Sin respuesta';
        thinkingDiv.textContent = reply;
        thinkingDiv.className = 'chat-msg assistant';
        chatHistory.push({ role: 'assistant', content: reply });
      }
    } catch (err) {
      thinkingDiv.textContent = 'Error de conexión: ' + err.message;
      thinkingDiv.className = 'chat-msg thinking';
    }

    document.getElementById('chat-send').disabled = false;
    document.getElementById('chat-messages').scrollTop = document.getElementById('chat-messages').scrollHeight;
  }

  // ═══════════════════════════════════════════
  //  CONFIGURACIÓN (Settings)
  // ═══════════════════════════════════════════

  function initSettings() {
    var btnClear = document.getElementById('btn-clear-cache');
    if (!btnClear) return;

    btnClear.addEventListener('click', async function() {
      btnClear.disabled = true;
      btnClear.textContent = 'Limpiando...';
      var statusDiv = document.getElementById('cache-status');
      statusDiv.style.display = 'block';
      statusDiv.textContent = 'Limpiando caché...';

      try {
        if ('caches' in window) {
          var cacheNames = await caches.keys();
          var promises = cacheNames.map(function(cacheName) {
            return caches.delete(cacheName);
          });
          await Promise.all(promises);
          statusDiv.textContent = '✅ Caché limpiado. Recargando...';
          setTimeout(function() {
            window.location.reload();
          }, 1000);
        } else {
          statusDiv.textContent = '❌ No se puede limpiar el caché en este navegador';
          btnClear.disabled = false;
          btnClear.textContent = 'Limpiar caché y recargar';
        }
      } catch (err) {
        statusDiv.textContent = '❌ Error: ' + err.message;
        btnClear.disabled = false;
        btnClear.textContent = 'Limpiar caché y recargar';
      }
    });
  }

  // ═══════════════════════════════════════════
  //  MODAL GENÉRICO
  // ═══════════════════════════════════════════

  function showModal(title, fields, onSave) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    var html = '<div class="modal"><h3>' + title + '</h3>';
    fields.forEach(function(f) {
      html += '<label style="font-size:12px;color:var(--text-secondary)">' + f.label + '</label>';
      if (f.type === 'select') {
        html += '<select name="' + f.name + '">';
        (f.options || []).forEach(function(opt) {
          html += '<option value="' + opt + '">' + opt + '</option>';
        });
        html += '</select>';
      } else if (f.type === 'textarea') {
        html += '<textarea name="' + f.name + '">' + (f.value || '') + '</textarea>';
      } else {
        html += '<input type="' + f.type + '" name="' + f.name + '" value="' + (f.value || '') + '">';
      }
    });
    html += '<div class="modal-actions">';
    html += '<button class="btn-sm secondary modal-cancel">Cancelar</button>';
    html += '<button class="btn-sm modal-save">Guardar</button>';
    html += '</div></div>';

    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    overlay.querySelector('.modal-cancel').addEventListener('click', function() {
      document.body.removeChild(overlay);
    });

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) document.body.removeChild(overlay);
    });

    overlay.querySelector('.modal-save').addEventListener('click', function() {
      var data = {};
      fields.forEach(function(f) {
        var el = overlay.querySelector('[name="' + f.name + '"]');
        data[f.name] = el ? el.value : '';
      });
      document.body.removeChild(overlay);
      onSave(data);
    });
  }

})();
