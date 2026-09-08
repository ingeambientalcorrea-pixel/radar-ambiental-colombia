import { getSql } from "./db";

export type SystemStatus = {
  ok: boolean;
  error: string | null;
  counts: {
    sources: number;
    onlineSources: number;
    problemSources: number;
    documents: number;
    jurisprudence: number;
    plansPolicies: number;
    news: number;
  };
  lastRun: {
    sourceName: string | null;
    status: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    found: number;
    inserted: number;
    updated: number;
    unchanged: number;
    errorMessage: string | null;
  } | null;
  recentRuns: Array<{
    id: string;
    sourceName: string;
    status: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    found: number;
    inserted: number;
    updated: number;
    unchanged: number;
    errorMessage: string | null;
  }>;
};

const emptyStatus: SystemStatus = {
  ok: false,
  error: "DATABASE_URL no está configurada.",
  counts: {
    sources: 0,
    onlineSources: 0,
    problemSources: 0,
    documents: 0,
    jurisprudence: 0,
    plansPolicies: 0,
    news: 0,
  },
  lastRun: null,
  recentRuns: [],
};

export async function getSystemStatus(): Promise<SystemStatus> {
  const sql = getSql();
  if (!sql) return emptyStatus;

  try {
    const [sourceStats, documentStats, newsStats, runs] = await Promise.all([
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
          COUNT(*) FILTER (WHERE document_family = 'Jurisprudencia')::int AS jurisprudence,
          COUNT(*) FILTER (WHERE document_family = 'Planeación y política')::int AS plans_policies
        FROM documents
      `,
      sql`SELECT COUNT(*)::int AS news FROM news`,
      sql`
        SELECT
          cr.id::text,
          s.name AS source_name,
          cr.status,
          cr.started_at::text,
          cr.finished_at::text,
          COALESCE(cr.found_count, 0)::int AS found_count,
          COALESCE(cr.inserted_count, 0)::int AS inserted_count,
          COALESCE(cr.updated_count, 0)::int AS updated_count,
          COALESCE(cr.unchanged_count, 0)::int AS unchanged_count,
          cr.error_message
        FROM crawl_runs cr
        LEFT JOIN sources s ON s.id = cr.source_id
        ORDER BY cr.started_at DESC
        LIMIT 12
      `,
    ]);

    const recentRuns = runs.map((row) => ({
      id: String(row.id),
      sourceName: String(row.source_name ?? "Fuente desconocida"),
      status: row.status ? String(row.status) : null,
      startedAt: row.started_at ? String(row.started_at) : null,
      finishedAt: row.finished_at ? String(row.finished_at) : null,
      found: Number(row.found_count ?? 0),
      inserted: Number(row.inserted_count ?? 0),
      updated: Number(row.updated_count ?? 0),
      unchanged: Number(row.unchanged_count ?? 0),
      errorMessage: row.error_message ? String(row.error_message) : null,
    }));

    const first = recentRuns[0];

    return {
      ok: true,
      error: null,
      counts: {
        sources: Number(sourceStats[0]?.sources ?? 0),
        onlineSources: Number(sourceStats[0]?.online_sources ?? 0),
        problemSources: Number(sourceStats[0]?.problem_sources ?? 0),
        documents: Number(documentStats[0]?.documents ?? 0),
        jurisprudence: Number(documentStats[0]?.jurisprudence ?? 0),
        plansPolicies: Number(documentStats[0]?.plans_policies ?? 0),
        news: Number(newsStats[0]?.news ?? 0),
      },
      lastRun: first
        ? {
            sourceName: first.sourceName,
            status: first.status,
            startedAt: first.startedAt,
            finishedAt: first.finishedAt,
            found: first.found,
            inserted: first.inserted,
            updated: first.updated,
            unchanged: first.unchanged,
            errorMessage: first.errorMessage,
          }
        : null,
      recentRuns,
    };
  } catch (error) {
    return {
      ...emptyStatus,
      error: error instanceof Error ? error.message : "No fue posible consultar el estado del sistema.",
    };
  }
}
