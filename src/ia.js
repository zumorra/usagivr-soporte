"use strict";

/**
 * IA gratis y online para las preguntas que no encajan en la base.
 * Se prueban en orden; si uno falla se pasa al siguiente:
 * - pollinations  sin clave (1 respuesta cada pocos segundos por IP).
 * - opencode      CLI oficial de OpenCode, modelos ":free" (el runner tiene su propia cuota por IP).
 * - groq          con clave GROQ_API_KEY; solo vale para prompts pequenos (tope 7.000 tokens/min).
 */

const cp = require("node:child_process");
const os = require("node:os");

const TIMEOUT_MS = 25000; // por peticion HTTP
const PRESUPUESTO_MS = 100000; // tope total por respuesta: el cliente no se queda esperando
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0";

async function pedir(url, opciones) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      ...opciones,
      headers: { "User-Agent": USER_AGENT, "Content-Type": "application/json", ...(opciones.headers || {}) },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text().catch(() => "")).slice(0, 300)}`);
    return r.json();
  } finally {
    clearTimeout(t);
  }
}

function textoDe(datos) {
  const m = (datos.choices && datos.choices[0] && datos.choices[0].message) || {};
  const texto = String(m.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (!texto) throw new Error("respuesta vacia");
  return texto;
}

// Sin clave: 1 respuesta cada 30 s por IP (si no, HTTP 402 FREE_LIMIT "Retry after Ns").
// Las llamadas se ponen en fila y se espacian solas.
const ESPACIO_POLLI_MS = 31000;
let ultimaPolli = 0;
let filaPolli = Promise.resolve();
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function pollinations(cfg, mensajes) {
  const cuerpo = JSON.stringify({ model: cfg.pollinations_modelo, messages: mensajes, max_tokens: cfg.max_tokens });
  const turno = filaPolli.then(async () => {
    const falta = ultimaPolli + ESPACIO_POLLI_MS - Date.now();
    if (falta > 0) await dormir(falta);
    try {
      return textoDe(await pedir("https://text.pollinations.ai/openai", { method: "POST", body: cuerpo }));
    } catch (e) {
      const m = /Retry after (\d+)s/i.exec(e.message);
      if (!/HTTP (402|429|5\d\d)/.test(e.message)) throw e;
      await dormir(Math.min(((m && Number(m[1])) || 5) + 1, 31) * 1000);
      return textoDe(await pedir("https://text.pollinations.ai/openai", { method: "POST", body: cuerpo }));
    } finally {
      ultimaPolli = Date.now();
    }
  });
  filaPolli = turno.catch(() => {});
  return turno;
}

async function groq(cfg, mensajes) {
  const clave = process.env.GROQ_API_KEY;
  if (!clave) throw new Error("sin GROQ_API_KEY");
  return textoDe(
    await pedir("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}` },
      body: JSON.stringify({ model: cfg.groq_modelo, messages: mensajes, max_tokens: cfg.max_tokens }),
    })
  );
}

async function opencode(cfg, mensajes) {
  const prompt = mensajes
    .map((m) => (m.role === "system" ? m.content : `${m.role === "user" ? "Customer" : "Support bot"}: ${m.content}`))
    .join("\n\n");
  let ultimo = "";
  for (const modelo of String(cfg.opencode_modelo).split(",").map((s) => s.trim()).filter(Boolean)) {
    const r = await new Promise((resolve) => {
      cp.execFile("opencode", ["run", "--model", modelo, prompt], { cwd: os.tmpdir(), timeout: 45000, maxBuffer: 4 << 20 },
        (error, stdout, stderr) => resolve({ error, stdout, stderr }));
    });
    if (r.error && r.error.code === "ENOENT") throw new Error("opencode no instalado");
    const salida = String(r.stdout || "").trim();
    if (salida) return salida;
    ultimo = String(r.stderr || "").trim().split("\n").pop() || "sin salida";
  }
  throw new Error(`opencode: ${ultimo.slice(0, 120)}`);
}

const BACKENDS = { pollinations, opencode, groq };

async function responder(cfg, mensajes) {
  const fallos = [];
  const inicio = Date.now();
  for (const nombre of cfg.orden) {
    if (Date.now() - inicio > PRESUPUESTO_MS) {
      fallos.push("sin tiempo");
      break;
    }
    try {
      return { texto: await BACKENDS[nombre](cfg, mensajes), backend: nombre };
    } catch (e) {
      fallos.push(`${nombre}: ${e.message}`);
      console.warn(`IA ${nombre} fallo: ${e.message}`);
    }
  }
  throw new Error(`ninguna IA respondio (${fallos.join(" | ")})`);
}

module.exports = { responder };
