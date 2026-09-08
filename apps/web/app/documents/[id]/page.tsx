import Link from "next/link";
import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { getDocumentDetail } from "@/lib/detail";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function DocumentDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const document = await getDocumentDetail(id);
  if (!document) notFound();

  return (
    <div className="app-shell">
      <Sidebar active="documents" />
      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">FICHA DOCUMENTAL</div>
            <h1>{document.title}</h1>
            <p>
              Metadatos consolidados por Radar Ambiental Colombia. La fuente oficial
              siempre prevalece para verificación jurídica y técnica.
            </p>
          </div>
          <div className="page-actions">
            <Link className="back-link" href="/documents">← Base documental</Link>
          </div>
        </header>

        <section className="panel">
          <div className="catalog-head">
            <div>
              <span className="document-type">{document.documentType || document.documentFamily || "Documento"}</span>
              {document.documentFamily ? <span className="soft-pill">{document.documentFamily}</span> : null}
            </div>
            <span className="date">{formatDate(document.datePublished || document.dateIssued || document.firstSeenAt)}</span>
          </div>

          <div className="metadata metadata-grid detail-metadata">
            <Meta label="Autoridad" value={document.authority} />
            <Meta label="Tema principal" value={document.mainTopic} />
            <Meta label="Número" value={document.documentNumber} />
            <Meta label="Año" value={document.year?.toString() || null} />
            <Meta label="Fecha de expedición" value={formatDate(document.dateIssued, true)} />
            <Meta label="Fecha de publicación" value={formatDate(document.datePublished, true)} />
            <Meta label="Ámbito" value={document.geographicScope} />
            <Meta label="Departamento" value={document.department} />
            <Meta label="Municipio" value={document.municipality} />
            <Meta label="Estado jurídico" value={document.legalStatus} />
            <Meta label="Alcance jurídico" value={document.legalScope} />
            <Meta label="Palabras clave" value={document.keywords} />
          </div>
        </section>

        <section className="bottom-grid">
          <div className="panel">
            <h2>¿De qué trata?</h2>
            <p className="detail-copy">
              {document.summary || document.description || "El Radar todavía no dispone de un resumen ampliado para este documento."}
            </p>
            {document.description && document.summary && document.description !== document.summary ? (
              <div className="why-box"><b>Descripción:</b> {document.description}</div>
            ) : null}
            {document.subtopics ? <div className="why-box"><b>Subtemas:</b> {document.subtopics}</div> : null}
          </div>

          <div className="panel">
            <h2>Documento oficial</h2>
            <p className="muted">Usa estos enlaces para verificar el contenido en la entidad que lo publica.</p>
            <div className="detail-actions">
              {document.pdfUrl ? <a className="button-link" href={document.pdfUrl} target="_blank" rel="noreferrer">Ver / descargar PDF ↗</a> : null}
              {document.officialUrl ? <a className="button-link secondary" href={document.officialUrl} target="_blank" rel="noreferrer">Abrir fuente oficial ↗</a> : null}
            </div>
            <div className="why-box">
              <b>Detectado:</b> {formatDateTime(document.firstSeenAt)}<br />
              <b>Última verificación:</b> {formatDateTime(document.lastSeenAt)}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Fuentes asociadas</h2>
              <p>Un mismo documento puede ser detectado en más de un repositorio.</p>
            </div>
          </div>
          {document.sources.length === 0 ? (
            <div className="empty-state"><strong>No hay fuentes asociadas registradas.</strong></div>
          ) : (
            <div className="issue-list">
              {document.sources.map((source, index) => (
                <article className="source-row" key={`${source.name}-${index}`}>
                  <div><strong>{source.name}</strong></div>
                  <span className="status-pill status-online">Registrada</span>
                  {source.pdfUrl || source.url ? (
                    <a href={source.pdfUrl || source.url || "#"} target="_blank" rel="noreferrer">Abrir ↗</a>
                  ) : <span className="muted">Sin enlace</span>}
                </article>
              ))}
            </div>
          )}
        </section>

        {document.changes.length > 0 ? (
          <section className="panel">
            <div className="panel-header">
              <div><h2>Historial de cambios</h2><p>Cambios materiales detectados por el Radar.</p></div>
            </div>
            <div className="issue-list">
              {document.changes.map((change, index) => (
                <article className="source-row" key={`${change.detectedAt}-${index}`}>
                  <div><strong>{change.changeType || "Cambio detectado"}</strong><span>{change.description || "Sin descripción"}</span></div>
                  <span className="date">{formatDateTime(change.detectedAt)}</span>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string | null }) {
  return <span><b>{label}:</b> {value || "—"}</span>;
}

function formatDate(value: string | null, emptyAsNull = false) {
  if (!value) return emptyAsNull ? null : "Fecha no disponible";
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) return "No disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(date);
}
