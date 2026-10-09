// =============================================================
//  ALERTAS DE STREAM (#streams)
//  Cuando alguien de la lista prende en Kick, una alerta (una sola
//  por stream). Cuando termina, la misma alerta pasa a "terminó".
//
//  No guarda estado: cada alerta lleva en el pie el número de
//  sesión de Kick, y con eso sabe qué ya avisó.
// =============================================================

import { urlCanal, duracion } from "./kick.js";

const VERDE_KICK = 0x53fc18;
const GRIS = 0x9aa5b1;
const PIE = "Kick · sesión ";

// Las alertas del bot en el canal: { slug, sesion, terminada, mensaje }
export function alertasPrevias(mensajes, botId) {
  return mensajes
    .filter((m) => m.author?.id === botId)
    .flatMap((m) =>
      (m.embeds ?? [])
        .filter((e) => e.footer?.text?.startsWith(PIE) && e.url)
        .map((e) => ({
          slug: e.url.replace(/^https:\/\/kick\.com\//, "").toLowerCase(),
          sesion: e.footer.text.slice(PIE.length),
          terminada: !String(e.title ?? "").startsWith("🔴"),
          embed: e,
          mensaje: m,
        }))
    );
}

// Qué hacer: alertas nuevas y alertas a cerrar
export function revisarStreams(estados, alertas) {
  const nuevas = [];
  const cerrar = [];
  for (const { streamer, canal } of estados) {
    if (!canal) continue; // Kick no respondió: no se toca nada
    const propias = alertas.filter((a) => a.slug === streamer.slug);
    if (canal.enVivo && canal.sesion && !propias.some((a) => a.sesion === canal.sesion)) {
      nuevas.push({ streamer, canal });
    }
    for (const a of propias) {
      if (!a.terminada && !(canal.enVivo && canal.sesion === a.sesion)) cerrar.push(a);
    }
  }
  return { nuevas, cerrar };
}

const nombreDe = (streamer, canal) => streamer.nombre || canal.nombre || streamer.slug;

export function mensajeEnVivo(streamer, canal, rolId) {
  const nombre = nombreDe(streamer, canal);
  return {
    content: `¡**${nombre}** prendió stream!${rolId ? ` <@&${rolId}>` : ""}`,
    embeds: [
      {
        title: `🔴 ${nombre} está en vivo en Kick`,
        url: urlCanal(streamer.slug),
        description: [canal.titulo && `**${canal.titulo.slice(0, 200)}**`, canal.categoria, `👉 ${urlCanal(streamer.slug)}`]
          .filter(Boolean)
          .join("\n"),
        color: VERDE_KICK,
        thumbnail: canal.avatar ? { url: canal.avatar } : undefined,
        image: canal.miniatura ? { url: canal.miniatura } : undefined,
        timestamp: new Date(canal.inicio ?? Date.now()).toISOString(),
        footer: { text: `${PIE}${canal.sesion}` },
      },
    ],
    // Solo el rol de avisos de stream, nunca @everyone
    allowed_mentions: { parse: [], roles: rolId ? [rolId] : [] },
  };
}

// La alerta queda como registro: "terminó, duró tanto"
export function embedTerminado(alerta, ahora) {
  const e = alerta.embed;
  const nombre = String(e.title ?? "").replace(/^🔴 /, "").replace(/ está en vivo en Kick$/, "");
  const inicio = e.timestamp ? Date.parse(e.timestamp) : null;
  const titulo = /^\*\*(.*)\*\*/m.exec(e.description ?? "")?.[1];
  return {
    title: `⚫ ${nombre} terminó el stream`,
    url: e.url,
    description: [titulo && `**${titulo}**`, inicio && `Duró ${duracion(inicio, ahora)}`].filter(Boolean).join("\n"),
    color: GRIS,
    thumbnail: e.thumbnail?.url ? { url: e.thumbnail.url } : undefined,
    timestamp: e.timestamp,
    footer: { text: e.footer.text },
  };
}
