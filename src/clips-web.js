// =============================================================
//  CLIPS PARA LA PÁGINA WEB
//  La página (brosssdiscord.netlify.app) lee datos/clips.json de
//  este repo, que es público, para mostrar los clips de la cuenta de
//  TikTok sin tener que volver a publicarla.
//
//  Usa los videos que ya trae tiktok.js y guarda la portada de cada
//  uno en datos/portadas/{id}.webp: los links de imagen de TikTok
//  vencen en unas horas, así que hay que bajarla cuando aparece.
//
//  Escribe solo si hay algo nuevo (un clip o una portada). Las vistas
//  no se guardan a propósito: cambian todo el tiempo y harían un
//  commit cada 15 minutos.
// =============================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

export const ARCHIVO = new URL("../datos/clips.json", import.meta.url);
export const PORTADAS = new URL("../datos/portadas/", import.meta.url);
const MAXIMO = 30; // clips que se guardan, de los más nuevos

// Junta los clips que ya había con los que trae TikTok. Los viejos no
// se borran cuando salen de la lista (la página de embed trae solo los
// últimos). Más nuevos primero.
export function juntarClips(anterior, videos, usuario) {
  const porId = new Map((anterior?.usuario === usuario ? anterior.clips : []).map((c) => [c.id, { ...c }]));
  for (const v of videos) {
    const clip = porId.get(v.id) ?? { id: v.id, fecha: v.fecha, portada: false };
    clip.titulo = v.titulo;
    porId.set(v.id, clip);
  }
  const clips = [...porId.values()].sort((a, b) => b.fecha - a.fecha).slice(0, MAXIMO);
  return { usuario, clips };
}

// Baja la portada, la recorta en vertical (9:16) y la guarda en WebP
async function guardarPortada(url, destino, pedir) {
  const res = await pedir(url, { "User-Agent": "Mozilla/5.0" });
  if (!res.ok) throw new Error(`la portada respondió ${res.status}`);
  const imagen = Buffer.from(await res.arrayBuffer());
  await sharp(imagen).resize(480, 854, { fit: "cover" }).webp({ quality: 78 }).toFile(destino);
}

export async function actualizarClipsWeb({ videos, usuario, pedir, archivo = ARCHIVO, carpeta = PORTADAS }) {
  if (!videos) return { cambio: false, portadas: 0 };

  let anterior = null;
  try {
    anterior = JSON.parse(await readFile(archivo, "utf8"));
  } catch {
    // primera vez, o el archivo se rompió: arranca de cero
  }
  const datos = juntarClips(anterior, videos, usuario);

  // Portadas que faltan (si una falla, se reintenta en la próxima vuelta)
  let portadas = 0;
  await mkdir(carpeta, { recursive: true });
  for (const clip of datos.clips.filter((c) => !c.portada)) {
    const url = videos.find((v) => v.id === clip.id)?.portadaUrl;
    if (!url) continue;
    try {
      // sharp necesita una ruta, no una URL de archivo
      await guardarPortada(url, fileURLToPath(new URL(`${clip.id}.webp`, carpeta)), pedir);
      clip.portada = true;
      portadas++;
    } catch (error) {
      console.warn(`Clips web: portada de ${clip.id}: ${error.message}`);
    }
  }

  const nuevo = JSON.stringify(datos, null, 2) + "\n";
  if (anterior && JSON.stringify(anterior, null, 2) + "\n" === nuevo) return { cambio: false, portadas };
  await writeFile(archivo, nuevo);
  return { cambio: true, portadas };
}
