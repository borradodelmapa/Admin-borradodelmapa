/* ═══════════════════════════════════════════
   ADMIN BORRADO DEL MAPA — Lógica principal
   Login + Tabs + Firebase + Dashboard + Usuarios
   ═══════════════════════════════════════════ */

(function() {
  'use strict';

  const SESSION_KEY = 'bdm_admin_token';
  var db = null; // Se inicializa tras login

  // ─── UTILS ───

  // Cabeceras para el Worker: usa la sesión de Firebase del admin (ID token, se renueva solo).
  // No hay ningún token fijo en el navegador — el Worker lo valida contra Google (isAdminRequest).
  async function adminAuthHeaders(extra) {
    var headers = Object.assign({}, extra || {});
    var user = firebase.auth().currentUser;
    if (user) {
      headers['Authorization'] = 'Bearer ' + (await user.getIdToken());
    }
    return headers;
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

  // ─── VERSIÓN VISIBLE ───
  // Insignia abajo a la derecha: versión del panel (ADMIN_VERSION, la que tiene cargada ESTE navegador)
  // + versión del Worker en producción (/version, público). Sirve para saber qué se está viendo de verdad.
  (function showVersion() {
    var el = document.getElementById('version-badge');
    if (!el) return;
    var panel = 'Panel ' + (ADMIN_CONFIG.ADMIN_VERSION || '?');
    el.textContent = panel + ' · Worker …';
    fetch(ADMIN_CONFIG.WORKER_URL + '/version', { cache: 'no-store' })
      .then(function(r) { return r.json(); })
      .then(function(d) { el.textContent = panel + ' · Worker ' + (d.version_short || '?'); })
      .catch(function() { el.textContent = panel + ' · Worker sin respuesta'; });
  })();

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

    // Autenticar directamente con Firebase Auth (ya no hay hash de contraseña en el navegador:
    // Firebase comprueba la contraseña en su servidor y limita los intentos).
    try {
      await firebase.auth().signInWithEmailAndPassword(ADMIN_CONFIG.ADMIN_EMAIL, password);
      sessionStorage.setItem(SESSION_KEY, Date.now().toString());
      appShown = true;
      showApp();
    } catch (err) {
      var code = (err && err.code) || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/invalid-login-credentials') {
        loginError.textContent = 'Contraseña incorrecta';
        loginPassword.value = '';
        loginPassword.focus();
      } else if (code === 'auth/too-many-requests') {
        loginError.textContent = 'Demasiados intentos. Espera unos minutos.';
      } else {
        loginError.textContent = 'Error de autenticación Firebase';
      }
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
      }
      if (tabId === 'usuarios') loadUsuarios();
      if (tabId === 'analytics') loadAnalytics();
      if (tabId === 'settings') initSettings();
    }
  }

  // ─── LOGO → DASHBOARD ───

  document.getElementById('header-logo').addEventListener('click', function() {
    navigateTo('dashboard');
    closeMobileMenu();
  });

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

  }

  async function checkWorkerHealth() {
    var dots = {
      worker: document.getElementById('health-worker'),
      openai: document.getElementById('health-openai'),
      google_places: document.getElementById('health-places'),
      booking_hotels: document.getElementById('health-booking-hotels'),
      booking_cars: document.getElementById('health-booking-cars'),
      duffel_flights: document.getElementById('health-duffel')
    };

    // Poner todos en gris mientras carga
    Object.values(dots).forEach(function(d) { if (d) d.className = 'health-dot grey'; });

    try {
      var res = await fetch(ADMIN_CONFIG.WORKER_URL + '/health', { headers: await adminAuthHeaders() });
      var data = await res.json();
      if (res.status === 401) throw new Error('No autorizado — vuelve a iniciar sesión');

      // Worker siempre ok si llegamos aquí
      if (dots.worker) dots.worker.className = 'health-dot green';

      // Cada API individual
      var checks = data.checks || {};
      Object.keys(dots).forEach(function(key) {
        if (key === 'worker') return;
        var check = checks[key];
        if (dots[key] && check) {
          dots[key].className = 'health-dot ' + (check.status === 'ok' ? 'green' : 'red');
          dots[key].title = check.status === 'ok' ? check.ms + 'ms' : (check.error || 'Error ' + check.code);
        }
      });
    } catch (e) {
      Object.values(dots).forEach(function(d) { if (d) d.className = 'health-dot red'; });
    }
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
      headers: await adminAuthHeaders({ 'Content-Type': 'application/json' }),
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
        datasets: [{ label: 'Sesiones', data: values, borderColor: '#F4630B', backgroundColor: 'rgba(244,99,11,.14)', fill: true, tension: .3 }],
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#7E8285' }, grid: { color: 'rgba(255,255,255,.05)' } }, y: { ticks: { color: '#7E8285' }, grid: { color: 'rgba(255,255,255,.05)' }, beginAtZero: true } } },
    });
  }

  function renderGA4Sources(data) {
    var rows = getGA4Rows(data);
    var labels = [], values = [];
    var colors = ['#F4630B', '#43d977', '#ffd166', '#ff5a5a', '#7E8285', '#e0b84a', '#4cc9f0', '#f72585'];
    rows.forEach(function(r) {
      labels.push(r.dimensionValues[0].value);
      values.push(parseInt(r.metricValues[0].value) || 0);
    });

    if (ga4Charts.sources) ga4Charts.sources.destroy();
    ga4Charts.sources = new Chart(document.getElementById('chart-sources'), {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length) }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#7E8285', font: { size: 11 } } } } },
    });
  }

  function renderGA4Devices(data) {
    var rows = getGA4Rows(data);
    var labels = [], values = [];
    var colors = ['#F4630B', '#43d977', '#ffd166'];
    rows.forEach(function(r) {
      labels.push(r.dimensionValues[0].value);
      values.push(parseInt(r.metricValues[0].value) || 0);
    });

    if (ga4Charts.devices) ga4Charts.devices.destroy();
    ga4Charts.devices = new Chart(document.getElementById('chart-devices'), {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length) }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#7E8285', font: { size: 11 } } } } },
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
