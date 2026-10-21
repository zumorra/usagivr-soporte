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

const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "config.json"), "utf8"));
const ASSETS = path.join(__dirname, "..", "assets");
const COLOR = 0xff6fb5;
const MARCA = "usagivr-ticket";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

// ------------------------------------------------------------ utilidades
const rolPorNombre = (guild, nombre) =>
  guild.roles.cache.find((r) => r.name.toLowerCase() === String(nombre).toLowerCase());

const idiomaTicket = new Map(); // canal -> idioma que el cliente esta usando en esta sesion

function idiomaDe(member, texto = "", previo = null) {
  const tiene = (n) => member && member.roles && member.roles.cache.some((r) => r.name.toLowerCase() === n.toLowerCase());
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
  return member.roles.cache.some((r) => r.name.toLowerCase() === CFG.roles.soporte.toLowerCase());
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
  const canal = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === CFG.canales.panel);
  if (!canal) return;
  const msgs = await canal.messages.fetch({ limit: 30 }).catch(() => null);
  const yaEsta = msgs && msgs.some((m) => m.author.id === client.user.id && m.components.length);
  if (!yaEsta) await canal.send(mensajePanel()).catch((e) => console.warn("panel:", e.message));
}

// Solo en los servidores de prueba listados: crea roles y canal del panel si faltan.
async function montarServidor(guild) {
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
  let canal = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === CFG.canales.historial);
  if (canal) return canal;
  const soporte = rolPorNombre(guild, CFG.roles.soporte);
  const permisos = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.ManageThreads, PermissionFlagsBits.AttachFiles] },
  ];
  if (soporte) permisos.push({ id: soporte.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessagesInThreads] });
  canal = await guild.channels.create({
    name: CFG.canales.historial,
    type: ChannelType.GuildText,
    topic: "Historial de soporte por cliente: un hilo por usuario (problema y cómo se resolvió). Solo admins y soporte.",
    permissionOverwrites: permisos,
  });
  return canal;
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
    "Product facts: kits have 5 to 11 trackers. Every kit includes a receiver antenna (a small one or a bigger pentagon-shaped one) that plugs into a USB port on the PC. Trackers normally come already paired to their antenna; if one isn't, give the Smol pairing guide (no_conecta); for WiFi trackers give the WiFi setup steps even though SlimeVR also guides it. Always remind them the antenna must be uncovered and facing the area where they play. " +
    "Kit contents: instruction manual, a bundle of USB to USB-C cables, and straps: 2 thick anti-slip straps for the thighs, 2 or 3 long straps (depending on the kit) for waist, chest and hip, and regular straps for the rest. " +
    "Every tracker has our character's face printed on it: that face must always face forward. For calibration, always tell them to follow the calibration guides SlimeVR shows inside the program.",
    `Always answer in ${idioma}. Talk like a chill, friendly person from the team, not a robot: relaxed casual slang (in Spanish, Mexican-style and tuteo: "va", "sale", "ok ok", "tranqui", "no te preocupes"), short messages, no headings, no corporate phrases.`,
    "Be very understanding: first show you get the problem and how annoying it is, ask one short question if something is unclear, then suggest what to try (max 5 short numbered steps). Use only the knowledge below; it comes from the official manual and overrides anything else you know.",
    "Never invent prices, shipping dates, refunds or warranty terms; for those, or if it really looks like a broken tracker, say a teammate from the tech team can look at it whenever they want and that they just have to ask for it or press the button.",
    "You never hand the ticket to a human yourself. Only if the customer clearly asks to talk to a human / the technical team, end with the exact tag [HUMANO].",
    "If the customer says it is solved, be happy for them and thank them.",
    "Tracker won't turn on: first ask if they tried the small reset button on the back of the tracker; then ask if, with the USB cable plugged in, it turns on and shows up in SlimeVR (if yes, it's the battery).",
    "Battery drains fast / doesn't last: explain kindly that it's hard to judge from a description because we need to see how fast it drains, and ask for a video or some proof (e.g. battery % in SlimeVR at the start and after a while).",
    "Returns, refunds, exchanges or warranty: stay calm and reassuring. Explain that for anything like that we first go through the support process and its steps to confirm how the tracker is working, and that it is almost always a fixable issue, nothing serious. Never promise or refuse a return yourself.",
    "Sound natural and vary your wording: don't start every reply the same way, don't repeat the same phrases you already used in this chat. No weird jokes, no made-up expressions or acronyms; plain everyday words.",
    "Read the whole conversation: figure out which step the customer is on and answer what they need NEXT; never repeat instructions for something they say they already did.",
    "The customer often sends several messages in a row. Answer EVERY question or problem they wrote since your last reply (briefly, one after another), not only the last message.",
    `Each knowledge section has an id in brackets and a picture/video guide. If one guide is exactly what the customer needs next, end with the tag [GUIA:id] (at most one, e.g. [GUIA:no_conecta]); never attach a guide that was already sent or covers a step they already did.`,
    "",
    "KNOWLEDGE:",
    resumenParaIA(lang),
  ].join("\n");
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
    if (d.estado === "escalado") sistema += "\n\nA human from the tech team has already been called and will join soon. Keep helping meanwhile, tell the customer they are on the way, and do not use [HUMANO].";
    const mensajes = [{ role: "system", content: sistema }];
    mensajes.push({ role: "user", content: `Order: ${d.pedido}\nName: ${d.nombre}\nProblem: ${d.problema}` });
    if (hist) {
      for (const m of [...hist.values()].reverse()) {
        if (!m.content || m.content.length < 2) continue;
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
    const { texto, backend } = await responder(CFG.ia, mensajes).finally(() => limpiar());
    console.log(`IA (${backend}) en ${canal.name}`);
    const escalar = /\[HUMANO\]/i.test(texto);
    const guias = [...texto.matchAll(/\[GUIA:\s*([a-z_]+)\]/gi)].map((m) => TEMAS.find((t) => t.id === m[1].toLowerCase())).filter(Boolean).slice(0, 1);
    const limpio = texto.replace(/\[(HUMANO|ESCALATE|GUIA:[^\]]*)\]/gi, "").trim().slice(0, 1900);
    for (const g of guias) await canal.send(embedsTema(g, d.lang)).catch((e) => console.warn("guia:", e.message));
    await canal.send({ content: `${limpio}\n\n${azar(T[d.lang].sigue)}`, components: [botonesTicket(d.lang)] });
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

async function escalarTicket(canal, d, motivo) {
  if (d.estado === "escalado") return;
  d.estado = "escalado";
  await guardarTicket(canal, d);
  const rol = rolPorNombre(canal.guild, CFG.roles.soporte);
  await canal.send({
    content: T[d.lang].companero(rol ? `<@&${rol.id}>` : `@${CFG.roles.soporte}`),
    allowedMentions: { roles: rol ? [rol.id] : [] },
  });
  await registrar(canal, d, "🆘 Escalado a soporte", motivo, null);
}

// --------------------------------------------------------------- tickets
async function categoriaTickets(guild) {
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
  const temas = buscarTemas(problema);
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

  if (temas.length) {
    await canal.send(T[lang].bienvenida(inter.user.username));
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
  // La IA lee toda la conversacion (sabe en que paso va el cliente) y elige ella la guia con video/dibujo.
  // Contesta tambien con el ticket escalado, mientras llega el companero.
  await respuestaIA(canal, dm, texto);
}

const esperas = new Map(); // canal -> temporizador de la rafaga de mensajes
client.on("messageCreate", async (msg) => {
  if (msg.author.bot || !msg.guild) return;
  const d = leerTicket(msg.channel);
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
  console.log(`Conectado como ${client.user.tag} en ${client.guilds.cache.size} servidor(es)`);
  const cmd = new SlashCommandBuilder()
    .setName("panel-soporte")
    .setDescription("Publica el panel de tickets de soporte en este canal")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON();
  for (const guild of client.guilds.cache.values()) {
    await guild.commands.set([cmd]).catch((e) => console.warn("comandos:", e.message));
    await montarServidor(guild);
    await asegurarPanel(guild);
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

module.exports = { promptSistema, pideHumano, idiomaDe, leerTicket };
