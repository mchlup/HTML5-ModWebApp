const config = {
  id: 'suppliers',
  name: 'Dodavatelé',
  description: 'Centrální modul pro správu dodavatelů napříč aplikací.',
  version: '1.0.0',
  category: 'crm',
  settingsSchema: {
    fields: [
      {
        key: 'primaryModuleId',
        label: 'Primární modul',
        type: 'text',
        placeholder: 'suppliers',
        helpText:
          'ID modulu, který má být považován za hlavní správu dodavatelů. Ostatní moduly mohou fungovat jako aliasy.',
      },
      {
        key: 'tableName',
        label: 'Tabulka v databázi',
        type: 'text',
        placeholder: 'app_suppliers',
        helpText: 'Název databázové tabulky, kterou modul používá.',
      },
      {
        key: 'aliases',
        label: 'Alias moduly',
        type: 'text',
        placeholder: 'crm,erp',
        helpText:
          'Seznam ID modulů oddělených čárkou, které sdílí tabulku dodavatelů s primárním modulem.',
      },
    ],
  },
  dbSchema: {
    schemaFile: 'schema.sql',
    description: 'Založení centrální tabulky dodavatelů.',
  },
};

export default config;
