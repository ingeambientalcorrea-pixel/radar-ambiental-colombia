# Migración rápida V0.2 → V0.3

1. Cierra Radar Ambiental Colombia.
2. Haz una copia de tu carpeta `C:\radar-ambiental` si quieres conservar el código anterior.
3. Descomprime V0.3 sobre una carpeta limpia, por ejemplo `C:\radar-ambiental-v03`.
4. Abre PowerShell en esa carpeta.
5. Ejecuta `npm install`.
6. Si npm muestra paquetes con scripts pendientes, apruébalos como hiciste en V0.2 y repite `npm install`.
7. Ejecuta `npm start`.

La base de datos de Electron se conserva fuera de la carpeta del código y V0.3 ejecuta migraciones no destructivas al abrir.

Si aparece otra vez un error `NODE_MODULE_VERSION`, ejecuta `npm run rebuild` y luego `npm start`.
