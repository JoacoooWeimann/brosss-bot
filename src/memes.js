// =============================================================
//  MEMES DE REDDIT → #MEMES
//  Reddit bloquea los pedidos de bots, así que se usa meme-api.com,
//  que devuelve los posts de imagen de un subreddit. Publica uno
//  cada tanto (MEMES_CADA_MINUTOS, por defecto 6 horas) entre las
//  10 y las 2 de Argentina, con votos suficientes, sin NSFW ni
//  spoilers y sin repetir.
// =============================================================

const API = "https://meme-api.com/gimme";
export const CADA_MS = 6 * 60 * 60 * 1000;
// Las vueltas no caen justo cada 15 minutos (a veces 14:50): un margen
// evita que se saltee una
const MARGEN_MS = 3 * 60 * 1000;
const VOTOS_MINIMOS = 30;
const MARCA = "📥 Meme del día"; // así reconoce los suyos (va en el pie del embed)
export const SUBREDDITS = ["MemesEnEspanol", "csgomemes"];

const fechaDeMensaje = (id) => Number((BigInt(id) >> 22n) + 1420070400000n);

// Hora de Argentina (UTC-3, sin horario de verano)
const horaArgentina = (ahora) => (new Date(ahora).getUTCHours() + 21) % 24;

// Los memes que ya publicó el bot: links de Reddit y fecha del último
export function publicadosAntes(mensajes, botId) {
  const propios = mensajes.filter(
    (m) => m.author?.id === botId && m.embeds?.some((e) => e.footer?.text?.startsWith(MARCA))
  );
  return {
    links: new Set(propios.flatMap((m) => m.embeds.map((e) => e.url).filter(Boolean))),
    ultimo: propios.reduce((max, m) => Math.max(max, fechaDeMensaje(m.id)), 0),
  };
}

export function tocaPublicar({ ultimo, ahora, cada = CADA_MS }) {
  const hora = horaArgentina(ahora);
  const despierto = hora >= 10 || hora < 2; // de noche no publica
  return despierto && ahora - ultimo >= cada - MARGEN_MS;
}

const esImagen = (url) => /^https:\/\/(i\.redd\.it|i\.imgur\.com)\/[\w-]+\.(png|jpe?g|gif|webp)$/i.test(String(url));

export function elegirMeme(memes, links) {
  const aptos = memes.filter(
    (m) => !m.nsfw && !m.spoiler && (m.ups ?? 0) >= VOTOS_MINIMOS && esImagen(m.url) && !links.has(m.postLink)
  );
  // El más votado: el mejor de los que todavía no salieron
  return aptos.sort((a, b) => b.ups - a.ups)[0] ?? null;
}

export async function consultarMemes(subreddit, pedir) {
  const res = await pedir(`${API}/${encodeURIComponent(subreddit)}/25`);
  if (!res.ok) throw new Error(`meme-api respondió ${res.status}`);
  const datos = await res.json();
  return Array.isArray(datos?.memes) ? datos.memes : [];
}

export function mensajeMeme(meme) {
  const titulo = String(meme.title ?? "").trim();
  return {
    embeds: [
      {
        title: titulo.length > 200 ? titulo.slice(0, 199) + "…" : titulo || "Meme",
        url: meme.postLink,
        image: { url: meme.url },
        color: 0xff4500, // naranja de Reddit
        footer: { text: `${MARCA} · r/${meme.subreddit} · ${meme.ups} ⬆` },
      },
    ],
    allowed_mentions: { parse: [] },
  };
}

// Prueba los subreddits en orden al azar hasta encontrar uno con algo nuevo
export async function buscarMeme(subreddits, links, pedir, azar = Math.random) {
  const orden = [...subreddits].sort(() => azar() - 0.5);
  for (const sub of orden) {
    const meme = elegirMeme(await consultarMemes(sub, pedir), links);
    if (meme) return meme;
  }
  return null;
}
