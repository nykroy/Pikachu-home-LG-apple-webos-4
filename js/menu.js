/* menu.js — VisibleMenu = InstalledApps ∩ UserPreferences (solo lectura de prefs). */
(function (global) {
  'use strict';

  var TITULOS = { favoritos: 'Favoritos', apps: 'Aplicaciones', entradas: 'Entradas', ocultas: 'Ocultas' };

  function ordenar(apps, ordenGuardado, nuevas) {
    var porId = {}, i, out = [], usados = {};
    for (i = 0; i < apps.length; i++) { porId[apps[i].id] = apps[i]; }
    for (i = 0; i < ordenGuardado.length; i++) {
      var id = ordenGuardado[i];
      if (porId[id] && !usados[id]) { out.push(porId[id]); usados[id] = true; }
    }
    var resto = [];
    for (i = 0; i < apps.length; i++) {
      if (!usados[apps[i].id]) { resto.push(apps[i]); }
    }
    resto.sort(function (a, b) { return a.nombre < b.nombre ? -1 : (a.nombre > b.nombre ? 1 : 0); });
    /* las nuevas, al final, en orden de aparición */
    var pendientes = [], otros = [], j;
    for (i = 0; i < resto.length; i++) {
      if (nuevas && nuevas.indexOf(resto[i].id) >= 0) { pendientes.push(resto[i]); } else { otros.push(resto[i]); }
    }
    pendientes.sort(function (a, b) { return nuevas.indexOf(a.id) - nuevas.indexOf(b.id); });
    return out.concat(otros).concat(pendientes);
  }

  function componer(conOcultas) {
    var apps = global.InstalledApps.visibles();
    var favoritos = global.UserPreferences.get('favoritos') || [];
    var ocultas = global.UserPreferences.get('ocultas') || [];
    var nuevas = global.UserPreferences.get('nuevas') || [];
    var ordenSecciones = global.UserPreferences.get('secciones') || ['favoritos', 'apps', 'entradas'];

    var todos = [], byId = {}, i;
    for (i = 0; i < apps.length; i++) { todos.push(apps[i]); byId[apps[i].id] = apps[i]; }

    var mapa = { favoritos: [], apps: [], entradas: [], ocultas: [] };

    /* Favoritos: orden explícito del usuario */
    for (i = 0; i < favoritos.length; i++) {
      var f = byId[favoritos[i]];
      if (f && ocultas.indexOf(f.id) < 0) { mapa.favoritos.push(f); }
    }

    /* Apps y entradas: se excluyen las ocultas; el orden propio se respeta */
    var appsNormales = [], entradas = [];
    for (i = 0; i < todos.length; i++) {
      var a = todos[i];
      if (ocultas.indexOf(a.id) >= 0) { continue; }
      var tipoLc = String(a.tipo).toLowerCase();
      var esEntrada = (a.entrada === true) || tipoLc === 'entrada' || tipoLc === 'input' || tipoLc.indexOf('hdmi') === 0;
      if (esEntrada) { entradas.push(a); } else { appsNormales.push(a); }
    }
    mapa.apps = ordenar(appsNormales, global.UserPreferences.ordenDe('apps'), nuevas);
    mapa.entradas = ordenar(entradas, global.UserPreferences.ordenDe('entradas'), nuevas);

    /* Sección Ocultas: solo en modo Organizar */
    if (conOcultas) {
      for (i = 0; i < ocultas.length; i++) {
        if (byId[ocultas[i]]) { mapa.ocultas.push(byId[ocultas[i]]); }
      }
    }

    var secciones = [], ids = ordenSecciones.slice(0);
    if (conOcultas) { ids.push('ocultas'); }
    for (i = 0; i < ids.length; i++) {
      var sid = ids[i];
      if (!mapa[sid]) { continue; }
      if (sid === 'apps' && mapa.apps.length === 0) { continue; }
      if (sid === 'favoritos' && mapa.favoritos.length === 0) { continue; }
      if (sid === 'entradas' && mapa.entradas.length === 0) { continue; }
      if (sid === 'ocultas' && mapa.ocultas.length === 0) { continue; }
      secciones.push({ id: sid, titulo: TITULOS[sid], items: mapa[sid] });
    }

    return {
      secciones: secciones,
      nuevas: nuevas,
      ocultas: ocultas,
      totalInstaladas: todos.length,
      estadoSync: global.AppCatalogProvider.estado()
    };
  }

  global.VisibleMenu = { componer: componer };
}(typeof window !== 'undefined' ? window : globalThis));
