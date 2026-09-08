# Radar Ambiental Colombia V0.6

**Radar Ambiental Colombia** es una plataforma web de inteligencia ambiental, normativa, jurisprudencial, territorial y de sostenibilidad orientada a equipos ambientales y de sostenibilidad de organizaciones en Colombia.

La versión V0.6 cambia el paradigma del proyecto: la aplicación principal vive en **Next.js + Vercel + Neon PostgreSQL**, mientras los recolectores incorporan información pública sin bloquear la experiencia del usuario.

## Aplicación web

La aplicación web está en `apps/web` y ofrece:

- Dashboard conectado a Neon PostgreSQL.
- Base documental consolidada.
- Buscador por texto.
- Filtros por tipo documental, tema, autoridad, territorio, departamento y año.
- Módulo de jurisprudencia.
- Módulo de planes, políticas e instrumentos de planeación.
- Módulo de documentos técnicos.
- Inteligencia sectorial y sostenibilidad.
- Inventario y estado de fuentes.
- Actualización bajo demanda desde la interfaz.
- Enriquecimiento automático de fecha, descripción, resumen, tema, palabras clave y enlaces PDF cuando la fuente los expone.
- Deduplicación por identidad/URL/hash.

## Cobertura documental prevista

### Normativa

- Leyes.
- Decretos.
- Resoluciones.
- Acuerdos.
- Circulares.
- Autos.
- Conceptos.
- Proyectos y agenda regulatoria cuando estén disponibles.

### Jurisprudencia

- Corte Constitucional.
- Consejo de Estado.
- Otros repositorios judiciales que puedan integrarse de forma verificable.

### Planeación y política pública

- Políticas públicas ambientales.
- CONPES.
- Plan Nacional de Desarrollo.
- Planes de desarrollo departamentales y municipales.
- PGAR.
- POMCA.
- PORH.
- PGIRS.
- PSMV.
- PUEAA.
- POT, PBOT y EOT.
- Planes climáticos.
- Planes de manejo y otros instrumentos estratégicos.

### Documentación técnica

- Guías.
- Protocolos.
- Manuales.
- Metodologías.
- Lineamientos.
- Publicaciones técnicas.

### Inteligencia empresarial y sostenibilidad

- ANDI.
- FENALCO.
- ANDESCO.
- CAMACOL.
- CECODES.
- Consejo Colombiano de Construcción Sostenible (CCCS).
- ACP.
- Naturgas.
- SER Colombia.
- Asociación Colombiana de Minería.
- Acoplásticos.
- Fedepalma.
- Asocaña.
- ASOCARS.
- Portales ambientales y de sostenibilidad configurados en `sources_registry.csv`.

## Arquitectura

```text
FUENTES PÚBLICAS
      │
      ▼
RECOLECTORES RADAR
      │
      ├─ extracción
      ├─ clasificación
      ├─ enriquecimiento
      └─ deduplicación
      │
      ▼
NEON POSTGRESQL
      │
      ▼
NEXT.JS / VERCEL
      │
      ├─ Dashboard
      ├─ Base documental
      ├─ Buscador y filtros
      ├─ Inteligencia sectorial
      └─ Fuentes
```

La versión de escritorio Electron permanece en el repositorio como legado/evolución opcional, pero no es el núcleo de producción de V0.6.

## Actualización del Radar

Desde el Dashboard el usuario puede pulsar **Actualizar Radar**. La web obtiene las fuentes operativas y las procesa secuencialmente, mostrando progreso, documentos nuevos, actualizados y errores.

También existe `.github/workflows/update-radar.yml`, que permite:

- ejecución manual desde GitHub Actions;
- actualización programada diaria de producción.

Los sitios bloqueados o incompatibles con extracción HTML genérica se mantienen identificados para desarrollar conectores especializados sin detener al resto del sistema.

## Antiduplicados

Los documentos se consolidan usando:

- `document_key`;
- URL canónica;
- hash de contenido;
- asociación entre documento y múltiples fuentes.

Las noticias usan el mismo principio mediante `news_key`, URL canónica y hash. Una nueva revisión no vuelve a insertar un registro sin cambios.

## Metadatos

La plataforma maneja, según disponibilidad:

- título;
- familia y tipo documental;
- número y año;
- fecha de expedición;
- fecha de publicación;
- autoridad;
- ámbito geográfico;
- departamento y municipio;
- tema principal;
- subtemas y palabras clave;
- descripción y resumen;
- estado/alcance jurídico;
- URL oficial;
- PDF;
- fecha de primera detección y última revisión.

Para inteligencia sectorial añade:

- sector económico;
- impacto empresarial;
- nivel de alerta;
- puntaje y razón de relevancia.

## Desarrollo web

```powershell
cd apps/web
npm install
npm run dev
```

La aplicación requiere:

```text
DATABASE_URL
```

apuntando a Neon PostgreSQL.

## Producción

Vercel está configurado con:

```text
Root Directory: apps/web
Framework: Next.js
```

Los cambios fusionados a `main` se despliegan automáticamente.

## Principio jurídico

Radar Ambiental Colombia es una herramienta de vigilancia, búsqueda y apoyo a la gestión. La clasificación, resumen y priorización son auxiliares. **La fuente primaria oficial sigue siendo la referencia para determinar contenido, vigencia, alcance y obligaciones jurídicas.**

## Próxima evolución

- conectores especializados para SUIN, Corte Constitucional, Consejo de Estado y portales dinámicos;
- relaciones jurídicas `MODIFICA`, `DEROGA`, `REGLAMENTA`, `COMPLEMENTA`, `SUSTITUYE`, `DESARROLLA`, `INTERPRETA` y `CITA`;
- perfil de organización por sector, ubicación y materialidad;
- alertas personalizadas;
- análisis asistido por IA con trazabilidad al documento fuente.
