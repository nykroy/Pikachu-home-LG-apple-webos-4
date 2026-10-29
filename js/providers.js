/* providers.js — catálogo de Pikachu Home.
   Fuentes: SSAP registrado (real) → CatalogCache → catálogo local (tiendas).
   Reglas: nunca escribe preferencias; nunca declara "desinstalada" por ausencia. */
(function (global) {
  'use strict';

  var ultimo = { ok: false, fuente: 'local', total: 0, ts: null, error: '' };

  /* launch point → app de menú. Conserva launchPointId, appId y tipo. */
  /* SSAP devuelve 'input', 'app', 'bookmark'… → se normaliza a app/entrada/tienda */
  function normalizarTipo(lp) {
    var t = '';
    if (typeof lp.launchPointType === 'string') { t = lp.launchPointType; }
    else if (typeof lp.type === 'string') { t = lp.type; }
    t = String(t || 'app').toLowerCase();
    if (t.indexOf('input') === 0 || t.indexOf('hdmi') === 0 || t === 'entrada' || t === 'externalinput') { return 'entrada'; }
    if (t.indexOf('store') >= 0 || t.indexOf('premium') >= 0 || t.indexOf('tienda') >= 0) { return 'tienda'; }
    return 'app';
  }

  /* Conserva el icono si viene del catálogo y su esquema es seguro. */
  function iconoDe(lp) {
    var cand = lp.icon || lp.iconPath || lp.iconUrl || lp.largeIcon || (lp.images && (lp.images.icon || lp.images.largeIcon));
    if (typeof cand !== 'string' || !cand) { return ''; }
    if (global.AppIconResolver && global.AppIconResolver.srcSeguro) {
      return global.AppIconResolver.srcSeguro(cand) || '';
    }
    return '';
  }

  function mapear(lp) {
    var appId = (typeof lp.appId === 'string') ? lp.appId : '';
    var lpId = (typeof lp.id === 'string') ? lp.id : (typeof lp.launchPointId === 'string' ? lp.launchPointId : '');
    var id = appId || lpId;
    return {
      id: id,
      appId: appId,
      launchPointId: lpId,
      nombre: (typeof lp.title === 'string' && lp.title) ? lp.title : id,
      tipo: normalizarTipo(lp),
      fuente: 'ssap',
      iconUrl: iconoDe(lp)
    };
  }

  function aplicar(apps, fuente, ok, error, ts, cachePrevio) {
    /* Línea base: memoria de la sesión o, si venimos de arranque, la última caché válida. */
    var antesIds = global.InstalledApps.ids();
    if (antesIds.length === 0) {
      var cPrev = cachePrevio || global.CatalogCache.leer();
      if (cPrev && cPrev.apps) {
        var ip;
        for (ip = 0; ip < cPrev.apps.length; ip++) { antesIds.push(cPrev.apps[ip].id); }
      }
    }

    global.InstalledApps.setAll(apps);

    var ahoraIds = global.InstalledApps.ids();
    var setAntes = {}, setAhora = {}, i, id, altas = [], bajas = [];
    for (i = 0; i < antesIds.length; i++) { setAntes[antesIds[i]] = true; }
    for (i = 0; i < ahoraIds.length; i++) { setAhora[ahoraIds[i]] = true; }
    for (i = 0; i < ahoraIds.length; i++) { if (!setAntes[ahoraIds[i]]) { altas.push(ahoraIds[i]); } }
    for (i = 0; i < antesIds.length; i++) { if (!setAhora[antesIds[i]]) { bajas.push(antesIds[i]); } }

    if (antesIds.length > 0) {
      if (altas.length) { global.UserPreferences.marcarNuevas(altas); }
      if (bajas.length) { global.UserPreferences.marcarNoDisponibles(bajas); }
    }
    ultimo = { ok: !!ok, fuente: fuente, total: apps.length, ts: ts || (new Date()).getTime(),
               error: error || '', altas: altas.length, bajas: bajas.length };
    return ultimo;
  }

  function desdeCache(error) {
    var c = global.CatalogCache.leer();
    if (c) { return aplicar(c.apps, 'cache', false, error, c.ts); }
    return aplicar(global.Catalogo.semilla(), 'local', false, error, null);
  }

  /* Sincronización: Homebrew (root, listado real) → SSAP → caché → local. */
  function sincronizar(cb) {
    var cachePrevio = global.CatalogCache.leer();
    if (global.Homebrew && global.Homebrew.hayPuente()) {
      global.Homebrew.listar(function (ok, apps, err) {
        if (!ok || !apps.length) { sincronizarSsap(cb, cachePrevio); return; }
        global.Homebrew.listarEntradas(function (okE, entradas) {
          var todos = apps.slice();
          if (okE && entradas) { todos = todos.concat(entradas); }
          aplicar(todos, 'homebrew', true, '', null, cachePrevio);
          global.CatalogCache.guardar(todos);
          global.Homebrew.cargarIconos(apps, function (icons) {
            var i, cambio = false;
            for (i = 0; i < apps.length; i++) {
              if (icons[apps[i].id] && global.InstalledApps.marcarIcono(apps[i].id, icons[apps[i].id])) { cambio = true; }
            }
            if (cambio && global.onCatalogIcons) { global.onCatalogIcons(); }
          });
          if (cb) { cb(ultimo); }
        });
      });
      return;
    }
    sincronizarSsap(cb, cachePrevio);
  }

  function sincronizarSsap(cb, cachePrevio) {
    if (!global.SondaSsap || !global.SondaSsap.hayClave()) {
      var r = desdeCache('sin credencial');
      if (cb) { cb(r); }
      return;
    }
    global.SondaSsap.consultar(function (ok, lps, err) {
      var res;
      if (ok && lps) {
        var apps = [], i;
        for (i = 0; i < lps.length; i++) { apps.push(mapear(lps[i])); }
        res = aplicar(apps, 'ssap', true, '', null, cachePrevio);
        global.CatalogCache.guardar(apps);
      } else {
        res = desdeCache(err || 'fallo SSAP');
      }
      if (cb) { cb(res); }
    });
  }

  /* Disponibilidad de IDs conocidos (getAppLoadStatus). No bloquea el render.
     Un error NO significa "desinstalada": se deja disponible = null. */
  function comprobarDisponibilidad(ids, cb) {
    var L = global.Lanzador;
    if (!L || typeof L.status !== 'function' || !L.hayPuente || !L.hayPuente()) {
      if (cb) { cb({ comprobadas: 0, motivo: 'sin puente webOS' }); }
      return;
    }
    var lista = (ids || []).slice(0, 12), i = 0, res = { comprobadas: 0, ausentes: [], errores: 0 };
    function siguiente() {
      if (i >= lista.length) { if (cb) { cb(res); } return; }
      var id = lista[i++];
      L.status(id, function (r) {
        res.comprobadas++;
        if (r && r.disponible === false) {
          res.ausentes.push(id);
          global.InstalledApps.marcarDisponible(id, false);
        } else if (r && r.disponible === true) {
          global.InstalledApps.marcarDisponible(id, true);
        } else {
          res.errores++;                 /* error de API o timeout: NO es baja */
          global.InstalledApps.marcarDisponible(id, null);
        }
        siguiente();
      });
    }
    siguiente();
  }

  global.AppCatalogProvider = {
    comprobarDisponibilidad: comprobarDisponibilidad,
    sincronizar: sincronizar,
    actualizar: sincronizar,
    getApps: sincronizar,
    estado: function () { return ultimo; },
    mapear: mapear
  };
}(typeof window !== 'undefined' ? window : this));
