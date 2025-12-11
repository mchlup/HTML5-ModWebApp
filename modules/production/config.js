export default {
  id: 'production',
  name: 'Výroba nátěrových hmot',
  description:
    'Evidence surovin, tvorba polotovarů a finálních receptur pro zákaznické zakázky.',
  version: '1.1.0',
  category: 'production',
  dbSchema: {
    // cesta je jen informativní pro UI, backend si bere schema.sql z modules/<id>/schema.sql
    schemaFile: './schema.sql',
  },
};

