// =============================================================
//  /team y /formacion
//  Con los jugadores que se le pasan, reparte los roles de CS2
//  (AWPer, Entry, Support, Lurker, IGL) según sus stats de Leetify.
//
//  Las stats se comparan entre los jugadores elegidos (no contra un
//  valor fijo): importa quién es mejor en cada cosa dentro del grupo.
//  Después prueba todas las combinaciones y se queda con la que da el
//  mejor equipo en total, así nadie queda repetido.
// =============================================================

// [stat, peso, menos es mejor]
export const ROLES = {
  awp: { nombre: "AWPer", emoji: "🎯", stats: [["aim", 0.45], ["precision", 0.35], ["preaim", 0.2, true]] },
  entry: { nombre: "Entry", emoji: "💥", stats: [["entradaT", 0.4], ["apertura", 0.35], ["reaccion", 0.25, true]] },
  support: {
    nombre: "Support",
    emoji: "🛡️",
    stats: [["utilidad", 0.4], ["flashes", 0.3], ["tradeKills", 0.2], ["utilidadSinUsar", 0.1, true]],
  },
  lurker: { nombre: "Lurker", emoji: "🥷", stats: [["clutch", 0.5], ["posicionamiento", 0.5]] },
  igl: { nombre: "IGL", emoji: "🧠", stats: [["posicionamiento", 0.3], ["utilidad", 0.25], ["winrate", 0.25], ["partidas", 0.2]] },
};

const r = Math.round;
// Cómo se muestra cada stat al explicar por qué le tocó ese rol
const TEXTO = {
  aim: (v) => `Aim ${r(v)}`,
  precision: (v) => `${r(v)}% de precisión`,
  preaim: (v) => `${v.toFixed(1)}° de preaim`,
  entradaT: (v) => `${r(v)}% de entradas ganadas como T`,
  apertura: (v) => `rating de apertura ${(v * 100).toFixed(1)}`,
  reaccion: (v) => `${r(v)} ms de reacción`,
  utilidad: (v) => `utilidad ${r(v)}`,
  flashes: (v) => `${v.toFixed(2)} enemigos ciegos por flash`,
  tradeKills: (v) => `${r(v)}% de tradeos`,
  utilidadSinUsar: (v) => `solo $${r(v)} de utilidad sin usar por muerte`,
  clutch: (v) => `rating de clutch ${(v * 100).toFixed(1)}`,
  posicionamiento: (v) => `posicionamiento ${r(v)}`,
  winrate: (v) => `${r(v * 100)}% de winrate`,
  partidas: (v) => `${v} partidas jugadas`,
};

const statsDe = (datos) => ({ ...(datos?.areas ?? {}), winrate: datos?.winrate ?? null, partidas: datos?.partidas ?? null });

// Para cada stat, qué tan arriba o abajo del promedio del grupo está cada
// uno (en desvíos). Sin dato o sin diferencias en el grupo: 0.
export function puntajesRelativos(jugadores) {
  const claves = new Set(Object.values(ROLES).flatMap((rol) => rol.stats.map(([k]) => k)));
  const z = jugadores.map(() => ({}));
  for (const k of claves) {
    const valores = jugadores.map((j) => statsDe(j.datos)[k]).filter((v) => typeof v === "number");
    const media = valores.reduce((a, b) => a + b, 0) / (valores.length || 1);
    const desvio = Math.sqrt(valores.reduce((a, v) => a + (v - media) ** 2, 0) / (valores.length || 1));
    jugadores.forEach((j, i) => {
      const v = statsDe(j.datos)[k];
      z[i][k] = typeof v === "number" && desvio > 0 ? (v - media) / desvio : 0;
    });
  }
  return z;
}

export function puntajeRol(z, rol) {
  return ROLES[rol].stats.reduce((suma, [k, peso, menos]) => suma + peso * (menos ? -z[k] : z[k]), 0);
}

// Todas las formas de elegir n roles distintos, en orden
function permutaciones(lista, n) {
  if (n === 0) return [[]];
  return lista.flatMap((x, i) => permutaciones([...lista.slice(0, i), ...lista.slice(i + 1)], n - 1).map((p) => [x, ...p]));
}

// La stat que más aportó a ese rol (su puntaje por su peso)
function porQue(jugador, z, rol) {
  const [k] = ROLES[rol].stats
    .filter(([clave]) => typeof statsDe(jugador.datos)[clave] === "number")
    .map(([clave, peso, menos]) => [clave, peso * (menos ? -z[clave] : z[clave])])
    .sort((a, b) => b[1] - a[1])[0] ?? [];
  return k ? TEXTO[k](statsDe(jugador.datos)[k]) : null;
}

// jugadores: [{ usuarioId, nombre, datos | null }]
// Devuelve [{ jugador, rol, motivo }] en el orden de los roles
export function armarFormacion(jugadores) {
  const lista = jugadores.slice(0, 5);
  const conDatos = lista.filter((j) => j.datos);
  const sinDatos = lista.filter((j) => !j.datos);
  const z = puntajesRelativos(conDatos);
  const roles = Object.keys(ROLES);

  let mejor = { suma: -Infinity, asignacion: [] };
  for (const perm of permutaciones(roles, conDatos.length)) {
    const suma = perm.reduce((s, rol, i) => s + puntajeRol(z[i], rol), 0);
    if (suma > mejor.suma) mejor = { suma, asignacion: perm };
  }

  const resultado = conDatos.map((j, i) => ({ jugador: j, rol: mejor.asignacion[i], motivo: porQue(j, z[i], mejor.asignacion[i]) }));
  // Los que no tienen stats se llevan los roles que sobran
  const libres = roles.filter((rol) => !mejor.asignacion.includes(rol));
  sinDatos.forEach((j, i) => resultado.push({ jugador: j, rol: libres[i] ?? null, motivo: null }));
  return resultado.sort((a, b) => roles.indexOf(a.rol) - roles.indexOf(b.rol));
}

export function mensajeFormacion(formacion, { canalVincular } = {}) {
  const lineas = formacion.map(({ jugador, rol, motivo }) => {
    const r = ROLES[rol];
    const etiqueta = r ? `${r.emoji} **${r.nombre}**` : "❔ **Sin rol**";
    const detalle = motivo ?? (jugador.datos ? "" : "sin stats de Leetify");
    return `${etiqueta} · <@${jugador.usuarioId}>${detalle ? ` — ${detalle}` : ""}`;
  });
  const faltan = formacion.filter((f) => !f.jugador.datos);
  const aviso = faltan.length
    ? `\n\n-# ${faltan.map((f) => `<@${f.jugador.usuarioId}>`).join(", ")}: para que cuenten tus stats, vinculá tu Steam en ${canalVincular ? `<#${canalVincular}>` : "#vincular"}.`
    : "";
  return {
    embeds: [
      {
        title: "🎯 Formación para la partida",
        description: lineas.join("\n") + aviso,
        color: 0x22e36b,
        footer: { text: "Según las stats de Leetify de cada uno, comparados entre ellos" },
      },
    ],
    allowed_mentions: { parse: [] },
  };
}
