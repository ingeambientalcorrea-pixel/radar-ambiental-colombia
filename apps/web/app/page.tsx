"use client";

import { useMemo, useState } from "react";

const novedades = [
  {
    tipo: "Alerta regulatoria",
    titulo: "Proyecto de regulación ambiental",
    autoridad: "Ministerio de Ambiente",
    fecha: "07/09/2026",
    tema: "Agua y vertimientos",
    territorio: "Nacional",
    prioridad: "Alta",
    descripcion:
      "Documento de demostración para validar el funcionamiento del Radar Ambiental.",
  },
  {
    tipo: "Jurisprudencia",
    titulo: "Nueva decisión judicial ambiental",
    autoridad: "Corte Constitucional",
    fecha: "05/09/2026",
    tema: "Biodiversidad",
    territorio: "Nacional",
    prioridad: "Media",
    descripcion:
      "Registro de demostración. Posteriormente será reemplazado por información obtenida automáticamente.",
  },
  {
    tipo: "Inteligencia sectorial",
    titulo: "Actualización empresarial sobre economía circular",
    autoridad: "Gremio empresarial",
    fecha: "03/09/2026",
    tema: "Economía circular",
    territorio: "Colombia",
    prioridad: "Media",
    descripcion:
      "Ejemplo de noticia relevante para equipos ambientales y de sostenibilidad.",
  },
];

export default function Home() {
  const [busqueda, setBusqueda] = useState("");
  const [tema, setTema] = useState("Todos");

  const filtradas = useMemo(() => {
    return novedades.filter((item) => {
      const coincideTexto =
        item.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
        item.autoridad.toLowerCase().includes(busqueda.toLowerCase()) ||
        item.descripcion.toLowerCase().includes(busqueda.toLowerCase());

      const coincideTema = tema === "Todos" || item.tema === tema;

      return coincideTexto && coincideTema;
    });
  }, [busqueda, tema]);

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
          <a className="nav-item active">▣ Dashboard</a>
          <a className="nav-item">⚡ Novedades</a>
          <a className="nav-item">▤ Base documental</a>
          <a className="nav-item">⌕ Buscador</a>

          <div className="nav-title">INTELIGENCIA</div>

          <a className="nav-item">⚖ Jurisprudencia</a>
          <a className="nav-item">📋 Políticas y planes</a>
          <a className="nav-item">📐 Documentos técnicos</a>
          <a className="nav-item">🏭 Inteligencia sectorial</a>

          <div className="nav-title">CLASIFICACIÓN</div>

          <a className="nav-item">◈ Temas</a>
          <a className="nav-item">🏛 Autoridades</a>
          <a className="nav-item">⌖ Territorio</a>

          <div className="nav-title">SISTEMA</div>

          <a className="nav-item">🔗 Fuentes</a>
          <a className="nav-item">✨ Análisis IA</a>
          <a className="nav-item">⚙ Configuración</a>
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>Dashboard</h1>
            <p>
              Inteligencia ambiental, normativa y de sostenibilidad para
              organizaciones en Colombia
            </p>
          </div>

          <div className="update-box">
            <span>Última actualización</span>
            <strong>Datos de demostración</strong>
          </div>
        </header>

        <section className="cards">
          <MetricCard
            value="0"
            label="Nuevas normas"
            description="Últimos 30 días"
          />
          <MetricCard
            value="0"
            label="Jurisprudencia"
            description="Nuevas decisiones"
          />
          <MetricCard
            value="0"
            label="Planes y políticas"
            description="Documentos detectados"
          />
          <MetricCard
            value="0"
            label="Alertas sectoriales"
            description="Gremios y sostenibilidad"
          />
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Radar de novedades</h2>
              <p>
                Normativa, jurisprudencia, planeación e inteligencia sectorial
              </p>
            </div>

            <div className="badge-demo">Datos de demostración</div>
          </div>

          <div className="filters">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar norma, autoridad, tema o palabra clave..."
            />

            <select value={tema} onChange={(e) => setTema(e.target.value)}>
              <option>Todos</option>
              <option>Agua y vertimientos</option>
              <option>Biodiversidad</option>
              <option>Economía circular</option>
            </select>

            <select>
              <option>Todo el territorio</option>
              <option>Nacional</option>
              <option>Antioquia</option>
              <option>Bogotá D.C.</option>
            </select>
          </div>

          <div className="results">
            {filtradas.map((item, index) => (
              <article className="alert-card" key={index}>
                <div className="alert-top">
                  <div>
                    <span className="document-type">{item.tipo}</span>

                    <span
                      className={
                        item.prioridad === "Alta"
                          ? "priority priority-high"
                          : "priority"
                      }
                    >
                      {item.prioridad}
                    </span>
                  </div>

                  <span className="date">{item.fecha}</span>
                </div>

                <h3>{item.titulo}</h3>

                <div className="metadata">
                  <span>
                    <b>Autoridad:</b> {item.autoridad}
                  </span>
                  <span>
                    <b>Tema:</b> {item.tema}
                  </span>
                  <span>
                    <b>Territorio:</b> {item.territorio}
                  </span>
                </div>

                <p>{item.descripcion}</p>

                <div className="card-actions">
                  <button>Ver detalle</button>
                  <button className="secondary">Documento / fuente ↗</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="bottom-grid">
          <div className="panel">
            <h2>Temas bajo vigilancia</h2>

            <div className="topic-list">
              <Topic name="Agua y vertimientos" />
              <Topic name="Residuos y economía circular" />
              <Topic name="Cambio climático" />
              <Topic name="Biodiversidad" />
              <Topic name="Emisiones atmosféricas" />
              <Topic name="Licenciamiento ambiental" />
            </div>
          </div>

          <div className="panel">
            <h2>Inteligencia sectorial</h2>

            <p className="muted">
              Seguimiento de información ambiental y de sostenibilidad
              publicada por gremios y organizaciones empresariales.
            </p>

            <div className="source-tags">
              <span>ANDI</span>
              <span>FENALCO</span>
              <span>ANDESCO</span>
              <span>CAMACOL</span>
              <span>CECODES</span>
              <span>CCCS</span>
              <span>ACP</span>
              <span>Naturgas</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({
  value,
  label,
  description,
}: {
  value: string;
  label: string;
  description: string;
}) {
  return (
    <div className="metric-card">
      <div className="metric-number">{value}</div>
      <strong>{label}</strong>
      <span>{description}</span>
    </div>
  );
}

function Topic({ name }: { name: string }) {
  return (
    <div className="topic">
      <span>{name}</span>
      <span>→</span>
    </div>
  );
}