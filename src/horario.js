// Horario del equipo (config.horario). Sirve para decirle al cliente cuando le contestan
// y para no contar como "sin respuesta" las horas en que el equipo no trabaja.
const CFG = require("../config.json");

const H = CFG.horario || { zona: "America/Mexico_City", dias: [1, 2, 3, 4, 5, 6], desde: 10, hasta: 20 };
const DIAS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function local(fecha) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: H.zona, weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(fecha).map((x) => [x.type, x.value]));
  return { dia: DIAS[p.weekday], hora: Number(p.hour) };
}
function enHorario(fecha = new Date()) {
  const { dia, hora } = local(fecha);
  return H.dias.includes(dia) && hora >= H.desde && hora < H.hasta;
}
// Primer momento (en ms) en que el equipo vuelve a estar. Si ya esta, es ahora.
function proximaApertura(fecha = new Date()) {
  if (enHorario(fecha)) return fecha.getTime();
  let t = Math.ceil(fecha.getTime() / 3600000) * 3600000; // horas en punto (las zonas de Mexico son de hora entera)
  for (let i = 0; i < 24 * 8; i++, t += 3600000) if (enHorario(new Date(t))) return t;
  return fecha.getTime();
}

module.exports = { enHorario, proximaApertura, HORARIO: H };
