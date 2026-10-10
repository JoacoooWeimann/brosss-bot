// =============================================================
//  JUGADOR DE LA SEMANA
//  Guarda en datos/historial.json el Premier de cada jugador al
//  arrancar la semana (viernes 12 hs de Argentina, como los
//  consejos). Gana el que más subió desde ese momento.
//
//  El workflow commitea el archivo cuando cambia. De paso, esos
//  commits evitan que GitHub pause las tareas programadas.
// =============================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export const ARCHIVO = new URL("../datos/historial.json", import.meta.url);

const DIA = 24 * 60 * 60 * 1000;
const VIERNES = 5;
const HORA_UTC = 15; // 12 hs en Argentina

// Inicio de la semana actual: el último viernes 15:00 UTC
export function inicioSemana(ahora) {
  const d = new Date(ahora);
  const hoy = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), HORA_UTC);
  let inicio = hoy - ((d.getUTCDay() - VIERNES + 7) % 7) * DIA;
  if (inicio > ahora) inicio -= 7 * DIA;
  return new Date(inicio).toISOString();
}

// Quién más subió desde la base (solo cuenta si subió algo)
export function lider(base, jugadores) {
  let mejor = null;
  for (const j of jugadores) {
    const antes = base[j.steamId]?.premier;
    if (antes == null || j.premier == null) continue;
    const subio = j.premier - antes;
    if (subio > 0 && (!mejor || subio > mejor.subio)) mejor = { nombre: j.nombre, subio };
  }
  return mejor;
}

// Cuánto subió o bajó cada uno desde el viernes: { usuarioId: +322 }
export function cambios(base, jugadores) {
  const salida = {};
  for (const j of jugadores) {
    const antes = base[j.steamId]?.premier;
    if (antes != null && j.premier != null && j.premier !== antes) salida[j.usuarioId] = j.premier - antes;
  }
  return salida;
}

const foto = (j) => ({ premier: j.premier ?? null });

// Devuelve el historial nuevo. Si empezó otra semana, guarda al
// ganador de la anterior y arranca una base nueva con los valores
// de ahora. A los jugadores nuevos los suma a la base.
export function actualizar(historial, jugadores, ahora) {
  const semana = inicioSemana(ahora);
  if (!historial || historial.semana !== semana) {
    const anterior = historial ? lider(historial.base, jugadores) : null;
    return {
      semana,
      base: Object.fromEntries(jugadores.map((j) => [j.steamId, foto(j)])),
      anterior,
    };
  }
  const base = { ...historial.base };
  for (const j of jugadores) {
    // Si no tenía Premier y ahora sí, la base arranca desde acá
    if (!base[j.steamId] || (base[j.steamId].premier == null && j.premier != null)) base[j.steamId] = foto(j);
  }
  return { ...historial, base };
}

export async function leer(archivo = ARCHIVO) {
  try {
    return JSON.parse(await readFile(archivo, "utf8"));
  } catch {
    return null; // primera vez, o el archivo se rompió: arranca de cero
  }
}

// Escribe solo si cambió, así no hay commits vacíos
export async function guardar(historial, anterior, archivo = ARCHIVO) {
  const nuevo = JSON.stringify(historial, null, 2) + "\n";
  if (anterior && JSON.stringify(anterior, null, 2) + "\n" === nuevo) return false;
  await mkdir(dirname(archivo instanceof URL ? archivo.pathname : archivo), { recursive: true });
  await writeFile(archivo, nuevo);
  return true;
}
