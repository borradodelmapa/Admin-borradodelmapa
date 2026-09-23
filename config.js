/* ═══════════════════════════════════════════
   ADMIN CONFIG — Constantes del panel
   ═══════════════════════════════════════════ */

const ADMIN_CONFIG = {
  // Versión del panel: súbela en CADA cambio (aquí y en los ?v= de index.html). Se ve abajo a la derecha.
  ADMIN_VERSION: '2026-09-23.3',

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

  // GA4
  GA4_MEASUREMENT_ID: 'G-B2YWQKPTZZ',
  GA4_PROPERTY_ID: '352732094',

  // Worker de Salma. Sin token: el panel manda su sesion de Firebase (ver adminAuthHeaders en admin.js)
  WORKER_URL: 'https://salma-api.borradodelmapa-api.workers.dev',

  // Pestañas del admin
  TABS: [
    { id: 'dashboard',    label: 'Dashboard',     icon: '📊' },
    { id: 'analytics',    label: 'Analytics',      icon: '📈' },
    { id: 'usuarios',     label: 'Usuarios',       icon: '👥' },
    { id: 'settings',     label: 'Configuración',  icon: '⚙️' }
  ],

  // Precios de modelos Anthropic (€ por millón de tokens)
  MODEL_PRICES: {
    'claude-sonnet-4-6': { input: 3.0, output: 15.0 }
  }
};
