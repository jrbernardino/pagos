# HANDOFF — Hub de pagos (para Claude Code)

## Contexto
PWA personal para el iPhone de Jonathan: muestra los próximos pagos, cuánto apartar cada viernes (semanas de viernes a jueves) y el saldo proyectado. Lee y escribe en un Google Sheet personal a través de un Web App de Apps Script. Es el mismo patrón que su app Despensa.

**Estado actual:**
- Backend **ya desplegado**. Los pasos 1–4 del README están hechos: `setup` corrido y Web App publicado.
- Web App: `https://script.google.com/macros/s/AKfycbwP3mtPN-LEpJLIkaJgOxllG1ISbNsKS_zTzZQ0DgGgZolN4cw3C7mvtHKCeWc0c4X6/exec`
- `web/index.html` ya trae esa URL en `API_URL`.
- El **token** lo tiene Jonathan. Pídeselo para las pruebas; no lo escribas en ningún archivo del repo.

Lee `CLAUDE.md` (convenciones) y `README.md` (cómo funciona) antes de empezar.

## Lo que falta (en orden)

### 1. Probar el backend desde la terminal
Apps Script responde con un redirect 302, así que usa `-L`:
```bash
curl -sL "<URL>?action=data&token=<TOKEN>" | python3 -m json.tool | head -60
```
Esperado: `{"ok": true, "data": {"hoy": ..., "saldo": 6600, "semanas": [...]}}`.
- `Token inválido` → el token no coincide con `Hub_Config` en el Sheet.
- Llega HTML en vez de JSON → el despliegue no tiene acceso *Cualquier usuario*, o se desplegó como otro usuario.

Prueba también un POST y deshazlo (`Content-Type: text/plain` evita el preflight de CORS):
```bash
curl -sL -H 'Content-Type: text/plain;charset=utf-8' \
  -d '{"token":"<TOKEN>","action":"pagar","id":"jaula_2026-10-23","monto":1000}' "<URL>"
curl -sL -H 'Content-Type: text/plain;charset=utf-8' \
  -d '{"token":"<TOKEN>","action":"deshacer","id":"jaula_2026-10-23"}' "<URL>"
```
Confirma que después del `deshacer` el saldo regresa a lo que estaba.

### 2. Repo y GitHub Pages
- `git init`. Agrega un `.gitignore` con `.DS_Store`, `*.zip` y `.env*`.
- Antes del commit corre `grep -r "<TOKEN>" .`: no debe aparecer en ningún lado.
- Crea el repo `pagos` con `gh repo create pagos --public --source=. --push`. Pages gratis requiere repo público. El código y la URL quedan visibles, pero sin el token la API no responde.
- Pages debe servir **la carpeta `web/`**. Usa GitHub Actions (workflow `actions/upload-pages-artifact` con `path: web` + `actions/deploy-pages`) o mueve el contenido de `web/` a `docs/` y publica desde `main /docs`. La segunda es más simple; si la eliges, actualiza README y CLAUDE.md.
- Verifica que `https://<usuario>.github.io/pagos/` cargue y que `manifest.json`, `sw.js` y los íconos respondan 200.

### 3. Prueba en navegador (opcional, recomendable)
Abre la URL de Pages, pega el token y confirma que carga la semana del 23 oct con "Apartar $6,320" y saldo $6,600, salvo que el Sheet ya se haya editado.

### 4. Cierre
- Actualiza `BITACORA.md` con lo hecho y `TAREAS.md`.
- Entrégale a Jonathan la URL de Pages para abrirla en Safari del iPhone → Compartir → Agregar a pantalla de inicio.

## Pendientes de Jonathan en el Sheet (no los hace Claude Code)
En la hoja `Hub_Pagos`:
- `nomina`: poner el neto real semanal (default 8,400).
- `tania`: monto y días reales de su transferencia (default 2,488.13 los días 15 y 30).
- Agregar el bautizo: `bautizo | Bautizo | 6000 | personal | mensual | 12 | 2026-12-12 | 2026-12-12 | ✓`. La fecha está por confirmar; es el fin de semana del 12–13 dic.

## No hacer
- No escribir el token en código, commits, README ni logs que se suban.
- No cambiar la lógica de `Motor.gs` sin volver a correr la verificación: los totales semanales sin despensa deben cuadrar con los recordatorios del iPhone (23 oct $5,320 · 6 nov $12,470 · 11 dic $14,662.33 · 8 ene $13,942.33).
- Si cambias `Code.gs` o `Motor.gs`, Jonathan los pega a mano en Apps Script y hace **Gestionar implementaciones → Versión nueva**, para no cambiar la URL. Avísale.
