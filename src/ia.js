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
      if (/aborted/i.test(e.message)) return textoDe(await pedir("https://text.pollinations.ai/openai", { method: "POST", body: cuerpo }));
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
    // stdin cerrado: con una tuberia abierta "opencode run" se queda esperando entrada y nunca contesta.
    const r = await new Promise((resolve) => {
      const h = cp.spawn("opencode", ["run", "--model", modelo, prompt], { cwd: os.tmpdir(), stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "", stderr = "";
      h.stdout.on("data", (b) => { stdout += b; });
      h.stderr.on("data", (b) => { stderr += b; });
      const t = setTimeout(() => h.kill("SIGKILL"), 40000);
      h.on("error", (error) => { clearTimeout(t); resolve({ error, stdout, stderr }); });
      h.on("close", () => { clearTimeout(t); resolve({ stdout, stderr }); });
    });
    if (r.error && r.error.code === "ENOENT") throw new Error("opencode no instalado");
    const ansi = /\x1b\[[0-9;]*m/g;
    const salida = String(r.stdout || "").replace(ansi, "").trim();
    const err = String(r.stderr || "").replace(ansi, "").trim();
    if (salida && !/^Error:/m.test(salida)) return salida;
    ultimo = (err || salida).split("\n").filter(Boolean).pop() || "sin salida";
  }
  throw new Error(`opencode: ${ultimo.slice(0, 120)}`);
}


// Mira las fotos del cliente con un modelo gratis con vision (OpenCode) y dice si se ve algo roto o mojado.
// Devuelve true / false, o null si ninguna IA pudo verla (entonces decide el texto del cliente).
const fs = require("node:fs");
const path = require("node:path");
const PROMPT_FOTO = "Look at the attached photo from a customer of a shop that sells VR body trackers (small plastic boxes with a USB-C port, straps, USB antennas, cables). Is anything in it broken, cracked, torn, snapped, burnt, melted, or wet / liquid-damaged? Answer ONLY one word: DANIO or NORMAL.";
async function verFotos(cfg, urls) {
  const modelos = String(cfg.vision_modelo || "opencode/nemotron-3.5-super-vl-free,opencode/mimo-v2.6-flash-free").split(",").map((x) => x.trim()).filter(Boolean);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "foto-"));
  try {
    let vistas = 0;
    for (const [i, url] of urls.slice(0, 3).entries()) {
      const r = await fetch(url).catch(() => null);
      if (!r || !r.ok) continue;
      const tipo = r.headers.get("content-type") || "";
      if (!/^image\//.test(tipo)) continue;
      const archivo = path.join(dir, `foto${i}.${(tipo.split("/")[1] || "jpg").split(";")[0]}`);
      fs.writeFileSync(archivo, Buffer.from(await r.arrayBuffer()));
      for (const modelo of modelos) {
        const salida = await new Promise((resolve) => {
          const h = cp.spawn("opencode", ["run", "--model", modelo, "-f", archivo, PROMPT_FOTO], { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
          let out = "";
          h.stdout.on("data", (b) => { out += b; });
          const t = setTimeout(() => h.kill("SIGKILL"), 60000);
          h.on("error", () => { clearTimeout(t); resolve(""); });
          h.on("close", () => { clearTimeout(t); resolve(out.replace(/\x1b\[[0-9;]*m/g, "")); });
        });
        const ult = salida.trim().split("\n").pop() || "";
        if (/\bDANIO\b/i.test(ult)) return true;
        if (/\bNORMAL\b/i.test(ult)) { vistas++; break; }
      }
    }
    return vistas ? false : null;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const BACKENDS = { pollinations, opencode, groq };

async function responder(cfg, mensajes) {
  const fallos = [];
  const inicio = Date.now();
  for (const nombre of cfg.orden) {
    if (Date.now() - inicio > (cfg.presupuesto_ms || PRESUPUESTO_MS)) {
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

module.exports = { responder, verFotos };
