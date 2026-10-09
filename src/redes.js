// =============================================================
//  #REDES
//  La "tarjeta" del server: página, TikTok, Kick (con quién está en
//  vivo) e invitación. Un solo mensaje que el bot edita cuando algo
//  cambia, igual que el ranking.
// =============================================================

import { urlCanal } from "./kick.js";
import { urlVideo } from "./tiktok.js";

export const TITULO = "📱 Redes de BROSSS";
const WEB = "https://brosssdiscord.netlify.app";
const ICONO = `${WEB}/img/icono.png`;

export function embedRedes({ streamers = [], tiktok = null, invitacion = "" }) {
  const lineas = [`🌐 **Página:** [brosssdiscord.netlify.app](${WEB})`];

  if (tiktok?.usuario) {
    const ultimo = tiktok.videos?.[0];
    const clip = ultimo ? ` · último clip: [${ultimo.titulo || "ver"}](${urlVideo(tiktok.usuario, ultimo.id)})` : "";
    lineas.push(`🎬 **TikTok:** [@${tiktok.usuario}](https://www.tiktok.com/@${tiktok.usuario})${clip}`);
  }

  if (streamers.length) {
    // Primero los que están en vivo
    const orden = [...streamers].sort((a, b) => Number(b.canal?.enVivo ?? false) - Number(a.canal?.enVivo ?? false));
    lineas.push("", "🟢 **Kick**");
    for (const { streamer, canal } of orden) {
      const nombre = streamer.nombre || canal?.nombre || streamer.slug;
      const link = `[${nombre}](${urlCanal(streamer.slug)})`;
      lineas.push(
        canal?.enVivo
          ? `🔴 ${link} · **en vivo**${canal.titulo ? `: ${canal.titulo.slice(0, 80)}` : ""} (${canal.espectadores} 👀)`
          : canal
            ? `⚫ ${link}`
            : `▫️ ${link}`
      );
    }
  }

  if (invitacion) lineas.push("", `📨 **Invitá a tus amigos:** https://discord.gg/${invitacion}`);

  return {
    title: TITULO,
    url: WEB,
    description: lineas.join("\n"),
    color: 0x22e36b,
    thumbnail: { url: ICONO },
    footer: { text: "Se actualiza solo cada 15 minutos", icon_url: ICONO },
  };
}

// Solo edita si cambió algo (así no queda "editado" cada 15 minutos)
export function hayCambios(mensaje, embed) {
  return mensaje?.embeds?.[0]?.description !== embed.description;
}
