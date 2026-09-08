import { getSql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const sql = getSql();
  if (!sql) {
    return Response.json({ ok: false, database: false, error: "DATABASE_URL no configurada" }, { status: 503 });
  }

  try {
    const [db, stats] = await Promise.all([
      sql`SELECT current_database() AS database, NOW()::text AS server_time`,
      sql`
        SELECT
          (SELECT COUNT(*)::int FROM sources) AS sources,
          (SELECT COUNT(*)::int FROM documents) AS documents,
          (SELECT COUNT(*)::int FROM news) AS news,
          (SELECT MAX(finished_at)::text FROM crawl_runs WHERE status = 'success') AS last_crawl_at,
          (SELECT COUNT(*)::int FROM sources WHERE active = TRUE AND status = 'online') AS online_sources,
          (SELECT COUNT(*)::int FROM sources WHERE active = TRUE AND COALESCE(status, 'pending') <> 'online') AS problem_sources
      `,
    ]);

    return Response.json({
      ok: true,
      database: db[0]?.database,
      serverTime: db[0]?.server_time,
      sources: stats[0]?.sources ?? 0,
      onlineSources: stats[0]?.online_sources ?? 0,
      problemSources: stats[0]?.problem_sources ?? 0,
      documents: stats[0]?.documents ?? 0,
      news: stats[0]?.news ?? 0,
      lastCrawlAt: stats[0]?.last_crawl_at ?? null,
    });
  } catch (error) {
    return Response.json(
      { ok: false, database: false, error: error instanceof Error ? error.message : "Error de base de datos" },
      { status: 503 },
    );
  }
}
