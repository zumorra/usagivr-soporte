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
        "Mete el tracker en el soporte de la correa con el **botón y el puerto USB-C hacia arriba**.",
        "Pecho: el arnés va centrado sobre el esternón, ajustado pero sin apretar la respiración.",
        "Muslos: la correa va **justo encima de la rodilla**, al frente del muslo. Si se enrolla, bájala un poco más.",
        "Tobillos: la correa va **justo encima del hueso del tobillo, por el costado de la pierna** (no delante ni en el pie).",
        "Aprieta hasta que al mover la pierna el tracker no gire sobre la piel. Si una correa se queda corta, usa una correa elástica más larga o encadena dos.",
      ],
      en: [
        "Put the tracker in the strap holder with the **button and USB-C port facing up**.",
        "Chest: centre the harness on your sternum, snug but not tight enough to restrict breathing.",
        "Thighs: the strap goes **just above the knee**, on the front of the thigh. If it rolls, move it a little lower.",
        "Ankles: the strap goes **just above the ankle bone, on the side of the leg** (not in front and not on the foot).",
        "Tighten until the tracker does not rotate on your skin when you move. If a strap is too short, use a longer elastic strap or chain two together.",
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
        "Botón y USB-C **hacia arriba** en todos.",
        "Pecho y muslos **mirando al frente**. Tobillos **en el costado exterior** de la pierna.",
        "En SlimeVR asigna cada tracker a su parte del cuerpo (en SlimeVR, nunca en SteamVR).",
        "Como los tobillos van de lado, en SlimeVR ajusta su orientación (Mounting) para que la pierna no salga girada: está en la página 12 del manual (segunda imagen).",
        "Con 6, 8 o 10 trackers: cadera, pies, brazos y codos según los otros dibujos del manual.",
      ],
      en: [
        "Minimum 5 trackers: **chest, 2 thighs and 2 ankles** (see the drawing).",
        "Button and USB-C **facing up** on all of them.",
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
        "**Reinícialo**: mantén el botón pulsado hasta que se apague, espera 5 segundos y vuelve a encenderlo.",
        "Ponlo a cargar **20 minutos o más** con un cable USB-C que funcione (prueba otro cable y otro cargador/puerto).",
        "Prueba a encenderlo **mientras está cargando**.",
        "Si el LED de carga no se enciende nunca o el tracker no arranca ni cargando, dímelo con el botón de abajo y un compañero lo revisará.",
      ],
      en: [
        "**Restart it**: hold the button until it turns off, wait 5 seconds and turn it on again.",
        "Charge it for **20 minutes or more** with a working USB-C cable (try another cable and another charger/port).",
        "Try turning it on **while it is charging**.",
        "If the charging LED never lights up, or it won't start even while charging, tell me with the button below and a teammate will check it.",
      ],
    },
    videos: [{ t: "How to turn off a Smol tracker (Usagi VR)", u: yt("RR7D159j7zQ") }],
    imagenes: ["tracker-classic-fat.png"],
  },
  {
    id: "no_conecta",
    claves: ["no conecta", "no se conecta", "no conectan", "no se conectan", "nuevo", "nuevos", "new tracker", "new trackers", "won't connect", "wont connect", "doesn't connect", "doesnt connect", "not connecting", "cant connect", "can't connect", "no aparece", "no aparecen", "not showing", "don't show", "dont show", "not detected", "no detecta", "no los detecta", "slimevr no", "pairing", "emparejar", "first time", "primera vez"],
    titulo: { es: "Trackers nuevos que no conectan", en: "New trackers won't connect" },
    pasos: {
      es: [
        "**Reinicia los trackers** (apagar, 5 s, encender) y **reinicia el router**. Esto arregla la mayoría de los casos.",
        "Ponlos quietos en el suelo y abre SlimeVR Server en el PC.",
        "Si nunca les pusiste el WiFi: conéctalos por USB con un cable **de datos** y mete el WiFi en SlimeVR. Ojo: **Classic Fat/Mini se configuran APAGADOS**; **Revo ICM / BNO085 Ultimate, ENCENDIDOS**.",
        "Tras meter el WiFi: desenchúfalos del PC, apágalos y vuelve a encenderlos, y mira la pestaña HOME de SlimeVR.",
        "La red debe ser **2.4 GHz**, canal 1-11, seguridad **solo WPA2**, nombre y clave sin caracteres raros. El router en la misma habitación.",
        "Si salen en SlimeVR pero no en SteamVR: SteamVR → Startup/Shutdown → activa SlimeVR → reinicia SteamVR.",
        "Si tus trackers usan **dongle/receptor (Smol)**, mira el video de emparejar.",
      ],
      en: [
        "**Restart the trackers** (off, 5 s, on) and **restart your router**. This fixes most cases.",
        "Leave them still on the floor and open SlimeVR Server on the PC.",
        "If you never set up WiFi: plug them in via USB with a **data** cable and enter your WiFi in SlimeVR. Note: **Classic Fat/Mini are set up while OFF**; **Revo ICM / BNO085 Ultimate while ON**.",
        "After entering WiFi: unplug them from the PC, turn them off and on, and check the HOME tab in SlimeVR.",
        "The network must be **2.4 GHz**, channel 1-11, **WPA2 only**, with no special characters in the name/password. Router in the same room.",
        "If they show in SlimeVR but not in SteamVR: SteamVR → Startup/Shutdown → enable SlimeVR → restart SteamVR.",
        "If your trackers use a **dongle/receiver (Smol)**, watch the pairing video.",
      ],
    },
    videos: [
      { t: "SlimeVR setup guide (official)", u: yt("SkfdraicN5s") },
      { t: "Configurar trackers SlimeVR (VRMods, español)", u: yt("GjvZ-U0kcME") },
      { t: "How to sync new Smol trackers (Usagi VR)", u: yt("HaldUGryrf4") },
    ],
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
        "Los routers de la compañía de internet (y los de residencias) suelen dar problemas: lo que mejor funciona es un **router barato extra solo para los trackers**.",
      ],
      en: [
        "Restart the router and the trackers.",
        "**2.4 GHz** network (5 GHz doesn't work). If your router merges 2.4 and 5 GHz under one name, split them.",
        "Channel **1 to 11**, **WPA2 only** (not WPA3 or mixed), name and password with letters and numbers only.",
        "Ping must be **under 20 ms**: router in the same room.",
        "If you changed routers, enter the WiFi again over USB.",
        "PC: Windows network profile set to **Private**, run SlimeVR's `firewall.bat` as administrator, no VPN or guest network.",
        "ISP routers (and dorm networks) often cause trouble: what works best is a **cheap extra router just for the trackers**.",
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
        "Trackers quietos en el suelo 2 minutos al encenderlos.",
        "Póntelos, de pie y recto, pies separados ~10 cm.",
        "SlimeVR: **Automatic Mounting** (pose de esquí) → VRChat: **Calibrate FBT** → SlimeVR: **Full Reset**.",
        "Tu altura igual en SlimeVR y en VRChat.",
        "Al sentarte o tumbarte haz un **Yaw Reset**.",
        "Si las piernas se cruzan: tobillos al costado, muslos justo encima de la rodilla, y revisa Manual Mounting.",
      ],
      en: [
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
    id: "quest",
    claves: ["quest", "standalone", "sin pc", "without pc", "osc", "android", "movil", "phone"],
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
    claves: ["bateria", "battery", "dura poco", "lasts", "charging", "cargando", "parpadean", "blinking", "both lights"],
    titulo: { es: "Batería", en: "Battery" },
    pasos: {
      es: [
        "\"Dice que está cargando y no lo está\": es normal justo al quitarlo del cargador, se corrige solo en unos 10 minutos.",
        "Si las dos luces parpadean, dura menos de 1 hora o se apaga al desenchufarlo, es un problema de batería: pulsa el botón de abajo y un compañero te ayudará.",
      ],
      en: [
        "\"It says it's charging but it isn't\": this is normal right after unplugging, it fixes itself in about 10 minutes.",
        "If both lights blink, it lasts under 1 hour, or it dies when unplugged, it's a battery problem: press the button below and a teammate will help you.",
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
  return TEMAS.map((t) => `## ${t.titulo[idioma]}\n- ${t.pasos[idioma].join("\n- ")}`).join("\n\n");
}

module.exports = { TEMAS, buscarTemas, normalizar, resumenParaIA };
