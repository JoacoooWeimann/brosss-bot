// =============================================================
//  MEME DE LA SEMANA (#memes)
//  Los viernes, junto con los consejos: de los memes que subieron
//  los miembros en los últimos 7 días, gana el que tiene más
//  reacciones 😂 💀 🤣. No cuentan las del autor ni las de bots, ni
//  los memes de Reddit que publica el bot.
//
//  El bot responde al meme ganador (así se ve el original) y, si
//  hay ROL_MEME, le pasa la medalla al nuevo ganador.
// =============================================================

import { fileURLToPath } from "node:url";
import { crearCliente } from "./discord.js";
import { idDeCanal } from "./index.js";

export const EMOJIS = ["😂", "💀", "🤣"];
const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;
const MINIMO_ENTRE_ENVIOS_MS = 5 * 24 * 60 * 60 * 1000; // igual que los consejos
const TITULO = "Meme de la semana";
const FINALISTAS = 5; // a los mejores se les cuentan las reacciones una por una

const fechaDeMensaje = (id) => Number((BigInt(id) >> 22n) + 1420070400000n);

const IMAGEN_O_VIDEO = /^(image|video)\//;
const LINK_DE_MEME = /https?:\/\/\S*(tenor\.com|giphy\.com|\.(png|jpe?g|gif|webp|mp4)(\?|\s|$))/i;

// ¿Es un meme subido por una persona? (imagen, video, GIF o link a uno)
export function esMeme(m) {
  if (m.author?.bot) return false;
  if (m.attachments?.some((a) => IMAGEN_O_VIDEO.test(a.content_type ?? ""))) return true;
  if (m.embeds?.some((e) => ["image", "gifv", "video"].includes(e.type))) return true;
  return LINK_DE_MEME.test(m.content ?? "");
}

// Suma rápida con los contadores que ya trae el mensaje
export function puntajeRapido(m) {
  return (m.reactions ?? []).filter((r) => EMOJIS.includes(r.emoji?.name)).reduce((s, r) => s + (r.count ?? 0), 0);
}

export function candidatos(mensajes, { ahora }) {
  return mensajes
    .filter((m) => ahora - fechaDeMensaje(m.id) <= SEMANA_MS && esMeme(m) && puntajeRapido(m) > 0)
    .sort((a, b) => puntajeRapido(b) - puntajeRapido(a) || fechaDeMensaje(a.id) - fechaDeMensaje(b.id));
}

// Reacciones que cuentan: sin las del autor ni las de bots
export function contarValidas(autorId, usuariosPorEmoji) {
  return usuariosPorEmoji.reduce((s, usuarios) => s + usuarios.filter((u) => !u.bot && u.id !== autorId).length, 0);
}

// Los anuncios del bot en el canal: si ya hubo uno esta semana y quién ganó el anterior
export function anunciosPrevios(mensajes, { botId, ahora }) {
  const propios = mensajes
    .filter((m) => m.author?.id === botId && String(m.content ?? "").includes(TITULO))
    .sort((a, b) => fechaDeMensaje(b.id) - fechaDeMensaje(a.id));
  const ultimo = propios[0];
  return {
    yaAnunciado: Boolean(ultimo && ahora - fechaDeMensaje(ultimo.id) < MINIMO_ENTRE_ENVIOS_MS),
    ganadorAnterior: ultimo ? (/<@!?(\d+)>/.exec(ultimo.content)?.[1] ?? null) : null,
  };
}

export function mensajeGanador(meme, puntos, rolId) {
  const medalla = rolId ? `\nSe lleva la medalla <@&${rolId}> hasta el viernes que viene.` : "";
  return {
    content: `🏆 **¡${TITULO}!** Felicitaciones <@${meme.author.id}>: **${puntos}** ${EMOJIS.join("")}${medalla}`,
    message_reference: { message_id: meme.id, fail_if_not_exists: false },
    // Notifica solo al ganador (el rol se nombra pero no se menciona a todos)
    allowed_mentions: { parse: [], users: [meme.author.id], replied_user: true },
  };
}

export async function ejecutarMemeSemana({ cliente, canalMemes, rolMeme, ahora = Date.now() }) {
  const yo = await cliente.yo();
  const mensajes = await cliente.mensajes(canalMemes, 1000);
  const { yaAnunciado, ganadorAnterior } = anunciosPrevios(mensajes, { botId: yo.id, ahora });
  if (yaAnunciado) return { estado: "repetido" };

  // A los finalistas se les cuentan las reacciones de verdad
  let ganador = null;
  for (const m of candidatos(mensajes, { ahora }).slice(0, FINALISTAS)) {
    const usuarios = [];
    for (const r of m.reactions.filter((r) => EMOJIS.includes(r.emoji?.name))) {
      usuarios.push(await cliente.reacciones(canalMemes, m.id, r.emoji.name));
    }
    const puntos = contarValidas(m.author.id, usuarios);
    if (puntos > 0 && (!ganador || puntos > ganador.puntos)) ganador = { meme: m, puntos };
  }
  if (!ganador) return { estado: "sin-memes" };

  await cliente.enviar(canalMemes, mensajeGanador(ganador.meme, ganador.puntos, rolMeme));

  if (rolMeme) {
    const { guild_id } = await cliente.canal(canalMemes);
    const nuevo = ganador.meme.author.id;
    if (ganadorAnterior && ganadorAnterior !== nuevo) await cliente.sacarRol(guild_id, ganadorAnterior, rolMeme).catch(() => {});
    await cliente.ponerRol(guild_id, nuevo, rolMeme);
  }
  return { estado: "ok", autor: ganador.meme.author.global_name || ganador.meme.author.username, puntos: ganador.puntos };
}

// ---------- Arranque (`node src/meme-semana.js`) ----------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { DISCORD_TOKEN } = process.env;
  const CANAL_MEMES = idDeCanal(process.env.CANAL_MEMES);
  if (!DISCORD_TOKEN || !CANAL_MEMES) {
    console.log("Sin DISCORD_TOKEN o CANAL_MEMES: no hay meme de la semana.");
    process.exit(0);
  }
  const r = await ejecutarMemeSemana({
    cliente: crearCliente(DISCORD_TOKEN),
    canalMemes: CANAL_MEMES,
    rolMeme: idDeCanal(process.env.ROL_MEME),
  });
  const textos = {
    ok: `Listo: meme de la semana de ${r.autor} con ${r.puntos} reacciones.`,
    repetido: "El meme de la semana ya estaba anunciado: no se repite.",
    "sin-memes": "Esta semana no hubo memes con reacciones: no hay ganador.",
  };
  console.log(textos[r.estado]);
}
