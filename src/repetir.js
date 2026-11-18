"use strict";

/**
 * Cuando no se entiende el problema del cliente: le pedimos, natural, que lo cuente otra vez.
 * Cada frase = una apertura + una peticion (12 x 10 = 120 variantes por idioma; todas se leen bien juntas).
 */
const PARTES = {
  es: {
    aperturas: [
      "Perdón, no te entendí bien.",
      "Uy, creo que no te entendí del todo.",
      "Disculpa, me perdí un poquito.",
      "Mmm, no me quedó muy claro.",
      "Perdona, no logré entender bien lo que pasa.",
      "Creo que se me escapó algo.",
      "Ay, no te seguí del todo.",
      "Disculpa, no alcancé a entender bien.",
      "Híjole, no te entendí muy bien.",
      "Perdón, me confundí un poco.",
      "Mmm, me quedé con dudas.",
      "Disculpa, no sé si te entendí bien.",
    ],
    peticiones: [
      "¿Me cuentas otra vez qué te pasa? Así te puedo ayudar mejor.",
      "¿Me lo explicas de nuevo con un poquito más de detalle? Así te ayudo mejor.",
      "¿Me dices otra vez cuál es el problema? Con eso te ayudo más rápido.",
      "¿Me platicas de nuevo qué está pasando con tus trackers?",
      "¿Me lo vuelves a contar? Por ejemplo, qué hace el tracker o qué mensaje te sale.",
      "¿Me explicas otra vez qué problema tienes? Así le atinamos a la solución.",
      "¿Me cuentas un poco más de lo que pasa? Con eso ya te puedo ayudar.",
      "¿Me lo repites con otras palabras? Así no te doy una respuesta equivocada.",
      "¿Qué es lo que está fallando? Cuéntame otra vez y lo vemos juntos.",
      "¿Me dices de nuevo qué pasa y en qué paso vas? Así te ayudo mejor.",
    ],
  },
  en: {
    aperturas: [
      "Sorry, I didn't quite get that.",
      "Hmm, I'm not sure I understood.",
      "Sorry, I got a little lost there.",
      "I think I missed something.",
      "Sorry, that wasn't totally clear to me.",
      "Hmm, I didn't quite follow.",
      "Apologies, I'm not sure what you meant.",
      "Sorry, I couldn't quite understand that.",
      "Oops, I think I lost you there.",
      "Hmm, I'm a bit confused.",
      "Sorry, I want to make sure I get this right.",
      "I'm not sure I caught that.",
    ],
    peticiones: [
      "Could you tell me again what's going on? That way I can help you better.",
      "Could you explain it again with a bit more detail? That way I can help you better.",
      "What's the problem you're having? Tell me once more and we'll sort it out.",
      "Could you walk me through what's happening with your trackers?",
      "Could you tell me again? For example, what the tracker does or what message you see.",
      "Can you describe the problem again? That way we can find the right fix.",
      "Could you tell me a little more about what's happening? Then I can help.",
      "Could you say it in other words? I don't want to give you the wrong answer.",
      "What exactly isn't working? Tell me again and we'll look at it together.",
      "Could you tell me again what's happening and which step you're on?",
    ],
  },
};

function variantes(lang) {
  const p = PARTES[lang] || PARTES.es;
  return p.aperturas.flatMap((a) => p.peticiones.map((b) => `${a} ${b}`));
}

const ultima = {};
/** Una frase al azar, nunca la misma dos veces seguidas. */
function pedirRepetir(lang) {
  const v = variantes(lang);
  let f;
  do f = v[Math.floor(Math.random() * v.length)];
  while (f === ultima[lang] && v.length > 1);
  ultima[lang] = f;
  return f;
}

module.exports = { variantes, pedirRepetir };
