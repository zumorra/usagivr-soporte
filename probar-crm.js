"use strict";
// Prueba de src/crm.js contra un CRM simulado (sin red externa ni secretos reales).
const http = require("node:http");
const crypto = require("node:crypto");
const assert = require("node:assert");
const { crearCrm } = require("./src/crm");

module.exports = async function probarCrm() {
  const vacio = crearCrm({ baseUrl: "", token: "" });
  assert.strictEqual(vacio.activo(), false);
  assert.strictEqual(await vacio.ticketDe("1", {}), null, "sin configurar no hace nada");

  const vistas = [];
  const srv = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      vistas.push({ m: req.method, u: req.url, h: req.headers, raw });
      const j = (o, st = 200) => { res.writeHead(st, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
      if (req.headers.authorization !== "Bearer tk") return j({ error: "no" }, 401);
      if (req.url === "/v1/soporte/tickets") return j({ ticket_id: 42 });
      if (req.url.startsWith("/v1/soporte/pendientes")) return j({ items: [{ id: 7, canal_id: "9", autor: "Vivi", mensaje: "hola" }] });
      if (req.url.startsWith("/v1/soporte/avisos-md?")) return j({ total: 1, items: [{ id: 1, discord_user_id: "111", mensaje: "revisa: 94001\nref: aviso-1-111", clave: "aviso-1-111", guia: "94001", pedido: "1234", creado_en: "2026-11-27T10:00:00Z" }], espera: null });
      if (req.url.startsWith("/v1/soporte/respuestas-rapidas")) return j({ items: [{ id: 1, nombre: "Saludo", mensaje: "Hi" }] });
      return j({ ok: true });
    });
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  try {
    const crm = crearCrm({ baseUrl: `http://127.0.0.1:${srv.address().port}/`, token: "tk", hmacSecret: "sec" });
    assert.strictEqual(await crm.ticketDe("9", { discordId: "1" }), 42);
    assert.strictEqual(await crm.ticketDe("9", {}), 42);
    assert.strictEqual(vistas.length, 1, "el ticket se cachea");
    const v = vistas[0];
    assert.strictEqual(v.h["idempotency-key"], "9:abierto");
    assert.strictEqual(v.h["x-firma"], "sha256=" + crypto.createHmac("sha256", "sec").update(v.raw).digest("hex"));
    assert.deepStrictEqual((await crm.pendientes()).map((p) => p.id), [7]);
    assert.strictEqual((await crm.respuestasRapidas(42))[0].nombre, "Saludo");
    assert.ok(vistas.at(-1).u.endsWith("?ticket_id=42"));
    await crm.entregado(7, { ok: true, discordMessageId: "55" });
    assert.deepStrictEqual(JSON.parse(vistas.at(-1).raw).discord_message_id, "55");
    const av = await crm.avisosMd();
    assert.strictEqual(av[0].clave, "aviso-1-111");
    assert.strictEqual(vistas.at(-1).u, "/v1/soporte/avisos-md?limit=20");
    await crm.avisoEntregado(1, { discordUserId: "111", ok: false, error: "50007 x" });
    assert.strictEqual(vistas.at(-1).u, "/v1/soporte/avisos-md/1/entregado");
    assert.deepStrictEqual(JSON.parse(vistas.at(-1).raw), { discord_user_id: "111", ok: false, error: "50007 x" });
    await crm.cerrar(42, { estado: "resolved", solucion: "ok" });
    assert.strictEqual(vistas.at(-1).m, "PATCH");
    const malo = crearCrm({ baseUrl: `http://127.0.0.1:${srv.address().port}`, token: "otro" });
    assert.strictEqual(await malo.ticketDe("8", {}), null, "token malo: no rompe");
  } finally {
    srv.close();
  }
  const { trozos, DEL_EQUIPO, esAyudaCrm } = require("./src/index.js");
  const t = trozos("a".repeat(4000));
  assert.ok(t.length === 3 && t.every((x) => x.length <= 1900) && t.join("") === "a".repeat(4000));
  assert.ok(typeof DEL_EQUIPO === "string" && esAyudaCrm);
  // Caída entre publicar y confirmar: al volver, la respuesta ya está en el canal y solo se confirma.
  const bot = require("./src/index.js");
  const { Collection } = require("discord.js");
  const enviados = [];
  const canal = { id: "C1", topic: bot.temaCanal({ uid: "U1", usuario: "zoe", lang: "en", estado: "abierto" }), isTextBased: () => true,
    send: async (o) => { const m = { id: "M" + (enviados.length + 1), content: o.content, createdTimestamp: Date.now(), author: { id: "BOT" } }; enviados.push(m); return m; },
    messages: { fetch: async () => new Collection(enviados.slice().reverse().map((m) => [m.id, m])) } };
  const antes = { u: bot.client.user, f: bot.client.channels.fetch, act: bot.crm.activo, p: bot.crm.pendientes, e: bot.crm.entregado };
  bot.client.user = { id: "BOT" };
  bot.client.channels.fetch = async (id) => (id === "C1" ? canal : null);
  const pend = [{ id: 9, canal_id: "C1", autor: "Vivi", mensaje: "Hola Zoe", creado_en: new Date(Date.now() - 1000).toISOString() }];
  const acks = [];
  let cae = true;
  bot.crm.pendientes = async () => pend.slice();
  bot.crm.entregado = async (id, r) => { if (cae) { cae = false; throw new Error("caida"); } acks.push([id, r]); pend.length = 0; };
  await bot.entregarDelCrm().catch(() => {});
  await bot.entregarDelCrm();
  assert.strictEqual(enviados.length, 1, "no se repite tras la caída");
  assert.deepStrictEqual(acks, [[9, { ok: true, discordMessageId: "M1" }]]);
  Object.assign(bot.crm, { pendientes: antes.p, entregado: antes.e }); bot.client.user = antes.u; bot.client.channels.fetch = antes.f;

  // Avisos MD a Edwin (CRM v32): entrega ok, 50007 -> ok:false, caida entre send y /entregado sin reenviar, sin ID.
  {
    const ant = { u: bot.client.user, uf: bot.client.users.fetch, a: bot.crm.avisosMd, e: bot.crm.avisoEntregado };
    bot.client.user = { id: "BOT" };
    const dms = { "111": [], "222": [] };
    const mkUser = (id) => ({ id,
      createDM: async () => ({ messages: { fetch: async () => new Collection(dms[id].slice().reverse().map((m) => [m.id, m])) } }),
      send: async (txt) => { if (id === "111" && redCae) { redCae = false; throw new Error("socket hang up"); }
        if (id === "222") { const e = new Error("Cannot send messages to this user"); e.code = 50007; throw e; }
        const m = { id: "D" + (dms[id].length + 1), content: txt, author: { id: "BOT" } }; dms[id].push(m); return m; } });
    bot.client.users.fetch = async (id) => { if (!dms[id]) { const e = new Error("Unknown User"); e.code = 10013; throw e; } return mkUser(id); };
    const cola = [
      { id: 1, discord_user_id: "111", mensaje: "revisa: 94001\nPedido #1234\nref: aviso-1-111", clave: "aviso-1-111" },
      { id: 1, discord_user_id: "222", mensaje: "revisa: 94001\nPedido #1234\nref: aviso-1-222", clave: "aviso-1-222" },
      { id: 2, discord_user_id: "", mensaje: "revisa: 94002\nref: aviso-2-", clave: "aviso-2-" },
      { id: 3, discord_user_id: "999", mensaje: "revisa: 94003\nref: aviso-3-999", clave: "aviso-3-999" },
    ];
    const colaIni = cola.slice();
    const acks = [];
    let caeAviso = true, redCae = true;
    bot.crm.avisosMd = async () => cola.slice();
    bot.crm.avisoEntregado = async (id, r) => {
      if (caeAviso && r.discordUserId === "111") { caeAviso = false; throw new Error("caida"); }
      acks.push([id, r]); const i = cola.findIndex((x) => x.id === id && String(x.discord_user_id) === String(r.discordUserId || "")); if (i >= 0) cola.splice(i, 1);
    };
    await bot.entregarAvisosMd(); // fallo de red al mandar a 111: no se confirma, queda para la siguiente vuelta
    assert.strictEqual(dms["111"].length, 0); assert.ok(!acks.some((x) => x[1].discordUserId === "111"), "fallo pasajero: sin ok:false");
    acks.length = 0; cola.splice(0, cola.length, ...colaIni);
    await bot.entregarAvisosMd().catch(() => {}); // cae justo despues del send a 111
    assert.strictEqual(dms["111"].length, 1, "el MD salio antes de la caida");
    await bot.entregarAvisosMd();
    assert.strictEqual(dms["111"].length, 1, "tras la caida no se reenvia: se encuentra la linea ref y solo se confirma");
    assert.deepStrictEqual(acks[0], [1, { discordUserId: "111", ok: true, discordMessageId: "D1" }]);
    const de = (uid) => acks.find((x) => (x[1].discordUserId || "") === uid)[1];
    assert.strictEqual(de("222").ok, false); assert.ok(de("222").error.startsWith("50007 "), "50007 -> ok:false con el codigo");
    assert.strictEqual(de("").ok, false); assert.strictEqual(de("").error, "sin discord_user_id");
    assert.ok(de("999").error.startsWith("10013 "), "ID inexistente -> 10013");
    assert.strictEqual(cola.length, 0);
    await bot.entregarAvisosMd();
    assert.strictEqual(acks.length, 4, "nada mas que hacer, nada se repite");
    bot.client.user = ant.u; bot.client.users.fetch = ant.uf; Object.assign(bot.crm, { avisosMd: ant.a, avisoEntregado: ant.e });
  }
  console.log("OK: conexion con el CRM (no-op sin secretos, idempotencia, firma, entregas sin repetir, respuestas rapidas, avisos MD: ok / 50007 / 10013 / sin ID / caida sin reenviar)");
};
