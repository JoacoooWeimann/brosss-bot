// =============================================================
//  /tips [jugador]
//  Qué practicar: las 3 áreas más lejos del objetivo (de las 12 de
//  los consejos de los viernes), con cuánto tiene, el objetivo, el
//  consejo, un mapa de Workshop y videos. Y lo que ya hace bien.
// =============================================================

import { AREAS, distancia } from "./consejos-def.js";

const r = Math.round;

// Todas las áreas con dato, de la más floja a la mejor
export function areasOrdenadas(areas) {
  return Object.keys(AREAS)
    .filter((k) => typeof areas?.[k] === "number")
    .map((k) => ({ area: k, valor: areas[k], distancia: distancia(k, areas[k]) }))
    .sort((a, b) => b.distancia - a.distancia);
}

// Qué tan cerca está del objetivo, de 0 a 100 (100 = lo alcanzó o lo pasó)
export const cercania = (d) => Math.max(0, Math.min(100, r((1 - d) * 100)));

function barra(porcentaje, largo = 10) {
  const llenos = Math.max(0, Math.min(largo, r((porcentaje / 100) * largo)));
  const color = porcentaje >= 100 ? "🟩" : porcentaje >= 70 ? "🟨" : "🟥";
  return `${color.repeat(llenos)}${"⬛".repeat(largo - llenos)} **${porcentaje}%** del objetivo`;
}

const MEDALLAS = ["1️⃣", "2️⃣", "3️⃣"];

// Algunas áreas se llaman como el problema ("Flasheás a tu equipo"): cuando
// van en "lo que ya hacés bien", se dicen en positivo
const EN_POSITIVO = { flashAmigos: "🙈 Casi no flasheás a tu equipo", utilidadSinUsar: "🎒 Usás tu utilidad" };
const tituloBien = (k) => EN_POSITIVO[k] ?? AREAS[k].titulo;

export function mensajeTips(usuarioId, datos) {
  const orden = areasOrdenadas(datos.areas);
  if (!orden.length) {
    return { content: `<@${usuarioId}> todavía no tiene stats de Leetify para darle consejos.`, flags: 64 };
  }
  const flojas = orden.filter((x) => x.distancia > 0).slice(0, 3);
  const fuertes = [...orden].reverse().filter((x) => x.distancia <= 0).slice(0, 3);

  const portada = {
    author: { name: "PLAN DE PRÁCTICA · BROSSS" },
    title: `📚 Qué practicar · ${datos.nombre}`,
    description: flojas.length
      ? `<@${usuarioId}>\nTus **${flojas.length} áreas** más lejos del objetivo, según tus partidas en Leetify. Arrancá por la primera. 💪`
      : `<@${usuarioId}>\n## 👑 Estás arriba del objetivo en todo\nSeguí así. Abajo están tus mejores áreas.`,
    color: flojas.length ? 0xff9f43 : 0x22e36b,
    thumbnail: datos.avatar ? { url: datos.avatar } : undefined,
  };

  const tarjetas = flojas.map((x, i) => {
    const a = AREAS[x.area];
    const links = [a.practica && `🗺️ [Practicar en ${a.practica[0]}](${a.practica[1]})`, `▶️ [Videos](${a.video})`].filter(Boolean).join("  ·  ");
    const cerca = cercania(x.distancia);
    return {
      title: `${MEDALLAS[i]} ${a.titulo}`,
      description: [
        `Tenés **${a.formato(x.valor)}** · el objetivo es **${a.formato(a.objetivo)}**`,
        barra(cerca),
        "",
        `💡 ${a.consejo}`,
        "",
        links,
      ].join("\n"),
      color: cerca >= 70 ? 0xffd54a : 0xff4d4d,
    };
  });

  const bien = fuertes.length
    ? {
        title: "✅ Lo que ya hacés bien",
        description: fuertes.map((x) => `${tituloBien(x.area)} · **${AREAS[x.area].formato(x.valor)}**`).join("\n"),
        color: 0x22e36b,
        footer: { text: "Los objetivos son valores de buen nivel aproximados · datos de Leetify" },
      }
    : { color: 0x22e36b, footer: { text: "Los objetivos son valores de buen nivel aproximados · datos de Leetify" } };

  return { embeds: [portada, ...tarjetas, bien], allowed_mentions: { parse: [] } };
}
