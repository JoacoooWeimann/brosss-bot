// =============================================================
//  CONSEJOS SEMANALES (#tips)
//  Una vez por semana, a cada jugador de #vincular le busca su
//  punto más flojo en Leetify y le recomienda qué practicar.
//
//  Los objetivos son valores de "buen nivel" aproximados, no la
//  media oficial de Leetify: sirven para comparar áreas entre sí.
// =============================================================

import { fileURLToPath } from "node:url";
import { crearCliente } from "./discord.js";
import { registrosDesdeMensajes } from "./vincular.js";
import { evaluar, idDeCanal, crearPedir } from "./index.js";

const VERDE = 0x22e36b;
const POR_MENSAJE = 10; // un embed por jugador; Discord acepta hasta 10 por mensaje

const workshop = (busqueda) =>
  `https://steamcommunity.com/workshop/browse/?appid=730&searchtext=${encodeURIComponent(busqueda)}`;
const youtube = (busqueda) => `https://www.youtube.com/results?search_query=${encodeURIComponent(busqueda)}`;

// mayor: true → más es mejor; false → menos es mejor
export const AREAS = {
  aim: {
    titulo: "🎯 Puntería", objetivo: 60, mayor: true, formato: (v) => Math.round(v),
    consejo: "Antes de jugar, 15 minutos en Aim Botz: 100 kills con la AK quieto y 100 moviéndote.",
    practica: ["Aim Botz", workshop("aim botz")], video: youtube("cs2 aim training routine"),
  },
  hs: {
    titulo: "💀 Headshots", objetivo: 22, mayor: true, formato: (v) => `${Math.round(v)}%`,
    consejo: "Llevá la mira siempre a la altura de la cabeza, aunque no haya nadie. En Aim Botz, contá solo las kills a la cabeza.",
    practica: ["Aim Botz", workshop("aim botz")], video: youtube("cs2 crosshair placement guide"),
  },
  preaim: {
    titulo: "📐 Preaim", objetivo: 8, mayor: false, formato: (v) => `${v.toFixed(1)}°`,
    consejo: "Antes de asomarte, dejá la mira justo donde va a aparecer el enemigo. Recorré los mapas de prefire de tu mapa favorito.",
    practica: ["Prefire de Yprac", workshop("yprac prefire")], video: youtube("cs2 prefire preaim guide"),
  },
  reaccion: {
    titulo: "⚡ Tiempo de reacción", objetivo: 550, mayor: false, formato: (v) => `${Math.round(v)} ms`,
    consejo: "Entrená reflejos unos minutos antes de jugar y no juegues muy cansado: es lo que más sube este número.",
    practica: ["Reflex training", workshop("reflex training")], video: youtube("cs2 improve reaction time"),
  },
  spray: {
    titulo: "🔫 Control de spray", objetivo: 40, mayor: true, formato: (v) => `${Math.round(v)}%`,
    consejo: "Aprendé el patrón de la AK y la M4: primero contra la pared, después contra bots a distintas distancias.",
    practica: ["Recoil Master", workshop("recoil master")], video: youtube("cs2 ak47 spray control"),
  },
  counterstrafe: {
    titulo: "🦶 Counter-strafe", objetivo: 85, mayor: true, formato: (v) => `${Math.round(v)}%`,
    consejo: "Antes de disparar, frená tocando la tecla contraria (A → D). Si disparás moviéndote, la bala no va donde apuntás.",
    practica: ["Aim Botz", workshop("aim botz")], video: youtube("cs2 counter strafe guide"),
  },
  utilidad: {
    titulo: "💨 Utilidad", objetivo: 55, mayor: true, formato: (v) => Math.round(v),
    consejo: "Aprendé 2 smokes y 1 molotov por lado en el mapa que más jugás. Con eso ya ganás rondas.",
    practica: ["Yprac", workshop("yprac")], video: youtube("cs2 essential smokes"),
  },
  flashes: {
    titulo: "⚡ Flashes", objetivo: 0.5, mayor: true, formato: (v) => `${v.toFixed(2)} enemigos por flash`,
    consejo: "Tirá popflashes: que exploten apenas pasan la esquina, así el enemigo no llega a darse vuelta.",
    practica: ["Yprac", workshop("yprac")], video: youtube("cs2 popflash guide"),
  },
  flashAmigos: {
    titulo: "🙈 Flasheás a tu equipo", objetivo: 0.45, mayor: false, formato: (v) => `${v.toFixed(2)} amigos por flash`,
    consejo: "Avisá antes de tirar la flash (\"flash, flash\") y tirala por encima de tus compañeros, no por delante.",
    practica: ["Yprac", workshop("yprac")], video: youtube("cs2 how to flash for teammates"),
  },
  posicionamiento: {
    titulo: "🧭 Posicionamiento", objetivo: 60, mayor: true, formato: (v) => Math.round(v),
    consejo: "Después de cada duelo, cambiá de lugar. Evitá pelear solo y lejos de tu equipo.",
    practica: null, video: youtube("cs2 positioning guide"),
  },
  tradeos: {
    titulo: "🤝 Tradeos", objetivo: 45, mayor: true, formato: (v) => `${Math.round(v)}%`,
    consejo: "Jugá cerca de un compañero: si muere, tenés que poder matar al que lo mató en 2 o 3 segundos.",
    practica: null, video: youtube("cs2 trading teammates guide"),
  },
  utilidadSinUsar: {
    titulo: "🎒 Utilidad sin usar", objetivo: 250, mayor: false, formato: (v) => `$${Math.round(v)} por muerte`,
    consejo: "Te morís con granadas en el bolsillo. Si estás por pelear, tirá algo antes: una flash o una molotov valen más usadas.",
    practica: null, video: youtube("cs2 when to use utility"),
  },
};

// Qué tan lejos está del objetivo (positivo = le falta)
export function distancia(area, valor) {
  const { objetivo, mayor } = AREAS[area];
  return mayor ? (objetivo - valor) / objetivo : (valor - objetivo) / objetivo;
}

// El área con más distancia al objetivo. Si está bien en todo, la mejor.
export function puntoFlojo(areas) {
  const medidas = Object.keys(AREAS)
    .filter((a) => areas?.[a] !== null && areas?.[a] !== undefined)
    .map((a) => ({ area: a, valor: areas[a], distancia: distancia(a, areas[a]) }));
  if (!medidas.length) return null;
  const peor = medidas.reduce((a, b) => (b.distancia > a.distancia ? b : a));
  if (peor.distancia > 0) return { ...peor, bien: false };
  const mejor = medidas.reduce((a, b) => (b.distancia < a.distancia ? b : a));
  return { ...mejor, bien: true };
}

export function embedJugador(jugador) {
  const flojo = puntoFlojo(jugador.areas);
  if (!flojo) return null;
  const a = AREAS[flojo.area];
  const valor = a.formato(flojo.valor);

  if (flojo.bien) {
    return {
      color: VERDE,
      description: `👑 <@${jugador.usuarioId}> está arriba del objetivo en todo. Lo mejor: **${a.titulo.slice(2).trim()}** (${valor}). ¡Seguí así!`,
    };
  }
  const links = [a.practica && `🗺 [${a.practica[0]}](${a.practica[1]})`, `▶️ [Videos](${a.video})`].filter(Boolean).join(" · ");
  return {
    color: VERDE,
    description: [
      `<@${jugador.usuarioId}> · **${a.titulo}**`,
      `Tenés **${valor}** (objetivo: ${a.formato(a.objetivo)})`,
      a.consejo,
      links,
    ].join("\n"),
  };
}

export function armarMensajes(jugadores, { canalVincular } = {}) {
  const embeds = jugadores.map(embedJugador).filter(Boolean);
  const comoEntrar = canalVincular ? `\n-# ¿No aparecés? Pegá tu Steam en <#${canalVincular}>. Datos de Leetify.` : "";
  const mensajes = [];
  for (let i = 0; i < embeds.length; i += POR_MENSAJE) {
    mensajes.push({
      content: i === 0 ? `## 📚 Consejos de la semana\nUn área para practicar, según tus partidas.${comoEntrar}` : undefined,
      embeds: embeds.slice(i, i + POR_MENSAJE),
      // Menciona sin notificar: no queremos un ping por semana
      allowed_mentions: { parse: [] },
    });
  }
  return mensajes;
}

export async function ejecutarConsejos({ cliente, pedir, canalVincular, canalTips, claveLeetify }) {
  const registros = registrosDesdeMensajes(await cliente.mensajes(canalVincular));
  const jugadores = [];
  for (const r of registros) {
    const { estado, perfil } = await evaluar(r, { pedir, claveLeetify });
    if (estado === "ok") jugadores.push({ usuarioId: r.usuarioId, nombre: r.nombre, areas: perfil.areas });
  }
  const mensajes = armarMensajes(jugadores, { canalVincular });
  for (const m of mensajes) await cliente.enviar(canalTips, m);
  return { jugadores: jugadores.length, mensajes: mensajes.length };
}

// ---------- Arranque (`node src/consejos.js`) ----------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { DISCORD_TOKEN, LEETIFY_API_KEY } = process.env;
  const CANAL_VINCULAR = idDeCanal(process.env.CANAL_VINCULAR);
  const CANAL_TIPS = idDeCanal(process.env.CANAL_TIPS);
  const faltan = Object.entries({ DISCORD_TOKEN, CANAL_VINCULAR, CANAL_TIPS })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (faltan.length) {
    console.error(`Faltan variables: ${faltan.join(", ")}. Mirá el README.`);
    process.exit(1);
  }
  const resumen = await ejecutarConsejos({
    cliente: crearCliente(DISCORD_TOKEN),
    pedir: crearPedir(),
    canalVincular: CANAL_VINCULAR,
    canalTips: CANAL_TIPS,
    claveLeetify: LEETIFY_API_KEY,
  });
  console.log(`Listo: consejos para ${resumen.jugadores} jugadores en ${resumen.mensajes} mensajes.`);
}
