/* focus.js — GESTIÓN DE FOCO.
   Modelo: lista ordenada de zonas; cada zona es una fila (axis 'x') o columna (axis 'y').
   Reglas: Left/Right dentro de la fila; al llegar a un extremo se pasa a la zona vecina.
   Sin trampas: desde cualquier elemento se puede volver a la barra lateral. */
(function (global) {
  'use strict';

  var zonas = [];      // [{id, axis, items:[el], carril:el|null}]
  var zi = 0, ii = 0;
  var alActivar = null, alMover = null, alSalir = null;

  function registrar(id, opciones) {
    zonas.push({
      id: id,
      axis: opciones.axis || 'x',
      items: opciones.items || [],
      carril: opciones.carril || null
    });
  }

  function limpiar() {
    var i, j, z;
    for (i = 0; i < zonas.length; i++) {
      z = zonas[i];
      for (j = 0; j < z.items.length; j++) { z.items[j].classList.remove('foco'); }
    }
  }

  function desplazarCarril(z) {
    if (!z.carril || !z.items.length) { return; }
    var el = z.items[ii];
    var carril = z.carril;
    var izq = el.offsetLeft;
    var der = izq + el.offsetWidth;
    var visible = carril.parentNode.clientWidth;
    var actual = parseInt(carril.getAttribute('data-x') || '0', 10);
    var nuevo = actual;
    if (izq + actual < 0) { nuevo = -izq; }
    if (der + actual > visible) { nuevo = visible - der; }
    if (nuevo !== actual) {
      carril.setAttribute('data-x', String(nuevo));
      carril.style.transform = 'translateX(' + nuevo + 'px)';
    }
  }

  function pintar() {
    limpiar();
    var z = zonas[zi];
    if (!z || !z.items.length) { return; }
    var el = z.items[ii];
    if (!el) { return; }
    el.classList.add('foco');
    desplazarCarril(z);
    if (alMover) { alMover(z.id, ii, el); }
  }

  function mover(dx, dy) {
    var z = zonas[zi];
    if (!z) { return; }
    if (z.axis === 'y') {
      if (dy !== 0) {
        if (z.circular) {
          /* navegación circular: arriba desde la primera fila lleva al cierre */
          ii = (ii + dy + z.items.length) % z.items.length;
        } else {
          ii = Math.min(Math.max(ii + dy, 0), z.items.length - 1);
        }
      } else if (dx > 0) {
        zi = Math.min(zi + 1, zonas.length - 1); ii = 0;
      } else if (dx < 0) {
        zi = Math.max(zi - 1, 0); ii = 0;
      }
      pintar(); return;
    }

    if (dx !== 0) {
      var siguiente = ii + dx;
      if (siguiente >= 0 && siguiente < z.items.length) { ii = siguiente; pintar(); return; }
      /* extremo de fila → cambiar de zona en la misma dirección */
      var destino = zi + dx;
      if (destino >= 0 && destino < zonas.length) {
        zi = destino;
        /* al entrar por la derecha se conserva la columna; por la izquierda se entra por el final */
        ii = (dx < 0) ? zonas[zi].items.length - 1
                      : Math.min(ii, zonas[zi].items.length - 1);
        pintar();
      }
      return;
    }

    if (dy !== 0) {
      var zd = zi + dy;
      /* la zona 'hero' tiene un único elemento: al bajar se salta a la primera fila */
      if (zd >= 0 && zd < zonas.length) {
        zi = zd;
        ii = Math.min(ii, zonas[zi].items.length - 1);
        pintar();
      }
    }
  }

  function activar() {
    var z = zonas[zi];
    if (!z || !z.items.length) { return; }
    if (alActivar) { alActivar(z.id, ii, z.items[ii]); }
  }

  function focoEn(idZona, indice) {
    var i;
    for (i = 0; i < zonas.length; i++) {
      if (zonas[i].id === idZona) {
        zi = i;
        ii = Math.min(indice || 0, zonas[i].items.length - 1);
        pintar();
        return true;
      }
    }
    return false;
  }

  function actual() {
    var z = zonas[zi];
    return { zona: z ? z.id : null, indice: ii, el: z ? z.items[ii] : null, total: z ? z.items.length : 0 };
  }

  function setZonas(nuevas) { zonas = nuevas; zi = 0; ii = 0; pintar(); }

  global.Foco = {
    registrar: registrar,
    zonas: function () { return zonas; },
    setZonas: setZonas,
    mover: mover,
    activar: activar,
    pintar: pintar,
    actual: actual,
    focoEn: focoEn,
    onActivar: function (fn) { alActivar = fn; },
    onMover: function (fn) { alMover = fn; },
    onSalir: function (fn) { alSalir = fn; }
  };
}(window));
