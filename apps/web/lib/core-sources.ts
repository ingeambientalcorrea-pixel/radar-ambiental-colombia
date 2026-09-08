import { getSql } from "./db";

const CORE_SOURCES = [
  {
    name: "MinVivienda - Normativa Agua y Saneamiento",
    sourceType: "Normativa / Saneamiento",
    category: "Fuente oficial",
    url: "https://minvivienda.gov.co/normativa",
    scope: "Nacional",
    priority: 1,
  },
  {
    name: "MinVivienda - Reglamento Técnico RAS",
    sourceType: "Norma técnica / Saneamiento",
    category: "Fuente oficial",
    url: "https://minvivienda.gov.co/viceministerio-de-agua-y-saneamiento-basico-reglamento-tecnico-sector-reglamento-tecnico-del-sector-de-agua-potable-y-saneamiento-basico-ras",
    scope: "Nacional",
    priority: 1,
  },
  {
    name: "MinVivienda - Manuales RAS",
    sourceType: "Técnica / Saneamiento",
    category: "Fuente oficial",
    url: "https://www.minvivienda.gov.co/viceministerio-de-agua-y-saneamiento-basico-reglamento-tecnico-sector-manuales",
    scope: "Nacional",
    priority: 1,
  },
  {
    name: "CRA - Gestor Normativo Agua y Saneamiento",
    sourceType: "Normativa / Saneamiento",
    category: "Regulador sectorial",
    url: "https://normas.cra.gov.co/Gestor/compilacion_resoluciones_cra_comision_regulacion_agua_potable_saneamiento_basico.html",
    scope: "Nacional",
    priority: 1,
  },
  {
    name: "CRA - Resoluciones Expedidas",
    sourceType: "Normativa / Saneamiento",
    category: "Regulador sectorial",
    url: "https://normas.cra.gov.co/gestor/resoluciones_expedidas_por_cra.html",
    scope: "Nacional",
    priority: 1,
  },
  {
    name: "MinSalud - Salud Ambiental",
    sourceType: "Política / Salud ambiental",
    category: "Fuente oficial",
    url: "https://www.minsalud.gov.co/salud/publica/ambiental/Paginas/Salud-ambiental.aspx",
    scope: "Nacional",
    priority: 1,
  },
  {
    name: "MinSalud - Decreto Único Sector Salud",
    sourceType: "Normativa / Salud ambiental",
    category: "Fuente oficial",
    url: "https://www.minsalud.gov.co/Normativa/Paginas/decreto-unico-minsalud-780-de-2016.aspx",
    scope: "Nacional",
    priority: 1,
  },
  {
    name: "UPME - Plan Energético Nacional",
    sourceType: "Planeación / Energía",
    category: "Fuente oficial",
    url: "https://www.upme.gov.co/simec/planeacion-energetica/plan-energetico-nacional-1/",
    scope: "Nacional",
    priority: 2,
  },
  {
    name: "DANE - Cuentas Ambientales",
    sourceType: "Técnica / Economía ambiental",
    category: "Fuente oficial",
    url: "https://www.dane.gov.co/index.php/component/content/category/138-espanol/30-cuentas-nacionales/31-cuentas-ambientales?Itemid=109",
    scope: "Nacional",
    priority: 2,
  },
  {
    name: "SINAS - Agua Potable y Saneamiento Básico",
    sourceType: "Planeación / Saneamiento",
    category: "Fuente oficial",
    url: "https://sinas.minvivienda.gov.co/",
    scope: "Nacional/Departamental/Municipal",
    priority: 2,
  },
];

export async function ensureCoreSources() {
  const sql = getSql();
  if (!sql) return 0;

  let count = 0;
  for (const source of CORE_SOURCES) {
    await sql`
      INSERT INTO sources (
        name, source_type, category, official_url, geographic_scope,
        collector_type, priority, active, status, updated_at
      ) VALUES (
        ${source.name}, ${source.sourceType}, ${source.category}, ${source.url}, ${source.scope},
        'html', ${source.priority}, TRUE, 'pending', NOW()
      )
      ON CONFLICT (name) DO UPDATE SET
        source_type = EXCLUDED.source_type,
        category = EXCLUDED.category,
        official_url = EXCLUDED.official_url,
        geographic_scope = EXCLUDED.geographic_scope,
        priority = EXCLUDED.priority,
        active = TRUE,
        updated_at = NOW()
    `;
    count++;
  }

  return count;
}
