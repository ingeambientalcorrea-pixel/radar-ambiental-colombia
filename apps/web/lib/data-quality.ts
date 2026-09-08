import { getSql } from "./db";
import { decodeHtmlEntities, normalizeSearchText } from "./text";

const MAX_ROWS_PER_SOURCE = 80;

export async function normalizeSourceItems(sourceId: string) {
  const sql = getSql();
  if (!sql || !/^\d+$/.test(sourceId)) return { documents: 0, news: 0 };

  const [documents, news] = await Promise.all([
    sql`
      SELECT DISTINCT d.id::text, d.title, d.description, d.summary,
        d.date_published::text, d.official_url, d.canonical_url
      FROM documents d
      JOIN document_sources ds ON ds.document_id = d.id
      WHERE ds.source_id = ${sourceId}::bigint
      ORDER BY d.id DESC
      LIMIT ${MAX_ROWS_PER_SOURCE}
    `,
    sql`
      SELECT DISTINCT n.id::text, n.title, n.description, n.summary,
        n.published_at::text, n.canonical_url
      FROM news n
      JOIN news_sources ns ON ns.news_id = n.id
      WHERE ns.source_id = ${sourceId}::bigint
      ORDER BY n.id DESC
      LIMIT ${MAX_ROWS_PER_SOURCE}
    `,
  ]);

  let documentCount = 0;
  let newsCount = 0;

  await Promise.all(documents.map(async (row) => {
    const title = decodeHtmlEntities(String(row.title || ""));
    const description = nullableDecode(row.description);
    const summary = nullableDecode(row.summary);
    const published = row.date_published ? String(row.date_published) : inferDate(`${title} ${description || ""}`);
    const officialUrl = normalizeUrl(row.official_url ? String(row.official_url) : null);
    const canonicalUrl = normalizeUrl(row.canonical_url ? String(row.canonical_url) : officialUrl);

    await sql`
      UPDATE documents
      SET
        title = ${title},
        description = ${description},
        summary = ${summary},
        date_published = COALESCE(${published}::date, date_published),
        official_url = COALESCE(${officialUrl}, official_url),
        canonical_url = COALESCE(${canonicalUrl}, canonical_url),
        updated_at = CASE
          WHEN title IS DISTINCT FROM ${title}
            OR description IS DISTINCT FROM ${description}
            OR summary IS DISTINCT FROM ${summary}
          THEN NOW()
          ELSE updated_at
        END
      WHERE id = ${String(row.id)}::bigint
    `;
    documentCount++;
  }));

  await Promise.all(news.map(async (row) => {
    const title = decodeHtmlEntities(String(row.title || ""));
    const description = nullableDecode(row.description);
    const summary = nullableDecode(row.summary);
    const published = row.published_at ? String(row.published_at) : inferDate(`${title} ${description || ""}`);
    const canonicalUrl = normalizeUrl(row.canonical_url ? String(row.canonical_url) : null);

    await sql`
      UPDATE news
      SET
        title = ${title},
        description = ${description},
        summary = ${summary},
        published_at = COALESCE(${published}::timestamptz, published_at),
        canonical_url = COALESCE(${canonicalUrl}, canonical_url),
        updated_at = CASE
          WHEN title IS DISTINCT FROM ${title}
            OR description IS DISTINCT FROM ${description}
            OR summary IS DISTINCT FROM ${summary}
          THEN NOW()
          ELSE updated_at
        END
      WHERE id = ${String(row.id)}::bigint
    `;
    newsCount++;
  }));

  return { documents: documentCount, news: newsCount };
}

function nullableDecode(value: unknown) {
  if (value === null || value === undefined) return null;
  const cleaned = decodeHtmlEntities(String(value));
  return cleaned || null;
}

function normalizeUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(decodeHtmlEntities(value));
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();

    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_)/i.test(key)) url.searchParams.delete(key);
    }

    // El Gestor de la CRA publica rutas equivalentes con Gestor/gestor.
    if (url.hostname === "normas.cra.gov.co") {
      url.pathname = url.pathname.replace(/^\/Gestor\//, "/gestor/");
    }

    return url.toString();
  } catch {
    return value;
  }
}

function inferDate(value: string) {
  const normalized = normalizeSearchText(value);

  const iso = normalized.match(/\b((?:19|20)\d{2})-([01]?\d)-([0-3]?\d)\b/);
  if (iso) return validDate(`${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`);

  const latin = normalized.match(/\b([0-3]?\d)[\/.-]([01]?\d)[\/.-]((?:19|20)\d{2})\b/);
  if (latin) return validDate(`${latin[3]}-${latin[2].padStart(2, "0")}-${latin[1].padStart(2, "0")}`);

  const months: Record<string, string> = {
    enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
    julio: "07", agosto: "08", septiembre: "09", setiembre: "09", octubre: "10",
    noviembre: "11", diciembre: "12",
  };

  const words = normalized.match(/\b([0-3]?\d)\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(?:de\s+)?((?:19|20)\d{2})\b/);
  if (words) return validDate(`${words[3]}-${months[words[2]]}-${words[1].padStart(2, "0")}`);

  return null;
}

function validDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getUTCFullYear();
  if (year < 1950 || year > 2100) return null;
  return value;
}
