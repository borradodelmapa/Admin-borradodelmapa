/* ═══════════════════════════════════════════
   ADMIN CONFIG — Constantes del panel
   ═══════════════════════════════════════════ */

const ADMIN_CONFIG = {
  // Hash SHA-256 de la contraseña del admin
  PASSWORD_HASH: '165f5573a101e4dc24bc6bf5f0ea15c5f73e4668ad3f0bc8b6c579392cc1b722',

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

  // Worker de Salma
  WORKER_URL: 'https://salma-api.paco-defoto.workers.dev',
  ADMIN_CHAT_TOKEN: 'bdm-admin-2026',

  // Pestañas del admin
  TABS: [
    { id: 'dashboard',    label: 'Dashboard',     icon: '📊' },
    { id: 'analytics',    label: 'Analytics',      icon: '📈' },
    { id: 'usuarios',     label: 'Usuarios',       icon: '👥' },
    { id: 'salma',        label: 'Salma',          icon: '🤖' },
    { id: 'proyecto',     label: 'Proyecto',       icon: '🗂️' },
    { id: 'marketing',    label: 'Marketing',      icon: '📣' },
    { id: 'contabilidad', label: 'Contabilidad',   icon: '💰' },
    { id: 'chat',         label: 'Chat',           icon: '💬' }
  ],

  // Precios de modelos Anthropic (€ por millón de tokens)
  MODEL_PRICES: {
    'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 }
  }
};
