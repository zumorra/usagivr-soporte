"use strict";
// Pruebas sin Discord ni internet: deteccion de tema e idioma.
const assert = require("node:assert");
const { buscarTemas } = require("./src/kb");
const { idiomaDe, pideHumano } = require("./src/index");

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
console.log(`OK: ${ok} temas + 4 idiomas + ${humano.length} pedir-humano`);
