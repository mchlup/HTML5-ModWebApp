const labels = {
  // Základní info o modulu
  title: 'Dodavatelé',
  subtitle: 'Centrální modul pro správu dodavatelů a sdílené databázové tabulky.',
  intro:
    'Spravujte jednu centrální databázi dodavatelů, kterou mohou ostatní moduly využít prostřednictvím aliasů.',

  // Formulář
  formTitleNew: 'Nový dodavatel',
  formTitleEdit: 'Upravit dodavatele',
  formHelp:
    'Vyplňte základní údaje o dodavateli. Název je povinný, ostatní pole jsou volitelná, ale doporučená pro přehlednou evidenci.',

  nameLabel: 'Název dodavatele',
  namePlaceholder: 'např. ACME, s.r.o.',
  codeLabel: 'Kód dodavatele',
  codePlaceholder: 'interní kód / zkratka',
  contactPersonLabel: 'Kontaktní osoba',
  contactPersonPlaceholder: 'Jméno kontaktní osoby',
  emailLabel: 'E-mail',
  emailPlaceholder: 'kontakt@dodavatel.cz',
  phoneLabel: 'Telefon',
  phonePlaceholder: '+420 …',
  websiteLabel: 'Web',
  websitePlaceholder: 'https://www.dodavatel.cz',
  noteLabel: 'Poznámka',
  notePlaceholder: 'Interní poznámka k dodavateli…',
  
  addButton: 'Přidat dodavatele',
  paginationPageLabel: 'strana',
  saveButton: 'Uložit dodavatele',
  cancelButton: 'Zrušit',

  // Seznam
  listTitle: 'Seznam dodavatelů',
  listHelp:
    'Přehled všech dodavatelů uložených v centrální tabulce. Záznamy můžete upravovat nebo mazat. Vyhledávání prohledává název, kód i kontaktní údaje.',
  refreshButton: 'Obnovit seznam',
  searchPlaceholder: 'Filtrovat podle názvu, kódu nebo kontaktu…',

  colName: 'Název',
  colCode: 'Kód',
  colContactPerson: 'Kontaktní osoba',
  colEmail: 'E-mail',
  colPhone: 'Telefon',
  colWebsite: 'Web',
  colNote: 'Poznámka',
  colActions: 'Akce',

  editButton: 'Upravit',
  deleteButton: 'Smazat',
  deleteConfirm: 'Opravdu chcete tohoto dodavatele smazat? Tuto akci nelze vrátit zpět.',

  emptyListInfo: 'Zatím nejsou založeni žádní dodavatelé.',

  // Chyby
  paginationPrev: 'Předchozí',
  paginationNext: 'Další',

  loadError: 'Nepodařilo se načíst seznam dodavatelů. Zkuste to prosím znovu nebo zkontrolujte log.',
  saveError:
    'Uložení dodavatele se nezdařilo. Zkontrolujte data a zkuste to prosím znovu. Pokud problém přetrvá, nahlédněte do logu.',
  deleteError:
    'Smazání dodavatele se nezdařilo. Zkontrolujte log aplikace nebo oprávnění uživatele.',

  validationNameRequired: 'Název dodavatele je povinný.',
};

export default labels;

