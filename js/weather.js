/* weather.js — Tiempo (aportación de Hearth): Open-Meteo, gratis y sin cuenta.
   Temperatura, condiciones, máx/mín. Caché 30 min (no espera a internet). */
(function (global) {
  'use strict';

  var CLAVE_CONFIG = 'pikachu-tiempo';
  var CLAVE_CACHE = 'pikachu-tiempo-cache';
  var FRESH_MS = 30 * 60 * 1000;
  var SHOWN_MS = 6 * 60 * 60 * 1000;

  var CIUDADES = [
    { name: 'Madrid', lat: 40.4168, lon: -3.7038, detail: 'España' },
    { name: 'Barcelona', lat: 41.3874, lon: 2.1686, detail: 'España' },
    { name: 'Valencia', lat: 39.4699, lon: -0.3763, detail: 'España' },
    { name: 'Sevilla', lat: 37.3891, lon: -5.9845, detail: 'España' },
    { name: 'Bilbao', lat: 43.2630, lon: -2.9350, detail: 'España' },
    { name: 'Zaragoza', lat: 41.6488, lon: -0.8891, detail: 'España' },
    { name: 'Málaga', lat: 36.7213, lon: -4.4214, detail: 'España' },
    { name: 'Murcia', lat: 37.9922, lon: -1.1307, detail: 'España' },
    { name: 'Granada', lat: 37.1773, lon: -3.5986, detail: 'España' },
    { name: 'A Coruña', lat: 43.3623, lon: -8.4115, detail: 'España' },
    { name: 'Vigo', lat: 42.2406, lon: -8.7207, detail: 'España' },
    { name: 'Valladolid', lat: 41.6523, lon: -4.7245, detail: 'España' },
    { name: 'San Sebastián', lat: 43.3183, lon: -1.9812, detail: 'España' },
    { name: 'Santander', lat: 43.4623, lon: -3.8100, detail: 'España' },
    { name: 'Oviedo', lat: 43.3603, lon: -5.8448, detail: 'España' },
    { name: 'Alicante', lat: 38.3452, lon: -0.4810, detail: 'España' },
    { name: 'Cádiz', lat: 36.5271, lon: -6.2886, detail: 'España' },
    { name: 'Palma', lat: 39.5696, lon: 2.6502, detail: 'España' },
    { name: 'Las Palmas', lat: 28.1235, lon: -15.4363, detail: 'España' },
    { name: 'Tenerife', lat: 28.4636, lon: -16.2518, detail: 'España' },
    { name: 'Lisboa', lat: 38.7223, lon: -9.1393, detail: 'Portugal' },
    { name: 'Londres', lat: 51.5074, lon: -0.1278, detail: 'Reino Unido' },
    { name: 'París', lat: 48.8566, lon: 2.3522, detail: 'Francia' },
    { name: 'Nueva York', lat: 40.7128, lon: -74.0060, detail: 'EE. UU.' },
    { name: 'Roma', lat: 41.9028, lon: 12.4964, detail: 'Italia' },
    { name: 'Berlín', lat: 52.5200, lon: 13.4050, detail: 'Alemania' }
  ];

  function num(x) { return (typeof x === 'number' && isFinite(x)) ? x : null; }
  function coord(n) { return (Math.round(n * 1000) / 1000).toFixed(3); }

  function forecastUrl(lat, lon) {
    return 'https://api.open-meteo.com/v1/forecast?latitude=' + coord(lat) + '&longitude=' + coord(lon) +
      '&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto';
  }
  function geocodeUrl(q) {
    return 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(String(q).trim().slice(0, 60)) + '&count=8&language=es&format=json';
  }

  /* WMO code → texto + tipo de icono */
  function describir(code, isDay) {
    if (code === 0) { return { texto: 'Despejado', icono: isDay ? 'sol' : 'luna' }; }
    if (code === 1) { return { texto: 'Mayormente despejado', icono: isDay ? 'sol' : 'luna' }; }
    if (code === 2) { return { texto: 'Parcialmente nublado', icono: 'parcial' }; }
    if (code === 3) { return { texto: 'Nublado', icono: 'nube' }; }
    if (code === 45 || code === 48) { return { texto: 'Niebla', icono: 'niebla' }; }
    if (code >= 51 && code <= 57) { return { texto: 'Llovizna', icono: 'lluvia' }; }
    if (code >= 61 && code <= 67) { return { texto: 'Lluvia', icono: 'lluvia' }; }
    if (code >= 71 && code <= 77) { return { texto: 'Nieve', icono: 'nieve' }; }
    if (code >= 80 && code <= 82) { return { texto: 'Chubascos', icono: 'lluvia' }; }
    if (code === 85 || code === 86) { return { texto: 'Nevadas', icono: 'nieve' }; }
    if (code >= 95) { return { texto: 'Tormenta', icono: 'tormenta' }; }
    return { texto: 'Nublado', icono: 'nube' };
  }

  function formatear(celsius, unidad) {
    var v = (unidad === 'f') ? celsius * 9 / 5 + 32 : celsius;
    var r = Math.round(v);
    return (r === 0 ? 0 : r) + '°';
  }

  function parsear(json) {
    var data;
    try { data = JSON.parse(json); } catch (e) { return null; }
    var cur = data && data.current;
    var temp = cur ? num(cur.temperature_2m) : null;
    var code = cur ? num(cur.weather_code) : null;
    if (temp === null || code === null) { return null; }
    var daily = data.daily || {};
    var primero = function (l) { return (Array.isArray(l) ? num(l[0]) : null); };
    return {
      tempC: temp, highC: primero(daily.temperature_2m_max), lowC: primero(daily.temperature_2m_min),
      code: code, isDay: cur.is_day !== 0, at: Date.now()
    };
  }

  function config() {
    var c = { on: true, ciudad: CIUDADES[0], unidad: 'c', rango: true };
    try {
      var s = global.localStorage.getItem(CLAVE_CONFIG);
      if (s) { c = JSON.parse(s); }
    } catch (e) {}
    if (!c || !c.ciudad) { c = { on: true, ciudad: CIUDADES[0], unidad: 'c', rango: true }; }
    if (!c.unidad) { c.unidad = 'c'; }
    if (c.rango === undefined) { c.rango = true; }
    return c;
  }

  function guardarConfig(c) {
    try { global.localStorage.setItem(CLAVE_CONFIG, JSON.stringify(c)); } catch (e) {}
  }

  function leeCache() {
    try {
      var s = global.localStorage.getItem(CLAVE_CACHE);
      if (!s) { return null; }
      var d = JSON.parse(s);
      if (num(d.tempC) === null || num(d.code) === null) { return null; }
      return d;
    } catch (e) { return null; }
  }

  /* texto de la URL: curl vía Homebrew primero (fiable en webOS 4 con TLS viejo) y XHR de respaldo */
  function viaXHR(url, cb) {
    var hecho = false;
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.timeout = 10000;
    x.onload = function () {
      if (hecho) { return; } hecho = true;
      if (x.status >= 200 && x.status < 300) { cb(true, x.responseText); } else { cb(false, ''); }
    };
    x.onerror = function () { if (hecho) { return; } hecho = true; cb(false, ''); };
    x.ontimeout = function () { if (hecho) { return; } hecho = true; cb(false, ''); };
    x.send();
  }

  function fetchText(url, cb) {
    var hecho = false;
    function responder(ok, txt) { if (!hecho) { hecho = true; cb(ok, txt); } }
    if (global.Homebrew && global.Homebrew.hayPuente()) {
      var comando = "curl -s -m 15 '" + url + "' || curl -sk -m 15 '" + url + "' || wget -qO- -T 15 '" + url + "' || wget -qO- -T 15 --no-check-certificate '" + url + "'";
      global.Homebrew.exec(comando, function (ok, out) {
        if (ok && out) { responder(true, out); return; }
        viaXHR(url, responder);
      });
      return;
    }
    viaXHR(url, responder);
  }

  /* cb(datosWeather | null). Si está desactivado o falla → null. */
  function actualizar(cb) {
    var c = config();
    if (!c || !c.on) { if (cb) { cb(null); } return; }
    fetchText(forecastUrl(c.ciudad.lat, c.ciudad.lon), function (ok, txt) {
      if (!ok || !txt) { if (cb) { cb(null); } return; }
      var d = parsear(txt);
      if (!d) { if (cb) { cb(null); } return; }
      try { global.localStorage.setItem(CLAVE_CACHE, JSON.stringify(d)); } catch (e) {}
      if (cb) { cb(d); }
    });
  }

  /* vista de lectura: {main, rango, ciudad} */
  function vista(d, c) {
    var dd = describir(d.code, d.isDay);
    var main = formatear(d.tempC, c.unidad) + ' ' + dd.texto;
    var rango = (c.rango && d.highC !== null && d.lowC !== null) ? 'H ' + formatear(d.highC, c.unidad) + ' · L ' + formatear(d.lowC, c.unidad) : '';
    return { main: main, rango: rango, ciudad: c.ciudad.name, icono: dd.icono };
  }

  /* búsqueda de ciudades por nombre: cb([ciudades]) */
  function normalizarTexto(s) {
    return String(s || '')
      .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function buscar(query, cb) {
    var q = normalizarTexto(query);
    if (q.length < 2) { if (cb) { cb([]); } return; }
    fetchText(geocodeUrl(q), function (ok, txt) {
      var out = [];
      if (ok && txt) {
        try {
          var data = JSON.parse(txt);
          var list = (data && Array.isArray(data.results)) ? data.results : [];
          var i, r;
          for (i = 0; i < list.length; i++) {
            r = list[i];
            if (typeof r.name !== 'string') { continue; }
            if (!(typeof r.latitude === 'number' && typeof r.longitude === 'number')) { continue; }
            var det = (typeof r.country === 'string' && r.country) ? r.country : ((typeof r.admin1 === 'string' && r.admin1) ? r.admin1 : '');
            out.push({ name: r.name, lat: r.latitude, lon: r.longitude, detail: det });
          }
        } catch (e) { out = []; }
      }
      if (cb) { cb(out); }
    });
  }

  global.Weather = {
    CIUDADES: CIUDADES,
    config: config, guardarConfig: guardarConfig,
    actualizar: actualizar, vista: vista, leeCache: leeCache,
    describir: describir, formatear: formatear, buscar: buscar,
    forecastUrl: forecastUrl, geocodeUrl: geocodeUrl
  };
}(typeof window !== 'undefined' ? window : globalThis));
