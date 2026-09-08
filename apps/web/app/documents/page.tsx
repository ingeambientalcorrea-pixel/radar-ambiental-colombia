import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { getDocumentFilterOptions, getDocuments, type CatalogFilters } from "@/lib/catalog";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const filters: CatalogFilters = {
    q: first(raw.q),
    type: first(raw.type),
    topic: first(raw.topic),
    authority: first(raw.authority),
    territory: first(raw.territory),
    department: first(raw.department),
    year: first(raw.year),
  };

  const [documents, options] = await Promise.all([
    getDocuments(filters),
    getDocumentFilterOptions(),
  ]);

  return (
    <div className="app-shell">
      <Sidebar active="documents" />
      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">BASE DOCUMENTAL</div>
            <h1>Normativa, jurisprudencia, planes y documentos técnicos</h1>
            <p>Consulta consolidada de documentos ambientales, de sostenibilidad y saneamiento en Colombia.</p>
          </div>
          <div className="update-box">
            <span>Resultados</span>
            <strong>{documents.length}</strong>
          </div>
        </header>

        <section className="panel">
          <form className="advanced-filters" method="get">
            <input name="q" defaultValue={filters.q || ""} placeholder="Buscar por título, tema, autoridad, palabra clave..." />
            <select name="type" defaultValue={filters.type || ""}>
              <option value="">Todos los tipos</option>
              {options.types.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select name="topic" defaultValue={filters.topic || ""}>
              <option value="">Todos los temas</option>
              {options.topics.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select name="authority" defaultValue={filters.authority || ""}>
              <option value="">Todas las autoridades</option>
              {options.authorities.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select name="department" defaultValue={filters.department || ""}>
              <option value="">Todos los departamentos</option>
              {options.departments.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select name="territory" defaultValue={filters.territory || ""}>
              <option value="">Todo el ámbito geográfico</option>
              {options.territories.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select name="year" defaultValue={filters.year || ""}>
              <option value="">Todos los años</option>
              {options.years.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <div className="filter-actions">
              <button className="primary-button" type="submit">Buscar</button>
              <a className="secondary-link" href="/documents">Limpiar filtros</a>
            </div>
          </form>
        </section>

        <section className="panel">
          {documents.length === 0 ? (
            <div className="empty-state">
              <strong>No hay documentos que coincidan con los filtros.</strong>
              <p>Usa “Actualizar Radar” desde el Dashboard para incorporar nuevas publicaciones de las fuentes operativas.</p>
            </div>
          ) : (
            <div className="catalog-list">
              {documents.map((doc) => (
                <article className="catalog-card" key={doc.id}>
                  <div className="catalog-head">
                    <div>
                      <span className="document-type">{doc.document_type || doc.document_family || "Documento"}</span>
                      {doc.document_family ? <span className="soft-pill">{doc.document_family}</span> : null}
                    </div>
                    <span className="date">{formatDate(doc.date_published || doc.date_issued || doc.first_seen_at)}</span>
                  </div>

                  <h2><Link className="title-link" href={`/documents/${doc.id}`}>{doc.title}</Link></h2>

                  <div className="metadata metadata-grid">
                    <span><b>Autoridad:</b> {doc.authority || "No identificada"}</span>
                    <span><b>Tema:</b> {doc.main_topic || "Por clasificar"}</span>
                    <span><b>Territorio:</b> {doc.municipality || doc.department || doc.geographic_scope || "Colombia"}</span>
                    <span><b>Número:</b> {doc.document_number || "—"}</span>
                    <span><b>Año:</b> {doc.year || "—"}</span>
                    <span><b>Estado:</b> {doc.legal_status || "Sin determinar"}</span>
                  </div>

                  <p>{doc.summary || doc.description || "Documento detectado por Radar Ambiental Colombia."}</p>

                  <div className="card-actions">
                    <Link className="button-link" href={`/documents/${doc.id}`}>Ver ficha completa</Link>
                    {doc.pdf_url ? <a className="button-link secondary" href={doc.pdf_url} target="_blank" rel="noreferrer">Descargar / ver PDF ↗</a> : null}
                    {doc.official_url ? <a className="button-link secondary" href={doc.official_url} target="_blank" rel="noreferrer">Fuente oficial ↗</a> : null}
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
