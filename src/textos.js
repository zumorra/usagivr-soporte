"use strict";

/** Todos los textos que ve el cliente, en espanol e ingles. */
const T = {
  es: {
    panelTitulo: "Soporte USAGIVR",
    panelDesc:
      "¿Problemas con tus trackers? Pulsa **Abrir ticket**, rellena el formulario y te ayudo al momento.\n" +
      "Si no se resuelve, un compañero del equipo te atenderá.",
    abrir: "Abrir ticket",
    modalTitulo: "Ticket de soporte USAGIVR",
    campoPedido: "Número de compra / pedido",
    campoNombre: "Nombre del cliente",
    campoProblema: "Describe el problema",
    campoProblemaPh: "Ej.: mis trackers nuevos no se conectan al WiFi",
    yaTienes: (c) => `Ya tienes un ticket abierto: ${c}`,
    creado: (c) => `Tu ticket está abierto: ${c}`,
    bienvenida: (u) => `Hola ${u}, gracias por escribir. Esto es lo que suele arreglarlo:`,
    sinTema: "Déjame revisarlo…",
    pregunta: "¿Se solucionó?",
    resuelto: "Sí, resuelto",
    noResuelto: "No, necesito ayuda",
    cerrar: "Cerrar ticket (equipo)",
    videos: "Videos",
    companero: (rol) => `Un compañero te ayudará en breve. ${rol}`,
    gracias: "¡Genial! Me alegro de que se haya solucionado. Cierro el ticket en unos minutos.",
    soloEquipo: "Solo el equipo de soporte puede usar este botón.",
    soloDueno: "Solo quien abrió el ticket o el equipo pueden usar este botón.",
    cerrarModal: "Cerrar ticket",
    campoSolucion: "¿Cómo se resolvió?",
    cerrado: (m) => `Ticket cerrado. Este canal se borrará en ${m} minutos.`,
    errorIA: "Ahora mismo no puedo responder a eso.",
    sigue: "Si sigue sin funcionar, pulsa **No, necesito ayuda**.",
  },
  en: {
    panelTitulo: "USAGIVR Support",
    panelDesc:
      "Having trouble with your trackers? Press **Open ticket**, fill in the form and I'll help you right away.\n" +
      "If that doesn't fix it, a teammate will take over.",
    abrir: "Open ticket",
    modalTitulo: "USAGIVR support ticket",
    campoPedido: "Purchase / order number",
    campoNombre: "Customer name",
    campoProblema: "Describe the problem",
    campoProblemaPh: "E.g.: my new trackers won't connect to WiFi",
    yaTienes: (c) => `You already have an open ticket: ${c}`,
    creado: (c) => `Your ticket is open: ${c}`,
    bienvenida: (u) => `Hi ${u}, thanks for reaching out. This is what usually fixes it:`,
    sinTema: "Let me look into it…",
    pregunta: "Did that fix it?",
    resuelto: "Yes, solved",
    noResuelto: "No, I need help",
    cerrar: "Close ticket (staff)",
    videos: "Videos",
    companero: (rol) => `A teammate will help you shortly. ${rol}`,
    gracias: "Great! Glad it's fixed. I'll close this ticket in a few minutes.",
    soloEquipo: "Only the support team can use this button.",
    soloDueno: "Only the ticket owner or the team can use this button.",
    cerrarModal: "Close ticket",
    campoSolucion: "How was it solved?",
    cerrado: (m) => `Ticket closed. This channel will be deleted in ${m} minutes.`,
    errorIA: "I can't answer that right now.",
    sigue: "If it still doesn't work, press **No, I need help**.",
  },
};

module.exports = { T };
