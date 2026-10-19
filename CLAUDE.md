# CLAUDE.md — Hub de pagos

PWA personal (GitHub Pages) + backend Apps Script ligado al Sheet de finanzas de Jonathan.

- `apps-script/Motor.gs`: lógica pura (generación de ocurrencias, semanas vie–jue, proyección). Sin SpreadsheetApp, para poder probarla con Node (`vm.runInContext`).
- `apps-script/Code.gs`: hojas Hub_Pagos / Hub_Config / Hub_Registro, API `doGet` / `doPost` con token.
- `web/index.html`: toda la app en un archivo; `sw.js` cachea solo el cascarón.
- `.github/workflows/pages.yml`: publica `web/` en GitHub Pages (https://jrbernardino.github.io/pagos/) en cada push a `main`. Si cambias archivos del cascarón, sube `CACHE` en `sw.js`.

Convenciones:
- Fechas siempre como texto `YYYY-MM-DD`; zona America/Mexico_City.
- ID de ocurrencia = `<idPago>_<YYYY-MM-DD>`; el registro se indexa por ese ID.
- Gastos de casa se pagan al 100%; el 25% de Tania entra como ingreso quincenal.
- POST con `Content-Type: text/plain` para evitar el preflight de CORS en Apps Script.
