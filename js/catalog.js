/* catalog.js — catálogo local mínimo de Pikachu Home (tiendas).
   El catálogo real llega por SSAP o por CatalogCache. */
(function (global) {
  'use strict';

  var SEMILLA = [
    { id: 'com.webos.app.lgstore', nombre: 'LG Content Store', tipo: 'tienda',
      c1: '#c81d4a', c2: '#7d0d2c', glyph: 'LG', candidato: true },
    { id: 'org.webosbrew.hbchannel', nombre: 'Homebrew Channel', tipo: 'tienda',
      c1: '#2b5cff', c2: '#0b2b8a', glyph: 'HB', candidato: false }
  ];

  function semilla() {
    var out = [], i, s;
    for (i = 0; i < SEMILLA.length; i++) {
      s = SEMILLA[i];
      out.push({ id: s.id, appId: s.id, launchPointId: '', nombre: s.nombre, tipo: s.tipo,
                 c1: s.c1, c2: s.c2, glyph: s.glyph, fuente: 'local', candidato: !!s.candidato });
    }
    return out;
  }

  function porId(id) {
    var i;
    for (i = 0; i < SEMILLA.length; i++) {
      if (SEMILLA[i].id === id) {
        return { id: SEMILLA[i].id, nombre: SEMILLA[i].nombre, tipo: SEMILLA[i].tipo,
                 c1: SEMILLA[i].c1, c2: SEMILLA[i].c2, glyph: SEMILLA[i].glyph };
      }
    }
    return null;
  }

  function semillaPreferencias() {
    return { favoritos: [], secciones: ['favoritos', 'apps', 'entradas'] };
  }

  global.Catalogo = {
    semilla: semilla, porId: porId, semillaPreferencias: semillaPreferencias,
    tiendas: function () { return SEMILLA.slice(); },
    origen: 'local-minimo'
  };
}(typeof window !== 'undefined' ? window : this));
