/* backgrounds.js — selector de fondo de pantalla (aportación de Hearth).
   Fotos incluidas + «Aleatorio» + «Secuencia» (diapositivas). Sin root: las fotos
   son recursos del paquete pintados por CSS. */
(function (global) {
  'use strict';

  var CLAVE = 'pikachu-fondo';
  var ALEATORIO = 'aleatorio';
  var SECUENCIA = 'secuencia';

  var FOTOS = [
    { id: 'aerial-01', label: 'Aéreo 1', img: 'wallpapers/aerial-01.jpg' },
    { id: 'aerial-02', label: 'Aéreo 2', img: 'wallpapers/aerial-02.jpg' },
    { id: 'aerial-03', label: 'Aéreo 3', img: 'wallpapers/aerial-03.jpg' },
    { id: 'aerial-04', label: 'Aéreo 4', img: 'wallpapers/aerial-04.jpg' },
    { id: 'aerial-05', label: 'Aéreo 5', img: 'wallpapers/aerial-05.jpg' },
    { id: 'aerial-06', label: 'Aéreo 6', img: 'wallpapers/aerial-06.jpg' },
    { id: 'aerial-07', label: 'Aéreo 7', img: 'wallpapers/aerial-07.jpg' },
    { id: 'aerial-08', label: 'Aéreo 8', img: 'wallpapers/aerial-08.jpg' }
  ];

  function actual() {
    var v = null;
    try { v = global.localStorage.getItem(CLAVE); } catch (e) { v = null; }
    return v || ALEATORIO;
  }

  function guardar(id) {
    try { global.localStorage.setItem(CLAVE, id); } catch (e) {}
  }

  function lista() {
    var r = [
      { id: ALEATORIO, label: 'Aleatorio (cada inicio)' },
      { id: SECUENCIA, label: 'Secuencia (diapositivas)' }
    ];
    var i;
    for (i = 0; i < FOTOS.length; i++) { r.push({ id: FOTOS[i].id, label: FOTOS[i].label }); }
    return r;
  }

  function fotoPorId(id) {
    var i;
    for (i = 0; i < FOTOS.length; i++) { if (FOTOS[i].id === id) { return FOTOS[i]; } }
    return FOTOS[0];
  }

  function fotoAleatoria() {
    return FOTOS[Math.floor(Math.random() * FOTOS.length)];
  }

  function fotoSiguiente(id) {
    var i, idx = -1;
    for (i = 0; i < FOTOS.length; i++) { if (FOTOS[i].id === id) { idx = i; break; } }
    return FOTOS[(idx + 1) % FOTOS.length];
  }

  function etiqueta(id) {
    var l = lista(), i;
    for (i = 0; i < l.length; i++) { if (l[i].id === id) { return l[i].label; } }
    return 'Aleatorio';
  }

  global.Backgrounds = {
    ALEATORIO: ALEATORIO, SECUENCIA: SECUENCIA,
    actual: actual, guardar: guardar, lista: lista,
    fotoPorId: fotoPorId, fotoAleatoria: fotoAleatoria, fotoSiguiente: fotoSiguiente,
    etiqueta: etiqueta
  };
}(typeof window !== 'undefined' ? window : globalThis));
