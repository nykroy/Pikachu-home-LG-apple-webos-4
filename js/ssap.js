/* ssap.js — cliente SSAP de Pikachu Home (register + listLaunchPoints).
   Credencial exclusiva de com.pikachu.home · nunca se muestra ni se registra.
   El registro SOLO se lanza desde una acción explícita del usuario. */
(function (global) {
  'use strict';

  var URL_WS = 'ws://127.0.0.1:3000';
  var URI_LP = 'ssap://com.webos.applicationManager/listLaunchPoints';
  var CLAVE_LS = 'pikachu.home.ssap.key';
  var T_REG = 30000;
  var T_CONS = 12000;

  var MANIFIESTO = {
    manifestVersion: 1,
    appVersion: '0.3.0',
    vendor: 'PikachuHome',
    localizedAppNames: { '': 'Pikachu Home' },
    localizedVendorNames: { '': 'Pikachu Home' },
    permissions: ['READ_INSTALLED_APPS']
  };

  var e = { estado: 'DESCONECTADO', detalle: 'sin credencial', enCurso: false, errorLiteral: '' };
  var ws = null, timer = null, t0 = 0;

  function ahora() { return (new Date()).getTime(); }
  function almacen() { try { return global.localStorage; } catch (x) { return null; } }

  function clave() {
    var a = almacen(); if (!a) { return null; }
    var v = null; try { v = a.getItem(CLAVE_LS); } catch (x) { v = null; }
    return (v && v.length > 8) ? v : null;
  }

  function guardarYVerificar(k) {
    var a = almacen(); if (!a || !k) { return false; }
    try { a.setItem(CLAVE_LS, k); } catch (x) { return false; }
    var l = null; try { l = a.getItem(CLAVE_LS); } catch (x2) { l = null; }
    return l === k;
  }

  function borrar() {
    var a = almacen();
    if (!a) { e.estado = 'BORRADO_FALLIDO'; e.detalle = 'sin almacenamiento'; return false; }
    try { a.removeItem(CLAVE_LS); } catch (x) { /* se comprueba */ }
    var resto = null, err = false;
    try { resto = a.getItem(CLAVE_LS); } catch (x2) { err = true; }
    if (err) { e.estado = 'BORRADO_FALLIDO'; e.detalle = 'no se pudo verificar'; return false; }
    if (resto) { e.estado = 'BORRADO_FALLIDO'; e.detalle = 'la credencial sigue presente'; return false; }
    e.estado = 'DESCONECTADO'; e.detalle = 'credencial borrada y verificada';
    return true;
  }

  function limpiar() { if (timer) { global.clearTimeout(timer); timer = null; } }
  function cerrar(m) { if (ws) { try { ws.close(1000, m || 'fin'); } catch (x) { /* ignorado */ } } }

  function redactar(t) {
    if (!t) { return ''; }
    return String(t).replace(/("client-key"\s*:\s*")[^"]*(")/gi, '$1***$2');
  }

  function parsear(evt) {
    var t = ''; try { t = (typeof evt.data === 'string') ? evt.data : ''; } catch (x) { return null; }
    if (!t) { return null; }
    try { return JSON.parse(t); } catch (x2) { return null; }
  }

  /* ---------- registro explícito ---------- */
  function registrar(cb) {
    if (e.enCurso) { return; }
    e.enCurso = true; e.errorLiteral = '';
    e.estado = 'CONECTANDO'; e.detalle = 'abriendo conexión…';
    t0 = ahora();
    try { ws = new global.WebSocket(URL_WS); } catch (err) {
      e.enCurso = false; e.estado = 'ERROR'; e.detalle = 'no se pudo abrir WebSocket';
      if (cb) { cb(false, e); } return;
    }
    timer = global.setTimeout(function () {
      if (!e.enCurso) { return; }
      e.enCurso = false; e.estado = 'SIN_DIALOGO'; e.detalle = 'sin respuesta en ' + T_REG + ' ms';
      cerrar('timeout'); if (cb) { cb(false, e); }
    }, T_REG);

    ws.onopen = function () {
      var k = clave(), payload = { forcePairing: false, pairingType: 'PROMPT', manifest: MANIFIESTO };
      if (k) { payload['client-key'] = k; }
      try {
        ws.send(JSON.stringify({ id: 'reg-1', type: 'register', payload: payload }));
        e.estado = k ? 'REVALIDANDO' : 'ESPERANDO_DIALOGO';
        e.detalle = k ? 'comprobando credencial guardada' : 'acepta el diálogo de LG en el televisor';
      } catch (err2) {
        e.enCurso = false; limpiar(); e.estado = 'ERROR'; e.detalle = 'no se pudo enviar register';
        cerrar('error'); if (cb) { cb(false, e); }
      }
    };

    ws.onmessage = function (evt) {
      var o = parsear(evt);
      if (!o || o.id !== 'reg-1') { return; }
      if (o.type === 'registered') {
        var k = (o.payload && o.payload['client-key']) ? String(o.payload['client-key']) : '';
        e.enCurso = false; limpiar();
        if (!k) { e.estado = 'REGISTRADO_NO_PERSISTIDO'; e.detalle = 'registered sin clave'; }
        else if (!guardarYVerificar(k)) { e.estado = 'REGISTRADO_NO_PERSISTIDO'; e.detalle = 'clave no persistida'; }
        else { e.estado = 'EMPAREJADO_Y_GUARDADO'; e.detalle = 'credencial guardada y verificada'; }
        cerrar('registro');
        if (cb) { cb(e.estado === 'EMPAREJADO_Y_GUARDADO', e); }
        return;
      }
      if (o.type === 'error') {
        var lit = String(o.error || o.errorText || '');
        e.enCurso = false; limpiar(); e.errorLiteral = redactar(lit);
        if (/403|denied|reject|cancel/i.test(lit)) { e.estado = 'RECHAZADO'; }
        else if (/401/.test(lit)) { e.estado = 'CLAVE_INVALIDA'; }
        else { e.estado = 'ERROR'; }
        e.detalle = e.errorLiteral;
        cerrar('error'); if (cb) { cb(false, e); }
      }
    };

    ws.onerror = function () { if (e.enCurso) { e.detalle = 'onerror (se espera cierre)'; } };

    ws.onclose = function (evt) {
      if (e.enCurso) {
        e.enCurso = false; limpiar();
        e.estado = (evt.code === 1008) ? 'ERROR_ORIGEN' : 'TIMEOUT';
        e.detalle = 'cierre ' + evt.code + (evt.reason ? ' · ' + evt.reason : '');
        if (cb) { cb(false, e); }
      }
      ws = null;
    };
  }

  /* ---------- consulta con la credencial guardada ---------- */
  function consultar(cb) {
    if (e.enCurso) { return; }
    var k = clave();
    if (!k) { e.estado = 'DESCONECTADO'; e.detalle = 'sin credencial'; if (cb) { cb(false, null, 'sin credencial', e); } return; }

    e.enCurso = true; e.errorLiteral = '';
    e.estado = 'CONSULTANDO'; e.detalle = 'sesión SSAP con credencial guardada';
    t0 = ahora();
    try { ws = new global.WebSocket(URL_WS); } catch (err) {
      e.enCurso = false; e.estado = 'ERROR'; e.detalle = 'no se pudo abrir WebSocket';
      if (cb) { cb(false, null, 'websocket', e); } return;
    }
    timer = global.setTimeout(function () {
      if (!e.enCurso) { return; }
      e.enCurso = false; e.estado = 'TIMEOUT'; e.detalle = 'sin respuesta en ' + T_CONS + ' ms';
      cerrar('timeout'); if (cb) { cb(false, null, 'timeout', e); }
    }, T_CONS);

    ws.onopen = function () {
      try {
        ws.send(JSON.stringify({ id: 'reg-1', type: 'register',
          payload: { forcePairing: false, pairingType: 'PROMPT', manifest: MANIFIESTO, 'client-key': k } }));
      } catch (err2) { e.enCurso = false; limpiar(); e.estado = 'ERROR'; cerrar('error'); if (cb) { cb(false, null, 'send', e); } }
    };

    ws.onmessage = function (evt) {
      var o = parsear(evt);
      if (!o) { return; }
      if (o.id === 'reg-1') {
        if (o.type === 'error') {
          var lit = String(o.error || '');
          e.enCurso = false; limpiar(); e.errorLiteral = redactar(lit);
          e.estado = /401/.test(lit) ? 'CLAVE_INVALIDA' : 'RECHAZADO'; e.detalle = e.errorLiteral;
          cerrar('sin sesion'); if (cb) { cb(false, null, e.errorLiteral, e); } return;
        }
        if (o.type === 'registered') {
          try { ws.send(JSON.stringify({ id: 'lp-1', type: 'request', uri: URI_LP, payload: {} })); }
          catch (err3) { e.enCurso = false; limpiar(); e.estado = 'ERROR'; cerrar('error'); if (cb) { cb(false, null, 'send lp', e); } }
        }
        return;
      }
      if (o.id !== 'lp-1') { return; }
      e.enCurso = false; limpiar();

      if (o.type === 'error') {
        e.errorLiteral = redactar(String(o.error || ''));
        e.estado = 'ENUMERACION_DENEGADA'; e.detalle = e.errorLiteral;
        cerrar('denegado'); if (cb) { cb(false, null, e.errorLiteral, e); } return;
      }
      if (o.type !== 'response') {
        e.estado = 'LISTA_INVALIDA'; e.detalle = 'tipo inesperado'; cerrar('no response');
        if (cb) { cb(false, null, 'tipo inesperado', e); } return;
      }
      if (o.payload && typeof o.payload.returnValue !== 'undefined' && o.payload.returnValue !== true) {
        e.estado = 'LISTA_INVALIDA'; e.detalle = 'returnValue=' + String(o.payload.returnValue);
        cerrar('rv falso'); if (cb) { cb(false, null, 'returnValue falso', e); } return;
      }
      var lps = o.payload ? o.payload.launchPoints : null;
      if (!lps || Object.prototype.toString.call(lps) !== '[object Array]') {
        e.estado = 'LISTA_INVALIDA'; e.detalle = 'sin array launchPoints'; cerrar('malformada');
        if (cb) { cb(false, null, 'malformada', e); } return;
      }
      var buenos = [], malos = 0, i, id;
      for (i = 0; i < lps.length; i++) {
        id = (lps[i] && typeof (lps[i].appId || lps[i].id) === 'string') ? (lps[i].appId || lps[i].id) : '';
        if (id.length > 0 && id.length <= 128) { buenos.push(lps[i]); } else { malos++; }
      }
      if (malos > 0) {
        e.estado = 'LISTA_INVALIDA'; e.detalle = malos + ' elementos sin id válido';
        cerrar('malformada'); if (cb) { cb(false, buenos, 'elementos sin id', e); } return;
      }
      if (buenos.length === 0) {
        e.estado = 'LISTA_VACIA'; e.detalle = '0 accesos'; cerrar('vacia');
        if (cb) { cb(true, [], null, e); } return;
      }
      e.estado = 'LISTA_OBTENIDA'; e.detalle = buenos.length + ' accesos';
      cerrar('fin'); if (cb) { cb(true, buenos, null, e); }
    };

    ws.onerror = function () { if (e.enCurso) { e.detalle = 'onerror en consulta'; } };
    ws.onclose = function (evt) {
      if (e.enCurso) {
        e.enCurso = false; limpiar();
        e.estado = 'TIMEOUT'; e.detalle = 'cierre ' + evt.code;
        if (cb) { cb(false, null, 'cierre ' + evt.code, e); }
      }
      ws = null;
    };
  }

  global.SondaSsap = {
    registrar: registrar, consultar: consultar, borrar: borrar,
    hayClave: function () { return !!clave(); },
    estado: function () { return e; },
    permisos: function () { return MANIFIESTO.permissions.slice(0); }
  };
}(typeof window !== 'undefined' ? window : this));
