const config = {
  id: 'suppliers',
  name: 'Dodavatelé',
  description: 'Centrální modul pro správu dodavatelů napříč aplikací.',
  version: '2.0.0',
  category: 'production',
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
        label: 'Název databázové tabulky',
        type: 'text',
        placeholder: 'app_suppliers',
        helpText:
          'Název databázové tabulky, ve které jsou uloženi dodavatelé. Pokud není vyplněno, použije se výchozí hodnota app_suppliers.',
      },
      {
        key: 'aliases',
        label: 'Moduly sdílející tabulku',
        type: 'text',
        placeholder: 'crm,erp',
        helpText:
          'Seznam ID modulů oddělených čárkou, které sdílí tabulku dodavatelů s primárním modulem.',
      },
    ],
  },
  dbSchema: {
    // cesta slouží pouze jako informace; backend používá soubor modules/<id>/schema.sql
    schemaFile: 'modules/suppliers/schema.sql',
    description: 'Založení centrální tabulky dodavatelů.',
  },
};

export default config;

