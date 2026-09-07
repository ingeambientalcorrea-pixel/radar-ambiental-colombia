# Cambios de Radar Ambiental Colombia V0.4.0

## Enfoque

V0.4 amplía Radar Ambiental desde vigilancia documental hacia **inteligencia ambiental y de sostenibilidad empresarial**.

## Cambios principales

1. Nuevo módulo `Inteligencia sectorial y sostenibilidad`.
2. Nuevas fuentes gremiales, sectoriales y portales especializados.
3. Nuevas columnas de fuentes: categoría y sector.
4. Nuevos metadatos documentales para noticias/alertas: sector, tipo de contenido, categoría de noticia, impacto empresarial, puntaje de relevancia, razón de relevancia y nivel de alerta.
5. Filtro ambiental/ESG para reducir noticias corporativas irrelevantes.
6. Clasificación especial de monitoreo regulatorio gremial como fuente secundaria.
7. Antiduplicados adaptado a noticias por titular normalizado + fecha y asociación de múltiples fuentes.
8. Dashboard con métricas de inteligencia sectorial y alertas.
9. Filtros por sector y prioridad.
10. Base documental, novedades jurídicas y jurisprudencia permanecen separadas de las noticias.

## Migración desde V0.3

La base SQLite continúa almacenada en `userData` de Electron. Al arrancar V0.4, el esquema incorpora las columnas nuevas mediante migraciones `ALTER TABLE` no destructivas. No es necesario borrar la base anterior.

Se recomienda conservar una copia de seguridad de la base si el Radar ya contiene información de trabajo importante antes de cambiar de versión.
