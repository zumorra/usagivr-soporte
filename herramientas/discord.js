// API REST de Discord para los scripts de herramientas (corren aparte del bot, en GitHub Actions).
const CFG = require("../config.json");

const TOKEN = process.env.DISCORD_TOKEN;
const API = "https://discord.com/api/v10";

async function api(ruta, metodo = "GET", cuerpo) {
  if (!TOKEN) throw new Error("falta DISCORD_TOKEN");
  for (;;) {
    const r = await fetch(API + ruta, {
      method: metodo,
      headers: { Authorization: `Bot ${TOKEN}`, ...(cuerpo ? { "Content-Type": "application/json" } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    if (r.status === 429) {
      const espera = ((await r.json()).retry_after || 1) * 1000;
      await new Promise((ok) => setTimeout(ok, espera));
      continue;
    }
    if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${await r.text()}`);
    return r.status === 204 ? null : r.json();
  }
}

// Los canales de avisos (#avisos-bot) que el bot crea en cada servidor donde trabaja.
async function canalesAvisos() {
  const nombre = CFG.canales.avisos || "avisos-bot";
  const res = [];
  for (const g of await api("/users/@me/guilds")) {
    const c = (await api(`/guilds/${g.id}/channels`)).find((x) => x.type === 0 && x.name === nombre);
    if (c) res.push({ guild: await api(`/guilds/${g.id}`), canal: c });
  }
  return res;
}

module.exports = { api, canalesAvisos };
