import { getSql } from "./db";

export type RadarUpdate = {
  id: string;
  kind: "document" | "news";
  title: string;
  category: string;
  topic: string | null;
  source: string | null;
  detectedAt: string | null;
  publishedAt: string | null;
  href: string;
};

export async function getRecentUpdates(limit = 100) {
  const sql = getSql();
  if (!sql) return [] as RadarUpdate[];

  const safeLimit = Math.max(1, Math.min(limit, 250));

  try {
    const rows = await sql`
      SELECT * FROM (
        SELECT
          d.id::text AS id,
          'document'::text AS kind,
          d.title,
          COALESCE(d.document_type, d.document_family, 'Documento') AS category,
          d.main_topic AS topic,
          a.name AS source,
          d.first_seen_at::text AS detected_at,
          COALESCE(d.date_published, d.date_issued)::text AS published_at
        FROM documents d
        LEFT JOIN authorities a ON a.id = d.authority_id

        UNION ALL

        SELECT
          n.id::text AS id,
          'news'::text AS kind,
          n.title,
          COALESCE(n.content_kind, 'Alerta sectorial') AS category,
          n.main_topic AS topic,
          (
            SELECT s.name
            FROM news_sources ns
            JOIN sources s ON s.id = ns.source_id
            WHERE ns.news_id = n.id
            ORDER BY s.priority ASC, s.name ASC
            LIMIT 1
          ) AS source,
          n.first_seen_at::text AS detected_at,
          n.published_at::text AS published_at
        FROM news n
      ) updates
      ORDER BY detected_at DESC NULLS LAST
      LIMIT ${safeLimit}
    `;

    return rows.map((row) => ({
      id: String(row.id),
      kind: String(row.kind) === "news" ? "news" : "document",
      title: String(row.title),
      category: String(row.category || "Documento"),
      topic: row.topic ? String(row.topic) : null,
      source: row.source ? String(row.source) : null,
      detectedAt: row.detected_at ? String(row.detected_at) : null,
      publishedAt: row.published_at ? String(row.published_at) : null,
      href: String(row.kind) === "news" ? `/news/${row.id}` : `/documents/${row.id}`,
    })) as RadarUpdate[];
  } catch {
    return [] as RadarUpdate[];
  }
}
