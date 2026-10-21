// =============================================================
//  JUGADAS DESTACADAS Y LOGROS (#historial)
//
//  Jugadas destacadas: en cada partida publicada, si alguien hizo un
//  ACE, un 4K, 30+ kills o ganó 13-0, va una tarjeta con eso en el
//  mismo mensaje de la partida. Se repiten cada vez que pasa.
//
//  Logros: medallas que se ganan UNA sola vez (primer ACE, 100
//  partidas, llegar a 20K de Premier...). Se anuncian en #historial y
//  se ven en /stats. Se guardan en datos/logros.json.
//  La primera vez que el bot ve a alguien, le anota en silencio los
//  logros que ya tenía (así no llena el canal con cosas viejas).
// =============================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export const ARCHIVO = new URL("../datos/logros.json", import.meta.url);

// ---------- Jugadas destacadas (por partida) ----------

export function jugadasDestacadas(partida) {
  const lineas = [];
  for (const { nombre, stats: s } of partida.jugadores) {
    if (s.multi5k) lineas.push(`💥 **¡ACE de ${nombre}!**${s.multi5k > 1 ? ` (×${s.multi5k})` : ""}`);
    if (s.multi4k) lineas.push(`🔥 **${nombre}** hizo ${s.multi4k > 1 ? `${s.multi4k} veces 4K` : "un 4K"}`);
    if ((s.total_kills ?? 0) >= 30) lineas.push(`🎯 **${nombre}** la rompió con **${s.total_kills} kills**`);
  }
  const s = partida.jugadores[0]?.stats;
  if (s && s.rounds_won === 13 && s.rounds_lost === 0) lineas.push("🧹 **¡Barrida 13-0!**");
  return lineas;
}

export function embedDestacadas(partida) {
  const lineas = jugadasDestacadas(partida);
  return lineas.length ? { title: "⚡ Jugadas destacadas", description: lineas.join("\n"), color: 0xffd54a } : null;
}

// ---------- Logros (una sola vez) ----------

// tipo "partida": se ganan con una partida nueva; "perfil": con el estado actual
export const LOGROS = {
  ace: { emoji: "💥", nombre: "Primer ACE", detalle: "5 kills en una ronda", tipo: "partida", cumple: (s) => s.multi5k > 0 },
  kills30: { emoji: "🎯", nombre: "Treintena", detalle: "30 kills en una partida", tipo: "partida", cumple: (s) => (s.total_kills ?? 0) >= 30 },
  barrida: { emoji: "🧹", nombre: "Barrida", detalle: "ganar una partida 13-0", tipo: "partida", cumple: (s) => s.rounds_won === 13 && s.rounds_lost === 0 },
  partidaza: { emoji: "⭐", nombre: "Partidaza", detalle: "rating de Leetify de +10 o más", tipo: "partida", cumple: (s) => (s.leetify_rating ?? 0) >= 0.1 },
  partidas100: { emoji: "🎮", nombre: "100 partidas", detalle: "100 partidas jugadas", tipo: "perfil", cumple: (j) => (j.partidas ?? 0) >= 100 },
  partidas500: { emoji: "🕹️", nombre: "500 partidas", detalle: "500 partidas jugadas", tipo: "perfil", cumple: (j) => (j.partidas ?? 0) >= 500 },
  partidas1000: { emoji: "👴", nombre: "1000 partidas", detalle: "1000 partidas jugadas", tipo: "perfil", cumple: (j) => (j.partidas ?? 0) >= 1000 },
  premier10k: { emoji: "🔵", nombre: "10K de Premier", detalle: "llegar a 10.000", tipo: "perfil", cumple: (j) => (j.premier ?? 0) >= 10000 },
  premier15k: { emoji: "🟣", nombre: "15K de Premier", detalle: "llegar a 15.000", tipo: "perfil", cumple: (j) => (j.premier ?? 0) >= 15000 },
  premier20k: { emoji: "🩷", nombre: "20K de Premier", detalle: "llegar a 20.000", tipo: "perfil", cumple: (j) => (j.premier ?? 0) >= 20000 },
  premier25k: { emoji: "🔴", nombre: "25K de Premier", detalle: "llegar a 25.000", tipo: "perfil", cumple: (j) => (j.premier ?? 0) >= 25000 },
  premier30k: { emoji: "🟡", nombre: "30K de Premier", detalle: "llegar a 30.000", tipo: "perfil", cumple: (j) => (j.premier ?? 0) >= 30000 },
  faceit10: { emoji: "🟥", nombre: "FACEIT 10", detalle: "llegar al nivel 10 de FACEIT", tipo: "perfil", cumple: (j) => j.faceit === 10 },
};

const deTipo = (tipo) => Object.entries(LOGROS).filter(([, l]) => l.tipo === tipo);

// jugadores: los del ranking ({ usuarioId, partidas, premier, faceit, ... })
// partidas: las que se acaban de publicar (con jugadores[].stats y usuarioId)
// Devuelve el registro nuevo y los logros a anunciar: [{ usuarioId, nombre, avatar, codigo }]
export function actualizarLogros(registro, jugadores, partidas = []) {
  const nuevoRegistro = { ...(registro ?? {}) };
  const anunciar = [];
  const primeraVez = !registro; // el archivo no existía: se anota todo en silencio

  for (const j of jugadores) {
    const conocido = Boolean(nuevoRegistro[j.usuarioId]);
    const tiene = new Set(nuevoRegistro[j.usuarioId] ?? []);
    for (const [codigo, l] of deTipo("perfil")) {
      if (tiene.has(codigo) || !l.cumple(j)) continue;
      tiene.add(codigo);
      if (!primeraVez && conocido) anunciar.push({ usuarioId: j.usuarioId, nombre: j.nombre, avatar: j.avatar, codigo });
    }
    nuevoRegistro[j.usuarioId] = [...tiene].sort();
  }

  for (const p of partidas) {
    for (const { usuarioId, nombre, avatar, stats } of p.jugadores) {
      if (!usuarioId) continue;
      const tiene = new Set(nuevoRegistro[usuarioId] ?? []);
      for (const [codigo, l] of deTipo("partida")) {
        if (tiene.has(codigo) || !l.cumple(stats)) continue;
        tiene.add(codigo);
        anunciar.push({ usuarioId, nombre, avatar, codigo, mapa: p.mapa });
      }
      nuevoRegistro[usuarioId] = [...tiene].sort();
    }
  }
  return { registro: nuevoRegistro, anunciar };
}

export function embedLogro({ usuarioId, nombre, avatar, codigo }) {
  const l = LOGROS[codigo];
  return {
    author: { name: "🏅 LOGRO DESBLOQUEADO" },
    title: `${l.emoji} ${l.nombre}`,
    description: `<@${usuarioId}> · **${nombre}**\n*${l.detalle[0].toUpperCase()}${l.detalle.slice(1)}.*`,
    color: 0xffd54a,
    thumbnail: avatar ? { url: avatar } : undefined,
  };
}

// Para /stats: los logros de alguien, en emojis
export const textoLogros = (codigos = []) =>
  codigos.filter((c) => LOGROS[c]).map((c) => `${LOGROS[c].emoji} ${LOGROS[c].nombre}`).join("\n");

export async function leer(archivo = ARCHIVO) {
  try {
    return JSON.parse(await readFile(archivo, "utf8"));
  } catch {
    return null;
  }
}

export async function guardar(registro, anterior, archivo = ARCHIVO) {
  const nuevo = JSON.stringify(registro, null, 2) + "\n";
  if (anterior && JSON.stringify(anterior, null, 2) + "\n" === nuevo) return false;
  await mkdir(dirname(archivo instanceof URL ? archivo.pathname : archivo), { recursive: true });
  await writeFile(archivo, nuevo);
  return true;
}
