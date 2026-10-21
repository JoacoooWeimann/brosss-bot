// =============================================================
//  STATS DE LOS VINCULADOS (datos/jugadores.json)
//  El comando /team corre en Netlify y tiene que responder en menos
//  de 3 segundos: no le da el tiempo para consultar Leetify. Por eso
//  la vuelta de 15 minutos deja acá las stats de cada vinculado, y el
//  comando solo lee este archivo (desde raw.githubusercontent.com).
// =============================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export const ARCHIVO = new URL("../datos/jugadores.json", import.meta.url);

// Por usuario de Discord: nombre, Premier y las stats de Leetify.
// Si Leetify no respondió para alguien que sigue vinculado, se conservan
// sus datos anteriores (así no desaparece del /team por una vuelta mala).
export function armarDatos(jugadores, { previo = null, registrados = [] } = {}) {
  const porUsuario = {};
  for (const j of jugadores) {
    const anterior = previo?.jugadores?.[j.usuarioId];
    porUsuario[j.usuarioId] = {
      nombre: j.nombre,
      premier: j.premier ?? null,
      winrate: j.winrate ?? null,
      partidas: j.partidas ?? null,
      faceit: j.faceit ?? null,
      avatar: j.avatar ?? null,
      steamId: j.steamId ?? null,
      areas: j.areas ?? {},
      // Si esta vuelta no se pudieron traer sus partidas, quedan las de antes
      recientes: j.recientes?.length ? j.recientes : (anterior?.recientes ?? []),
      logros: j.logros ?? anterior?.logros ?? [],
    };
  }
  for (const id of registrados) {
    if (!porUsuario[id] && previo?.jugadores?.[id]) porUsuario[id] = previo.jugadores[id];
  }
  const ordenado = Object.fromEntries(Object.entries(porUsuario).sort(([a], [b]) => a.localeCompare(b)));
  return { jugadores: ordenado };
}

export async function leer(archivo = ARCHIVO) {
  try {
    return JSON.parse(await readFile(archivo, "utf8"));
  } catch {
    return null;
  }
}

// Escribe solo si cambió (las stats cambian cuando juegan, no cada vuelta)
export async function guardar(datos, archivo = ARCHIVO) {
  const nuevo = JSON.stringify(datos, null, 2) + "\n";
  try {
    if ((await readFile(archivo, "utf8")) === nuevo) return false;
  } catch {}
  await mkdir(dirname(archivo instanceof URL ? archivo.pathname : archivo), { recursive: true });
  await writeFile(archivo, nuevo);
  return true;
}
