// =============================================================
//  LEETIFY
//  API pública: https://api-public.cs-prod.leetify.com
//  Da el CS Rating de Premier, el nivel y ELO de FACEIT y stats
//  de las últimas partidas. El jugador tiene que haber entrado
//  una vez a leetify.com con su Steam; si no, responde 404.
// =============================================================

const LEETIFY = "https://api-public.cs-prod.leetify.com";

const numero = (n) => (typeof n === "number" && Number.isFinite(n) ? n : null);
const positivo = (n) => (numero(n) !== null && n > 0 ? n : null);

// Se queda solo con lo que muestra el ranking
export function leerPerfil(datos) {
  const ranks = datos?.ranks ?? {};
  const faceit = positivo(ranks.faceit);
  return {
    nombre: String(datos?.name ?? "").slice(0, 32),
    premier: positivo(ranks.premier),
    faceit: faceit !== null && faceit <= 10 ? faceit : null,
    faceitElo: positivo(ranks.faceit_elo),
    aim: numero(datos?.rating?.aim),
    hs: numero(datos?.stats?.accuracy_head),
    winrate: numero(datos?.winrate),
    partidas: positivo(datos?.total_matches),
  };
}

// Devuelve:
//  - { estado: "ok", perfil }
//  - { estado: "sin-cuenta" }  → nunca entró a leetify.com
//  - { estado: "privado" }     → tiene el perfil de Leetify en privado
// Si Leetify falla, tira un error (se reintenta en la próxima vuelta).
export async function consultarLeetify(steamId, pedir, clave) {
  const res = await pedir(`${LEETIFY}/v3/profile?steam64_id=${steamId}`, clave ? { _leetify_key: clave } : {});
  if (res.status === 404) return { estado: "sin-cuenta" };
  if (!res.ok) throw new Error(`Leetify respondió ${res.status}`);
  const datos = await res.json();
  if (datos?.privacy_mode && datos.privacy_mode !== "public") return { estado: "privado" };
  return { estado: "ok", perfil: leerPerfil(datos) };
}
