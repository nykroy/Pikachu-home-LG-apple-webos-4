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
  var Backgrounds = global.Backgrounds;
  var Weather = global.Weather;

  var menu = null;
  var editable = false;
  var sel = { appId: null, seccion: null, indice: null, cogida: false };
  var panelAbierto = false, panelCb = null, panelTabs = false;
  var tabIdx = 0, enCambioTab = false;
  var TABS = ['reloj', 'tiempo', 'fondo', 'apps', 'opciones'];
  var modoBuscador = 'ciudad';
  var timerLargo = null, largoDisparado = false;

  var elToast, elHero, elDock, elGrid;
  var COLS = 5;   /* columnas del grid */
  var fondoId = null, fotoId = null, timerFondo = null;

  function $(id) { return doc.getElementById(id); }
  function buscarApp(id) { return global.InstalledApps.buscar(id) || global.Catalogo.porId(id); }

  function textoInicio() { return UserPreferences.get('textoInicio') || 'Pikachu Home'; }
  function labelSeguro(s) { var v = String(s).replace(/[^0-9A-Za-z ÁÉÍÓÚáéíóúÑñÜü.,!?()+-]/g, '').trim().slice(0, 30); return v || 'Pikachu Home'; }

  /* ---------- fondo ---------- */
  function setWallpaper(url) {
    var el = $('wallpaper'), img = new Image();
    img.onload = function () { el.style.backgroundImage = 'url("' + url + '")'; doc.body.className += ' has-wallpaper'; };
    img.src = url;
  }

  function aplicarFondo(id) {
    fondoId = id;
    global.clearInterval(timerFondo);
    if (id === Backgrounds.SECUENCIA) {
      fotoId = Backgrounds.fotoPorId('aerial-01').id;
      setWallpaper(Backgrounds.fotoPorId(fotoId).img);
      timerFondo = global.setInterval(function () {
        fotoId = Backgrounds.fotoSiguiente(fotoId).id;
        setWallpaper(Backgrounds.fotoPorId(fotoId).img);
      }, 15000);
    } else if (id === Backgrounds.ALEATORIO) {
      setWallpaper(Backgrounds.fotoAleatoria().img);
    } else {
      fotoId = id;
      setWallpaper(Backgrounds.fotoPorId(id).img);
    }
  }

  /* ---------- reloj ---------- */
  function tic() { UI.reloj($('reloj'), $('fecha'), Ajustes.get('reloj')); }

  /* ---------- tiempo (Open-Meteo) ---------- */
  function pintarTiempo(datos) {
    var el = $('weather');
    if (!datos) { el.hidden = true; return; }
    var c = Weather.config();
    var v = Weather.vista(datos, c);
    var txt = v.main;
    if (v.rango) { txt += ' · ' + v.rango; }
    txt += ' · ' + v.ciudad;
    el.textContent = txt;
    el.hidden = false;
  }

  function actualizarTiempo() {
    var c = Weather.config();
    var el = $('weather');
    if (!c.on) { el.hidden = true; return; }
    var cache = Weather.leeCache();
    var ahora = Date.now();
    if (cache && (ahora - cache.at) < 30 * 60 * 1000) { pintarTiempo(cache); return; }
    if (cache) { pintarTiempo(cache); }
    Weather.actualizar(function (datos) { if (datos) { pintarTiempo(datos); } });
  }

  /* ---------- aviso al watcher del homehook (reemplazo de LG Home) ---------- */
  function markAlive() {
    if (!global.Homebrew || !global.Homebrew.hayPuente()) { return; }
    global.Homebrew.exec("touch /tmp/launcher-alive", function () {});
    global.Homebrew.exec("( nohup sh -c 'sleep 1; touch /tmp/launcher-alive; sleep 1; touch /tmp/launcher-alive' >/dev/null 2>&1 </dev/null & )", function () {});
  }

  /* ---------- configuración de sistema (una vez): entrada de TV + ocultar logo LG ---------- */
  function configurarSistema() {
    if (!global.Homebrew || !global.Homebrew.hayPuente()) { return; }
    var ya;
    try { ya = global.localStorage.getItem('pikachu-setup'); } catch (e) { ya = null; }
    if (ya === '1') { return; }
    var L = labelSeguro(textoInicio());
    /* Añadir Pikachu Home como entrada de TV + conmutar a ella + ocultar logo LG (con log de verificación) */
    global.Homebrew.exec("echo '[addDevice]' > /tmp/pikachu-setup.log; SEND=luna-send-pub; command -v luna-send-pub >/dev/null 2>&1 || SEND=luna-send; $SEND -n 1 luna://com.webos.service.eim/addDevice '{\"appId\":\"com.pikachu.apple\",\"pigImage\":\"\",\"mvpdIcon\":\"\",\"label\":\"" + L + "\",\"description\":\"" + L + "\"}' >> /tmp/pikachu-setup.log 2>&1; echo >> /tmp/pikachu-setup.log; echo '[getAllInputStatus]' >> /tmp/pikachu-setup.log; $SEND -n 1 luna://com.webos.service.eim/getAllInputStatus '{}' >> /tmp/pikachu-setup.log 2>&1; echo >> /tmp/pikachu-setup.log; echo '[setDeviceState]' >> /tmp/pikachu-setup.log; $SEND -n 1 luna://com.webos.service.eim/setDeviceState '{\"deviceId\":\"com.pikachu.apple\",\"state\":\"ON\"}' >> /tmp/pikachu-setup.log 2>&1; echo >> /tmp/pikachu-setup.log; echo '[setLogo]' >> /tmp/pikachu-setup.log; luna-send -n 1 -f luna://com.webos.settingsservice/setSystemSettings '{\"category\":\"other\",\"settings\":{\"lgLogoDisplay\":\"off\"}}' >> /tmp/pikachu-setup.log 2>&1", function () {});
    try { global.localStorage.setItem('pikachu-setup', '1'); } catch (e) {}
  }

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
    $('heroTitle').textContent = destacado ? destacado.nombre : textoInicio();
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
    if (panelAbierto) {
      /* panel modal: solo pestañas + opciones (el foco no se escapa al grid) */
      if (panelTabs) {
        var tabs = doc.querySelectorAll('#tabs .tab');
        if (tabs.length) { zonas.push({ id: 'tabs', axis: 'x', items: Array.prototype.slice.call(tabs) }); }
      }
      var itemsPanel = Array.prototype.slice.call(doc.querySelectorAll('#opciones li'));
      zonas.push({ id: 'panel', axis: 'y', circular: false, items: itemsPanel });
    } else {
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

  /* ---------- scroll: revela el elemento enfocado dentro de su contenedor desplazable ---------- */
  function revelar(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') { return; }
    var cont = el.parentNode;
    while (cont && cont !== doc.body && cont !== doc.documentElement) {
      if (cont.scrollHeight > cont.clientHeight + 1) {
        var r = el.getBoundingClientRect();
        var c = cont.getBoundingClientRect();
        var top = r.top - c.top + cont.scrollTop;
        var bottom = top + r.height;
        var pad = 28;
        if (top < cont.scrollTop) { cont.scrollTop = top - pad; }
        else if (bottom > cont.scrollTop + cont.clientHeight) { cont.scrollTop = bottom - cont.clientHeight + pad; }
        return;
      }
      cont = cont.parentNode;
    }
  }

  /* ---------- top shelf: el destacado sigue al foco ---------- */
  function actualizarHeroDesdeCard(el) {
    var id = el && el.getAttribute ? el.getAttribute('data-id') : '';
    if (!id) { return; }
    var item = buscarApp(id);
    if (!item) { return; }
    $('heroTitle').textContent = item.nombre || id;
    var sub = (item.tipo === 'entrada' ? 'Entrada' : (item.tipo === 'tienda' ? 'Tienda' : 'App'));
    if (UserPreferences.esFavorito(id)) { sub += ' · Favorito'; }
    $('heroSub').textContent = sub;
    var art = $('heroArt');
    if (item.c1) { art.style.background = 'linear-gradient(120deg, ' + item.c1 + ', ' + (item.c2 || item.c1) + ')'; }
    else if (item.iconUrl) { art.style.background = 'center / cover no-repeat url("' + item.iconUrl + '")'; }
    else { art.style.background = ''; }
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
    sel = { appId: null, seccion: null, indice: null };
    global.Txn.iniciar();
    $('editbar').hidden = false;
    render();
    UI.toast(elToast, 'Organizar: OK sobre una tarjeta abre su menú');
  }

  function salirEdicion(confirmar) {
    if (!editable) { return; }
    if (confirmar) { global.Txn.confirmar(); UI.toast(elToast, 'Organización guardada'); }
    else { global.Txn.descartar(); UI.toast(elToast, 'Cambios descartados · nada se ha guardado'); }
    editable = false;
    sel = { appId: null, seccion: null, indice: null };
    $('editbar').hidden = true;
    render();
    Foco.focoEn('hero', 0);
  }

  function abrirMenuApp() {
    var id = sel.appId;
    var ocultas = UserPreferences.get('ocultas') || [];
    var esFav = UserPreferences.esFavorito(id);
    var esOc = ocultas.indexOf(id) >= 0;
    abrirPanelLista([
      { accion: 'fav', texto: esFav ? 'Quitar de Favoritos' : 'Añadir a Favoritos', valor: esFav ? '★' : '☆' },
      { accion: 'ocultar', texto: esOc ? 'Mostrar' : 'Ocultar', valor: '' },
      { accion: 'moverI', texto: 'Mover ◀', valor: '' },
      { accion: 'moverD', texto: 'Mover ▶', valor: '' },
      { accion: 'cerrar', texto: 'Cerrar', valor: '' }
    ], function (r) {
      if (r === 'cerrar') { cerrarPanel(); return; }
      if (r === 'fav') {
        var fav = UserPreferences.alternarFavorito(id);
        cerrarPanel(); render();
        UI.toast(elToast, fav ? 'Añadida a Favoritos' : 'Quitada de Favoritos');
        return;
      }
      if (r === 'ocultar') {
        var oc = UserPreferences.alternarOculto(id);
        cerrarPanel(); render();
        UI.toast(elToast, oc ? 'Oculta · recupérala en Ocultas' : 'Visible de nuevo');
        return;
      }
      if (r === 'moverI') { moverApp(-1); return; }
      if (r === 'moverD') { moverApp(1); return; }
    });
  }

  function moverApp(dir) {
    if (!sel.appId || !sel.seccion) { return; }
    var orden = UserPreferences.ordenDe(sel.seccion) || [];
    var sec = (menu.secciones.filter(function (x) { return x.id === sel.seccion; })[0] || { items: [] });
    if (!orden.length) { var k; for (k = 0; k < sec.items.length; k++) { orden.push(sec.items[k].id); } }
    var desde = orden.indexOf(sel.appId);
    var hacia = desde + dir;
    if (hacia < 0 || hacia >= orden.length) { UI.toast(elToast, 'Límite de la sección'); return; }
    orden.splice(desde, 1); orden.splice(hacia, 0, sel.appId);
    UserPreferences.fijarOrden(sel.seccion, orden);
    /* mantiene el menú abierto y el foco en la misma opción, para mover varias veces seguidas */
    var a = Foco.actual();
    var idxMenu = (a && a.zona === 'panel') ? a.indice : 0;
    render();
    Foco.focoEn('panel', Math.min(idxMenu, doc.querySelectorAll('#opciones li').length - 1));
    /* el grid sigue a la app movida para que se vea dónde queda */
    var card = doc.querySelector('.card[data-id="' + sel.appId + '"]');
    if (card) { revelar(card); }
    UI.toast(elToast, 'Movido · Listo guarda · Cancelar descarta');
  }

  function accionEdicion(acc) {
    if (acc === 'listo') { salirEdicion(true); return; }
    if (acc === 'cancelar') { salirEdicion(false); return; }
    if (acc === 'textoInicio') { editarTextoInicio(); return; }
    if (acc === 'restaurar') { pedirRestaurar(); return; }
    if (acc === 'ocultas') { panelOcultas(); return; }
  }

  /* ---------- panel (pestañas + lista simple) ---------- */
  var panelOpciones = null;

  function renderTabs() {
    var cont = $('tabs');
    while (cont.firstChild) { cont.removeChild(cont.firstChild); }
    var nombres = { reloj: 'Reloj', tiempo: 'Tiempo', fondo: 'Fondo', apps: 'Apps', opciones: 'Opciones' };
    var i;
    for (i = 0; i < TABS.length; i++) {
      var b = doc.createElement('button');
      b.className = 'tab';
      b.type = 'button';
      b.setAttribute('data-idx', String(i));
      b.textContent = nombres[TABS[i]] || TABS[i];
      cont.appendChild(b);
    }
  }

  function opcionesDeTab(tab) {
    var i, c, lista;
    if (tab === 'reloj') {
      return [{ accion: 'reloj', texto: 'Formato de reloj', valor: Ajustes.etiqueta('reloj') }];
    }
    if (tab === 'tiempo') {
      c = Weather.config();
      return [
        { accion: 'tiempoOn', texto: 'Mostrar tiempo', valor: c.on ? 'Sí' : 'No' },
        { accion: 'ciudad', texto: 'Ciudad', valor: c.ciudad.name },
        { accion: 'buscarCiudad', texto: 'Buscar ciudad…', valor: 'escribir' },
        { accion: 'unidad', texto: 'Unidad', valor: c.unidad === 'f' ? 'Fahrenheit' : 'Celsius' },
        { accion: 'rango', texto: 'Máx. y mín.', valor: c.rango ? 'Sí' : 'No' }
      ];
    }
    if (tab === 'fondo') {
      lista = [];
      var fondos = Backgrounds.lista();
      for (i = 0; i < fondos.length; i++) {
        lista.push({ accion: 'fondo:' + fondos[i].id, texto: fondos[i].label, valor: fondos[i].id === Backgrounds.actual() ? '✓' : '' });
      }
      return lista;
    }
    if (tab === 'apps') {
      return [
        { accion: 'actualizar', texto: 'Actualizar aplicaciones', valor: '' },
        { accion: 'proveedor', texto: 'Fuente del catálogo', valor: (AppCatalogProvider.estado() || {}).fuente || 'local' },
        { accion: 'conectar', texto: 'Conectar con esta TV', valor: SondaSsap.hayClave() ? 'conectado' : 'pulsa OK' },
        { accion: 'borrarCredencial', texto: 'Borrar credencial', valor: SondaSsap.hayClave() ? 'hay' : 'no hay' }
      ];
    }
    return [
      { accion: 'tamano', texto: 'Tamaño de tarjetas', valor: Ajustes.etiqueta('tarjetas') },
      { accion: 'animaciones', texto: 'Animaciones', valor: Ajustes.etiqueta('animaciones') },
      { accion: 'textoInicio', texto: 'Texto de inicio', valor: textoInicio() },
      { accion: 'restaurar', texto: 'Restaurar orden predeterminado', valor: '' }
    ];
  }

  function renderOpciones() {
    var opciones = panelTabs ? opcionesDeTab(TABS[tabIdx]) : (panelOpciones || []);
    UI.opcionesPanel(opciones);
  }

  function abrirPanelTabs() {
    panelTabs = true; panelCb = null; panelAbierto = true;
    tabIdx = 0;
    $('tabs').hidden = false;
    $('buscador').hidden = true;
    $('opciones').hidden = false;
    $('panel').hidden = false;
    renderTabs();
    renderOpciones();
    registrarZonas();
    Foco.focoEn('tabs', 0);
  }

  function abrirPanelLista(opciones, cb) {
    panelTabs = false; panelCb = cb || null; panelAbierto = true;
    panelOpciones = opciones;
    $('tabs').hidden = true;
    $('buscador').hidden = true;
    $('opciones').hidden = false;
    $('panel').hidden = false;
    renderOpciones();
    registrarZonas();
    Foco.focoEn('panel', 0);
  }

  function cambiarTab(idx) {
    tabIdx = idx;
    enCambioTab = true;
    renderOpciones();
    registrarZonas();
    Foco.focoEn('tabs', idx);
    enCambioTab = false;
  }

  function refreshPanel() {
    var a = Foco.actual();
    var idx = a && a.indice ? a.indice : 0;
    enCambioTab = true;
    renderOpciones();
    registrarZonas();
    var n = doc.querySelectorAll('#opciones li').length;
    Foco.focoEn('panel', Math.min(idx, n - 1));
    enCambioTab = false;
  }

  var resultadosBusqueda = null;

  function buscarCiudad() {
    modoBuscador = 'ciudad';
    $('tabs').hidden = true;
    $('buscador').hidden = false;
    $('opciones').hidden = true;
    var inp = $('buscarInput');
    inp.value = '';
    inp.focus();
  }

  function volverAlTab(idx) {
    panelTabs = true; panelCb = null;
    tabIdx = idx;
    modoBuscador = 'ciudad';
    $('tabs').hidden = false;
    $('buscador').hidden = true;
    $('opciones').hidden = false;
    renderTabs();
    renderOpciones();
    registrarZonas();
    Foco.focoEn('tabs', tabIdx);
  }
  function volverATiempo() { volverAlTab(1); }

  function ejecutarBusqueda(q) {
    UI.toast(elToast, 'Buscando «' + q + '»…');
    Weather.buscar(q, function (ciudades) {
      if (!ciudades.length) {
        UI.toast(elToast, 'Sin resultados para «' + q + '» · prueba otro nombre');
        return;
      }
      resultadosBusqueda = ciudades;
      var lista = [], i, c;
      for (i = 0; i < ciudades.length; i++) {
        c = ciudades[i];
        lista.push({ accion: 'sel:' + i, texto: c.name + (c.detail ? ' · ' + c.detail : ''), valor: '' });
      }
      lista.push({ accion: 'cerrar', texto: 'Cerrar', valor: '' });
      $('buscador').hidden = true;
      abrirPanelLista(lista, function (r) {
        if (r === 'cerrar') { volverATiempo(); return; }
        if (r.indexOf('sel:') === 0) {
          var idx = parseInt(r.slice(4), 10);
          var cc = Weather.config();
          cc.ciudad = resultadosBusqueda[idx];
          Weather.guardarConfig(cc);
          actualizarTiempo();
          volverATiempo();
        }
      });
    });
  }

  function editarTextoInicio() {
    modoBuscador = 'texto';
    $('tabs').hidden = true;
    $('buscador').hidden = false;
    $('opciones').hidden = true;
    var inp = $('buscarInput');
    inp.value = textoInicio();
    inp.placeholder = 'Escribe el texto de inicio…';
    inp.focus();
  }

  function guardarTextoInicio(q) {
    var v = UserPreferences.fijarTextoInicio(q);
    $('greeting').textContent = v;
    aplicarTextoInicio();
    UI.toast(elToast, 'Texto de inicio: «' + v + '»');
    volverAlTab(TABS.indexOf('opciones'));
  }

  function aplicarTextoInicio() {
    if (!global.Homebrew || !global.Homebrew.hayPuente()) { return; }
    var L = labelSeguro(textoInicio());
    global.Homebrew.exec("SEND=luna-send-pub; command -v luna-send-pub >/dev/null 2>&1 || SEND=luna-send; $SEND -n 1 luna://com.webos.service.eim/addDevice '{\"appId\":\"com.pikachu.apple\",\"pigImage\":\"\",\"mvpdIcon\":\"\",\"label\":\"" + L + "\",\"description\":\"" + L + "\"}\'", function () {});
  }

  function cerrarPanel() {
    panelAbierto = false; panelCb = null;
    $('panel').hidden = true;
    registrarZonas();
    Foco.focoEn(editable ? 'editbar' : 'hero', 0);
  }

  function pedirRestaurar() {
    abrirPanelLista([
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
      abrirPanelLista([
        { accion: 'nada', texto: 'No hay aplicaciones ocultas', valor: '' },
        { accion: 'cerrar', texto: 'Cerrar', valor: '' }
      ], function (r) { if (r === 'cerrar') { cerrarPanel(); } });
      return;
    }
    var lista = [], i, app;
    for (i = 0; i < ocultas.length; i++) {
      app = buscarApp(ocultas[i]);
      lista.push({ accion: 'mostrar:' + ocultas[i], texto: app ? app.nombre : ocultas[i], valor: 'mostrar' });
    }
    lista.push({ accion: 'cerrar', texto: 'Cerrar', valor: '' });
    abrirPanelLista(lista, function (r) {
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
    abrirPanelLista(lista, function (r) {
      if (r === 'cerrar') { cerrarPanel(); return; }
      if (r.indexOf('input:') === 0) {
        var id = r.slice(6), app = buscarApp(id);
        cerrarPanel();
        lanzar(app || { id: id, nombre: id, tipo: 'entrada' });
      }
    });
  }

  function panelAjustes() { abrirPanelTabs(); }

  function accionPanel(acc) {
    if (panelCb) { panelCb(acc); return; }
    if (acc === 'cerrar') { cerrarPanel(); return; }

    if (acc === 'reloj') { Ajustes.ciclo('reloj'); tic(); UI.valorPanel('reloj', Ajustes.etiqueta('reloj')); return; }
    if (acc === 'tamano') { Ajustes.ciclo('tarjetas'); aplicar(); UI.valorPanel('tamano', Ajustes.etiqueta('tarjetas')); return; }
    if (acc === 'animaciones') { Ajustes.ciclo('animaciones'); aplicar(); UI.valorPanel('animaciones', Ajustes.etiqueta('animaciones')); return; }

    if (acc === 'tiempoOn') { var c = Weather.config(); c.on = !c.on; Weather.guardarConfig(c); actualizarTiempo(); UI.valorPanel('tiempoOn', c.on ? 'Sí' : 'No'); return; }
    if (acc === 'buscarCiudad') { buscarCiudad(); return; }
    if (acc === 'ciudad') {
      var cc = Weather.config();
      var ciudades = Weather.CIUDADES, idx = -1, i;
      for (i = 0; i < ciudades.length; i++) { if (ciudades[i].name === cc.ciudad.name) { idx = i; break; } }
      idx = (idx + 1) % ciudades.length;
      cc.ciudad = ciudades[idx];
      Weather.guardarConfig(cc);
      actualizarTiempo();
      UI.valorPanel('ciudad', cc.ciudad.name);
      return;
    }
    if (acc === 'unidad') { var cu = Weather.config(); cu.unidad = cu.unidad === 'f' ? 'c' : 'f'; Weather.guardarConfig(cu); actualizarTiempo(); UI.valorPanel('unidad', cu.unidad === 'f' ? 'Fahrenheit' : 'Celsius'); return; }
    if (acc === 'rango') { var cr = Weather.config(); cr.rango = !cr.rango; Weather.guardarConfig(cr); actualizarTiempo(); UI.valorPanel('rango', cr.rango ? 'Sí' : 'No'); return; }

    if (acc.indexOf('fondo:') === 0) {
      var fid = acc.slice(6);
      Backgrounds.guardar(fid);
      aplicarFondo(fid);
      refreshPanel();
      UI.toast(elToast, 'Fondo: ' + Backgrounds.etiqueta(fid));
      return;
    }

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
      if (hid) { lanzar(buscarApp(hid) || { id: hid, nombre: $('heroTitle').textContent }); }
      return;
    }
    if (zona === 'dock' || zona.indexOf('grid-') === 0) {
      var id = el.getAttribute('data-id');
      if (editable) {
        var secCard = el.getAttribute('data-seccion');
        sel = { appId: id, seccion: secCard === 'dock' ? 'favoritos' : 'apps', indice: i };
        abrirMenuApp();
        return;
      }
      var item = buscarApp(id);
      if (item) { lanzar(item); }
      return;
    }
    if (zona === 'editbar') { accionEdicion(el.getAttribute('data-acc')); return; }
    if (zona === 'tabs') {
      var idxTab = parseInt(el.getAttribute('data-idx'), 10);
      if (idxTab !== tabIdx) { cambiarTab(idxTab); }
      Foco.focoEn('panel', 0);
      return;
    }
    if (zona === 'panel') {
      accionPanel(el.getAttribute('data-accion'));
      return;
    }
  }

  /* ---------- teclado ---------- */
  function teclas() {
    doc.addEventListener('keydown', function (e) {
      var k = e.keyCode;
      if (doc.activeElement && doc.activeElement.id === 'buscarInput') { return; }
      if (k === 37 || k === 38 || k === 39 || k === 40) {
        e.preventDefault();
        if (panelAbierto && panelTabs && k === 38) {
          var a = Foco.actual();
          if (a.zona === 'panel' && a.indice === 0) { Foco.focoEn('tabs', tabIdx); return; }
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
    $('greeting').textContent = textoInicio();
    if (carga && carga.ok === false) { UI.toast(elToast, 'Preferencias corruptas · se han restaurado'); }
    var semilla = global.Catalogo.semillaPreferencias();
    UserPreferences.sembrarFavoritos(semilla.favoritos);

    Foco.onActivar(alActivar);
    Foco.onMover(function (zona, indice, el) {
      if (enCambioTab) { return; }
      ambientDesde(el);
      revelar(el);
      if (zona === 'tabs') {
        var idxTab = parseInt(el.getAttribute('data-idx'), 10);
        if (idxTab !== tabIdx) { cambiarTab(idxTab); }
      } else if (el && (zona === 'dock' || zona.indexOf('grid-') === 0)) {
        actualizarHeroDesdeCard(el);
      }
    });
    global.onCatalogIcons = render;

    $('btnInputs').addEventListener('click', function () { Foco.focoEn('pills', 0); panelInputs(); });
    $('btnSettings').addEventListener('click', function () { panelAjustes(); });
    $('btnOrganizar').addEventListener('click', function () { entrarEdicion(); });
    $('buscarInput').addEventListener('keydown', function (e) {
      if (e.keyCode === 13) {
        e.preventDefault();
        var q = $('buscarInput').value;
        if (modoBuscador === 'texto') { guardarTextoInicio(q); }
        else if (q.trim().length >= 2) { ejecutarBusqueda(q.trim()); }
      }
    });
    var btns = doc.querySelectorAll('#editbar .btn-acc');
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener('click', function () { accionEdicion(b.getAttribute('data-acc')); });
    });

    teclas();
    aplicarFondo(Backgrounds.actual());
    tic();
    global.setInterval(tic, 1000);
    actualizarTiempo();
    global.setInterval(actualizarTiempo, 30 * 60 * 1000);
    render();
    sincronizar(false);
    markAlive();
    configurarSistema();
  }

  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', init); } else { init(); }
}(typeof window !== 'undefined' ? window : globalThis));
