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
