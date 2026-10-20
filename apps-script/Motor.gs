/**
 * Motor.gs — lógica pura del hub (sin SpreadsheetApp), para poder probarla fuera de Apps Script.
 * Todas las fechas viajan como texto 'YYYY-MM-DD' para no pelear con zonas horarias.
 */

var DIAS_SEMANA = { DO: 0, LU: 1, MA: 2, MI: 3, JU: 4, VI: 5, SA: 6 };

function iso_(y, m, d) {
  return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
function parseIso_(s) {
  var p = String(s).split('-');
  return { y: +p[0], m: +p[1], d: +p[2] };
}
function utc_(s) {
  var p = parseIso_(s);
  return Date.UTC(p.y, p.m - 1, p.d);
}
function fromUtc_(t) {
  var d = new Date(t);
  return iso_(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
function addDays_(s, n) { return fromUtc_(utc_(s) + n * 86400000); }
function dow_(s) { return new Date(utc_(s)).getUTCDay(); }
function diffDays_(a, b) { return Math.round((utc_(b) - utc_(a)) / 86400000); }
function daysInMonth_(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
function round2_(n) { return Math.round(n * 100) / 100; }

function contarDiaEnMes_(y, m, diaSemana) {
  var c = 0, n = daysInMonth_(y, m);
  for (var d = 1; d <= n; d++) if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === diaSemana) c++;
  return c;
}

/** Viernes en que arranca la semana de pagos que contiene `fecha` (semanas de viernes a jueves). */
function inicioSemana_(fecha) {
  return addDays_(fecha, -((dow_(fecha) - 5 + 7) % 7));
}

/**
 * Genera las ocurrencias de cada pago/ingreso entre `desde` y `hasta` (inclusive).
 * Frecuencias:
 *  - mensual:     días del mes en `dias` ("12" o "15,30"); un día que no existe en el mes se recorre al último día.
 *  - bimestral:   como mensual, cada 2 meses contando desde el mes de `inicio`.
 *  - semanal:     cada semana el día de `dias` (LU, MA, MI, JU, VI, SA, DO).
 *  - semanal_mes: igual que semanal, pero `monto` es mensual y se reparte entre las semanas que tenga el mes.
 *  - unica:       una sola vez, en la fecha de `inicio`.
 */
function generarOcurrencias_(pagos, desde, hasta) {
  var out = [];
  pagos.forEach(function (p) {
    if (!p.activo || !p.id) return;
    var ini = p.inicio && p.inicio > desde ? p.inicio : desde;
    var fin = p.fin && p.fin < hasta ? p.fin : hasta;
    if (ini > fin) return;
    var f = String(p.frecuencia || '').toLowerCase().trim();

    var push = function (fecha, monto) {
      if (fecha < ini || fecha > fin) return;
      out.push({
        id: p.id + '_' + fecha,
        pagoId: p.id,
        concepto: p.concepto,
        monto: round2_(monto),
        tipo: p.tipo,
        fecha: fecha
      });
    };

    if (f === 'mensual' || f === 'bimestral') {
      var dias = String(p.dias).split(',').map(function (x) { return parseInt(x, 10); })
        .filter(function (x) { return x >= 1 && x <= 31; });
      var a = parseIso_(ini), b = parseIso_(fin);
      var ancla = parseIso_(p.inicio || ini);
      var y = a.y, m = a.m;
      while (y < b.y || (y === b.y && m <= b.m)) {
        var dif = (y - ancla.y) * 12 + (m - ancla.m);
        if (f === 'mensual' || ((dif % 2) + 2) % 2 === 0) {
          dias.forEach(function (d) { push(iso_(y, m, Math.min(d, daysInMonth_(y, m))), p.monto); });
        }
        m++;
        if (m > 12) { m = 1; y++; }
      }
    } else if (f === 'unica') {
      push(p.inicio || ini, p.monto);
    } else if (f === 'semanal' || f === 'semanal_mes') {
      var objetivo = DIAS_SEMANA[String(p.dias).trim().toUpperCase().slice(0, 2)];
      if (objetivo === undefined) return;
      var s = ini;
      while (dow_(s) !== objetivo) s = addDays_(s, 1);
      for (; s <= fin; s = addDays_(s, 7)) {
        var q = parseIso_(s);
        push(s, f === 'semanal' ? p.monto : p.monto / contarDiaEnMes_(q.y, q.m, objetivo));
      }
    }
  });
  out.sort(function (x, y) {
    if (x.fecha !== y.fecha) return x.fecha < y.fecha ? -1 : 1;
    return x.concepto < y.concepto ? -1 : 1;
  });
  return out;
}

/**
 * Resumen de la semana de calendario (lunes a domingo) que contiene `hoy`.
 *  - porPagar: pagos pendientes de hoy al domingo + todo lo vencido sin marcar
 *  - porEntrar: ingresos pendientes de hoy al domingo
 *  - alCierre: saldo actual − porPagar + porEntrar (los gastos extra ya están restados del saldo)
 *  - gastosExtra / pagado / recibido: lo que ya se registró con fecha dentro de la semana
 */
function resumenSemana_(pendientes, movs, saldo, hoy) {
  var inicio = addDays_(hoy, -((dow_(hoy) + 6) % 7));
  var fin = addDays_(inicio, 6);
  var r = { inicio: inicio, fin: fin, porPagar: 0, porEntrar: 0, gastosExtra: 0, ingresosExtra: 0, pagado: 0, recibido: 0, pagos: [], gastos: [] };

  pendientes.forEach(function (o) {
    if (o.tipo === 'ingreso') {
      if (o.fecha >= hoy && o.fecha <= fin) r.porEntrar = round2_(r.porEntrar + o.monto);
    } else if (o.fecha <= fin) {
      r.porPagar = round2_(r.porPagar + o.monto);
      r.pagos.push(o);
    }
  });

  (movs || []).forEach(function (m) {
    if (!m.vence || m.vence < inicio || m.vence > fin) return;
    if (m.accion === 'gasto') { r.gastosExtra = round2_(r.gastosExtra + m.monto); r.gastos.push(m); }
    if (m.accion === 'ingreso_extra') r.ingresosExtra = round2_(r.ingresosExtra + m.monto);
    if (m.accion === 'pagado') r.pagado = round2_(r.pagado + m.monto);
    if (m.accion === 'recibido') r.recibido = round2_(r.recibido + m.monto);
  });

  r.alCierre = round2_(saldo - r.porPagar + r.porEntrar);
  return r;
}

/**
 * Cuánto puedes gastar sin que la proyección baje del colchón en ningún día del horizonte.
 * Supone un gasto parejo por día (r): el saldo del día i baja r·(i+1). El r máximo que respeta
 * el colchón en todos los días es min((saldo_i − colchón) / (i+1)).
 *  - porSemana: ritmo sostenible (7·r)
 *  - semana:    lo que toca de hoy al domingo (r · días restantes)
 *  - limite:    lo máximo que podrías gastar HOY de golpe sin bajar del colchón (mín − colchón)
 *  - cuello:    el día que define el ritmo (normalmente la semana pesada que viene)
 */
function libreParaGastar_(puntos, colchon, hoy) {
  if (!puntos || !puntos.length) return null;
  var r = Infinity, cuello = puntos[0].fecha, minimo = Infinity, minFecha = puntos[0].fecha;
  for (var i = 0; i < puntos.length; i++) {
    var holgura = puntos[i].saldo - colchon;
    var tasa = holgura / (i + 1);
    if (tasa < r) { r = tasa; cuello = puntos[i].fecha; }
    if (puntos[i].saldo < minimo) { minimo = puntos[i].saldo; minFecha = puntos[i].fecha; }
  }
  var diasSemana = 7 - ((dow_(hoy) + 6) % 7);        // de hoy al domingo, incluyendo hoy
  var piso10 = function (n) { return Math.max(0, Math.floor(n / 10) * 10); };
  return {
    porDia: Math.max(0, round2_(r)),
    porSemana: piso10(r * 7),
    semana: piso10(r * diasSemana),
    diasSemana: diasSemana,
    limite: piso10(minimo - colchon),
    cuello: cuello,
    faltante: minimo < colchon ? round2_(colchon - minimo) : 0,
    faltanteFecha: minimo < colchon ? minFecha : ''
  };
}

/**
 * Arma lo que ve la app a partir de las ocurrencias pendientes (sin registro de pagado/recibido/omitido).
 * Proyección conservadora: en un mismo día primero salen los pagos y después entran los ingresos.
 * Lo vencido se cuenta como si saliera hoy; los ingresos pasados sin confirmar no se suman.
 */
/**
 * Gasto del día a día que se descuenta en la proyección.
 * Semana de lunes a domingo: en la semana actual se reparte lo que queda del presupuesto
 * (presupuesto − gastos extra ya registrados) entre los días que faltan; en las demás, presupuesto / 7 por día.
 */
function gastoVariableDia_(d, hoy, variable) {
  if (!variable || !(variable.semanal > 0)) return 0;
  var lunesHoy = addDays_(hoy, -((dow_(hoy) + 6) % 7));
  if (d <= addDays_(lunesHoy, 6)) {
    var resta = Math.max(0, variable.semanal - (variable.gastadoSemana || 0));
    var dias = 7 - ((dow_(hoy) + 6) % 7);
    return resta / dias;
  }
  return variable.semanal / 7;
}

function armarVista_(pendientes, saldo, hoy, hasta, variable) {
  var esIngreso = function (o) { return o.tipo === 'ingreso'; };

  var vencidos = pendientes.filter(function (o) { return o.fecha < hoy && !esIngreso(o); });
  var porConfirmar = pendientes.filter(function (o) { return o.fecha < hoy && esIngreso(o); });
  var futuros = pendientes.filter(function (o) { return o.fecha >= hoy; });

  // Semanas de viernes a jueves
  var semanas = [], idx = {};
  futuros.forEach(function (o) {
    var k = inicioSemana_(o.fecha);
    if (!(k in idx)) {
      idx[k] = semanas.length;
      semanas.push({ inicio: k, fin: addDays_(k, 6), apartar: 0, ingresos: 0, items: [] });
    }
    var w = semanas[idx[k]];
    w.items.push(o);
    if (esIngreso(o)) w.ingresos = round2_(w.ingresos + o.monto);
    else w.apartar = round2_(w.apartar + o.monto);
  });

  // Proyección día a día
  var porDia = {};
  vencidos.forEach(function (o) { (porDia[hoy] = porDia[hoy] || []).push(o); });
  futuros.forEach(function (o) { (porDia[o.fecha] = porDia[o.fecha] || []).push(o); });

  var s = saldo, minimo = saldo, minimoFecha = hoy, puntos = [];
  for (var d = hoy; d <= hasta; d = addDays_(d, 1)) {
    var evs = porDia[d] || [];
    evs.filter(function (o) { return !esIngreso(o); }).forEach(function (o) {
      s = round2_(s - o.monto);
      if (s < minimo) { minimo = s; minimoFecha = d; }
    });
    var gv = gastoVariableDia_(d, hoy, variable);
    if (gv) {
      s = round2_(s - gv);
      if (s < minimo) { minimo = s; minimoFecha = d; }
    }
    evs.filter(esIngreso).forEach(function (o) { s = round2_(s + o.monto); });
    puntos.push({ fecha: d, saldo: s });
  }

  return {
    hoy: hoy,
    saldo: saldo,
    vencidos: vencidos,
    porConfirmar: porConfirmar,
    semanas: semanas,
    proyeccion: { minimo: minimo, minimoFecha: minimoFecha, final: s, puntos: puntos, conPresupuesto: !!(variable && variable.semanal > 0) }
  };
}

/**
 * Meta de ahorro: a cuánto llegas en la fecha (con el presupuesto) y cuánto podrías gastar por semana como máximo
 * para lograrla (usando la proyección sin gasto del día a día como base).
 */
function evaluarMeta_(meta, puntosConPresupuesto, puntosBase, hoy, gastadoSemana) {
  if (!meta || !(meta.monto > 0) || !meta.fecha || meta.fecha <= hoy) return null;
  var en = function (pts) {
    var v = null;
    pts.forEach(function (p) { if (p.fecha <= meta.fecha) v = p.saldo; });
    return v;
  };
  var proyectado = en(puntosConPresupuesto), base = en(puntosBase);
  if (proyectado === null || base === null) return null;
  var dias = diffDays_(hoy, meta.fecha) + 1;
  // lo ya gastado esta semana cuenta contra el presupuesto, así que se suma de regreso al calcular el máximo semanal
  var maxSemanal = Math.floor(((base - meta.monto) + (gastadoSemana || 0)) / (dias / 7) / 10) * 10;
  return {
    monto: meta.monto,
    fecha: meta.fecha,
    proyectado: round2_(proyectado),
    diferencia: round2_(proyectado - meta.monto),
    alcanza: proyectado >= meta.monto,
    maxSemanal: Math.max(0, maxSemanal),
    semanas: Math.round(dias / 7 * 10) / 10,
    llegaFecha: meta.fecha > puntosBase[puntosBase.length - 1].fecha ? puntosBase[puntosBase.length - 1].fecha : meta.fecha
  };
}
