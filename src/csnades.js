// =============================================================
//  LINEUPS DE CSNADES (datos/lineups.json)
//  csnades.gg tiene los lineups de cada mapa con video. La página trae
//  la lista adentro (nombre, desde dónde se tira, a dónde cae, lado,
//  técnica y si es para principiantes). Una vez por día el bot la baja
//  para los 9 mapas y 3 tipos, y /smoke la lee desde acá: así responde
//  rápido aunque csnades tarde o no responda.
// =============================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { MAPAS, TIPOS } from "./lineups.js";

export const ARCHIVO = new URL("../datos/lineups.json", import.meta.url);
const NAVEGADOR = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const campo = (texto, clave) => new RegExp(`"${clave}":"([^"]*)"`).exec(texto)?.[1] ?? null;

// Los lineups de la página de un mapa y tipo
export function leerLineups(html) {
  const texto = String(html).replace(/\\"/g, '"');
  return texto
    .split('{"id":"nade_')
    .slice(1)
    .map((parte) => {
      // Cada lineup termina donde empieza el siguiente; los datos que importan están al principio
      const p = parte.slice(0, 4000);
      return {
        slug: campo(p, "slug"),
        lado: campo(p, "team"),
        desde: campo(p, "titleFrom"),
        hacia: campo(p, "titleTo"),
        tecnica: campo(p, "technique"),
        movimiento: campo(p, "movement"),
        principiante: /"beginner":true/.test(p),
      };
    })
    .filter((l) => l.slug && /^[\w-]+$/.test(l.slug) && l.hacia && l.desde);
}

export async function consultarLineups(mapa, tipo, pedir) {
  const res = await pedir(`https://csnades.gg/${mapa}/${tipo}`, { "User-Agent": NAVEGADOR });
  if (!res.ok) throw new Error(`csnades respondió ${res.status} (${mapa}/${tipo})`);
  return leerLineups(await res.text());
}

const hoy = (ahora) => new Date(ahora).toISOString().slice(0, 10);

// Baja todo si el archivo es de otro día. Si un mapa falla, conserva lo anterior.
export async function actualizarLineups(previo, pedir, ahora = Date.now()) {
  if (previo?.dia === hoy(ahora)) return null;
  const mapas = {};
  for (const [, mapa] of MAPAS) {
    mapas[mapa] = {};
    for (const tipo of Object.keys(TIPOS)) {
      try {
        mapas[mapa][tipo] = await consultarLineups(mapa, tipo, pedir);
      } catch (error) {
        console.warn(`Lineups: ${error.message}`);
        mapas[mapa][tipo] = previo?.mapas?.[mapa]?.[tipo] ?? [];
      }
    }
  }
  return { dia: hoy(ahora), mapas };
}

export async function leer(archivo = ARCHIVO) {
  try {
    return JSON.parse(await readFile(archivo, "utf8"));
  } catch {
    return null;
  }
}

export async function guardar(datos, archivo = ARCHIVO) {
  await mkdir(dirname(archivo instanceof URL ? archivo.pathname : archivo), { recursive: true });
  await writeFile(archivo, JSON.stringify(datos) + "\n");
}
