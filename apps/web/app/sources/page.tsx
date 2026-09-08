import Sidebar from "@/components/Sidebar";
import { getSources } from "@/lib/radar";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const sources = await getSources();
  const online = sources.filter((source) => source.status === "online").length;
  const issues = sources.length - online;

  return (
    <div className="app-shell">
      <Sidebar active="sources" />

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">MONITOREO DE FUENTES</div>
            <h1>Fuentes ambientales y de sostenibilidad</h1>
            <p>Repositorios oficiales, autoridades ambientales, entidades territoriales, gremios y portales especializados configurados para el Radar.</p>
          </div>
          <div className="update-box"><span>Fuentes activas</span><strong>{sources.length}</strong></div>
        </header>

        <section className="health-grid">
          <HealthCard value={sources.length} label="Configuradas" tone="neutral" />
          <HealthCard value={online} label="Operativas" tone="good" />
          <HealthCard value={issues} label="Requieren revisión" tone="warn" />
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Inventario de fuentes</h2>
              <p>Cada enlace abre directamente el portal configurado en Neon.</p>
            </div>
          </div>

          {sources.length === 0 ? (
            <div className="empty-state"><strong>No hay fuentes disponibles.</strong><p>Verifica DATABASE_URL y la tabla sources en Neon.</p></div>
          ) : (
            <table className="sources-table">
              <thead><tr><th>Fuente</th><th>Tipo</th><th>Territorio</th><th>Estado</th><th>Última revisión</th><th>Enlace</th></tr></thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.id}>
                    <td><strong>{source.name}</strong>{source.department ? <div className="muted">{source.department}</div> : null}</td>
                    <td>{source.source_type ?? source.category ?? "Ambiental"}</td>
                    <td>{source.geographic_scope ?? "Colombia"}</td>
                    <td><span className={`status-pill status-${source.status ?? "pending"}`}>{formatStatus(source.status)}</span></td>
                    <td>{formatDateTime(source.last_checked_at)}</td>
                    <td>{source.official_url ? <a href={source.official_url} target="_blank" rel="noreferrer">Abrir fuente ↗</a> : <span className="muted">Sin URL</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}

function HealthCard({ value, label, tone }: { value: number; label: string; tone: "neutral" | "good" | "warn" }) {
  return <div className={`health-card health-${tone}`}><strong>{value}</strong><span>{label}</span></div>;
}

function formatStatus(status: string | null) {
  if (!status) return "Pendiente";
  const labels: Record<string, string> = { online: "Operativa", blocked: "Bloqueada", error: "Error", http_502: "HTTP 502", rate_limited: "Limitada", pending: "Pendiente" };
  return labels[status] ?? status.replaceAll("_", " ");
}

function formatDateTime(value: string | null) {
  if (!value) return "Sin revisión";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(date);
}
