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
        loadGastosQuick();
        loadResumen();
      }
      if (tabId === 'gastos') loadGastos();
      if (tabId === 'ingresos') loadIngresos();
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

  // Estadísticas de usuarios y guías: las lee el Worker con su cuenta de servicio (GET /admin/stats). El panel no puede leer
  // Firestore directo: las reglas solo dejan a cada usuario su propio documento. Caché de 20 s para que Dashboard y Usuarios
  // no lo pidan dos veces seguidas.
  var statsCache = { at: 0, data: null };
  async function fetchAdminStats(force) {
    if (!force && statsCache.data && Date.now() - statsCache.at < 20000) return statsCache.data;
    var res = await fetch(ADMIN_CONFIG.WORKER_URL + '/admin/stats', { headers: await adminAuthHeaders(), cache: 'no-store' });
    var data = await res.json().catch(function() { return {}; });
    if (res.status === 401) throw new Error('Sesión caducada o sin permiso: vuelve a entrar en el panel.');
    if (!res.ok) throw new Error(data.error || ('El Worker respondió ' + res.status + '.'));
    statsCache = { at: Date.now(), data: data };
    return data;
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  async function loadDashboardMetrics() {
    try {
      var t = (await fetchAdminStats()).totals;
      document.getElementById('m-usuarios').textContent = t.users;
      var trend7 = document.getElementById('m-usuarios-trend');
      if (t.users7 > 0) { trend7.textContent = '+' + t.users7 + ' esta semana'; trend7.className = 'metric-trend up'; }
      document.getElementById('m-rutas').textContent = t.guides;
      var trendRutas = document.getElementById('m-rutas-trend');
      if (t.guides7 > 0) { trendRutas.textContent = '+' + t.guides7 + ' esta semana'; trendRutas.className = 'metric-trend up'; }
    } catch (err) {
      console.warn('Estadísticas del dashboard no disponibles:', err && err.message);
      document.getElementById('m-usuarios').textContent = '—';
      document.getElementById('m-rutas').textContent = '—';
    }
  }

  // Resumen del mes del Dashboard: junta ingresos (Stripe), gastos (Google + Claude, estimados), margen y usuarios.
  // Cada dato se pide por separado: si uno falla, ese hueco queda en "—" y el resto se pinta igual.
  var resumenWired = false;
  async function loadResumen() {
    if (!resumenWired) {
      resumenWired = true;
      [['rs-card-ingresos', 'ingresos'], ['rs-card-gastos', 'gastos'], ['rs-card-usuarios', 'usuarios']].forEach(function(p) {
        var el = document.getElementById(p[0]);
        el.addEventListener('click', function() { navigateTo(p[1]); });
        el.addEventListener('keydown', function(e) { if (e.key === 'Enter') navigateTo(p[1]); });
      });
    }
    var $ = function(id) { return document.getElementById(id); };
    var hdrs = await adminAuthHeaders();
    var getJson = async function(path) {
      var r = await fetch(ADMIN_CONFIG.WORKER_URL + path, { headers: hdrs, cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    };
    var rev = null, gg = null, st = null;
    await Promise.all([
      getJson('/admin/revenue').then(function(x) { rev = x; }).catch(function() {}),
      googleMonthCost().then(function(x) { gg = x; }),
      fetchAdminStats().then(function(x) { st = x; }).catch(function() {})
    ]);

    var ingresos = rev ? rev.totals.month : null;
    var googleEur = gg ? gg.eur : null;
    var claudeEur = (st && st.totals && typeof st.totals.claude_usd === 'number') ? st.totals.claude_usd * USD_TO_EUR : null;

    if (ingresos !== null) {
      $('rs-ingresos').textContent = fmtEur(ingresos);
      $('rs-ingresos-label').textContent = 'Ingresos del mes · ' + rev.totals.month_count + (rev.totals.month_count === 1 ? ' compra' : ' compras') + (rev.mode === 'test' ? ' · PRUEBA' : '');
    } else { $('rs-ingresos').textContent = '—'; $('rs-ingresos-label').textContent = 'Ingresos del mes · sin datos'; }

    if (googleEur !== null || claudeEur !== null) {
      $('rs-gastos').textContent = fmtEur((googleEur || 0) + (claudeEur || 0));
      $('rs-gastos-label').textContent = (gg && gg.real ? 'Gastos · Google REAL ' : 'Gastos est. · Google ') + (googleEur === null ? '—' : fmtEur(googleEur)) + ' + Claude ' + (claudeEur === null ? '—' : fmtEur(claudeEur));
    } else { $('rs-gastos').textContent = '—'; $('rs-gastos-label').textContent = 'Gastos estimados · sin datos'; }

    var mEl = $('rs-margen');
    if (ingresos !== null && (googleEur !== null || claudeEur !== null)) {
      var neto = ingresos / IVA, margen = neto - (googleEur || 0) - (claudeEur || 0);
      mEl.textContent = fmtEur(margen); mEl.className = 'metric-value' + (margen < 0 ? ' danger' : '');
      $('rs-margen-label').textContent = 'Margen estimado (ingresos sin IVA − gastos)';
    } else { mEl.textContent = '—'; mEl.className = 'metric-value'; $('rs-margen-label').textContent = 'Margen estimado · faltan datos'; }

    if (st && st.totals) {
      $('rs-usuarios').textContent = st.totals.users;
      $('rs-usuarios-label').textContent = 'Usuarios · ' + st.totals.premium + ' Premium · ' + st.totals.guides + ' guías';
    } else { $('rs-usuarios').textContent = '—'; $('rs-usuarios-label').textContent = 'Usuarios · sin datos'; }

    var falta = [];
    if (!rev) falta.push('Ingresos'); if (!gg) falta.push('Google'); if (!st) falta.push('Usuarios');
    $('rs-nota').textContent = falta.length ? 'No se pudo leer: ' + falta.join(', ') + '. Entra en su pestaña para ver el motivo.' : 'Los gastos son estimaciones (Google a precios de lista, Claude por tokens); los ingresos son brutos de Stripe' + (rev.mode === 'test' ? ' en MODO PRUEBA (no es dinero real)' : '') + '. No incluye Duffel, RapidAPI, Twilio ni otros proveedores.';
  }

  var HEALTH_LABELS = { worker: 'Worker', anthropic: 'Anthropic', openai: 'OpenAI', google_places: 'Google Places', booking_hotels: 'Hotels', booking_cars: 'Cars', duffel_flights: 'Flights' };

  // Comprueba la salud del Worker y repinta los puntos del Dashboard. `force` pide una comprobación REAL (?force=1); sin él el
  // Worker responde con la última guardada (<10 min) para no gastar llamadas de pago cada vez. Devuelve un resumen.
  async function checkWorkerHealth(force) {
    var dots = {
      worker: document.getElementById('health-worker'),
      anthropic: document.getElementById('health-anthropic'),
      openai: document.getElementById('health-openai'),
      google_places: document.getElementById('health-places'),
      booking_hotels: document.getElementById('health-booking-hotels'),
      booking_cars: document.getElementById('health-booking-cars'),
      duffel_flights: document.getElementById('health-duffel')
    };

    // Poner todos en gris mientras carga
    Object.values(dots).forEach(function(d) { if (d) d.className = 'health-dot grey'; });

    var summary = { failing: [], total: 0, cached: false, error: '' };
    try {
      var res = await fetch(ADMIN_CONFIG.WORKER_URL + '/health' + (force ? '?force=1' : ''), { headers: await adminAuthHeaders() });
      var data = await res.json();
      if (res.status === 401) throw new Error('No autorizado — vuelve a iniciar sesión');

      // Worker siempre ok si llegamos aquí
      if (dots.worker) dots.worker.className = 'health-dot green';
      summary.total = 1;

      // Cada API individual
      var checks = data.checks || {};
      summary.cached = !!data.cached;
      Object.keys(dots).forEach(function(key) {
        if (key === 'worker') return;
        var check = checks[key];
        if (dots[key] && check) {
          summary.total++;
          dots[key].className = 'health-dot ' + (check.status === 'ok' ? 'green' : 'red');
          dots[key].title = check.status === 'ok' ? check.ms + 'ms' : (check.error || 'Error ' + check.code);
          if (check.status !== 'ok') summary.failing.push(HEALTH_LABELS[key] || key);
        }
      });
    } catch (e) {
      Object.values(dots).forEach(function(d) { if (d) d.className = 'health-dot red'; });
      summary.error = (e && e.message) ? e.message : 'No se pudo comprobar';
    }
    return summary;
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
          usersSortDir = (field === 'createdAt' || field === 'mapsCount' || field === 'usage_msgs') ? 'desc' : 'asc';
        }
        renderUsersTable();
      });
    });

    fetchUsers();
  }

  async function fetchUsers() {
    var tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '<tr><td colspan="6"><div class="loading">Cargando usuarios...</div></td></tr>';

    try {
      var stats = await fetchAdminStats(true);
      allUsers = (stats.users || []).map(function(u) {
        return {
          _id: u.uid, name: u.name, email: u.email, createdAt: u.createdAt,
          premium_active: !!u.premium_active, premium_until: u.premium_until,
          mapsCount: u.guides || 0, _realMaps: u.guides || 0,
          usage_msgs: (u.usage && u.usage.msgs) || 0,
          usage_usd: (u.usage && u.usage.claude_usd) || 0
        };
      });
      renderUsersTable();
      renderUsersMetrics();
      if (stats.truncated && (stats.truncated.users || stats.truncated.guides)) {
        console.warn('Estadísticas truncadas: hay más datos de los que se muestran.');
      }
    } catch (err) {
      console.error('Error cargando usuarios:', err);
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--red);padding:20px;">No se pudieron cargar los usuarios: ' + escHtml(err && err.message) + '</td></tr>';
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
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text-muted);padding:20px;text-align:center;">' +
        (usersFilter ? 'Sin resultados para "' + escHtml(usersFilter) + '"' : 'No hay usuarios') + '</td></tr>';
    } else {
      tbody.innerHTML = pageUsers.map(function(u) {
        var plan = u.premium_active ? 'Premium hasta ' + formatDate(u.premium_until) : 'Gratis';
        var uso = u.usage_msgs ? (u.usage_msgs + ' msg · ' + '≈ ' + fmtEur(u.usage_usd * 0.92)) : '—';
        return '<tr>' +
          '<td>' + escHtml(u.name || '—') + '</td>' +
          '<td>' + escHtml(u.email || '—') + '</td>' +
          '<td>' + formatDate(u.createdAt) + '</td>' +
          '<td>' + escHtml(plan) + '</td>' +
          '<td>' + (u._realMaps || 0) + '</td>' +
          '<td>' + escHtml(uso) + '</td>' +
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
  //  GASTOS EN GOOGLE (estimación del Worker: GET /admin/google-usage)
  // ═══════════════════════════════════════════

  var gastosWired = false;

  function fmtEur(n) {
    return (Number(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  // Verde hasta el 60 %, ámbar hasta el 90 %, rojo a partir de ahí
  function gastosLevel(pct) { return pct >= 90 ? 'danger' : (pct >= 60 ? 'warn' : ''); }

  function gastosBar(barEl, valueEl, pct) {
    var lvl = gastosLevel(pct);
    barEl.style.width = Math.min(100, Math.max(0, pct)) + '%';
    barEl.className = 'bar-fill' + (lvl ? ' ' + lvl : '');
    if (valueEl) valueEl.className = 'metric-value' + (lvl ? ' ' + lvl : '');
  }

  function gastosRow(name, eur, sub, pct) {
    var row = document.createElement('div');
    row.className = 'g-row';
    var top = document.createElement('div');
    top.className = 'g-row-top';
    var n = document.createElement('span'); n.className = 'g-row-name'; n.textContent = name;
    var e = document.createElement('span'); e.className = 'g-row-eur'; e.textContent = eur;
    top.appendChild(n); top.appendChild(e); row.appendChild(top);
    if (sub) { var s = document.createElement('div'); s.className = 'g-row-sub'; s.textContent = sub; row.appendChild(s); }
    if (typeof pct === 'number') {
      var bar = document.createElement('div'); bar.className = 'bar';
      var fill = document.createElement('div'); fill.className = 'bar-fill';
      gastosBar(fill, null, pct);
      bar.appendChild(fill); row.appendChild(bar);
    }
    return row;
  }

  function gastosDayLabel(iso, i) {
    if (i === 0) return 'Hoy';
    if (i === 1) return 'Ayer';
    var d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
  }

  function gastosShowError(msg) {
    var box = document.getElementById('g-error');
    box.textContent = msg;
    box.style.display = msg ? 'block' : 'none';
  }

  // Pinta las dos tarjetas (hoy y mes) frente a su tope. `p` es el prefijo de los ids: 'g' (pestaña Gastos) o 'dg' (Dashboard).
  function paintGastosCards(p, data) {
    var caps = data.caps || {};
    var dayCap = Number(caps.daily_eur) || 0, monCap = Number(caps.monthly_eur) || 0;
    var today = (data.days || [])[0] || { eur: 0, calls: {} };
    var $ = function(s) { return document.getElementById(p + '-' + s); };

    var hoyPct = dayCap ? (today.eur / dayCap) * 100 : 0;
    $('hoy').textContent = fmtEur(today.eur);
    $('hoy-label').textContent = 'Hoy · tope ' + fmtEur(dayCap) + ' (' + Math.round(hoyPct) + ' %)';
    gastosBar($('hoy-bar'), $('hoy'), hoyPct);

    var monEur = (data.month && data.month.eur) || 0;
    var monPct = monCap ? (monEur / monCap) * 100 : 0;
    $('mes').textContent = fmtEur(monEur);
    $('mes-label').textContent = 'Este mes · tope ' + fmtEur(monCap) + ' (' + Math.round(monPct) + ' %)';
    gastosBar($('mes-bar'), $('mes'), monPct);
  }

  // Vista rápida en el Dashboard: se refresca cada vez que se entra. Si falla, no molesta: deja "—" y lo dice.
  var dashGastosWired = false;
  async function loadGastosQuick() {
    if (!dashGastosWired) {
      dashGastosWired = true;
      var box = document.getElementById('dash-gastos');
      box.addEventListener('click', function() { navigateTo('gastos'); });
      box.addEventListener('keydown', function(e) { if (e.key === 'Enter') navigateTo('gastos'); });
    }
    try {
      var res = await fetch(ADMIN_CONFIG.WORKER_URL + '/admin/google-usage', { headers: await adminAuthHeaders(), cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      paintGastosCards('dg', await res.json());
    } catch (e) {
      document.getElementById('dg-hoy-label').textContent = 'Hoy · sin datos (entra en Gastos)';
      document.getElementById('dg-mes-label').textContent = 'Este mes · sin datos';
    }
  }

  function renderGastos(data) {
    var caps = data.caps || {};
    var dayCap = Number(caps.daily_eur) || 0;
    var days = data.days || [];
    var today = days[0] || { eur: 0, calls: {} };
    var unit = data.unit_eur || {};
    var labels = ADMIN_CONFIG.GOOGLE_SERVICE_LABELS || {};

    // Tarjetas: hoy y mes, con barra frente al tope
    paintGastosCards('g', data);

    var nCalls = Object.keys(today.calls || {}).reduce(function(a, k) { return a + (today.calls[k] || 0); }, 0);
    document.getElementById('g-llamadas').textContent = nCalls;

    // Últimos 8 días
    var dias = document.getElementById('g-dias');
    dias.innerHTML = '';
    days.forEach(function(d, i) {
      var calls = Object.keys(d.calls || {}).sort(function(a, b) { return (d.calls[b] || 0) - (d.calls[a] || 0); })
        .map(function(k) { return (labels[k] || k) + ' ' + d.calls[k]; }).join(' · ');
      dias.appendChild(gastosRow(gastosDayLabel(d.day, i), fmtEur(d.eur), calls || 'sin llamadas', dayCap ? (d.eur / dayCap) * 100 : 0));
    });

    // Hoy por servicio (coste estimado = llamadas × precio unitario), de mayor a menor
    var serv = document.getElementById('g-servicios');
    serv.innerHTML = '';
    var rows = Object.keys(today.calls || {}).map(function(k) {
      return { k: k, n: today.calls[k] || 0, eur: (today.calls[k] || 0) * (Number(unit[k]) || 0) };
    }).sort(function(a, b) { return b.eur - a.eur; });
    if (!rows.length) serv.appendChild(gastosRow('Sin llamadas a Google hoy', fmtEur(0), '', null));
    rows.forEach(function(r) {
      serv.appendChild(gastosRow(labels[r.k] || r.k, fmtEur(r.eur), r.n + ' llamadas · ' + fmtEur(unit[r.k]) + ' cada una (precio de lista)', today.eur ? (r.eur / today.eur) * 100 : 0));
    });

    // Candados en Google Cloud (informativo, viene de config.js)
    var cuotas = document.getElementById('g-cuotas');
    cuotas.innerHTML = '';
    (ADMIN_CONFIG.GOOGLE_QUOTAS || []).forEach(function(q) { cuotas.appendChild(gastosRow(q.api, q.dia, 'por día', null)); });

    document.getElementById('g-updated').textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  // Coste REAL de Google (GET /admin/google-real, lee la exportación de facturación de BigQuery). Devuelve el JSON o lanza
  // un Error con el aviso ya redactado para Paco según el código que devuelva el Worker.
  async function fetchGoogleReal(force) {
    var res = await fetch(ADMIN_CONFIG.WORKER_URL + '/admin/google-real' + (force ? '?force=1' : ''), { headers: await adminAuthHeaders(), cache: 'no-store' });
    var d = await res.json().catch(function() { return {}; });
    if (res.status === 401) throw new Error('Sesión caducada o sin permiso: vuelve a entrar en el panel.');
    if (!res.ok) {
      if (d.code === 'no_permission') throw new Error('Google aún no ha activado el permiso de lectura de la facturación (puede tardar unos minutos). Reintenta con "Actualizar".');
      if (d.code === 'no_table') throw new Error('La tabla de facturación todavía no existe: Google la crea unas horas después de activar la exportación. Mañana debería estar.');
      throw new Error(d.error || ('El Worker respondió ' + res.status + '.'));
    }
    return d;
  }

  async function loadGoogleReal(force) {
    var box = document.getElementById('gr-error');
    box.style.display = 'none';
    try {
      var d = await fetchGoogleReal(force);
      document.getElementById('gr-hoy').textContent = fmtEur(d.today);
      document.getElementById('gr-ayer').textContent = fmtEur(d.yesterday);
      document.getElementById('gr-mes').textContent = fmtEur(d.month.eur);
      document.getElementById('gr-mes-label').textContent = 'Este mes' + (d.month.credits ? ' · créditos ' + fmtEur(-d.month.credits) : '');
      var sku = document.getElementById('gr-sku'); sku.innerHTML = '';
      if (!d.by_sku.length) sku.appendChild(gastosRow('Sin gasto este mes', '—', '', null));
      d.by_sku.forEach(function(s) { sku.appendChild(gastosRow(s.name, fmtEur(s.eur), '', d.month.eur > 0 ? Math.min(100, s.eur / d.month.eur * 100) : null)); });
      var dias = document.getElementById('gr-dias'); dias.innerHTML = '';
      d.days.forEach(function(x, i) { dias.appendChild(gastosRow(gastosDayLabel(x.day, i), fmtEur(x.eur), '', null)); });
      if (d.last_usage_at) document.getElementById('gr-note').textContent = 'Es lo que Google cobra de verdad (neto de créditos). Último dato de Google: ' + new Date(d.last_usage_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) + '. El dato de hoy siempre está incompleto.';
    } catch (e) {
      box.textContent = (e && e.message) ? e.message : 'No se pudo leer el coste real.';
      box.style.display = 'block';
    }
  }

  // Coste de Google de este mes para los márgenes: el REAL si ya está disponible, si no la estimación del Worker.
  async function googleMonthCost() {
    try { var r = await fetchGoogleReal(false); return { eur: r.month.eur, real: true }; } catch (e) {}
    try {
      var res = await fetch(ADMIN_CONFIG.WORKER_URL + '/admin/google-usage', { headers: await adminAuthHeaders(), cache: 'no-store' });
      if (res.ok) { var j = await res.json(); if (j.month && typeof j.month.eur === 'number') return { eur: j.month.eur, real: false }; }
    } catch (e) {}
    return null;
  }

  async function loadGastos(ev) {
    loadGoogleReal(!!(ev && ev.type === 'click'));
    if (!gastosWired) {
      gastosWired = true;
      document.getElementById('g-refresh').addEventListener('click', loadGastos);
    }
    var btn = document.getElementById('g-refresh');
    btn.disabled = true;
    gastosShowError('');
    try {
      var res = await fetch(ADMIN_CONFIG.WORKER_URL + '/admin/google-usage', { headers: await adminAuthHeaders(), cache: 'no-store' });
      if (res.status === 401) throw new Error('Sesión caducada o sin permiso: vuelve a entrar en el panel.');
      if (!res.ok) throw new Error('El Worker respondió ' + res.status + '.');
      renderGastos(await res.json());
    } catch (e) {
      gastosShowError('No se pudo cargar el gasto: ' + (e && e.message ? e.message : 'error de red') + ' Puedes reintentarlo con "Actualizar".');
    } finally {
      btn.disabled = false;
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
  //  INGRESOS (Stripe, vía GET /admin/revenue) + margen estimado
  // ═══════════════════════════════════════════

  var ingresosWired = false;
  var USD_TO_EUR = 0.92;   // solo para convertir el coste estimado de Claude (en USD) a euros
  var IVA = 1.21;          // los importes de Stripe llevan IVA incluido

  function ingresosError(msg) {
    var box = document.getElementById('r-error');
    box.textContent = msg;
    box.style.display = msg ? 'block' : 'none';
  }

  async function loadIngresos() {
    if (!ingresosWired) {
      ingresosWired = true;
      document.getElementById('r-refresh').addEventListener('click', function() { refreshIngresos(); });
    }
    refreshIngresos();
  }

  async function refreshIngresos() {
    var btn = document.getElementById('r-refresh');
    btn.disabled = true;
    ingresosError('');
    try {
      var res = await fetch(ADMIN_CONFIG.WORKER_URL + '/admin/revenue', { headers: await adminAuthHeaders(), cache: 'no-store' });
      var d = await res.json().catch(function() { return {}; });
      if (res.status === 401) throw new Error('Sesión caducada o sin permiso: vuelve a entrar en el panel.');
      if (!res.ok) throw new Error(d.error || ('El Worker respondió ' + res.status + '.'));
      var t = d.totals;

      var banner = document.getElementById('r-mode');
      banner.style.display = 'block';
      banner.textContent = d.mode === 'live' ? 'Stripe en modo REAL: estos importes son cobros de verdad.' : 'Stripe en MODO PRUEBA: estos importes son de mentira (tarjeta de test), no son dinero real.';
      banner.className = 'mode-banner ' + (d.mode === 'live' ? 'live' : 'test');

      document.getElementById('r-mes').textContent = fmtEur(t.month);
      document.getElementById('r-mes-label').textContent = 'Este mes · ' + t.month_count + (t.month_count === 1 ? ' compra' : ' compras');
      document.getElementById('r-30d').textContent = fmtEur(t.d30);
      document.getElementById('r-30d-label').textContent = 'Últimos 30 días · ' + t.d30_count + (t.d30_count === 1 ? ' compra' : ' compras');
      document.getElementById('r-total').textContent = fmtEur(t.gross);
      document.getElementById('r-total-label').textContent = 'Total cobrado · ' + t.count + (t.count === 1 ? ' compra' : ' compras') + (d.truncated ? ' (o más)' : '');

      var planes = document.getElementById('r-planes'); planes.innerHTML = '';
      if (!d.by_plan.length) planes.appendChild(gastosRow('Sin compras todavía', '—', '', null));
      d.by_plan.forEach(function(p) { planes.appendChild(gastosRow(p.label, fmtEur(p.gross), p.count + (p.count === 1 ? ' compra' : ' compras'), null)); });

      var rec = document.getElementById('r-recientes'); rec.innerHTML = '';
      if (!d.recent.length) rec.appendChild(gastosRow('Sin compras todavía', '—', '', null));
      d.recent.forEach(function(c) {
        var when = new Date(c.at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        rec.appendChild(gastosRow(c.label + ' · ' + (c.email || 'sin email'), fmtEur(c.amount), when, null));
      });

      // Margen estimado del mes: ingresos sin IVA − Google estimado − Claude estimado (si alguno de los dos costes falla, se dice)
      var googleEur = null, claudeEur = null, googleReal = false;
      var gm = await googleMonthCost(); if (gm) { googleEur = gm.eur; googleReal = gm.real; }
      try { var st = await fetchAdminStats(); if (st.totals && typeof st.totals.claude_usd === 'number') claudeEur = st.totals.claude_usd * USD_TO_EUR; } catch (e) {}
      var mEl = document.getElementById('r-margen'), mLabel = document.getElementById('r-margen-label');
      if (googleEur === null && claudeEur === null) {
        mEl.textContent = '—'; mEl.className = 'metric-value'; mLabel.textContent = 'Margen estimado: sin datos de costes';
      } else {
        var neto = t.month / IVA, margen = neto - (googleEur || 0) - (claudeEur || 0);
        mEl.textContent = fmtEur(margen); mEl.className = 'metric-value' + (margen < 0 ? ' danger' : '');
        mLabel.textContent = 'Margen est. del mes · ' + fmtEur(neto) + ' sin IVA − Google' + (googleReal ? ' (real) ' : ' ') + fmtEur(googleEur || 0) + ' − Claude ' + fmtEur(claudeEur || 0) + (googleEur === null || claudeEur === null ? ' (falta un coste)' : '');
      }
      document.getElementById('r-updated').textContent = 'Actualizado a las ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch (err) {
      ingresosError('No se pudieron cargar los ingresos: ' + ((err && err.message) ? err.message : 'sin conexión con el Worker.'));
    } finally {
      btn.disabled = false;
    }
  }

  // ═══════════════════════════════════════════
  //  CONFIGURACIÓN: versiones, topes de gasto, salud y cerrar sesión
  // ═══════════════════════════════════════════

  var settingsWired = false;

  function cfgMsg(id, text, isError) {
    var el = document.getElementById(id);
    el.textContent = text;
    el.style.color = isError ? 'var(--red)' : 'var(--green)';
  }

  function cfgSetValue(row, text) { row.querySelector('.g-row-eur').textContent = text; }

  // Se ejecuta cada vez que se entra en la pestaña: refresca versiones y topes actuales
  async function loadSettings() {
    var box = document.getElementById('cfg-versiones');
    box.innerHTML = '';
    var user = firebase.auth().currentUser;
    box.appendChild(gastosRow('Panel', ADMIN_CONFIG.ADMIN_VERSION || '?', '', null));
    var wRow = gastosRow('Worker', '…', '', null); box.appendChild(wRow);
    var dRow = gastosRow('Último despliegue del Worker', '…', '', null); box.appendChild(dRow);
    box.appendChild(gastosRow('Sesión', (user && user.email) ? user.email : '—', '', null));
    try {
      var v = await (await fetch(ADMIN_CONFIG.WORKER_URL + '/version', { cache: 'no-store' })).json();
      cfgSetValue(wRow, v.version_short || '?');
      var d = v.deployed_at ? new Date(v.deployed_at) : null;
      cfgSetValue(dRow, (d && !isNaN(d)) ? d.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
    } catch (e) { cfgSetValue(wRow, 'sin respuesta'); cfgSetValue(dRow, '—'); }

    try {
      var res = await fetch(ADMIN_CONFIG.WORKER_URL + '/admin/google-usage', { headers: await adminAuthHeaders(), cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var caps = (await res.json()).caps || {};
      document.getElementById('cfg-daily').value = caps.daily_eur;
      document.getElementById('cfg-monthly').value = caps.monthly_eur;
      cfgMsg('cfg-caps-msg', '', false);
    } catch (e) { cfgMsg('cfg-caps-msg', 'No se pudieron leer los topes actuales. Recarga la pestaña.', true); }
  }

  function initSettings() {
    if (!settingsWired) {
      settingsWired = true;   // los botones se enganchan UNA sola vez (antes se añadía un aviso de clic más en cada visita)

      // Guardar topes de gasto
      document.getElementById('cfg-caps-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        var btn = document.getElementById('cfg-caps-save');
        var daily = parseFloat(String(document.getElementById('cfg-daily').value).replace(',', '.'));
        var monthly = parseFloat(String(document.getElementById('cfg-monthly').value).replace(',', '.'));
        if (!isFinite(daily) || !isFinite(monthly)) { cfgMsg('cfg-caps-msg', 'Escribe los dos topes como números.', true); return; }
        if (!window.confirm('¿Cambiar los topes a ' + fmtEur(daily) + ' al día y ' + fmtEur(monthly) + ' al mes?')) return;
        btn.disabled = true;
        cfgMsg('cfg-caps-msg', 'Guardando…', false);
        try {
          var res = await fetch(ADMIN_CONFIG.WORKER_URL + '/admin/google-caps', {
            method: 'POST',
            headers: await adminAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ daily_eur: daily, monthly_eur: monthly })
          });
          var data = await res.json().catch(function() { return {}; });
          if (res.status === 401) throw new Error('Sesión caducada: vuelve a entrar en el panel.');
          if (!res.ok) throw new Error(data.error || ('El Worker respondió ' + res.status + '.'));
          document.getElementById('cfg-daily').value = data.caps.daily_eur;
          document.getElementById('cfg-monthly').value = data.caps.monthly_eur;
          cfgMsg('cfg-caps-msg', 'Guardado: ' + fmtEur(data.caps.daily_eur) + ' al día y ' + fmtEur(data.caps.monthly_eur) + ' al mes. Se aplica en menos de un minuto.', false);
        } catch (err) {
          cfgMsg('cfg-caps-msg', (err && err.message) ? err.message : 'No se pudo guardar.', true);
        } finally {
          btn.disabled = false;
        }
      });

      // Comprobación de salud real (?force=1)
      document.getElementById('cfg-health').addEventListener('click', async function() {
        var btn = this;
        btn.disabled = true;
        cfgMsg('cfg-health-msg', 'Comprobando los servicios…', false);
        var r = await checkWorkerHealth(true);
        btn.disabled = false;
        if (r.error) cfgMsg('cfg-health-msg', r.error, true);
        else if (r.failing.length) cfgMsg('cfg-health-msg', 'Fallan: ' + r.failing.join(', ') + '.', true);
        else cfgMsg('cfg-health-msg', 'Todo correcto: responden los ' + r.total + ' servicios.', false);
      });

      // Cerrar sesión
      document.getElementById('cfg-logout').addEventListener('click', async function() {
        this.disabled = true;
        try { await firebase.auth().signOut(); } catch (e) {}
        try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
        window.location.reload();
      });
    }
    loadSettings();
  }

})();
