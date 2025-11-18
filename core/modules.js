import { renderCrm } from "../modules/crm.js";
import { renderErp } from "../modules/erp.js";
import { renderConfig } from "../modules/config.js";

// Registr všech známých modulů.
// Pokud přidáš nový modul, zaregistruj ho sem.
export const MODULE_REGISTRY = {
  config: {
    id: "config",
    label: "Konfigurace",
    render: renderConfig,
  },
  crm: {
    id: "crm",
    label: "CRM – zákazníci",
    render: renderCrm,
  },
  erp: {
    id: "erp",
    label: "ERP – objednávky",
    render: renderErp,
  },
};
