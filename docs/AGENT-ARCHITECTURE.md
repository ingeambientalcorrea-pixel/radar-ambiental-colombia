# Arquitectura de agentes — Radar Ambiental Colombia

## Objetivo

Operar Radar Ambiental Colombia como una plataforma web estable en Vercel, con PostgreSQL/Neon como base central y procesos automatizados para descubrir, normalizar, clasificar, deduplicar y actualizar información ambiental y de sostenibilidad de Colombia.

## Principio operativo

La aplicación web nunca depende de que un scraper esté funcionando en el momento de la visita. Vercel consulta únicamente la base central. Los recolectores trabajan de forma desacoplada y registran sus resultados en Neon.

## Agentes

### 1. Orquestador
- Decide qué fuentes revisar.
- Gestiona reintentos, prioridades y ventanas de actualización.
- Registra cada ejecución en `crawl_runs`.

### 2. Normativa
Fuentes objetivo: MinAmbiente, ANLA, SUIN, CAR, autoridades territoriales.

Documentos: leyes, decretos, resoluciones, acuerdos, circulares, autos, conceptos y proyectos regulatorios.

### 3. Jurisprudencia
Fuentes objetivo: Corte Constitucional, Consejo de Estado y repositorios judiciales.

Metadatos: número, fecha, corporación, sala, ponente, problema jurídico, decisión, normas citadas y URL oficial.

### 4. Planeación y política
Documentos: políticas públicas, CONPES, PND, planes de desarrollo, PGAR, POMCA, PORH, POT/PBOT/EOT, PGIRS, PSMV, PUEAA, planes climáticos y planes de manejo.

### 5. Técnico
Documentos: guías, protocolos, manuales, metodologías, lineamientos, estándares y publicaciones técnicas.

### 6. Inteligencia empresarial
Fuentes objetivo: ANDI, FENALCO, ANDESCO, CAMACOL, CECODES, CCCS, ACP, Naturgas y otros gremios.

Clasificación de impacto: cumplimiento, operación, costos, agua, residuos, emisiones, energía, economía circular, clima, biodiversidad, ESG, cadena de suministro y reputación.

### 7. Normalización
Convierte hallazgos heterogéneos a un esquema común de documentos y noticias.

### 8. Antiduplicados
Combina `document_key`, URL canónica, hash de contenido, autoridad, número y año. Una norma puede tener múltiples fuentes sin duplicarse.

### 9. Enriquecimiento
Completa tema principal, subtemas, palabras clave, resumen, territorio, sector e impacto empresarial. Debe diferenciar datos extraídos de inferencias.

### 10. Relaciones jurídicas
Registra relaciones como MODIFICA, DEROGA, REGLAMENTA, SUSTITUYE, COMPLEMENTA, DESARROLLA, CITA e INTERPRETA.

### 11. Verificación de enlaces
Comprueba enlaces oficiales y PDFs antes de exponerlos al usuario y conserva la última URL válida.

### 12. Backend
Next.js server-side + Neon. Expone consultas de dashboard, documentos, fuentes, búsqueda y filtros.

### 13. Frontend
Dashboard, base documental, buscador, novedades, jurisprudencia, políticas/planes, documentos técnicos, inteligencia sectorial y fuentes.

### 14. QA/DevOps
Valida build, tipos, lint y despliegue. Los cambios entran por rama/PR antes de llegar a `main`.

## Orden de implementación

1. Dashboard estable en Vercel conectado a Neon.
2. Vista real de fuentes.
3. Base documental y búsqueda.
4. Recolectores piloto de cinco fuentes de alta calidad.
5. Deduplicación y enriquecimiento.
6. Actualización bajo demanda.
7. Expansión progresiva de cobertura.
8. Conectores especializados para portales difíciles.
9. IA opcional sobre datos ya normalizados.

## Criterio de éxito

La plataforma debe seguir visible y utilizable aunque un portal externo falle. Los errores de una fuente no deben tumbar Vercel ni bloquear otras fuentes.
