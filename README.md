# Radar Ambiental Colombia V0.4.0

Aplicación de escritorio Electron orientada a **equipos ambientales y de sostenibilidad de organizaciones en Colombia**. Consolida documentación ambiental oficial y, desde V0.4, incorpora vigilancia de noticias, alertas regulatorias, publicaciones gremiales, estudios sectoriales y contenidos de sostenibilidad empresarial.

## Qué agrega V0.4

- Nuevo módulo **Inteligencia sectorial y sostenibilidad**.
- Rastreo de gremios empresariales y sectoriales colombianos, además de portales ambientales y de sostenibilidad.
- Separación estricta entre **documentos oficiales** y **noticias/alertas secundarias**: una publicación gremial que menciona una resolución no se guarda como si fuera la resolución oficial.
- Clasificación empresarial por sector, tema ambiental, tipo de publicación e impacto potencial para la organización.
- Puntaje de relevancia y nivel de alerta: `Alta`, `Media` o `Informativa`.
- Explicación breve de **por qué importa** al equipo ambiental/sostenibilidad.
- Impactos posibles: cumplimiento normativo, operación ambiental, costos/eficiencia, riesgo climático/continuidad, estrategia/competitividad, reputación/ESG y cadena de suministro.
- Consolidación de noticias repetidas: el mismo titular/fecha no genera múltiples fichas; se pueden asociar varias fuentes al mismo registro.
- Dashboard ampliado con inteligencia sectorial, alertas regulatorias y alertas de alta prioridad.
- Filtros nuevos por sector y nivel de alerta.
- Novedades documentales continúa separado de las noticias para no mezclar vigilancia jurídica con monitoreo sectorial.

## Fuentes sectoriales y de sostenibilidad incluidas

El catálogo `sources_registry.csv` incorpora, entre otras:

- ANDI.
- FENALCO y su monitoreo jurídico/regulatorio.
- CAMACOL y contenidos de sostenibilidad.
- ANDESCO.
- Asociación Colombiana del Petróleo y Gas (ACP).
- Naturgas.
- SER Colombia.
- Asociación Colombiana de Minería (ACM).
- Acoplásticos.
- Fedepalma.
- Asocaña.
- ASOCARS.
- CECODES.
- Consejo Colombiano de Construcción Sostenible (CCCS).
- Sustenomics.
- Comunicación Sostenible.
- El Espectador - Ambiente.
- Mongabay Latam - Colombia.

Estas fuentes se suman a MinAmbiente, ANLA, SUIN, Corte Constitucional, Consejo de Estado, DNP, IDEAM, autoridades ambientales regionales y las demás fuentes documentales incorporadas en versiones anteriores.

## Modelo de información

### Base documental oficial

Incluye, según disponibilidad de cada fuente:

- Leyes, decretos, resoluciones, acuerdos, circulares, autos y conceptos.
- Jurisprudencia.
- Políticas públicas y documentos CONPES.
- PND y planes de desarrollo.
- PGAR, POMCA, PORH, PSMV, PUEAA y PGIRS.
- POT, PBOT y EOT.
- Planes climáticos y otros instrumentos estratégicos.
- Protocolos, guías, manuales, metodologías, lineamientos y documentos técnicos.

### Inteligencia sectorial y sostenibilidad

Tipos previstos:

- Alerta regulatoria.
- Alerta sectorial.
- Comunicado gremial.
- Estudio / informe sectorial.
- Informe de sostenibilidad.
- Noticia sectorial.

Metadatos adicionales:

- fuente y categoría de fuente;
- sector;
- fecha de publicación;
- tema principal y subtemas;
- impacto empresarial;
- nivel de alerta;
- puntaje de relevancia;
- explicación de relevancia;
- enlace a la publicación original.

## Antiduplicados

El Radar combina identidad documental, URL canónica y hash de contenido. Para noticias y alertas también genera una identidad basada en el titular normalizado y la fecha. Si una publicación ya existe:

- si no cambió, no la vuelve a insertar;
- si cambió materialmente, actualiza el registro;
- si otra fuente publica la misma noticia, conserva una sola ficha y asocia la fuente adicional cuando es posible.

## Instalación en Windows

En PowerShell, dentro de la carpeta del proyecto:

```powershell
npm install
npm start
```

V0.4 mantiene `@electron/rebuild` como `postinstall` para reconstruir `better-sqlite3` contra la ABI de Electron.

Si npm bloquea scripts de instalación:

```powershell
npm approve-scripts better-sqlite3 electron electron-winstaller
npm install
npm start
```

Si vuelve a aparecer un error de `NODE_MODULE_VERSION`:

```powershell
npm run rebuild
npm start
```

No se recomienda ejecutar `npm audit fix --force` como respuesta al error de ABI, porque es un problema distinto y puede introducir cambios incompatibles.

## Actualización automática

Al iniciar, el Radar revisa las fuentes activas. La interfaz registra por fuente documentos encontrados, nuevos, actualizados, sin cambios y errores. Los portales que requieren JavaScript, CAPTCHA, APIs privadas, navegación compleja o autenticación pueden necesitar un conector especializado en versiones posteriores.

## Criterio de uso empresarial

El módulo sectorial busca reducir ruido. Una nota se prioriza cuando tiene relación con ambiente/sostenibilidad y además puede afectar a una organización en Colombia por cumplimiento, operación, costos, riesgo, estrategia, ESG o cadena de suministro.

La clasificación es una ayuda de vigilancia y **no sustituye la validación jurídica, técnica ni la lectura de la fuente primaria**. Para obligaciones legales, el Radar debe remitir al documento oficial correspondiente.

## Próximos pasos recomendados

- Conectores especializados para las fuentes con mayor valor y páginas dinámicas.
- Relacionar automáticamente una alerta gremial con la norma oficial a la que hace referencia.
- Perfiles por sector económico y matriz de materialidad de la organización.
- Alertas configurables por tema, autoridad, territorio, sector e impacto.
- Resúmenes y análisis asistidos por IA con trazabilidad a las fuentes.
- Migración progresiva a arquitectura centralizada GitHub + PostgreSQL + web/desktop.
