// Avisa en #avisos-bot que el bot estaba caido (el workflow vigia ya lo relanzo).
// Uso: node herramientas/vigia.js "detalle"
// No repite el aviso si ya hay otro de hace menos de AVISO_CADA_H horas (por si se cae varias veces seguidas).
const { api, canalesAvisos } = require("./discord");

const MARCA = "[vigia]";
const CADA_H = Number(process.env.AVISO_CADA_H || 3);

(async () => {
  const detalle = process.argv[2] || "";
  for (const { guild, canal } of await canalesAvisos()) {
    const ult = await api(`/channels/${canal.id}/messages?limit=20`);
    const previo = ult.find((m) => m.content.includes(MARCA));
    if (previo && Date.now() - Date.parse(previo.timestamp) < CADA_H * 3600000) {
      console.log(`${guild.name}: ya se aviso hace poco, no repito`);
      continue;
    }
    await api(`/channels/${canal.id}/messages`, "POST", {
      content: `🚨 <@${guild.owner_id}> el bot de soporte se había caído. Ya lo volví a arrancar. ${detalle} ${MARCA}`.trim(),
      allowed_mentions: { users: [guild.owner_id] },
    });
    console.log(`${guild.name}: aviso enviado`);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
