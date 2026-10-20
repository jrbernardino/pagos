# CLAUDE.md — Hub de pagos

PWA personal (GitHub Pages) + backend Apps Script ligado al Sheet de finanzas de Jonathan.

- `apps-script/Motor.gs`: lógica pura (generación de ocurrencias, semanas vie–jue, proyección). Sin SpreadsheetApp, para poder probarla con Node (`vm.runInContext`).
- `apps-script/Code.gs`: hojas Hub_Pagos / Hub_Config / Hub_Registro, API `doGet` / `doPost` con token.
- `web/index.html`: toda la app en un archivo (pestañas Inicio / Semanas / Proyección / Movimientos, estilo glassy-dashboard; fondo `bg.jpg`); `sw.js` cachea solo el cascarón.
- `widget/pagos-widget.js`: widget de Scriptable (iOS); usa `GET ?corto=1`. El token vive en el Llavero del iPhone, nunca en el archivo.
- `.github/workflows/pages.yml`: publica `web/` en GitHub Pages (https://jrbernardino.github.io/pagos/) en cada push a `main`. Si cambias archivos del cascarón, sube `CACHE` en `sw.js`.

- `.github/workflows/apps-script.yml`: en cada push a `main` que toque `apps-script/`, hace `clasp push` y `clasp deploy` sobre la misma implementación (la URL /exec no cambia). Usa los secretos CLASPRC_JSON, SCRIPT_ID y HUB_TOKEN (prueba de humo). Pages y Apps Script se despliegan por separado, así que el front debe tolerar un backend viejo (campos nuevos opcionales).

Convenciones:
- Dos tipos de semana: las tarjetas de "Apartar" van de viernes a jueves (día de pago); el resumen del hero ("Esta semana") va de lunes a domingo.
- Gastos/ingresos extra (`gasto`, `ingreso_extra`) mueven el saldo al registrarse y se guardan en Hub_Registro con ID `<accion>_<uuid8>`; `deshacer` los revierte.
- Frecuencias de Hub_Pagos: mensual, bimestral, semanal, semanal_mes, unica. El catálogo se edita desde la app (guardar_pago / borrar_pago).
- `corto` (POST `corto: true` o GET `?corto=1`) regresa `resumenCorto_`: saldo, porPagar, porEntrar, alCierre, libreSemana, librePorSemana, proximos, mensaje. Lo usan el atajo del Action Button y el widget.
- "Puedes gastar" (`libreParaGastar_` en Motor.gs): ritmo diario parejo máximo que mantiene la proyección ≥ colchón en todo el horizonte; `semana` = ritmo × días hasta el domingo.
- Fechas siempre como texto `YYYY-MM-DD`; zona America/Mexico_City.
- ID de ocurrencia = `<idPago>_<YYYY-MM-DD>`; el registro se indexa por ese ID.
- Gastos de casa se pagan al 100%; el 25% de Tania entra como ingreso quincenal.
- POST con `Content-Type: text/plain` para evitar el preflight de CORS en Apps Script.
