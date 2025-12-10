export default {
  id: 'crm',
  name: 'Výroba nátěrových hmot',
  description:
    'Evidence surovin, tvorba polotovarů a finálních receptur pro zákaznické zakázky.',
  version: '1.1.0',
  category: 'production',
  dbSchema: {
    // cesta je jen informativní pro UI, backend si bere schema.sql z modules/<id>/schema.sql
    schemaFile: 'modules/crm/schema.sql',
  },
};

