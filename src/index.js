"use strict";

/**
 * Bot de soporte de USAGIVR.
 *
 * Flujo: panel con boton -> formulario (pedido, nombre, problema) -> canal
 * privado del ticket -> respuesta guiada (pasos + videos + dibujos) o IA ->
 * "¿Se soluciono?" -> si no, ping al rol de soporte -> al cerrar, resumen en
 * el hilo del usuario dentro del canal de historial (solo admins y soporte).
 *
 * No guarda estado en disco: los datos del ticket viven en el tema del canal,
 * asi sobrevive a los reinicios de cada sesion de GitHub Actions.
 */

const fs = require("node:fs");
const path = require("node:path");
const {
  Client, GatewayIntentBits, Partials, ChannelType, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
  AttachmentBuilder, SlashCommandBuilder,
} = require("discord.js");
const { TEMAS, buscarTemas, resumenParaIA } = require("./kb");
const { responder } = require("./ia");
const { T } = require("./textos");
const { notasFaq } = require("./faq");
const { textoReglas, casoEspecial, PROHIBIDO } = require("./reglas");

const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "config.json"), "utf8"));
const ASSETS = path.join(__dirname, "..", "assets");
const COLOR = 0xff6fb5;
const MARCA = "usagivr-ticket";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

// ------------------------------------------------------------ utilidades
// Cada servidor puede llamar distinto a un rol: CFG.servidores[id].roles = { "Hellper": "Helpper" }.
const nombreRol = (guild, nombre) => ((guild && CFG.servidores?.[guild.id]?.roles) || {})[nombre] || nombre;
const rolPorNombre = (guild, nombre) => {
  const real = nombreRol(guild, nombre).toLowerCase();
  return guild.roles.cache.find((r) => r.name.toLowerCase() === real);
};

const idiomaTicket = new Map(); // canal -> idioma que el cliente esta usando en esta sesion

function idiomaDe(member, texto = "", previo = null) {
  const tiene = (n) => member && member.roles && member.roles.cache.some((r) => r.name.toLowerCase() === nombreRol(member.guild, n).toLowerCase());
  const t = ` ${texto.toLowerCase().replace(/[?!.,¿¡]/g, (c) => ` ${c} `)} `;
  // Lo que pide el cliente manda sobre todo.
  if (/(en|in) (espanol|español|espaniol|spanish)|habla(me)? (en )?espa/.test(t)) return "es";
  if (/(en|in) (ingles|inglés|english)|speak english/.test(t)) return "en";
  const en = tiene(CFG.roles.ingles);
  const es = tiene(CFG.roles.espanol);
  if (es && !en) return "es";
  if (en && !es) return "en";
  // Sin rol (o con los dos): se adivina por el texto comparando pistas de cada idioma.
  const fuertes = [" hola ", "gracias", "ñ", "¿", "¡", " ayuda", " oye ", " porfa"];
  if (fuertes.some((p) => t.includes(p))) return "es";
  const pistasEs = [" el ", " la ", " no ", " mi ", " mis ", " los ", " las ", " que ", " qué ", " se ", " me ", " y ", " de ", " como ", " cómo ", " cuanto ", " cuánto ", " por ", " para ", " con ", " es ", " una ", " un ", " tengo ", " quiero ", " pero ", " ya ", " deberia", " debería", " gustaria", " gustaría", " correa", " funciona", " conecta", " enciende", " prende", "á", "é", "ó"];
  const pistasEn = [" the ", " my ", " is ", " it ", " i ", " i'm ", " how ", " what ", " not ", " don't ", " doesn't ", " won't ", " can ", " please ", " with ", " and ", " to ", " on ", " of ", " help ", " why ", " does ", " should "];
  const nEs = pistasEs.filter((p) => t.includes(p)).length;
  const nEn = pistasEn.filter((p) => t.includes(p)).length;
  if (nEs > nEn) return "es";
  if (nEn > nEs) return "en";
  return previo || (nEs ? "es" : "en");
}

function esEquipo(member) {
  if (!member) return false;
  if (member.permissions && member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const soporte = nombreRol(member.guild, CFG.roles.soporte).toLowerCase();
  return member.roles.cache.some((r) => r.name.toLowerCase() === soporte);
}

// Datos del ticket guardados en el tema del canal: "usagivr-ticket uid=.. lang=.. estado=.. temas=.."
function leerTicket(canal) {
  const topic = canal && canal.topic;
  if (!topic || !topic.startsWith(MARCA)) return null;
  const d = {};
  for (const par of topic.slice(MARCA.length).trim().split(/\s+/)) {
    const i = par.indexOf("=");
    if (i > 0) d[par.slice(0, i)] = decodeURIComponent(par.slice(i + 1));
  }
  return d;
}
const temaCanal = (d) => (`${MARCA} ` + Object.entries(d).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join(" ")).slice(0, 1024);
async function guardarTicket(canal, d) {
  await canal.setTopic(temaCanal(d)).catch((e) => console.warn("topic:", e.message));
}

function botonesTicket(lang) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("t:ok").setLabel(T[lang].resuelto).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("t:ayuda").setLabel(T[lang].noResuelto).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("t:cerrar").setLabel(T[lang].cerrar).setStyle(ButtonStyle.Secondary)
  );
}

const azar = (x) => (Array.isArray(x) ? x[Math.floor(Math.random() * x.length)] : x);
const muletilla = (lang) => azar(T[lang].muletillas);

// El cliente pide al equipo tecnico con sus palabras.
function pideHumano(texto) {
  const t = ` ${String(texto).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")} `;
  return [
    "un tecnico", "el tecnico", "al tecnico", "equipo tecnico", "servicio tecnico", "humano", "persona real", "una persona", "hablar con alguien", "con alguien del equipo", "equipo de soporte", "soporte tecnico", "agente", "encargado", "pasame con", "me pasas con",
    "human", "technician", "real person", "talk to someone", "speak to someone", "a person", "an agent", "staff", "tech team", "support team",
  ].some((p) => t.includes(p));
}

// --------------------------------------------------------------- panel
function mensajePanel() {
  const e = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`${T.en.panelTitulo} · ${T.es.panelTitulo}`)
    .setDescription(`🇬🇧 ${T.en.panelDesc}\n\n🇪🇸 ${T.es.panelDesc}`);
  const fila = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("panel:abrir").setLabel(`${T.en.abrir} / ${T.es.abrir}`).setStyle(ButtonStyle.Primary).setEmoji("🎫")
  );
  return { embeds: [e], components: [fila] };
}

async function asegurarPanel(guild) {
  const canal = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === nombrePanel(guild) && enCategoria(guild, c));
  if (!canal) return;
  const msgs = await canal.messages.fetch({ limit: 30 }).catch(() => null);
  const yaEsta = msgs && msgs.some((m) => m.author.id === client.user.id && m.components.length);
  if (!yaEsta) await canal.send(mensajePanel()).catch((e) => console.warn("panel:", e.message));
}

// Servidores con una categoria fija (CFG.servidores[id].categoria): panel, historial y tickets van todos ahi,
// privados para admins y el rol de soporte. No se crean roles ni se toca nada fuera de esa categoria.
const catFija = (guild) => {
  const id = CFG.servidores && CFG.servidores[guild.id] && CFG.servidores[guild.id].categoria;
  return id ? guild.channels.cache.get(id) || null : null;
};
const nombrePanel = (guild) => (CFG.servidores && CFG.servidores[guild.id] && CFG.servidores[guild.id].panel) || CFG.canales.panel;
const enCategoria = (guild, c) => {
  const cat = catFija(guild);
  return !cat || c.parentId === cat.id;
};
// Canal privado: nadie lo ve salvo el bot, admins (por permiso) y el rol de soporte.
function permisosPrivados(guild, extraSoporte = []) {
  const soporte = rolPorNombre(guild, CFG.roles.soporte);
  const p = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles] },
  ];
  if (soporte) p.push({ id: soporte.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, ...extraSoporte] });
  return p;
}

// Solo en los servidores listados: crea roles (solo pruebas) y canal del panel si faltan.
async function montarServidor(guild) {
  const cat = catFija(guild);
  if (CFG.servidores && CFG.servidores[guild.id]) {
    await guild.roles.fetch().catch(() => {});
    if (!cat) return console.warn(`${guild.name}: no encuentro la categoría ${CFG.servidores[guild.id].categoria}`);
    if (!rolPorNombre(guild, CFG.roles.soporte)) console.warn(`${guild.name}: no existe el rol ${nombreRol(guild, CFG.roles.soporte)}`);
    if (!guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === nombrePanel(guild) && c.parentId === cat.id)) {
      await guild.channels
        .create({ name: nombrePanel(guild), type: ChannelType.GuildText, parent: cat.id, permissionOverwrites: permisosPrivados(guild), topic: "Panel de tickets de soporte USAGIVR (en pruebas: solo admins y soporte)." })
        .then((c) => console.log(`${guild.name}: creado #${c.name}`))
        .catch((e) => console.warn("canal:", e.message));
    }
    return;
  }
  if (!(CFG.montarEnServidores || []).includes(guild.id)) return;
  await guild.roles.fetch().catch(() => {});
  for (const nombre of Object.values(CFG.roles)) {
    if (!rolPorNombre(guild, nombre)) await guild.roles.create({ name: nombre, reason: "soporte USAGIVR" }).catch((e) => console.warn("rol:", e.message));
  }
  if (!guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === CFG.canales.panel)) {
    await guild.channels.create({ name: CFG.canales.panel, type: ChannelType.GuildText }).catch((e) => console.warn("canal:", e.message));
  }
}

// ------------------------------------------------------------ historial
async function canalHistorial(guild) {
  let canal = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === CFG.canales.historial && enCategoria(guild, c));
  if (canal) return canal;
  const cat = catFija(guild);
  const soporte = rolPorNombre(guild, CFG.roles.soporte);
  const permisos = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.ManageThreads, PermissionFlagsBits.AttachFiles] },
  ];
  if (soporte) permisos.push({ id: soporte.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessagesInThreads] });
  canal = await guild.channels.create({
    name: CFG.canales.historial,
    type: ChannelType.GuildText,
    ...(cat ? { parent: cat.id } : {}),
    topic: "Historial de soporte por cliente: un hilo por usuario (problema y cómo se resolvió). Solo admins y soporte.",
    permissionOverwrites: permisos,
  });
  return canal;
}

// Respuestas que el equipo marca como "la que se esperaba" (mensaje entero en **negritas**):
// se guardan en #correcciones-ia con la pregunta del cliente y lo que contesto el bot, para revisarlas.
async function canalCorrecciones(guild) {
  const nombre = CFG.canales.correcciones || "correcciones-ia";
  let canal = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === nombre && enCategoria(guild, c));
  if (canal) return canal;
  const cat = catFija(guild);
  const soporte = rolPorNombre(guild, CFG.roles.soporte);
  const permisos = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory] },
  ];
  if (soporte) permisos.push({ id: soporte.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] });
  return guild.channels.create({
    name: nombre,
    type: ChannelType.GuildText,
    ...(cat ? { parent: cat.id } : {}),
    topic: "Respuestas que el equipo marcó como la que se esperaba (**en negritas** dentro de un ticket). Sirven para ajustar al bot.",
    permissionOverwrites: permisos,
  });
}

const esCorreccion = (texto) => /^\*\*[\s\S]+\*\*$/.test((texto || "").trim());
const corta = (t, n = 1024) => (t && t.length > n ? t.slice(0, n - 1) + "…" : t || "—");

async function guardarCorreccion(msg, d) {
  const esperada = msg.content.trim().replace(/^\*\*|\*\*$/g, "").trim();
  const previos = [...(await msg.channel.messages.fetch({ limit: 30, before: msg.id }).catch(() => new Map())).values()]; // del mas nuevo al mas viejo
  // Respuesta del bot a la que se refiere: la citada (responder a un mensaje) o la ultima que mando con texto.
  let bot = msg.reference && previos.find((m) => m.id === msg.reference.messageId);
  if (!bot || bot.author.id !== client.user.id) bot = previos.find((m) => m.author.id === client.user.id && m.content && m.content.length > 25);
  // Lo que escribio el cliente justo antes de esa respuesta (la rafaga completa).
  const cliente = [];
  if (bot) {
    for (const m of previos.slice(previos.indexOf(bot) + 1)) {
      if (m.author.id === d.uid) cliente.unshift(m.content);
      else if (cliente.length) break;
    }
  }
  const pregunta = cliente.join("\n") || `(formulario) ${d.problema || ""}`;
  const e = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`📝 Corrección en #${msg.channel.name}`)
    .setURL(msg.url)
    .addFields(
      { name: "Cliente preguntó", value: corta(pregunta) },
      { name: "Bot contestó", value: corta(bot ? bot.content : "(no encontré respuesta del bot)") },
      { name: "Respuesta que se esperaba", value: corta(esperada) },
      { name: "Idioma", value: d.lang || "?", inline: true },
      { name: "Marcó", value: msg.author.username, inline: true },
      { name: "Pedido", value: corta(d.pedido, 100), inline: true },
    )
    .setTimestamp(msg.createdAt);
  const canal = await canalCorrecciones(msg.guild);
  await canal.send({ embeds: [e] });
  console.log(`correccion guardada de ${msg.author.username} en ${msg.channel.name}`);
}

async function hiloDeUsuario(guild, userId, etiqueta) {
  const canal = await canalHistorial(guild);
  const busca = (col) => col.find((h) => h.name.endsWith(`· ${userId}`));
  let hilo = busca((await canal.threads.fetchActive()).threads);
  if (!hilo) hilo = busca((await canal.threads.fetchArchived({ limit: 100 }).catch(() => ({ threads: new Map() }))).threads);
  if (hilo) {
    if (hilo.archived) await hilo.setArchived(false).catch(() => {});
    return hilo;
  }
  const inicio = await canal.send(`📁 **${etiqueta}** (<@${userId}>)`);
  return inicio.startThread({ name: `${etiqueta}`.slice(0, 70) + ` · ${userId}`, autoArchiveDuration: 10080 });
}

async function transcripcion(canal) {
  const todos = [];
  let antes;
  for (let i = 0; i < 5; i++) {
    const lote = await canal.messages.fetch({ limit: 100, before: antes }).catch(() => null);
    if (!lote || !lote.size) break;
    todos.push(...lote.values());
    antes = lote.last().id;
  }
  return todos
    .reverse()
    .map((m) => {
      const extra = m.embeds.map((e) => [e.title, e.description, ...(e.fields || []).map((f) => `${f.name}: ${f.value}`)].filter(Boolean).join("\n")).join("\n");
      return `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}${extra ? `\n${extra}` : ""}`;
    })
    .join("\n");
}

async function registrar(canal, d, resultado, solucion, quien) {
  try {
    const hilo = await hiloDeUsuario(canal.guild, d.uid, d.usuario || d.uid);
    const e = new EmbedBuilder()
      .setColor(resultado.startsWith("✅") ? 0x3ba55d : resultado.startsWith("🆘") ? 0xed4245 : 0xfaa61a)
      .setTitle(`Ticket ${canal.name}`)
      .addFields(
        { name: "Pedido", value: d.pedido || "-", inline: true },
        { name: "Nombre", value: d.nombre || "-", inline: true },
        { name: "Idioma", value: d.lang, inline: true },
        { name: "Problema", value: (d.problema || "-").slice(0, 1000) },
        { name: "Temas detectados", value: d.temas || "ninguno (IA)" },
        { name: "Resultado", value: resultado },
        { name: "Cómo se resolvió", value: (solucion || "-").slice(0, 1000) }
      )
      .setFooter({ text: quien ? `Gestionado por ${quien}` : "Gestionado por el bot" })
      .setTimestamp();
    const txt = await transcripcion(canal);
    await hilo.send({ embeds: [e], files: [new AttachmentBuilder(Buffer.from(txt, "utf8"), { name: `${canal.name}.txt` })] });
  } catch (err) {
    console.warn("historial:", err.message);
  }
}

// ------------------------------------------------------------ respuestas
function embedsTema(tema, lang) {
  const e = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(tema.titulo[lang])
    .setDescription(tema.pasos[lang].map((p, i) => `**${i + 1}.** ${p}`).join("\n"));
  if (tema.videos.length) e.addFields({ name: `🎬 ${T[lang].videos}`, value: tema.videos.map((v) => `[${v.t}](${v.u})`).join("\n") });
  const files = tema.imagenes.filter((f) => fs.existsSync(path.join(ASSETS, f))).map((f) => new AttachmentBuilder(path.join(ASSETS, f), { name: f }));
  if (files.length) e.setImage(`attachment://${files[0].name}`);
  return { embeds: [e], files };
}

function promptSistema(lang) {
  const idioma = lang === "es" ? "Spanish" : "English";
  return [
    `You are the support assistant of ${CFG.nombreTienda}, a shop that sells SlimeVR-compatible full-body trackers (IceCube, LSM6DSV/LSM6DSR and ICM-45686 models).`,
    "Product facts: kits have 5 to 11 trackers. Receiver kits include a receiver antenna/dongle (a small one or a bigger pentagon-shaped one) that plugs into a USB port on the PC; WiFi kits have no antenna. Trackers normally come already paired to their antenna; if one isn't, give the Smol pairing guide (no_conecta); for WiFi trackers give the WiFi setup steps even though SlimeVR also guides it. If they use the antenna, remind them it must be uncovered and facing the area where they play. " +
    "Kit contents: instruction manual, a bundle of USB to USB-C cables, and straps: 2 thick anti-slip straps for the thighs, 2 or 3 long straps (depending on the kit) for waist, chest and hip, and regular straps for the rest. " +
    "Every tracker has our character's face printed on it: that face must always face forward. For calibration, always tell them to follow the calibration guides SlimeVR shows inside the program. " +
    "Devices: not available for iPhone or Mac yet; we recommend an Android phone with the SlimeVR app from the official website; on PC, SlimeVR is downloaded from Steam. Install order (also after formatting the PC): SteamVR first and open it once, then SlimeVR so its plugins/driver apply. " +
    "If the little button came off: usually not needed, don't worry, only matters if it causes problems. If WiFi trackers still won't connect after every step: internet providers often block some connections on their routers, which affects WiFi trackers only; a cheap extra router just for the trackers fixes it.",
    `Always answer in ${idioma}. Talk like a chill, friendly person from the team, not a robot: relaxed and warm, tuteo, short messages, no headings, no corporate phrases.`,
    lang === "es" && "Spanish variant: neutral Latin American leaning Mexican, NEVER Spain Spanish. Use \"¿ya intentaste…?\" (not \"¿has probado a…?\"), \"dale clic / presiona\" (not \"pulsa/pincha\"), \"llenar\" (not \"rellenar\"), \"computadora o PC\" (not \"ordenador\"), \"celular\" (not \"móvil\"), \"ustedes\" (never \"vosotros\", \"os\", \"vale\", \"coger\"), \"mantenlo\" without accent. Prefer simple past (\"ya lo cargaste\") over \"has cargado\". No modern internet slang or anglicisms (\"random\", \"literal\", \"crack\", \"bro\").",
    "Keep the slang light: at most one casual word per message (in Spanish, Mexican-style like \"va\", \"sale\", \"tranqui\", \"no te preocupes\", \"ahorita\"). Never use \"wey\", \"carnal\", \"bro\", \"compa\", \"neta\" or regional slang from other countries, never pile up exclamations or emojis (max one emoji, usually none), never talk like a cartoon. It must sound like a real person from a small shop answering a customer.",
    "Be very understanding: first show you get the problem and how annoying it is, ask one short question if something is unclear, then suggest what to try (max 5 short numbered steps). Use only the knowledge below; it comes from the official manual and overrides anything else you know.",
    "Never invent prices, shipping dates or policies; for those, or if it really looks like a broken tracker, say a teammate from the tech team can look at it whenever they want and that they just have to ask for it or press the button.",
    "You never hand the ticket to a human yourself. Only if the customer clearly asks to talk to a human / the technical team, end with the exact tag [HUMANO].",
    "If the customer says it is solved, be happy for them and thank them.",
    "Tracker won't turn on: first ask if they tried the small reset button on the back of the tracker; then ask if, with the USB cable plugged in, it turns on and shows up in SlimeVR (if yes, it's the battery).",
    "Battery drains fast / doesn't last: explain kindly that it's hard to judge from a description because we need to see how fast it drains, and ask for a video or some proof (e.g. battery % in SlimeVR at the start and after a while).",
    "Returns, refunds, exchanges, replacements, money or warranty: NEVER talk about them, never say those words (not even to deny them), never promise or refuse anything. If the customer seems to want any of that, just say kindly that a teammate will attend them, then end with [HUMANO].",
    "Sound natural and vary your wording: don't start every reply the same way, don't repeat the same phrases you already used in this chat. No weird jokes, no made-up expressions or acronyms; plain everyday words.",
    "Do not invent hardware details that are not in the knowledge (LED colors or meanings, how many seconds to hold a button, what comes in the kit). Start replies naturally, not always with \"Hola, entiendo\".",
    "The order number and name are already in the ticket form: never ask for them again.",
    "Read the whole conversation: figure out which step the customer is on and answer what they need NEXT; never repeat instructions for something they say they already did.",
    "The customer often sends several messages in a row. Answer EVERY question or problem they wrote since your last reply (briefly, one after another), not only the last message.",
    `Each knowledge section has an id in brackets and a picture/video guide. If one guide is exactly what the customer needs next, end with the tag [GUIA:id] (at most one, e.g. [GUIA:no_conecta]); never attach a guide that was already sent or covers a step they already did.`,
    textoReglas(lang),
    "",
    "KNOWLEDGE:",
    resumenParaIA(lang),
  ].filter((x) => x !== false).join("\n");
}

const ocupados = new Set();
const pendientes = new Map(); // mensajes que llegaron mientras la IA contestaba otro: se contestan al terminar
async function respuestaIA(canal, d, extraUsuario) {
  if (ocupados.has(canal.id)) return;
  ocupados.add(canal.id);
  let limpiar = () => {};
  try {
    // "Escribiendo..." todo el rato; si la IA de la nube tarda, una muletilla para que no suene a robot.
    await canal.sendTyping().catch(() => {});
    const escribiendo = setInterval(() => canal.sendTyping().catch(() => {}), 8000);
    const lenta = setTimeout(() => canal.send(muletilla(d.lang)).catch(() => {}), (CFG.muletillaTrasSeg || 6) * 1000);
    limpiar = () => { clearInterval(escribiendo); clearTimeout(lenta); };
    const hist = await canal.messages.fetch({ limit: 12 }).catch(() => null);
    let sistema = promptSistema(d.lang);
    if (d.soloConsejos) sistema += "\n\nThe customer is asking for an exchange/refund: a teammate will take over right after your message. Only give the TEAM RULES tips for their case (photo, how it happened, drying…), say nothing about exchanges, coverage or money, don't offer the team and don't use [HUMANO].";
    if (d.estado === "escalado") sistema += "\n\nA human from the tech team has already been called and will join soon. Keep helping meanwhile, tell the customer they are on the way, and do not use [HUMANO].";
    const mensajes = [{ role: "system", content: sistema }];
    mensajes.push({ role: "user", content: `Order: ${d.pedido}\nName: ${d.nombre}\nProblem: ${d.problema}` });
    if (hist) {
      for (const m of [...hist.values()].reverse()) {
        if (!m.content || m.content.length < 2 || esCorreccion(m.content)) continue;
        if (m.author.id === client.user.id) {
          const guia = m.embeds.map((e) => e.title).filter(Boolean).join(", ");
          const txt = [m.content, guia && `(guide sent: ${guia})`].filter(Boolean).join("\n");
          if (txt) mensajes.push({ role: "assistant", content: txt.slice(0, 800) });
        }
        else if (m.author.id === d.uid) mensajes.push({ role: "user", content: m.content.slice(0, 800) });
        else mensajes.push({ role: "user", content: `[Support staff ${m.author.username}]: ${m.content.slice(0, 600)}` });
      }
    }
    // El historial ya trae los mensajes del cliente; solo se anade si aun no aparece (p. ej. al arrancar).
    // Mensajes seguidos del mismo lado en uno solo: asi la IA ve la rafaga completa y contesta todo.
    for (let i = mensajes.length - 1; i > 1; i--) {
      if (mensajes[i].role === mensajes[i - 1].role && i - 1 > 0) {
        mensajes[i - 1].content += "\n" + mensajes[i].content;
        mensajes.splice(i, 1);
      }
    }
    if (extraUsuario && !mensajes.some((x) => x.role === "user" && x.content.includes(extraUsuario.split("\n").pop()))) mensajes.push({ role: "user", content: extraUsuario });
    // FAQ de la tienda: las preguntas más parecidas a lo último que escribió el cliente.
    const ultimoCliente = [...mensajes].reverse().find((x) => x.role === "user");
    if (ultimoCliente) mensajes[0].content += notasFaq(ultimoCliente.content, d.lang);
    const idioma = d.lang === "es" ? "Spanish (neutral Latin American)" : "English";
    mensajes[0].content += `\n\nREPLY ONLY IN ${idioma.toUpperCase()}, whatever language the knowledge or the customer's form uses.`;
    let { texto, backend } = await responder(CFG.ia, mensajes).catch((e) => { limpiar(); throw e; });
    // Si se le fue al otro idioma, un segundo intento con la orden al final de la charla.
    if (idiomaDe(null, texto.replace(/\[[^\]]*\]/g, "")) !== d.lang) {
      console.warn(`IA contesto en otro idioma en ${canal.name}, reintento`);
      const otra = await responder(CFG.ia, [...mensajes, { role: "system", content: `Rewrite your answer in ${idioma}. Only ${idioma}.` }]).catch(() => null);
      if (otra && idiomaDe(null, otra.texto.replace(/\[[^\]]*\]/g, "")) === d.lang) ({ texto, backend } = otra);
    }
    // Palabras que nunca debe decir (cambios, reembolsos, tramites inventados): un intento mas y si no, lo atiende un compañero.
    if (PROHIBIDO.test(texto)) {
      console.warn(`IA dijo algo prohibido en ${canal.name}, reintento`);
      const otra = await responder(CFG.ia, [...mensajes, { role: "assistant", content: texto }, { role: "system", content: "Rewrite that answer WITHOUT promising or mentioning replacements, refunds, returns, exchanges, warranty, sending a new unit, emails or registered requests. Follow the TEAM RULES. Same language, same casual tone." }]).catch(() => null);
      if (otra && !PROHIBIDO.test(otra.texto)) texto = otra.texto;
      else {
        limpiar();
        if (d.estado === "escalado") await canal.send(T[d.lang].devolucionYa);
        else await escalarTicket(canal, d, "La IA iba a hablar de cambios/garantía", T[d.lang].devolucion);
        return;
      }
    }
    limpiar();
    console.log(`IA (${backend}) en ${canal.name}`);
    // La IA a veces pone [HUMANO] sin que nadie lo pida: solo vale si el cliente insinuo persona/equipo/devolucion.
    const ultimos = mensajes.filter((x) => x.role === "user").slice(-1).map((x) => x.content).join(" ");
    const insinua = /human|persona|alguien|equipo|tecnico|técnico|soporte|agente|real|team|someone|staff|support|devol|regres|reembol|reempla|remplaz|cambi|garant|refund|return|replace|warrant|exchange/i.test(ultimos);
    const escalar = /\[HUMANO\]/i.test(texto) && insinua && !d.soloConsejos;
    const guias = [...texto.matchAll(/\[GUIA:\s*([a-z_]+)\]/gi)].map((m) => TEMAS.find((t) => t.id === m[1].toLowerCase())).filter(Boolean).slice(0, 1);
    const limpio = texto.replace(/\[(HUMANO|ESCALATE|GUIA:[^\]]*)\]/gi, "").trim().slice(0, 1900);
    for (const g of guias) await canal.send(embedsTema(g, d.lang)).catch((e) => console.warn("guia:", e.message));
    // El cierre "si quieres te paso con el equipo" solo si la IA no lo dijo ya.
    const yaOfrece = escalar || d.soloConsejos || /equipo|compa[nñ]ero|team|necesito ayuda|need help/i.test(limpio);
    await canal.send({ content: yaOfrece ? limpio : `${limpio}\n\n${azar(T[d.lang].sigue)}`, components: d.soloConsejos ? [] : [botonesTicket(d.lang)] });
    if (escalar) await escalarTicket(canal, d, "El cliente pidió hablar con el equipo técnico");
  } catch (e) {
    console.warn("IA:", e.message);
    // Sin escalar: solo el cliente decide cuando llamar al equipo. Si la IA cae, al menos la guia que encaje.
    const temas = extraUsuario ? buscarTemas(extraUsuario) : [];
    if (temas.length) for (const t of temas) await canal.send(embedsTema(t, d.lang)).catch(() => {});
    else await canal.send(T[d.lang].errorIA).catch(() => {});
  } finally {
    limpiar();
    ocupados.delete(canal.id);
    const otra = pendientes.get(canal.id);
    if (otra) {
      pendientes.delete(canal.id);
      respuestaIA(canal, otra); // el historial ya trae los mensajes nuevos
    }
  }
}

// Devoluciones, reembolsos, reemplazos, garantia: siempre con un companero del equipo.
function pideDevolucion(texto) {
  const t = ` ${String(texto).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")} `;
  return [
    "devolucion", "devolver", "regresarlo", "regresarla", "regresarlos", "regresar el", "regresar los", "reembolso", "rembolso", "reembolsar", "mi dinero",
    "reemplazo", "remplazo", "reemplazar", "remplazar", "cambio por otro", "cambiarlo por", "me lo cambien", "me los cambien", "cambien por", "uno nuevo", "otro nuevo", "garantia", "reclamo", "cancelar mi pedido", "cancelar el pedido",
    "refund", "return it", "return them", "return the", "send it back", "send them back", "money back", "replacement", "replace it", "replace my", "warranty", "rma", "exchange",
  ].some((p) => t.includes(p));
}
// Reparte los tickets escalados entre los Helpper, por turnos. Sin lista de miembros, se menciona el rol.
const turnoHelper = new Map();
async function elegirHelper(guild, rol) {
  if (!rol) return null;
  let miembros = [...rol.members.values()];
  if (!miembros.length) {
    const lista = await guild.members.list({ limit: 1000 }).catch(() => null);
    if (lista) miembros = [...lista.values()].filter((m) => m.roles.cache.has(rol.id));
  }
  miembros = miembros.filter((m) => !m.user.bot).sort((a, b) => a.id.localeCompare(b.id));
  if (!miembros.length) return null;
  const i = ((turnoHelper.get(guild.id) ?? -1) + 1) % miembros.length;
  turnoHelper.set(guild.id, i);
  return miembros[i];
}

async function escalarTicket(canal, d, motivo, texto) {
  if (d.estado === "escalado") return;
  const rol = rolPorNombre(canal.guild, CFG.roles.soporte);
  const helper = await elegirHelper(canal.guild, rol);
  d.estado = "escalado";
  if (helper) d.asignado = helper.user.username;
  await guardarTicket(canal, d);
  const quien = helper ? `<@${helper.id}>` : rol ? `<@&${rol.id}>` : `@${CFG.roles.soporte}`;
  await canal.send({
    content: (texto || T[d.lang].companero)(quien),
    allowedMentions: helper ? { users: [helper.id] } : { roles: rol ? [rol.id] : [] },
  });
  await registrar(canal, d, "🆘 Escalado a soporte", helper ? `${motivo} · asignado a ${helper.user.username}` : motivo, null);
}

// --------------------------------------------------------------- tickets
async function categoriaTickets(guild) {
  if (catFija(guild)) return catFija(guild);
  let cat = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === CFG.canales.categoriaTickets);
  if (cat) return cat;
  const soporte = rolPorNombre(guild, CFG.roles.soporte);
  const permisos = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.SendMessages] },
  ];
  if (soporte) permisos.push({ id: soporte.id, allow: [PermissionFlagsBits.ViewChannel] });
  return guild.channels.create({ name: CFG.canales.categoriaTickets, type: ChannelType.GuildCategory, permissionOverwrites: permisos });
}

function modalTicket(lang) {
  const t = T[lang];
  const campo = (id, label, estilo, max, ph) => {
    const c = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(estilo).setRequired(true).setMaxLength(max);
    if (ph) c.setPlaceholder(ph);
    return new ActionRowBuilder().addComponents(c);
  };
  return new ModalBuilder()
    .setCustomId("modal:ticket")
    .setTitle(t.modalTitulo)
    .addComponents(
      campo("pedido", t.campoPedido, TextInputStyle.Short, 60),
      campo("nombre", t.campoNombre, TextInputStyle.Short, 80),
      campo("problema", t.campoProblema, TextInputStyle.Paragraph, 1500, t.campoProblemaPh)
    );
}

async function abrirTicket(inter) {
  const guild = inter.guild;
  const pedido = inter.fields.getTextInputValue("pedido").trim();
  const nombre = inter.fields.getTextInputValue("nombre").trim();
  const problema = inter.fields.getTextInputValue("problema").trim();
  const lang = idiomaDe(inter.member, problema);
  await inter.deferReply({ ephemeral: true });

  const abierto = guild.channels.cache.find((c) => {
    const d = leerTicket(c);
    return d && d.uid === inter.user.id && d.estado !== "cerrado";
  });
  if (abierto) return inter.editReply(T[lang].yaTienes(`<#${abierto.id}>`));

  const cat = await categoriaTickets(guild);
  const soporte = rolPorNombre(guild, CFG.roles.soporte);
  const permisos = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: inter.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.MentionEveryone] },
  ];
  if (soporte) permisos.push({ id: soporte.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] });
  const temas = casoEspecial(problema) ? [] : buscarTemas(problema);
  const d = { uid: inter.user.id, usuario: inter.user.username, lang, estado: "abierto", pedido, nombre, problema: problema.slice(0, 500), temas: temas.map((t) => t.id).join(",") };
  // El tema va en la creacion: editar el tema despues tiene un tope de 2 cambios cada 10 min.
  const canal = await guild.channels.create({
    name: `ticket-${inter.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 90),
    type: ChannelType.GuildText,
    parent: cat.id,
    topic: temaCanal(d),
    permissionOverwrites: permisos,
  });
  await inter.editReply(T[lang].creado(`<#${canal.id}>`));

  const ficha = new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: inter.user.tag, iconURL: inter.user.displayAvatarURL() })
    .addFields(
      { name: T[lang].campoPedido, value: pedido, inline: true },
      { name: T[lang].campoNombre, value: nombre, inline: true },
      { name: T[lang].campoProblema, value: problema.slice(0, 1024) }
    );
  await canal.send({ content: `<@${inter.user.id}>`, embeds: [ficha] });

  if (pideDevolucion(problema)) await casoDevolucion(canal, d, problema);
  else if (temas.length) {
    await canal.send(azar(T[lang].bienvenida)(inter.user.username));
    for (const tema of temas) {
      await canal.send(embedsTema(tema, lang));
      if (tema.escalar) await canal.send(T[lang].ofrecerEquipo);
    }
    await canal.send({ content: T[lang].pregunta, components: [botonesTicket(lang)] });
  } else {
    await respuestaIA(canal, d);
  }
}

async function cerrarCanal(canal, d) {
  d.estado = "cerrado";
  await guardarTicket(canal, d);
  await canal.permissionOverwrites.edit(d.uid, { SendMessages: false }).catch(() => {});
  const min = CFG.borrarTicketCerradoTrasMin;
  await canal.send(T[d.lang].cerrado(min));
  setTimeout(() => canal.delete("ticket cerrado").catch(() => {}), min * 60000);
}

// ------------------------------------------------------------ eventos
client.on("interactionCreate", async (inter) => {
  try {
    if (inter.isChatInputCommand() && inter.commandName === "panel-soporte") {
      await inter.channel.send(mensajePanel());
      return inter.reply({ content: "Panel publicado.", ephemeral: true });
    }
    if (inter.isButton() && inter.customId === "panel:abrir") {
      return inter.showModal(modalTicket(idiomaDe(inter.member)));
    }
    if (inter.isModalSubmit() && inter.customId === "modal:ticket") return abrirTicket(inter);

    const d = leerTicket(inter.channel);
    if (!d) return;
    const equipo = esEquipo(inter.member);
    const dueno = inter.user.id === d.uid;

    if (inter.isButton() && inter.customId === "t:ok") {
      if (!dueno && !equipo) return inter.reply({ content: T[d.lang].soloDueno, ephemeral: true });
      await inter.reply(T[d.lang].gracias);
      const quien = equipo && !dueno ? inter.user.tag : null;
      await registrar(inter.channel, d, d.estado === "escalado" ? "✅ Resuelto (tras escalar)" : "✅ Resuelto por el bot",
        d.estado === "escalado" ? "Confirmado como resuelto" : `Con los pasos de: ${d.temas || "respuesta de la IA"}`, quien);
      return cerrarCanal(inter.channel, d);
    }
    if (inter.isButton() && inter.customId === "t:ayuda") {
      if (!dueno && !equipo) return inter.reply({ content: T[d.lang].soloDueno, ephemeral: true });
      await inter.deferUpdate();
      return escalarTicket(inter.channel, d, "El cliente dijo que no se solucionó");
    }
    if (inter.isButton() && inter.customId === "t:cerrar") {
      if (!equipo) return inter.reply({ content: T[d.lang].soloEquipo, ephemeral: true });
      const m = new ModalBuilder().setCustomId("modal:cerrar").setTitle(T.es.cerrarModal).addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("solucion").setLabel(T.es.campoSolucion).setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)
        )
      );
      return inter.showModal(m);
    }
    if (inter.isModalSubmit() && inter.customId === "modal:cerrar") {
      if (!equipo) return inter.reply({ content: T[d.lang].soloEquipo, ephemeral: true });
      await inter.reply({ content: "✔", ephemeral: true });
      await registrar(inter.channel, d, "✅ Resuelto por el equipo", inter.fields.getTextInputValue("solucion"), inter.user.tag);
      return cerrarCanal(inter.channel, d);
    }
  } catch (e) {
    console.error("interaccion:", e);
    if (inter.isRepliable() && !inter.replied && !inter.deferred) inter.reply({ content: "Error", ephemeral: true }).catch(() => {});
  }
});

// Cambios, reembolsos o garantia: de eso no se habla, lo atiende un Helpper asignado.
// Si es algo roto o mojado, antes la IA da los consejos de las reglas (foto, secarlo...).
async function casoDevolucion(canal, d, texto) {
  if (d.estado === "escalado") return void (await canal.send(T[d.lang].devolucionYa));
  const dd = { ...d, soloConsejos: true };
  if (casoEspecial(texto)) await respuestaIA(canal, dd, texto); // si la guardia ya escalo, dd.estado cambia
  delete dd.soloConsejos;
  if (dd.estado !== "escalado") await escalarTicket(canal, dd, "Devolución / reemplazo / garantía", T[d.lang].devolucion);
}

// Atiende un mensaje del cliente en su ticket: siempre hay respuesta.
async function atender(canal, d, member, texto) {
  const lang = idiomaDe(member, texto, idiomaTicket.get(canal.id) || d.lang);
  idiomaTicket.set(canal.id, lang);
  console.log(`msg en ${canal.name} (${d.estado}, ${lang}): ${texto.slice(0, 80)}`);
  const dm = { ...d, lang };
  if (pideHumano(texto)) {
    if (d.estado === "escalado") return void (await canal.send(T[lang].yaViene));
    return escalarTicket(canal, dm, "El cliente pidió hablar con el equipo técnico");
  }
  if (pideDevolucion(texto)) return casoDevolucion(canal, dm, texto);
  // La IA lee toda la conversacion (sabe en que paso va el cliente) y elige ella la guia con video/dibujo.
  // Contesta tambien con el ticket escalado, mientras llega el companero.
  await respuestaIA(canal, dm, texto);
}

const esperas = new Map(); // canal -> temporizador de la rafaga de mensajes
client.on("messageCreate", async (msg) => {
  if (msg.author.bot || !msg.guild) return;
  const d = leerTicket(msg.channel);
  // El equipo marca en **negritas** la respuesta que se esperaba: se guarda y el bot no contesta.
  if (d && esEquipo(msg.member) && esCorreccion(msg.content)) {
    return guardarCorreccion(msg, d)
      .then(() => msg.react("📝").catch(() => {}))
      .catch((e) => { console.warn("correccion:", e.message); msg.react("⚠️").catch(() => {}); });
  }
  // Solo atiende al dueno del ticket; cerrado = nada.
  if (!d || msg.author.id !== d.uid || (d.estado !== "abierto" && d.estado !== "escalado")) return;
  // Espera unos segundos tras el ultimo mensaje: la gente escribe en rafagas y asi se lee todo junto.
  msg.channel.sendTyping().catch(() => {});
  const previa = esperas.get(msg.channel.id);
  if (previa) clearTimeout(previa.timer);
  const textos = [...((previa && previa.textos) || []), msg.content];
  const timer = setTimeout(() => {
    esperas.delete(msg.channel.id);
    const dd = leerTicket(msg.channel) || d;
    atender(msg.channel, dd, msg.member, textos.join("\n")).catch((e) => console.error("atender:", e));
  }, (CFG.esperarRafagaSeg || 7) * 1000);
  esperas.set(msg.channel.id, { timer, textos });
});

client.once("clientReady", async () => {
  console.log(`Conectado como ${client.user.tag} en ${client.guilds.cache.size} servidor(es): ${[...client.guilds.cache.values()].map((g) => `${g.name} (${g.id})`).join(", ")}`);
  const cmd = new SlashCommandBuilder()
    .setName("panel-soporte")
    .setDescription("Publica el panel de tickets de soporte en este canal")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON();
  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set([cmd]).catch((e) => console.warn("comandos:", e.message));
    await montarServidor(guild);
    await asegurarPanel(guild);
    if (catFija(guild)) await canalCorrecciones(guild).catch((e) => console.warn("correcciones:", e.message));
    // Tickets cerrados en una sesion anterior que no llegaron a borrarse.
    for (const c of guild.channels.cache.values()) {
      const d = leerTicket(c);
      if (d && d.estado === "cerrado") await c.delete("ticket cerrado").catch(() => {});
      // Mensajes del cliente que llegaron mientras el bot estaba apagado (reinicios): se contestan ahora.
      else if (d && c.isTextBased()) {
        const ult = await c.messages.fetch({ limit: 1 }).catch(() => null);
        const m = ult && ult.first();
        if (m && m.author.id === d.uid) {
          const member = await guild.members.fetch(d.uid).catch(() => null);
          console.log(`pendiente en ${c.name}`);
          atender(c, d, member, m.content).catch((e) => console.error("atender:", e)); // sin await: no frena el arranque
        }
      }
    }
  }
});

// Al invitarlo a un servidor nuevo: monta lo suyo sin esperar a un reinicio.
client.on("guildCreate", async (guild) => {
  console.log(`Añadido a ${guild.name} (${guild.id})`);
  await montarServidor(guild).catch((e) => console.warn("montar:", e.message));
  await asegurarPanel(guild).catch(() => {});
});

process.on("unhandledRejection", (e) => console.error("sin capturar:", e));

const minutos = Number(process.env.MINUTOS || 0);
if (minutos > 0) {
  setTimeout(() => {
    console.log("Fin de la sesion programada");
    client.destroy().finally(() => process.exit(0));
  }, minutos * 60000);
}

const token = process.env.DISCORD_TOKEN;
if (require.main === module) {
  if (!token) {
    console.error("Falta DISCORD_TOKEN");
    process.exit(1);
  }
  client.login(token);
}

module.exports = { pideDevolucion, promptSistema, pideHumano, idiomaDe, leerTicket };
