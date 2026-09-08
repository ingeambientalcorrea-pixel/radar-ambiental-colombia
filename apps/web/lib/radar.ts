import { getSql } from "./db";

export type RadarMetrics = {
  sources: number;
  onlineSources: number;
  problemSources: number;
  documents: number;
  jurisprudence: number;
  plansPolicies: number;
  news: number;
};

export type SourceHealth = {
  id: string;
  name: string;
  source_type: string | null;
  category: string | null;
  official_url: string | null;
  geographic_scope: string | null;
  department: string | null;
  priority: number | null;
  status: string | null;
  last_checked_at: string | null;
  last_success_at: string | null;
};

export type RecentDocument = {
  id: string;
  title: string;
  document_type: string | null;
  document_family: string | null;
  date_issued: string | null;
  date_published: string | null;
  main_topic: string | null;
  geographic_scope: string | null;
  department: string | null;
  municipality: string | null;
  official_url: string | null;
  pdf_url: string | null;
};

const emptyMetrics: RadarMetrics = {
  sources: 0,
  onlineSources: 0,
  problemSources: 0,
  documents: 0,
  jurisprudence: 0,
  plansPolicies: 0,
  news: 0,
};

export async function getDashboardData() {
  const sql = getSql();

  if (!sql) {
    return {
      configured: false,
      metrics: emptyMetrics,
      recentDocuments: [] as RecentDocument[],
      problemSources: [] as SourceHealth[],
      error: "DATABASE_URL no está configurada en el entorno de ejecución.",
    };
  }

  try {
    const [sourceStats, documentStats, newsStats, recentDocuments, problemSources] =
      await Promise.all([
        sql`
          SELECT
            COUNT(*)::int AS sources,
            COUNT(*) FILTER (WHERE active = TRUE AND status = 'online')::int AS online_sources,
            COUNT(*) FILTER (WHERE active = TRUE AND COALESCE(status, 'pending') <> 'online')::int AS problem_sources
          FROM sources
        `,
        sql`
          SELECT
            COUNT(*)::int AS documents,
            COUNT(*) FILTER (
              WHERE LOWER(COALESCE(document_family, '')) LIKE '%jurisprud%'
                 OR LOWER(COALESCE(document_type, '')) LIKE '%sentencia%'
                 OR LOWER(COALESCE(document_type, '')) LIKE '%judicial%'
            )::int AS jurisprudence,
            COUNT(*) FILTER (
              WHERE LOWER(COALESCE(document_family, '')) LIKE '%plan%'
                 OR LOWER(COALESCE(document_family, '')) LIKE '%política%'
                 OR LOWER(COALESCE(document_type, '')) LIKE '%conpes%'
                 OR LOWER(COALESCE(document_type, '')) LIKE '%pomca%'
                 OR LOWER(COALESCE(document_type, '')) LIKE '%pgar%'
                 OR LOWER(COALESCE(document_type, '')) LIKE '%pot%'
            )::int AS plans_policies
          FROM documents
        `,
        sql`SELECT COUNT(*)::int AS news FROM news`,
        sql`
          SELECT
            id::text,
            title,
            document_type,
            document_family,
            date_issued::text,
            date_published::text,
            main_topic,
            geographic_scope,
            department,
            municipality,
            official_url,
            pdf_url
          FROM documents
          ORDER BY COALESCE(date_published, date_issued) DESC NULLS LAST, first_seen_at DESC
          LIMIT 8
        `,
        sql`
          SELECT
            id::text,
            name,
            source_type,
            category,
            official_url,
            geographic_scope,
            department,
            priority,
            status,
            last_checked_at::text,
            last_success_at::text
          FROM sources
          WHERE active = TRUE AND COALESCE(status, 'pending') <> 'online'
          ORDER BY priority ASC, name ASC
          LIMIT 8
        `,
      ]);

    return {
      configured: true,
      metrics: {
        sources: sourceStats[0]?.sources ?? 0,
        onlineSources: sourceStats[0]?.online_sources ?? 0,
        problemSources: sourceStats[0]?.problem_sources ?? 0,
        documents: documentStats[0]?.documents ?? 0,
        jurisprudence: documentStats[0]?.jurisprudence ?? 0,
        plansPolicies: documentStats[0]?.plans_policies ?? 0,
        news: newsStats[0]?.news ?? 0,
      },
      recentDocuments: recentDocuments as unknown as RecentDocument[],
      problemSources: problemSources as unknown as SourceHealth[],
      error: null,
    };
  } catch (error) {
    return {
      configured: true,
      metrics: emptyMetrics,
      recentDocuments: [] as RecentDocument[],
      problemSources: [] as SourceHealth[],
      error: error instanceof Error ? error.message : "Error consultando Neon PostgreSQL.",
    };
  }
}

export async function getSources() {
  const sql = getSql();
  if (!sql) return [] as SourceHealth[];

  try {
    const rows = await sql`
      SELECT
        id::text,
        name,
        source_type,
        category,
        official_url,
        geographic_scope,
        department,
        priority,
        status,
        last_checked_at::text,
        last_success_at::text
      FROM sources
      WHERE active = TRUE
      ORDER BY priority ASC, name ASC
    `;
    return rows as unknown as SourceHealth[];
  } catch {
    return [] as SourceHealth[];
  }
}
