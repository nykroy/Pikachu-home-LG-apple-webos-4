# Pikachu Home · Apple TV edition (LG webOS 4)

Launcher para LG webOS 4 (Chromium 53), con estética Apple TV (tvOS 26), la funcionalidad de Pikachu Home y el lanzamiento real de aplicaciones. Sustituye al Home oficial de LG (skin principal) y puede arrancar con la TV.

## Características

- **Top Shelf** (destacado) con lavado de color ambiental.
- **Dock** de favoritos + **rejilla** de apps y entradas HDMI.
- **Cabecera** con reloj/fecha y pills (Inputs · Ajustes · Organizar).
- **Lanzamiento real**: `luna://com.webos.applicationManager/launch` (grupo público LS2) + `getAppLoadStatus`.
- **Listado real de apps** (vía Homebrew Channel, root): `exec` → `listLaunchPoints`.
- **Entradas HDMI** vía `luna://com.webos.service.eim/getAllInputStatus`.
- **Panel de ajustes** con pestañas: Reloj · Tiempo · Fondo · Apps · Opciones.
- **Tiempo** (Open-Meteo): ciudad por búsqueda, °C/°F, máx/mín.
- **Fondos**: Aleatorio / Secuencia / fotos.
- **Texto de inicio personalizable** (Opciones → Texto de inicio).
- **Modo Organizar transaccional** (mantener OK = editar; ✓ Listo guarda; BACK descarta).
- **Splash** para arranque rápido.
- **Compatible Chromium 53**: ES5 puro, sin CSS Grid / flex `gap` / `inset` / fuentes variables.

## Requisitos

- **TV LG con webOS 4.x** (probado en 49SK8500PLA, webOS 4.4.3; funciona también en webOS 3/5 con matices).
- **webOS CLI** (`@webosose/ares-cli`) para empaquetar e instalar: `ares-package`, `ares-install`.
- **Homebrew Channel (root)** para las funciones avanzadas: listado real de apps, iconos, tiempo por curl, **homehook (skin principal)** y **arranque con la TV**.

## Build

Empaquetado simple (18 scripts, para desarrollo):

```sh
ares-package com.pikachu.apple -o dist
```

Empaquetado optimizado (1 solo JS, arranque más rápido):

```sh
cd com.pikachu.apple/js
cat webOSTV.js installed.js cache.js ssap.js homebrew.js catalog.js prefs.js providers.js \
    menu.js launcher.js settings.js icons.js focus.js txn.js ui.js backgrounds.js weather.js app.js \
    > app.bundle.js
# en index.html: sustituir los <script src="js/*.js"> por <script src="js/app.bundle.js">
ares-package com.pikachu.apple -o dist
```

## Instalación

```sh
ares-install --device <nombre_tv> com.pikachu.apple_0.1.0_all.ipk
```

Para actualizar **sin perder configuraciones** (orden, favoritos, texto de inicio), usa `ares-install` normal (sin `--remove`). `--remove` borra el localStorage de la app.

## Autoinicio

La app puede arrancar de tres formas complementarias.

### 1. Skin principal (reemplaza el Home de LG) — homehook

Requiere Homebrew Channel (root). Los scripts están en `homehook/`:

```sh
# copiar los scripts a la TV
scp -r homehook root@<TV_IP>:/media/developer/launcher-homehook/
# registrar en el arranque
ssh root@<TV_IP> "ln -sf /media/developer/launcher-homehook/apply.sh /var/lib/webosbrew/init.d/48-launcher-homehook"
# aplicar (o reinicia la TV)
ssh root@<TV_IP> "sh /media/developer/launcher-homehook/apply.sh"
```

- `apply.sh` arranca el watcher (`watch.sh`).
- `watch.sh` detecta cuando LG Home sale al frente (botón Home, salir de una app con BACK, arranque) y abre el launcher en su lugar. En TVs **sin `com.webos.app.home`** (webOS 3 / algunos 4.x) vigila la barra Home (`NL_HOME_SHOWN`) en `/var/log/messages`.
- El launcher confirma que se abrió tocando `/tmp/launcher-alive` (`markAlive` en `app.js`).
- `diagnose.sh` recolecta información de diagnóstico; `stock.sh` deja ver el Home de LG temporalmente.

Para restaurar el Home de LG:

```sh
ssh root@<TV_IP> "rm /var/lib/webosbrew/init.d/48-launcher-homehook; pkill -f launcher-homehook"
```

### 2. Arrancar con la TV (entrada de TV)

La app se registra como entrada de TV (`EIM addDevice`) en su primer arranque (requiere `supportGIP: true`, ya incluido en `appinfo.json`). Después:

1. En los ajustes de la TV, activa **"Iniciar en la última entrada"**.
2. Elige la entrada **Pikachu Home** una vez.
3. A partir de ahí, la TV arranca directa en la app.

### 3. Ocultar el logo de LG

La app lo hace automáticamente en el primer arranque: `luna://com.webos.settingsservice/setSystemSettings` con `{"category":"other","settings":{"lgLogoDisplay":"off"}}`.

## Estructura

```
appinfo.json      appId com.pikachu.apple · supportGIP · splashBackground
index.html        layout tvOS
css/apple.css     estética Apple TV (Chromium 53-safe)
js/app.js         orquestación (render + foco + lanzamiento + setup)
js/*.js           módulos (foco, txn, catálogo, prefs, proveedores, homebrew, tiempo, fondos…)
homehook/         scripts de skin principal (apply.sh, watch.sh, diagnose.sh, stock.sh, version)
fonts/            Inter (subconjunto estático)
wallpapers/       fotos de fondo (aerial)
assets/logos/     logos vectoriales (atribución en PROCEDENCIA.json)
splash.png        imagen de arranque
```

## Preferencias y persistencia

Orden, favoritos, apps ocultas y texto de inicio se guardan en `localStorage` (clave `pikachu-home-prefs`), con validación y recuperación ante JSON corrupto. Persiste entre apagados; se pierde solo con `ares-install --remove`.

## Licencia

MIT. Los logos y fotos de terceros se atribuyen en `assets/logos/PROCEDENCIA.json` y `wallpapers/CREDITS.txt`. El homehook (`homehook/`) procede del proyecto Hearth (`rudra-avatar/Hearth`).
