"use strict";
// Idioma del cliente: por su rol (English/Spanish) y por como escribe.
// analizarIdioma(texto) mira solo el texto; decidirIdioma(...) decide en cada mensaje
// si se sigue igual, si se cambia o si hay que preguntarle al cliente.

const PISTAS_ES = [" el ", " la ", " no ", " mi ", " mis ", " los ", " las ", " que ", " qué ", " se ", " me ", " y ", " de ", " del ", " como ", " cómo ", " cuanto ", " cuánto ", " por ", " para ", " con ", " es ", " una ", " un ", " tengo ", " quiero ", " pero ", " ya ", " esta ", " está ", " sale ", " deberia", " debería", " gustaria", " gustaría", " correa", " funciona", " conecta", " enciende", " prende", " puedo ", " hago ", " tambien", " también", " ahora ", " cuando ", " donde ", " dónde ", " desconect", " actualiz", " solo ", " sigue ", " hice ", " sirve"];
const PISTAS_EN = [" the ", " my ", " is ", " it ", " i ", " i'm ", " im ", " how ", " what ", " not ", " don't ", " dont ", " doesn't ", " doesnt ", " won't ", " can't ", " cant ", " can ", " please ", " with ", " and ", " to ", " on ", " of ", " help ", " why ", " does ", " should ", " when ", " where ", " have ", " has ", " this ", " that ", " work", " connect", " turn ", " still ", " disconnect", " update", " keeps ", " did ", " doesnt ", " wont "];
const FUERTES_ES = [" hola ", "gracias", "ñ", "¿", "¡", " ayuda", " oye ", " porfa", " buenas ", " buenos dias", " buenos días", " ahorita", " tampoco "];
const FUERTES_EN = [" hello ", " thanks", " thank you", " please", " hey ", " doesn't ", " won't ", " can't ", " i'm ", " i have ", " it's "];
// Otros idiomas que el bot no atiende: portugues, frances, aleman, italiano y alfabetos no latinos.
const OTROS = [
  / você| voce | não | nao | obrigad| tá | estou | meu | minha |ção|ções| ã/,
  / je | j'ai | ne | pas | merci| bonjour| oui | pourquoi | c'est | ça |ç| mon | ma /,
  / ich | nicht | danke| bitte | und | ist | mein | hallo | funktioniert/,
  / ciao | grazie| non funziona| sono | perché | il mio /,
];
const ALFABETO_OTRO = /[Ѐ-ӿ؀-ۿ฀-๿぀-ヿ㐀-鿿가-힯]/;
// "ok", "si", "👍", "123"...: no dicen nada del idioma y no deben contar como duda.
const NEUTRO = /^[\s\d.,!?¿¡:;)(\-_*~"'👍🙏✅❤️👌😊😅🙂]*(ok(ay|i)?|k|vale|va|si|sí|yes|yep|ya|no|nop|nope|thx|ty|gg|xd|jaja+|haha+|lol)?[\s\d.,!?¿¡:;)(\-_*~"'👍🙏✅❤️👌😊😅🙂]*$/i;

const normal = (texto) => ` ${String(texto || "").toLowerCase().replace(/<[@#:!&a-z0-9_]+>|https?:\S+/g, " ").replace(/[?!.,¿¡]/g, (c) => ` ${c} `).replace(/\s+/g, " ")} `;

// { lang: "es"|"en"|null, seguro, otro, pedido, neutro }
function analizarIdioma(texto) {
  const t = normal(texto);
  const r = { lang: null, seguro: false, otro: false, pedido: null, neutro: false };
  // "no hablo inglés, por favor..." pide español, no inglés (y al revés)
  if (/no (hablo|entiendo|se|sé|leo)( bien| mucho)? (el )?(ingles|inglés)|(don.?t|do not|can.?t|cannot) (speak|understand|read)( much)? english/.test(t)) return { ...r, lang: "es", seguro: true, pedido: "es" };
  if (/no (hablo|entiendo|se|sé|leo)( bien| mucho)? (el )?(espanol|español)|(don.?t|do not|can.?t|cannot) (speak|understand|read)( much)? spanish/.test(t)) return { ...r, lang: "en", seguro: true, pedido: "en" };
  if (/(en|in) (espanol|español|espaniol|spanish)|habla(me|s)? (en )?espa|en castellano|speak spanish|(espanol|español|spanish)[ ,!.]*(por favor|porfa|plis|pls|plz|please)|^ *(espanol|español|spanish)[ ?!.]*$|prefiero (hablar |escribir )?(en )?(el )?espa/.test(t)) return { ...r, lang: "es", seguro: true, pedido: "es" };
  if (/(en|in) (ingles|inglés|english)|speak english|habla(me|s)? (en )?ingl|(ingles|inglés|english)[ ,!.]*(por favor|porfa|plis|pls|plz|please)|^ *(ingles|inglés|english)[ ?!.]*$|prefiero (hablar |escribir )?(en )?(el )?ingl/.test(t)) return { ...r, lang: "en", seguro: true, pedido: "en" };
  if (NEUTRO.test(String(texto || "").trim())) return { ...r, neutro: true };
  const nOtro = OTROS.reduce((n, re) => n + (t.match(new RegExp(re.source, "g")) || []).length, 0);
  const fEs = FUERTES_ES.filter((p) => t.includes(p)).length;
  const fEn = FUERTES_EN.filter((p) => t.includes(p)).length;
  const nEs = PISTAS_ES.filter((p) => t.includes(p)).length + fEs * 2;
  const nEn = PISTAS_EN.filter((p) => t.includes(p)).length + fEn * 2;
  if (ALFABETO_OTRO.test(t) && nEs + nEn < 2) return { ...r, otro: true, seguro: true };
  if (nOtro >= 2 && nOtro > nEs && nOtro > nEn) return { ...r, otro: true, seguro: nOtro >= 3 };
  if (nEs === nEn) return r; // no se sabe
  const lang = nEs > nEn ? "es" : "en";
  const gana = Math.max(nEs, nEn), pierde = Math.min(nEs, nEn);
  // Seguro: una pista fuerte sin empate, o al menos 2 pistas y el doble que el otro idioma.
  const seguro = (lang === "es" ? fEs > fEn : fEn > fEs) || (gana >= 2 && gana >= pierde * 2);
  return { ...r, lang, seguro };
}

// Rol del miembro: "es", "en" o null (sin rol o con los dos).
function idiomaRol(tieneEn, tieneEs) {
  if (tieneEs && !tieneEn) return "es";
  if (tieneEn && !tieneEs) return "en";
  return null;
}

// Primer mensaje: lo que pide el cliente > como escribe (si es claro) > su rol > lo que se intuye del texto.
function idiomaInicial(texto, rol) {
  const a = analizarIdioma(texto);
  if (a.lang && (a.seguro || !rol)) return a.lang;
  return rol || a.lang || "en";
}

// Cada mensaje del cliente en su ticket.
// estado = { lang, dudas, preguntado, inclina } -> { accion: "seguir"|"cambiar"|"preguntar", lang, dudas, inclina }
// Se detecta solo, sin preguntar:
// - Lo pide o escribe claro en el otro idioma: se cambia.
// - No se sabe: se sigue en el idioma actual y cuenta como duda; se guarda hacia donde apunta.
// - A la 3a duda seguida: si alguna apuntaba a es/en se cambia a ese; si no hay pista (otro idioma,
//   texto sin idioma) se le pregunta. Una sola vez por ticket.
const DUDAS_PARA_PREGUNTAR = 3;
function decidirIdioma(texto, estado) {
  const { lang, dudas = 0, preguntado = false, inclina = null } = estado;
  const a = analizarIdioma(texto);
  if (a.pedido) return { accion: a.pedido === lang ? "seguir" : "cambiar", lang: a.pedido, dudas: 0, inclina: null };
  if (a.neutro) return { accion: "seguir", lang, dudas, inclina };
  if (a.lang === lang) return { accion: "seguir", lang, dudas: 0, inclina: null };
  if (a.lang && a.seguro) return { accion: "cambiar", lang: a.lang, dudas: 0, inclina: null };
  const n = dudas + 1;
  const hacia = a.otro ? null : a.lang || inclina; // si escribe en otro idioma, las pistas viejas no valen
  if (n >= DUDAS_PARA_PREGUNTAR) {
    if (hacia) return { accion: hacia === lang ? "seguir" : "cambiar", lang: hacia, dudas: 0, inclina: null };
    if (!preguntado) return { accion: "preguntar", lang, dudas: 0, inclina: null };
  }
  return { accion: "seguir", lang, dudas: n, inclina: hacia };
}

module.exports = { analizarIdioma, idiomaRol, idiomaInicial, decidirIdioma, DUDAS_PARA_PREGUNTAR };
