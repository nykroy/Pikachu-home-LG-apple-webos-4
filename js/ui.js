/* ui.js — UI mínima para Pikachu Home · Apple TV edition (ES5, Chromium 53). */
(function (global) {
  'use strict';
  var doc = global.document;

  /* tarjeta(item) → elemento .card con icono (glyph) y nombre */
  function tarjeta(item) {
    var card = doc.createElement('div');
    card.className = 'card';
    card.setAttribute('data-id', String(item.id || ''));
    card.setAttribute('data-tipo', String(item.tipo || ''));

    var icono = doc.createElement('div');
    icono.className = 'icono';
    if (item.iconUrl) {
      var img = doc.createElement('img');
      img.className = 'icono-img';
      img.src = item.iconUrl;
      img.alt = '';
      icono.appendChild(img);
    } else {
      icono.textContent = item.glyph || (item.nombre ? item.nombre.charAt(0).toUpperCase() : '?');
      if (item.c1) { icono.style.color = item.c1; }
    }
    card.appendChild(icono);

    var nombre = doc.createElement('div');
    nombre.className = 'nombre';
    nombre.textContent = String(item.nombre || item.id || '');
    card.appendChild(nombre);

    return card;
  }

  /* toast(el, texto, ms) — visible con .visible; cancela temporizadores previos */
  function toast(el, texto, ms) {
    if (!el) { return; }
    if (el._t) { global.clearTimeout(el._t); el._t = null; }
    el.textContent = String(texto || '');
    el.hidden = false;
    void el.offsetWidth;
    el.classList.add('visible');
    var d = (typeof ms === 'number') ? ms : 4000;
    el._t = global.setTimeout(function () {
      el.classList.remove('visible');
      el._t = global.setTimeout(function () { el.hidden = true; el._t = null; }, 220);
    }, d);
  }

  /* reloj(relojEl, fechaEl, modo) */
  function reloj(relojEl, fechaEl, modo) {
    var d = new Date();
    var hh = d.getHours(), mm = d.getMinutes();
    var txt;
    if (modo === '12h') {
      var ap = hh >= 12 ? 'PM' : 'AM';
      var h12 = hh % 12; if (h12 === 0) { h12 = 12; }
      txt = h12 + ':' + (mm < 10 ? '0' + mm : mm) + ' ' + ap;
    } else {
      txt = (hh < 10 ? '0' + hh : hh) + ':' + (mm < 10 ? '0' + mm : mm);
    }
    if (relojEl) { relojEl.textContent = txt; }
    if (fechaEl) {
      var dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      var meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      fechaEl.textContent = dias[d.getDay()] + ', ' + d.getDate() + ' de ' + meses[d.getMonth()];
    }
  }

  /* opcionesPanel(lista) → rellena #opciones */
  function opcionesPanel(lista) {
    var cont = doc.getElementById('opciones');
    while (cont.firstChild) { cont.removeChild(cont.firstChild); }
    var i, li, t, v;
    for (i = 0; i < lista.length; i++) {
      li = doc.createElement('li');
      li.setAttribute('data-accion', String(lista[i].accion || ''));
      t = doc.createElement('span');
      t.className = 'op-txt';
      t.textContent = String(lista[i].texto || '');
      v = doc.createElement('span');
      v.className = 'op-val';
      v.textContent = String(lista[i].valor === undefined ? '' : lista[i].valor);
      li.appendChild(t); li.appendChild(v);
      cont.appendChild(li);
    }
  }

  function valorPanel(accion, texto) {
    var li = doc.querySelector('#opciones li[data-accion="' + accion + '"] .op-val');
    if (li) { li.textContent = String(texto === undefined ? '' : texto); }
  }

  global.UI = { tarjeta: tarjeta, toast: toast, reloj: reloj, opcionesPanel: opcionesPanel, valorPanel: valorPanel };
}(typeof window !== 'undefined' ? window : globalThis));
