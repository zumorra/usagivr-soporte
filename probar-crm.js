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
  console.log("OK: conexion con el CRM (no-op sin secretos, idempotencia, firma, entregas, respuestas rapidas)");
};
