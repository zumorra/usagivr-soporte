// Baja las correcciones del equipo (#correcciones-ia) a correcciones.jsonl y correcciones.md.
// Solo usa la API REST de Discord, asi que puede correr mientras el bot esta conectado.
const fs = require("fs");
const CFG = require("../config.json");

const TOKEN = process.env.DISCORD_TOKEN;
const API = "https://discord.com/api/v10";
const nombre = CFG.canales.correcciones || "correcciones-ia";

async function api(ruta) {
  for (;;) {
    const r = await fetch(API + ruta, { headers: { Authorization: `Bot ${TOKEN}` } });
    if (r.status === 429) {
      const espera = ((await r.json()).retry_after || 1) * 1000;
      await new Promise((ok) => setTimeout(ok, espera));
      continue;
    }
    if (!r.ok) throw new Error(`${ruta}: ${r.status} ${await r.text()}`);
    return r.json();
  }
}

(async () => {
  if (!TOKEN) throw new Error("falta DISCORD_TOKEN");
  const filas = [];
  for (const g of await api("/users/@me/guilds")) {
    const canales = await api(`/guilds/${g.id}/channels`);
    for (const c of canales.filter((x) => x.name === nombre)) {
      let antes = "";
      for (;;) {
        const lote = await api(`/channels/${c.id}/messages?limit=100${antes ? `&before=${antes}` : ""}`);
        if (!lote.length) break;
        for (const m of lote) {
          const e = m.embeds && m.embeds[0];
          if (!e || !e.fields) continue;
          const f = Object.fromEntries(e.fields.map((x) => [x.name, x.value]));
          filas.push({
            fecha: m.timestamp, servidor: g.name, ticket: (e.title || "").replace(/^.*#/, ""), enlace: e.url,
            idioma: f["Idioma"], marco: f["Marcó"], pedido: f["Pedido"],
            cliente: f["Cliente preguntó"], bot: f["Bot contestó"], esperada: f["Respuesta que se esperaba"],
          });
        }
        antes = lote[lote.length - 1].id;
      }
    }
  }
  filas.sort((a, b) => a.fecha.localeCompare(b.fecha));
  fs.writeFileSync("correcciones.jsonl", filas.map((x) => JSON.stringify(x)).join("\n") + (filas.length ? "\n" : ""));
  fs.writeFileSync("correcciones.md", `# Correcciones del equipo (${filas.length})\n\n` + filas.map((x, i) =>
    `## ${i + 1}. ${x.fecha.slice(0, 16).replace("T", " ")} · #${x.ticket} · ${x.idioma} · marcó ${x.marco}\n\n` +
    `**Cliente:**\n> ${x.cliente.replace(/\n/g, "\n> ")}\n\n**Bot:**\n> ${x.bot.replace(/\n/g, "\n> ")}\n\n**Se esperaba:**\n> ${x.esperada.replace(/\n/g, "\n> ")}\n`).join("\n"));
  console.log(`${filas.length} correcciones exportadas`);
})().catch((e) => { console.error(e.message); process.exit(1); });
