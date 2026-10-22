"use strict";

/**
 * Base de conocimiento del soporte USAGIVR.
 *
 * Fuentes: el manual "USAGIVR ENGLISH FINAL" (manda sobre todo lo demas),
 * la documentacion oficial de SlimeVR y lo que de verdad arreglo cada
 * problema en r/SlimeVR (ver investigacion-slimevr-problemas.md y videos.md).
 *
 * Cada tema: palabras clave (sin acentos, en minusculas), pasos en es/en,
 * videos de YouTube e imagenes de assets/. El bot elige el tema por
 * palabras clave; si no encaja ninguno, pregunta a la IA con este mismo texto.
 */

const yt = (id) => `https://youtu.be/${id}`;

const TEMAS = [
  {
    id: "correas",
    claves: ["correa", "correas", "strap", "straps", "cinta", "cintas", "hebilla", "buckle", "velcro", "ponerme", "poner las", "put on", "wear", "arnes", "harness", "se resbala", "slips", "se cae", "falls off", "se enrolla", "rolls"],
    titulo: { es: "Cómo ponerse las correas", en: "How to put on the straps" },
    pasos: {
      es: [
        "En el kit vienen: **2 correas gruesas con antideslizante** (muslos), **2 o 3 correas largas** (cintura, pecho y cadera, según el kit) y correas normales para el resto.",
        "Mete el tracker en la correa por el **riel**, con el **puerto USB-C hacia abajo** (esa punta entra primero): empújalo hasta que **escuches un click** y ahí se queda, con el **USB-C mirando hacia abajo** y **la carita de nuestro personaje siempre mirando al frente**.",
        "Pecho: el arnés va centrado sobre el esternón, ajustado pero sin apretar la respiración.",
        "Muslos (correas gruesas antideslizantes): **justo encima de la rodilla**, al frente del muslo. Si se enrolla, bájala un poco más.",
        "Tobillos: la correa va **justo encima del hueso del tobillo, por el costado de la pierna** (no delante ni en el pie).",
        "Aprieta hasta que al mover la pierna el tracker no gire sobre la piel. Si una correa se queda corta, usa una de las largas.",
      ],
      en: [
        "The kit includes: **2 thick anti-slip straps** (thighs), **2 or 3 long straps** (waist, chest and hip, depending on the kit) and regular straps for the rest.",
        "Slide the tracker into the strap along the **rail**, with the **USB-C port pointing down** (that end goes in first): push until you **hear a click** and it stays there, with the **USB-C port facing down** and **our character's face always facing forward**.",
        "Chest: centre the harness on your sternum, snug but not tight enough to restrict breathing.",
        "Thighs (thick anti-slip straps): **just above the knee**, on the front of the thigh. If it rolls, move it a little lower.",
        "Ankles: the strap goes **just above the ankle bone, on the side of the leg** (not in front and not on the foot).",
        "Tighten until the tracker does not rotate on your skin when you move. If a strap is too short, use one of the long ones.",
      ],
    },
    videos: [
      { t: "Tracker mounting + reset (Erimel)", u: yt("aM0jXEYQAeY") },
      { t: "Rock solid chest & hip mounting", u: yt("AHj_B-HoWmU") },
      { t: "Chest harness + hip (ZRock35)", u: yt("qTvXIpdCwS8") },
    ],
    imagenes: ["colocacion-5.png"],
  },
  {
    id: "colocacion",
    claves: ["donde", "where", "colocar", "coloco", "colocacion", "placement", "place", "posicion", "position", "lugar", "pecho", "chest", "muslo", "thigh", "tobillo", "ankle", "cadera", "hip", "cuantos trackers", "how many trackers", "orden", "which body part", "parte del cuerpo"],
    titulo: { es: "Dónde y cómo colocar los trackers", en: "Where and how to place the trackers" },
    pasos: {
      es: [
        "Mínimo 5 trackers: **pecho, 2 muslos y 2 tobillos** (mira el dibujo).",
        "En todos: el tracker entra al riel de la correa hasta el click, con el **USB-C mirando hacia abajo**, y **la carita del personaje siempre mirando al frente**.",
        "Pecho y muslos **mirando al frente**. Tobillos **en el costado exterior** de la pierna.",
        "En SlimeVR asigna cada tracker a su parte del cuerpo (en SlimeVR, nunca en SteamVR).",
        "Como los tobillos van de lado, en SlimeVR ajusta su orientación (Mounting) para que la pierna no salga girada: está en la página 12 del manual (segunda imagen).",
        "Con 6, 8 o 10 trackers: cadera, pies, brazos y codos según los otros dibujos del manual.",
      ],
      en: [
        "Minimum 5 trackers: **chest, 2 thighs and 2 ankles** (see the drawing).",
        "On all of them: the tracker clicks into the strap rail with the **USB-C port facing down**, and **the character's face always facing forward**.",
        "Chest and thighs **facing forward**. Ankles **on the outer side** of the leg.",
        "Assign each tracker to its body part in SlimeVR (in SlimeVR, never in SteamVR).",
        "Because the ankles sit on the side, fix their orientation in SlimeVR (Mounting) so the leg is not twisted: it is on page 12 of the manual (second image).",
        "With 6, 8 or 10 trackers: hip, feet, arms and elbows as in the other drawings of the manual.",
      ],
    },
    videos: [{ t: "Tracker mounting + reset (Erimel)", u: yt("aM0jXEYQAeY") }],
    imagenes: ["colocacion-5.png", "tobillo-fix.png"],
  },
  {
    id: "no_enciende",
    claves: ["no enciende", "no prende", "no se enciende", "no se prende", "no carga", "no luz", "sin luz", "no led", "apagado", "se apago", "muerto", "won't turn on", "wont turn on", "doesn't turn on", "doesnt turn on", "does not turn on", "not turning on", "no power", "dead", "won't charge", "wont charge", "not charging", "no light", "turned off"],
    titulo: { es: "El tracker no enciende", en: "The tracker won't turn on" },
    pasos: {
      es: [
        "**Botón de reinicio**: atrás el tracker tiene un botoncito de reset; apriétalo (con la punta de un clip si hace falta). Casi siempre con eso revive.",
        "Ponlo a cargar **20 minutos o más** con un cable USB-C que funcione (prueba otro cable y otro cargador/puerto).",
        "Con el cable conectado, ¿enciende y **aparece en SlimeVR**? Si sí, el tracker está bien y lo que falla es la **batería**.",
        "Si no prende ni conectado al cable, avísame y lo vemos con el equipo.",
      ],
      en: [
        "**Reset button**: there is a small reset button on the back of the tracker; press it (use the tip of a paperclip if needed). That usually brings it back.",
        "Charge it for **20 minutes or more** with a working USB-C cable (try another cable and another charger/port).",
        "With the cable plugged in, does it turn on and **show up in SlimeVR**? If yes, the tracker is fine and the problem is the **battery**.",
        "If it doesn't turn on even plugged in, tell me and we'll check it with the team.",
      ],
    },
    videos: [{ t: "How to turn off a Smol tracker (Usagi VR)", u: yt("RR7D159j7zQ") }],
    imagenes: ["tracker-classic-fat.png"],
  },
  {
    id: "no_conecta",
    claves: ["no conecta", "no se conecta", "no conectan", "no se conectan", "nuevo", "nuevos", "new tracker", "new trackers", "won't connect", "wont connect", "doesn't connect", "doesnt connect", "not connecting", "cant connect", "can't connect", "no aparece", "no aparecen", "not showing", "don't show", "dont show", "not detected", "no detecta", "no los detecta", "slimevr no", "pairing", "emparejar", "emparentar", "vincular", "sync", "first time", "primera vez"],
    titulo: { es: "Trackers que no conectan / emparejar", en: "Trackers won't connect / pairing" },
    pasos: {
      es: [
        "Conecta la **antena receptora** (la pequeña o la grande en forma de pentágono) a un **USB del PC** y abre SlimeVR Server.",
        "**Reinicia los trackers** (apagar, 5 s, encender), quietos en el suelo. Normalmente ya vienen **emparejados de fábrica** y aparecen solos en SlimeVR.",
        "Si alguno no aparece, hay que **emparejarlo con la antena**: sigue el video **«How to sync new Smol trackers»** de abajo, uno por uno.",
        "**Antena:** que no esté tapada (ni detrás de la torre del PC ni en un cajón) y **mirando hacia donde vas a jugar**. Un alargue USB para subirla ayuda mucho.",
        "Solo si tus trackers son de **WiFi**: conéctalos por USB con un cable **de datos** y mete el WiFi en SlimeVR (red **2.4 GHz**, solo **WPA2**, canal 1-11). SlimeVR te guía, pero aquí tienes el video también.",
        "Si salen en SlimeVR pero no en SteamVR: SteamVR → Startup/Shutdown → activa SlimeVR → reinicia SteamVR.",
      ],
      en: [
        "Plug the **receiver antenna** (the small one or the big pentagon-shaped one) into a **USB port on your PC** and open SlimeVR Server.",
        "**Restart the trackers** (off, 5 s, on) and leave them still on the floor. They normally come **already paired from the factory** and show up in SlimeVR by themselves.",
        "If one doesn't show up, it needs to be **paired to the antenna**: follow the **\"How to sync new Smol trackers\"** video below, one at a time.",
        "**Antenna:** keep it uncovered (not behind the PC tower or in a drawer) and **facing the area where you play**. A USB extension to raise it helps a lot.",
        "Only if your trackers are **WiFi** ones: plug them in via USB with a **data** cable and enter your WiFi in SlimeVR (**2.4 GHz**, **WPA2 only**, channel 1-11). SlimeVR guides you, but the video is here too.",
        "If they show in SlimeVR but not in SteamVR: SteamVR → Startup/Shutdown → enable SlimeVR → restart SteamVR.",
      ],
    },
    videos: [
      { t: "How to sync new Smol trackers (Usagi VR)", u: yt("HaldUGryrf4") },
      { t: "SlimeVR setup guide (official)", u: yt("SkfdraicN5s") },
      { t: "Configurar trackers SlimeVR (VRMods, español)", u: yt("GjvZ-U0kcME") },
    ],
    imagenes: [],
  },
  {
    id: "antena",
    claves: ["la antena", "the antenna", "the dongle", "el dongle", "antena", "antenna", "dongle", "receptor", "receiver", "pentagono", "pentágono", "pentagon", "se cortan", "se corta", "cutting out", "señal", "senal", "signal", "alcance", "range"],
    titulo: { es: "La antena receptora", en: "The receiver antenna" },
    pasos: {
      es: [
        "Todos los kits (de 5 a 11 trackers) traen una **antena receptora**: una pequeña o una más grande en forma de **pentágono**. Va conectada a un **USB del PC**.",
        "Los trackers ya vienen **emparejados** con su antena: conéctala, enciende los trackers y deberían salir en SlimeVR.",
        "Que **no esté tapada**: nada de detrás de la torre, debajo del escritorio ni en un cajón.",
        "Ponla **mirando hacia la zona donde juegas**, mejor en alto. Un **alargue USB** para acercarla ayuda mucho si se cortan los trackers.",
        "Mejor en un USB directo de la placa (atrás del PC) o con el alargue, lejos de otros receptores inalámbricos y de metal.",
        "Si un tracker no sale aunque la antena esté bien, toca emparejarlo: mira el video de abajo.",
      ],
      en: [
        "Every kit (5 to 11 trackers) comes with a **receiver antenna**: a small one or a bigger **pentagon-shaped** one. It goes into a **USB port on your PC**.",
        "The trackers come **already paired** to their antenna: plug it in, turn the trackers on and they should show up in SlimeVR.",
        "Keep it **uncovered**: not behind the tower, under the desk or in a drawer.",
        "Point it **toward the area where you play**, ideally up high. A **USB extension** to bring it closer helps a lot if trackers cut out.",
        "Prefer a USB port straight on the motherboard (back of the PC) or the extension, away from other wireless receivers and metal.",
        "If a tracker still doesn't show up with the antenna set up right, it needs pairing: check the video below.",
      ],
    },
    videos: [{ t: "How to sync new Smol trackers (Usagi VR)", u: yt("HaldUGryrf4") }],
    imagenes: [],
  },
  {
    id: "wifi",
    claves: ["wifi", "wi-fi", "router", "red", "network", "ssid", "contrasena", "password", "3 parpadeos", "three blinks", "3 blinks", "5ghz", "2.4", "ping", "lag", "se desconecta", "disconnect", "disconnects", "modem", "internet"],
    titulo: { es: "Problemas de WiFi y red", en: "WiFi and network problems" },
    pasos: {
      es: [
        "Reinicia el router y los trackers.",
        "Red **2.4 GHz** (5 GHz no funciona). Si tu router junta 2.4 y 5 GHz con el mismo nombre, sepáralas.",
        "Canal **1 a 11**, seguridad **solo WPA2** (no WPA3 ni mixto), nombre y clave solo con letras y números.",
        "El ping debe ser **menor de 20 ms**: router en la misma habitación.",
        "Si cambiaste de router, vuelve a meter el WiFi por USB.",
        "PC: perfil de red de Windows en **Privada**, ejecuta `firewall.bat` de SlimeVR como administrador, sin VPN ni red de invitados.",
        "Si ya hiciste todos los pasos y no conectan: muchas veces **el proveedor de internet bloquea algunas conexiones** en su router y eso afecta la comunicación de los trackers (solo pasa con los **WiFi**). Lo que mejor funciona es un **router barato extra solo para los trackers**.",
      ],
      en: [
        "Restart the router and the trackers.",
        "**2.4 GHz** network (5 GHz doesn't work). If your router merges 2.4 and 5 GHz under one name, split them.",
        "Channel **1 to 11**, **WPA2 only** (not WPA3 or mixed), name and password with letters and numbers only.",
        "Ping must be **under 20 ms**: router in the same room.",
        "If you changed routers, enter the WiFi again over USB.",
        "PC: Windows network profile set to **Private**, run SlimeVR's `firewall.bat` as administrator, no VPN or guest network.",
        "If you did every step and they still won't connect: **internet providers often block some connections** on their routers, which breaks tracker communication (only for **WiFi** trackers). What works best is a **cheap extra router just for the trackers**.",
      ],
    },
    videos: [
      { t: "SlimeVR setup guide part 2 (official)", u: yt("JrHmNcckpuE") },
      { t: "Best cheap routers for trackers", u: yt("GwSuEpIWDyE") },
      { t: "Tutorial con dudas y errores (VRMods, español)", u: yt("mPhr7zGiWD4") },
    ],
    imagenes: [],
  },
  {
    id: "drift",
    claves: ["drift", "deriva", "se gira", "se mueve solo", "gira solo", "rotates", "rotating", "moving by itself", "spinning", "se desvia", "desviado", "offset", "se tuerce"],
    titulo: { es: "Drift (el tracker se gira solo)", en: "Drift (the tracker rotates by itself)" },
    pasos: {
      es: [
        "Antes de jugar deja los trackers **quietos en el suelo 2 minutos**, luego haz **Full Reset**.",
        "Si llevas un rato jugando: quítatelos, déjalos quietos 10-15 s y vuelve a ponerlos.",
        "Activa **Stay Aligned** en SlimeVR y haz un Yaw Reset cuando cambies de postura.",
        "Para saber si es un tracker concreto, cámbialo de sitio con otro: si el drift lo sigue, es ese tracker.",
        "Lejos de colchones con muelles o metal.",
        "Si sigue: activa el modo desarrollador, mira que X/Y/Z se queden en 0 en reposo; si no, toca la calibración de 6 caras (video).",
      ],
      en: [
        "Before playing leave the trackers **still on the floor for 2 minutes**, then do a **Full Reset**.",
        "After playing a while: take them off, leave them still 10-15 s and put them back on.",
        "Enable **Stay Aligned** in SlimeVR and do a Yaw Reset when you change posture.",
        "To find out if it's one tracker, swap it with another: if the drift follows it, it's that tracker.",
        "Keep away from spring mattresses or metal.",
        "If it continues: enable developer mode and check X/Y/Z stay at 0 at rest; if not, do the 6-side calibration (video).",
      ],
    },
    videos: [
      { t: "Drift isn't what you think (Jacobfov)", u: yt("On8_1hrW7_g") },
      { t: "6-side calibration (Adamant IT)", u: yt("UmgGd9O-rn4") },
      { t: "Smol 6-side calibration", u: yt("wuktCL0t57k") },
    ],
    imagenes: ["calibracion-drift.png"],
  },
  {
    id: "calibracion",
    claves: ["calibra", "calibrate", "calibration", "reset", "piernas cruzadas", "crossed legs", "legs cross", "pierna girada", "leg twisted", "sentado", "sitting", "acostado", "lying", "vrchat", "fbt", "altura", "height", "proporciones", "proportions"],
    titulo: { es: "Calibración en cada sesión", en: "Calibrating every session" },
    pasos: {
      es: [
        "Sigue siempre las **guías de calibración que te muestra SlimeVR** dentro del programa, paso por paso.",
        "Trackers quietos en el suelo 2 minutos al encenderlos.",
        "Póntelos, de pie y recto, pies separados ~10 cm.",
        "SlimeVR: **Automatic Mounting** (pose de esquí) → VRChat: **Calibrate FBT** → SlimeVR: **Full Reset**.",
        "Tu altura igual en SlimeVR y en VRChat.",
        "Al sentarte o tumbarte haz un **Yaw Reset**.",
        "Si las piernas se cruzan: tobillos al costado, muslos justo encima de la rodilla, y revisa Manual Mounting.",
      ],
      en: [
        "Always follow the **calibration guides SlimeVR shows you** inside the program, step by step.",
        "Trackers still on the floor for 2 minutes after turning them on.",
        "Put them on, stand straight, feet ~10 cm apart.",
        "SlimeVR: **Automatic Mounting** (ski pose) → VRChat: **Calibrate FBT** → SlimeVR: **Full Reset**.",
        "Same height in SlimeVR and VRChat.",
        "When you sit or lie down do a **Yaw Reset**.",
        "If legs cross: ankles on the side, thighs just above the knee, and check Manual Mounting.",
      ],
    },
    videos: [
      { t: "Calibration guide (ZRock35)", u: yt("SYqfQdVseF4") },
      { t: "Calibration routine (Snitchie)", u: yt("NLy9-gjybtg") },
      { t: "Body proportions (Dean Ravencrest)", u: yt("PTFV9hJa4DE") },
    ],
    imagenes: ["uso-diario.png"],
  },
  {
    id: "botones_reset",
    claves: ["boton de reset", "botones de reset", "reset rapido", "quick reset", "reset button", "reset binding", "bindings", "boton y", "boton b", "y y b", "asignar boton", "bind", "atajo", "shortcut", "keybind", "mando", "control"],
    titulo: { es: "Poner los resets en los botones del mando", en: "Putting resets on your controller buttons" },
    pasos: {
      es: [
        "Abre SteamVR → **Settings** y activa **Advanced Settings**.",
        "Ve a **Controllers → Show Binding UI → Show More Applications** y elige **SlimeVR-Bindings-Provider**.",
        "Pícale al **+** junto al botón que quieras (por ejemplo **Y** o **B**) y elige modo **Button**.",
        "En **Click** (o **Long/Held**, en *More options*) asigna el reset: **Quick/Yaw reset**, **Full reset** o **Mounting reset**. Ej.: Y = Quick reset, B = Full reset.",
        "Si quieres que sea con dos botones a la vez, usa el menú **Chords**.",
        "Atajos de teclado por defecto: Ctrl+Alt+Shift+**U** quick reset, **Y** full reset, **I** mounting reset.",
      ],
      en: [
        "Open SteamVR → **Settings** and turn on **Advanced Settings**.",
        "Go to **Controllers → Show Binding UI → Show More Applications** and pick **SlimeVR-Bindings-Provider**.",
        "Click the **+** next to the button you want (e.g. **Y** or **B**) and choose **Button** mode.",
        "On **Click** (or **Long/Held**, under *More options*) assign the reset: **Quick/Yaw reset**, **Full reset** or **Mounting reset**. E.g. Y = Quick reset, B = Full reset.",
        "For a two-button combo, use the **Chords** menu.",
        "Default keyboard shortcuts: Ctrl+Alt+Shift+**U** quick reset, **Y** full reset, **I** mounting reset.",
      ],
    },
    videos: [{ t: "SlimeVR docs: reset bindings", u: "https://docs.slimevr.dev/server/setting-reset-bindings.html" }],
    imagenes: [],
  },
  {
    id: "smol_configurator",
    claves: ["configurator", "configurador", "smol configurator", "smolslime", "flashear", "flash", "firmware", "actualizar firmware", "update firmware", "emparejar", "emparentar", "pairing", "pair", "6 caras", "6-side", "6 side"],
    titulo: { es: "SmolSlimeConfigurator: emparejar, firmware y calibrar", en: "SmolSlimeConfigurator: pairing, firmware and calibration" },
    pasos: {
      es: [
        "Bájalo de GitHub (Releases): hay versión para Windows, Linux, macOS y Android.",
        "**Emparejar**: conecta la antena (receptor) por USB → **↻** → elige el puerto → **Connect** → pestaña del receptor → **Pairing mode** → enciende los trackers uno por uno hasta que aparezcan → sal del modo pairing.",
        "**IceCube: NO se les actualiza el firmware.** Si lo actualizan, pierden la cobertura y ya no nos hacemos responsables si fallan. El resto de los modelos sí se pueden actualizar.",
        "**Firmware** (todos menos IceCube): conecta el tracker o el receptor por USB y aprieta reset dos veces → **↻**, puerto, **Connect** → elige el firmware en *Select Firmware* → **⬇ Firmware** y espera ~20 s. Tracker y receptor deben quedar en la misma versión.",
        "**Calibrar el sensor**: botón **Calibrate** con el tracker quieto ~5 s, o la calibración de **6 caras** siguiendo lo que pide en pantalla.",
      ],
      en: [
        "Download it from GitHub (Releases): there are builds for Windows, Linux, macOS and Android.",
        "**Pairing**: plug the antenna (receiver) into USB → **↻** → pick the port → **Connect** → receiver tab → **Pairing mode** → turn the trackers on one by one until they show up → leave pairing mode.",
        "**IceCube: do NOT update their firmware.** Updating it voids their coverage and we can't be responsible if they fail afterwards. All other models can be updated.",
        "**Firmware** (all except IceCube): plug the tracker or receiver into USB and press reset twice → **↻**, port, **Connect** → pick the firmware in *Select Firmware* → **⬇ Firmware** and wait ~20 s. Tracker and receiver must be on the same version.",
        "**Sensor calibration**: **Calibrate** button with the tracker still for ~5 s, or the **6-side** calibration following the on-screen steps.",
      ],
    },
    videos: [
      { t: "SmolSlimeConfigurator (download)", u: "https://github.com/ICantMakeThings/SmolSlimeConfigurator/releases" },
      { t: "Video tutorial", u: "https://www.youtube.com/watch?v=ENINHh4L8tk" },
      { t: "Android tutorial", u: "https://youtu.be/2PHelwy7Rcs" },
      { t: "SlimeVR docs: SmolSlimeConfigurator", u: "https://docs.slimevr.dev/smol-slimes/firmware/SmolSlimeConfigurator.html" },
    ],
    imagenes: [],
  },
  {
    id: "configurar_slimevr",
    claves: ["instalar slimevr", "instalo slimevr", "instale slimevr", "install slimevr", "installing slimevr", "configurar slimevr", "setup slimevr", "set up slimevr", "slimevr server", "formatee", "formateado", "formatear", "reinstalar", "reinstall", "orden", "empezar", "primera vez", "first time", "getting started", "asistente", "wizard", "steamvr addon", "add-on", "addon", "no sale en steamvr", "not in steamvr"],
    titulo: { es: "Configurar SlimeVR desde cero", en: "Setting up SlimeVR from scratch" },
    pasos: {
      es: [
        "Orden (también si formateaste): primero **SteamVR** (de Steam) y **ábrelo una vez**; después instala **SlimeVR**, así se aplican bien sus plugins y el driver.",
        "Conecta la antena por USB, abre SlimeVR y sigue el asistente (**Let's get set up!**); los trackers ya vienen emparejados, así que deben aparecer solos al encenderlos.",
        "Deja los trackers quietos en la mesa cuando te lo pida y luego **asigna cada uno a su parte del cuerpo** (agítalo para saber cuál es).",
        "Mounting: si eres nuevo, el **manual** es el más seguro; elige la orientación de cada tracker.",
        "Proporciones y resets: sigue las pantallas de SlimeVR tal cual te las muestra.",
        "Si no salen en SteamVR: SteamVR → Startup/Shutdown → **Manage Add-ons** → activa SlimeVR.",
      ],
      en: [
        "Order (also after a format): first **SteamVR** (from Steam) and **open it once**; then install **SlimeVR**, so its plugins and driver get applied.",
        "Plug the antenna into USB, open SlimeVR and follow the wizard (**Let's get set up!**); trackers come pre-paired, so they should show up when you turn them on.",
        "Leave the trackers still on the table when asked, then **assign each one to its body part** (shake it to see which one it is).",
        "Mounting: if you're new, **manual** is the safest; pick each tracker's orientation.",
        "Proportions and resets: follow SlimeVR's screens as they show them.",
        "If they don't show in SteamVR: SteamVR → Startup/Shutdown → **Manage Add-ons** → turn SlimeVR on.",
      ],
    },
    videos: [{ t: "SlimeVR docs: Quick Setup", u: "https://docs.slimevr.dev/quick-setup" }],
    imagenes: ["uso-diario.png"],
  },
  {
    id: "kits",
    claves: ["5 trackers", "6 trackers", "7 trackers", "8 trackers", "9 trackers", "10 trackers", "11 trackers", "kit de", "tengo 5", "tengo 6", "tengo 7", "tengo 8", "tengo 9", "tengo 10", "tengo 11", "i have 6", "i have 8", "i have 10", "i have 11", "cuantos trackers", "how many trackers"],
    titulo: { es: "Dónde va cada tracker según tu kit (5 a 11)", en: "Where each tracker goes for your kit (5 to 11)" },
    pasos: {
      es: [
        "**5**: pecho, 2 muslos, 2 tobillos.",
        "**6**: + cadera.",
        "**7**: + cintura y cadera.",
        "**8**: pecho, cadera, 2 muslos, 2 tobillos, 2 pies.",
        "**9**: lo de 8 + cintura.",
        "**10**: lo de 8 + 2 brazos (encima del codo). **11**: lo de 10 + cintura.",
        "Cintura: arriba de la cadera, a la altura del ombligo. Cadera: donde iría el cinturón. Siempre la carita del personaje al frente y el tobillo corregido en la app (pág. 12 del manual).",
      ],
      en: [
        "**5**: chest, 2 thighs, 2 ankles.",
        "**6**: + hip.",
        "**7**: + waist and hip.",
        "**8**: chest, hip, 2 thighs, 2 ankles, 2 feet.",
        "**9**: the 8 setup + waist.",
        "**10**: the 8 setup + 2 upper arms (above the elbow). **11**: the 10 setup + waist.",
        "Waist: above the hip, at belly-button height. Hip: where a belt would go. Always the character's face forward and the ankle fixed in the app (page 12 of the manual).",
      ],
    },
    videos: [{ t: "SlimeVR docs: putting on trackers", u: "https://docs.slimevr.dev/server/putting-on-trackers.html" }],
    imagenes: ["colocacion-5.png", "colocacion-5mas1.png", "colocacion-5mas3.png", "colocacion-7mas3.png"],
  },
  {
    id: "dispositivos",
    claves: ["iphone", "ios", "ipad", "mac", "macbook", "macos", "android", "telefono", "celular", "phone", "pc encendida", "pc prendida", "sin pc", "pc vieja", "telefono viejo", "old phone", "old pc", "need my pc", "necesito pc", "necesito la pc", "compatible"],
    titulo: { es: "¿Con qué dispositivos funciona?", en: "Which devices does it work with?" },
    pasos: {
      es: [
        "**iPhone y Mac: todavía no** está disponible.",
        "**Android**: sí, recomendamos un teléfono Android con la app de SlimeVR, que se descarga desde la web oficial.",
        "**PC (Windows)**: SlimeVR se descarga desde **Steam**.",
        "Para jugar con PC (SteamVR) la PC tiene que estar prendida con SlimeVR abierto; con el Android y un Quest standalone no hace falta PC.",
      ],
      en: [
        "**iPhone and Mac: not available yet**.",
        "**Android**: yes, we recommend an Android phone with the SlimeVR app, downloaded from the official website.",
        "**PC (Windows)**: get SlimeVR from **Steam**.",
        "To play on PC (SteamVR) the PC must be on with SlimeVR open; with the Android app and a standalone Quest you don't need a PC.",
      ],
    },
    videos: [{ t: "SlimeVR (download)", u: "https://slimevr.dev/download" }],
    imagenes: [],
  },
  {
    id: "boton_suelto",
    claves: ["se salio el boton", "se me salio el boton", "boton se salio", "se cayo el boton", "boton suelto", "perdi el boton", "button fell", "button came off", "lost the button", "button popped"],
    titulo: { es: "Se salió el botoncito", en: "The button came off" },
    pasos: {
      es: ["Tranqui, normalmente **no es necesario**: el tracker sigue funcionando igual. Solo si te da problemas (no enciende o no responde), me dices y lo vemos."],
      en: ["No worries, it's usually **not needed**: the tracker keeps working the same. Only if it causes trouble (won't turn on or respond), tell me and we'll check it."],
    },
    videos: [],
    imagenes: [],
  },
  {
    id: "quest",
    claves: ["quest", "standalone", "sin pc", "without pc", "osc", "android", "movil", "celular", "phone"],
    titulo: { es: "Quest standalone (sin PC)", en: "Quest standalone (no PC)" },
    pasos: {
      es: [
        "En VRChat activa **OSC** y **OSC Trackers**.",
        "En SlimeVR pon la **IP del Quest** en los ajustes de VRChat OSC Trackers.",
        "Calibra en VRChat como siempre (Calibrate FBT).",
      ],
      en: [
        "In VRChat enable **OSC** and **OSC Trackers**.",
        "In SlimeVR enter the **Quest's IP address** in the VRChat OSC Trackers settings.",
        "Calibrate in VRChat as usual (Calibrate FBT).",
      ],
    },
    videos: [
      { t: "Quest standalone FBT (ZRock35)", u: yt("NSsoi9bfH0I") },
      { t: "Pair Smol trackers on Android (Usagi VR)", u: yt("Odnf4u6ZgsY") },
    ],
    imagenes: [],
  },
  {
    id: "pies",
    claves: ["pie", "pies", "foot", "feet", "se hunden", "sinking", "floor", "suelo", "inclinado", "tilt", "extension", "cable del pie"],
    titulo: { es: "Pies y extensiones", en: "Feet and extensions" },
    pasos: {
      es: [
        "Cable de extensión del pie: **apaga el tracker antes de enchufarlo** y mételo **a fondo por los dos lados** (cuesta fuerza).",
        "Bien conectado salen dos trackers al encender: asigna el extra como **foot**.",
        "Pies que se hunden: activa **Skating correction** y **Floor clip** en SlimeVR.",
      ],
      en: [
        "Foot extension cable: **turn the tracker off before plugging it** and push it **all the way in on both ends** (it takes force).",
        "When connected properly two trackers appear when turned on: assign the extra one as **foot**.",
        "Sinking feet: enable **Skating correction** and **Floor clip** in SlimeVR.",
      ],
    },
    videos: [{ t: "Feet tilt fix (DJ VRChat)", u: yt("V5IOa8falJM") }],
    imagenes: [],
  },
  {
    id: "bateria",
    claves: ["bateria", "battery", "dura poco", "se descarga", "descarga rapido", "drains", "lasts", "charging", "cargando", "parpadean", "blinking", "both lights"],
    titulo: { es: "Batería", en: "Battery" },
    pasos: {
      es: [
        "\"Dice que está cargando y no lo está\": es normal justo al quitarlo del cargador, se corrige solo en unos 10 minutos.",
        "Si enciende y sale en SlimeVR solo con el cable conectado, es la batería.",
        "Si se descarga rápido o dura poco, es difícil saberlo solo con la descripción: necesitamos ver qué tan rápido. Mándanos un **video o prueba** (por ejemplo, el % de batería en SlimeVR al empezar y después de un rato).",
        "Con eso el equipo lo revisa; casi siempre es algo que se arregla sin mayor drama.",
      ],
      en: [
        "\"It says it's charging but it isn't\": this is normal right after unplugging, it fixes itself in about 10 minutes.",
        "If it only turns on and shows in SlimeVR while plugged in, it's the battery.",
        "If it drains fast or doesn't last long, it's hard to tell from a description alone: we need to see how fast. Send us a **video or proof** (e.g. the battery % in SlimeVR when you start and after a while).",
        "With that the team can check it; it's almost always fixable without a big hassle.",
      ],
    },
    videos: [],
    imagenes: [],
    escalar: true,
  },
];

function normalizar(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'");
}

/** Devuelve los temas ordenados por coincidencias (hasta `max`). */
function buscarTemas(texto, max = 2) {
  const t = ` ${normalizar(texto)} `;
  const puntos = [];
  for (const tema of TEMAS) {
    let p = 0;
    for (const c of tema.claves) {
      const re = new RegExp(`(^|[^a-z0-9])${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);
      if (re.test(t)) p += c.includes(" ") ? 2 : 1;
    }
    if (p > 0) puntos.push({ tema, p });
  }
  puntos.sort((a, b) => b.p - a.p);
  return puntos.slice(0, max).map((x) => x.tema);
}

/** Texto compacto de toda la base, para el prompt de la IA. */
function resumenParaIA(idioma) {
  return TEMAS.map((t) => `## [${t.id}] ${t.titulo[idioma]}\n- ${t.pasos[idioma].join("\n- ")}`).join("\n\n");
}

module.exports = { TEMAS, buscarTemas, normalizar, resumenParaIA };
