import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getNewsDetail } from "@/lib/detail";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function NewsDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const item = await getNewsDetail(id);
  if (!item) notFound();

  return (
    <div className="app-shell">
      <Sidebar active="news" />
      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">FICHA DE INTELIGENCIA SECTORIAL</div>
            <h1>{item.title}</h1>
            <p>
              Lectura orientada a equipos ambientales y de sostenibilidad. Consulta la
              publicación original para validar el contexto completo.
            </p>
          </div>
          <div className="page-actions">
            <Link className="back-link" href="/news">← Inteligencia sectorial</Link>
          </div>
        </header>

        <section className="panel">
          <div className="catalog-head">
            <div>
              <span className={`priority ${item.alertLevel === "alta" ? "priority-high" : ""}`}>
                {labelAlert(item.alertLevel)}
              </span>
              {item.contentKind ? <span className="soft-pill">{item.contentKind}</span> : null}
            </div>
            <span className="date">{formatDate(item.publishedAt || item.firstSeenAt)}</span>
          </div>

          <div className="metadata metadata-grid detail-metadata">
            <Meta label="Tema" value={item.mainTopic} />
            <Meta label="Subtemas" value={item.subtopics} />
            <Meta label="Sector" value={item.sector} />
            <Meta label="Categoría de fuente" value={item.sourceCategory} />
            <Meta label="Impacto empresarial" value={item.businessImpact} />
            <Meta label="Relevancia" value={item.relevanceScore === null ? null : `${item.relevanceScore}/100`} />
            <Meta label="Fecha de publicación" value={formatDate(item.publishedAt, true)} />
            <Meta label="Detectado por el Radar" value={formatDateTime(item.firstSeenAt)} />
          </div>
        </section>

        <section className="bottom-grid">
          <div className="panel">
            <h2>Resumen</h2>
            <p className="detail-copy">
              {item.summary || item.description || "El Radar todavía no dispone de un resumen ampliado para esta publicación."}
            </p>
            {item.relevanceReason ? (
              <div className="why-box"><b>¿Por qué importa?</b> {item.relevanceReason}</div>
            ) : null}
          </div>

          <div className="panel">
            <h2>Impacto para la organización</h2>
            <div className="why-box">
              <b>Impacto identificado:</b> {item.businessImpact || "Operación ambiental"}<br />
              <b>Nivel:</b> {labelAlert(item.alertLevel)}<br />
              <b>Tema:</b> {item.mainTopic || "Gestión ambiental"}
            </div>
            {item.canonicalUrl ? (
              <div className="detail-actions">
                <a className="button-link" href={item.canonicalUrl} target="_blank" rel="noreferrer">Abrir publicación original ↗</a>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div><h2>Fuentes asociadas</h2><p>Portales donde se detectó o vinculó esta publicación.</p></div>
          </div>
          {item.sources.length === 0 ? (
            <div className="empty-state"><strong>No hay fuentes asociadas registradas.</strong></div>
          ) : (
            <div className="issue-list">
              {item.sources.map((source, index) => (
                <article className="source-row" key={`${source.name}-${index}`}>
                  <div><strong>{source.name}</strong></div>
                  <span className="status-pill status-online">Registrada</span>
                  {source.url ? <a href={source.url} target="_blank" rel="noreferrer">Abrir ↗</a> : <span className="muted">Sin enlace</span>}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string | null }) {
  return <span><b>{label}:</b> {value || "—"}</span>;
}

function labelAlert(value: string | null) {
  if (!value) return "Prioridad media";
  return value === "alta" ? "Prioridad alta" : value === "baja" ? "Prioridad baja" : "Prioridad media";
}

function formatDate(value: string | null, emptyAsNull = false) {
  if (!value) return emptyAsNull ? null : "Fecha no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) return "No disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(date);
}
