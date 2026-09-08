import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { getSystemStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const status = await getSystemStatus();

  return (
    <div className="app-shell">
      <Sidebar active="status" />

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">DIAGNÓSTICO EN PRODUCCIÓN</div>
            <h1>Estado del sistema</h1>
            <p>
              Verificación de Neon, cobertura de fuentes, volumen de información y
              últimas ejecuciones del Radar Ambiental Colombia.
            </p>
          </div>
          <div className="update-box">
            <span>Estado general</span>
            <strong>{status.ok ? "Operativo" : "Requiere atención"}</strong>
          </div>
        </header>

        {!status.ok && status.error ? (
          <section className="system-alert">
            <strong>No fue posible completar el diagnóstico.</strong>
            <span>{status.error}</span>
          </section>
        ) : (
          <section className="success-banner">
            <span className="live-dot" />
            <div>
              <strong>Base de datos conectada</strong>
              <span>La aplicación está consultando Neon PostgreSQL correctamente.</span>
            </div>
          </section>
        )}

        <section className="cards">
          <Metric value={status.counts.documents} label="Documentos" description="Base documental" />
          <Metric value={status.counts.jurisprudence} label="Jurisprudencia" description="Decisiones clasificadas" />
          <Metric value={status.counts.plansPolicies} label="Planes y políticas" description="Planeación ambiental" />
          <Metric value={status.counts.news} label="Alertas sectoriales" description="Gremios y sostenibilidad" />
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Salud de las fuentes</h2>
              <p>Estado actual del inventario conectado al Radar.</p>
            </div>
            <Link className="text-link" href="/sources">Ver fuentes →</Link>
          </div>

          <div className="health-grid">
            <Health value={status.counts.sources} label="Configuradas" tone="neutral" />
            <Health value={status.counts.onlineSources} label="Operativas" tone="good" />
            <Health value={status.counts.problemSources} label="Con incidencias" tone="warn" />
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Últimas ejecuciones</h2>
              <p>Resultados recientes del proceso de rastreo y deduplicación.</p>
            </div>
          </div>

          {status.recentRuns.length === 0 ? (
            <div className="empty-state">
              <strong>Todavía no hay ejecuciones registradas.</strong>
            </div>
          ) : (
            <div className="issue-list">
              {status.recentRuns.map((run) => (
                <article className="source-row" key={run.id}>
                  <div>
                    <strong>{run.sourceName}</strong>
                    <span>{formatDateTime(run.finishedAt ?? run.startedAt)}</span>
                  </div>
                  <div className={`status-pill status-${run.status ?? "pending"}`}>
                    {formatRunStatus(run.status)}
                  </div>
                  <div className="muted">
                    encontrados {run.found} · nuevos {run.inserted} · actualizados {run.updated} · sin cambios {run.unchanged}
                  </div>
                  {run.errorMessage ? <div className="muted">{run.errorMessage}</div> : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Prueba rápida</h2>
              <p>Estas cuatro comprobaciones permiten validar el sistema sin usar PowerShell.</p>
            </div>
          </div>
          <div className="topic-list">
            <Link className="topic" href="/documents"><span>1. Abrir la Base documental y realizar una búsqueda</span><span>→</span></Link>
            <Link className="topic" href="/news"><span>2. Revisar Inteligencia sectorial</span><span>→</span></Link>
            <Link className="topic" href="/sources"><span>3. Comprobar fuentes y enlaces oficiales</span><span>→</span></Link>
            <Link className="topic" href="/api/health"><span>4. Abrir diagnóstico técnico JSON</span><span>→</span></Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({ value, label, description }: { value: number; label: string; description: string }) {
  return (
    <div className="metric-card">
      <div className="metric-number">{value}</div>
      <strong>{label}</strong>
      <span>{description}</span>
    </div>
  );
}

function Health({ value, label, tone }: { value: number; label: string; tone: "neutral" | "good" | "warn" }) {
  return <div className={`health-card health-${tone}`}><strong>{value}</strong><span>{label}</span></div>;
}

function formatRunStatus(value: string | null) {
  const labels: Record<string, string> = {
    success: "Correcta",
    running: "En proceso",
    error: "Error",
    online: "Correcta",
    blocked: "Bloqueada",
  };
  if (!value) return "Pendiente";
  return labels[value] ?? value.replaceAll("_", " ");
}

function formatDateTime(value: string | null) {
  if (!value) return "Fecha no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(date);
}
