# BITÁCORA — Hub de pagos

## 2026-10-18
- Primera versión: backend Apps Script + PWA.
- Datos iniciales cargados con los pagos vigentes (renta, luz bimestral, gas y agua, Izzi, jaula, despensa, iPhone, teléfono, vuelos ×2, préstamo quincenal, préstamo de 3 mensualidades) y saldo de $6,600.
- Motor validado en Node: los totales semanales (sin despensa) cuadran con los 14 recordatorios de viernes creados en el iPhone (23 oct – 29 ene).
- Pendiente de confirmar: neto de nómina (default 8,400) y días/monto de la transferencia de Tania (default 2,488.13 los días 15 y 30).

## 2026-10-19
- Backend desplegado por Jonathan (setup + Web App). URL puesta en web/index.html.
- HANDOFF.md para que Claude Code pruebe la API, cree el repo y publique en GitHub Pages.
- API probada desde terminal: `data` responde (saldo 6,600; semana 23 oct apartar 6,320). Ciclo `pagar` → `deshacer` de jaula_2026-10-23 deja el saldo en 6,600 otra vez. Token incorrecto → `Token inválido`.
- Repo `jrbernardino/pagos` (público). GitHub Pages por Actions (`.github/workflows/pages.yml`, publica `web/`). https://jrbernardino.github.io/pagos/ — index, manifest, sw.js e íconos responden 200. Token verificado fuera del repo.
- v2 (front + backend): el hero muestra "En tu banco", y de la semana lun–dom: por pagar, por entrar y saldo al domingo. Botón "+ Gasto" para registrar gastos e ingresos extra (con categorías y fecha); se pueden deshacer desde "Últimos movimientos". La app se refresca sola cada minuto mientras está abierta. `sw.js` → `pagos-v2`.
- Backend v2 (`resumenSemana_` en Motor.gs; acciones `gasto` / `ingreso_extra` en Code.gs) pendiente de pegar en Apps Script y publicar como versión nueva.
- Workflow `apps-script.yml`: despliegue del backend con clasp 2.4.2 desde Actions (push + deploy a la implementación existente + prueba de humo). Falta que Jonathan cargue los secretos.
- Secretos cargados por Jonathan. Workflow Apps Script corrido: clasp push + deploy a la misma URL; prueba de humo OK (backend v2 responde con semanaActual).
- v3 front: rediseño estilo glassy-dashboard (fondo negro/dorado, vidrio, Space Grotesk/Plus Jakarta). App con pestañas (Inicio, Semanas, Proyección, Movimientos) y botón + central. Gráfica interactiva (arrastrar para ver saldo y movimientos de cada día; 14/30/60 días). Semanas como carrusel con swipe. Arreglado: el botón de refrescar giraba con todo y fondo; el toast se asomaba abajo. Backend: historial de 30 movimientos. sw → pagos-v3.
- Recordatorios en la app (Pagos → Recordatorios): ver, crear, editar, pausar y eliminar filas de Hub_Pagos (acciones guardar_pago / borrar_pago). Nueva frecuencia `unica`. POST con `corto: true` regresa {saldo, porPagar, alCierre, mensaje} para el atajo del iPhone.
- Jonathan confirmó nómina neta 8,400 y transferencia de Tania 2,488.13 (15 y 30). Bautizo dado de alta desde la app (única, 12 dic, $6,000).
- "Puedes gastar esta semana" en Inicio (libreParaGastar_: ritmo parejo que no rompe el colchón en 60 días) con hoja que explica el cálculo. GET ?corto=1 y widget de Scriptable (widget/pagos-widget.js).
- Proyección a 120 días (horizonte mínimo en Code.gs) y rangos de 3 y 4 meses en la gráfica. El 'Puedes gastar' ahora considera los 120 días.
