/* icons.js — AppIconResolver.
   Orden: 1) icono del catálogo real (SSAP) si es accesible · 2) icono local legítimo
          3) respaldo gráfico · 4) inicial (último recurso).
   Compatible Chromium 53: sin IntersectionObserver ni loading=lazy; cola manual. */
(function (global) {
  'use strict';

  /* Iconos locales con procedencia documentada en assets/logos/PROCEDENCIA.json */
  var LOCALES = {
    'com.webos.app.netflix': { src: 'assets/logos/netflix.svg', tipo: 'logo' },
    'com.webos.app.disney': { src: 'assets/logos/disneyplus.svg', tipo: 'logo', placa: true },
    'com.webos.app.prime': { src: 'assets/logos/primevideo.svg', tipo: 'logo' },
    'youtube.leanback.v4': { src: 'assets/logos/youtube.svg', tipo: 'logo', placa: true },
    'org.webosbrew.hbchannel': { src: 'assets/logos/homebrew.svg', tipo: 'icono' }
  };

  /* Solo rutas locales del paquete o http(s)/file. Nada de javascript: ni data: enormes. */
  function srcSeguro(u) {
    if (typeof u !== 'string' || !u) { return null; }
    if (/^assets\/[A-Za-z0-9._\/-]+$/.test(u)) { return u; }
    if (/^https?:\/\/[^\s"'<>]+$/.test(u)) { return u; }
    if (/^file:\/\/[^\s"'<>]+$/.test(u)) { return u; }
    return null;
  }

  /* Resuelve qué mostrar para una app del catálogo. */
  function resolver(app) {
    var cand = app && (app.iconUrl || app.icon || app.iconPath);
    var s = srcSeguro(cand);
    if (s) { return { modo: 'imagen', src: s, tipo: 'icono', origen: 'catalogo' }; }

    if (app && LOCALES[app.id]) {
      var L = LOCALES[app.id];
      return { modo: 'imagen', src: L.src, tipo: L.tipo, origen: 'local', placa: !!L.placa };
    }
    return { modo: 'respaldo', origen: 'respaldo' };
  }

  /* Crea el nodo visual: imagen con respaldo ante error, o respaldo gráfico. */
  function nodo(app, opts) {
    var o = opts || {};
    var doc = global.document;
    var cont = doc.createElement('div');
    cont.className = 'arte' + (o.grande ? ' grande' : '');
    var r = resolver(app);

    if (r.modo === 'imagen') {
      var img = doc.createElement('img');
      img.className = (r.tipo === 'logo') ? 'logo' : 'icono';
      img.alt = String(app.nombre || '');
      img.setAttribute('data-origen', r.origen);
      if (r.placa) { cont.className = cont.className + ' placa'; }
      img.onerror = function () {
        cont.removeChild(img);
        cont.appendChild(respaldo(app));
      };
      var src = r.src;
      if (o.diferida) { img.setAttribute('data-src', src); }   /* carga diferida */
      else { img.src = src; }
      cont.appendChild(img);
      return cont;
    }
    cont.appendChild(respaldo(app));
    return cont;
  }

  /* Respaldo gráfico: degradado + inicial (nunca el logotipo falso de una marca). */
  function respaldo(app) {
    var doc = global.document;
    var v = (global.UI && global.UI.visual) ? global.UI.visual(app || {}) : { c1: '#2b5cff', c2: '#0b2b8a', glyph: '?' };
    var d = doc.createElement('div');
    d.className = 'respaldo';
    d.style.background = 'linear-gradient(135deg,' + v.c1 + ' 0%,' + v.c2 + ' 100%)';
    var g = doc.createElement('span');
    g.className = 'inicial';
    g.textContent = v.glyph;
    d.appendChild(g);
    return d;
  }

  /* Carga diferida: activa las imágenes con data-src de un contenedor (o una tarjeta). */
  function activar(raiz) {
    if (!raiz || !raiz.querySelectorAll) { return 0; }
    var imgs = raiz.querySelectorAll('img[data-src]'), i = 0, n = 0, s;
    for (i = 0; i < imgs.length; i++) {
      s = imgs[i].getAttribute('data-src');
      if (s) { imgs[i].removeAttribute('data-src'); imgs[i].src = s; n++; }
    }
    return n;
  }

  /* Carga inmediata de las N primeras de cada fila (lo visible al abrir). */
  function cargarVisibles(contenedor, porFila) {
    var limite = porFila || 6;
    var filas = contenedor.querySelectorAll('.carril'), i, cards, j;
    for (i = 0; i < filas.length; i++) {
      cards = filas[i].querySelectorAll('.card');
      for (j = 0; j < cards.length && j < limite; j++) { activar(cards[j]); }
    }
  }

  global.AppIconResolver = {
    resolver: resolver, nodo: nodo, respaldo: respaldo,
    activar: activar, cargarVisibles: cargarVisibles,
    locales: function () { return LOCALES; },
    srcSeguro: srcSeguro
  };
}(typeof window !== 'undefined' ? window : this));
