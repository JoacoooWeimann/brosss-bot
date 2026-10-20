// =============================================================
//  /smoke
//  Lineups reales de un mapa, sacados de csnades.gg (el bot baja la
//  lista una vez por día a datos/lineups.json, ver src/csnades.js):
//  agrupados por destino, con desde dónde se tira, la técnica y el
//  link al video de cada uno. Si no hay datos, quedan los links.
// =============================================================

// value: como lo usa csnades.gg en la dirección
export const MAPAS = [
  ["Mirage", "mirage"],
  ["Inferno", "inferno"],
  ["Nuke", "nuke"],
  ["Ancient", "ancient"],
  ["Anubis", "anubis"],
  ["Dust II", "dust2"],
  ["Cache", "cache"],
  ["Overpass", "overpass"],
  ["Vertigo", "vertigo"],
];

export const TIPOS = {
  smokes: { nombre: "Smokes", emoji: "💨", busqueda: "smokes", color: 0xc9d6cf },
  molotovs: { nombre: "Molotovs", emoji: "🔥", busqueda: "molotov lineups", color: 0xff7a33 },
  flashbangs: { nombre: "Flashes", emoji: "⚡", busqueda: "flash lineups", color: 0xffe14d },
};

export const LADOS = { t: "T", ct: "CT" };

const ASSETS = "https://raw.githubusercontent.com/JoacoooWeimann/brosss-bot/main/assets";
export const bannerMapa = (mapa) => `${ASSETS}/mapas/${mapa}-v1.png`;

const TECNICA = {
  left: "clic izq.",
  right: "clic der.",
  left_right: "clic izq. + der.",
  left_jump: "jumpthrow",
  right_jump: "jumpthrow (clic der.)",
  left_right_jump: "jumpthrow (izq. + der.)",
};
const MOVIMIENTO = { stationary: "quieto", running: "corriendo", walking: "caminando", crouching: "agachado", crouch_walking: "agachado caminando" };

const nombreMapa = (slug) => MAPAS.find(([, s]) => s === slug)?.[0] ?? slug;
const urlLineup = (mapa, tipo, slug) => `https://csnades.gg/${mapa}/${tipo}/${slug}`;

// Un lineup por destino: primero los fáciles y los que se tiran quieto
export function porDestino(lineups, maximo = 12) {
  const puntaje = (l) => (l.principiante ? 2 : 0) + (l.movimiento === "stationary" ? 1 : 0);
  const destinos = new Map();
  for (const l of lineups) {
    const actual = destinos.get(l.hacia);
    if (!actual) destinos.set(l.hacia, { mejor: l, cantidad: 1 });
    else {
      actual.cantidad++;
      if (puntaje(l) > puntaje(actual.mejor)) actual.mejor = l;
    }
  }
  return [...destinos.entries()]
    .sort((a, b) => b[1].cantidad - a[1].cantidad || a[0].localeCompare(b[0]))
    .slice(0, maximo)
    .map(([hacia, { mejor, cantidad }]) => ({ hacia, lineup: mejor, cantidad }));
}

export function mensajeLineups(mapa, tipo = "smokes", lado = null, datos = null) {
  const t = TIPOS[tipo] ?? TIPOS.smokes;
  tipo = TIPOS[tipo] ? tipo : "smokes";
  const nombre = nombreMapa(mapa);
  const todos = datos?.mapas?.[mapa]?.[tipo] ?? [];
  const lista = lado ? todos.filter((l) => l.lado === lado) : todos;
  const grupos = porDestino(lista);
  const ladoTexto = lado ? ` · lado ${LADOS[lado]}` : "";

  const lineas = grupos.map(({ hacia, lineup: l, cantidad }) => {
    const como = [TECNICA[l.tecnica] ?? l.tecnica, MOVIMIENTO[l.movimiento] ?? l.movimiento].filter(Boolean).join(", ");
    const mas = cantidad > 1 ? ` · +${cantidad - 1}` : "";
    return `${l.principiante ? "⭐" : "▫️"} **${hacia}** — [desde ${l.desde}](${urlLineup(mapa, tipo, l.slug)}) · *${como}*${mas}`;
  });

  const cabecera = {
    title: `${t.emoji} ${t.nombre.toUpperCase()} DE ${nombre.toUpperCase()}${ladoTexto.toUpperCase()}`,
    url: `https://csnades.gg/${mapa}/${tipo}`,
    description: lista.length
      ? `**${lista.length} lineups** a **${new Set(lista.map((l) => l.hacia)).size} destinos**. Tocá cada uno para ver el video.\n⭐ = fácil para arrancar · +N = otras formas de tirarla`
      : "Todavía no tengo la lista de lineups de este mapa. Mirá los links de abajo.",
    color: t.color,
    image: { url: bannerMapa(mapa) },
  };
  const embeds = [cabecera];
  if (lineas.length) {
    embeds.push({
      title: "📍 Por destino",
      description: lineas.join("\n"),
      color: t.color,
    });
  }
  embeds.push({
    title: "🎯 Cómo practicarlos",
    description: [
      "**1.** Abrí el lineup y mirá desde dónde se tira y a dónde se apunta.",
      `**2.** Practicalo en el mapa de **Yprac ${nombre}** (Workshop): tiene marcas para cada uno.`,
      "**3.** Cuando te sale 5 de 5 seguidas, ya está para la partida. 💪",
    ].join("\n"),
    color: 0x22e36b,
    footer: { text: "Lineups de csnades.gg · se actualizan una vez por día" },
  });

  const busqueda = encodeURIComponent(`cs2 ${nombre} ${t.busqueda}`);
  return {
    embeds,
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 5, label: `Todos en CSNADES`, emoji: { name: t.emoji }, url: `https://csnades.gg/${mapa}/${tipo}` },
          { type: 2, style: 5, label: "Videos en YouTube", emoji: { name: "▶️" }, url: `https://www.youtube.com/results?search_query=${busqueda}` },
          { type: 2, style: 5, label: "Mapa de práctica", emoji: { name: "🗺️" }, url: `https://steamcommunity.com/workshop/browse/?appid=730&searchtext=${encodeURIComponent(`yprac ${nombre}`)}` },
        ],
      },
    ],
    allowed_mentions: { parse: [] },
  };
}
