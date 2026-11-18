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
  ["que opciones tengo que tocar en settings, smoothing y gesture control", "ajustes_slimevr"],
  ["que tengo que tocar para que la configuracion de vrchat este bien", "ajustes_vrchat"],
  ["me salen triangulos amarillos en vrchat configuration warnings", "ajustes_vrchat"],
  ["que debo configurar dentro de vr", "ajustes_vrchat"],
  ["como calibro en vrchat", "calibracion"],
  ["vrchat fbt settings", "ajustes_vrchat"],
  ["mis piernas se cruzan en vrchat", "calibracion"],
  ["como actualizo el firmware de mis bmi160", "sin_firmware"],
  ["puedo actualizar mis ice cube?", "sin_firmware"],
  ["how do I update the firmware on my icecubes", "sin_firmware"],
  ["mis bmi160 no se conectan al wifi", "no_conecta"],
  ["how do I update my icm45 trackers to 7.2", "firmware_wifi"],
  ["que rotacion pongo para los bno085", "firmware_wifi"],
  ["mi smol se queda en rojo", "smol_rojo"],
  ["how do I turn off my smol tracker", "smol_rojo"],
  ["me salen trackers duplicados con virtual desktop", "smol_rojo"],
  ["tengo router de at&t y no conectan por wifi", "wifi"],
  ["dice unable to connect to wifi", "wifi"],
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
// Rol + como escribe: si escribe claro en el otro idioma, gana el texto; si no, el rol.
assert.strictEqual(idiomaDe(m("English"), "hola, mis trackers no se conectan"), "es");
assert.strictEqual(idiomaDe(m("Spanish"), "hi, my trackers won't connect"), "en");
assert.strictEqual(idiomaDe(m("English"), "slimevr"), "en");
assert.strictEqual(idiomaDe(m("Spanish"), "ok"), "es");
assert.strictEqual(idiomaDe(m("English"), "en español porfa"), "es");
{
  const { decidirIdioma: dI, analizarIdioma: aI } = require("./src/idioma");
  const ac = (t, e) => dI(t, e).accion;
  assert.strictEqual(ac("el tracker no prende", { lang: "en" }), "cambiar");
  assert.strictEqual(ac("the tracker doesnt turn on", { lang: "es" }), "cambiar");
  assert.strictEqual(ac("no funciona", { lang: "es" }), "seguir");
  assert.strictEqual(ac("drift", { lang: "en", dudas: 0 }), "seguir");    // 1a vez sin idioma: sigue
  assert.strictEqual(ac("drift", { lang: "en", dudas: 1 }), "seguir");    // 2a vez: aun no pregunta
  assert.strictEqual(ac("drift", { lang: "en", dudas: 2 }), "preguntar"); // 3a vez seguida sin pista: pregunta
  assert.strictEqual(ac("ok", { lang: "en", dudas: 2 }), "seguir");       // "ok" no es duda
  assert.strictEqual(ac("dongle", { lang: "es", dudas: 2, preguntado: true }), "seguir"); // solo pregunta una vez
  assert.strictEqual(ac("meu tracker não conecta", { lang: "es" }), "seguir");             // otro idioma: 1a duda, no pregunta
  assert.strictEqual(ac("meu tracker não conecta", { lang: "es", dudas: 2 }), "preguntar"); // 3a: ahora si
  assert.strictEqual(ac("мой трекер не работает", { lang: "en", dudas: 2 }), "preguntar");
  // 3 mensajes dudosos que apuntan a un idioma: lo detecta solo, sin preguntar.
  { let e = { lang: "en", dudas: 0 }, r;
    for (const t of ["tracker no", "drift", "dongle"]) { r = dI(t, e); e = { ...e, ...r }; }
    assert.ok(r.accion !== "preguntar", `con pista no pregunta: ${JSON.stringify(r)}`); }
  assert.strictEqual(ac("meu tracker não conecta", { lang: "en", dudas: 2, inclina: "es" }), "preguntar"); // pista vieja no vale
  assert.strictEqual(ac("can you speak spanish", { lang: "en" }), "cambiar");
  assert.ok(aI("👍").neutro && aI("si").neutro && !aI("firmware").lang);
  const { PREGUNTA_IDIOMA } = require("./src/index");
  assert.ok(PREGUNTA_IDIOMA.length >= 3 && PREGUNTA_IDIOMA.every((x) => /espa/i.test(x) && /english/i.test(x)));
}
const humano = [["quiero hablar con un técnico", true], ["pásame con alguien del equipo", true], ["I want to talk to a human", true],
  ["creo que es un problema técnico", false], ["necesito ayuda con wifi", false], ["my tracker wont turn on", false]];
for (const [txt, esp] of humano) assert.strictEqual(pideHumano(txt), esp, `pideHumano("${txt}")`);
const dev = [["quiero una devolución", true], ["me lo pueden reemplazar?", true], ["quiero regresarlo", true], ["I want a refund", true], ["can I get a replacement", true],
  ["mi tracker no enciende", false], ["como hago el reset", false], ["se me salio el boton", false]];
for (const [txt, esp] of dev) assert.strictEqual(pideDevolucion(txt), esp, `pideDevolucion("${txt}")`);
const compra = [["cuánto cuesta un tracker extra?", true], ["puedo comprar otra correa?", true], ["quiero comprar 2 trackers mas", true], ["how much is an extra tracker", true], ["can I buy another strap?", true],
  ["me compré otra antena porque la mía no jalaba", false], ["mi tracker no enciende", false], ["como pongo la correa", false]];
for (const [txt, esp] of compra) assert.strictEqual(pideCompra(txt), esp, `pideCompra("${txt}")`);
// Cancelaciones, cambios y recambios tambien van con un compañero; cambiar cosas de SlimeVR no.
for (const [txt, esp] of [["quiero cancelar mi pedido", true], ["can I cancel my order", true], ["necesito un repuesto de la correa", true], ["quiero un cambio de talla de correa", true], ["quiero cambiar mi kit por uno de 8", true],
  ["cancelé la calibración y no se mueve", false], ["puedo cambiarlo de puerto usb?", false], ["como cambio la rotacion del tracker", false], ["cancel calibration doesnt work", false]])
  assert.strictEqual(pideDevolucion(txt), esp, `pideDevolucion("${txt}")`);
for (const [txt, esp] of [["cuanto me sale un kit de 8?", true], ["que precio tienen las correas", true], ["what's the pricing for extra trackers", true], ["tienen alguna oferta?", true], ["mi tracker no prende", false]])
  assert.strictEqual(pideCompra(txt), esp, `pideCompra("${txt}")`);
// Frases para pasar con un compañero: 40 de precios por idioma, todas mencionan al compañero y ninguna da precios.
{ const { FRASES } = require("./src/frases"); const { T } = require("./src/textos"); const { PROHIBIDO: P } = require("./src/reglas");
  for (const l of ["es", "en"]) {
    assert.strictEqual(new Set(FRASES[l].compra).size, 40, `${l}: 40 frases de precio`);
    for (const k of ["compra", "devolucion", "foto", "enojo", "segundo"]) for (const f of FRASES[l][k]) {
      assert.ok(f.includes("{r}"), `${l}.${k} sin compañero: ${f}`);
      assert.ok(!P.test(f) && !/\d/.test(f), `${l}.${k} con precio o palabra prohibida: ${f}`);
    }
    for (const f of [...FRASES[l].compraYa]) assert.ok(!P.test(f) && !/\d/.test(f), f);
    assert.ok(T[l].compra("<@1>").includes("<@1>") && T[l].segundo("<@2>").includes("<@2>") && T[l].compraYa().length > 10);
    for (const f of FRASES[l].compra) assert.ok(/compra|comprar|buy|purchase|sell|order/i.test(f), `${l}: la frase no dice que si puede comprar: ${f}`);
    for (const f of FRASES[l].enojo) assert.ok(/se una|sume|join/i.test(f), `${l}: enojo sin ofrecer otro compañero: ${f}`);
  } }
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
const { estaEnojado, mensajePanel, yaQuedo } = require("./src/index");
for (const t of ["ya quedó, gracias!", "ya funciona", "ya se arregló", "lo resolví", "it works now, thanks", "solved!", "Ya jaló"]) assert.ok(yaQuedo(t), `ya quedo: ${t}`);
for (const t of ["ya funciona pero se desconecta", "¿ya quedó?", "still not working", "no funciona", "ya prendió pero sigue sin conectar"]) assert.ok(!yaQuedo(t), `no ya quedo: ${t}`);
for (const t of ["esto es una estafa", "ya me harté, nadie me contesta", "PORQUE NO FUNCIONA NADA DE ESTO", "funciona???!!!", "worst product ever"]) assert.ok(estaEnojado(t), `enojado: ${t}`);
for (const t of ["mi tracker no prende", "no se conecta al wifi", "OK", "gracias!"]) assert.ok(!estaEnojado(t), `no enojado: ${t}`);
const { enHorario, proximaApertura } = require("./src/horario");
const lunes11 = new Date("2026-10-19T18:00:00Z"); // 11:00 en Los Angeles (PDT)
const domingo = new Date("2026-10-25T20:00:00Z");
assert.ok(enHorario(lunes11) && !enHorario(domingo) && !enHorario(new Date("2026-10-19T17:59:00Z")));
assert.strictEqual(new Date(proximaApertura(domingo)).toISOString(), "2026-10-26T18:00:00.000Z"); // lunes 11:00 LA
assert.ok(enHorario(new Date("2026-10-20T02:59:00Z")) && !enHorario(new Date("2026-10-20T03:00:00Z"))); // 7:59 pm si, 8:00 pm ya no
assert.strictEqual(new Date(proximaApertura(new Date("2026-10-20T03:30:00Z"))).toISOString(), "2026-10-20T18:00:00.000Z"); // martes 11:00
assert.ok(enHorario(new Date("2026-11-23T19:00:00Z")) && !enHorario(new Date("2026-11-23T18:59:00Z"))); // invierno (PST): 11:00 = 19:00Z
assert.ok(!enHorario(new Date("2026-11-22T20:00:00Z"))); // domingo cerrado
assert.strictEqual(mensajePanel(["correas", "nada", "colocacion"]).embeds[0].toJSON().fields.length, 3);
// Auditor: lee el veredicto aunque venga con texto alrededor; si no hay JSON, deja pasar.
const { leerVeredicto, ordenAuditor } = require("./src/auditor");
assert.strictEqual(leerVeredicto('Sure: {"verdict":"redo","reason":"adds firmware steps"}').veredicto, "rehacer");
assert.strictEqual(leerVeredicto('{"verdict":"unclear","reason":"gibberish"}').veredicto, "aclarar");
assert.strictEqual(leerVeredicto('{"verdict":"ok"}').veredicto, "ok");
assert.strictEqual(leerVeredicto("no se").veredicto, "ok");
assert.deepStrictEqual(ordenAuditor({ orden: ["groq", "opencode", "pollinations"] }, "groq"), ["opencode", "pollinations", "groq"]);
const { variantes, pedirRepetir } = require("./src/repetir");
for (const l of ["es", "en"]) { const v = variantes(l); assert.ok(new Set(v).size >= 100, `${l}: ${v.length} variantes`); assert.ok(v.includes(pedirRepetir(l))); }
// Pedir idioma con solo el nombre, y negaciones ("no hablo inglés" pide español).
{ const { analizarIdioma: ai } = require("./src/idioma");
  for (const [t, p] of [["inglés por favor","en"],["English, please","en"],["ingles porfa","en"],["english?","en"],["español por favor","es"],["prefiero el inglés","en"],["prefiero hablar inglés","en"],["¿Puedes hablar en español por favor?","es"],["No hablo de eso",null],["no hablo inglés, por favor ayuda","es"],["I don't speak english","es"],["I dont speak spanish please help","en"],["mi tracker no prende por favor",null],["english tracker manual please",null]])
    assert.strictEqual(ai(t).pedido, p, t); }
const { saberAuditor } = require("./src/index");
assert.ok(/Ice Cube/.test(saberAuditor([{ role: "user", content: "puedo actualizar mis ice cube" }], "No se puede [GUIA:sin_firmware]", "es")));
console.log(`OK: ${ok} temas + 39 idiomas + ${humano.length} pedir-humano + ${dev.length} devolucion + ${compra.length} compra + frases(40 precio)/cancelar/seguimiento/fotos/enojo/horario/panel/ya-quedo`);
