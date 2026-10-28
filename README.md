# Pikachu Home · Apple TV edition (LG webOS 4)

Launcher para LG webOS 4 (Chromium 53), con **estética Apple TV (tvOS 26)** y la **funcionalidad de Pikachu Home**, incluido el **lanzamiento real de aplicaciones**.

## Lo bueno de tres repositorios

- **Pikachu Home** (`nykroy/Pikachu-home-LG-webos-4`) — foco por flechas, transacciones (organizar/favoritos/ocultar), catálogo (local + SSAP), preferencias, destacado híbrido, ajustes, toast.
- **Hearth** (`rudra-avatar/Hearth`) — lanzamiento real: `luna://com.webos.applicationManager/launch` (grupo público LS2) y `getAppLoadStatus`. Los HDMI se lanzan como apps (`com.webos.app.hdmiN`).
- **cleanyourtv-webOS-4** (`jetpitol`) — estética tvOS 26: dock Liquid Glass, rejilla de apps, Top Shelf con lavado de color, tipografía Inter, fotos de fondo.

## Características

- **Top Shelf** (destacado) con lavado de color ambiental.
- **Dock** inferior de favoritos (iconos 5:3 que se elevan al enfocar).
- **Rejilla** de apps + entradas HDMI.
- **Cabecera** con reloj/fecha y pills (Inputs · Ajustes · Organizar).
- **Navegación** por flechas / OK / BACK con Magic Remote.
- **OK abre la app** (lanzamiento real); **mantener OK** entra en modo Organizar.
- Modo Organizar **transaccional** (Listo guarda · Cancelar/BACK descarta).
- **Compatible Chromium 53** (webOS 4): sin CSS Grid, sin flex `gap`, sin `inset`, sin fuentes variables.

## Estructura

```
appinfo.json      appId com.pikachu.apple
index.html        layout tvOS
css/apple.css     estética Apple TV
js/app.js         orquestación (render + foco + lanzamiento)
js/ui.js          tarjetas + toast + reloj + panel
js/focus.js …     módulos reutilizados de Pikachu Home (foco, txn, catálogo, prefs, …)
fonts/            Inter (subconjunto estático)
wallpapers/       fotos de fondo (Unsplash aerials)
assets/logos/     logos vectoriales (atribución en PROCEDENCIA.json)
```

## Build

```sh
# empaquetar IPK con la CLI de webOS
ares-package com.pikachu.apple -o dist
```

## Licencia

MIT. Los logos y fotos de terceros se atribuyen en `PROCEDENCIA.json` y `wallpapers/CREDITS.txt`.
