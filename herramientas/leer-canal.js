// Solo lectura: baja todos los mensajes (y los hilos) de los canales cuyo nombre
// coincide con PATRON en los servidores del bot. Deja canal.md y canal.json.
const fs = require("fs");
const { api } = require("./discord");

const patron = new RegExp(process.env.PATRON || "trackers.*info|know", "i");

async function mensajes(id) {
  const todos = [];
  let antes = "";
  for (;;) {
    const lote = await api(`/channels/${id}/messages?limit=100${antes ? "&before=" + antes : ""}`);
    todos.push(...lote);
    if (lote.length < 100) break;
    antes = lote[lote.length - 1].id;
  }
  return todos.reverse();
}

async function hilos(guild, canal) {
  const res = [];
  try {
    const act = await api(`/guilds/${guild}/threads/active`);
    res.push(...act.threads.filter((t) => t.parent_id === canal));
  } catch (e) { console.log("activos:", e.message); }
  for (const tipo of ["public", "private"]) {
    try {
      const arc = await api(`/channels/${canal}/threads/archived/${tipo}?limit=100`);
      res.push(...arc.threads);
    } catch (e) { console.log(`archivados ${tipo}:`, e.message); }
  }
  return res;
}

function aTexto(m) {
  const l = [`**${m.author.username}** (${m.timestamp.slice(0, 10)}):`];
  if (m.content) l.push(m.content);
  for (const e of m.embeds || []) l.push(`  [embed] ${e.title || ""} ${e.url || ""} ${e.description ? "— " + e.description.slice(0, 300) : ""}`.trim());
  for (const a of m.attachments || []) l.push(`  [adjunto] ${a.filename} ${a.url}`);
  return l.join("\n");
}

(async () => {
  const salida = [];
  const md = [];
  for (const g of await api("/users/@me/guilds")) {
    const todos = await api(`/guilds/${g.id}/channels`);
    console.log(`== ${g.name} (${g.id}): ${todos.map((c) => `${c.name}[${c.type}]`).join(" | ")}`);
    const coincide = (c) => patron.test(c.name.normalize("NFKC"));
    // Si coincide una categoría, entran también todos los canales que tiene dentro.
    const cats = new Set(todos.filter((c) => c.type === 4 && coincide(c)).map((c) => c.id));
    const canales = todos.filter((c) => coincide(c) || cats.has(c.parent_id));
    for (const c of canales) {
      console.log(`${g.name} / #${c.name} (tipo ${c.type})`);
      const bloque = { servidor: g.name, canal: c.name, id: c.id, tipo: c.type, mensajes: [], hilos: [] };
      md.push(`# ${g.name} / #${c.name}\n`);
      if (c.type !== 15 && c.type !== 4) {
        try {
          bloque.mensajes = await mensajes(c.id);
          md.push(...bloque.mensajes.map(aTexto), "");
        } catch (e) { md.push(`(no se pudo leer: ${e.message})\n`); console.log(e.message); }
      }
      for (const h of await hilos(g.id, c.id)) {
        try {
          const ms = await mensajes(h.id);
          bloque.hilos.push({ nombre: h.name, mensajes: ms });
          md.push(`## Hilo: ${h.name}\n`, ...ms.map(aTexto), "");
        } catch (e) { md.push(`## Hilo: ${h.name}\n(no se pudo leer: ${e.message})\n`); }
      }
      salida.push(bloque);
    }
  }
  if (!salida.length) md.push(`Ningún canal coincide con ${patron}`);
  fs.writeFileSync("canal.md", md.join("\n"));
  fs.writeFileSync("canal.json", JSON.stringify(salida, null, 1));
  console.log(`canales: ${salida.length}`);
})().catch((e) => { console.error(e); process.exit(1); });
