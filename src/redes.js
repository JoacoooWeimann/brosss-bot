// =============================================================
//  #REDES
//  La "tarjeta" del server: cinco tarjetas apiladas en un solo
//  mensaje, cada una con el color de su red.
//   1. Banner + miembros y conectados
//   2. Página
//   3. TikTok (último clip y vistas)
//   4. Kick (quién está en vivo, con la miniatura del directo)
//   5. Invitación
//  El bot la edita solo cuando algo cambia, igual que el ranking.
// =============================================================

import { urlCanal } from "./kick.js";
import { urlVideo } from "./tiktok.js";

export const TITULO = "BROSSS · Redes oficiales";
const WEB = "https://brosssdiscord.netlify.app";
// Las imágenes están en assets/ de este repo (público). TikTok, Kick y
// Discord son los íconos oficiales de cada app. Si cambia una imagen,
// subí VERSION: Discord guarda las imágenes en caché por dirección.
const ASSETS = "https://raw.githubusercontent.com/JoacoooWeimann/brosss-bot/main/assets";
const VERSION = 2;
const imagen = (nombre) => `${ASSETS}/${nombre}.png?v=${VERSION}`;
export const IMAGENES = {
  banner: imagen("banner"),
  web: imagen("web"),
  tiktok: imagen("tiktok"),
  kick: imagen("kick"),
  discord: imagen("discord"),
};
const COLORES = { brosss: 0x22e36b, tiktok: 0xfe2c55, kick: 0x53fc18, discord: 0x5865f2 };

const miles = (n) => Number(n).toLocaleString("es-AR");

function tarjetaPortada(stats) {
  const numeros = stats
    ? `\n\n👥 **${miles(stats.miembros)}** miembros  ·  🟢 **${miles(stats.conectados)}** conectados ahora`
    : "";
  return {
    title: TITULO,
    url: WEB,
    description: `Todo lo de BROSSS en un solo lugar. Seguinos y no te pierdas nada 👇${numeros}`,
    color: COLORES.brosss,
    image: { url: IMAGENES.banner },
  };
}

function tarjetaWeb() {
  return {
    author: { name: "PÁGINA OFICIAL", icon_url: IMAGENES.web },
    title: "brosssdiscord.netlify.app",
    url: WEB,
    description: "📊 Estadísticas en vivo  ·  🔴 Stream  ·  🎬 Clips\n📜 Reglas  ·  👑 Staff  ·  ❓ Preguntas frecuentes",
    color: COLORES.brosss,
    thumbnail: { url: IMAGENES.web },
  };
}

function tarjetaTiktok({ usuario, videos = [] }) {
  const ultimo = videos[0];
  const fields = ultimo
    ? [
        { name: "🎬 Último clip", value: `[${ultimo.titulo || "Ver clip"}](${urlVideo(usuario, ultimo.id)})`, inline: true },
        ...(ultimo.vistas != null ? [{ name: "👀 Vistas", value: miles(ultimo.vistas), inline: true }] : []),
      ]
    : [];
  return {
    author: { name: "TIKTOK", icon_url: IMAGENES.tiktok },
    title: `@${usuario}`,
    url: `https://www.tiktok.com/@${usuario}`,
    description: "Los mejores momentos de la comunidad. ¡Seguinos y compartí! 🔥",
    color: COLORES.tiktok,
    thumbnail: { url: IMAGENES.tiktok },
    fields,
  };
}

function tarjetaKick(streamers) {
  // Primero los que están en vivo, el de más espectadores arriba
  const orden = [...streamers].sort(
    (a, b) => Number(b.canal?.enVivo ?? false) - Number(a.canal?.enVivo ?? false) || (b.canal?.espectadores ?? 0) - (a.canal?.espectadores ?? 0)
  );
  const enVivo = orden.filter((s) => s.canal?.enVivo);
  const destacado = enVivo[0];
  const nombre = ({ streamer, canal }) => streamer.nombre || canal?.nombre || streamer.slug;

  const fields = orden.slice(0, 24).map((s) => {
    const url = urlCanal(s.streamer.slug);
    if (s.canal?.enVivo) {
      return { name: `🔴 ${nombre(s)}`, value: `**EN VIVO** · ${miles(s.canal.espectadores)} 👀\n[▶ Mirar ahora](${url})`, inline: true };
    }
    // Sin datos de Kick no decimos "offline"
    return { name: `${s.canal ? "⚫" : "▫️"} ${nombre(s)}`, value: `${s.canal ? "Offline" : "Sin datos"}\n[Ir al canal](${url})`, inline: true };
  });

  return {
    author: { name: "KICK", icon_url: IMAGENES.kick },
    title: destacado ? `🔴 ${nombre(destacado)} está en vivo` : "Nuestros streamers",
    url: destacado ? urlCanal(destacado.streamer.slug) : "https://kick.com",
    description: destacado
      ? [destacado.canal.titulo && `**${destacado.canal.titulo.slice(0, 150)}**`, destacado.canal.categoria].filter(Boolean).join("\n")
      : "Cuando alguien prenda, lo vas a ver acá y en las alertas de stream.",
    color: COLORES.kick,
    thumbnail: { url: IMAGENES.kick },
    image: destacado?.canal.miniatura ? { url: destacado.canal.miniatura } : undefined,
    fields,
  };
}

function tarjetaInvitacion(codigo) {
  return {
    author: { name: "INVITÁ A TUS AMIGOS", icon_url: IMAGENES.discord },
    title: `discord.gg/${codigo}`,
    url: `https://discord.gg/${codigo}`,
    description: "Cada persona que sumás nos ayuda a crecer 💚\nCopiá el link y pasáselo a quien quieras.",
    color: COLORES.discord,
    thumbnail: { url: IMAGENES.discord },
    footer: { text: "Se actualiza solo cada 15 minutos" },
  };
}

export function embedsRedes({ streamers = [], tiktok = null, invitacion = "", stats = null }) {
  return [
    tarjetaPortada(stats),
    tarjetaWeb(),
    ...(tiktok?.usuario ? [tarjetaTiktok(tiktok)] : []),
    ...(streamers.length ? [tarjetaKick(streamers)] : []),
    ...(invitacion ? [tarjetaInvitacion(invitacion)] : []),
  ];
}

// Miembros y conectados, de la invitación pública (no necesita permisos)
export async function consultarStats(codigo, pedir) {
  if (!codigo) return null;
  const res = await pedir(`https://discord.com/api/v10/invites/${encodeURIComponent(codigo)}?with_counts=true`);
  if (!res.ok) return null;
  const d = await res.json();
  return { miembros: d.approximate_member_count ?? 0, conectados: d.approximate_presence_count ?? 0 };
}

// Solo edita si cambió algo visible (así no queda "editado" cada vuelta)
const huella = (embeds) =>
  JSON.stringify((embeds ?? []).map((e) => [e.title, e.description, e.image?.url ?? null, (e.fields ?? []).map((f) => [f.name, f.value])]));

export function hayCambios(mensaje, embeds) {
  return huella(mensaje?.embeds) !== huella(embeds);
}
