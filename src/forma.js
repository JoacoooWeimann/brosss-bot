// =============================================================
//  /forma
//  Las últimas 10 partidas de un vinculado: victorias y derrotas,
//  cómo viene su rating y su mejor partida. El bot guarda un resumen
//  de cada partida en datos/jugadores.json (campo "recientes"), con
//  las mismas listas que ya consulta para #historial.
// =============================================================

const MODOS = {
  matchmaking: "Premier",
  matchmaking_competitive: "Competitivo",
  matchmaking_wingman: "Wingman",
  faceit: "FACEIT",
  renown: "Renown",
};
const MAPAS = { de_dust2: "Dust II" };
export const nombreMapa = (m) => MAPAS[m] ?? (String(m || "").replace(/^(de|cs|ar)_/, "").replace(/^./, (c) => c.toUpperCase()) || "?");

const r = Math.round;

// Lo que importa de una partida, para un jugador
export function resumirPartida(p, steamId) {
  const s = p.stats?.find((x) => x.steam64_id === steamId);
  if (!s) return null;
  return {
    id: p.id,
    fin: p.finished_at,
    mapa: p.map_name,
    modo: p.data_source,
    ganados: s.rounds_won ?? 0,
    perdidos: s.rounds_lost ?? 0,
    k: s.total_kills ?? 0,
    d: s.total_deaths ?? 0,
    a: s.total_assists ?? 0,
    adr: s.rounds_count ? r((s.total_damage ?? 0) / s.rounds_count) : null,
    hs: s.total_kills ? r(((s.total_hs_kills ?? 0) / s.total_kills) * 100) : 0,
    rating: typeof s.leetify_rating === "number" ? r(s.leetify_rating * 1000) / 10 : null,
  };
}

// Las 10 más recientes, de la más nueva a la más vieja
export function recientes(partidas, steamId, cuantas = 10) {
  return [...partidas]
    .sort((a, b) => Date.parse(b.finished_at) - Date.parse(a.finished_at))
    .map((p) => resumirPartida(p, steamId))
    .filter(Boolean)
    .slice(0, cuantas);
}

const resultado = (p) => (p.ganados > p.perdidos ? "V" : p.ganados < p.perdidos ? "D" : "E");
const cuadro = (p) => ({ V: "🟩", D: "🟥", E: "⬜" })[resultado(p)];
const promedio = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const signo = (n) => `${n > 0 ? "+" : ""}${n.toFixed(1)}`;

export function mensajeForma(usuarioId, datos) {
  const lista = datos.recientes ?? [];
  if (!lista.length) {
    return { content: `<@${usuarioId}> todavía no tiene partidas guardadas. Aparecen cuando juega (se actualiza cada 15 minutos).`, flags: 64 };
  }
  const victorias = lista.filter((p) => resultado(p) === "V").length;
  const derrotas = lista.filter((p) => resultado(p) === "D").length;
  // De la más vieja a la más nueva, para leer la racha de izquierda a derecha
  const racha = [...lista].reverse().map(cuadro).join("");

  const ratings = lista.map((p) => p.rating).filter((x) => typeof x === "number");
  const ultimas = promedio(ratings.slice(0, 5));
  const anteriores = promedio(ratings.slice(5, 10));
  const tendencia =
    ultimas == null
      ? "—"
      : anteriores == null
        ? `**${signo(ultimas)}** de rating promedio`
        : `${ultimas >= anteriores ? "📈 Subiendo" : "📉 Bajando"}: **${signo(ultimas)}** en las últimas 5 (antes ${signo(anteriores)})`;

  const mejor = lista.filter((p) => typeof p.rating === "number").sort((a, b) => b.rating - a.rating)[0];
  const linea = (p) =>
    `${cuadro(p)} **${nombreMapa(p.mapa)}** ${p.ganados}-${p.perdidos} · ${p.k}/${p.d}/${p.a}${p.adr != null ? ` · ADR ${p.adr}` : ""}${p.rating != null ? ` · ${signo(p.rating)}` : ""}`;

  // Mapas: cuál juega más y en cuál gana más
  const porMapa = {};
  for (const p of lista) {
    const m = (porMapa[p.mapa] ??= { j: 0, v: 0 });
    m.j++;
    if (resultado(p) === "V") m.v++;
  }
  const mapas = Object.entries(porMapa).sort((a, b) => b[1].j - a[1].j);

  return {
    embeds: [
      {
        author: { name: "FORMA RECIENTE · BROSSS" },
        title: `📈 ${datos.nombre}`,
        description: `<@${usuarioId}>\n## ${racha}\n**${victorias}V – ${derrotas}D** en las últimas ${lista.length} (${r((victorias / lista.length) * 100)}% de victorias)`,
        color: victorias >= derrotas ? 0x22e36b : 0xff4d4d,
        thumbnail: datos.avatar ? { url: datos.avatar } : undefined,
        fields: [
          { name: "⭐ Rating", value: tendencia, inline: false },
          mejor && { name: "🏅 Mejor partida", value: linea(mejor), inline: false },
          { name: "🗺️ Mapas", value: mapas.slice(0, 4).map(([m, x]) => `**${nombreMapa(m)}** · ${x.v}/${x.j} ganadas`).join("\n"), inline: true },
          { name: "🎮 Últimas 5", value: lista.slice(0, 5).map(linea).join("\n"), inline: false },
        ].filter(Boolean),
        footer: { text: "Racha de la más vieja (izquierda) a la más nueva · datos de Leetify" },
      },
    ],
    allowed_mentions: { parse: [] },
  };
}
