"use strict";

/**
 * FAQ del paquete de atención de UsagiVR (src/faq.json, generado con herramientas/importar-faq.py).
 * Por cada mensaje se buscan las pocas preguntas más parecidas y se pasan a la IA como notas de referencia.
 */
const FAQ = require("./faq.json");

const VACIAS = new Set(
  ("que como cual cuál para por con los las del una uno unos unas mis mi tu tus sus son esta este esto estan está están hay tengo tiene " +
    "puedo puede pueden hola quisiera saber oye pero porque cuando donde dónde sirve hace hacer the and for with you your are can does " +
    "this that have has how what which will would could there from about into just need").split(" ")
);
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// Raíz corta (5 letras) para que "cuanto/cuantas", "envian/envio" o "bateria/baterias" cuenten igual.
const palabras = (s) => new Set(norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !VACIAS.has(w)).map((w) => w.slice(0, 5)));

// Palabras que salen en muchísimas FAQ ("tracker", "slimevr"…) no distinguen nada: se ignoran.
const crudo = FAQ.map((f) => ({ f, frases: [f.q.es, f.q.en, ...f.alias].map(palabras) }));
const enCuantas = new Map();
for (const { frases } of crudo) for (const w of new Set(frases.flatMap((p) => [...p]))) enCuantas.set(w, (enCuantas.get(w) || 0) + 1);
const COMUNES = new Set([...enCuantas].filter(([, n]) => n > FAQ.length * 0.12).map(([w]) => w));
const util = (set) => new Set([...set].filter((w) => !COMUNES.has(w)));
const INDICE = crudo.map(({ f, frases }) => ({ f, frases: frases.map(util) }));

/** Las `max` FAQ más parecidas al texto (parecido = palabras compartidas sobre las de la pregunta). */
function buscarFaq(texto, max = 3, minimo = 0.6) {
  const t = util(palabras(texto));
  if (!t.size) return [];
  const puntos = [];
  for (const { f, frases } of INDICE) {
    let mejor = 0;
    for (const p of frases) {
      if (!p.size) continue;
      let comunes = 0;
      for (const w of p) if (t.has(w)) comunes++;
      // Mensajes largos con varias preguntas: se mide contra la frase más corta de las dos.
      if (comunes) mejor = Math.max(mejor, comunes / Math.min(p.size, t.size) - (comunes === 1 && p.size > 2 ? 0.25 : 0));
    }
    if (mejor >= minimo) puntos.push({ f, mejor });
  }
  return puntos.sort((a, b) => b.mejor - a.mejor).slice(0, max).map((x) => x.f);
}

function notasFaq(texto, lang) {
  const hits = buscarFaq(texto);
  if (!hits.length) return "";
  return (
    "\n\nSHOP FAQ NOTES (internal reference written for staff: use the facts, rewrite them in your own casual words, never paste them, never mention eBay, ignore anything about prices you can't confirm):\n" +
    hits.map((f) => `- Q: ${f.q[lang]}\n  A: ${f.a[lang]}`).join("\n")
  );
}

module.exports = { buscarFaq, notasFaq, FAQ };
