export default {
  id: 'customers',
  name: 'Zákazníci',
  description: 'Centrální evidence zákazníků napříč aplikací (např. výroba/zakázky).',
  version: '1.0.0',
  category: 'production',
  dbSchema: {
    // cesta je jen informativní pro UI, backend si bere schema.sql z modules/<id>/schema.sql
    schemaFile: './schema.sql',
  },
};
