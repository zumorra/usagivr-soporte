// Reporte semanal en #avisos-bot: cuantos tickets hubo, cuantos resolvio el bot, por que se escalaron
// y los problemas mas comunes. Lee las fichas que el bot deja en #historial-soporte (una por ticket y resultado).
const CFG = require("../config.json");
const { api, canalesAvisos } = require("./discord");
const { responder } = require("../src/ia");

const DIAS = Number(process.env.DIAS || 7);
const desde = Date.now() - DIAS * 86400000;
// Ids de Discord -> fecha, para no bajar hilos viejos.
const fechaId = (id) => Number((BigInt(id) >> 22n) + 1420070400000n);

async function fichas(guildId) {
  const historial = (await api(`/guilds/${guildId}/channels`)).find((c) => c.name === (CFG.canales.historial || "historial-soporte"));
  if (!historial) return [];
  const hilos = (await api(`/guilds/${guildId}/threads/active`)).threads.filter((h) => h.parent_id === historial.id);
  let antes = "";
  for (;;) {
    const r = await api(`/channels/${historial.id}/threads/archived/public?limit=100${antes ? `&before=${antes}` : ""}`);
    hilos.push(...r.threads);
    const ult = r.threads[r.threads.length - 1];
    if (!r.has_more || !ult || Date.parse(ult.thread_metadata.archive_timestamp) < desde) break;
    antes = ult.thread_metadata.archive_timestamp;
  }
  const res = [];
  for (const h of hilos) {
    if (h.last_message_id && fechaId(h.last_message_id) < desde) continue;
    for (const m of await api(`/channels/${h.id}/messages?limit=100`)) {
      const e = m.embeds && m.embeds[0];
      if (!e || !e.fields || !/^Ticket /.test(e.title || "") || Date.parse(m.timestamp) < desde) continue;
      const f = Object.fromEntries(e.fields.map((x) => [x.name, x.value]));
      res.push({ ticket: e.title.slice(7), fecha: m.timestamp, idioma: f["Idioma"], problema: f["Problema"], temas: f["Temas detectados"], resultado: f["Resultado"] || "", como: f["Cómo se resolvió"] || "" });
    }
  }
  return res;
}

function contar(lista) {
  const m = new Map();
  for (const x of lista) m.set(x, (m.get(x) || 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
}

(async () => {
  for (const { guild, canal } of await canalesAvisos()) {
    const todas = await fichas(guild.id);
    // Un ticket puede tener varias fichas (escalado y luego resuelto): se queda la ultima, pero se recuerda si se escalo.
    const tickets = new Map();
    for (const f of todas.sort((a, b) => a.fecha.localeCompare(b.fecha))) {
      const t = tickets.get(f.ticket) || { escalado: null };
      if (/Escalado/.test(f.resultado)) t.escalado = f.como.replace(/ · asignado a .*/, "");
      tickets.set(f.ticket, { ...f, escalado: t.escalado });
    }
    const ts = [...tickets.values()];
    const porBot = ts.filter((t) => /por el bot/.test(t.resultado)).length;
    const escalados = ts.filter((t) => t.escalado);
    const inactivos = ts.filter((t) => /inactividad/.test(t.resultado)).length;
    const abiertos = ts.filter((t) => /Escalado/.test(t.resultado)).length;
    const temas = contar(ts.flatMap((t) => (t.temas && !/ninguno/.test(t.temas) ? t.temas.split(/,\s*/) : ["(sin tema, lo vio la IA)"])));
    const motivos = contar(escalados.map((t) => t.escalado));
    const idiomas = contar(ts.map((t) => t.idioma || "?"));

    let analisis = "";
    if (ts.length) {
      try {
        const lista = ts.map((t) => `- [${t.temas}] ${t.problema}${t.escalado ? ` (escalado: ${t.escalado})` : ""}`).join("\n").slice(0, 8000);
        const { texto } = await responder(CFG.ia, [
          { role: "system", content: "Eres del equipo de soporte de USAGIVR (trackers SlimeVR). Con la lista de problemas de esta semana, en español y en máximo 8 viñetas cortas: agrupa los problemas que se repiten (con cuántos casos), y propón qué guía o respuesta de la FAQ conviene agregar o mejorar para que el bot los resuelva sin escalar. Nada de precios, cambios ni garantías." },
          { role: "user", content: lista },
        ]);
        analisis = texto.replace(/<think>[\s\S]*?<\/think>/g, "").trim().slice(0, 1800);
      } catch (e) {
        console.warn("IA:", e.message);
      }
    }

    const top = (l, n = 8) => (l.length ? l.slice(0, n).map(([k, v]) => `• ${k}: **${v}**`).join("\n") : "—");
    const fields = [
      { name: "Tickets", value: `**${ts.length}** (bot solo: ${porBot} · escalados: ${escalados.length} · cerrados por inactividad: ${inactivos} · siguen esperando: ${abiertos})`.slice(0, 1024) },
      { name: "Problemas más comunes", value: top(temas).slice(0, 1024) },
      { name: "Por qué se escalaron", value: top(motivos, 6).slice(0, 1024) },
      { name: "Idiomas", value: top(idiomas, 4).slice(0, 1024) },
    ];
    await api(`/channels/${canal.id}/messages`, "POST", {
      embeds: [
        { color: 0xff6fb5, title: `📊 Reporte de soporte · últimos ${DIAS} días`, fields, timestamp: new Date().toISOString(),
          // El bot lee este pie al arrancar y pone estas dudas en el panel de tickets.
          footer: { text: `top: ${temas.filter(([k]) => /^[a-z_]+$/.test(k)).slice(0, 3).map(([k]) => k).join(",")}` } },
        ...(analisis ? [{ color: 0xff6fb5, title: "Qué se repite y qué agregar a la FAQ", description: analisis }] : []),
      ],
    });
    console.log(`${guild.name}: ${ts.length} tickets reportados`);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
