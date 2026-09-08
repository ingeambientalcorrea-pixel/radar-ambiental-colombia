import crypto from "node:crypto";
import { getSql } from "./db";

const FETCH_TIMEOUT_MS = 12000;
const MAX_CANDIDATES = 30;

const NEWS_HINTS = [
  "gremio", "noticias", "comunicados", "actualidad", "medio / ambiente",
  "portal ambiental", "portal especializado", "sostenibilidad empresarial",
  "consejo de sostenibilidad", "monitoreo regulatorio",
];

const RELEVANT_TERMS = [
  "ambient", "sostenib", "agua", "vertimiento", "saneamiento", "residuo",
  "economía circular", "economia circular", "emision", "aire", "ruido",
  "cambio climático", "cambio climatico", "biodivers", "bosque", "fauna",
  "flora", "licencia", "permiso", "concesión", "concesion", "aprovechamiento",
  "ley", "decreto", "resolución", "resolucion", "acuerdo", "circular",
  "sentencia", "jurisprud", "conpes", "política", "politica", "plan",
  "pomca", "pgar", "pot", "pbot", "eot", "pgirs", "psmv", "pueaa",
  "guía", "guia", "manual", "protocolo", "lineamiento", "metodolog",
  "riesgo", "clima", "energía", "energia", "descarbon", "carbono", "esg",
  "huella", "economía verde", "economia verde", "territorial", "ordenamiento",
];

const IGNORE_TEXT = new Set([
  "inicio", "home", "contacto", "contáctenos", "contactenos", "buscar",
  "search", "facebook", "instagram", "linkedin", "youtube", "twitter", "x",
  "iniciar sesión", "login", "registro", "mapa del sitio", "sitemap",
  "política de privacidad", "politica de privacidad", "cookies",
]);

export type SourceRecord = {
  id: string;
  name: string;
  source_type: string | null;
  category: string | null;
  official_url: string | null;
  repository_url: string | null;
  geographic_scope: string | null;
  department: string | null;
  municipality: string | null;
  priority: number | null;
  status: string | null;
};

export type CollectResult = {
  sourceId: string;
  sourceName: string;
  found: number;
  inserted: number;
  updated: number;
  unchanged: number;
  kind: "documents" | "news";
  status: "success" | "error";
  message?: string;
};

type Candidate = {
  title: string;
  url: string;
};

export async function listCollectableSources() {
  const sql = getSql();
  if (!sql) return [] as SourceRecord[];

  const rows = await sql`
    SELECT
      id::text,
      name,
      source_type,
      category,
      official_url,
      repository_url,
      geographic_scope,
      department,
      municipality,
      priority,
      status
    FROM sources
    WHERE active = TRUE
      AND COALESCE(status, 'pending') IN ('online', 'pending')
      AND COALESCE(repository_url, official_url) IS NOT NULL
    ORDER BY priority ASC, name ASC
  `;

  return rows as unknown as SourceRecord[];
}

export async function collectSourceById(sourceId: string): Promise<CollectResult> {
  const sql = getSql();
  if (!sql) {
    return failure(sourceId, "Fuente desconocida", "DATABASE_URL no está configurada");
  }

  const sources = await sql`
    SELECT
      id::text,
      name,
      source_type,
      category,
      official_url,
      repository_url,
      geographic_scope,
      department,
      municipality,
      priority,
      status
    FROM sources
    WHERE id = ${sourceId}::bigint AND active = TRUE
    LIMIT 1
  `;

  if (sources.length === 0) {
    return failure(sourceId, "Fuente desconocida", "La fuente no existe o está inactiva");
  }

  const source = sources[0] as unknown as SourceRecord;
  const targetUrl = source.repository_url || source.official_url;
  const newsSource = isNewsSource(source);

  if (!targetUrl) {
    return failure(sourceId, source.name, "La fuente no tiene URL configurada", newsSource);
  }

  const runRows = await sql`
    INSERT INTO crawl_runs (source_id, started_at, status)
    VALUES (${sourceId}::bigint, NOW(), 'running')
    RETURNING id::text
  `;
  const runId = String(runRows[0]?.id ?? "");

  try {
    const html = await fetchHtml(targetUrl);
    const candidates = extractCandidates(html, targetUrl).slice(0, MAX_CANDIDATES);

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    for (const candidate of candidates) {
      const change = newsSource
        ? await upsertNews(sql, source, candidate)
        : await upsertDocument(sql, source, candidate);

      if (change === "inserted") inserted++;
      else if (change === "updated") updated++;
      else unchanged++;
    }

    await sql`
      UPDATE sources
      SET
        status = 'online',
        last_checked_at = NOW(),
        last_success_at = NOW(),
        updated_at = NOW()
      WHERE id = ${sourceId}::bigint
    `;

    if (runId) {
      await sql`
        UPDATE crawl_runs
        SET
          finished_at = NOW(),
          status = 'success',
          found_count = ${candidates.length},
          inserted_count = ${inserted},
          updated_count = ${updated},
          unchanged_count = ${unchanged},
          error_message = NULL
        WHERE id = ${runId}::bigint
      `;
    }

    return {
      sourceId,
      sourceName: source.name,
      found: candidates.length,
      inserted,
      updated,
      unchanged,
      kind: newsSource ? "news" : "documents",
      status: "success",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";

    await sql`
      UPDATE sources
      SET status = 'error', last_checked_at = NOW(), updated_at = NOW()
      WHERE id = ${sourceId}::bigint
    `;

    if (runId) {
      await sql`
        UPDATE crawl_runs
        SET finished_at = NOW(), status = 'error', error_message = ${message}
        WHERE id = ${runId}::bigint
      `;
    }

    return failure(sourceId, source.name, message, newsSource);
  }
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "RadarAmbientalColombia/0.6 (+https://github.com/ingeambientalcorrea-pixel/radar-ambiental-colombia)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-CO,es;q=0.9,en;q=0.5",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} al consultar ${url}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("html") && !contentType.includes("text")) {
      throw new Error(`La fuente no devolvió HTML (${contentType || "tipo desconocido"})`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function extractCandidates(html: string, baseUrl: string): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const anchorRegex = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorRegex)) {
    const href = decodeEntities(match[1]?.trim() || "");
    const title = cleanText(match[2] || "");

    if (!href || !title || title.length < 8 || title.length > 320) continue;
    if (IGNORE_TEXT.has(normalize(title))) continue;
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;

    let url: string;
    try {
      url = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }

    const normalizedUrl = canonicalizeUrl(url);
    if (seen.has(normalizedUrl)) continue;

    const haystack = normalize(`${title} ${url}`);
    if (!RELEVANT_TERMS.some((term) => haystack.includes(normalize(term)))) continue;

    seen.add(normalizedUrl);
    out.push({ title, url: normalizedUrl });
  }

  return out;
}

async function upsertDocument(sql: NonNullable<ReturnType<typeof getSql>>, source: SourceRecord, candidate: Candidate) {
  const documentType = detectDocumentType(candidate.title, candidate.url);
  const family = detectDocumentFamily(documentType, candidate.title);
  const topic = detectTopic(candidate.title, candidate.url);
  const number = extractDocumentNumber(candidate.title);
  const year = extractYear(candidate.title, candidate.url);
  const key = sha256(candidate.url);
  const contentHash = sha256(`${candidate.title}|${candidate.url}|${documentType}|${topic}`);
  const authorityId = await ensureAuthority(sql, source);

  const previous = await sql`
    SELECT id::text, content_hash
    FROM documents
    WHERE document_key = ${key}
    LIMIT 1
  `;

  const rows = await sql`
    INSERT INTO documents (
      document_key, title, document_family, document_type, document_number, year,
      authority_id, geographic_scope, department, municipality, main_topic,
      description, summary, legal_scope, official_url, canonical_url, content_hash,
      first_seen_at, last_seen_at, updated_at
    ) VALUES (
      ${key}, ${candidate.title}, ${family}, ${documentType}, ${number}, ${year},
      ${authorityId}::bigint, ${source.geographic_scope}, ${source.department}, ${source.municipality}, ${topic},
      ${`Documento detectado en ${source.name}.`}, ${candidate.title}, ${source.geographic_scope},
      ${candidate.url}, ${candidate.url}, ${contentHash}, NOW(), NOW(), NOW()
    )
    ON CONFLICT (document_key) DO UPDATE SET
      title = EXCLUDED.title,
      document_family = COALESCE(EXCLUDED.document_family, documents.document_family),
      document_type = COALESCE(EXCLUDED.document_type, documents.document_type),
      document_number = COALESCE(EXCLUDED.document_number, documents.document_number),
      year = COALESCE(EXCLUDED.year, documents.year),
      authority_id = COALESCE(EXCLUDED.authority_id, documents.authority_id),
      geographic_scope = COALESCE(EXCLUDED.geographic_scope, documents.geographic_scope),
      department = COALESCE(EXCLUDED.department, documents.department),
      municipality = COALESCE(EXCLUDED.municipality, documents.municipality),
      main_topic = COALESCE(EXCLUDED.main_topic, documents.main_topic),
      official_url = EXCLUDED.official_url,
      canonical_url = EXCLUDED.canonical_url,
      content_hash = EXCLUDED.content_hash,
      last_seen_at = NOW(),
      updated_at = CASE WHEN documents.content_hash IS DISTINCT FROM EXCLUDED.content_hash THEN NOW() ELSE documents.updated_at END
    RETURNING id::text
  `;

  const documentId = String(rows[0]?.id);

  await sql`
    INSERT INTO document_sources (document_id, source_id, source_url, first_seen_at, last_seen_at)
    VALUES (${documentId}::bigint, ${source.id}::bigint, ${candidate.url}, NOW(), NOW())
    ON CONFLICT (document_id, source_id, source_url)
    DO UPDATE SET last_seen_at = NOW()
  `;

  if (previous.length === 0) return "inserted" as const;
  return previous[0]?.content_hash === contentHash ? "unchanged" as const : "updated" as const;
}

async function upsertNews(sql: NonNullable<ReturnType<typeof getSql>>, source: SourceRecord, candidate: Candidate) {
  const topic = detectTopic(candidate.title, candidate.url);
  const key = sha256(candidate.url);
  const contentHash = sha256(`${candidate.title}|${candidate.url}|${topic}`);
  const impact = detectBusinessImpact(candidate.title, topic);
  const score = relevanceScore(candidate.title, topic);

  const previous = await sql`
    SELECT id::text, content_hash
    FROM news
    WHERE news_key = ${key}
    LIMIT 1
  `;

  const rows = await sql`
    INSERT INTO news (
      news_key, title, content_kind, source_category, sector, main_topic,
      business_impact, alert_level, relevance_score, relevance_reason,
      description, summary, canonical_url, content_hash,
      first_seen_at, last_seen_at, updated_at
    ) VALUES (
      ${key}, ${candidate.title}, 'Noticia / alerta', ${source.category || source.source_type}, ${inferSector(source.name)}, ${topic},
      ${impact}, ${score >= 75 ? "alta" : score >= 45 ? "media" : "baja"}, ${score},
      ${`Relevancia estimada por tema (${topic}) e impacto potencial (${impact}).`},
      ${`Publicación detectada en ${source.name}.`}, ${candidate.title}, ${candidate.url}, ${contentHash}, NOW(), NOW(), NOW()
    )
    ON CONFLICT (news_key) DO UPDATE SET
      title = EXCLUDED.title,
      main_topic = COALESCE(EXCLUDED.main_topic, news.main_topic),
      business_impact = EXCLUDED.business_impact,
      alert_level = EXCLUDED.alert_level,
      relevance_score = EXCLUDED.relevance_score,
      relevance_reason = EXCLUDED.relevance_reason,
      canonical_url = EXCLUDED.canonical_url,
      content_hash = EXCLUDED.content_hash,
      last_seen_at = NOW(),
      updated_at = CASE WHEN news.content_hash IS DISTINCT FROM EXCLUDED.content_hash THEN NOW() ELSE news.updated_at END
    RETURNING id::text
  `;

  const newsId = String(rows[0]?.id);

  await sql`
    INSERT INTO news_sources (news_id, source_id, source_url, first_seen_at, last_seen_at)
    VALUES (${newsId}::bigint, ${source.id}::bigint, ${candidate.url}, NOW(), NOW())
    ON CONFLICT (news_id, source_id, source_url)
    DO UPDATE SET last_seen_at = NOW()
  `;

  if (previous.length === 0) return "inserted" as const;
  return previous[0]?.content_hash === contentHash ? "unchanged" as const : "updated" as const;
}

async function ensureAuthority(sql: NonNullable<ReturnType<typeof getSql>>, source: SourceRecord) {
  const authorityName = source.name.replace(/\s+-\s+.+$/, "").trim();
  const jurisdiction = source.geographic_scope || "Colombia";

  const rows = await sql`
    INSERT INTO authorities (name, authority_type, jurisdiction, department, municipality, official_url)
    VALUES (${authorityName}, ${source.source_type}, ${jurisdiction}, ${source.department}, ${source.municipality}, ${source.official_url})
    ON CONFLICT (name, jurisdiction) DO UPDATE SET
      authority_type = COALESCE(EXCLUDED.authority_type, authorities.authority_type),
      department = COALESCE(EXCLUDED.department, authorities.department),
      municipality = COALESCE(EXCLUDED.municipality, authorities.municipality),
      official_url = COALESCE(EXCLUDED.official_url, authorities.official_url)
    RETURNING id::text
  `;

  return String(rows[0]?.id);
}

function isNewsSource(source: SourceRecord) {
  const haystack = normalize(`${source.source_type || ""} ${source.category || ""} ${source.name}`);
  return NEWS_HINTS.some((term) => haystack.includes(normalize(term)));
}

function detectDocumentType(title: string, url: string) {
  const text = normalize(`${title} ${url}`);
  const types: Array<[string, string]> = [
    ["sentencia", "Sentencia"], ["resolucion", "Resolución"], ["decreto", "Decreto"],
    ["ley ", "Ley"], ["acuerdo", "Acuerdo"], ["circular", "Circular"], ["auto ", "Auto"],
    ["conpes", "CONPES"], ["pomca", "POMCA"], ["pgar", "PGAR"], ["pgirs", "PGIRS"],
    ["psmv", "PSMV"], ["pueaa", "PUEAA"], ["pbot", "PBOT"], [" eot", "EOT"], [" pot", "POT"],
    ["politica", "Política"], ["plan ", "Plan"], ["guia", "Guía"], ["protocolo", "Protocolo"],
    ["manual", "Manual"], ["lineamiento", "Lineamiento"], ["metodolog", "Metodología"],
  ];
  return types.find(([needle]) => text.includes(needle))?.[1] || "Documento ambiental";
}

function detectDocumentFamily(type: string, title: string) {
  const t = normalize(`${type} ${title}`);
  if (["sentencia", "auto judicial"].some((x) => t.includes(x))) return "Jurisprudencia";
  if (["ley", "decreto", "resolucion", "acuerdo", "circular", "auto"].some((x) => t.includes(x))) return "Normativa";
  if (["plan", "politica", "conpes", "pomca", "pgar", "pgirs", "psmv", "pueaa", "pot", "pbot", "eot"].some((x) => t.includes(x))) return "Planeación y política";
  return "Documento técnico";
}

function detectTopic(title: string, url: string) {
  const t = normalize(`${title} ${url}`);
  const topics: Array<[string[], string]> = [
    [["vertimiento", "saneamiento", "alcantarill", "agua residual"], "Agua, saneamiento y vertimientos"],
    [["agua", "hidric", "cuenca", "pomca", "pueaa"], "Recurso hídrico"],
    [["residuo", "economia circular", "recicl", "pgirs", "plastico"], "Residuos y economía circular"],
    [["cambio climatico", "clima", "carbono", "descarbon", "energia"], "Cambio climático y energía"],
    [["biodivers", "fauna", "flora", "bosque", "area protegida"], "Biodiversidad y áreas protegidas"],
    [["aire", "emision", "ruido", "atmosfer"], "Aire, ruido y emisiones"],
    [["licencia", "permiso", "concesion", "aprovechamiento"], "Licenciamiento, permisos y autorizaciones"],
    [["pot", "pbot", "eot", "ordenamiento", "territorial"], "Ordenamiento territorial"],
    [["riesgo", "desastre"], "Gestión del riesgo"],
    [["esg", "sostenib", "gri", "reporte"], "Sostenibilidad y ESG"],
  ];
  return topics.find(([terms]) => terms.some((term) => t.includes(term)))?.[1] || "Gestión ambiental";
}

function detectBusinessImpact(title: string, topic: string) {
  const t = normalize(`${title} ${topic}`);
  if (["ley", "decreto", "resolucion", "regul", "cumplimiento", "permiso", "licencia"].some((x) => t.includes(x))) return "Cumplimiento normativo";
  if (["costo", "tarifa", "energia", "eficiencia", "economia circular"].some((x) => t.includes(x))) return "Costos y eficiencia";
  if (["riesgo", "clima", "desastre"].some((x) => t.includes(x))) return "Riesgo climático y continuidad";
  if (["esg", "reput", "sostenib", "reporte"].some((x) => t.includes(x))) return "Estrategia, reputación y ESG";
  return "Operación ambiental";
}

function relevanceScore(title: string, topic: string) {
  const t = normalize(`${title} ${topic}`);
  let score = 35;
  if (["resolucion", "decreto", "ley", "regul", "obligacion", "proyecto de"].some((x) => t.includes(x))) score += 35;
  if (["vertimiento", "residuo", "emision", "licencia", "permiso", "agua"].some((x) => t.includes(x))) score += 20;
  if (["sostenib", "esg", "clima", "circular"].some((x) => t.includes(x))) score += 10;
  return Math.min(score, 100);
}

function inferSector(sourceName: string) {
  const n = normalize(sourceName);
  if (n.includes("camacol") || n.includes("cccs")) return "Construcción";
  if (n.includes("acp") || n.includes("naturgas")) return "Hidrocarburos y energía";
  if (n.includes("ser colombia")) return "Energías renovables";
  if (n.includes("acmineria")) return "Minería";
  if (n.includes("acoplasticos")) return "Plásticos y manufactura";
  if (n.includes("fedepalma") || n.includes("asocana")) return "Agroindustria";
  if (n.includes("andesco")) return "Servicios públicos";
  if (n.includes("fenalco")) return "Comercio";
  return "Multisectorial";
}

function extractDocumentNumber(title: string) {
  const match = title.match(/(?:ley|decreto|resoluci[oó]n|acuerdo|circular|auto|sentencia)\s+(?:n[oº°.]?\s*)?([0-9]{1,7})/i);
  return match?.[1] || null;
}

function extractYear(...values: string[]) {
  const match = values.join(" ").match(/\b(19\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function cleanText(value: string) {
  return decodeEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function canonicalizeUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|mc_)/i.test(key)) url.searchParams.delete(key);
  }
  return url.toString();
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function failure(sourceId: string, sourceName: string, message: string, newsSource = false): CollectResult {
  return {
    sourceId,
    sourceName,
    found: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    kind: newsSource ? "news" : "documents",
    status: "error",
    message,
  };
}
