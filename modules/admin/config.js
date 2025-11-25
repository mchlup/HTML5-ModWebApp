// Základní konfigurace modulu "admin".
// Slouží hlavně k tomu, aby configManager našel config.js
// a nepokoušel se volat neexistující config.json.

export default {
  id: 'admin',
  name: 'Administrace',
  description: 'Správa uživatelů, rolí a oprávnění aplikace.',
  version: '1.1.0',
  category: 'system',
};
