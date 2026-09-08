import { getSql } from "./db";

const DETAIL_TIMEOUT_MS = 6500;
const MAX_DETAILS_PER_SOURCE = 6;

type DetailMetadata = {
  description: string | null;
  publishedAt: string | null;
  pdfUrl: string | null;
  topic: string | null;
  keywords: string | null;
};

export async function enrichSourceItems(sourceId: string) {
  const sql = getSql();
  if (!sql) return { documents: 0, news: 0 };

  const [documents, news] = await Promise.all([
    sql`
      SELECT d.id::text, d.title, COALESCE(d.official_url, d.canonical_url) AS url
      FROM documents d
      JOIN document_sources ds ON ds.document_id = d.id
      WHERE ds.source_id = ${sourceId}::bigint
        AND COALESCE(d.official_url, d.canonical_url) IS NOT NULL
      ORDER BY d.first_seen_at DESC
      LIMIT ${MAX_DETAILS_PER_SOURCE}
    `,
    sql`
      SELECT n.id::text, n.title, n.canonical_url AS url
      FROM news n
      JOIN news_sources ns ON ns.news_id = n.id
      WHERE ns.source_id = ${sourceId}::bigint
        AND n.canonical_url IS NOT NULL
      ORDER BY n.first_seen_at DESC
      LIMIT ${MAX_DETAILS_PER_SOURCE}
    `,
  ]);

  let documentCount = 0;
  let newsCount = 0;

  await Promise.all(
    documents.map(async (row) => {
      const url = String(row.url || "");
      if (!url || isPdf(url)) return;
      const detail = await readMetadata(url, String(row.title || ""));
      if (!detail) return;

      await sql`
        UPDATE documents
        SET
          description = COALESCE(${detail.description}, description),
          summary = COALESCE(${detail.description}, summary),
          date_published = COALESCE(${detail.publishedAt}::date, date_published),
          pdf_url = COALESCE(${detail.pdfUrl}, pdf_url),
          main_topic = COALESCE(${detail.topic}, main_topic),
          keywords = COALESCE(${detail.keywords}, keywords),
          updated_at = NOW()
        WHERE id = ${String(row.id)}::bigint
      `;
      documentCount++;
    }),
  );

  await Promise.all(
    news.map(async (row) => {
      const url = String(row.url || "");
      if (!url || isPdf(url)) return;
      const detail = await readMetadata(url, String(row.title || ""));
      if (!detail) return;

      await sql`
        UPDATE news
        SET
          description = COALESCE(${detail.description}, description),
          summary = COALESCE(${detail.description}, summary),
          published_at = COALESCE(${detail.publishedAt}::timestamptz, published_at),
          main_topic = COALESCE(${detail.topic}, main_topic),
          updated_at = NOW()
        WHERE id = ${String(row.id)}::bigint
      `;
      newsCount++;
    }),
  );

  return { documents: documentCount, news: newsCount };
}

async function readMetadata(url: string, title: string): Promise<DetailMetadata | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DETAIL_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "RadarAmbientalColombia/0.6 (+https://github.com/ingeambientalcorrea-pixel/radar-ambiental-colombia)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-CO,es;q=0.9",
      },
    });

    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("html") && !contentType.includes("text")) return null;

    const html = await response.text();
    const description = extractDescription(html);
    const publishedAt = extractDate(html);
    const pdfUrl = extractPdf(html, response.url || url);
    const sample = `${title} ${description || ""}`;

    return {
      description,
      publishedAt,
      pdfUrl,
      topic: classifyTopic(sample),
      keywords: buildKeywords(sample),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractDescription(html: string) {
  const metaPatterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
  ];

  for (const pattern of metaPatterns) {
    const match = html.match(pattern);
    const cleaned = cleanText(match?.[1] || "");
    if (cleaned.length >= 30) return cleaned.slice(0, 1600);
  }

  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => cleanText(match[1] || ""))
    .filter((text) => text.length >= 45 && !/cookie|privacidad|navegador|javascript/i.test(text));

  if (paragraphs.length === 0) return null;
  return paragraphs.slice(0, 2).join(" ").slice(0, 1600);
}

function extractDate(html: string) {
  const patterns = [
    /(?:article:published_time|datePublished|datepublished|publish_date|publication_date)[^>"']*["']?\s*(?:content|:)\s*=\s*["']([^"']+)["']/i,
    /<meta[^>]+(?:name|property)=["'](?:date|datePublished|article:published_time|publication_date)["'][^>]+content=["']([^"']+)["']/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
    /(?:Publicado|Publicada|Fecha de publicación|Fecha de Publicación|Fecha de Expedición)\s*:?[\s<>&a-z;/=-]*([0-3]?\d[\/\-.][01]?\d[\/\-.](?:19|20)\d{2})/i,
    /\b((?:19|20)\d{2}-[01]\d-[0-3]\d)(?:T[^"'<\s]+)?/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    const normalized = normalizeDate(match[1]);
    if (normalized) return normalized;
  }

  return null;
}

function normalizeDate(value: string) {
  const trimmed = cleanText(value).trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/\b((?:19|20)\d{2})-([01]\d)-([0-3]\d)/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const latin = trimmed.match(/\b([0-3]?\d)[\/\-.]([01]?\d)[\/\-.]((?:19|20)\d{2})\b/);
  if (latin) {
    const day = latin[1].padStart(2, "0");
    const month = latin[2].padStart(2, "0");
    return `${latin[3]}-${month}-${day}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime()) && parsed.getFullYear() >= 1950 && parsed.getFullYear() <= 2100) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function extractPdf(html: string, baseUrl: string) {
  const matches = html.matchAll(/href\s*=\s*["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi);
  for (const match of matches) {
    try {
      return new URL(decodeEntities(match[1]), baseUrl).toString();
    } catch {
      // Continue trying other links.
    }
  }
  return null;
}

function classifyTopic(value: string) {
  const t = normalize(value);
  const groups: Array<[string[], string]> = [
    [["vertimiento", "saneamiento", "alcantarill", "agua residual"], "Agua, saneamiento y vertimientos"],
    [["agua", "hidric", "cuenca", "pomca", "pueaa"], "Recurso hídrico"],
    [["residuo", "economia circular", "recicl", "pgirs", "plastico"], "Residuos y economía circular"],
    [["cambio climatico", "descarbon", "carbono", "energia"], "Cambio climático y energía"],
    [["biodivers", "fauna", "flora", "bosque", "area protegida"], "Biodiversidad y áreas protegidas"],
    [["aire", "emision", "ruido", "atmosfer"], "Aire, ruido y emisiones"],
    [["licencia", "permiso", "concesion", "aprovechamiento"], "Licenciamiento, permisos y autorizaciones"],
    [["ordenamiento", "territorial", "pot", "pbot", "eot"], "Ordenamiento territorial"],
    [["riesgo", "desastre"], "Gestión del riesgo"],
    [["sostenib", "esg", "gri", "reporte"], "Sostenibilidad y ESG"],
  ];

  return groups.find(([terms]) => terms.some((term) => t.includes(term)))?.[1] || null;
}

function buildKeywords(value: string) {
  const t = normalize(value);
  const candidates = [
    "agua", "vertimientos", "saneamiento", "residuos", "economía circular",
    "emisiones", "aire", "ruido", "biodiversidad", "bosques", "licenciamiento",
    "permisos", "cambio climático", "energía", "ordenamiento territorial",
    "riesgo", "sostenibilidad", "ESG", "POMCA", "PGAR", "POT", "PGIRS",
  ];

  const hits = candidates.filter((word) => t.includes(normalize(word)));
  return hits.length ? hits.join(", ") : null;
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

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function isPdf(url: string) {
  return /\.pdf(?:$|\?)/i.test(url);
}
