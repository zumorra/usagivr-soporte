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
const { responder, verFotos } = require("./ia");
const { analizarIdioma, idiomaRol, decidirIdioma, MARGEN } = require("./idioma");
const { auditar } = require("./auditor");
const { pedirRepetir, variantes } = require("./repetir");
const { enHorario, proximaApertura } = require("./horario");
const { T } = require("./textos");
const { notasFaq } = require("./faq");
const { textoReglas, casoEspecial, PROHIBIDO, COMPRA_FUERA, DANIO, LIQUIDO } = require("./reglas");

const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "config.json"), "utf8"));
const ASSETS = path.join(__dirname, "..", "assets");
const COLOR = 0xff6fb5;
const MARCA = "usagivr-ticket";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates],
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
// Idioma con el que se le habla AHORA al cliente: el de la sesion (si cambio de idioma) o el guardado en el tema.
const idiomaActual = (canal, d) => (canal && idiomaTicket.get(canal.id)) || (d && d.lang) || "en";
// Tras un reinicio no hay sesion: se deduce del ultimo mensaje claro del cliente (si no, el del tema).
function idiomaReciente(lista, d) {
  for (const m of lista) {
    if (m.author.id !== d.uid || !m.content) continue;
    const a = analizarIdioma(m.content);
    if (a.pedido) return a.pedido;
    if (a.lang && a.seguro) return a.lang;
  }
  return d.lang || "en";
}

// Idioma: lo que pide el cliente > como escribe (si es claro) > su rol English/Spanish > lo que se intuye.
function rolIdioma(member) {
  const tiene = (n) => member && member.roles && member.roles.cache.some((r) => r.name.toLowerCase() === nombreRol(member.guild, n).toLowerCase());
  return idiomaRol(tiene(CFG.roles.ingles), tiene(CFG.roles.espanol));
}
function idiomaDe(member, texto = "", previo = null) {
  const a = analizarIdioma(texto);
  if (a.pedido) return a.pedido;
  const rol = rolIdioma(member);
  if (a.lang && (a.seguro || !rol)) return a.lang;
  return rol || a.lang || previo || "en";
}
const estadoIdioma = new Map(); // canal -> { vistos, preguntado, pendiente }
// Sin estado (el bot se reinicio): el ticket ya venia de antes, su idioma queda fijo.
const FIJO = { vistos: MARGEN, preguntado: true };

function botonesIdioma() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("lang:es").setLabel("Español").setStyle(ButtonStyle.Primary).setEmoji("🇲🇽"),
    new ButtonBuilder().setCustomId("lang:en").setLabel("English").setStyle(ButtonStyle.Primary).setEmoji("🇺🇸")
  );
}
const PREGUNTA_IDIOMA = [
  "Perdón, no me quedó claro en qué idioma prefieres que te ayude. ¿Español o inglés?\nSorry, I'm not sure which language you'd like me to use. Spanish or English?",
  "Para ayudarte mejor, ¿seguimos en español o en inglés?\nTo help you better, should we continue in Spanish or English?",
  "Solo puedo ayudarte en español o en inglés. ¿Cuál prefieres?\nI can only help in Spanish or English. Which one do you prefer?",
];

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
// El tema tiene tope de 1024: el problema va al final y se recorta para que no se pierda ninguna otra clave.
const temaCanal = (d) => {
  const base = `${MARCA} ` + Object.entries(d).filter(([k, v]) => k !== "problema" && k !== "soloConsejos" && v != null && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join(" ");
  let p = String(d.problema || "");
  while (p && base.length + 10 + encodeURIComponent(p).length > 1024) p = p.slice(0, -20);
  return p ? `${base} problema=${encodeURIComponent(p)}` : base;
};
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

// Boton fijo arriba del ticket: el cliente cierra el ticket cuando se resuelva, sin esperar a nadie.
function botonListo(lang) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("t:listo").setLabel(T[lang].listo).setStyle(ButtonStyle.Success).setEmoji("✅"),
    new ButtonBuilder().setCustomId("t:voz").setLabel(T[lang].voz).setStyle(ButtonStyle.Secondary).setEmoji("🎙️")
  );
}
// "ya quedo", "ya funciona", "it works now"... corto y sin "pero": se le ofrece el boton, no se cierra solo.
const YA_QUEDO = /(?<![\p{L}\p{N}])(ya (qued[oó]|jal[oó]|funciona|sirve|prendi[oó]|conect[oó]|se (arregl[oó]|solucion[oó]|resolvi[oó]))|ya est[aá] (todo|resuelto|solucionado)|lo (logr[eé]|resolv[ií]|arregl[eé])|(it|everything) works( now)?|(it'?s|all) (fixed|solved|working)|i fixed it|that (worked|fixed it)|solved)(?![\p{L}\p{N}])/iu;
function yaQuedo(texto) {
  const t = (texto || "").trim();
  return t.length <= 120 && YA_QUEDO.test(t) && !/(?<![\p{L}])(pero|aunque|but|still|todav[ií]a|sigue|no (funciona|sirve|prende|conecta))(?![\p{L}])|\?/iu.test(t);
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
// dudas: ids de TEMAS (los mas comunes del reporte semanal), se muestran con su primer paso para que
// algunos lo resuelvan sin abrir ticket.
function mensajePanel(dudas = []) {
  const e = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`${T.en.panelTitulo} · ${T.es.panelTitulo}`)
    .setDescription(`🇬🇧 ${T.en.panelDesc}\n\n🇪🇸 ${T.es.panelDesc}`);
  const temas = dudas.map((id) => TEMAS.find((t) => t.id === id)).filter(Boolean).slice(0, 3);
  if (temas.length) {
    e.addFields({ name: "💡 Common questions · Dudas comunes", value: "Try this first · Prueba esto primero:" });
    for (const t of temas) e.addFields({ name: `${t.titulo.en} · ${t.titulo.es}`, value: corta(`🇬🇧 ${t.pasos.en[0]}\n🇪🇸 ${t.pasos.es[0]}`, 1024) });
  }
  const fila = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("panel:abrir").setLabel(`${T.en.abrir} / ${T.es.abrir}`).setStyle(ButtonStyle.Primary).setEmoji("🎫")
  );
  return { embeds: [e], components: [fila] };
}

async function asegurarPanel(guild) {
  const canal = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === nombrePanel(guild) && enCategoria(guild, c));
  if (!canal) return;
  const msgs = await canal.messages.fetch({ limit: 30 }).catch(() => null);
  const panel = msgs && msgs.find((m) => m.author.id === client.user.id && m.components.length);
  const nuevo = mensajePanel(await dudasComunes(guild));
  if (!panel) return void (await canal.send(nuevo).catch((e) => console.warn("panel:", e.message)));
  // Se actualiza solo si cambiaron las dudas (asi no se edita en cada reinicio).
  const campos = (m) => JSON.stringify((m.embeds[0] && m.embeds[0].fields ? m.embeds[0].fields : []).map((f) => f.name));
  if (campos(panel) !== JSON.stringify(nuevo.embeds[0].toJSON().fields ? nuevo.embeds[0].toJSON().fields.map((f) => f.name) : []))
    await panel.edit(nuevo).catch((e) => console.warn("panel:", e.message));
}
// El reporte semanal deja en su pie "top: id1,id2,id3" (los temas mas comunes).
async function dudasComunes(guild) {
  const canal = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === (CFG.canales.avisos || "avisos-bot"));
  const msgs = canal && (await canal.messages.fetch({ limit: 30 }).catch(() => null));
  const rep = msgs && msgs.find((m) => m.author.id === client.user.id && m.embeds[0] && /^top: /.test((m.embeds[0].footer && m.embeds[0].footer.text) || ""));
  return rep ? rep.embeds[0].footer.text.slice(5).split(",").filter(Boolean) : [];
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
// Canal privado del bot para avisos al equipo (bot caido, reporte semanal). Lo usan los workflows vigia y reporte.
const canalAvisos = (guild) => canalCorrecciones(guild, CFG.canales.avisos || "avisos-bot", "Avisos del bot: si se cae y el reporte semanal de los problemas más comunes.");

async function canalCorrecciones(guild, nombreOtro, temaOtro) {
  const nombre = nombreOtro || CFG.canales.correcciones || "correcciones-ia";
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
    topic: temaOtro || "Respuestas que el equipo marcó como la que se esperaba (**en negritas** dentro de un ticket). Sirven para ajustar al bot.",
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

async function registrar(canal, d, resultado, solucion, quien, resumen) {
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
        { name: "Cómo se resolvió", value: (solucion || "-").slice(0, 1000) },
        ...(resumen ? [{ name: "Resumen del caso", value: resumen.slice(0, 1024) }] : [])
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
    "If the little button came off: usually not needed, don't worry, only matters if it causes problems. If WiFi trackers still won't connect after every step: internet providers often block some connections on their routers, which affects WiFi trackers only; a cheap extra router just for the trackers fixes it. " +
    "Ice Cube and BMI160 trackers (WiFi ones too) can NOT have their firmware updated: if asked, just say it can't be done (no versions, no steps). Clear Data in the configurator is allowed, but it erases the pairing and they have to pair again.",
    "Less is more: answer exactly what the customer asked, nothing extra. Don't add side notes, other products or details they didn't ask about; extra info confuses them.",
    `Always answer in ${idioma}. Talk like a chill, friendly person from the team, not a robot: relaxed and warm, tuteo, short messages, no headings, no corporate phrases.`,
    lang === "es" && "Spanish variant: neutral Latin American leaning Mexican, NEVER Spain Spanish. Use \"¿ya intentaste…?\" (not \"¿has probado a…?\"), \"dale clic / presiona\" (not \"pulsa/pincha\"), \"llenar\" (not \"rellenar\"), \"computadora o PC\" (not \"ordenador\"), \"celular\" (not \"móvil\"), \"ustedes\" (never \"vosotros\", \"os\", \"vale\", \"coger\"), \"mantenlo\" without accent. Prefer simple past (\"ya lo cargaste\") over \"has cargado\". No modern internet slang or anglicisms (\"random\", \"literal\", \"crack\", \"bro\").",
    "Keep the slang light: at most one casual word per message (in Spanish, Mexican-style like \"va\", \"sale\", \"tranqui\", \"no te preocupes\", \"ahorita\"). Never use \"wey\", \"carnal\", \"bro\", \"compa\", \"neta\" or regional slang from other countries, never pile up exclamations or emojis (max one emoji, usually none), never talk like a cartoon. It must sound like a real person from a small shop answering a customer.",
    "Be very understanding: first show you get the problem and how annoying it is, ask one short question if something is unclear, then suggest what to try (max 5 short numbered steps). Use only the knowledge below; it comes from the official manual and overrides anything else you know.",
    "Never give prices (not even an estimate), shipping dates or policies: a teammate handles prices (see TEAM RULES). If it really looks like a broken tracker, ask for a photo; a teammate checks it.",
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

/** Lo que el auditor necesita saber: las guias que tocan la pregunta y la que el borrador quiere mandar. */
function saberAuditor(charla, borrador, lang) {
  const ult = [...charla].reverse().find((m) => m.role === "user");
  const ids = new Set([...borrador.matchAll(/\[GUIA:\s*([a-z_]+)\]/gi)].map((m) => m[1].toLowerCase()));
  const temas = [...(ult ? buscarTemas(ult.content, 3) : []), ...TEMAS.filter((t) => ids.has(t.id))];
  const unicos = [...new Map(temas.map((t) => [t.id, t])).values()];
  const fijo = "Fixed facts: Ice Cube and BMI160 trackers (WiFi ones too) can never have their firmware updated; the reply must just say it can't be done. Clear Data in the configurator is allowed but erases the pairing, so they must pair again. The bot never talks about refunds, replacements, warranty or prices.";
  return [fijo, ...unicos.map((t) => `## ${t.titulo[lang]}\n- ${t.pasos[lang].join("\n- ")}`)].join("\n\n");
}

const ocupados = new Set();
const pendientes = new Map(); // mensajes que llegaron mientras la IA contestaba otro: se contestan al terminar
async function respuestaIA(canal, d, extraUsuario) {
  // Ya esta contestando en este canal: se anota y, al terminar, se contesta todo junto (no se pierde el mensaje).
  if (ocupados.has(canal.id)) return void pendientes.set(canal.id, { d, extraUsuario });
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
    // Segunda IA online: revisa que conteste justo lo que preguntaron, sin info de mas ni confusa.
    // Si la ve mal, se reescribe (hasta maxRehacer veces); si no se entiende el problema, se pide que lo cuente otra vez.
    const AUD = CFG.auditor;
    if (AUD && AUD.activo !== false) {
      const charla = mensajes.slice(1);
      const max = AUD.maxRehacer ?? 2;
      for (let vuelta = 0; vuelta <= max; vuelta++) {
        const r = await auditar(AUD, { charla, saber: saberAuditor(charla, texto, d.lang), borrador: texto, backend }).catch((e) => { console.warn("auditor:", e.message); return null; });
        if (!r || r.veredicto === "ok") break;
        console.log(`Auditor (${r.backend}) en ${canal.name}: ${r.veredicto} - ${r.motivo}`);
        // Si ya le pedimos que lo repitiera y sigue sin entenderse, no se lo volvemos a pedir: mandamos el borrador.
        const yaPedido = charla.filter((m) => m.role === "assistant").slice(-1).some((m) => variantes(d.lang).some((v) => m.content.startsWith(v)));
        if (r.veredicto === "aclarar" && yaPedido) break;
        if (r.veredicto === "aclarar") {
          limpiar();
          if (pendientes.has(canal.id)) return; // escribio algo mas: se rehace con todo
          await canal.send({ content: pedirRepetir(d.lang), components: d.soloConsejos ? [] : [botonesTicket(d.lang)] });
          return;
        }
        if (vuelta === max) break;
        const otra = await responder(CFG.ia, [...mensajes, { role: "assistant", content: texto }, { role: "system", content: `A reviewer flagged that draft: ${r.motivo}. Rewrite it so it answers exactly what the customer asked, short and clear, only with facts from the knowledge, nothing extra. Same language, same casual tone, same tag rules.` }]).catch(() => null);
        if (!otra || PROHIBIDO.test(otra.texto) || idiomaDe(null, otra.texto.replace(/\[[^\]]*\]/g, "")) !== d.lang) break;
        ({ texto, backend } = otra);
      }
    }
    limpiar();
    // El cliente escribio mientras se preparaba esta respuesta: se tira el borrador y se contesta todo junto.
    if (pendientes.has(canal.id)) return void console.log(`nuevo mensaje en ${canal.name} mientras pensaba: rehago con todo`);
    console.log(`IA (${backend}) en ${canal.name}`);
    // La IA a veces pone [HUMANO] sin que nadie lo pida: solo vale si el cliente insinuo persona/equipo/devolucion.
    const ultimos = mensajes.filter((x) => x.role === "user").slice(-1).map((x) => x.content).join(" ");
    const insinua = /human|persona|alguien|equipo|tecnico|técnico|soporte|agente|real|team|someone|staff|support|devol|regres|reembol|reempla|remplaz|cambi|garant|refund|return|replace|warrant|exchange|cancel|precio|cuesta|cuanto|cuánto|compr|price|cost|how much|buy/i.test(ultimos);
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
      const d2 = leerTicket(canal) || otra.d;
      if (d2.estado !== "cerrado") respuestaIA(canal, { ...otra.d, estado: d2.estado }, otra.extraUsuario).catch((e) => console.warn("IA pendiente:", e.message)); // el historial ya trae los mensajes nuevos
    }
  }
}

// Devoluciones, reembolsos, reemplazos, garantia: siempre con un companero del equipo.
function pideDevolucion(texto) {
  const t = ` ${String(texto).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")} `;
  return [
    "devolucion", "devolver", "regresarlo", "regresarla", "regresarlos", "regresar el", "regresar los", "reembolso", "rembolso", "reembolsar", "mi dinero",
    "reemplazo", "remplazo", "reemplazar", "remplazar", "cambio por otro", "cambiarlo por", "me lo cambien", "me los cambien", "cambien por", "uno nuevo", "otro nuevo", "garantia", "reclamo", "cancelar mi", "cancelar la compra", "cancelar la orden", "cancelar el pedido", "cancelarlo", "quiero cancelar", "cancelacion", "recambio", "repuesto", "quiero un cambio", "pedir un cambio", "hacer un cambio de", "cambiar mi pedido", "cambiar mi kit", "cambiar el kit", "cambiar mi orden", "cambiar el producto", "cambiar mis trackers por", "cambiar el tracker por",
    "refund", "return it", "return them", "return the", "send it back", "send them back", "money back", "replacement", "replace it", "replace my", "warranty", "rma", "exchange", "cancel my", "cancel the order", "cancel the purchase", "cancel it", "cancellation", "spare part", "change my order", "change my kit",
  ].some((p) => t.includes(p));
}
// Precios o comprar algo extra: el bot no da precios, lo atiende un Helpper asignado.
function pideCompra(texto) {
  const t = ` ${String(texto).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")} `;
  if (COMPRA_FUERA.test(texto)) return false; // "me compre otra antena" es otra regla
  return [
    "precio", "costo", "cuanto cuesta", "cuanto cuestan", "cuanto sale", "cuanto salen", "cuanto vale", "cuanto valen", "cuanto cobran", "cuanto costaria", "cuanto me sale", "cuanto me cuesta", "cuanto es ", "en cuanto", "cotiza", "descuento", "oferta", "promocion",
    "comprar otro", "comprar otra", "comprar uno", "comprar una", "comprar mas", "quiero comprar", "puedo comprar", "se puede comprar", "venden ", "tracker extra", "trackers extra", "correa extra", "correas extra", "antena extra", "adicional",
    "price", "pricing", "how much", "cost ", "costs ", "cost?", "discount", "promo", "sale?", "for sale", "sell ", "buy another", "buy more", "buy extra", "buy an extra", "buy a ", "want to buy", "can i buy", "do you sell", "extra tracker", "extra strap",
  ].some((p) => t.includes(p));
}
// Reparte los tickets escalados entre los Helpper, por turnos. Sin lista de miembros, se menciona el rol.
const turnoHelper = new Map();
async function elegirHelper(guild, rol, excluir) {
  if (!rol) return null;
  let miembros = [...rol.members.values()];
  if (!miembros.length) {
    const lista = await guild.members.list({ limit: 1000 }).catch(() => null);
    if (lista) miembros = [...lista.values()].filter((m) => m.roles.cache.has(rol.id));
  }
  miembros = miembros.filter((m) => !m.user.bot).sort((a, b) => a.id.localeCompare(b.id));
  const fuera = [].concat(excluir || []).filter(Boolean);
  if (fuera.length) miembros = miembros.filter((m) => !fuera.includes(m.id));
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
  // Fuera de horario la espera empieza a contar cuando abre el equipo (asi no se reasigna de noche).
  const abre = proximaApertura();
  d.esc = abre;
  d.motivo = motivo.slice(0, 60);
  if (helper) Object.assign(d, { asignado: helper.user.username, aid: helper.id });
  await guardarTicket(canal, d);
  const quien = helper ? `<@${helper.id}>` : rol ? `<@&${rol.id}>` : `@${CFG.roles.soporte}`;
  await canal.send({
    content: (texto || T[d.lang].companero)(quien),
    allowedMentions: helper ? { users: [helper.id] } : { roles: rol ? [rol.id] : [] },
  });
  if (abre > Date.now() + 60000) await canal.send(T[d.lang].fueraHorario(Math.floor(abre / 1000)));
  const resumen = await resumenCaso(canal, d);
  if (helper) await avisarHelper(helper, canal, d, motivo, resumen);
  await registrar(canal, d, "🆘 Escalado a soporte", helper ? `${motivo} · asignado a ${helper.user.username}` : motivo, null, resumen);
}

// Resumen corto del caso para el Helpper: asi no tiene que leerse todo el ticket.
async function resumenCaso(canal, d) {
  const base = `Pedido ${d.pedido || "-"} · ${d.problema || "-"}`.slice(0, 900);
  try {
    const txt = (await transcripcion(canal)).slice(-6000);
    const { texto } = await responder(CFG.ia, [
      { role: "system", content: "Eres del equipo de soporte de USAGIVR (trackers SlimeVR). Resume este ticket para el compañero que lo va a atender, en español, máximo 6 viñetas cortas: qué tiene el cliente (kit/modelo si se sabe), cuál es el problema, qué se intentó ya, si mandó fotos, qué pide o espera ahora y su ánimo. Solo hechos del ticket, nada inventado." },
      { role: "user", content: txt },
    ]);
    return texto.replace(/<think>[\s\S]*?<\/think>/g, "").trim().slice(0, 1000) || base;
  } catch (e) {
    console.warn("resumen:", e.message);
    return base;
  }
}

// Mensaje privado al Helpper con el caso. Si tiene los MD cerrados, basta con la mencion en el ticket.
async function avisarHelper(helper, canal, d, motivo, resumen, extra) {
  const e = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`Te toca: #${canal.name}`)
    .setURL(canal.url)
    .setDescription(resumen)
    .addFields(
      { name: "Motivo", value: corta(motivo, 200), inline: true },
      { name: "Pedido", value: d.pedido || "-", inline: true },
      { name: "Cliente", value: `<@${d.uid}>`, inline: true }
    )
    .setTimestamp();
  await helper.send({ content: extra || null, embeds: [e] }).catch((err) => console.warn(`MD a ${helper.user.username}:`, err.message));
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
  idiomaTicket.set(canal.id, lang);
  estadoIdioma.set(canal.id, { vistos: 0, preguntado: false, pendiente: null }); // el formulario fija el idioma inicial

  const ficha = new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: inter.user.tag, iconURL: inter.user.displayAvatarURL() })
    .addFields(
      { name: T[lang].campoPedido, value: pedido, inline: true },
      { name: T[lang].campoNombre, value: nombre, inline: true },
      { name: T[lang].campoProblema, value: problema.slice(0, 1024) }
    );
  // La imagen con el horario del equipo va desde el primer mensaje (asi el cliente sabe cuando le contestan).
  const img = CFG.imagenBienvenida && path.join(ASSETS, CFG.imagenBienvenida);
  const files = img && fs.existsSync(img) ? [new AttachmentBuilder(img, { name: CFG.imagenBienvenida })] : [];
  const inicio = await canal.send({ content: `<@${inter.user.id}>\n${T[lang].listoNota}`, embeds: [ficha], components: [botonListo(lang)], files });
  await inicio.pin().catch((e) => console.warn("fijar:", e.message));

  if (pideDevolucion(problema)) await casoDevolucion(canal, d, problema);
  else if (pideCompra(problema)) await escalarTicket(canal, d, "Precio / compra extra", T[lang].compra);
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
  const voz = canalVoz(canal);
  if (voz) await terminarVoz(voz, canal, d, "ticket cerrado");
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
    if (inter.isChatInputCommand() && (inter.commandName === "voz" || inter.commandName === "helper") && (!d || d.estado === "cerrado"))
      return inter.reply({ content: T[idiomaDe(inter.member)].soloTicket, ephemeral: true });
    if (!d) return;
    d.lang = idiomaActual(inter.channel, d);
    const equipo = esEquipo(inter.member);
    const dueno = inter.user.id === d.uid;

    if ((inter.isButton() && inter.customId === "t:voz") || (inter.isChatInputCommand() && inter.commandName === "voz")) {
      if (!dueno && !equipo) return inter.reply({ content: T[d.lang].soloDueno, ephemeral: true });
      await inter.deferReply();
      return inter.editReply(await crearVoz(inter.channel, d, inter.member, dueno));
    }
    if (inter.isChatInputCommand() && inter.commandName === "helper") {
      if (!dueno && !equipo) return inter.reply({ content: T[d.lang].soloDueno, ephemeral: true });
      await inter.reply({ content: "👋", ephemeral: true });
      return llamarHelper(inter.channel, d, dueno ? "El cliente usó /helper" : `${inter.user.username} usó /helper`);
    }

    if (inter.isButton() && (inter.customId === "t:ok" || inter.customId === "t:listo")) {
      if (!dueno && !equipo) return inter.reply({ content: T[d.lang].soloDueno, ephemeral: true });
      if (d.estado === "cerrado") return inter.deferUpdate();
      await inter.reply(T[d.lang].gracias);
      const quien = equipo && !dueno ? inter.user.tag : null;
      const listo = inter.customId === "t:listo";
      await registrar(inter.channel, d, d.estado === "escalado" ? "✅ Resuelto (tras escalar)" : listo ? "✅ El cliente lo marcó resuelto" : "✅ Resuelto por el bot",
        d.estado === "escalado" ? "Confirmado como resuelto" : listo ? "Tocó «Ya se resolvió»" : `Con los pasos de: ${d.temas || "respuesta de la IA"}`, quien);
      // Si ya habia un Helpper asignado, que sepa que ya no hace falta.
      const helper = d.estado === "escalado" && d.aid && (await inter.guild.members.fetch(d.aid).catch(() => null));
      if (helper && helper.id !== inter.user.id) await helper.send(`✅ El cliente marcó como resuelto ${inter.channel.name}; ya no hace falta que entres.`).catch(() => {});
      return cerrarCanal(inter.channel, d);
    }
    if (inter.isButton() && inter.customId.startsWith("lang:")) {
      if (!dueno && !equipo) return inter.reply({ content: T[d.lang].soloDueno, ephemeral: true });
      const lang = inter.customId === "lang:es" ? "es" : "en";
      idiomaTicket.set(inter.channel.id, lang);
      const ei = estadoIdioma.get(inter.channel.id) || {};
      estadoIdioma.set(inter.channel.id, { ...FIJO, pendiente: null }); // lo eligio el cliente: queda fijo
      await inter.update({ content: lang === "es" ? "Va, seguimos en español." : "Got it, we'll continue in English.", components: [] });
      // Contesta el mensaje que dejo pendiente, ya en el idioma elegido.
      if (ei.pendiente && d.estado !== "cerrado") {
        const p = ei.pendiente;
        return void (await atender(inter.channel, { ...d, lang }, p.member, p.texto, p.fotos, true));
      }
      return;
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
async function atender(canal, d, member, texto, fotos = [], idiomaElegido = false) {
  // Un compañero del equipo ya esta atendiendo: el bot no le contesta al cliente (ni le pregunta el idioma),
  // solo guarda las fotos. Si hace horas que el compañero no contesta, un "aqui estamos" y se le avisa por privado.
  const callado = await silencioPorHelper(canal, d);
  if (callado) {
    const a = analizarIdioma(texto);
    const libre = (estadoIdioma.get(canal.id) || FIJO).vistos < MARGEN;
    const lang = a.pedido || (libre && a.lang && a.seguro ? a.lang : null) || idiomaActual(canal, d);
    idiomaTicket.set(canal.id, lang);
    const dm = { ...d, lang };
    console.log(`msg en ${canal.name} con compañero atendiendo${callado.retomar ? " (callado hace horas)" : ""}: ${texto.slice(0, 60)}`);
    if (fotos.length) await guardarFotos(canal, dm, fotos);
    if (callado.retomar) await retomarHelper(canal, dm, callado.helper, texto);
    return;
  }
  // Idioma: se corrige solo en los primeros mensajes (ver decidirIdioma); despues queda fijo.
  const ei = estadoIdioma.get(canal.id) || FIJO;
  const actual = idiomaTicket.get(canal.id) || d.lang || idiomaDe(member, texto);
  const dec = idiomaElegido || (fotos.length && !texto.trim()) ? { accion: "seguir", lang: actual, vistos: ei.vistos } : decidirIdioma(texto, { lang: actual, ...ei });
  const lang = dec.lang;
  idiomaTicket.set(canal.id, lang);
  estadoIdioma.set(canal.id, { ...ei, vistos: dec.vistos, pendiente: null });
  if (dec.accion === "cambiar") console.log(`idioma de ${canal.name}: ${actual} -> ${lang}`);
  if (dec.accion === "preguntar") {
    estadoIdioma.set(canal.id, { vistos: dec.vistos, preguntado: true, pendiente: { texto, member, fotos } });
    console.log(`idioma dudoso en ${canal.name}, pregunto`);
    return void (await canal.send({ content: azar(PREGUNTA_IDIOMA), components: [botonesIdioma()] }));
  }
  console.log(`msg en ${canal.name} (${d.estado}, ${lang}): ${texto.slice(0, 80)}${fotos.length ? ` +${fotos.length} foto(s)` : ""}`);
  const dm = { ...d, lang };
  if (fotos.length) {
    await guardarFotos(canal, dm, fotos);
    // Algo roto o mojado: la foto es lo que pedia el bot, asi que la revisa un compañero.
    if (await esCasoDanio(canal, dm, texto, fotos)) {
      if (dm.estado === "escalado") {
        await canal.send(T[lang].fotoYa);
        const helper = dm.aid && (await canal.guild.members.fetch(dm.aid).catch(() => null));
        if (helper) await helper.send(`📷 El cliente de ${canal.url} mandó ${fotos.length} foto(s).`).catch(() => {});
        return;
      }
      return escalarTicket(canal, dm, "Foto de algo roto o mojado", T[lang].foto);
    }
    texto = `${texto}\n[The customer attached ${fotos.length} image(s). You can't see images: say you got it, and if you need what it shows to help, ask them to tell you briefly (e.g. the error message or which light is on).]`.trim();
  }
  if (!fotos.length && yaQuedo(texto)) return void (await canal.send({ content: T[lang].confirmaListo, components: [botonListo(lang)] }));
  if (pideHumano(texto)) {
    if (d.estado === "escalado") return void (await canal.send(T[lang].yaViene));
    return escalarTicket(canal, dm, "El cliente pidió hablar con el equipo técnico");
  }
  if (pideDevolucion(texto)) return casoDevolucion(canal, dm, texto);
  // Cliente molesto: mejor que lo vea una persona pronto. (Muchos mensajes NO escala: puede ir resolviendo dudas
  // distintas, y cada respuesta ya le ofrece «No, necesito ayuda». Visto en la prueba del 18-11.)
  if (d.estado !== "escalado" && estaEnojado(texto)) return escalarTicket(canal, dm, "Cliente molesto", T[lang].enojo);
  // Con muchos mensajes solo se OFRECE el pase (una vez); no se escala solo.
  if (d.estado !== "escalado" && !d.ofrecioPase && (await mensajesDelCliente(canal, d.uid)) >= ((CFG.seguimiento || {}).insisteMensajes || 12)) {
    d.ofrecioPase = true;
    await guardarTicket(canal, d);
    await canal.send(T[lang].ofrecePase);
  }
  if (pideCompra(texto)) {
    if (d.estado === "escalado") return void (await canal.send(T[lang].compraYa()));
    return escalarTicket(canal, dm, "Precio / compra extra", T[lang].compra);
  }
  // La IA lee toda la conversacion (sabe en que paso va el cliente) y elige ella la guia con video/dibujo.
  // Contesta tambien con el ticket escalado, mientras llega el companero.
  await respuestaIA(canal, dm, texto);
}

// Palabras fuertes, groserias, "nadie me contesta", muchos !!! o todo en mayusculas.
const ENOJO = /\b(estafa|fraude|scam|rip ?off|p[eé]simo|basura|garbage|trash|horrible|wtf|mierda|chingad\w*|pinche|harto|harta|me hart[eé]|hart[oa]s|me cans[eé]|rid[ií]culo|ridiculous|in[uú]til|useless|worst|terrible|fed up|i'?m done|nadie (me )?(responde|contesta|ayuda)|nobody (answers|helps|replies)|no mam[ea]n?|ya van \d+ (veces|d[ií]as)|for \d+ days)\b|!{3,}/i;
function estaEnojado(texto) {
  const t = texto || "";
  if (ENOJO.test(t)) return true;
  const letras = t.replace(/[^a-zA-ZÁÉÍÓÚÑáéíóúñ]/g, "");
  return letras.length >= 20 && letras.replace(/[^A-ZÁÉÍÓÚÑ]/g, "").length / letras.length > 0.7;
}

// Fotos o videos del cliente: se copian al hilo del cliente en el historial (las ve el equipo aunque se borre el ticket).
const esImagen = (a) => /^(image|video)\//.test(a.contentType || "") || /\.(png|jpe?g|webp|gif|heic|mp4|mov)$/i.test(a.name || "");
async function mensajesDelCliente(canal, uid) {
  const ms = await canal.messages.fetch({ limit: 100 }).catch(() => null);
  return ms ? ms.filter((m) => m.author.id === uid).size : 0;
}

async function guardarFotos(canal, d, fotos) {
  try {
    const hilo = await hiloDeUsuario(canal.guild, d.uid, d.usuario || d.uid);
    await hilo.send({ content: `📷 Del ticket ${canal.name} (pedido ${d.pedido || "-"})`, files: fotos.slice(0, 10).map((f) => ({ attachment: f.url, name: f.name })) });
  } catch (e) {
    console.warn("fotos:", e.message);
  }
}
// Roto o mojado: si el cliente lo dice (en este mensaje o antes) o si la IA con vision lo ve en la foto.
async function esCasoDanio(canal, d, texto, fotos = []) {
  const ultimos = await canal.messages.fetch({ limit: 20 }).catch(() => null);
  const delCliente = ultimos ? [...ultimos.values()].filter((m) => m.author.id === d.uid).map((m) => m.content) : [];
  const todo = [d.problema, texto, ...delCliente].join("\n");
  if (DANIO.test(todo) || LIQUIDO.test(todo)) return true;
  if (!fotos.length) return false;
  canal.sendTyping().catch(() => {});
  const visto = await verFotos(CFG.ia, fotos.map((f) => f.url)).catch((e) => { console.warn("vision:", e.message); return null; });
  console.log(`vision en ${canal.name}: ${visto === true ? "roto/mojado" : visto === false ? "normal" : "sin ver"}`);
  return visto === true;
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
  if (d && msg.author.id !== d.uid) ultimaAyuda.set(msg.channel.id, msg.createdTimestamp);
  // Solo atiende al dueno del ticket; cerrado = nada.
  if (!d || msg.author.id !== d.uid || (d.estado !== "abierto" && d.estado !== "escalado")) return;
  // Espera unos segundos tras el ultimo mensaje: la gente escribe en rafagas y asi se lee todo junto.
  if (!ultimaAyuda.has(msg.channel.id)) msg.channel.sendTyping().catch(() => {});
  const previa = esperas.get(msg.channel.id);
  if (previa) clearTimeout(previa.timer);
  const textos = [...((previa && previa.textos) || []), msg.content].filter(Boolean);
  const fotos = [...((previa && previa.fotos) || []), ...[...msg.attachments.values()].filter(esImagen).map((a) => ({ url: a.url, name: a.name }))];
  if (!textos.length && !fotos.length) return;
  const timer = setTimeout(() => {
    esperas.delete(msg.channel.id);
    const dd = leerTicket(msg.channel) || d;
    atender(msg.channel, dd, msg.member, textos.join("\n"), fotos).catch((e) => console.error("atender:", e));
  }, (CFG.esperarRafagaSeg || 7) * 1000);
  esperas.set(msg.channel.id, { timer, textos, fotos });
});

client.once("clientReady", async () => {
  console.log(`Conectado como ${client.user.tag} en ${client.guilds.cache.size} servidor(es): ${[...client.guilds.cache.values()].map((g) => `${g.name} (${g.id})`).join(", ")}`);
  const cmds = [
    new SlashCommandBuilder().setName("panel-soporte").setDescription("Publica el panel de tickets de soporte en este canal").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder().setName("voz").setDescription("Crea un canal de voz temporal para este ticket / Voice channel for this ticket"),
    new SlashCommandBuilder().setName("helper").setDescription("Llama a un compañero del equipo a este ticket / Call a support teammate"),
  ].map((c) => c.toJSON());
  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set(cmds).catch((e) => console.warn("comandos:", e.message));
    await montarServidor(guild);
    await asegurarPanel(guild);
    await panelesPublicos(guild).catch((e) => console.warn("paneles publicos:", e.message));
    if (catFija(guild)) await canalCorrecciones(guild).catch((e) => console.warn("correcciones:", e.message));
    if (catFija(guild)) await canalAvisos(guild).catch((e) => console.warn("avisos:", e.message));
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
          const fotos = [...m.attachments.values()].filter(esImagen).map((a) => ({ url: a.url, name: a.name }));
          atender(c, d, member, m.content, fotos).catch((e) => console.error("atender:", e)); // sin await: no frena el arranque
        }
      }
    }
  }  revisarTickets().catch((e) => console.warn("seguimiento:", e.message));
  setInterval(() => revisarTickets().catch((e) => console.warn("seguimiento:", e.message)), (S.revisarCadaMin || 10) * MIN);
});

// ------------------------------------------------------------ seguimiento
// Cada pocos minutos: Helpper que no contesta (recordatorio y luego otro Helpper) y tickets sin movimiento (aviso y cierre).
// Todo sale del tema del canal y de las fechas de los mensajes, asi sobrevive a los reinicios.
const S = CFG.seguimiento || {};
const MIN = 60000;
async function revisarTicket(c) {
  const d = leerTicket(c);
  if (!d || (d.estado !== "abierto" && d.estado !== "escalado")) return;
  const ahora = Date.now();
  const msgs = await c.messages.fetch({ limit: 50 }).catch(() => null);
  if (!msgs || !msgs.size) return;
  const lista = [...msgs.values()]; // del mas nuevo al mas viejo
  d.lang = idiomaTicket.get(c.id) || idiomaReciente(lista, d);
  const voz = canalVoz(c);
  if (voz) await revisarVoz(voz, c, d);

  // 1) Escalado y ningun compañero ha escrito todavia.
  if (d.estado === "escalado" && !d.atendido && d.esc) {
    const esc = Number(d.esc);
    if (lista.some((m) => !m.author.bot && m.author.id !== d.uid && m.createdTimestamp > esc)) {
      d.atendido = 1;
      return guardarTicket(c, d);
    }
    if (!enHorario()) return;
    const espera = ahora - esc;
    const reas = Number(d.reas || 0);
    const rol = rolPorNombre(c.guild, CFG.roles.soporte);
    // Unos minutos sin respuesta del primero: se suma otro Helpper y el ticket queda con los dos.
    if (d.aid && !d.aid2 && espera > (S.segundoHelperMin ?? 15) * MIN && rol) {
      const otro = await elegirHelper(c.guild, rol, d.aid);
      if (otro) {
        Object.assign(d, { aid2: otro.id, asignado2: otro.user.username });
        await guardarTicket(c, d);
        await c.send({ content: T[d.lang].segundo(`<@${otro.id}>`), allowedMentions: { users: [otro.id] } });
        const resumen = await resumenCaso(c, d);
        await avisarHelper(otro, c, d, `${d.motivo || "Escalado"} (te sumo: ${d.asignado || "el primero"} no contestó en ${Math.round(espera / MIN)} min)`, resumen);
        return console.log(`${c.name}: se suma ${otro.user.username} (${d.asignado} sin respuesta)`);
      }
    }
    if (espera > (S.reasignarHelperMin || 240) * MIN && reas < (S.maxReasignaciones || 3) && rol) {
      const nuevo = await elegirHelper(c.guild, rol, [d.aid, d.aid2]);
      if (nuevo && nuevo.id !== d.aid) {
        const antes = d.asignado;
        Object.assign(d, { asignado: nuevo.user.username, aid: nuevo.id, esc: ahora, reas: reas + 1, rec: "" });
        await guardarTicket(c, d);
        await c.send({ content: T[d.lang].reasignado(`<@${nuevo.id}>`), allowedMentions: { users: [nuevo.id] } });
        const resumen = await resumenCaso(c, d);
        await avisarHelper(nuevo, c, d, `${d.motivo || "Escalado"} (antes ${antes || "nadie"}, sin respuesta)`, resumen);
        return console.log(`${c.name}: reasignado de ${antes} a ${nuevo.user.username}`);
      }
    }
    if (espera > (S.recordarHelperMin || 120) * MIN && !d.rec) {
      d.rec = 1;
      await guardarTicket(c, d);
      const ids = [d.aid, d.aid2].filter(Boolean);
      const quien = ids.length ? ids.map((x) => `<@${x}>`).join(" ") : rol ? `<@&${rol.id}>` : `@${CFG.roles.soporte}`;
      const horas = Math.round(espera / (60 * MIN));
      await c.send({ content: `⏰ ${quien} este ticket sigue esperando respuesta (hace ${horas} h).`, allowedMentions: ids.length ? { users: ids } : { roles: rol ? [rol.id] : [] } });
      for (const id of ids) {
        const helper = await c.guild.members.fetch(id).catch(() => null);
        if (helper) await helper.send(`⏰ Recordatorio: ${c.url} lleva ${horas} h esperando respuesta.`).catch(() => {});
      }
      return console.log(`${c.name}: recordatorio a ${d.asignado || "rol"}`);
    }
    return; // esperando al compañero: no se cierra por inactividad
  }

  // 2) Chat sin movimiento de personas (cliente o equipo): a las ~68 h se avisa ("gracias por recomendarnos,
  // se cierra en 4 h") y a las ~72 h se cierra, guardando resumen y conversacion en el historial.
  // Los mensajes del bot no cuentan como movimiento.
  const humano = lista.find((m) => !m.author.bot);
  const ultimaVez = humano ? humano.createdTimestamp : c.createdTimestamp;
  if (d.aviso) {
    const aviso = Number(d.aviso);
    if (ultimaVez > aviso) {
      d.aviso = "";
      return guardarTicket(c, d);
    }
    if (ahora - aviso > (S.cerrarTrasAvisoHoras ?? 4) * 60 * MIN) {
      await c.send(T[d.lang].cerradoInactivo);
      const resumen = await resumenCaso(c, d);
      await registrar(c, d, "💤 Cerrado por inactividad", `Sin mensajes desde ${new Date(ultimaVez).toISOString().slice(0, 16).replace("T", " ")} UTC`, null, resumen);
      console.log(`${c.name}: cerrado por inactividad`);
      return cerrarCanal(c, d);
    }
    return;
  }
  if (ahora - ultimaVez > (S.avisoInactivoHoras ?? 68) * 60 * MIN) {
    d.aviso = ahora;
    await guardarTicket(c, d);
    await c.send({ content: T[d.lang].avisoInactivo(`<@${d.uid}>`, S.cerrarTrasAvisoHoras ?? 4), allowedMentions: { users: [d.uid] } });
    console.log(`${c.name}: aviso de inactividad`);
  }
}
async function revisarTickets() {
  for (const guild of client.guilds.cache.values()) {
    for (const c of guild.channels.cache.values()) {
      if (c.type !== ChannelType.GuildText || !leerTicket(c)) continue;
      await revisarTicket(c).catch((e) => console.warn(`seguimiento ${c.name}:`, e.message));
    }
  }
}

// ------------------------------------------------------------ compañero atendiendo
// Ultimo mensaje de una persona del equipo (no el cliente, no un bot, no una correccion en negritas).
const ultimaAyuda = new Map(); // canal -> hora del ultimo mensaje de alguien que no es el cliente
const esAyuda = (m, uid) => !m.author.bot && m.author.id !== uid && !esCorreccion(m.content);
async function silencioPorHelper(canal, d) {
  const msgs = await canal.messages.fetch({ limit: 100 }).catch(() => null);
  if (!msgs) return null;
  const lista = [...msgs.values()]; // del mas nuevo al mas viejo
  const i = lista.findIndex((m) => esAyuda(m, d.uid));
  if (i < 0) return null;
  const helper = lista[i];
  ultimaAyuda.set(canal.id, helper.createdTimestamp);
  const horas = (Date.now() - helper.createdTimestamp) / (60 * MIN);
  // "Aqui estamos" una sola vez por silencio del compañero: si el bot ya hablo despues de el, no se repite.
  const botYa = lista.slice(0, i).some((m) => m.author.id === client.user.id);
  return { helper, retomar: horas >= (S.helperCalladoHoras ?? 6) && !botYa };
}
async function retomarHelper(canal, d, ultimo, texto) {
  const ids = [...new Set([ultimo.author.id, d.aid, d.aid2].filter(Boolean))];
  const quien = ids.map((x) => `<@${x}>`).join(" ");
  await canal.send({ content: T[d.lang].seguimos(quien), allowedMentions: { users: ids } });
  for (const id of ids) {
    const m = await canal.guild.members.fetch(id).catch(() => null);
    if (m && !m.user.bot) await m.send(`💬 El cliente de ${canal.url} volvió a escribir (hace ${Math.round((Date.now() - ultimo.createdTimestamp) / (60 * MIN))} h que el equipo no contesta):\n> ${corta(texto, 300).replace(/\n/g, "\n> ")}`).catch(() => {});
  }
  console.log(`${canal.name}: el cliente volvió tras ${S.helperCalladoHoras ?? 6}+ h sin compañero, aviso a ${ids.length}`);
}
// /helper o "llama a alguien": escala; si ya estaba escalado, vuelve a llamar a los asignados.
async function llamarHelper(canal, d, motivo) {
  if (d.estado !== "escalado") return escalarTicket(canal, d, motivo);
  const rol = rolPorNombre(canal.guild, CFG.roles.soporte);
  const ids = [d.aid, d.aid2].filter(Boolean);
  const quien = ids.length ? ids.map((x) => `<@${x}>`).join(" ") : rol ? `<@&${rol.id}>` : `@${CFG.roles.soporte}`;
  await canal.send({ content: T[d.lang].helperOtraVez(quien), allowedMentions: ids.length ? { users: ids } : { roles: rol ? [rol.id] : [] } });
  for (const id of ids) {
    const m = await canal.guild.members.fetch(id).catch(() => null);
    if (m) await m.send(`🔔 Te vuelven a llamar en ${canal.url} (${motivo}).`).catch(() => {});
  }
}

// ------------------------------------------------------------ voz temporal
// Un canal de voz por ticket ("voz-<ticket>"), en la misma categoria, solo para el cliente y el equipo.
// Se borra solo cuando se queda vacio (o si nadie entra), y deja registro en el ticket y en el historial.
const nombreVoz = (canal) => `voz-${canal.name}`.slice(0, 100);
const canalVoz = (canal) => canal.guild.channels.cache.find((c) => c.type === ChannelType.GuildVoice && c.name === nombreVoz(canal) && c.parentId === canal.parentId) || null;
const vozInfo = new Map(); // voz -> { inicio, gente: Map(id -> nombre), vaciaDesde }
async function crearVoz(canal, d, member, dueno) {
  const ya = canalVoz(canal);
  if (ya) return T[d.lang].vozYa(`<#${ya.id}>`);
  const soporte = rolPorNombre(canal.guild, CFG.roles.soporte);
  const P = PermissionFlagsBits;
  const voz = [P.ViewChannel, P.Connect, P.Speak, P.Stream, P.UseVAD];
  const hacer = (permisos) => canal.guild.channels.create({
    name: nombreVoz(canal), type: ChannelType.GuildVoice, parent: canal.parentId,
    permissionOverwrites: [
      { id: canal.guild.roles.everyone.id, deny: [P.ViewChannel] },
      { id: client.user.id, allow: [P.ViewChannel, P.Connect, P.ManageChannels] },
      { id: d.uid, allow: permisos },
      ...(soporte ? [{ id: soporte.id, allow: permisos }] : []),
    ],
  });
  // Si el bot no tiene algun permiso de voz para repartir, con ver y conectar basta (hablar viene del servidor).
  const v = await hacer(voz).catch(() => hacer([P.ViewChannel, P.Connect])).catch((e) => { console.warn("voz:", e.message); return null; });
  if (!v) return T[d.lang].vozError;
  vozInfo.set(v.id, { inicio: Date.now(), gente: new Map(), vaciaDesde: Date.now() });
  console.log(`${canal.name}: canal de voz ${v.name} (lo pidió ${member.user.username})`);
  // El cliente pide voz: hace falta una persona; si nadie atendia aun, se escala.
  if (dueno && d.estado !== "escalado") {
    setTimeout(() => escalarTicket(canal, d, "El cliente pidió llamada de voz").catch((e) => console.warn("escalar:", e.message)), 500);
    return T[d.lang].vozCreada(`<#${v.id}>`, d.lang === "es" ? "Un compañero del equipo" : "A teammate");
  }
  const ids = [d.aid, d.aid2].filter(Boolean);
  return T[d.lang].vozCreada(`<#${v.id}>`, dueno ? (ids.length ? ids.map((x) => `<@${x}>`).join(" ") : d.lang === "es" ? "El equipo" : "The team") : `<@${d.uid}>`);
}
client.on("voiceStateUpdate", (antes, ahora) => {
  for (const [id, entra] of [[ahora.channelId, true], [antes.channelId, false]]) {
    if (!id || antes.channelId === ahora.channelId) continue;
    const ch = (ahora.guild || antes.guild).channels.cache.get(id);
    if (!ch || !ch.name.startsWith("voz-ticket-")) continue;
    const info = vozInfo.get(id) || { inicio: Date.now(), gente: new Map(), vaciaDesde: null };
    const m = entra ? ahora.member : antes.member;
    if (entra && m) info.gente.set(m.id, m.user.username);
    if (entra && !info.usada) info.usada = Date.now();
    info.vaciaDesde = ch.members.size ? null : Date.now();
    vozInfo.set(id, info);
  }
});
async function revisarVoz(voz, canal, d) {
  if (voz.members.size) return;
  // Tras un reinicio no se sabe si se uso: se cuenta desde ahora para no borrarla antes de tiempo.
  const info = vozInfo.get(voz.id) || { inicio: voz.createdTimestamp, gente: new Map(), vaciaDesde: Date.now(), reinicio: true };
  if (!vozInfo.has(voz.id)) vozInfo.set(voz.id, info);
  if (!info.vaciaDesde) info.vaciaDesde = Date.now();
  const limite = (info.usada ? S.vozVaciaMin ?? 15 : S.vozSinUsarMin ?? 30) * MIN;
  if (Date.now() - info.vaciaDesde > limite) await terminarVoz(voz, canal, d, info.usada ? "vacío" : "nadie entró");
}
async function terminarVoz(voz, canal, d, motivo) {
  const info = vozInfo.get(voz.id) || { inicio: voz.createdTimestamp, gente: new Map() };
  vozInfo.delete(voz.id);
  const min = Math.max(1, Math.round(((info.vaciaDesde || Date.now()) - (info.usada || info.inicio)) / MIN));
  const gente = [...info.gente.values()].join(", ");
  await voz.delete(`voz del ticket: ${motivo}`).catch((e) => console.warn("borrar voz:", e.message));
  if (info.usada) await canal.send(T[d.lang].vozFin(min, gente)).catch(() => {});
  try {
    const hilo = await hiloDeUsuario(canal.guild, d.uid, d.usuario || d.uid);
    const e = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🎙️ Voz del ticket ${canal.name}`)
      .addFields(
        { name: "Creada", value: `<t:${Math.floor(info.inicio / 1000)}:f>`, inline: true },
        { name: "Duración", value: info.usada ? `~${min} min` : info.reinicio ? "sin datos (el bot se reinició)" : "no se usó", inline: true },
        { name: "Cierre", value: motivo, inline: true },
        { name: "Participantes", value: gente || (info.usada || info.reinicio ? "(sin datos: el bot se reinició)" : "nadie") },
      )
      .setTimestamp();
    await hilo.send({ embeds: [e] });
  } catch (err) {
    console.warn("historial voz:", err.message);
  }
  console.log(`${canal.name}: voz cerrada (${motivo})`);
}

// ------------------------------------------------------------ paneles publicos
// Servidores con panelesPublicos: el panel del bot va en los canales donde los clientes abrian ticket
// con el bot anterior (Forms). Se publica una vez y se actualiza igual que el de la categoria.
async function panelesPublicos(guild) {
  const ids = (CFG.servidores && CFG.servidores[guild.id] && CFG.servidores[guild.id].panelesPublicos) || [];
  for (const id of ids) {
    const canal = guild.channels.cache.get(id);
    if (!canal || !canal.isTextBased()) { console.warn(`${guild.name}: no encuentro el canal de panel ${id}`); continue; }
    const msgs = await canal.messages.fetch({ limit: 30 }).catch(() => null);
    const panel = msgs && msgs.find((m) => m.author.id === client.user.id && m.components.length);
    if (panel) continue;
    await canal.send(mensajePanel()).then(() => console.log(`${guild.name}: panel publicado en #${canal.name}`)).catch((e) => console.warn(`panel en #${canal.name}:`, e.message));
  }
}

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

module.exports = { client, respuestaIA, revisarTicket, silencioPorHelper, idiomaReciente, revisarVoz, terminarVoz, canalVoz, botonListo, PREGUNTA_IDIOMA, saberAuditor, pideDevolucion, pideCompra, promptSistema, pideHumano, idiomaDe, leerTicket, temaCanal, esImagen, estaEnojado, mensajePanel, yaQuedo };
