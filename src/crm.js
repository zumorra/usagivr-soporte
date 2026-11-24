"use strict";
/**
 * Conexion con Usagi CRM (Helpdesk web) por /v1/soporte/*.
 *
 * - Lee CRM_URL, CRM_TOKEN y CRM_HMAC_SECRET (opcional) de los secretos de GitHub Actions. Sin ellos, todo es no-op.
 * - Nunca imprime respuestas ni datos de clientes (los logs de Actions son publicos): solo metodo, ruta, estado y ms.
 * - Timeout corto: si el CRM no contesta, Discord sigue funcionando igual.
 */
const crypto = require("node:crypto");

function crearCrm(opts = {}) {
  const base = String(opts.baseUrl || process.env.CRM_URL || "").replace(/\/+$/, "");
  const token = String(opts.token || process.env.CRM_TOKEN || "").trim();
  const secreto = String(opts.hmacSecret || process.env.CRM_HMAC_SECRET || "").trim();
  const timeoutMs = Number(opts.timeoutMs || 6000);
  const activo = () => Boolean(base && token);

  async function pedir(method, ruta, body, extra = {}) {
    if (!activo()) return { ok: false, skipped: true, status: 0 };
    const raw = body !== undefined ? JSON.stringify(body) : null;
    const headers = { Authorization: `Bearer ${token}`, ...extra };
    if (raw !== null) headers["Content-Type"] = "application/json";
    if (secreto) headers["X-Firma"] = "sha256=" + crypto.createHmac("sha256", secreto).update(raw !== null ? raw : ruta).digest("hex");
    const t0 = Date.now();
    const soloRuta = ruta.split("?")[0].replace(/\/\d+(?=\/|$)/g, "/:id");
    try {
      const res = await fetch(base + ruta, { method, headers, body: raw ?? undefined, signal: AbortSignal.timeout(timeoutMs) });
      const data = await res.json().catch(() => null);
      if (!res.ok || opts.verbose) console.info(`[CRM] ${method} ${soloRuta} -> ${res.status} (${Date.now() - t0}ms)`);
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      console.warn(`[CRM] ${method} ${soloRuta} -> ERR (${Date.now() - t0}ms): ${e && e.name ? e.name : "error"}`);
      return { ok: false, status: 0 };
    }
  }

  const tickets = new Map(); // canal -> id del ticket en el CRM (cache de la sesion)
  return {
    activo,
    // Idempotente por canal: tras un reinicio devuelve el mismo ticket, asi no hace falta guardar nada en Discord.
    async ticketDe(canalId, { discordId, pedido, nombre, motivo, lang } = {}) {
      if (tickets.has(canalId)) return tickets.get(canalId);
      const r = await pedir("POST", "/v1/soporte/tickets",
        { canal_id: canalId, discord_id: discordId, pedido, nombre, motivo, lang }, { "Idempotency-Key": `${canalId}:abierto` });
      const id = r.ok && r.data ? r.data.ticket_id || r.data.id : null;
      if (id) tickets.set(canalId, id);
      return id;
    },
    // direccion: in (cliente), out (equipo o bot). auto=true para lo que escribe el bot.
    mensaje(ticketId, { texto, direccion = "in", autor, auto = false }) {
      if (!ticketId || !String(texto || "").trim()) return Promise.resolve({ ok: false, skipped: true });
      return pedir("POST", `/v1/soporte/tickets/${ticketId}/mensajes`, { mensaje: String(texto).slice(0, 4000), direction: direccion, autor, auto });
    },
    cerrar(ticketId, { estado = "resolved", solucion, cerradoPor } = {}) {
      if (!ticketId) return Promise.resolve({ ok: false, skipped: true });
      return pedir("PATCH", `/v1/soporte/tickets/${ticketId}`, { estado, solucion, cerrado_por: cerradoPor, cerrado_en: new Date().toISOString() });
    },
    async pendientes() {
      const r = await pedir("GET", "/v1/soporte/pendientes?limit=20");
      return r.ok && r.data ? r.data.items || [] : [];
    },
    entregado(mensajeId, { ok = true, discordMessageId, error } = {}) {
      return pedir("POST", `/v1/soporte/mensajes/${mensajeId}/entregado`, { ok, discord_message_id: discordMessageId, error });
    },
    async respuestasRapidas(ticketId) {
      const r = await pedir("GET", `/v1/soporte/respuestas-rapidas${ticketId ? `?ticket_id=${ticketId}` : ""}`);
      return r.ok && r.data ? r.data.items || [] : [];
    },
    _olvidar: (canalId) => tickets.delete(canalId),
  };
}

module.exports = { crearCrm };
