import Link from "next/link";
import { getDashboardData } from "@/lib/radar";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getDashboardData();
  const { metrics } = data;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">🌎</div>
          <div>
            <strong>RADAR AMBIENTAL</strong>
            <span>COLOMBIA</span>
          </div>
        </div>

        <nav>
          <Link className="nav-item active" href="/">▣ Dashboard</Link>
          <a className="nav-item" href="#novedades">⚡ Novedades</a>
          <a className="nav-item" href="#documentos">▤ Base documental</a>
          <a className="nav-item" href="#documentos">⌕ Buscador</a>

          <div className="nav-title">INTELIGENCIA</div>
          <a className="nav-item" href="#documentos">⚖ Jurisprudencia</a>
          <a className="nav-item" href="#documentos">📋 Políticas y planes</a>
          <a className="nav-item" href="#documentos">📐 Documentos técnicos</a>
          <a className="nav-item" href="#sectorial">🏭 Inteligencia sectorial</a>

          <div className="nav-title">SISTEMA</div>
          <Link className="nav-item" href="/sources">🔗 Fuentes</Link>
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">PLATAFORMA WEB V0.6</div>
            <h1>Radar Ambiental Colombia</h1>
            <p>
              Inteligencia normativa, jurisprudencial, territorial y de sostenibilidad
              para equipos ambientales en Colombia.
            </p>
          </div>

          <div className="update-box">
            <span>Estado de la plataforma</span>
            <strong>{data.error ? "Requiere atención" : "Conectada a Neon"}</strong>
          </div>
        </header>

        {data.error && (
          <section className="system-alert">
            <strong>No pudimos leer la base de datos.</strong>
            <span>{data.error}</span>
          </section>
        )}

        <section className="cards" aria-label="Indicadores principales">
          <MetricCard value={metrics.documents} label="Documentos" description="Base documental consolidada" />
          <MetricCard value={metrics.jurisprudence} label="Jurisprudencia" description="Sentencias y decisiones" />
          <MetricCard value={metrics.plansPolicies} label="Planes y políticas" description="Instrumentos de planeación" />
          <MetricCard value={metrics.news} label="Inteligencia sectorial" description="Noticias y alertas empresariales" />
        </section>

        <section className="panel" id="novedades">
          <div className="panel-header">
            <div>
              <h2>Estado de las fuentes</h2>
              <p>Monitoreo real de los portales configurados en Neon.</p>
            </div>
            <Link className="text-link" href="/sources">Ver todas →</Link>
          </div>

          <div className="health-grid">
            <HealthCard value={metrics.sources} label="Configuradas" tone="neutral" />
            <HealthCard value={metrics.onlineSources} label="Operativas" tone="good" />
            <HealthCard value={metrics.problemSources} label="Requieren revisión" tone="warn" />
          </div>

          {data.problemSources.length > 0 && (
            <div className="issue-list">
              {data.problemSources.map((source) => (
                <article className="source-row" key={source.id}>
                  <div>
                    <strong>{source.name}</strong>
                    <span>{source.source_type ?? "Fuente ambiental"}</span>
                  </div>
                  <div className={`status-pill status-${source.status ?? "pending"}`}>
                    {formatStatus(source.status)}
                  </div>
                  {source.official_url ? (
                    <a href={source.official_url} target="_blank" rel="noreferrer">Abrir fuente ↗</a>
                  ) : (
                    <span className="muted">Sin URL</span>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel" id="documentos">
          <div className="panel-header">
            <div>
              <h2>Documentos recientes</h2>
              <p>Normas, jurisprudencia, planes, políticas y documentos técnicos.</p>
            </div>
          </div>

          {data.recentDocuments.length === 0 ? (
            <div className="empty-state">
              <strong>La base documental todavía está vacía.</strong>
              <p>
                La infraestructura ya está preparada. La siguiente capa incorporará los
                recolectores que poblarán esta sección sin duplicar documentos.
              </p>
            </div>
          ) : (
            <div className="results">
              {data.recentDocuments.map((document) => (
                <article className="alert-card" key={document.id}>
                  <div className="alert-top">
                    <span className="document-type">
                      {document.document_type ?? document.document_family ?? "Documento"}
                    </span>
                    <span className="date">{formatDate(document.date_published ?? document.date_issued)}</span>
                  </div>
                  <h3>{document.title}</h3>
                  <div className="metadata">
                    <span><b>Tema:</b> {document.main_topic ?? "Por clasificar"}</span>
                    <span><b>Territorio:</b> {document.municipality ?? document.department ?? document.geographic_scope ?? "Colombia"}</span>
                  </div>
                  {(document.official_url || document.pdf_url) && (
                    <div className="card-actions">
                      <a className="button-link" href={document.pdf_url ?? document.official_url ?? "#"} target="_blank" rel="noreferrer">
                        Ver documento oficial ↗
                      </a>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="bottom-grid" id="sectorial">
          <div className="panel">
            <h2>Temas bajo vigilancia</h2>
            <div className="topic-list">
              <Topic name="Agua, saneamiento y vertimientos" />
              <Topic name="Residuos y economía circular" />
              <Topic name="Cambio climático y energía" />
              <Topic name="Biodiversidad y áreas protegidas" />
              <Topic name="Aire, ruido y emisiones" />
              <Topic name="Licenciamiento y permisos" />
            </div>
          </div>

          <div className="panel">
            <h2>Inteligencia empresarial</h2>
            <p className="muted">
              Seguimiento a gremios y portales de sostenibilidad con foco en impacto
              regulatorio, operativo, reputacional y estratégico.
            </p>
            <div className="source-tags">
              <span>ANDI</span><span>FENALCO</span><span>ANDESCO</span><span>CAMACOL</span>
              <span>CECODES</span><span>CCCS</span><span>ACP</span><span>Naturgas</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({ value, label, description }: { value: number; label: string; description: string }) {
  return (
    <div className="metric-card">
      <div className="metric-number">{value}</div>
      <strong>{label}</strong>
      <span>{description}</span>
    </div>
  );
}

function HealthCard({ value, label, tone }: { value: number; label: string; tone: "neutral" | "good" | "warn" }) {
  return (
    <div className={`health-card health-${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Topic({ name }: { name: string }) {
  return <div className="topic"><span>{name}</span><span>→</span></div>;
}

function formatStatus(status: string | null) {
  if (!status) return "Pendiente";
  const labels: Record<string, string> = {
    online: "Operativa",
    blocked: "Bloqueada",
    error: "Error",
    http_502: "HTTP 502",
    rate_limited: "Limitada",
    pending: "Pendiente",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function formatDate(value: string | null) {
  if (!value) return "Fecha no disponible";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(date);
}
