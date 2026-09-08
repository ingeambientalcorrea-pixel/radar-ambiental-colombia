import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { getNews, getNewsFilterOptions, type CatalogFilters } from "@/lib/catalog";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewsPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const filters: CatalogFilters = {
    q: first(raw.q),
    topic: first(raw.topic),
    year: first(raw.year),
  };

  const [items, options] = await Promise.all([
    getNews(filters),
    getNewsFilterOptions(),
  ]);

  return (
    <div className="app-shell">
      <Sidebar active="news" />
      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">INTELIGENCIA SECTORIAL</div>
            <h1>Noticias, alertas regulatorias y sostenibilidad empresarial</h1>
            <p>Seguimiento a gremios, portales ambientales y referentes de sostenibilidad con foco en impacto para organizaciones en Colombia.</p>
          </div>
          <div className="update-box"><span>Resultados</span><strong>{items.length}</strong></div>
        </header>

        <section className="panel">
          <form className="advanced-filters compact-filters" method="get">
            <input name="q" defaultValue={filters.q || ""} placeholder="Buscar noticia, gremio, sector o tema..." />
            <select name="topic" defaultValue={filters.topic || ""}>
              <option value="">Todos los temas</option>
              {options.topics.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select name="year" defaultValue={filters.year || ""}>
              <option value="">Todos los años</option>
              {options.years.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <div className="filter-actions">
              <button className="primary-button" type="submit">Buscar</button>
              <a className="secondary-link" href="/news">Limpiar</a>
            </div>
          </form>
        </section>

        <section className="panel">
          {items.length === 0 ? (
            <div className="empty-state">
              <strong>Aún no hay alertas sectoriales almacenadas.</strong>
              <p>Actualiza el Radar para consultar ANDI, FENALCO, ANDESCO, CAMACOL, CECODES, CCCS, ACP, Naturgas y otras fuentes configuradas.</p>
            </div>
          ) : (
            <div className="catalog-list">
              {items.map((item) => (
                <article className="catalog-card" key={`${item.id}-${item.source_name || "source"}`}>
                  <div className="catalog-head">
                    <div>
                      <span className={`priority ${item.alert_level === "alta" ? "priority-high" : ""}`}>{labelAlert(item.alert_level)}</span>
                      {item.source_name ? <span className="soft-pill">{item.source_name}</span> : null}
                    </div>
                    <span className="date">{formatDate(item.published_at || item.first_seen_at)}</span>
                  </div>

                  <h2><Link className="title-link" href={`/news/${item.id}`}>{item.title}</Link></h2>

                  <div className="metadata metadata-grid">
                    <span><b>Tema:</b> {item.main_topic || "Gestión ambiental"}</span>
                    <span><b>Sector:</b> {item.sector || "Multisectorial"}</span>
                    <span><b>Impacto:</b> {item.business_impact || "Operación ambiental"}</span>
                    <span><b>Relevancia:</b> {item.relevance_score ?? 0}/100</span>
                  </div>

                  <p>{item.summary || item.description || item.relevance_reason || "Publicación relevante para equipos ambientales y de sostenibilidad."}</p>
                  {item.relevance_reason ? <div className="why-box"><b>¿Por qué importa?</b> {item.relevance_reason}</div> : null}

                  <div className="card-actions">
                    <Link className="button-link" href={`/news/${item.id}`}>Ver análisis</Link>
                    {item.canonical_url ? (
                      <a className="button-link secondary" href={item.canonical_url} target="_blank" rel="noreferrer">Abrir publicación ↗</a>
                    ) : null}
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

function labelAlert(value: string | null) {
  if (!value) return "Prioridad media";
  return value === "alta" ? "Prioridad alta" : value === "baja" ? "Prioridad baja" : "Prioridad media";
}

function formatDate(value: string | null) {
  if (!value) return "Fecha no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" }).format(date);
}
