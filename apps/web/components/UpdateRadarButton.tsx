"use client";

import { useEffect, useState } from "react";

const AUTO_REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;
const LOCAL_AUTO_KEY = "radar-ambiental-last-auto-refresh";

export default function UpdateRadarButton() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, inserted: 0, updated: 0, errors: 0 });
  const [message, setMessage] = useState("Listo para actualizar");

  useEffect(() => {
    let cancelled = false;

    async function maybeAutoUpdate() {
      try {
        const localLast = Number(window.localStorage.getItem(LOCAL_AUTO_KEY) || 0);
        if (localLast && Date.now() - localLast < AUTO_REFRESH_AFTER_MS) return;

        const response = await fetch("/api/health", { cache: "no-store" });
        if (!response.ok) return;
        const health = await response.json();
        const lastCrawl = health.lastCrawlAt ? Date.parse(String(health.lastCrawlAt)) : 0;
        const stale = !lastCrawl || Date.now() - lastCrawl > AUTO_REFRESH_AFTER_MS;

        if (!cancelled && stale) {
          window.localStorage.setItem(LOCAL_AUTO_KEY, String(Date.now()));
          await runUpdate(true);
        }
      } catch {
        // La actualización automática es complementaria: el botón manual sigue disponible.
      }
    }

    void maybeAutoUpdate();
    return () => {
      cancelled = true;
    };
  }, []);

  async function runUpdate(automatic = false) {
    if (running) return;
    setRunning(true);
    setProgress({ done: 0, total: 0, inserted: 0, updated: 0, errors: 0 });
    setMessage(automatic ? "Radar desactualizado: iniciando actualización automática..." : "Preparando fuentes...");

    try {
      const targetsResponse = await fetch("/api/update", { cache: "no-store" });
      const targetsData = await targetsResponse.json();
      const sources = Array.isArray(targetsData.sources) ? targetsData.sources : [];

      if (!targetsResponse.ok || sources.length === 0) {
        throw new Error(targetsData.error || "No hay fuentes disponibles para actualizar");
      }

      setProgress((p) => ({ ...p, total: sources.length }));

      for (let index = 0; index < sources.length; index++) {
        const source = sources[index];
        setMessage(`Consultando ${source.name} (${index + 1}/${sources.length})`);

        try {
          const response = await fetch("/api/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sourceId: source.id }),
          });

          const data = await response.json();
          const result = data.result;

          setProgress((p) => ({
            ...p,
            done: p.done + 1,
            inserted: p.inserted + Number(result?.inserted || 0),
            updated: p.updated + Number(result?.updated || 0),
            errors: p.errors + (response.ok ? 0 : 1),
          }));
        } catch {
          setProgress((p) => ({ ...p, done: p.done + 1, errors: p.errors + 1 }));
        }
      }

      window.localStorage.setItem(LOCAL_AUTO_KEY, String(Date.now()));
      setMessage("Actualización terminada. Recargando resultados...");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible iniciar la actualización");
      setRunning(false);
    }
  }

  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="update-control">
      <button className="primary-button" onClick={() => void runUpdate(false)} disabled={running}>
        {running ? "Actualizando..." : "↻ Actualizar Radar"}
      </button>
      <div className="update-progress" aria-live="polite">
        <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
        <small>{message}</small>
        {running && progress.total > 0 ? (
          <small>
            {progress.done}/{progress.total} · Nuevos {progress.inserted} · Actualizados {progress.updated} · Errores {progress.errors}
          </small>
        ) : null}
      </div>
    </div>
  );
}
