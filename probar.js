"use strict";
// Pruebas sin Discord ni internet: deteccion de tema e idioma.
const assert = require("node:assert");
const { buscarTemas } = require("./src/kb");
const { idiomaDe, pideHumano, pideDevolucion, pideCompra } = require("./src/index");

const casos = [
  ["mi tracker no enciende", "no_enciende"],
  ["My tracker won't turn on after charging", "no_enciende"],
  ["mis trackers nuevos no se conectan", "no_conecta"],
  ["my new trackers won't connect", "no_conecta"],
  ["donde pongo la antena", "antena"],
  ["my trackers keep cutting out, where should the dongle go", "antena"],
  ["como me pongo las correas?", "correas"],
  ["how do I put on the straps", "correas"],
  ["donde coloco los trackers en el cuerpo", "colocacion"],
  ["where do I place the trackers", "colocacion"],
  ["el del pecho se gira solo, drift", "drift"],
  ["my legs cross when I sit in vrchat", "calibracion"],
  ["quest standalone osc", "quest"],
  ["la bateria dura poco", "bateria"],
  ["se me descarga rapido", "bateria"],
  ["como configuro los botones de reset y y b para cuando me quiero calibrar en vr?", "botones_reset"],
  ["how do I bind quick reset to a controller button", "botones_reset"],
  ["tengo 8 trackers donde van", "kits"],
  ["sirve para iphone o mac?", "dispositivos"],
  ["tengo que tener mi pc encendida?", "dispositivos"],
  ["se me salio el boton que hago", "boton_suelto"],
  ["formatee la pc, en que orden instalo todo", "configurar_slimevr"],
  ["como uso el smol configurator", "smol_configurator"],
  ["como instalo slimevr por primera vez", "configurar_slimevr"],
];
let ok = 0;
for (const [txt, esperado] of casos) {
  const t = buscarTemas(txt).map((x) => x.id);
  assert.ok(t[0] === esperado, `"${txt}" -> ${t.join(",")} (esperaba ${esperado})`);
  ok++;
}
const m = (...n) => { const arr = n.map((name) => ({ name })); return { roles: { cache: { some: (f) => arr.some(f) } } }; };
assert.strictEqual(idiomaDe(m("English")), "en");
assert.strictEqual(idiomaDe(m("Spanish")), "es");
assert.strictEqual(idiomaDe(m(), "mis trackers no se conectan"), "es");
assert.strictEqual(idiomaDe(m(), "my trackers won't connect"), "en");
const humano = [["quiero hablar con un técnico", true], ["pásame con alguien del equipo", true], ["I want to talk to a human", true],
  ["creo que es un problema técnico", false], ["necesito ayuda con wifi", false], ["my tracker wont turn on", false]];
for (const [txt, esp] of humano) assert.strictEqual(pideHumano(txt), esp, `pideHumano("${txt}")`);
const dev = [["quiero una devolución", true], ["me lo pueden reemplazar?", true], ["quiero regresarlo", true], ["I want a refund", true], ["can I get a replacement", true],
  ["mi tracker no enciende", false], ["como hago el reset", false], ["se me salio el boton", false]];
for (const [txt, esp] of dev) assert.strictEqual(pideDevolucion(txt), esp, `pideDevolucion("${txt}")`);
const compra = [["cuánto cuesta un tracker extra?", true], ["puedo comprar otra correa?", true], ["quiero comprar 2 trackers mas", true], ["how much is an extra tracker", true], ["can I buy another strap?", true],
  ["me compré otra antena porque la mía no jalaba", false], ["mi tracker no enciende", false], ["como pongo la correa", false]];
for (const [txt, esp] of compra) assert.strictEqual(pideCompra(txt), esp, `pideCompra("${txt}")`);
const { PROHIBIDO } = require("./src/reglas");
assert.ok(PROHIBIDO.test("cuesta $45") && PROHIBIDO.test("son 900 pesos") && !PROHIBIDO.test("tienes 7 trackers"));
// El tema del canal guarda el estado del seguimiento aunque el problema sea larguisimo.
const { temaCanal, esImagen, leerTicket } = require("./src/index");
const dt = { uid: "1", usuario: "a b", lang: "es", estado: "escalado", pedido: "123", nombre: "Ñu", esc: 1700000000000, aid: "9", motivo: "Foto de algo roto", problema: "ñ".repeat(800) };
const tema = temaCanal(dt);
assert.ok(tema.length <= 1024, "tema <= 1024");
const lt = leerTicket({ topic: tema });
assert.strictEqual(lt.aid, "9"); assert.strictEqual(lt.esc, "1700000000000"); assert.ok(lt.problema.startsWith("ñññ"));
assert.ok(esImagen({ contentType: "image/png" }) && esImagen({ name: "x.JPG" }) && !esImagen({ contentType: "text/plain", name: "log.txt" }));
// Enojo, horario y panel con dudas comunes.
const { estaEnojado, mensajePanel } = require("./src/index");
for (const t of ["esto es una estafa", "ya me harté, nadie me contesta", "PORQUE NO FUNCIONA NADA DE ESTO", "funciona???!!!", "worst product ever"]) assert.ok(estaEnojado(t), `enojado: ${t}`);
for (const t of ["mi tracker no prende", "no se conecta al wifi", "OK", "gracias!"]) assert.ok(!estaEnojado(t), `no enojado: ${t}`);
const { enHorario, proximaApertura } = require("./src/horario");
const lunes11 = new Date("2026-10-19T17:00:00Z"); // 11:00 en CDMX
const domingo = new Date("2026-10-25T20:00:00Z");
assert.ok(enHorario(lunes11) && !enHorario(domingo));
assert.strictEqual(new Date(proximaApertura(domingo)).toISOString(), "2026-10-26T16:00:00.000Z"); // lunes 10:00 CDMX
assert.strictEqual(mensajePanel(["correas", "nada", "colocacion"]).embeds[0].toJSON().fields.length, 3);
console.log(`OK: ${ok} temas + 4 idiomas + ${humano.length} pedir-humano + ${dev.length} devolucion + ${compra.length} compra + seguimiento/fotos/enojo/horario/panel`);
