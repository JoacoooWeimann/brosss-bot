// =============================================================
//  /team y /formacion
//  Con los jugadores que se le pasan (o los de tu canal de voz),
//  reparte los roles de CS2 (AWPer, Entry, Support, Lurker, IGL)
//  según sus stats de Leetify.
//
//  Las stats se comparan entre los jugadores elegidos (no contra un
//  valor fijo): importa quién es mejor en cada cosa dentro del grupo.
//  Prueba todas las combinaciones y las ordena de mejor a peor equipo:
//  la primera es la que se muestra, y "Mezclar" pasa a la siguiente.
// =============================================================

// [stat, peso, menos es mejor]
export const ROLES = {
  awp: {
    nombre: "AWPer", emoji: "🎯", color: 0xff4d4d,
    stats: [["aim", 0.45], ["precision", 0.35], ["preaim", 0.2, true]],
    comentario: ["Si la AWP está en sus manos, no se asoma nadie.", "Le toca la AWP: pocas balas, todas a la cabeza.", "Va a tener que ganarse la AWP, pero es el mejor candidato."],
    compra: "AWP + chaleco y casco. Si no alcanza, Scout y guardá para la próxima.",
  },
  entry: {
    nombre: "Entry", emoji: "💥", color: 0xff9f43,
    stats: [["entradaT", 0.4], ["apertura", 0.35], ["reaccion", 0.25, true]],
    comentario: ["Primero en entrar y primero en sacar kills: abre las rondas.", "Entra adelante con la flash de un compañero y abre espacio.", "Le toca abrir: que entre con flash y no se apure."],
    compra: "Rifle + chaleco y casco + 2 flashes. Entra con la flash de un compañero.",
  },
  support: {
    nombre: "Support", emoji: "🛡️", color: 0x5c9dff,
    stats: [["utilidad", 0.4], ["flashes", 0.3], ["tradeKills", 0.2], ["utilidadSinUsar", 0.1, true]],
    comentario: ["El que gana las rondas sin que nadie se dé cuenta: smokes, flashes y tradeos.", "Granadas para todo el equipo y siempre listo para el tradeo.", "A ponerle onda a la utilidad: cada flash cuenta."],
    compra: "Rifle + smoke, molotov y 2 flashes. Es el que más utilidad compra.",
  },
  lurker: {
    nombre: "Lurker", emoji: "🥷", color: 0xa66bff,
    stats: [["clutch", 0.5], ["posicionamiento", 0.5]],
    comentario: ["Solo por el otro lado del mapa, esperando el momento justo.", "Corta rotaciones y gana los clutchs que nadie más gana.", "Paciencia y buena posición: que no lo encuentren."],
    compra: "Rifle + 1 flash. En eco guarda el arma: es el que más seguido sobrevive.",
  },
  igl: {
    nombre: "IGL", emoji: "🧠", color: 0xffd54a,
    stats: [["posicionamiento", 0.3], ["utilidad", 0.25], ["winrate", 0.25], ["partidas", 0.2]],
    comentario: ["El cerebro del equipo: lee la partida y canta las jugadas.", "La experiencia manda: que él decida a dónde va el equipo.", "Le toca pensar por los cinco: estrategias simples y claras."],
    compra: "Rifle + smoke y molotov para ejecutar las jugadas o hacer fakes.",
  },
};

const r = Math.round;
// Cada stat: nombre corto y cómo se muestra el valor
const STATS = {
  aim: ["Aim", (v) => `${r(v)}`],
  precision: ["Precisión", (v) => `${r(v)}%`],
  preaim: ["Preaim", (v) => `${v.toFixed(1)}°`],
  entradaT: ["Entradas como T", (v) => `${r(v)}%`],
  apertura: ["Rating de apertura", (v) => `${(v * 100).toFixed(1)}`],
  reaccion: ["Reacción", (v) => `${r(v)} ms`],
  utilidad: ["Utilidad", (v) => `${r(v)}`],
  flashes: ["Enemigos por flash", (v) => v.toFixed(2)],
  tradeKills: ["Tradeos", (v) => `${r(v)}%`],
  utilidadSinUsar: ["Utilidad sin usar", (v) => `$${r(v)}`],
  clutch: ["Rating de clutch", (v) => `${(v * 100).toFixed(1)}`],
  posicionamiento: ["Posicionamiento", (v) => `${r(v)}`],
  winrate: ["Winrate", (v) => `${r(v * 100)}%`],
  partidas: ["Partidas", (v) => `${v}`],
};

const statsDe = (datos) => ({ ...(datos?.areas ?? {}), winrate: datos?.winrate ?? null, partidas: datos?.partidas ?? null });
const miles = (n) => Number(n).toLocaleString("es-AR");

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

// Qué tan bien encaja en el rol, de 0 a 100 (50 = como el promedio del grupo)
export const encaje = (puntaje) => r(100 / (1 + Math.exp(-1.6 * puntaje)));

// ▰▰▰▰▱ con el color según qué tan bien encaja
export function barra(porcentaje, largo = 10) {
  const llenos = Math.max(0, Math.min(largo, r((porcentaje / 100) * largo)));
  const color = porcentaje >= 70 ? "🟩" : porcentaje >= 45 ? "🟨" : "🟥";
  return `${color.repeat(llenos)}${"⬛".repeat(largo - llenos)} **${porcentaje}%**`;
}

// Todas las formas de elegir n roles distintos, en orden
function permutaciones(lista, n) {
  if (n === 0) return [[]];
  return lista.flatMap((x, i) => permutaciones([...lista.slice(0, i), ...lista.slice(i + 1)], n - 1).map((p) => [x, ...p]));
}

// Las 3 stats del rol, ordenadas por lo que más aportaron
function statsDelRol(jugador, z, rol) {
  return ROLES[rol].stats
    .filter(([clave]) => typeof statsDe(jugador.datos)[clave] === "number")
    .map(([clave, peso, menos]) => ({ clave, aporte: peso * (menos ? -z[clave] : z[clave]), valor: statsDe(jugador.datos)[clave] }))
    .sort((a, b) => b.aporte - a.aporte);
}

export const MAX_VARIANTES = 5; // "Mezclar" recorre las 5 mejores formaciones

// jugadores: [{ usuarioId, nombre, datos | null }]
// variante: 0 = la mejor formación, 1 = la segunda, etc. (da la vuelta)
export function armarFormacion(jugadores, { variante = 0 } = {}) {
  const lista = jugadores.slice(0, 5);
  const conDatos = lista.filter((j) => j.datos);
  const sinDatos = lista.filter((j) => !j.datos);
  const z = puntajesRelativos(conDatos);
  const roles = Object.keys(ROLES);

  const opciones = permutaciones(roles, conDatos.length)
    .map((perm) => ({ perm, suma: perm.reduce((s, rol, i) => s + puntajeRol(z[i], rol), 0) }))
    .sort((a, b) => b.suma - a.suma);
  const cantidad = Math.min(MAX_VARIANTES, opciones.length);
  const indice = ((variante % cantidad) + cantidad) % cantidad;
  const elegida = opciones[indice].perm;

  const asignados = conDatos.map((j, i) => {
    const puntaje = puntajeRol(z[i], elegida[i]);
    const stats = statsDelRol(j, z[i], elegida[i]);
    return { jugador: j, rol: elegida[i], encaje: encaje(puntaje), stats, motivo: stats[0] ? `${STATS[stats[0].clave][0]} ${STATS[stats[0].clave][1](stats[0].valor)}` : null };
  });
  // Los que no tienen stats se llevan los roles que sobran
  const libres = roles.filter((rol) => !elegida.includes(rol));
  sinDatos.forEach((j, i) => asignados.push({ jugador: j, rol: libres[i] ?? null, encaje: null, stats: [], motivo: null }));
  asignados.sort((a, b) => roles.indexOf(a.rol) - roles.indexOf(b.rol));
  // Si el grupo es de 1 sin variantes posibles, "Mezclar" no tiene sentido
  return { asignados, variante: indice, cantidad: sinDatos.length && !conDatos.length ? 1 : cantidad };
}

// Colores del CS Rating de Premier (para el resumen del equipo)
export function colorPremier(p) {
  if (p == null) return 0x22e36b;
  if (p < 5000) return 0xb0c3d9;
  if (p < 10000) return 0x8cc6ff;
  if (p < 15000) return 0x6a7dff;
  if (p < 20000) return 0xc166ff;
  if (p < 25000) return 0xf03cff;
  if (p < 30000) return 0xeb4b4b;
  return 0xffd700;
}

const promedio = (valores) => {
  const v = valores.filter((x) => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

function tarjetaResumen(asignados, { origen }) {
  const datos = asignados.map((a) => a.jugador.datos).filter(Boolean);
  const premier = promedio(datos.map((d) => d.premier));
  const winrate = promedio(datos.map((d) => d.winrate));
  const aim = promedio(datos.map((d) => d.areas?.aim));
  const quimica = promedio(asignados.map((a) => a.encaje));
  const fields = [
    premier != null && { name: "📈 Premier promedio", value: `**${miles(r(premier))}**`, inline: true },
    winrate != null && { name: "🏆 Winrate promedio", value: `**${r(winrate * 100)}%**`, inline: true },
    aim != null && { name: "🎯 Aim promedio", value: `**${r(aim)}**`, inline: true },
    quimica != null && { name: "🧪 Química del equipo", value: barra(r(quimica)), inline: false },
  ].filter(Boolean);
  return {
    title: "🎯 FORMACIÓN PARA LA PARTIDA",
    description: `**${asignados.length} ${asignados.length === 1 ? "jugador" : "jugadores"}**${origen ? ` ${origen}` : ""} · roles según las stats de Leetify, comparados entre ellos`,
    color: colorPremier(premier),
    fields,
  };
}

function tarjetaJugador({ jugador, rol, encaje: enc, stats }, i) {
  const datosRol = ROLES[rol];
  if (!jugador.datos) {
    return {
      title: `${datosRol ? `${datosRol.emoji} ${datosRol.nombre}` : "❔ Sin rol"} · ${jugador.nombre}`,
      description: `<@${jugador.usuarioId}>\n*Sin stats de Leetify: se lleva un rol libre. Para que cuenten sus stats, que vincule su Steam en #vincular.*`,
      color: 0x5b6670,
    };
  }
  const d = jugador.datos;
  const comentario = datosRol.comentario[enc >= 70 ? 0 : enc >= 45 ? 1 : 2];
  const fields = [
    ...stats.slice(0, 3).map((s) => ({ name: STATS[s.clave][0], value: `**${STATS[s.clave][1](s.valor)}**`, inline: true })),
    d.premier != null && { name: "Premier", value: miles(d.premier), inline: true },
    d.faceit != null && { name: "FACEIT", value: `Nivel ${d.faceit}`, inline: true },
    // Si el winrate ya es una de las stats del rol (IGL), no se repite
    d.winrate != null && !stats.slice(0, 3).some((s) => s.clave === "winrate") && { name: "Winrate", value: `${r(d.winrate * 100)}%`, inline: true },
  ].filter(Boolean);
  return {
    title: `${datosRol.emoji} ${datosRol.nombre.toUpperCase()} · ${jugador.nombre}`,
    description: `<@${jugador.usuarioId}>\n*${comentario}*\n\n**Encaje en el rol**\n${barra(enc)}`,
    color: datosRol.color,
    thumbnail: d.avatar ? { url: d.avatar } : undefined,
    fields,
  };
}

function tarjetaCompra(asignados, { variante, cantidad }) {
  const lineas = asignados
    .filter((a) => ROLES[a.rol])
    .map((a) => `${ROLES[a.rol].emoji} **${a.jugador.nombre}** — ${ROLES[a.rol].compra}`);
  return {
    title: "💰 PLAN DE COMPRA",
    description: `${lineas.join("\n")}\n\n**Eco:** si el equipo no llega a $4.000 por cabeza, guardan todos y compran juntos la ronda siguiente.`,
    color: 0x22e36b,
    footer: { text: cantidad > 1 ? `Formación ${variante + 1} de ${cantidad} · tocá 🔀 Mezclar para ver otra` : "Formación única para este grupo" },
  };
}

// origen: texto extra en el resumen, por ejemplo "de 🔊 Partida 1"
export function mensajeFormacion({ asignados, variante, cantidad }, { origen = "" } = {}) {
  const componentes =
    cantidad > 1
      ? [{ type: 1, components: [{ type: 2, style: 2, label: "Mezclar", emoji: { name: "🔀" }, custom_id: `mezclar:${(variante + 1) % cantidad}` }] }]
      : [];
  return {
    embeds: [tarjetaResumen(asignados, { origen }), ...asignados.map(tarjetaJugador), tarjetaCompra(asignados, { variante, cantidad })],
    components: componentes,
    allowed_mentions: { parse: [] },
  };
}

// Para "Mezclar": los jugadores del mensaje anterior (las menciones de cada tarjeta)
export function jugadoresDelMensaje(mensaje) {
  return (mensaje?.embeds ?? [])
    .map((e) => {
      const id = /^<@!?([^>\s]+)>/.exec(e.description ?? "")?.[1];
      const nombre = String(e.title ?? "").split(" · ").slice(1).join(" · ");
      return id ? { usuarioId: id, nombre: nombre || "Jugador" } : null;
    })
    .filter(Boolean);
}
