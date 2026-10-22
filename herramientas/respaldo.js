// Respaldo del historial de soporte (#historial-soporte): fichas, conversaciones .txt y fotos de cada cliente.
// Deja todo en ./respaldo/<servidor>/<hilo>/ ; el workflow lo cifra y lo sube como release.
// Los adjuntos se bajan (los enlaces de Discord caducan).
const fs = require("fs");
const path = require("path");
const CFG = require("../config.json");
const { api } = require("./discord");

const SALIDA = "respaldo";
const limpio = (s) => String(s).replace(/[^\w.\-· ]+/g, "_").slice(0, 80);

async function mensajes(canalId) {
  const todos = [];
  let antes = "";
  for (;;) {
    const lote = await api(`/channels/${canalId}/messages?limit=100${antes ? `&before=${antes}` : ""}`);
    if (!lote.length) break;
    todos.push(...lote);
    antes = lote[lote.length - 1].id;
  }
  return todos.reverse();
}

(async () => {
  let hilosTot = 0, archivos = 0;
  for (const g of await api("/users/@me/guilds")) {
    const historial = (await api(`/guilds/${g.id}/channels`)).find((c) => c.name === (CFG.canales.historial || "historial-soporte"));
    if (!historial) continue;
    const hilos = (await api(`/guilds/${g.id}/threads/active`)).threads.filter((h) => h.parent_id === historial.id);
    let antes = "";
    for (;;) {
      const r = await api(`/channels/${historial.id}/threads/archived/public?limit=100${antes ? `&before=${antes}` : ""}`);
      hilos.push(...r.threads);
      if (!r.has_more || !r.threads.length) break;
      antes = r.threads[r.threads.length - 1].thread_metadata.archive_timestamp;
    }
    for (const h of hilos) {
      const dir = path.join(SALIDA, limpio(g.name), limpio(h.name));
      fs.mkdirSync(dir, { recursive: true });
      const ms = await mensajes(h.id);
      fs.writeFileSync(path.join(dir, "mensajes.json"), JSON.stringify(ms.map((m) => ({ fecha: m.timestamp, autor: m.author.username, texto: m.content, embeds: m.embeds, adjuntos: m.attachments.map((a) => a.filename) })), null, 1));
      for (const m of ms)
        for (const a of m.attachments) {
          const r = await fetch(a.url);
          if (!r.ok) continue;
          fs.writeFileSync(path.join(dir, `${m.id}-${limpio(a.filename)}`), Buffer.from(await r.arrayBuffer()));
          archivos++;
        }
      hilosTot++;
    }
  }
  console.log(`${hilosTot} clientes, ${archivos} archivos respaldados`);
})().catch((e) => { console.error(e.message); process.exit(1); });
