// =============================================================
//  ÁREAS PARA PRACTICAR: objetivos, consejos y links
//  Lo usan los consejos de los viernes (src/consejos.js) y el comando
//  /tips (src/tips.js). Sin dependencias, así lo puede usar el Worker.
//
//  Los objetivos son valores de "buen nivel" aproximados, no la
//  media oficial de Leetify: sirven para comparar áreas entre sí.
// =============================================================

export const workshop = (busqueda) =>
  `https://steamcommunity.com/workshop/browse/?appid=730&searchtext=${encodeURIComponent(busqueda)}`;
export const youtube = (busqueda) => `https://www.youtube.com/results?search_query=${encodeURIComponent(busqueda)}`;

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

