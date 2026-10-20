// Widget "Pagos" para Scriptable (iOS).
// Muestra: saldo en banco, cuánto puedes gastar esta semana, cierre al domingo y próximos pagos.
// Tamaños: pequeño, mediano y pantalla de bloqueo (rectangular / en línea).
//
// La primera vez ábrelo dentro de Scriptable: te pide el token (se guarda en el Llavero del iPhone,
// no en este archivo).

const API = 'https://script.google.com/macros/s/AKfycbwP3mtPN-LEpJLIkaJgOxllG1ISbNsKS_zTzZQ0DgGgZolN4cw3C7mvtHKCeWc0c4X6/exec';
const KEY = 'pagos_hub_token';
const CACHE = 'pagos_widget_cache.json';

const GOLD = new Color('#ffd600');
const AMBER = new Color('#ff8c00');
const GREEN = new Color('#10b981');
const ROSE = new Color('#f43f5e');
const WHITE = Color.white();
const MUTED = new Color('#ffffff', 0.5);

const fm = FileManager.local();
const cachePath = fm.joinPath(fm.documentsDirectory(), CACHE);

// ─── Token ────────────────────────────────────────────────
async function token() {
  if (Keychain.contains(KEY)) return Keychain.get(KEY);
  if (config.runsInWidget) return null;
  const a = new Alert();
  a.title = 'Token del hub de pagos';
  a.message = 'Lo ves en tu Sheet: menú Hub de pagos → Ver token de acceso.';
  a.addTextField('Token');
  a.addAction('Guardar');
  a.addCancelAction('Cancelar');
  if ((await a.presentAlert()) === -1) return null;
  const t = a.textFieldValue(0).trim();
  if (t) Keychain.set(KEY, t);
  return t || null;
}

// ─── Datos ────────────────────────────────────────────────
async function datos(t) {
  try {
    const r = new Request(`${API}?corto=1&token=${encodeURIComponent(t)}`);
    r.timeoutInterval = 20;
    const j = await r.loadJSON();
    if (!j.ok) {
      if (String(j.error).includes('Token')) Keychain.remove(KEY);
      throw new Error(j.error);
    }
    const d = { ...j.data, at: Date.now() };
    fm.writeString(cachePath, JSON.stringify(d));
    return d;
  } catch (e) {
    if (fm.fileExists(cachePath)) return { ...JSON.parse(fm.readString(cachePath)), offline: true };
    throw e;
  }
}

// ─── Formato ──────────────────────────────────────────────
const mx = (n) => {
  const s = Math.abs(n).toFixed(2).replace(/\.00$/, '');
  const [e, d] = s.split('.');
  return (n < 0 ? '−$' : '$') + e.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : '');
};
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const fecha = (iso, hoy) => {
  const [y, m, d] = iso.split('-').map(Number);
  const f = new Date(y, m - 1, d);
  const [hy, hm, hd] = hoy.split('-').map(Number);
  const dif = Math.round((f - new Date(hy, hm - 1, hd)) / 86400000);
  if (dif <= 0) return 'hoy';
  if (dif === 1) return 'mañana';
  if (dif < 7) return DIAS[f.getDay()];
  return `${d} ${MESES[m - 1]}`;
};

function fondo(w) {
  const g = new LinearGradient();
  g.colors = [new Color('#1b1a20'), new Color('#0b0b0e'), new Color('#1a1205')];
  g.locations = [0, 0.55, 1];
  g.startPoint = new Point(0, 0);
  g.endPoint = new Point(1, 1);
  w.backgroundGradient = g;
}

function texto(stack, s, size, color, weight = 'semibold') {
  const t = stack.addText(s);
  t.font = weight === 'bold' ? Font.boldRoundedSystemFont(size) : weight === 'regular' ? Font.systemFont(size) : Font.semiboldSystemFont(size);
  t.textColor = color;
  t.minimumScaleFactor = 0.6;
  t.lineLimit = 1;
  return t;
}

// ─── Widgets ──────────────────────────────────────────────
function bloquePrincipal(stack, d) {
  texto(stack, 'EN TU BANCO', 10, MUTED);
  texto(stack, mx(d.saldo), 24, WHITE, 'bold');
  stack.addSpacer(8);
  texto(stack, 'LIBRE ESTA SEMANA', 10, GOLD);
  texto(stack, mx(d.libreSemana), 20, d.libreSemana > 0 ? GOLD : ROSE, 'bold');
  stack.addSpacer(4);
  texto(stack, `Al domingo ${mx(d.alCierre)}`, 11, d.alCierre < d.colchon ? AMBER : MUTED, 'regular');
}

function pie(stack, d) {
  const hora = new Date(d.at);
  texto(stack, (d.offline ? 'Sin conexión · ' : '') + hora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }), 9, new Color('#ffffff', 0.32), 'regular');
}

function pequeño(d) {
  const w = new ListWidget();
  fondo(w);
  w.setPadding(14, 14, 12, 14);
  bloquePrincipal(w, d);
  w.addSpacer();
  pie(w, d);
  return w;
}

function mediano(d) {
  const w = new ListWidget();
  fondo(w);
  w.setPadding(14, 16, 12, 16);
  const fila = w.addStack();
  const izq = fila.addStack();
  izq.layoutVertically();
  bloquePrincipal(izq, d);
  fila.addSpacer(16);
  const der = fila.addStack();
  der.layoutVertically();
  texto(der, 'PRÓXIMOS', 10, MUTED);
  der.addSpacer(4);
  (d.proximos || []).slice(0, 3).forEach((p) => {
    const r = der.addStack();
    r.centerAlignContent();
    const c = r.addStack();
    c.layoutVertically();
    texto(c, p.concepto, 12, WHITE);
    texto(c, fecha(p.fecha, d.hoy), 10, MUTED, 'regular');
    r.addSpacer();
    texto(r, mx(p.monto), 12, WHITE);
    der.addSpacer(5);
  });
  w.addSpacer();
  pie(w, d);
  return w;
}

function bloqueo(d, familia) {
  const w = new ListWidget();
  if (familia === 'accessoryInline') {
    texto(w, `Libre ${mx(d.libreSemana)} · Banco ${mx(d.saldo)}`, 12, WHITE);
    return w;
  }
  texto(w, `Libre ${mx(d.libreSemana)}`, 15, WHITE, 'bold');
  texto(w, `Banco ${mx(d.saldo)}`, 12, WHITE, 'regular');
  const p = (d.proximos || [])[0];
  if (p) texto(w, `${p.concepto} ${mx(p.monto)} · ${fecha(p.fecha, d.hoy)}`, 11, WHITE, 'regular');
  return w;
}

function mensaje(s) {
  const w = new ListWidget();
  fondo(w);
  texto(w, 'Pagos', 14, GOLD, 'bold');
  w.addSpacer(4);
  const t = w.addText(s);
  t.font = Font.systemFont(12);
  t.textColor = WHITE;
  return w;
}

// ─── Arranque ─────────────────────────────────────────────
const familia = config.widgetFamily || 'medium';
let widget;
const t = await token();
if (!t) {
  widget = mensaje('Abre este script en Scriptable para poner tu token.');
} else {
  try {
    const d = await datos(t);
    widget = familia === 'small' ? pequeño(d)
      : familia.startsWith('accessory') ? bloqueo(d, familia)
      : mediano(d);
  } catch (e) {
    widget = mensaje('No se pudo cargar: ' + e.message);
  }
}
widget.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
