# Hub de pagos

App para la pantalla de inicio del iPhone que muestra los próximos pagos, cuánto apartar cada viernes y el saldo proyectado. Lee y escribe en tu Sheet de finanzas a través de Apps Script (mismo patrón que Despensa).

```
apps-script/   → backend (Code.gs, Motor.gs, appsscript.json)
web/           → la PWA (GitHub Pages)
.github/       → workflow que publica web/ en Pages en cada push a main
```

## 1. Backend en el Sheet

1. Abre **Tracking_Finanzas_2026_2027** en Google Sheets → **Extensiones → Apps Script**.
2. Crea dos archivos y pega el contenido: `Motor.gs` y `Code.gs`.
3. En **Configuración del proyecto** activa *Mostrar el archivo de manifiesto "appsscript.json"* y reemplázalo con el de esta carpeta.
4. Ejecuta `setup` una vez y autoriza. Crea tres hojas:
   - **Hub_Pagos**: la lista de pagos e ingresos. Es lo único que editas a mano.
   - **Hub_Config**: saldo, horizonte (60 días), colchón y token.
   - **Hub_Registro**: bitácora de lo que marcas desde la app.
5. Revisa en **Hub_Pagos** las dos filas de ingreso: el neto de tu nómina y el monto y días de la transferencia de Tania vienen con valores por defecto.
6. **Implementar → Nueva implementación → Aplicación web**. Ejecutar como: *Yo*. Acceso: *Cualquier usuario*. Copia la URL que termina en `/exec`.

Cuando cambies `Code.gs` o `Motor.gs`: **Implementar → Gestionar implementaciones → editar → Versión nueva**. Así la URL no cambia.

## 2. App en GitHub Pages

1. En `web/index.html` pega la URL en `const API_URL = '...'` (o déjala vacía y la app te la pide).
2. Repo `jrbernardino/pagos`. El workflow `.github/workflows/pages.yml` publica la carpeta `web/` en cada push a `main` (**Settings → Pages → Source: GitHub Actions**). URL: https://jrbernardino.github.io/pagos/
3. En el iPhone abre la URL de Pages en Safari → **Compartir → Agregar a pantalla de inicio**.
4. Abre la app **desde el ícono** (no desde Safari, porque guardan datos por separado) y pega el token. Lo ves en el Sheet en **Hub de pagos → Ver token de acceso**.

## Cómo funciona

- **Hub_Pagos**, columnas: ID, Concepto, Monto, Tipo (`casa` / `personal` / `ingreso`), Frecuencia, Días, Inicio, Fin, Activo.
  - `mensual`: días del mes, `12` o `15,30`. Si el día no existe en el mes (30 de febrero), se recorre al último día.
  - `bimestral`: cada 2 meses contando desde *Inicio*.
  - `semanal`: un día de la semana (`VI` = viernes).
  - `semanal_mes`: monto mensual repartido entre los viernes del mes (despensa).
  - *Fin* vacío = sin fin. Para pausar algo, desmarca *Activo*.
- Semanas de **viernes a jueves**. "Apartar" suma los pagos de la semana, incluida la despensa.
- Al marcar **Pagado** se resta del saldo; al marcar **Recibido** se suma. Puedes cambiar el monto antes de confirmar (por ejemplo, si la luz llegó más cara). Cada acción tiene **Deshacer** por unos segundos.
- **Esta semana** (lunes a domingo): lo que te falta pagar, lo que te falta que entre y con cuánto cierras el domingo. Lo vencido sin marcar cuenta como por pagar.
- **+ Gasto**: registra gastos o ingresos que no están en Hub_Pagos (comida, gasolina, etc.). Bajan o suben el saldo al momento y se pueden deshacer tocándolos en *Últimos movimientos*.
- **Saldo**: tócalo para igualarlo con tu banco cuando quieras.
- **Proyección**: conservadora. En un mismo día primero salen los pagos y luego entran los ingresos. Lo vencido cuenta como si saliera hoy, y los ingresos pasados que no confirmaste no se suman.
- Los recordatorios del iPhone son aparte: si cambias un monto aquí, no se actualizan solos.

## Seguridad

La Web App es pública, pero responde solo si el token coincide. Si lo compartes por error: **Hub de pagos → Generar token nuevo** y vuelve a pegarlo en la app.
