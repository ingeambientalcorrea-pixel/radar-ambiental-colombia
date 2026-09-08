import { getSql } from "./db";

export type CatalogFilters = {
  q?: string;
  type?: string;
  topic?: string;
  authority?: string;
  territory?: string;
  department?: string;
  year?: string;
};

export type DocumentRow = {
  id: string;
  title: string;
  document_family: string | null;
  document_type: string | null;
  document_number: string | null;
  year: number | null;
  date_issued: string | null;
  date_published: string | null;
  authority: string | null;
  geographic_scope: string | null;
  department: string | null;
  municipality: string | null;
  main_topic: string | null;
  description: string | null;
  summary: string | null;
  legal_status: string | null;
  official_url: string | null;
  pdf_url: string | null;
  first_seen_at: string | null;
};

export type NewsRow = {
  id: string;
  title: string;
  published_at: string | null;
  content_kind: string | null;
  source_category: string | null;
  sector: string | null;
  main_topic: string | null;
  business_impact: string | null;
  alert_level: string | null;
  relevance_score: number | null;
  relevance_reason: string | null;
  description: string | null;
  summary: string | null;
  canonical_url: string | null;
  source_name: string | null;
  first_seen_at: string | null;
};

export async function getDocuments(filters: CatalogFilters = {}) {
  const sql = getSql();
  if (!sql) return [] as DocumentRow[];

  const q = clean(filters.q);
  const type = clean(filters.type);
  const topic = clean(filters.topic);
  const authority = clean(filters.authority);
  const territory = clean(filters.territory);
  const department = clean(filters.department);
  const year = toNumber(filters.year);

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
        d.description,
        d.summary,
        d.legal_status,
        d.official_url,
        d.pdf_url,
        d.first_seen_at::text
      FROM documents d
      LEFT JOIN authorities a ON a.id = d.authority_id
      WHERE
        (${q}::text IS NULL OR
          d.title ILIKE '%' || ${q} || '%' OR
          COALESCE(d.summary, '') ILIKE '%' || ${q} || '%' OR
          COALESCE(d.description, '') ILIKE '%' || ${q} || '%' OR
          COALESCE(d.keywords, '') ILIKE '%' || ${q} || '%' OR
          COALESCE(a.name, '') ILIKE '%' || ${q} || '%')
        AND (${type}::text IS NULL OR d.document_type = ${type} OR d.document_family = ${type})
        AND (${topic}::text IS NULL OR d.main_topic = ${topic})
        AND (${authority}::text IS NULL OR a.name = ${authority})
        AND (${territory}::text IS NULL OR d.geographic_scope = ${territory})
        AND (${department}::text IS NULL OR d.department = ${department})
        AND (${year}::int IS NULL OR d.year = ${year})
      ORDER BY
        COALESCE(d.date_published, d.date_issued) DESC NULLS LAST,
        d.first_seen_at DESC
      LIMIT 250
    `;

    return rows as unknown as DocumentRow[];
  } catch {
    return [] as DocumentRow[];
  }
}

export async function getNews(filters: CatalogFilters = {}) {
  const sql = getSql();
  if (!sql) return [] as NewsRow[];

  const q = clean(filters.q);
  const topic = clean(filters.topic);
  const year = toNumber(filters.year);

  try {
    const rows = await sql`
      SELECT
        n.id::text,
        n.title,
        n.published_at::text,
        n.content_kind,
        n.source_category,
        n.sector,
        n.main_topic,
        n.business_impact,
        n.alert_level,
        n.relevance_score,
        n.relevance_reason,
        n.description,
        n.summary,
        n.canonical_url,
        s.name AS source_name,
        n.first_seen_at::text
      FROM news n
      LEFT JOIN news_sources ns ON ns.news_id = n.id
      LEFT JOIN sources s ON s.id = ns.source_id
      WHERE
        (${q}::text IS NULL OR
          n.title ILIKE '%' || ${q} || '%' OR
          COALESCE(n.summary, '') ILIKE '%' || ${q} || '%' OR
          COALESCE(n.description, '') ILIKE '%' || ${q} || '%' OR
          COALESCE(n.sector, '') ILIKE '%' || ${q} || '%' OR
          COALESCE(s.name, '') ILIKE '%' || ${q} || '%')
        AND (${topic}::text IS NULL OR n.main_topic = ${topic})
        AND (${year}::int IS NULL OR EXTRACT(YEAR FROM COALESCE(n.published_at, n.first_seen_at))::int = ${year})
      GROUP BY n.id, s.name
      ORDER BY
        COALESCE(n.published_at, n.first_seen_at) DESC NULLS LAST,
        n.relevance_score DESC NULLS LAST
      LIMIT 250
    `;

    return rows as unknown as NewsRow[];
  } catch {
    return [] as NewsRow[];
  }
}

export async function getDocumentFilterOptions() {
  const sql = getSql();
  if (!sql) return emptyOptions();

  try {
    const [types, topics, authorities, territories, departments, years] = await Promise.all([
      sql`SELECT DISTINCT COALESCE(document_type, document_family) AS value FROM documents WHERE COALESCE(document_type, document_family) IS NOT NULL ORDER BY value`,
      sql`SELECT DISTINCT main_topic AS value FROM documents WHERE main_topic IS NOT NULL ORDER BY value`,
      sql`SELECT DISTINCT a.name AS value FROM documents d JOIN authorities a ON a.id = d.authority_id ORDER BY value`,
      sql`SELECT DISTINCT geographic_scope AS value FROM documents WHERE geographic_scope IS NOT NULL ORDER BY value`,
      sql`SELECT DISTINCT department AS value FROM documents WHERE department IS NOT NULL ORDER BY value`,
      sql`SELECT DISTINCT year::text AS value FROM documents WHERE year IS NOT NULL ORDER BY value DESC`,
    ]);

    return {
      types: values(types),
      topics: values(topics),
      authorities: values(authorities),
      territories: values(territories),
      departments: values(departments),
      years: values(years),
    };
  } catch {
    return emptyOptions();
  }
}

export async function getNewsFilterOptions() {
  const sql = getSql();
  if (!sql) return { topics: [] as string[], years: [] as string[] };

  try {
    const [topics, years] = await Promise.all([
      sql`SELECT DISTINCT main_topic AS value FROM news WHERE main_topic IS NOT NULL ORDER BY value`,
      sql`SELECT DISTINCT EXTRACT(YEAR FROM COALESCE(published_at, first_seen_at))::int::text AS value FROM news ORDER BY value DESC`,
    ]);

    return { topics: values(topics), years: values(years) };
  } catch {
    return { topics: [] as string[], years: [] as string[] };
  }
}

function clean(value?: string) {
  const v = value?.trim();
  return v ? v : null;
}

function toNumber(value?: string) {
  const n = Number.parseInt(value || "", 10);
  return Number.isFinite(n) ? n : null;
}

function values(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => String(row.value ?? "")).filter(Boolean);
}

function emptyOptions() {
  return {
    types: [] as string[],
    topics: [] as string[],
    authorities: [] as string[],
    territories: [] as string[],
    departments: [] as string[],
    years: [] as string[],
  };
}
