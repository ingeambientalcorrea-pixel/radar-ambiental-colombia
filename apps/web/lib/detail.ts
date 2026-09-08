import { getSql } from "./db";

export type DetailSource = {
  name: string;
  url: string | null;
  pdfUrl: string | null;
};

export type DocumentDetail = {
  id: string;
  title: string;
  documentFamily: string | null;
  documentType: string | null;
  documentNumber: string | null;
  year: number | null;
  dateIssued: string | null;
  datePublished: string | null;
  authority: string | null;
  geographicScope: string | null;
  department: string | null;
  municipality: string | null;
  mainTopic: string | null;
  subtopics: string | null;
  keywords: string | null;
  description: string | null;
  summary: string | null;
  legalStatus: string | null;
  legalScope: string | null;
  officialUrl: string | null;
  pdfUrl: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  updatedAt: string | null;
  sources: DetailSource[];
  changes: Array<{
    detectedAt: string | null;
    changeType: string | null;
    description: string | null;
  }>;
};

export type NewsDetail = {
  id: string;
  title: string;
  publishedAt: string | null;
  contentKind: string | null;
  sourceCategory: string | null;
  sector: string | null;
  mainTopic: string | null;
  subtopics: string | null;
  businessImpact: string | null;
  alertLevel: string | null;
  relevanceScore: number | null;
  relevanceReason: string | null;
  description: string | null;
  summary: string | null;
  canonicalUrl: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  updatedAt: string | null;
  sources: Array<{ name: string; url: string | null }>;
};

export async function getDocumentDetail(id: string): Promise<DocumentDetail | null> {
  if (!/^\d+$/.test(id)) return null;
  const sql = getSql();
  if (!sql) return null;

  try {
    const rows = await sql`
      SELECT
        d.id::text,
        d.title,
        d.document_family,
        d.document_type,
        d.document_number,
        d.year,
        d.date_issued::text,
        d.date_published::text,
        a.name AS authority,
        d.geographic_scope,
        d.department,
        d.municipality,
        d.main_topic,
        d.subtopics,
        d.keywords,
        d.description,
        d.summary,
        d.legal_status,
        d.legal_scope,
        d.official_url,
        d.pdf_url,
        d.first_seen_at::text,
        d.last_seen_at::text,
        d.updated_at::text
      FROM documents d
      LEFT JOIN authorities a ON a.id = d.authority_id
      WHERE d.id = ${id}::bigint
      LIMIT 1
    `;

    if (!rows[0]) return null;

    const [sourceRows, changeRows] = await Promise.all([
      sql`
        SELECT DISTINCT
          s.name,
          COALESCE(ds.source_url, s.repository_url, s.official_url) AS url,
          ds.pdf_url
        FROM document_sources ds
        JOIN sources s ON s.id = ds.source_id
        WHERE ds.document_id = ${id}::bigint
        ORDER BY s.name
      `,
      sql`
        SELECT detected_at::text, change_type, description
        FROM document_changes
        WHERE document_id = ${id}::bigint
        ORDER BY detected_at DESC
        LIMIT 20
      `,
    ]);

    const row = rows[0];
    return {
      id: String(row.id),
      title: String(row.title),
      documentFamily: row.document_family ? String(row.document_family) : null,
      documentType: row.document_type ? String(row.document_type) : null,
      documentNumber: row.document_number ? String(row.document_number) : null,
      year: row.year === null || row.year === undefined ? null : Number(row.year),
      dateIssued: row.date_issued ? String(row.date_issued) : null,
      datePublished: row.date_published ? String(row.date_published) : null,
      authority: row.authority ? String(row.authority) : null,
      geographicScope: row.geographic_scope ? String(row.geographic_scope) : null,
      department: row.department ? String(row.department) : null,
      municipality: row.municipality ? String(row.municipality) : null,
      mainTopic: row.main_topic ? String(row.main_topic) : null,
      subtopics: row.subtopics ? String(row.subtopics) : null,
      keywords: row.keywords ? String(row.keywords) : null,
      description: row.description ? String(row.description) : null,
      summary: row.summary ? String(row.summary) : null,
      legalStatus: row.legal_status ? String(row.legal_status) : null,
      legalScope: row.legal_scope ? String(row.legal_scope) : null,
      officialUrl: row.official_url ? String(row.official_url) : null,
      pdfUrl: row.pdf_url ? String(row.pdf_url) : null,
      firstSeenAt: row.first_seen_at ? String(row.first_seen_at) : null,
      lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
      updatedAt: row.updated_at ? String(row.updated_at) : null,
      sources: sourceRows.map((source) => ({
        name: String(source.name),
        url: source.url ? String(source.url) : null,
        pdfUrl: source.pdf_url ? String(source.pdf_url) : null,
      })),
      changes: changeRows.map((change) => ({
        detectedAt: change.detected_at ? String(change.detected_at) : null,
        changeType: change.change_type ? String(change.change_type) : null,
        description: change.description ? String(change.description) : null,
      })),
    };
  } catch {
    return null;
  }
}

export async function getNewsDetail(id: string): Promise<NewsDetail | null> {
  if (!/^\d+$/.test(id)) return null;
  const sql = getSql();
  if (!sql) return null;

  try {
    const rows = await sql`
      SELECT
        id::text,
        title,
        published_at::text,
        content_kind,
        source_category,
        sector,
        main_topic,
        subtopics,
        business_impact,
        alert_level,
        relevance_score,
        relevance_reason,
        description,
        summary,
        canonical_url,
        first_seen_at::text,
        last_seen_at::text,
        updated_at::text
      FROM news
      WHERE id = ${id}::bigint
      LIMIT 1
    `;

    if (!rows[0]) return null;

    const sourceRows = await sql`
      SELECT DISTINCT s.name, COALESCE(ns.source_url, s.repository_url, s.official_url) AS url
      FROM news_sources ns
      JOIN sources s ON s.id = ns.source_id
      WHERE ns.news_id = ${id}::bigint
      ORDER BY s.name
    `;

    const row = rows[0];
    return {
      id: String(row.id),
      title: String(row.title),
      publishedAt: row.published_at ? String(row.published_at) : null,
      contentKind: row.content_kind ? String(row.content_kind) : null,
      sourceCategory: row.source_category ? String(row.source_category) : null,
      sector: row.sector ? String(row.sector) : null,
      mainTopic: row.main_topic ? String(row.main_topic) : null,
      subtopics: row.subtopics ? String(row.subtopics) : null,
      businessImpact: row.business_impact ? String(row.business_impact) : null,
      alertLevel: row.alert_level ? String(row.alert_level) : null,
      relevanceScore: row.relevance_score === null || row.relevance_score === undefined ? null : Number(row.relevance_score),
      relevanceReason: row.relevance_reason ? String(row.relevance_reason) : null,
      description: row.description ? String(row.description) : null,
      summary: row.summary ? String(row.summary) : null,
      canonicalUrl: row.canonical_url ? String(row.canonical_url) : null,
      firstSeenAt: row.first_seen_at ? String(row.first_seen_at) : null,
      lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
      updatedAt: row.updated_at ? String(row.updated_at) : null,
      sources: sourceRows.map((source) => ({
        name: String(source.name),
        url: source.url ? String(source.url) : null,
      })),
    };
  } catch {
    return null;
  }
}
