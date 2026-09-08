import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import UpdateRadarButton from "@/components/UpdateRadarButton";
import { getDashboardData } from "@/lib/radar";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getDashboardData();
  const { metrics } = data;

  return (
    <div className="app-shell">
      <Sidebar active="dashboard" />

      <main className="main">
        <header className="topbar hero-topbar">
          <div>
            <div className="eyebrow">PLATAFORMA WEB V0.6</div>
            <h1>Radar Ambiental Colombia</h1>
            <p>
              Inteligencia normativa, jurisprudencial, territorial, técnica y de
              sostenibilidad para equipos ambientales en Colombia.
            </p>
          </div>
          <UpdateRadarButton />
        </header>

        {data.error ? (
          <section className="system-alert">
            <strong>No pudimos leer la base de datos.</strong>
            <span>{data.error}</span>
          </section>
        ) : (
          <section className="success-banner">
            <span className="live-dot" />
            <div><strong>Neon conectado</strong><span>La aplicación está leyendo datos reales de PostgreSQL.</span></div>
          </section>
        )}

        <section className="cards" aria-label="Indicadores principales">
          <MetricCard value={metrics.documents} label="Documentos" description="Normas, planes, políticas y técnicos" href="/documents" />
          <MetricCard value={metrics.jurisprudence} label="Jurisprudencia" description="Sentencias y decisiones" href="/documents?type=Sentencia" />
          <MetricCard value={metrics.plansPolicies} label="Planes y políticas" description="Instrumentos de planeación" href="/documents?type=Plan" />
          <MetricCard value={metrics.news} label="Inteligencia sectorial" description="Noticias y alertas empresariales" href="/news" />
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Estado de las fuentes</h2>
              <p>Monitoreo de portales oficiales, autoridades, gremios y fuentes especializadas.</p>
            </div>
            <Link className="text-link" href="/sources">Ver inventario →</Link>
          </div>

          <div className="health-grid">
            <HealthCard value={metrics.sources} label="Configuradas" tone="neutral" />
            <HealthCard value={metrics.onlineSources} label="Operativas" tone="good" />
            <HealthCard value={metrics.problemSources} label="Requieren revisión" tone="warn" />
          </div>

          {data.problemSources.length > 0 ? (
            <div className="issue-list">
              {data.problemSources.map((source) => (
                <article className="source-row" key={source.id}>
                  <div>
                    <strong>{source.name}</strong>
                    <span>{source.source_type ?? "Fuente ambiental"}</span>
                  </div>
                  <div className={`status-pill status-${source.status ?? "pending"}`}>{formatStatus(source.status)}</div>
                  {source.official_url ? <a href={source.official_url} target="_blank" rel="noreferrer">Abrir fuente ↗</a> : <span className="muted">Sin URL</span>}
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Documentos recientes</h2>
              <p>Información incorporada por los recolectores y deduplicada por URL e identidad documental.</p>
            </div>
            <Link className="text-link" href="/documents">Buscar en la base →</Link>
          </div>

          {data.recentDocuments.length === 0 ? (
            <div className="empty-state">
              <strong>La base documental está lista para recibir información.</strong>
              <p>Pulsa “Actualizar Radar” para iniciar la primera captura desde las fuentes actualmente operativas.</p>
            </div>
          ) : (
            <div className="results">
              {data.recentDocuments.map((document) => (
                <article className="alert-card" key={document.id}>
                  <div className="alert-top">
                    <span className="document-type">{document.document_type ?? document.document_family ?? "Documento"}</span>
                    <span className="date">{formatDate(document.date_published ?? document.date_issued)}</span>
                  </div>
                  <h3>{document.title}</h3>
                  <div className="metadata">
                    <span><b>Tema:</b> {document.main_topic ?? "Por clasificar"}</span>
                    <span><b>Territorio:</b> {document.municipality ?? document.department ?? document.geographic_scope ?? "Colombia"}</span>
                  </div>
                  {(document.official_url || document.pdf_url) ? (
                    <div className="card-actions">
                      <a className="button-link" href={document.pdf_url ?? document.official_url ?? "#"} target="_blank" rel="noreferrer">Ver documento oficial ↗</a>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="bottom-grid">
          <div className="panel">
            <div className="panel-header"><div><h2>Temas bajo vigilancia</h2><p>Clasificación orientada a gestión ambiental empresarial.</p></div></div>
            <div className="topic-list">
              <Topic name="Agua, saneamiento y vertimientos" />
              <Topic name="Residuos y economía circular" />
              <Topic name="Cambio climático y energía" />
              <Topic name="Biodiversidad y áreas protegidas" />
              <Topic name="Aire, ruido y emisiones" />
              <Topic name="Licenciamiento y permisos" />
              <Topic name="Ordenamiento territorial" />
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><div><h2>Inteligencia empresarial</h2><p>Alertas de gremios y portales de sostenibilidad.</p></div><Link className="text-link" href="/news">Ver alertas →</Link></div>
            <div className="source-tags">
              <span>ANDI</span><span>FENALCO</span><span>ANDESCO</span><span>CAMACOL</span>
              <span>CECODES</span><span>CCCS</span><span>ACP</span><span>Naturgas</span>
              <span>SER Colombia</span><span>Acoplásticos</span>
            </div>
            <div className="why-box"><b>Objetivo:</b> identificar cambios con impacto en cumplimiento, operación, costos, riesgo climático, reputación, ESG y cadena de suministro.</div>
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({ value, label, description, href }: { value: number; label: string; description: string; href: string }) {
  return (
    <Link className="metric-card metric-link" href={href}>
      <div className="metric-number">{value}</div>
      <strong>{label}</strong>
      <span>{description}</span>
      <small>Explorar →</small>
    </Link>
  );
}

function HealthCard({ value, label, tone }: { value: number; label: string; tone: "neutral" | "good" | "warn" }) {
  return <div className={`health-card health-${tone}`}><strong>{value}</strong><span>{label}</span></div>;
}

function Topic({ name }: { name: string }) {
  return <Link className="topic" href={`/documents?topic=${encodeURIComponent(name)}`}><span>{name}</span><span>→</span></Link>;
}

function formatStatus(status: string | null) {
  if (!status) return "Pendiente";
  const labels: Record<string, string> = { online: "Operativa", blocked: "Bloqueada", error: "Error", http_502: "HTTP 502", rate_limited: "Limitada", pending: "Pendiente" };
  return labels[status] ?? status.replaceAll("_", " ");
}

function formatDate(value: string | null) {
  if (!value) return "Fecha no disponible";
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" }).format(date);
}
