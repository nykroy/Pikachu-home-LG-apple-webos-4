/* cache.js — CatalogCache: última consulta válida + fecha. Nunca pisa preferencias. */
(function (global) {
  'use strict';
  var LS = 'pikachu.cache.v1';

  function guardar(apps) {
    try {
      global.localStorage.setItem(LS, JSON.stringify({ ts: (new Date()).getTime(), apps: apps || [] }));
      return true;
    } catch (x) { return false; }
  }

  function leer() {
    try {
      var r = global.localStorage.getItem(LS);
      if (!r) { return null; }
      var o = JSON.parse(r);
      if (!o || Object.prototype.toString.call(o.apps) !== '[object Array]') { return null; }
      return o;
    } catch (x) { return null; }
  }

  function edad() { var o = leer(); return o ? ((new Date()).getTime() - o.ts) : null; }

  function limpiar() { try { global.localStorage.removeItem(LS); } catch (x) { /* ignorado */ } }

  global.CatalogCache = { guardar: guardar, leer: leer, edad: edad, limpiar: limpiar };
}(typeof window !== 'undefined' ? window : this));
