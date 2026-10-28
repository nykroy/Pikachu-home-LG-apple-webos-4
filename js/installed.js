/* installed.js — InstalledApps: lo que REALMENTE está instalado.
   No contiene preferencias del usuario. Se reemplaza en cada sincronización. */
(function (global) {
  'use strict';

  var apps = [];            // [{id, nombre, tipo, c1, c2, glyph, fuente}]
  var ts = 0;               // última sincronización correcta

  function clave(app) { return app && app.id ? app.id : null; }

  function setAll(lista, marca) {
    var i, nuevas = [], limpio = [];
    for (i = 0; i < lista.length; i++) {
      if (clave(lista[i])) { limpio.push(lista[i]); }
    }
    apps = limpio;
    ts = marca || Date.now();
    return apps;
  }

  function todos() { return apps.slice(); }

  function buscar(id) {
    var i;
    for (i = 0; i < apps.length; i++) { if (apps[i].id === id) { return apps[i]; } }
    return null;
  }

  function existe(id) { return !!buscar(id); }

  function ids() {
    var r = [], i;
    for (i = 0; i < apps.length; i++) { r.push(apps[i].id); }
    return r;
  }

  function marca() { return ts; }

  /* Diferencias entre el estado anterior y el nuevo: sirve para saber
     qué es "nueva instalación" sin tocar las preferencias. */
  function diferencias(listaNueva) {
    var previos = {}, nuevos = {}, i, id, altas = [], bajas = [];
    for (i = 0; i < apps.length; i++) { previos[apps[i].id] = true; }
    for (i = 0; i < listaNueva.length; i++) { nuevos[listaNueva[i].id] = true; }
    for (id in nuevos) { if (!previos[id]) { altas.push(id); } }
    for (id in previos) { if (!nuevos[id]) { bajas.push(id); } }
    return { altas: altas, bajas: bajas };
  }

  /* Compatibilidad de API: visibles() = todas las instaladas (el filtrado lo hace VisibleMenu) */
  function visibles() { return todos(); }

  function marcarDisponible(id, valor) {
    var i;
    for (i = 0; i < apps.length; i++) {
      if (apps[i].id === id) { apps[i].disponible = valor; return true; }
    }
    return false;
  }

  global.InstalledApps = {
    marcarDisponible: marcarDisponible,
    setAll: setAll, todos: todos, visibles: visibles, buscar: buscar, existe: existe, ids: ids,
    marca: marca, diferencias: diferencias
  };
}(typeof window !== 'undefined' ? window : globalThis));
