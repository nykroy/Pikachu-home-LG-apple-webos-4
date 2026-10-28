/* settings.js — AJUSTES VISUALES (separados de la presentación).
   Persistencia local opcional; en la TV se guardarán en localStorage de la app. */
(function (global) {
  'use strict';

  var CLAVE = 'pikachu-home-ajustes';
  var valores = {
    tarjetas: 'normal',      // normal | compacta
    animaciones: 'on',       // on | off
    reloj: '24h',            // 24h | 12h
    sidebar: 'on',           // on | off (oculta etiquetas)
    texto: 'grande'          // pequeno | normal | grande
  };

  var opciones = [
    { clave: 'tarjetas',    etiqueta: 'Tamaño de tarjetas', valores: ['normal', 'compacta'] },
    { clave: 'animaciones', etiqueta: 'Animaciones',        valores: ['on', 'off'] },
    { clave: 'reloj',       etiqueta: 'Formato de reloj',   valores: ['24h', '12h'] },
    { clave: 'sidebar',     etiqueta: 'Etiquetas laterales',valores: ['on', 'off'] },
    { clave: 'texto',       etiqueta: 'Tamaño del texto',   valores: ['pequeno', 'normal', 'grande'] }
  ];

  function cargar() {
    try {
      var bruto = global.localStorage && global.localStorage.getItem(CLAVE);
      if (bruto) {
        var obj = JSON.parse(bruto), k;
        for (k in valores) { if (obj[k]) { valores[k] = obj[k]; } }
      }
    } catch (e) { /* sin persistencia: seguimos con los valores por defecto */ }
    return valores;
  }

  function guardar() {
    try {
      if (global.localStorage) { global.localStorage.setItem(CLAVE, JSON.stringify(valores)); }
    } catch (e) { /* ignorado a propósito */ }
  }

  function get(clave) { return valores[clave]; }

  var ETIQUETAS = {
    tarjetas:    { normal: 'Normal', compacta: 'Compacta' },
    animaciones: { on: 'Activadas', off: 'Desactivadas' },
    reloj:       { '24h': '24 h', '12h': '12 h' },
    sidebar:     { on: 'Visibles', off: 'Ocultas' },
    texto:       { pequeno: 'Pequeño', normal: 'Normal', grande: 'Grande' }
  };

  function mostrar(clave, valor) {
    return (ETIQUETAS[clave] && ETIQUETAS[clave][valor]) || valor;
  }

  function alternar(clave) {
    var i, def = null;
    for (i = 0; i < opciones.length; i++) { if (opciones[i].clave === clave) { def = opciones[i]; } }
    if (!def) { return; }
    var pos = def.valores.indexOf(valores[clave]);
    valores[clave] = def.valores[(pos + 1) % def.valores.length];
    guardar();
  }

  /* Los ajustes se aplican con ATRIBUTOS que el CSS sí entiende. */
  function aplicar(doc) {
    var cuerpo = doc.body;
    cuerpo.setAttribute('data-tarjetas', valores.tarjetas);
    cuerpo.setAttribute('data-anim', valores.animaciones === 'off' ? 'off' : 'on');
    cuerpo.setAttribute('data-sidebar', valores.sidebar);
    cuerpo.setAttribute('data-texto', valores.texto);
  }

  function ciclo(clave) {
    var i, def = null;
    for (i = 0; i < opciones.length; i++) { if (opciones[i].clave === clave) { def = opciones[i]; } }
    if (!def) { return null; }
    var pos = def.valores.indexOf(valores[clave]);
    valores[clave] = def.valores[(pos + 1) % def.valores.length];
    guardar();
    return valores[clave];
  }

  function etiqueta(clave) { return mostrar(clave, valores[clave]); }

  global.Ajustes = {
    ciclo: ciclo, etiqueta: etiqueta,
    cargar: cargar, get: get, alternar: alternar, aplicar: aplicar, mostrar: mostrar,
    opciones: function () { return opciones.slice(); },
    valores: function () { return valores; }
  };
}(window));
