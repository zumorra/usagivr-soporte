"use strict";
// Conversaciones de prueba contra la misma IA y el mismo prompt del bot, sin Discord.
// Uso: node herramientas/simular.js [salida.md]
const fs = require("node:fs");
const path = require("node:path");
const CFG = require("../config.json");
const { promptSistema, pideDevolucion, pideCompra } = require("../src/index");
const { responder } = require("../src/ia");
const { notasFaq } = require("../src/faq");
const { PROHIBIDO, casoEspecial } = require("../src/reglas");
const { T } = require("../src/textos");

const ESCENAS = [
  { titulo: "Correa rota", lang: "es", problema: "Se me rompió una correa", turnos: ["Se me rompió una correa", "se rompió cuando la estaba apretando, el plástico de la hebilla"] },
  { titulo: "¿WiFi o antena?", lang: "es", problema: "quiero configurar mis trackers", turnos: ["tengo 11 ice cube, son blancos", "creo que mis trackers son wifi? cómo sé cuáles son"] },
  { titulo: "Agua en un tracker", lang: "es", problema: "se me cayó agua sobre el tracker", turnos: ["se me cayó agua sobre el tracker, ¿podrían cambiármelo?"] },
  { titulo: "Compró su propia antena", lang: "es", problema: "antena", turnos: ["me compré otra antena porque la mía no agarraba bien, me pueden reembolsar lo que gasté?"] },
  { titulo: "Firmware de IceCube", lang: "es", problema: "actualizar firmware", turnos: ["quiero actualizar el firmware de mis icecube con el smol configurator, cómo le hago?"] },
  { titulo: "Cómo va en la correa", lang: "es", problema: "correas", turnos: ["cómo meto el tracker en la correa? hacia dónde va el usb?"] },
  { titulo: "Primera configuración", lang: "es", problema: "acabo de recibir mis trackers", turnos: ["acabo de recibir mi kit de 7, qué hago primero? tengo quest 3 y pc"] },
  { titulo: "Precio de un tracker extra", lang: "es", problema: "duda", turnos: ["oye y si quiero comprar un tracker extra cuánto me sale?"] },
  { titulo: "Strap broke (EN)", lang: "en", problema: "one of my straps broke", turnos: ["one of my straps broke", "it arrived like that, the elastic was torn"] },
];

async function escena(e) {
  const sistema = promptSistema(e.lang);
  const charla = [{ role: "user", content: `Order: #1234\nName: Prueba\nProblem: ${e.problema}` }];
  const salida = [];
  for (const t of e.turnos) {
    charla.push({ role: "user", content: t });
    // Igual que el bot: cambios/reembolsos los atiende un Helpper; si es golpe o liquido, antes van los consejos.
    const devol = pideDevolucion(t);
    const asignar = `**Bot:** ${T[e.lang].devolucion("@Helpper-de-turno")}`;
    if (pideCompra(t) && !devol) { salida.push(`**Cliente:** ${t}\n\n**Bot:** ${T[e.lang].compra("@Helpper-de-turno")}`); break; }
    if (devol && !casoEspecial(t)) { salida.push(`**Cliente:** ${t}\n\n${asignar}`); break; }
    // Mensajes seguidos del cliente en uno solo, como hace el bot.
    const msgs = [];
    for (const m of charla) {
      const ult = msgs[msgs.length - 1];
      if (ult && ult.role === m.role) ult.content += "\n" + m.content; else msgs.push({ ...m });
    }
    const idioma = e.lang === "es" ? "Spanish (neutral Latin American)" : "English";
    const sys = sistema + (devol ? "\n\nThe customer is asking for an exchange/refund: a teammate will take over right after your message. Only give the TEAM RULES tips for their case (photo, how it happened, drying…), say nothing about exchanges, coverage or money, don't offer the team and don't use [HUMANO]." : "") + notasFaq(t, e.lang) + `\n\nREPLY ONLY IN ${idioma.toUpperCase()}, whatever language the knowledge or the customer's form uses.`;
    let { texto, backend } = await responder(CFG.ia, [{ role: "system", content: sys }, ...msgs]);
    const prohibido = PROHIBIDO.test(texto);
    if (prohibido) { // igual que el bot: un reintento y si no, texto neutro
      const otra = await responder(CFG.ia, [{ role: "system", content: sys }, ...msgs, { role: "assistant", content: texto }, { role: "system", content: "Rewrite that answer WITHOUT promising or mentioning replacements, refunds, returns, exchanges, warranty, sending a new unit, emails or registered requests. Follow the TEAM RULES. Same language, same casual tone." }]).catch(() => null);
      texto = otra && !PROHIBIDO.test(otra.texto) ? otra.texto : "(no lo arregló: pasa directo al Helpper)";
    }
    texto = texto.replace(/\[(HUMANO|ESCALATE|GUIA:[^\]]*)\]/gi, (x) => `\`${x}\``).trim();
    charla.push({ role: "assistant", content: texto });
    salida.push(`**Cliente:** ${t}\n\n**Bot** _(${backend}${prohibido ? ", 1er intento traía palabra prohibida → reescrito" : ""})_:\n${texto.split("\n").map((l) => "> " + l).join("\n")}${devol ? "\n\n" + asignar : ""}`);
    if (devol) break;
  }
  return `## ${e.titulo}\n\n${salida.join("\n\n")}`;
}

(async () => {
  const partes = [];
  for (const e of ESCENAS) {
    try { partes.push(await escena(e)); } catch (err) { partes.push(`## ${e.titulo}\n\nError: ${err.message}`); }
    console.error("listo:", e.titulo);
  }
  const md = `# Conversaciones simuladas\n\n${partes.join("\n\n---\n\n")}\n`;
  const out = process.argv[2] || path.join(__dirname, "..", "simulacion.md");
  fs.writeFileSync(out, md);
  console.log(out);
})();
