// Solo lectura: foto del servidor (canales, roles, bots, permisos del nuestro y mensajes de canales de tickets).
// Deja servidor.md como artefacto. No cambia nada.
const fs = require("fs");
const { api } = require("./discord");
const GUILD = process.env.GUILD || "1318716973072252970";
const patron = new RegExp(process.env.PATRON || "ticket|soporte|support|help|ayuda", "i");
const P = { 3: "Administrator", 4: "ManageChannels", 28: "ManageRoles", 1: "KickMembers", 10: "ViewChannel", 11: "SendMessages", 20: "Connect", 24: "MoveMembers" };
(async () => {
  const out = [];
  const g = await api(`/guilds/${GUILD}?with_counts=true`);
  out.push(`# ${g.name} (${g.id}) · ${g.approximate_member_count} miembros`);
  const roles = (await api(`/guilds/${GUILD}/roles`)).sort((a, b) => b.position - a.position);
  const yo = await api("/users/@me");
  let miembros = [];
  try {
    let despues = "0";
    for (;;) {
      const lote = await api(`/guilds/${GUILD}/members?limit=1000&after=${despues}`);
      miembros.push(...lote);
      if (lote.length < 1000) break;
      despues = lote[lote.length - 1].user.id;
    }
  } catch (e) { out.push(`(no pude listar miembros: ${e.message.slice(0, 120)})`); }
  const cuantos = (rid) => miembros.filter((m) => m.roles.includes(rid)).length;
  out.push("\n## Roles (posición · nombre · miembros · permisos clave)");
  for (const r of roles) {
    const bits = BigInt(r.permissions);
    const claves = Object.entries(P).filter(([b]) => bits & (1n << BigInt(b))).map(([, n]) => n).join(",");
    out.push(`- ${r.position} · ${r.name} (${r.id}) · ${miembros.length ? cuantos(r.id) : "?"} · ${claves}${r.managed ? " · [de bot]" : ""}`);
  }
  out.push("\n## Bots");
  for (const m of miembros.filter((m) => m.user.bot)) out.push(`- ${m.user.username} (${m.user.id})${m.user.id === yo.id ? " ← ESTE" : ""} roles: ${m.roles.map((x) => (roles.find((r) => r.id === x) || {}).name).join(", ")}`);
  const helper = roles.find((r) => /^h+e+l+p+e+r$/i.test(r.name));
  if (helper) out.push(`\n## ${helper.name}: ${miembros.filter((m) => m.roles.includes(helper.id)).map((m) => `${m.user.username}${m.user.bot ? "(bot)" : ""}`).join(", ")}`);
  const canales = (await api(`/guilds/${GUILD}/channels`)).sort((a, b) => a.position - b.position);
  const nombre = (id) => (canales.find((c) => c.id === id) || {}).name || "";
  out.push("\n## Canales (tipo: 0 texto, 2 voz, 4 categoría, 5 anuncios, 15 foro)");
  for (const c of canales) {
    const ow = (c.permission_overwrites || []).map((o) => {
      const quien = o.type === 0 ? (roles.find((r) => r.id === o.id) || {}).name || o.id : (miembros.find((m) => m.user.id === o.id) || { user: { username: o.id } }).user.username;
      const v = (x) => Object.entries(P).filter(([b]) => BigInt(x) & (1n << BigInt(b))).map(([, n]) => n).join("+");
      return `${quien}[${v(o.allow) ? "+" + v(o.allow) : ""}${v(o.deny) ? " -" + v(o.deny) : ""}]`;
    }).join(" ");
    out.push(`- ${c.type} · ${c.name} (${c.id})${c.parent_id ? ` < ${nombre(c.parent_id)}` : ""}${ow ? ` · ${ow}` : ""}`);
  }
  for (const c of canales.filter((c) => (c.type === 0 || c.type === 5) && patron.test(c.name))) {
    out.push(`\n## Mensajes recientes de #${c.name}`);
    try {
      const ms = await api(`/channels/${c.id}/messages?limit=15`);
      for (const m of ms.reverse()) {
        const comp = (m.components || []).flatMap((f) => f.components || []).map((b) => `[botón ${b.label || b.custom_id}]`).join(" ");
        out.push(`- ${m.timestamp.slice(0, 16)} ${m.author.username}${m.author.bot ? "(bot)" : ""}: ${(m.content || "").slice(0, 200).replace(/\n/g, " ")} ${(m.embeds || []).map((e) => `[embed ${e.title || ""}: ${(e.description || "").slice(0, 150).replace(/\n/g, " ")}]`).join(" ")} ${comp}`);
      }
    } catch (e) { out.push(`(sin acceso: ${e.message.slice(0, 80)})`); }
  }
  fs.writeFileSync("servidor.md", out.join("\n"));
  console.log(out.slice(0, 5).join("\n"));
})().catch((e) => { console.error(e); process.exit(1); });
