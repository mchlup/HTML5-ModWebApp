// Základní konfigurace modulu "logs".

const config = {
  id: "logs",
  name: "Systémové logy",
  description: "Prohlížení a export aplikačních logů.",
  version: "1.0.0",
  category: "maintenance",
  settingsSchema: {
    fields: [
      {
        key: "retentionDays",
        label: "Dny uchování logů",
        type: "number",
        placeholder: "např. 30",
        min: 0,
      },
      {
        key: "includeDebug",
        label: "Zahrnout debug zprávy",
        type: "checkbox",
      },
    ],
  },
};

export default config;
