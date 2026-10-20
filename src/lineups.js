// =============================================================
//  /smoke
//  Lineups de un mapa: links directos a CSNADES (lineups con video,
//  paso a paso), a YouTube y al mapa de práctica de Workshop.
//  No escribe instrucciones propias de lineup a propósito: si estuvieran
//  mal, harían perder rondas. Los sitios de lineups las muestran con video.
// =============================================================

// value: como lo usa csnades.gg en la dirección
export const MAPAS = [
  ["Mirage", "mirage"],
  ["Inferno", "inferno"],
  ["Nuke", "nuke"],
  ["Ancient", "ancient"],
  ["Anubis", "anubis"],
  ["Dust II", "dust2"],
  ["Train", "train"],
  ["Overpass", "overpass"],
  ["Vertigo", "vertigo"],
];

export const TIPOS = {
  smokes: { nombre: "Smokes", emoji: "💨", busqueda: "smokes" },
  molotovs: { nombre: "Molotovs", emoji: "🔥", busqueda: "molotov lineups" },
  flashbangs: { nombre: "Flashes", emoji: "⚡", busqueda: "flash lineups" },
};

export const ZONAS = { a: "A", b: "B", mid: "Mid" };

const nombreMapa = (slug) => MAPAS.find(([, s]) => s === slug)?.[0] ?? slug;

export function mensajeLineups(mapa, tipo = "smokes", zona = null) {
  const t = TIPOS[tipo] ?? TIPOS.smokes;
  const nombre = nombreMapa(mapa);
  const z = ZONAS[zona] ?? null;
  const busqueda = encodeURIComponent(`cs2 ${nombre} ${z ? `${z} ` : ""}${t.busqueda}`);
  const workshop = encodeURIComponent(`yprac ${nombre}`);
  return {
    embeds: [
      {
        title: `${t.emoji} ${t.nombre} de ${nombre}${z ? ` · ${z}` : ""}`,
        description: [
          `Los lineups de **${nombre}** con video, paso a paso${z ? `. Filtrá por la zona **${z}** en la página` : ""}.`,
          "",
          "**Cómo practicarlos**",
          `1. Abrí el lineup en CSNADES y mirá desde dónde se tira.`,
          `2. Practicalo en el mapa de **Yprac ${nombre}** (Workshop): tiene marcas para cada lineup.`,
          "3. Cuando sale 5 de 5 seguidas, ya está para la partida. 💪",
        ].join("\n"),
        color: 0x22e36b,
        footer: { text: "Lineups de csnades.gg · también podés pedir molotovs o flashes con la opción tipo" },
      },
    ],
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 5, label: `Ver ${t.nombre.toLowerCase()} en CSNADES`, emoji: { name: t.emoji }, url: `https://csnades.gg/${mapa}/${tipo}` },
          { type: 2, style: 5, label: "Videos en YouTube", emoji: { name: "▶️" }, url: `https://www.youtube.com/results?search_query=${busqueda}` },
          { type: 2, style: 5, label: "Mapa de práctica", emoji: { name: "🗺️" }, url: `https://steamcommunity.com/workshop/browse/?appid=730&searchtext=${workshop}` },
        ],
      },
    ],
    allowed_mentions: { parse: [] },
  };
}
