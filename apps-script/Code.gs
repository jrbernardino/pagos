/**
 * Hub de pagos — backend (Apps Script ligado al Sheet de finanzas).
 *
 * Hojas que crea setup():
 *   Hub_Pagos     → la lista de pagos e ingresos recurrentes (lo único que se edita a mano)
 *   Hub_Config    → saldo actual, horizonte, token de acceso
 *   Hub_Registro  → bitácora de lo marcado como pagado / recibido / omitido / ajustes de saldo
 *
 * API (desplegar como Web App: ejecutar como "Yo", acceso "Cualquier usuario"):
 *   GET  ?token=...&action=data
 *   POST {token, action: 'pagar'|'recibir'|'omitir'|'deshacer'|'saldo', id?, monto?}
 */

var HOJA_PAGOS = 'Hub_Pagos';
var HOJA_CONFIG = 'Hub_Config';
var HOJA_REG = 'Hub_Registro';
var TZ = 'America/Mexico_City';

var ENC_PAGOS = ['ID', 'Concepto', 'Monto', 'Tipo', 'Frecuencia', 'Días', 'Inicio', 'Fin', 'Activo', 'Nota'];
var ENC_REG = ['Registrado', 'Ocurrencia', 'Concepto', 'Monto', 'Vence', 'Acción', 'Saldo después'];

// ───────────────────────── Menú y configuración inicial ─────────────────────────

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Hub de pagos')
    .addItem('Configurar hojas', 'setup')
    .addItem('Ver token de acceso', 'mostrarToken')
    .addItem('Generar token nuevo', 'regenerarToken')
    .addToUi();
}

function setup() {
  var ss = SpreadsheetApp.getActive();
  var hoy = hoyIso_();

  // Hub_Pagos
  var sp = ss.getSheetByName(HOJA_PAGOS);
  if (!sp) {
    sp = ss.insertSheet(HOJA_PAGOS);
    var filas = [
      // ID, Concepto, Monto, Tipo, Frecuencia, Días, Inicio, Fin, Activo, Nota
      ['renta', 'Renta', 12470, 'casa', 'mensual', '12', hoy, '', true, ''],
      ['luz', 'Luz', 200, 'casa', 'bimestral', '19', '2026-09-19', '', true, 'Bimestral desde el pago del 19 sep'],
      ['gas', 'Gas y agua', 450, 'casa', 'mensual', '28', hoy, '', true, ''],
      ['izzi', 'Izzi', 785, 'casa', 'mensual', '28', hoy, '', true, ''],
      ['jaula', 'Jaula', 1000, 'casa', 'mensual', '23', hoy, '', true, ''],
      ['despensa', 'Despensa', 5000, 'casa', 'semanal_mes', 'VI', hoy, '', true, 'Monto mensual, se reparte entre los viernes del mes'],
      ['iphone', 'iPhone', 2400, 'personal', 'mensual', '28', hoy, '', true, ''],
      ['telefono', 'Teléfono', 339, 'personal', 'mensual', '1', hoy, '', true, ''],
      ['vuelos1', 'Vuelos', 1150, 'personal', 'mensual', '30', hoy, '2026-12-31', true, ''],
      ['vuelos2', 'Vuelos 2', 685, 'personal', 'mensual', '24', hoy, '2026-11-30', true, ''],
      ['prestamo_q', 'Préstamo quincenal', 720, 'personal', 'mensual', '15,30', hoy, '2026-12-31', true, ''],
      ['prestamo_3', 'Préstamo 3 mensualidades', 1472.33, 'personal', 'mensual', '13', '2026-11-13', '2027-01-31', true, ''],
      ['nomina', 'Nómina', 8400, 'ingreso', 'semanal', 'VI', hoy, '', true, 'Ajustar al neto real'],
      ['tania', 'Transferencia Tania (25%)', 2488.13, 'ingreso', 'mensual', '15,30', hoy, '', true, 'Ajustar monto y días reales']
    ];
    sp.getRange('A:B').setNumberFormat('@');
    sp.getRange('F:H').setNumberFormat('@');
    sp.getRange('C:C').setNumberFormat('$#,##0.00');
    sp.getRange(1, 1, 1, ENC_PAGOS.length).setValues([ENC_PAGOS]).setFontWeight('bold');
    sp.getRange(2, 1, filas.length, ENC_PAGOS.length).setValues(filas);
    sp.setFrozenRows(1);
    sp.autoResizeColumns(1, ENC_PAGOS.length);
    var reglas = [
      SpreadsheetApp.newDataValidation().requireValueInList(['casa', 'personal', 'ingreso']).build(),
      SpreadsheetApp.newDataValidation().requireValueInList(FRECUENCIAS_).build()
    ];
    sp.getRange('D2:D200').setDataValidation(reglas[0]);
    sp.getRange('E2:E200').setDataValidation(reglas[1]);
    sp.getRange('I2:I200').insertCheckboxes();
    sp.getRange(2, 9, filas.length, 1).setValues(filas.map(function () { return [true]; }));
  }

  // Hub_Config
  var sc = ss.getSheetByName(HOJA_CONFIG);
  if (!sc) {
    sc = ss.insertSheet(HOJA_CONFIG);
    sc.getRange('A:B').setNumberFormat('@');
    sc.getRange(1, 1, 7, 2).setValues([
      ['Clave', 'Valor'],
      ['saldo', '6600'],
      ['saldo_fecha', hoy],
      ['inicio_hub', hoy],
      ['horizonte_dias', '60'],
      ['colchon', '1000'],
      ['token', nuevoToken_()]
    ]);
    sc.getRange('A1:B1').setFontWeight('bold');
    sc.autoResizeColumns(1, 2);
  }

  // Hub_Registro
  var sr = ss.getSheetByName(HOJA_REG);
  if (!sr) {
    sr = ss.insertSheet(HOJA_REG);
    sr.getRange(1, 1, 1, ENC_REG.length).setValues([ENC_REG]).setFontWeight('bold');
    sr.getRange('B:B').setNumberFormat('@');
    sr.getRange('E:E').setNumberFormat('@');
    sr.setFrozenRows(1);
  }

  mostrarToken();
}

function mostrarToken() {
  var t = leerConfig_().token;
  SpreadsheetApp.getUi().alert('Token de acceso del hub:\n\n' + t + '\n\nPégalo en la app la primera vez que la abras.');
}

function regenerarToken() {
  escribirConfig_('token', nuevoToken_());
  mostrarToken();
}

function nuevoToken_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 24);
}

// ───────────────────────── API ─────────────────────────

function doGet(e) {
  var p = (e && e.parameter) || {};
  return responder_(function () {
    validarToken_(p.token);
    var vista = obtenerVista_();
    return p.corto ? resumenCorto_(vista) : vista;
  });
}

/** Respuesta mínima para el atajo del Action Button y el widget de Scriptable. */
function resumenCorto_(vista) {
  var s = vista.semanaActual, l = vista.libre || {};
  var prox = [];
  vista.vencidos.concat.apply(vista.vencidos, vista.semanas.map(function (w) { return w.items; }))
    .forEach(function (o) { if (o.tipo !== 'ingreso' && prox.length < 3) prox.push({ concepto: o.concepto, monto: o.monto, fecha: o.fecha }); });
  return {
    hoy: vista.hoy,
    saldo: vista.saldo,
    porPagar: s.porPagar,
    porEntrar: s.porEntrar,
    alCierre: s.alCierre,
    libreSemana: l.semana || 0,
    librePorSemana: l.porSemana || 0,
    colchon: vista.colchon,
    proximos: prox,
    mensaje: 'Saldo ' + fmtMx_(vista.saldo) + ' · libre esta semana ' + fmtMx_(l.semana || 0)
  };
}

function doPost(e) {
  return responder_(function () {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    validarToken_(body.token);
    var lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      switch (body.action) {
        case 'pagar': registrar_(body.id, 'pagado', body.monto); break;
        case 'recibir': registrar_(body.id, 'recibido', body.monto); break;
        case 'omitir': registrar_(body.id, 'omitido', 0); break;
        case 'deshacer': deshacer_(body.id); break;
        case 'saldo': ajustarSaldo_(body.monto); break;
        case 'gasto': movimientoExtra_('gasto', body.concepto, body.monto, body.fecha); break;
        case 'ingreso_extra': movimientoExtra_('ingreso_extra', body.concepto, body.monto, body.fecha); break;
        case 'guardar_pago': guardarPago_(body.pago || {}); break;
        case 'borrar_pago': borrarPago_(body.id); break;
        default: throw new Error('Acción no válida');
      }
    } finally {
      lock.releaseLock();
    }
    var vista = obtenerVista_();
    return body.corto ? resumenCorto_(vista) : vista;
  });
}

function responder_(fn) {
  var out;
  try {
    out = { ok: true, data: fn() };
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function validarToken_(t) {
  var real = leerConfig_().token;
  if (!real || String(t || '') !== String(real)) throw new Error('Token inválido');
}

// ───────────────────────── Vista ─────────────────────────

function obtenerVista_() {
  var cfg = leerConfig_();
  var hoy = hoyIso_();
  var horizonte = parseInt(cfg.horizonte_dias, 10) || 60;
  var hasta = addDays_(hoy, horizonte);
  var desde = cfg.inicio_hub > addDays_(hoy, -45) ? cfg.inicio_hub : addDays_(hoy, -45);

  var registro = leerRegistro_();
  var pendientes = generarOcurrencias_(leerPagos_(), desde, hasta)
    .filter(function (o) { return !registro.porId[o.id]; });

  var saldo = parseFloat(cfg.saldo) || 0;
  var vista = armarVista_(pendientes, saldo, hoy, hasta);
  vista.semanaActual = resumenSemana_(pendientes, registro.filas, saldo, hoy);
  vista.saldoFecha = cfg.saldo_fecha;
  vista.colchon = parseFloat(cfg.colchon) || 0;
  vista.libre = libreParaGastar_(vista.proyeccion.puntos, vista.colchon, hoy);
  var pagos = leerPagos_();
  vista.pagos = pagos.map(function (p) {
    var sig = pendientes.filter(function (o) { return o.pagoId === p.id && o.fecha >= hoy; })[0];
    return {
      id: p.id, concepto: p.concepto, monto: p.monto, tipo: p.tipo, frecuencia: p.frecuencia,
      dias: p.dias, inicio: p.inicio, fin: p.fin, activo: p.activo, nota: p.nota, siguiente: sig ? sig.fecha : ''
    };
  });
  vista.recientes = registro.filas.slice(-30).reverse().map(function (r) {
    return { id: r.id, concepto: r.concepto, monto: r.monto, vence: r.vence, accion: r.accion };
  });
  return vista;
}

// ───────────────────────── Acciones ─────────────────────────

function registrar_(occId, accion, monto) {
  if (!occId) throw new Error('Falta la ocurrencia');
  var registro = leerRegistro_();
  if (registro.porId[occId]) throw new Error('Ya estaba registrado');

  var pagoId = occId.slice(0, -11);
  var fecha = occId.slice(-10);
  var pago = leerPagos_().filter(function (p) { return p.id === pagoId; })[0];
  if (!pago) throw new Error('No existe el pago ' + pagoId);

  var m = accion === 'omitido' ? 0 : round2_(parseFloat(monto));
  if (accion !== 'omitido' && !(m >= 0)) throw new Error('Monto inválido');

  var cfg = leerConfig_();
  var saldo = parseFloat(cfg.saldo) || 0;
  if (accion === 'pagado') saldo = round2_(saldo - m);
  if (accion === 'recibido') saldo = round2_(saldo + m);
  escribirConfig_('saldo', String(saldo));

  hojaReg_().appendRow([new Date(), occId, pago.concepto, m, fecha, accion, saldo]);
}

function deshacer_(occId) {
  var sr = hojaReg_();
  var registro = leerRegistro_();
  var r = registro.porId[occId];
  if (!r) throw new Error('No hay nada que deshacer');

  var saldo = parseFloat(leerConfig_().saldo) || 0;
  if (r.accion === 'pagado' || r.accion === 'gasto') saldo = round2_(saldo + r.monto);
  if (r.accion === 'recibido' || r.accion === 'ingreso_extra') saldo = round2_(saldo - r.monto);
  escribirConfig_('saldo', String(saldo));
  sr.deleteRow(r.fila);
}

/** Gasto o ingreso que no está en Hub_Pagos (comida, gasolina, un pago extra...). Mueve el saldo al momento. */
function movimientoExtra_(accion, concepto, monto, fecha) {
  var m = round2_(parseFloat(monto));
  if (!(m > 0)) throw new Error('Monto inválido');
  var c = String(concepto || '').trim().slice(0, 80) || (accion === 'gasto' ? 'Gasto' : 'Ingreso extra');
  var f = /^\d{4}-\d{2}-\d{2}$/.test(String(fecha || '')) ? String(fecha) : hoyIso_();

  var saldo = parseFloat(leerConfig_().saldo) || 0;
  saldo = round2_(accion === 'gasto' ? saldo - m : saldo + m);
  escribirConfig_('saldo', String(saldo));

  var id = accion + '_' + Utilities.getUuid().slice(0, 8);
  hojaReg_().appendRow([new Date(), id, c, m, f, accion, saldo]);
}

// ───────────────────────── Catálogo de pagos (Hub_Pagos) ─────────────────────────

var TIPOS_ = ['casa', 'personal', 'ingreso'];
var FRECUENCIAS_ = ['mensual', 'bimestral', 'semanal', 'semanal_mes', 'unica'];

function slug_(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'pago';
}

/** Crea o actualiza una fila de Hub_Pagos. Sin id → fila nueva. */
function guardarPago_(p) {
  var concepto = String(p.concepto || '').trim().slice(0, 60);
  if (!concepto) throw new Error('Falta el concepto');
  var monto = round2_(parseFloat(p.monto));
  if (!(monto > 0)) throw new Error('Monto inválido');
  var tipo = String(p.tipo || '').toLowerCase();
  if (TIPOS_.indexOf(tipo) < 0) throw new Error('Tipo inválido');
  var frec = String(p.frecuencia || '').toLowerCase();
  if (FRECUENCIAS_.indexOf(frec) < 0) throw new Error('Frecuencia inválida');
  var iso = /^\d{4}-\d{2}-\d{2}$/;
  var inicio = String(p.inicio || '').trim() || hoyIso_();
  var fin = String(p.fin || '').trim();
  if (!iso.test(inicio) || (fin && !iso.test(fin))) throw new Error('Fecha inválida');
  var dias = String(p.dias || '').toUpperCase().replace(/\s+/g, '');
  if (frec === 'mensual' || frec === 'bimestral') {
    if (!/^([1-9]|[12]\d|3[01])(,([1-9]|[12]\d|3[01]))*$/.test(dias)) throw new Error('Días del mes inválidos (ej. 12 o 15,30)');
  } else if (frec === 'semanal' || frec === 'semanal_mes') {
    if (!/^(LU|MA|MI|JU|VI|SA|DO)$/.test(dias)) throw new Error('Día de la semana inválido');
  } else {
    dias = '';
    fin = inicio;
  }
  if (fin && fin < inicio) throw new Error('La fecha de fin es antes del inicio');
  var activo = p.activo === undefined ? true : !!p.activo;
  var nota = String(p.nota || '').slice(0, 120);

  var sh = SpreadsheetApp.getActive().getSheetByName(HOJA_PAGOS);
  var ids = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues().map(function (r) { return String(r[0]).trim(); });
  var id = String(p.id || '').trim();
  var fila;
  if (id) {
    fila = ids.indexOf(id) + 1;
    if (fila < 2) throw new Error('No existe el pago ' + id);
  } else {
    var base = slug_(concepto), n = 1;
    id = base;
    while (ids.indexOf(id) >= 0) id = base + '_' + (++n);
    fila = sh.getLastRow() + 1;
  }
  sh.getRange('E2:E500').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(FRECUENCIAS_).setAllowInvalid(true).build());
  var r = sh.getRange(fila, 1, 1, 10);
  r.setNumberFormats([['@', '@', '$#,##0.00', '@', '@', '@', '@', '@', 'General', '@']]);
  r.setValues([[id, concepto, monto, tipo, frec, dias, inicio, fin, activo, nota]]);
  sh.getRange(fila, 9).insertCheckboxes().setValue(activo);
}

function borrarPago_(id) {
  var sh = SpreadsheetApp.getActive().getSheetByName(HOJA_PAGOS);
  var ids = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues().map(function (r) { return String(r[0]).trim(); });
  var fila = ids.indexOf(String(id || '').trim()) + 1;
  if (fila < 2) throw new Error('No existe el pago');
  sh.deleteRow(fila);
}

function fmtMx_(n) {
  var s = Math.abs(n).toFixed(2).replace(/\.00$/, '');
  var partes = s.split('.');
  partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-$' : '$') + partes.join('.');
}

function ajustarSaldo_(monto) {
  var m = round2_(parseFloat(monto));
  if (isNaN(m)) throw new Error('Saldo inválido');
  escribirConfig_('saldo', String(m));
  escribirConfig_('saldo_fecha', hoyIso_());
  hojaReg_().appendRow([new Date(), 'ajuste_' + hoyIso_(), 'Ajuste de saldo', m, hoyIso_(), 'ajuste', m]);
}

// ───────────────────────── Lectura / escritura de hojas ─────────────────────────

function hojaReg_() { return SpreadsheetApp.getActive().getSheetByName(HOJA_REG); }

function aIso_(v) {
  if (v === '' || v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v).trim().slice(0, 10);
}

function leerPagos_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(HOJA_PAGOS);
  if (!sh) throw new Error('Falta la hoja ' + HOJA_PAGOS + ' (corre setup)');
  var v = sh.getDataRange().getValues().slice(1);
  return v.filter(function (r) { return r[0] !== ''; }).map(function (r) {
    return {
      id: String(r[0]).trim(),
      concepto: String(r[1]).trim(),
      monto: parseFloat(r[2]) || 0,
      tipo: String(r[3]).trim().toLowerCase(),
      frecuencia: String(r[4]).trim().toLowerCase(),
      dias: String(r[5]).trim(),
      inicio: aIso_(r[6]),
      fin: aIso_(r[7]),
      activo: r[8] === true || String(r[8]).toUpperCase() === 'TRUE',
      nota: String(r[9] || '')
    };
  });
}

function leerConfig_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(HOJA_CONFIG);
  if (!sh) throw new Error('Falta la hoja ' + HOJA_CONFIG + ' (corre setup)');
  var cfg = {};
  sh.getDataRange().getValues().slice(1).forEach(function (r) {
    if (r[0] !== '') cfg[String(r[0]).trim()] = r[1] instanceof Date ? aIso_(r[1]) : String(r[1]).trim();
  });
  return cfg;
}

function escribirConfig_(clave, valor) {
  var sh = SpreadsheetApp.getActive().getSheetByName(HOJA_CONFIG);
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim() === clave) { sh.getRange(i + 1, 2).setValue(valor); return; }
  }
  sh.appendRow([clave, valor]);
}

function leerRegistro_() {
  var sh = hojaReg_();
  if (!sh) throw new Error('Falta la hoja ' + HOJA_REG + ' (corre setup)');
  var v = sh.getDataRange().getValues();
  var porId = {}, filas = [];
  for (var i = 1; i < v.length; i++) {
    var r = v[i];
    if (!r[1]) continue;
    var item = {
      fila: i + 1,
      registrado: r[0] instanceof Date ? Utilities.formatDate(r[0], TZ, "yyyy-MM-dd'T'HH:mm") : String(r[0]),
      id: String(r[1]),
      concepto: String(r[2]),
      monto: parseFloat(r[3]) || 0,
      vence: aIso_(r[4]),
      accion: String(r[5])
    };
    filas.push(item);
    if (item.accion !== 'ajuste') porId[item.id] = item;
  }
  return { porId: porId, filas: filas };
}

function hoyIso_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
