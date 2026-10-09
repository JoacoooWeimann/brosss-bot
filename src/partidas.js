// =============================================================
//  #HISTORIAL
//  Publica un resumen de cada partida que juegan los registrados.
//  Si varios jugaron juntos, va un solo resumen con todos.
//
//  No guarda estado: para saber qué ya publicó, mira los links de
//  Leetify de sus últimos mensajes en el canal.
// =============================================================

const LEETIFY = "https://api-public.cs-prod.leetify.com";
const VENTANA_MS = 48 * 60 * 60 * 1000; // solo partidas de las últimas 48 horas
const VERDE = 0x22e36b;
const ROJO = 0xff4d4d;
const GRIS = 0x9aa5b1;

export const urlPartida = (id) => `https://leetify.com/app/match-details/${id}`;

const MODOS = {
  matchmaking: "Premier",
  matchmaking_competitive: "Competitivo",
  matchmaking_wingman: "Wingman",
  faceit: "FACEIT",
  renown: "Renown",
};

const MAPAS = { de_dust2: "Dust II" };
export function nombreMapa(mapa) {
  const m = String(mapa || "");
  if (MAPAS[m]) return MAPAS[m];
  const sin = m.replace(/^(de|cs|ar)_/, "");
  return sin ? sin[0].toUpperCase() + sin.slice(1) : "Mapa desconocido";
}

export async function consultarPartidas(steamId, pedir, clave) {
  const res = await pedir(`${LEETIFY}/v3/profile/matches?steam64_id=${steamId}`, clave ? { _leetify_key: clave } : {});
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Leetify (partidas) respondió ${res.status}`);
  const lista = await res.json();
  return Array.isArray(lista) ? lista : [];
}

// Junta las partidas de todos: una entrada por partida, con los
// registrados que jugaron. Solo las recientes y no publicadas.
export function agrupar(partidasPorJugador, { ahora, publicadas = new Set() }) {
  const porId = new Map();
  for (const { jugador, partidas } of partidasPorJugador) {
    for (const p of partidas) {
      const fin = Date.parse(p.finished_at);
      if (!p.id || !(ahora - fin <= VENTANA_MS) || publicadas.has(urlPartida(p.id))) continue;
      const stats = p.stats?.find((s) => s.steam64_id === jugador.steamId);
      if (!stats) continue;
      if (!porId.has(p.id)) porId.set(p.id, { id: p.id, fin, mapa: p.map_name, modo: p.data_source, jugadores: [] });
      porId.get(p.id).jugadores.push({ ...jugador, stats });
    }
  }
  // Las más viejas primero, así quedan en orden en el canal
  return [...porId.values()].sort((a, b) => a.fin - b.fin);
}

const redondo = (n, d = 0) => (typeof n === "number" && Number.isFinite(n) ? Number(n.toFixed(d)) : null);

export function lineaJugador(s) {
  const adr = s.rounds_count ? Math.round(s.total_damage / s.rounds_count) : null;
  const hs = s.total_kills ? Math.round((s.total_hs_kills / s.total_kills) * 100) : null;
  const rating = redondo(s.leetify_rating * 100, 1);
  return [
    `${s.total_kills ?? 0}/${s.total_deaths ?? 0}/${s.total_assists ?? 0}`,
    adr !== null && `ADR ${adr}`,
    hs !== null && `HS ${hs}%`,
    rating !== null && `Rating ${rating > 0 ? "+" : ""}${rating}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function embedPartida(partida) {
  // El resultado sale de los rounds del primer registrado (todos juegan juntos)
  const s = partida.jugadores[0].stats;
  const ganados = s.rounds_won ?? 0;
  const perdidos = s.rounds_lost ?? 0;
  const [emoji, texto, color] =
    ganados > perdidos ? ["🏆", "Victoria", VERDE] : ganados < perdidos ? ["💀", "Derrota", ROJO] : ["🤝", "Empate", GRIS];

  // El MVP del server: el de mejor rating entre los registrados
  const orden = [...partida.jugadores].sort((a, b) => (b.stats.leetify_rating ?? -9) - (a.stats.leetify_rating ?? -9));
  const fields = orden.slice(0, 10).map((j, i) => ({
    name: `${i === 0 && orden.length > 1 ? "⭐ " : ""}${j.nombre}${j.stats.mvps ? ` · ${j.stats.mvps} MVP` : ""}`,
    value: lineaJugador(j.stats),
    inline: false,
  }));

  return {
    title: `${emoji} ${texto} en ${nombreMapa(partida.mapa)} · ${ganados}-${perdidos}`,
    url: urlPartida(partida.id),
    description: `${MODOS[partida.modo] ?? "Partida"} · <t:${Math.floor(partida.fin / 1000)}:R>`,
    color,
    fields,
    footer: { text: "Datos de Leetify · tocá el título para ver la partida completa" },
  };
}

// Los links de partidas que el bot ya publicó en el canal
export function yaPublicadas(mensajes, botId) {
  return new Set(mensajes.filter((m) => m.author?.id === botId).flatMap((m) => (m.embeds ?? []).map((e) => e.url).filter(Boolean)));
}
