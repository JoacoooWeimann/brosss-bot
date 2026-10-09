// =============================================================
//  TIKTOK → #CLIPS
//  TikTok no tiene API pública para listar videos, pero la página
//  de "embed de creador" (/embed/@usuario) trae los últimos en un
//  JSON. Si TikTok la cambia o la bloquea, esto deja de publicar
//  (no rompe el resto del bot) y avisa en el log.
//
//  No guarda estado: para no repetir, mira qué links ya publicó
//  el bot en el canal.
// =============================================================

const NAVEGADOR =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const VENTANA_MS = 3 * 24 * 60 * 60 * 1000; // solo videos de los últimos 3 días

export const urlVideo = (usuario, id) => `https://www.tiktok.com/@${usuario}/video/${id}`;

// Los IDs de TikTok llevan la fecha adentro: los primeros 32 bits son
// los segundos desde 1970
export const fechaDeId = (id) => Number(BigInt(id) >> 32n) * 1000;

// Busca "videoList" en cualquier parte del JSON
function buscarLista(objeto) {
  if (!objeto || typeof objeto !== "object") return null;
  if (Array.isArray(objeto.videoList)) return objeto.videoList;
  for (const valor of Object.values(objeto)) {
    const lista = buscarLista(valor);
    if (lista) return lista;
  }
  return null;
}

// Saca hashtags, links y espacios de más de la descripción
export function limpiarTitulo(desc) {
  const t = String(desc ?? "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/#\S+/g, "")
    .replace(/\s+/g, " ")
    .replace(/[\s.·-]+$/, "")
    .trim();
  return t.length > 100 ? t.slice(0, 99) + "…" : t;
}

export function leerVideos(html) {
  const m = /<script id="__FRONTITY_CONNECT_STATE__"[^>]*>([\s\S]*?)<\/script>/.exec(String(html));
  if (!m) return null; // TikTok cambió la página
  let estado;
  try {
    estado = JSON.parse(m[1]);
  } catch {
    return null;
  }
  const lista = buscarLista(estado);
  if (!lista) return null;
  return lista
    .filter((v) => /^\d{15,20}$/.test(String(v.id)) && !v.privateItem)
    .map((v) => ({
      id: String(v.id),
      titulo: limpiarTitulo(v.desc),
      fecha: fechaDeId(v.id),
      vistas: Number.isFinite(v.playCount) ? v.playCount : null,
    }));
}

// TikTok corta a veces los pedidos automáticos (503 o 429). Se reintenta
// un par de veces; si igual falla, se prueba en la próxima vuelta: con la
// ventana de 3 días alcanza con que pase una vez.
export async function consultarTiktok(usuario, pedir, { intentos = 3, espera = 3000 } = {}) {
  let ultimo = 0;
  for (let i = 0; i < intentos; i++) {
    if (i) await new Promise((r) => setTimeout(r, espera * i));
    const res = await pedir(`https://www.tiktok.com/embed/@${encodeURIComponent(usuario)}?lang=es`, {
      "User-Agent": NAVEGADOR,
      "Accept-Language": "es-AR,es;q=0.9",
      Referer: "https://brosssdiscord.netlify.app/",
    });
    ultimo = res.status;
    if (res.status === 429 || res.status >= 500) continue;
    if (!res.ok) break;
    const videos = leerVideos(await res.text());
    if (!videos) throw new Error("TikTok cambió la página de embed: no encontré la lista de videos");
    return videos;
  }
  throw new Error(`TikTok respondió ${ultimo}`);
}

// Los videos para publicar: recientes, no publicados, del más viejo al más nuevo
export function videosNuevos(videos, { ahora, publicados }) {
  return videos
    .filter((v) => ahora - v.fecha <= VENTANA_MS && ![...publicados].some((texto) => texto.includes(v.id)))
    .sort((a, b) => a.fecha - b.fecha);
}

// Solo el link en el texto: Discord arma solo el reproductor de TikTok
export function mensajeVideo(usuario, video) {
  return {
    content: `🎬 **Clip nuevo**${video.titulo ? ` · ${video.titulo}` : ""}\n${urlVideo(usuario, video.id)}`,
    allowed_mentions: { parse: [] },
  };
}
