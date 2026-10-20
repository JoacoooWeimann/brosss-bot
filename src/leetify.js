// =============================================================
//  LEETIFY
//  API pública: https://api-public.cs-prod.leetify.com
//  Da el CS Rating de Premier, el nivel y ELO de FACEIT y stats
//  de las últimas partidas. El jugador tiene que haber entrado
//  una vez a leetify.com con su Steam; si no, responde 404.
// =============================================================

const LEETIFY = "https://api-public.cs-prod.leetify.com";

// Todos los pedidos a Leetify pasan por acá: si corta por exceso de
// pedidos (429), espera lo que diga (Retry-After) o unos segundos y
// reintenta. Devuelve la última respuesta.
export async function pedirLeetify(url, pedir, clave, { intentos = 3, espera = 4000 } = {}) {
  let res;
  for (let i = 0; i < intentos; i++) {
    res = await pedir(url, clave ? { _leetify_key: clave } : {});
    if (res.status !== 429 || i === intentos - 1) break;
    const pide = Number(res.headers?.get?.("retry-after"));
    await new Promise((r) => setTimeout(r, Number.isFinite(pide) && pide > 0 ? Math.min(pide, 30) * 1000 : espera * (i + 1)));
  }
  return res;
}

export const errorDeLimite = () => Object.assign(new Error("Leetify cortó por exceso de pedidos (429)"), { limite: true });

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
    areas: leerAreas(datos),
  };
}

// Las stats que usan los consejos semanales (src/consejos.js)
export function leerAreas(datos) {
  const r = datos?.rating ?? {};
  const s = datos?.stats ?? {};
  return {
    aim: numero(r.aim),
    posicionamiento: numero(r.positioning),
    utilidad: numero(r.utility),
    hs: numero(s.accuracy_head),
    preaim: numero(s.preaim),
    reaccion: numero(s.reaction_time_ms),
    spray: numero(s.spray_accuracy),
    counterstrafe: numero(s.counter_strafing_good_shots_ratio),
    flashes: numero(s.flashbang_hit_foe_per_flashbang),
    flashAmigos: numero(s.flashbang_hit_friend_per_flashbang),
    tradeos: numero(s.traded_deaths_success_percentage),
    utilidadSinUsar: numero(s.utility_on_death_avg),
    // Para los roles de /team (src/formacion.js)
    apertura: numero(r.opening),
    clutch: numero(r.clutch),
    entradaT: numero(s.t_opening_aggression_success_rate),
    precision: numero(s.accuracy_enemy_spotted),
    tradeKills: numero(s.trade_kills_success_percentage),
  };
}

// Devuelve:
//  - { estado: "ok", perfil }
//  - { estado: "sin-cuenta" }  → nunca entró a leetify.com
//  - { estado: "privado" }     → tiene el perfil de Leetify en privado
// Si Leetify falla, tira un error (se reintenta en la próxima vuelta).
export async function consultarLeetify(steamId, pedir, clave) {
  const res = await pedirLeetify(`${LEETIFY}/v3/profile?steam64_id=${steamId}`, pedir, clave);
  if (res.status === 429) throw errorDeLimite();
  if (res.status === 404) return { estado: "sin-cuenta" };
  if (!res.ok) throw new Error(`Leetify respondió ${res.status}`);
  const datos = await res.json();
  if (datos?.privacy_mode && datos.privacy_mode !== "public") return { estado: "privado" };
  return { estado: "ok", perfil: leerPerfil(datos) };
}
