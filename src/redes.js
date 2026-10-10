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
// Discord son los íconos oficiales de cada app.
// Si cambia una imagen, va con otro nombre (banner-v4.png) y se sube
// VERSION: GitHub y Discord guardan las imágenes en caché, y con el
// mismo nombre (aunque cambie un ?v=) pueden seguir mostrando la vieja.
const ASSETS = "https://raw.githubusercontent.com/JoacoooWeimann/brosss-bot/main/assets";
const VERSION = 3;
const imagen = (nombre) => `${ASSETS}/${nombre}-v${VERSION}.png`;
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
  // Sin url: Discord junta en una sola las tarjetas que tienen el mismo
  // link, y la de la página ya apunta a la web
  return {
    title: TITULO,
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

// 15400 → "15,4K"; 1250000 → "1,3M"; 950 → "950"
export function compacto(n) {
  const corto = (x, sufijo) => `${(Math.round(x * 10) / 10).toString().replace(".", ",")}${sufijo}`;
  if (n >= 1e6) return corto(n / 1e6, "M");
  if (n >= 1e3) return corto(n / 1e3, "K");
  return String(n);
}

// La próxima meta redonda: 15.400 → 20.000; 21.000 → 25.000; 60.000 → 75.000
export function proximaMeta(n) {
  const pasos = [1, 2, 2.5, 5, 7.5];
  for (let escala = 1000; ; escala *= 10) {
    for (const p of pasos) if (p * escala > n) return p * escala;
  }
}

// ▰▰▰▰▰▰▰▱▱▱ 77%
export function barra(actual, meta, largo = 12) {
  const parte = Math.max(0, Math.min(1, actual / meta));
  const llenos = Math.round(parte * largo);
  return `${"▰".repeat(llenos)}${"▱".repeat(largo - llenos)} **${Math.floor(parte * 100)}%**`;
}

function tarjetaTiktok({ usuario, videos = [], perfil = null }) {
  const ultimo = videos[0];
  const fields = [];
  if (perfil?.seguidores != null) fields.push({ name: "👥 Seguidores", value: `## ${compacto(perfil.seguidores)}`, inline: true });
  if (perfil?.meGusta != null) fields.push({ name: "❤️ Me gusta", value: `## ${compacto(perfil.meGusta)}`, inline: true });
  if (ultimo) {
    const vistas = ultimo.vistas != null ? ` · 👀 ${miles(ultimo.vistas)}` : "";
    fields.push({ name: "🔥 Último clip", value: `[${ultimo.titulo || "Ver clip"}](${urlVideo(usuario, ultimo.id)})${vistas}`, inline: false });
  }

  const meta = perfil?.seguidores != null ? proximaMeta(perfil.seguidores) : null;
  const objetivo = meta
    ? `\n\n🎯 **Vamos por los ${miles(meta)}** · faltan ${miles(meta - perfil.seguidores)}\n${barra(perfil.seguidores, meta)}`
    : "";

  return {
    author: { name: `TIKTOK · @${usuario}`, icon_url: IMAGENES.tiktok },
    title: "Seguinos en TikTok",
    url: `https://www.tiktok.com/@${usuario}`,
    description: `Los mejores momentos de la comunidad. Cada follow suma 🔥${objetivo}`,
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
