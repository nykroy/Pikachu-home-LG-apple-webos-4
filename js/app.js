/* app.js — ORQUESTACIÓN · Pikachu Home Apple TV edition.
   Layout tvOS: cabecera (reloj + pills) · Top Shelf (destacado) · dock (favoritos) · grid (apps + entradas).
   Reutiliza los módulos de Pikachu Home (Foco, Txn, Catalogo, UserPreferences, VisibleMenu, Lanzador, Ajustes…)
   y añade el lanzamiento real (Lanzador.launch → applicationManager/launch, confirmado por Hearth). */
(function (global) {
  'use strict';

  var doc = global.document;
  var UserPreferences = global.UserPreferences;
  var VisibleMenu = global.VisibleMenu;
  var AppCatalogProvider = global.AppCatalogProvider;
  var UI = global.UI, Foco = global.Foco, Lanzador = global.Lanzador, Ajustes = global.Ajustes;
  var SondaSsap = global.SondaSsap;

  var menu = null;
  var editable = false;
  var sel = { appId: null, seccion: null, indice: null, cogida: false };
  var panelAbierto = false, panelCb = null;
  var timerLargo = null, largoDisparado = false;

  var elToast, elHero, elDock, elGrid;
  var COLS = 5;   /* columnas del grid */
  var WALLPAPERS = ['wallpapers/aerial-01.jpg','wallpapers/aerial-02.jpg','wallpapers/aerial-03.jpg','wallpapers/aerial-04.jpg','wallpapers/aerial-05.jpg','wallpapers/aerial-06.jpg','wallpapers/aerial-07.jpg','wallpapers/aerial-08.jpg'];

  function $(id) { return doc.getElementById(id); }

  /* ---------- fondo ---------- */
  function wallpaper() {
    var el = $('wallpaper'), img = new Image();
    var i = Math.floor(Math.random() * WALLPAPERS.length);
    img.onload = function () { el.style.backgroundImage = 'url("' + WALLPAPERS[i] + '")'; doc.body.className += ' has-wallpaper'; };
    img.src = WALLPAPERS[i];
  }

  /* ---------- reloj ---------- */
  function tic() { UI.reloj($('reloj'), $('fecha'), Ajustes.get('reloj')); }

  /* ---------- sincronización ---------- */
  function sincronizar(manual) {
    AppCatalogProvider.actualizar(function (r) {
      render();
      if (manual) {
        UI.toast(elToast, r && r.ok ? 'Catálogo actualizado · ' + r.total + ' apps' : 'No se pudo actualizar · usando caché');
      }
    });
  }

  /* ---------- render ---------- */
  function render() {
    menu = VisibleMenu.componer(false);
    renderHero();
    renderDock();
    renderGrid();
    registrarZonas();
  }

  function renderHero() {
    var destacado = null;
    var i, s, secciones = menu.secciones || [];
    for (i = 0; i < secciones.length && !destacado; i++) {
      s = secciones[i];
      if (s.id === 'entradas') { continue; }
      if (s.items && s.items.length) { destacado = s.items[0]; }
    }
    $('heroTitle').textContent = destacado ? destacado.nombre : 'Pikachu Home';
    $('heroSub').textContent = destacado ? (destacado.tipo || 'App') + (UserPreferences.esFavorito(destacado.id) ? ' · Favorito' : '') : 'Selecciona una aplicación';
    var art = $('heroArt');
    art.style.backgroundImage = '';
    if (destacado && destacado.c1) { art.style.background = 'linear-gradient(120deg, ' + destacado.c1 + ', ' + (destacado.c2 || destacado.c1) + ')'; }
    elHero.setAttribute('data-id', destacado ? destacado.id : '');
  }

  function renderDock() {
    while (elDock.firstChild) { elDock.removeChild(elDock.firstChild); }
    var fav = (menu.secciones.filter(function (s) { return s.id === 'favoritos'; })[0] || { items: [] }).items;
    var i;
    for (i = 0; i < fav.length; i++) {
      var c = UI.tarjeta(fav[i]);
      c.setAttribute('data-seccion', 'dock');
      elDock.appendChild(c);
    }
  }

  function renderGrid() {
    while (elGrid.firstChild) { elGrid.removeChild(elGrid.firstChild); }
    var apps = [];
    var i, s;
    for (i = 0; i < (menu.secciones || []).length; i++) {
      s = menu.secciones[i];
      if (s.id === 'favoritos') { continue; }
      apps = apps.concat(s.items || []);
    }
    for (i = 0; i < apps.length; i++) {
      var c = UI.tarjeta(apps[i]);
      c.setAttribute('data-seccion', 'grid');
      elGrid.appendChild(c);
    }
  }

  function registrarZonas() {
    var zonas = [];
    var pills = doc.querySelectorAll('#pills .pill');
    if (pills.length) { zonas.push({ id: 'pills', axis: 'x', items: Array.prototype.slice.call(pills) }); }
    zonas.push({ id: 'hero', axis: 'x', items: [$('hero')] });
    var dockCards = elDock.querySelectorAll('.card');
    if (dockCards.length) { zonas.push({ id: 'dock', axis: 'x', items: Array.prototype.slice.call(dockCards) }); }
    /* grid: una zona por fila (cada COLS tarjetas) */
    var gridCards = Array.prototype.slice.call(elGrid.querySelectorAll('.card'));
    var fila = 0, idx = 0, items = [];
    var filas = [];
    for (idx = 0; idx < gridCards.length; idx++) {
      items.push(gridCards[idx]);
      if (items.length === COLS || idx === gridCards.length - 1) {
        filas.push({ id: 'grid-' + fila, axis: 'x', items: items });
        fila++; items = [];
      }
    }
    for (idx = 0; idx < filas.length; idx++) { zonas.push(filas[idx]); }

    if (editable) { zonas.push({ id: 'editbar', axis: 'x', items: Array.prototype.slice.call(doc.querySelectorAll('#editbar .btn-acc')) }); }
    if (panelAbierto) {
      var itemsPanel = Array.prototype.slice.call(doc.querySelectorAll('#opciones li'));
      if ($('btnSalir')) { itemsPanel.push($('btnSalir')); }
      zonas.push({ id: 'panel', axis: 'y', circular: true, items: itemsPanel });
    }
    Foco.setZonas(zonas);
  }

  /* ---------- ambient (lavado de color al enfocar) ---------- */
  function ambientDesde(el) {
    var color = null;
    var card = el;
    if (card && card.getAttribute) {
      var icono = card.querySelector('.icono');
      if (icono && icono.style.color) { color = icono.style.color; }
    }
    var amb = $('ambientB');
    amb.style.background = color ? 'radial-gradient(120% 90% at 50% 100%, ' + color + ' 0%, rgba(0,0,0,0) 70%)' : 'rgba(0,0,0,0)';
    amb.style.opacity = color ? '0.35' : '0';
  }

  /* ---------- lanzar (la funcionalidad que aportó Hearth) ---------- */
  function lanzar(item) {
    if (!item || !item.id) { return; }
    UserPreferences.marcarVisto(item.id);
    Lanzador.launch(item.id, function (r) {
      UI.toast(elToast, 'Abriendo «' + item.nombre + '»' + (r && r.ms ? ' · ' + r.ms + ' ms' : ''));
      render();
    }, function () {
      UI.toast(elToast, 'No se pudo abrir «' + item.nombre + '» · vuelve a Pikachu Home desde su icono');
    });
  }

  /* ---------- modo Organizar (transaccional) ---------- */
  function selValida() { return !!(sel.appId && sel.seccion !== null); }

  function marcarSeleccion(el) {
    var prev = doc.querySelectorAll('.card.sel'), i;
    for (i = 0; i < prev.length; i++) { prev[i].className = String(prev[i].className).replace(' sel', ''); }
    if (el) { el.className = el.className + ' sel'; }
  }

  function textoEstadoEdicion() {
    var caja = $('editbarTxt');
    if (!caja) { return; }
    if (selValida()) {
      caja.textContent = 'Organizar · ' + (sel.appId || '') + ' · posición ' + (sel.indice + 1);
    } else {
      caja.textContent = 'Organizar · OK coge · flechas mueven · Listo guarda · BACK cancela';
    }
  }

  function repintarSeleccion() {
    textoEstadoEdicion();
    if (!editable || !selValida()) { return; }
    var el = doc.querySelector('.card[data-id="' + sel.appId + '"]');
    if (el) { marcarSeleccion(el); }
  }

  function entrarEdicion() {
    if (editable) { return; }
    editable = true;
    sel = { appId: null, seccion: null, indice: null, cogida: false };
    global.Txn.iniciar();
    $('editbar').hidden = false;
    render();
    UI.toast(elToast, 'Organizar: OK sobre una tarjeta para cogerla');
  }

  function salirEdicion(confirmar) {
    if (!editable) { return; }
    if (confirmar) { global.Txn.confirmar(); UI.toast(elToast, 'Organización guardada'); }
    else { global.Txn.descartar(); UI.toast(elToast, 'Cambios descartados · nada se ha guardado'); }
    editable = false;
    sel = { appId: null, seccion: null, indice: null, cogida: false };
    $('editbar').hidden = true;
    render();
    Foco.focoEn('hero', 0);
  }

  function tarjetaEnfocada() {
    var a = Foco.actual();
    if (!a || !a.el || String(a.el.className || '').indexOf('card') < 0) { return null; }
    var sec = a.el.getAttribute('data-seccion') || '';
    return { el: a.el, seccion: sec, indice: a.indice, appId: a.el.getAttribute('data-id') };
  }

  function cogerSoltar() {
    var t = tarjetaEnfocada();
    if (!t) { UI.toast(elToast, 'Ninguna tarjeta seleccionada'); return; }
    if (sel.cogida && sel.appId === t.appId) {
      sel.cogida = false; render(); repintarSeleccion();
      UI.toast(elToast, 'Soltada · Listo guarda los cambios');
      return;
    }
    sel = { appId: t.appId, seccion: t.seccion, indice: t.indice, cogida: true };
    marcarSeleccion(t.el);
    t.el.className = t.el.className + ' cogida';
    textoEstadoEdicion();
    UI.toast(elToast, 'Cogida · flechas para mover · OK confirma · BACK cancela');
  }

  function mover(dir) {
    if (!selValida()) { UI.toast(elToast, 'Selecciona una tarjeta con OK'); return; }
    if (!sel.cogida) { return; }
    var orden = UserPreferences.ordenDe(sel.seccion) || [];
    var sec = (menu.secciones.filter(function (x) { return x.id === sel.seccion; })[0] || { items: [] });
    if (!orden.length) { var k; for (k = 0; k < sec.items.length; k++) { orden.push(sec.items[k].id); } }
    var desde = sel.indice, hacia = desde + dir;
    if (hacia < 0 || hacia >= orden.length) { UI.toast(elToast, 'Límite de la sección'); return; }
    var tmp = orden[desde]; orden.splice(desde, 1); orden.splice(hacia, 0, tmp);
    UserPreferences.fijarOrden(sel.seccion, orden);
    sel.indice = hacia;
    render(); repintarSeleccion();
    Foco.focoEn(sel.seccion === 'dock' ? 'dock' : 'grid-0', sel.indice);
    UI.toast(elToast, 'Movimiento provisional · Listo guarda · BACK cancela');
  }

  function accionEdicion(acc) {
    if (acc === 'listo') { salirEdicion(true); return; }
    if (acc === 'cancelar') { salirEdicion(false); return; }
    if (acc === 'restaurar') { pedirRestaurar(); return; }
    if (acc === 'ocultas') { panelOcultas(); return; }
    if (!selValida()) { UI.toast(elToast, 'Selecciona una tarjeta con OK antes de usar esta acción'); return; }
    var id = sel.appId;
    if (acc === 'mover-izq' || acc === 'mover-der') { mover(acc === 'mover-der' ? 1 : -1); return; }
    if (acc === 'favorito') {
      var fav = UserPreferences.alternarFavorito(id);
      render(); repintarSeleccion();
      UI.toast(elToast, fav ? 'Añadida a Favoritos' : 'Quitada de Favoritos');
      return;
    }
    if (acc === 'ocultar') {
      var oc = UserPreferences.alternarOculto(id);
      render();
      UI.toast(elToast, oc ? 'Oculta (sigue instalada) · recupérala en Ocultas' : 'Visible de nuevo');
      return;
    }
  }

  /* ---------- panel ---------- */
  function abrirPanel(titulo, opciones, cb) {
    $('panelTitulo').textContent = titulo;
    UI.opcionesPanel(opciones);
    panelCb = cb || null;
    panelAbierto = true;
    $('panel').hidden = false;
    registrarZonas();
    Foco.focoEn('panel', 0);
  }

  function cerrarPanel() {
    panelAbierto = false; panelCb = null;
    $('panel').hidden = true;
    registrarZonas();
    Foco.focoEn('hero', 0);
  }

  function pedirRestaurar() {
    abrirPanel('¿Restaurar el orden predeterminado?', [
      { accion: 'si', texto: 'Sí, restaurar' },
      { accion: 'no', texto: 'Cancelar' }
    ], function (r) {
      if (r === 'si') {
        UserPreferences.restaurarDefecto(global.Catalogo.semillaPreferencias());
        cerrarPanel(); render();
        UI.toast(elToast, 'Orden predeterminado restaurado');
      } else { cerrarPanel(); }
    });
  }

  function panelOcultas() {
    var ocultas = UserPreferences.get('ocultas') || [];
    if (!ocultas.length) {
      abrirPanel('Aplicaciones ocultas', [
        { accion: 'nada', texto: 'No hay aplicaciones ocultas', valor: '' },
        { accion: 'cerrar', texto: 'Cerrar', valor: '' }
      ], function (r) { if (r === 'cerrar') { cerrarPanel(); } });
      return;
    }
    var lista = [], i, app;
    for (i = 0; i < ocultas.length; i++) {
      app = global.Catalogo.porId(ocultas[i]);
      lista.push({ accion: 'mostrar:' + ocultas[i], texto: app ? app.nombre : ocultas[i], valor: 'mostrar' });
    }
    lista.push({ accion: 'cerrar', texto: 'Cerrar', valor: '' });
    abrirPanel('Aplicaciones ocultas · OK para restaurar', lista, function (r) {
      if (r === 'cerrar') { cerrarPanel(); return; }
      if (r.indexOf('mostrar:') === 0) {
        UserPreferences.mostrar(r.slice(8));
        cerrarPanel(); render();
        UI.toast(elToast, 'Restaurada · conserva su favorito y su posición');
        if ((UserPreferences.get('ocultas') || []).length) { panelOcultas(); }
      }
    });
  }

  function panelInputs() {
    var ent = (menu.secciones.filter(function (s) { return s.id === 'entradas'; })[0] || { items: [] }).items;
    var lista = [], i;
    for (i = 0; i < ent.length; i++) {
      lista.push({ accion: 'input:' + ent[i].id, texto: ent[i].nombre, valor: 'HDMI' });
    }
    if (!lista.length) { lista.push({ accion: 'nada', texto: 'No hay entradas detectadas', valor: '' }); }
    lista.push({ accion: 'cerrar', texto: 'Cerrar', valor: '' });
    abrirPanel('Entradas (HDMI)', lista, function (r) {
      if (r === 'cerrar') { cerrarPanel(); return; }
      if (r.indexOf('input:') === 0) {
        var id = r.slice(6), app = global.Catalogo.porId(id);
        cerrarPanel();
        lanzar(app || { id: id, nombre: id, tipo: 'entrada' });
      }
    });
  }

  function panelAjustes() {
    abrirPanel('Ajustes y catálogo', [
      { accion: 'reloj', texto: 'Formato de reloj', valor: Ajustes.etiqueta('reloj') },
      { accion: 'tamano', texto: 'Tamaño de tarjetas', valor: Ajustes.etiqueta('tarjetas') },
      { accion: 'animaciones', texto: 'Animaciones', valor: Ajustes.etiqueta('animaciones') },
      { accion: 'actualizar', texto: '⟳ Actualizar aplicaciones', valor: '' },
      { accion: 'proveedor', texto: 'Fuente del catálogo', valor: (AppCatalogProvider.estado() || {}).fuente || 'local' },
      { accion: 'conectar', texto: 'Conectar con esta TV para detectar aplicaciones', valor: SondaSsap.hayClave() ? 'ya conectado' : 'pulsa OK' },
      { accion: 'borrarCredencial', texto: 'Borrar credencial de este televisor', valor: SondaSsap.hayClave() ? 'hay credencial' : 'no hay' },
      { accion: 'restaurar', texto: 'Restaurar orden predeterminado', valor: '' },
      { accion: 'cerrar', texto: 'Cerrar', valor: '' }
    ], null);
  }

  function accionPanel(acc) {
    if (panelCb) { panelCb(acc); return; }
    if (acc === 'cerrar') { cerrarPanel(); return; }
    if (acc === 'reloj') { Ajustes.ciclo('reloj'); tic(); return; }
    if (acc === 'tamano') { Ajustes.ciclo('tarjetas'); aplicar(); render(); return; }
    if (acc === 'animaciones') { Ajustes.ciclo('animaciones'); aplicar(); return; }
    if (acc === 'actualizar') { cerrarPanel(); sincronizar(true); return; }
    if (acc === 'conectar') { cerrarPanel(); conectarTv(); return; }
    if (acc === 'borrarCredencial') { cerrarPanel(); borrarCredencial(); return; }
    if (acc === 'restaurar') { pedirRestaurar(); return; }
  }

  function aplicar() {
    if (Ajustes && Ajustes.aplicar) { Ajustes.aplicar(doc); }
    else {
      doc.body.setAttribute('data-tarjetas', Ajustes.get('tarjetas'));
      doc.body.setAttribute('data-anim', Ajustes.get('animaciones'));
    }
  }

  function conectarTv() {
    UI.toast(elToast, 'Pide permiso en el televisor: acepta el diálogo de LG');
    SondaSsap.registrar(function (ok, est) {
      if (ok) { UI.toast(elToast, 'Conectado · consultando aplicaciones…'); sincronizar(true); }
      else { UI.toast(elToast, 'No conectado: ' + (est && est.estado ? est.estado : 'error')); render(); }
    });
  }

  function borrarCredencial() {
    var ok = SondaSsap.borrar();
    UI.toast(elToast, ok ? 'Credencial borrada y verificada' : 'No se pudo borrar la credencial');
    render();
  }

  /* ---------- salida real (webOS) ---------- */
  function salirApp() {
    try { if (global.webOS && typeof global.webOS.platformBack === 'function') { global.webOS.platformBack(); return; } } catch (e) {}
    try { global.close(); } catch (e) {}
  }

  /* ---------- activación ---------- */
  var ultimaActivacion = 0, ultimoElemento = null;

  function alActivar(zona, i, el) {
    var ahora = new Date().getTime();
    if (el === ultimoElemento && ahora - ultimaActivacion < 300) { return; }
    ultimaActivacion = ahora; ultimoElemento = el;

    if (zona === 'pills') {
      var acc = el.getAttribute('id');
      if (acc === 'btnInputs') { panelInputs(); }
      else if (acc === 'btnSettings') { panelAjustes(); }
      else if (acc === 'btnOrganizar') { entrarEdicion(); }
      return;
    }
    if (zona === 'hero') {
      var hid = el.getAttribute('data-id');
      if (hid) { lanzar(global.Catalogo.porId(hid) || { id: hid, nombre: $('heroTitle').textContent }); }
      return;
    }
    if (zona === 'dock' || zona.indexOf('grid-') === 0) {
      var id = el.getAttribute('data-id');
      if (editable) {
        var secCard = el.getAttribute('data-seccion');
        if (secCard === 'dock') { sel = { appId: id, seccion: 'favoritos', indice: i, cogida: false }; cogerSoltar(); }
        else { sel = { appId: id, seccion: 'apps', indice: i, cogida: false }; cogerSoltar(); }
        return;
      }
      var item = global.Catalogo.porId(id);
      if (item) { lanzar(item); }
      return;
    }
    if (zona === 'editbar') { accionEdicion(el.getAttribute('data-acc')); return; }
    if (zona === 'panel') {
      if (el && el.id === 'btnSalir') { cerrarPanel(); return; }
      accionPanel(el.getAttribute('data-accion'));
      return;
    }
  }

  /* ---------- teclado ---------- */
  function teclas() {
    doc.addEventListener('keydown', function (e) {
      var k = e.keyCode;
      if (k === 37 || k === 38 || k === 39 || k === 40) {
        e.preventDefault();
        if (editable && sel.cogida && (k === 37 || k === 39)) {
          var tf = tarjetaEnfocada();
          if (tf && tf.appId === sel.appId) { mover(k === 39 ? 1 : -1); return; }
        }
        Foco.mover(k === 37 ? -1 : (k === 39 ? 1 : 0), k === 38 ? -1 : (k === 40 ? 1 : 0));
        return;
      }
      if (k === 13) {
        e.preventDefault();
        if (e.repeat) { return; }
        largoDisparado = false;
        global.clearTimeout(timerLargo);
        timerLargo = global.setTimeout(function () { largoDisparado = true; if (!editable) { entrarEdicion(); } }, 650);
        return;
      }
      if (k === 27 || k === 8 || k === 461) {
        e.preventDefault();
        if (panelAbierto) { cerrarPanel(); return; }
        if (editable) { salirEdicion(false); return; }
        salirApp();
      }
    });

    doc.addEventListener('keyup', function (e) {
      if (e.keyCode !== 13) { return; }
      global.clearTimeout(timerLargo);
      if (largoDisparado) { largoDisparado = false; return; }
      Foco.activar();
    });
  }

  /* ---------- arranque ---------- */
  function init() {
    elToast = $('toast'); elHero = $('hero'); elDock = $('dock'); elGrid = $('grid');

    Ajustes.cargar(); aplicar();
    var carga = UserPreferences.cargar();
    if (carga && carga.ok === false) { UI.toast(elToast, 'Preferencias corruptas · se han restaurado'); }
    var semilla = global.Catalogo.semillaPreferencias();
    UserPreferences.sembrarFavoritos(semilla.favoritos);

    Foco.onActivar(alActivar);
    Foco.onMover(function (zona, indice, el) {
      ambientDesde(el);
    });

    $('btnInputs').addEventListener('click', function () { Foco.focoEn('pills', 0); panelInputs(); });
    $('btnSettings').addEventListener('click', function () { panelAjustes(); });
    $('btnOrganizar').addEventListener('click', function () { entrarEdicion(); });
    $('btnSalir').addEventListener('click', function () { cerrarPanel(); });
    var btns = doc.querySelectorAll('#editbar .btn-acc');
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener('click', function () { accionEdicion(b.getAttribute('data-acc')); });
    });

    teclas();
    wallpaper();
    tic();
    global.setInterval(tic, 1000);
    render();
    sincronizar(false);
  }

  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', init); } else { init(); }
}(typeof window !== 'undefined' ? window : globalThis));
