/* txn.js — Transacción de Organizar (Opción A).
   Todas las operaciones de la sesión trabajan sobre un BORRADOR.
   Nada se escribe en localStorage hasta confirmar. */
(function (global) {
  'use strict';

  var snap = null, draft = null;

  function clonar(o) { return JSON.parse(JSON.stringify(o)); }

  function iniciar() {
    snap = global.UserPreferences.instantanea();
    draft = clonar(snap);
    global.UserPreferences.usarBorrador(draft);
    return draft;
  }

  function activo() { return !!draft; }
  function datos() { return draft; }
  function sucio() { return !!draft && JSON.stringify(draft) !== JSON.stringify(snap); }

  /* Confirma: vuelca el borrador en las preferencias reales (un único commit). */
  function confirmar() {
    if (!draft) { return false; }
    var d = draft;
    global.UserPreferences.usarBorrador(null);
    global.UserPreferences.restaurar(d);      /* valida + guarda + notifica */
    draft = null; snap = null;
    return true;
  }

  /* Descarta: no se ha escrito nada; se vuelve a leer lo persistido. */
  function descartar() {
    global.UserPreferences.usarBorrador(null);
    draft = null; snap = null;
  }

  global.Txn = {
    iniciar: iniciar, activo: activo, datos: datos, sucio: sucio,
    confirmar: confirmar, descartar: descartar
  };
}(typeof window !== 'undefined' ? window : this));
