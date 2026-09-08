import Link from "next/link";

export default function Sidebar({ active }: { active: "dashboard" | "documents" | "news" | "sources" }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">🌎</div>
        <div>
          <strong>RADAR AMBIENTAL</strong>
          <span>COLOMBIA</span>
        </div>
      </div>

      <nav>
        <Link className={`nav-item ${active === "dashboard" ? "active" : ""}`} href="/">▣ Dashboard</Link>
        <Link className={`nav-item ${active === "documents" ? "active" : ""}`} href="/documents">▤ Base documental</Link>
        <Link className={`nav-item ${active === "news" ? "active" : ""}`} href="/news">⚡ Inteligencia sectorial</Link>

        <div className="nav-title">CONSULTA</div>
        <Link className="nav-item" href="/documents?type=Sentencia">⚖ Jurisprudencia</Link>
        <Link className="nav-item" href="/documents?type=Política">📋 Políticas y planes</Link>
        <Link className="nav-item" href="/documents?type=Documento%20ambiental">📐 Documentos técnicos</Link>

        <div className="nav-title">SISTEMA</div>
        <Link className={`nav-item ${active === "sources" ? "active" : ""}`} href="/sources">🔗 Fuentes</Link>
      </nav>
    </aside>
  );
}
