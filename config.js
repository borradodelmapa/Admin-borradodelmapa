/* ═══════════════════════════════════════════
   ADMIN CONFIG — Constantes del panel
   ═══════════════════════════════════════════ */

const ADMIN_CONFIG = {
  // Versión del panel: súbela en CADA cambio (aquí y en los ?v= de index.html). Se ve abajo a la derecha.
  ADMIN_VERSION: '2026-09-26.3',

  // Firebase (mismo proyecto que borradodelmapa.com)
  FIREBASE: {
    apiKey: 'AIzaSyDjpJMEs-I_3bAR4OP2O9thKqecgNkpjkA',
    authDomain: 'borradodelmapa-85257.firebaseapp.com',
    projectId: 'borradodelmapa-85257',
    storageBucket: 'borradodelmapa-85257.firebasestorage.app',
    messagingSenderId: '833042338746',
    appId: '1:833042338746:web:32b58e582488c6064d8383'
  },

  // Email del admin para Firebase Auth
  ADMIN_EMAIL: 'admin@borradodelmapa.com',

  // Enlaces directos a las páginas de cada proveedor (una sola fuente; el panel los pinta donde hagan falta).
  // Si cambia un proyecto/cuenta, se cambia aquí y en ningún otro sitio.
  LINKS: {
    stripe:        { label: 'Stripe · pagos',              url: 'https://dashboard.stripe.com/test/payments', urlLive: 'https://dashboard.stripe.com/payments' },
    stripe_subs:   { label: 'Stripe · clientes',           url: 'https://dashboard.stripe.com/test/customers', urlLive: 'https://dashboard.stripe.com/customers' },
    google_bill:   { label: 'Google Cloud · facturación',  url: 'https://console.cloud.google.com/billing/012460-9B02AE-D84C54/reports?project=gen-lang-client-0108818247' },
    google_quotas: { label: 'Google · cuotas de Places',   url: 'https://console.cloud.google.com/google/maps-apis/quotas?project=gen-lang-client-0108818247&api=places-backend.googleapis.com' },
    google_budget: { label: 'Google · presupuesto y alertas', url: 'https://console.cloud.google.com/billing/012460-9B02AE-D84C54/budgets' },
    bigquery:      { label: 'BigQuery · exportación',      url: 'https://console.cloud.google.com/bigquery?project=gen-lang-client-0108818247' },
    anthropic:     { label: 'Anthropic · uso y coste',     url: 'https://console.anthropic.com/settings/cost' },
    openai:        { label: 'OpenAI · uso',                url: 'https://platform.openai.com/usage' },
    analytics:     { label: 'Google Analytics',            url: 'https://analytics.google.com/analytics/web/#/a256515663p352732094/reports/intelligenthome' },
    fb_users:      { label: 'Firebase · usuarios',         url: 'https://console.firebase.google.com/project/borradodelmapa-85257/authentication/users' },
    fb_feedback:   { label: 'Firebase · colección beta_feedback', url: 'https://console.firebase.google.com/project/borradodelmapa-85257/firestore/databases/-default-/data/~2Fbeta_feedback' },
    fb_data:       { label: 'Firebase · base de datos',    url: 'https://console.firebase.google.com/project/borradodelmapa-85257/firestore/data' },
    cloudflare:    { label: 'Cloudflare · Worker salma-api', url: 'https://dash.cloudflare.com/?to=/:account/workers/services/view/salma-api/production' },
    github_deploy: { label: 'GitHub · desplegar Worker',   url: 'https://github.com/borradodelmapa/borradodelmapa/actions/workflows/deploy-worker.yml' },
    twilio:        { label: 'Twilio',                      url: 'https://console.twilio.com/' },
    duffel:        { label: 'Duffel · vuelos',             url: 'https://app.duffel.com/' },
    rapidapi:      { label: 'RapidAPI · hoteles y coches', url: 'https://rapidapi.com/developer/billing/subscriptions-and-usage' },
    elevenlabs:    { label: 'ElevenLabs · voz',            url: 'https://elevenlabs.io/app/subscription' },
    serper:        { label: 'Serper · eventos',            url: 'https://serper.dev/dashboard' },
    brave:         { label: 'Brave Search',                url: 'https://api-dashboard.search.brave.com/' },
    resend:        { label: 'Resend · emails',             url: 'https://resend.com/emails' }
  },
  LINK_GROUPS: [
    { title: 'Dinero y facturación', keys: ['stripe', 'stripe_subs', 'google_bill', 'google_budget', 'google_quotas', 'bigquery', 'anthropic', 'openai'] },
    { title: 'Usuarios y visitas',   keys: ['fb_users', 'fb_data', 'fb_feedback', 'analytics'] },
    { title: 'Servidor y despliegue', keys: ['cloudflare', 'github_deploy'] },
    { title: 'Otros proveedores',    keys: ['twilio', 'duffel', 'rapidapi', 'elevenlabs', 'serper', 'brave', 'resend'] }
  ],

  // GA4
  GA4_MEASUREMENT_ID: 'G-B2YWQKPTZZ',
  GA4_PROPERTY_ID: '352732094',

  // Worker de Salma. Sin token: el panel manda su sesion de Firebase (ver adminAuthHeaders en admin.js)
  WORKER_URL: 'https://salma-api.borradodelmapa-api.workers.dev',

  // Pestañas del admin
  TABS: [
    { id: 'dashboard',    label: 'Dashboard',     icon: '📊' },
    { id: 'gastos',       label: 'Gastos',         icon: '💶' },
    { id: 'ingresos',     label: 'Ingresos',       icon: '💰' },
    { id: 'analytics',    label: 'Analytics',      icon: '📈' },
    { id: 'usuarios',     label: 'Usuarios',       icon: '👥' },
    { id: 'feedback',     label: 'Feedback',       icon: '💬' },
    { id: 'settings',     label: 'Configuración',  icon: '⚙️' }
  ],

  // Candados puestos en Google Cloud (cuotas DIARIAS). Solo informativo para la pestaña Gastos:
  // se cambian en la consola de Google (Google Maps Platform → Cuotas), no aquí. Si se cambia una, actualizar esta lista.
  GOOGLE_QUOTAS: [
    { api: 'Places API (todos los métodos juntos)', dia: '900 peticiones' },
    { api: 'Directions API', dia: '200 peticiones' },
    { api: 'Maps Static API', dia: '100 peticiones' },
    { api: 'Geocoding API (v3)', dia: '50 peticiones' },
    { api: 'Maps JavaScript API', dia: '1.000 cargas de mapa' }
  ],

  // Nombres en castellano de los servicios que cuenta el Worker (claves de /admin/google-usage)
  GOOGLE_SERVICE_LABELS: {
    find: 'Buscar un lugar', details: 'Ficha de un lugar', text: 'Búsqueda de texto', nearby: 'Cerca de un punto',
    photo: 'Foto', directions: 'Trazado de ruta', static: 'Mapa estático', geocode: 'Geocodificación', other: 'Otros'
  },

  // Precios de modelos Anthropic (€ por millón de tokens)
  MODEL_PRICES: {
    'claude-sonnet-4-6': { input: 3.0, output: 15.0 }
  }
};
