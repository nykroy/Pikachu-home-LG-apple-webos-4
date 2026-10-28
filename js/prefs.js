/* prefs.js — UserPreferences: favoritos, orden, visibilidad y orden de secciones.
   Persistencia en localStorage con IDs estables, versión de esquema, validación
   y recuperación ante JSON corrupto. La sincronización NUNCA escribe aquí. */
(function (global) {
  'use strict';

  var CLAVE = 'pikachu-home-prefs';
  var VERSION = 1;

  function defecto() {
    return {
      version: VERSION,
      secciones: ['favoritos', 'apps', 'entradas'],
      favoritos: [],
      ocultas: [],
      orden: { apps: [], entradas: [] },
      nuevas: [],
      visto: {},
      sembrado: false,
      actualizado: 0
    };
  }

  var datos = defecto();
  var borrador = null;              /* transacción activa (Organizar) */
  function obj() { return borrador || datos; }
  function usarBorrador(d) { borrador = d || null; }
  function esBorrador() { return !!borrador; }
  var ultimoError = null;

  function esArray(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
  function soloStrings(v) {
    var out = [], i;
    if (!esArray(v)) { return out; }
    for (i = 0; i < v.length; i++) {
      if (typeof v[i] === 'string' && v[i] && out.indexOf(v[i]) < 0) { out.push(v[i]); }
    }
    return out;
  }

  /* Validación estricta: cualquier campo inválido se sustituye por el valor por defecto. */
  function validar(o) {
    var d = defecto();
    if (!o || typeof o !== 'object') { return d; }
    var secciones = soloStrings(o.secciones);
    var validas = [];
    var i;
    for (i = 0; i < secciones.length; i++) {
      if (['favoritos', 'apps', 'entradas', 'nuevas'].indexOf(secciones[i]) >= 0) { validas.push(secciones[i]); }
    }
    if (validas.length < 2) { validas = d.secciones; }
    d.secciones = validas;
    d.favoritos = soloStrings(o.favoritos);
    d.ocultas = soloStrings(o.ocultas);
    d.nuevas = soloStrings(o.nuevas);
    d.orden = { apps: [], entradas: [] };
    if (o.orden && typeof o.orden === 'object') {
      d.orden.apps = soloStrings(o.orden.apps);
      d.orden.entradas = soloStrings(o.orden.entradas);
    }
    d.visto = {};
    if (o.visto && typeof o.visto === 'object') {
      for (var k in o.visto) {
        if (Object.prototype.hasOwnProperty.call(o.visto, k) && o.visto[k] === true) { d.visto[k] = true; }
      }
    }
    d.sembrado = o.sembrado === true;
    d.actualizado = typeof o.actualizado === 'number' ? o.actualizado : 0;
    return d;
  }

  function cargar() {
    var bruto = null;
    try { bruto = global.localStorage.getItem(CLAVE); } catch (e) { bruto = null; }
    if (!bruto) { datos = defecto(); return { ok: true, origen: 'nuevo' }; }
    try {
      var o = JSON.parse(bruto);
      if (o && o.version !== VERSION) {
        datos = validar(o);            /* migración tolerante */
        guardar();
        return { ok: true, origen: 'migrado' };
      }
      datos = validar(o);
      return { ok: true, origen: 'disco' };
    } catch (e) {
      /* JSON corrupto: se conserva una copia del original y se arranca limpio */
      ultimoError = String(e && e.message ? e.message : e);
      try { global.localStorage.setItem(CLAVE + '-corrupto', bruto); } catch (e2) { }
      datos = defecto();
      guardar();
      return { ok: false, origen: 'corrupto', error: ultimoError };
    }
  }

  function guardar() {
    if (borrador) { return true; }        /* transacción: NO se escribe nada */
    datos.actualizado = new Date().getTime();
    try { global.localStorage.setItem(CLAVE, JSON.stringify(datos)); return true; }
    catch (e) { ultimoError = String(e); return false; }
  }

  function get(k) { return obj()[k]; }
  function estado() { return JSON.parse(JSON.stringify(obj())); }
  function error() { return ultimoError; }

  function sembrarFavoritos(ids) {
    if (obj().sembrado) { return false; }
    obj().favoritos = soloStrings(ids);
    obj().sembrado = true;
    guardar();
    return true;
  }

  function esFavorito(id) { return obj().favoritos.indexOf(id) >= 0; }
  function estaOculto(id) { return obj().ocultas.indexOf(id) >= 0; }

  function alternarFavorito(id) {
    var i = obj().favoritos.indexOf(id);
    if (i >= 0) { obj().favoritos.splice(i, 1); } else { obj().favoritos.push(id); }
    guardar();
    return obj().favoritos.indexOf(id) >= 0;
  }

  function alternarOculto(id) {
    var i = obj().ocultas.indexOf(id);
    if (i >= 0) { obj().ocultas.splice(i, 1); } else { obj().ocultas.push(id); }
    guardar();
    return obj().ocultas.indexOf(id) >= 0;
  }

  function mostrar(id) {
    var i = obj().ocultas.indexOf(id);
    if (i >= 0) { obj().ocultas.splice(i, 1); guardar(); return true; }
    return false;
  }

  function fijarOrden(seccion, ids) {
    var limpio = soloStrings(ids);
    if (seccion === 'favoritos') {
      obj().favoritos = limpio;      /* el orden de Favoritos ES la lista */
      guardar();
      return true;
    }
    if (seccion !== 'apps' && seccion !== 'entradas') { return false; }
    obj().orden[seccion] = limpio;
    guardar();
    return true;
  }

  function ordenDe(seccion) {
    if (seccion === 'favoritos') { return (obj().favoritos || []).slice(0); }
    return (obj().orden[seccion] || []).slice(0);
  }

  function moverSeccion(seccion, dir) {
    var i = obj().secciones.indexOf(seccion);
    if (i < 0) { return false; }
    var j = i + dir;
    if (j < 0 || j >= obj().secciones.length) { return false; }
    obj().secciones.splice(i, 1);
    obj().secciones.splice(j, 0, seccion);
    guardar();
    return true;
  }

  /* Mover dentro de una sección con límites estrictos: fuera de rango no hace nada. */
  function moverEnOrden(seccion, desde, hacia) {
    if (seccion !== 'apps' && seccion !== 'entradas') { return false; }
    var arr = (obj().orden[seccion] || []).slice(0);
    if (desde < 0 || desde >= arr.length) { return false; }
    if (hacia < 0 || hacia >= arr.length) { return false; }
    if (desde === hacia) { return false; }
    var tmp = arr[desde];
    arr.splice(desde, 1);
    arr.splice(hacia, 0, tmp);
    obj().orden[seccion] = arr;
    guardar();
    return true;
  }

  /* Instantánea y restauración: permite cancelar una edición con BACK. */
  function instantanea() { return JSON.parse(JSON.stringify(datos)); }
  function restaurar(snap) { datos = validar(snap); guardar(); return estado(); }

  function marcarNoDisponibles(ids) {
    obj().noDisp = ids.slice(0);
    guardar();
  }

  function marcarNuevas(ids) {
    var i, cambiado = false;
    for (i = 0; i < ids.length; i++) {
      if (obj().nuevas.indexOf(ids[i]) < 0) { obj().nuevas.push(ids[i]); cambiado = true; }
    }
    if (cambiado) { guardar(); }
    return obj().nuevas.slice(0);
  }

  function marcarVisto(id) {
    if (!obj().visto[id]) { obj().visto[id] = true; }
    var i = obj().nuevas.indexOf(id);
    if (i >= 0) { obj().nuevas.splice(i, 1); }
    guardar();
  }

  /* Restauración del orden predeterminado: conserva el vínculo con las apps instaladas. */
  function restaurarDefecto(semilla) {
    var d = defecto();
    d.sembrado = true;
    d.favoritos = soloStrings(semilla && semilla.favoritos ? semilla.favoritos : []);
    d.secciones = (semilla && semilla.secciones ? soloStrings(semilla.secciones) : d.secciones);
    d.orden = { apps: [], entradas: [] };
    d.visto = obj().visto;
    d.nuevas = obj().nuevas;
    var o = obj(), k;
    for (k in o) { if (Object.prototype.hasOwnProperty.call(o, k)) { delete o[k]; } }
    for (k in d) { if (Object.prototype.hasOwnProperty.call(d, k)) { o[k] = d[k]; } }
    guardar();                      /* no-op si hay borrador */
    return estado();
  }

  global.UserPreferences = {
    usarBorrador: usarBorrador, esBorrador: esBorrador,
    VERSION: VERSION,
    CLAVE: CLAVE,
    cargar: cargar,
    guardar: guardar,
    get: get,
    estado: estado,
    error: error,
    validar: validar,
    sembrarFavoritos: sembrarFavoritos,
    esFavorito: esFavorito,
    estaOculto: estaOculto,
    alternarFavorito: alternarFavorito,
    alternarOculto: alternarOculto,
    mostrar: mostrar,
    fijarOrden: fijarOrden,
    moverEnOrden: moverEnOrden,
    instantanea: instantanea,
    restaurar: restaurar,
    ordenDe: ordenDe,
    moverSeccion: moverSeccion,
    marcarNuevas: marcarNuevas, marcarNoDisponibles: marcarNoDisponibles,
    marcarVisto: marcarVisto,
    restaurarDefecto: restaurarDefecto
  };
}(typeof window !== 'undefined' ? window : globalThis));
