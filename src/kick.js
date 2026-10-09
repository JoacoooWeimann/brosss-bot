// =============================================================
//  KICK
//  La lista de streamers sale de la página (js/config.js, la misma
//  que muestra la sección Stream) más los que se agreguen a mano en
//  la variable KICK_EXTRA. Así un cambio en la web llega solo.
// =============================================================

import vm from "node:vm";
import { execFile } from "node:child_process";

export const CONFIG_WEB = "https://brosssdiscord.netlify.app/js/config.js";
const NAVEGADOR =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export const urlCanal = (slug) => `https://kick.com/${slug}`;

// Acepta "ibrandou", "kick.com/ibrandou" o el link completo
export function slugDeKick(texto) {
  const s = String(texto ?? "").trim().replace(/^https?:\/\//i, "").replace(/^(www\.)?kick\.com\//i, "").split(/[/?#]/)[0];
  return /^[\w-]{2,30}$/.test(s) ? s.toLowerCase() : null;
}

// config.js es el archivo de nuestra propia página. Se ejecuta aislado
// (sin acceso a nada) y con tiempo límite, solo para leer CONFIG.
export function leerConfigWeb(codigo) {
  const sandbox = { module: { exports: {} } };
  vm.runInNewContext(String(codigo), sandbox, { timeout: 1000 });
  return sandbox.module.exports ?? {};
}

// Streamers de la página + los de KICK_EXTRA, sin repetir
export function juntarStreamers(deLaWeb = [], extra = "") {
  const lista = [];
  const vistos = new Set();
  const sumar = (nombre, texto) => {
    const slug = slugDeKick(texto);
    if (!slug || vistos.has(slug)) return;
    vistos.add(slug);
    lista.push({ nombre: nombre || null, slug });
  };
  for (const s of deLaWeb) sumar(s.nombre, s.kick);
  for (const texto of String(extra).split(",")) sumar(null, texto);
  return lista;
}

export async function cargarConfigWeb(pedir) {
  const res = await pedir(CONFIG_WEB);
  if (!res.ok) throw new Error(`La página respondió ${res.status}`);
  return leerConfigWeb(await res.text());
}

// Lo mismo que resumirCanalKick de la página
export function resumirCanal(datos) {
  const vivo = datos?.livestream;
  return {
    nombre: datos?.user?.username || datos?.slug || "",
    avatar: datos?.user?.profile_pic || "",
    enVivo: Boolean(vivo?.is_live),
    sesion: vivo?.id ? String(vivo.id) : null,
    titulo: vivo?.session_title || "",
    categoria: vivo?.categories?.[0]?.name || "",
    espectadores: vivo?.viewer_count ?? 0,
    miniatura: vivo?.thumbnail?.url || "",
    // Kick manda "2026-09-27 19:47:21" en hora UTC
    inicio: vivo?.start_time ? Date.parse(vivo.start_time.replace(" ", "T") + "Z") : null,
  };
}

// Cloudflare bloquea el fetch de Node en kick.com (aunque lleve
// encabezados de navegador) pero deja pasar a curl. Devuelve algo con
// la misma forma que una respuesta de fetch.
export function pedirConCurl(url, cabeceras = {}) {
  const args = ["-s", "--max-time", "8", "-w", "\n%{http_code}"];
  for (const [k, v] of Object.entries(cabeceras)) args.push("-H", `${k}: ${v}`);
  args.push(url);
  return new Promise((resolve, reject) => {
    execFile("curl", args, { maxBuffer: 5 * 1024 * 1024 }, (error, salida) => {
      if (error) return reject(new Error(`curl falló: ${error.message}`));
      const corte = salida.lastIndexOf("\n");
      const status = Number(salida.slice(corte + 1));
      const cuerpo = salida.slice(0, corte);
      resolve({ status, ok: status >= 200 && status < 300, text: async () => cuerpo, json: async () => JSON.parse(cuerpo) });
    });
  });
}

export async function consultarCanal(slug, pedir = pedirConCurl) {
  const res = await pedir(`https://kick.com/api/v2/channels/${slug}`, { "User-Agent": NAVEGADOR, Accept: "application/json" });
  if (!res.ok) throw new Error(`Kick respondió ${res.status} para ${slug}`);
  return resumirCanal(await res.json());
}

// "45 min", "2 h 5 min"
export function duracion(desde, hasta) {
  const minutos = Math.max(0, Math.floor((hasta - desde) / 60000));
  const horas = Math.floor(minutos / 60);
  return horas ? `${horas} h ${minutos % 60} min` : `${minutos} min`;
}
