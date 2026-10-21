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

export { jugadasDestacadas, embedDestacadas, LOGROS, actualizarLogros, embedLogro, textoLogros } from "./logros-def.js";

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
