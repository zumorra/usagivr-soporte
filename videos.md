# Videos por problema (YouTube) cruzados con lo que dice r/SlimeVR

Elegidos 2026-10-21. Regla: si el manual de USAGIVR contradice a Reddit, manda el manual
(p. ej. Classic Fat/Mini se configuran APAGADOS por USB; Revo ICM/BNO085 ENCENDIDOS).
Los dos videos que enlaza el manual (XrO8tsAp0CY, 7-T8woEs-hY) ya no existen; reemplazados abajo.

| Problema | Video EN | Video ES | Lo que lo arregla según Reddit (y manual) |
|---|---|---|---|
| Primera configuración / WiFi | SkfdraicN5s (guía oficial 0.14.1), JrHmNcckpuE (parte 2) | GjvZ-U0kcME (VRMods Chile) | 2.4 GHz, canal 1-11, solo WPA2, SSID sin caracteres raros; router nuevo = volver a meter credenciales por USB; tras apagón reiniciar router; router de proveedor → router extra solo para trackers |
| Conecta al WiFi pero no aparece en SlimeVR | JrHmNcckpuE | mPhr7zGiWD4 (VRMods, dudas y errores) | Red de Windows en Privada, firewall.bat como admin, sin VPN ni red de invitados, una sola instancia del servidor |
| Smol / dongle: emparejar | HaldUGryrf4 (Usagi VR: sync), 7pbRoWnJOwA (dongle explicado) | — | `pair` en receptor y tracker, reiniciar ambos, mover el tracker para que aparezca |
| Smol en Android / Quest | Odnf4u6ZgsY (Usagi VR) | — | — |
| Apagar un Smol | RR7D159j7zQ (short Usagi VR) | — | — |
| No enciende | — | — | Cargar 20+ min, reiniciar (apagar/encender), probar a encender cargando, otro cable; si nunca enciende → humano |
| Nuevos que no conectan | SkfdraicN5s | GjvZ-U0kcME | Reiniciar tracker y router; cargado+encendido (o apagado si es Classic) al enchufar; cable de datos |
| Correas / montaje firme | aM0jXEYQAeY (Erimel mounting + reset), AHj_B-HoWmU (pecho/cadera firme) | — | Muslo justo encima de la rodilla con correa con silicona; correa corta → elástica con hebilla tri-glide. **Video propio de correas: PENDIENTE de Yuki** |
| Arnés de pecho + cadera | qTvXIpdCwS8 (ZRock35) | — | — |
| Colocación | aM0jXEYQAeY + dibujos del manual (págs. 30-33) | — | Botón y USB-C arriba; pecho y muslos al frente; tobillos al costado (arreglo pág. 12) |
| Calibración por sesión | SYqfQdVseF4 (ZRock35), NLy9-gjybtg (Snitchie) | mPhr7zGiWD4 | Dejar quietos en el suelo 2 min → Automatic Mounting → Calibrate FBT VRChat → Full Reset; pies a 10 cm |
| Proporciones del cuerpo | PTFV9hJa4DE (Dean Ravencrest) | — | Altura igual en SlimeVR y VRChat |
| Drift | On8_1hrW7_g (Jacobfov), SYudOrEzBzg (Spazzwan) | — | Quietos 10-15 s al encender; intercambiar tracker para ver si es él; firmware nuevo + Stay Aligned; lejos de muelles/metal |
| Calibración 6 caras | UmgGd9O-rn4 (Adamant IT, recomendado en Reddit), wuktCL0t57k (Smol) | — | Llevarlos 20 min puestos antes; consola serie |
| Pies inclinados / se hunden | V5IOa8falJM (DJ VRChat) | — | Skating correction + Floor clip |
| Piernas se cruzan / giran | aM0jXEYQAeY | — | Tobillo al costado, manual mounting, Yaw reset al sentarse |
| Quest standalone (OSC) | NSsoi9bfH0I (ZRock35, en el manual), IbD9YwQ1wds (Mysticle) | — | OSC Trackers con la IP del Quest |
| Router para trackers | GwSuEpIWDyE | — | Router barato en modo AP solo para trackers |
| Reparación física | OxOgkBMEzME | — | Extensión de pie: apagar y meter a fondo; batería → humano |

Enlace: https://youtu.be/<id>

## Videos del propio Discord (categoría «Trackers info and Know Errors» y canales de videos)

Revisados cuadro a cuadro y transcritos el 2026-11-18. Se enlazan por mensaje
(`https://discord.com/channels/1318716973072252970/<canal>/<mensaje>`) porque los enlaces del CDN caducan.
Están en `src/kb.js` (constante `DC`).

| Tema | Mensaje | Qué enseña |
|---|---|---|
| Errores WiFi | canal 1476745565252489266 | red 2.4 GHz aparte, nombre/clave exactos, cable al costado en BMI160, «Unable to connect» con el tracker ya conectado no es error, router AT&T bloquea puertos → GL.iNet Opal, ICM/BNO con router cerca, misma red PC/visor, launcher actualizado, Driver Booster si el USB sale con error |
| Firmware BMI160 / Ice Cube WiFi | 1476753589782446202/1476754459693551730 | DIY firmware tool, Wemos D1 Mini, v0.7.2, IMU_BMI160 DEG_0, batería por defecto; ya se autocalibra (5 min quieto) |
| Firmware ICM42 | 1476745675998756913/1476786318141821100 | ICM42688 DEG_180, batería R0/R1 10/R2 47/A0, LED 2 invertido |
| Firmware ICM45 | 1476745648903684127/1476784634023903345 | ICM45686 DEG_180, misma batería que ICM42 |
| Firmware BNO085 Ultimates | 1476746273389547741/1477073561775505481 | BNO085 DEG_180, misma batería que ICM42 |
| SMOL: apagar | 1476745722467586118/1494066206586699988 | mantener el botón del frente |
| SMOL en rojo | 1476745722467586118/1494066454243315753 | sacar del riel, reset rápido, volver a meter |
| SMOL: emparejar en PC | 1476745722467586118/1504551743122571444 | Configurator: receptor → Receiver → Pairing Mode; cada tracker → Tracker → Pairing Mode |
| SMOL: guía rápida (imagen) | 1476745722467586118/1507555973341122661 | rutina antes de jugar, Virtual Desktop sin «Emulate Vive Trackers», NO tocar Firmware/DFU/Remove/Clear Data |
| SMOL: emparejar en Android | 1476745722467586118/1508547817868886209 | app SlimeVR + SmolSlimeConfigurator Android, receptor por OTG, aceptar el permiso USB, pair |
| Calibración 6 ejes (EN) | 1318779480952668180/1343065395971489825 | — |
| Standalone (EN) | 1318779480952668180/1343065401134809108 | — |
| Proporciones (EN) | 1318779480952668180/1343065666701365393 | — |
| Medidas (ES) | 1318778311421202492/1343065809378873474 | — |
