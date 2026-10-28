/* launcher.js — ADAPTADOR DE LANZAMIENTO (única capa que habla con Luna).
   En la TV usa applicationManager/launch; si no está disponible, informa sin inventar éxito.
   NO probado en la TV: no declarar que abrir apps funciona hasta la prueba presencial. */
(function (global) {
  'use strict';

  var ultimo = null;

  function hayPuente() {
    return !!(global.webOS && global.webOS.service && typeof global.webOS.service.request === 'function');
  }

  /* launch(appId, onOk, onError) */
  function launch(id, onOk, onError) {
    var t0 = (new Date()).getTime();
    if (!id) { if (onError) { onError({ code: 'SIN_ID' }); } return; }

    if (!hayPuente()) {
      ultimo = { id: id, ok: false, motivo: 'sin puente webOS (entorno de escritorio)' };
      if (onError) { onError({ code: 'SIN_PUENTE' }); }
      return;
    }

    try {
      global.webOS.service.request('luna://com.webos.applicationManager', {
        method: 'launch',
        parameters: { id: id },
        onSuccess: function (res) {
          ultimo = { id: id, ok: true, ms: (new Date()).getTime() - t0, res: res };
          if (onOk) { onOk(ultimo); }
        },
        onFailure: function (err) {
          ultimo = { id: id, ok: false, error: (err && (err.errorText || err.errorCode)) || 'error' };
          if (onError) { onError(ultimo); }
        }
      });
    } catch (e) {
      ultimo = { id: id, ok: false, error: String(e && e.message ? e.message : e) };
      if (onError) { onError(ultimo); }
    }
  }

  /* status(appId, cb) → getAppLoadStatus (permitido en esta TV, ya medido) */
  function status(id, cb) {
    if (!hayPuente()) { if (cb) { cb({ id: id, disponible: null, motivo: 'sin puente' }); } return; }
    var respondido = false, espera = setTimeout(function () {
      if (respondido) { return; }
      respondido = true;
      if (cb) { cb({ id: id, disponible: null, error: 'timeout' }); }   /* timeout ≠ desinstalada */
    }, 2500);
    function cerrar(r) { if (respondido) { return; } respondido = true; clearTimeout(espera); if (cb) { cb(r); } }
    try {
      global.webOS.service.request('luna://com.webos.applicationManager', {
        method: 'getAppLoadStatus',
        parameters: { appId: id },
        onSuccess: function (res) {
          cerrar({ id: id, disponible: !!(res && res.exist === true), res: res });
        },
        onFailure: function (err) {
          cerrar({ id: id, disponible: null, error: (err && err.errorText) || 'error' });
        }
      });
    } catch (e) { cerrar({ id: id, disponible: null, error: String(e) }); }
  }

  global.Lanzador = {
    launch: launch, status: status,
    hayPuente: hayPuente,
    ultimo: function () { return ultimo; }
  };
}(typeof window !== 'undefined' ? window : this));
