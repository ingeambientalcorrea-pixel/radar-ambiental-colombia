import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { getRecentUpdates } from "@/lib/updates";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function UpdatesPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const requestedKind = first(raw.kind);
  const q = (first(raw.q) || "").trim().toLowerCase();
  const all = await getRecentUpdates(200);
  const updates = all.filter((item) => {
    if (requestedKind === "document" && item.kind !== "document") return false;
    if (requestedKind === "news" && item.kind !== "news") return false;
    if (q && !`${item.title} ${item.topic || ""} ${item.source || ""}`.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="app-shell">
      <Sidebar active="updates" />
      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">MÓDULO DE NOVEDADES</div>
            <h1>Qué cambió recientemente</h1>
            <p>
              Documentos, decisiones, planes y alertas sectoriales detectados recientemente
              por Radar Ambiental Colombia.
            </p>
          </div>
          <div className="update-box"><span>Resultados</span><strong>{updates.length}</strong></div>
        </header>

        <section className="panel">
          <form className="advanced-filters compact-filters" method="get">
            <input name="q" defaultValue={first(raw.q) || ""} placeholder="Buscar novedad, tema o fuente..." />
            <select name="kind" defaultValue={requestedKind || ""}>
              <option value="">Todo</option>
              <option value="document">Documentos</option>
              <option value="news">Inteligencia sectorial</option>
            </select>
            <div className="filter-actions">
              <button className="primary-button" type="submit">Filtrar</button>
              <Link className="secondary-link" href="/updates">Limpiar</Link>
            </div>
          </form>
        </section>

        <section className="panel">
          {updates.length === 0 ? (
            <div className="empty-state">
              <strong>No hay novedades que coincidan con el filtro.</strong>
            </div>
          ) : (
            <div className="catalog-list">
              {updates.map((item) => (
                <article className="catalog-card" key={`${item.kind}-${item.id}`}>
                  <div className="catalog-head">
                    <div>
                      <span className="document-type">{item.kind === "news" ? "Inteligencia sectorial" : item.category}</span>
                      {item.topic ? <span className="soft-pill">{item.topic}</span> : null}
                    </div>
                    <span className="date">Detectado {formatDateTime(item.detectedAt)}</span>
                  </div>
                  <h2><Link className="title-link" href={item.href}>{item.title}</Link></h2>
                  <div className="metadata metadata-grid">
                    <span><b>Fuente / autoridad:</b> {item.source || "No identificada"}</span>
                    <span><b>Publicación:</b> {formatDate(item.publishedAt)}</span>
                    <span><b>Tipo:</b> {item.category}</span>
                  </div>
                  <div className="card-actions">
                    <Link className="button-link" href={item.href}>Ver ficha →</Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | null) {
  if (!value) return "Fecha no disponible";
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) return "sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(date);
}
