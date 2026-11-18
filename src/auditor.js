"use strict";

/**
 * Segunda IA online que revisa cada respuesta antes de mandarla.
 * Ve la pregunta del cliente, la charla reciente, las guias que tocan y el borrador, y decide:
 * - ok      : se manda tal cual.
 * - rehacer : no contesta lo que preguntaron, mete info de mas o confusa, o contradice la base -> se reescribe.
 * - aclarar : no se entiende que problema tiene el cliente -> se le pide, natural, que lo cuente otra vez.
 * Si el auditor falla o tarda, la respuesta se manda igual (nunca deja al cliente sin contestar).
 */

const { responder } = require("./ia");

const PROMPT = [
  "You audit a customer-support reply BEFORE it is sent. The shop sells SlimeVR full-body trackers.",
  "You get: the knowledge that applies, the recent conversation and the DRAFT reply.",
  "Reply ONLY with JSON, nothing else: {\"verdict\":\"ok\"|\"redo\"|\"unclear\",\"reason\":\"<max 25 words, in English>\"}",
  "- \"unclear\": the customer's latest message cannot be understood even with the conversation (gibberish, a single vague word, no way to know what problem they mean) AND the draft does not already ask them to explain. Do NOT use it if the problem is understandable.",
  "- \"redo\": the draft does not answer what the customer actually asked; or adds information they did not ask for, or that is confusing or ambiguous; or contradicts the knowledge; or invents hardware details; or gives firmware versions or update steps for Ice Cube or BMI160 trackers (those can never be updated, the answer must just say it can't be done); or is in a different language than the customer.",
  "- \"ok\": otherwise. Short acknowledgements (\"ok\", \"thanks\", \"ya\") are understandable. Less is more: a short reply that answers exactly the question is ok. Don't nitpick tone or style.",
].join("\n");

function leerVeredicto(texto) {
  const m = /\{[\s\S]*\}/.exec(String(texto || ""));
  if (!m) return { veredicto: "ok", motivo: "sin json" };
  try {
    const j = JSON.parse(m[0]);
    const v = String(j.verdict || j.veredicto || "").toLowerCase();
    const veredicto = v === "redo" || v === "rehacer" ? "rehacer" : v === "unclear" || v === "aclarar" ? "aclarar" : "ok";
    return { veredicto, motivo: String(j.reason || j.motivo || "").slice(0, 300) };
  } catch {
    return { veredicto: "ok", motivo: "json roto" };
  }
}

/** Orden del auditor: otra IA distinta de la que escribio el borrador (esa va al final, solo de respaldo). */
function ordenAuditor(cfg, backendBorrador) {
  const base = cfg.orden || ["groq", "opencode", "pollinations"];
  return [...base.filter((b) => b !== backendBorrador), ...base.filter((b) => b === backendBorrador)];
}

/**
 * @param cfg        config "auditor" (orden, modelos, max_tokens)
 * @param charla     [{role, content}] sin el prompt de sistema (solo cliente / bot)
 * @param saber      texto de las guias que aplican
 * @param borrador   respuesta que se quiere mandar
 */
async function auditar(cfg, { charla, saber, borrador, backend }) {
  const conv = charla
    .slice(-6)
    .map((m) => `${m.role === "user" ? "CUSTOMER" : "BOT"}: ${String(m.content).slice(0, 700)}`)
    .join("\n");
  const mensajes = [
    { role: "system", content: PROMPT },
    { role: "user", content: `KNOWLEDGE:\n${saber.slice(0, 3500)}\n\nCONVERSATION:\n${conv}\n\nDRAFT REPLY:\n${borrador.slice(0, 1900)}` },
  ];
  const c = { ...cfg, orden: ordenAuditor(cfg, backend) };
  const { texto, backend: quien } = await responder(c, mensajes);
  return { ...leerVeredicto(texto), backend: quien };
}

module.exports = { auditar, leerVeredicto, ordenAuditor };
