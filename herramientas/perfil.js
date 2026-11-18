// Cambia el nombre y la foto del bot (y su apodo en cada servidor). Corre en GitHub Actions con DISCORD_TOKEN.
const fs = require("fs");
const { api } = require("./discord.js");
(async () => {
  const nombre = process.env.NOMBRE;
  const foto = process.env.FOTO && fs.existsSync(process.env.FOTO) ? `data:image/png;base64,${fs.readFileSync(process.env.FOTO).toString("base64")}` : undefined;
  const yo = await api("/users/@me", "PATCH", { ...(nombre ? { username: nombre } : {}), ...(foto ? { avatar: foto } : {}) });
  console.log(`Ahora: ${yo.username} avatar=${yo.avatar}`);
  for (const g of await api("/users/@me/guilds")) {
    await api(`/guilds/${g.id}/members/@me`, "PATCH", { nick: null }).then(() => console.log(`apodo quitado en ${g.name}`)).catch((e) => console.warn(`${g.name}: ${e.message}`));
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
