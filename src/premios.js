// =============================================================
//  PREMIOS DE LA SEMANA (#premios)
//  Los viernes, junto con los consejos y el meme de la semana:
//   💬 Más activo en el chat: mensajes de los últimos 7 días en
//      los canales de las categorías COMUNIDAD y COUNTER.
//   🎙️ Más activo en voz: minutos de la semana (src/voz.js).
//  Muestra el podio de cada uno y, si están ROL_CHAT y ROL_VOZ,
//  pasa las medallas al nuevo ganador.
// =============================================================

import { fileURLToPath } from "node:url";
import { crearCliente } from "./discord.js";
import { idDeCanal } from "./index.js";
import * as voz from "./voz.js";

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;
const MINIMO_ENTRE_ENVIOS_MS = 5 * 24 * 60 * 60 * 1000;
const RAFAGA_MS = 5000; // mensajes seguidos en menos de 5 s cuentan como uno
const TITULO = "🏆 Premios de la semana";
const CHAT = "💬 Más activo en el chat";
const VOZ = "🎙️ Más activo en voz";
const MEDALLAS = ["🥇", "🥈", "🥉"];
// Categorías que cuentan para el chat (por nombre); se puede cambiar con CATEGORIAS_CHAT
export const CATEGORIAS = ["COMUNIDAD", "COUNTER"];
// Canales que no son charla (se buscan por nombre); se puede cambiar con CANALES_EXCLUIDOS
export const EXCLUIDOS = ["comandos", "vincular"];

const fechaDeMensaje = (id) => Number((BigInt(id) >> 22n) + 1420070400000n);

// Canales de texto (y de anuncios) dentro de esas categorías
export function canalesDeChat(canales, categorias = CATEGORIAS, excluidos = EXCLUIDOS) {
  const buscadas = categorias.map((c) => c.toUpperCase());
  const fuera = excluidos.map((c) => c.toLowerCase());
  const ids = new Set(
    canales.filter((c) => c.type === 4 && buscadas.some((n) => String(c.name).toUpperCase().includes(n))).map((c) => c.id)
  );
  return canales.filter(
    (c) => (c.type === 0 || c.type === 5) && ids.has(c.parent_id) && !fuera.some((n) => String(c.name).toLowerCase().includes(n))
  );
}

// Mensajes por persona, sin bots y con las ráfagas juntadas
export function contarMensajes(mensajesPorCanal, { ahora }) {
  const cuenta = {};
  for (const mensajes of mensajesPorCanal) {
    const ultimo = {};
    const orden = mensajes
      .filter((m) => !m.author?.bot && ahora - fechaDeMensaje(m.id) <= SEMANA_MS)
      .sort((a, b) => fechaDeMensaje(a.id) - fechaDeMensaje(b.id));
    for (const m of orden) {
      const t = fechaDeMensaje(m.id);
      const u = m.author.id;
      if (ultimo[u] != null && t - ultimo[u] < RAFAGA_MS) continue;
      ultimo[u] = t;
      cuenta[u] = (cuenta[u] ?? 0) + 1;
    }
  }
  return cuenta;
}

export const top = (cuenta, n = 3) =>
  Object.entries(cuenta)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);

// "12 h 30 min", "45 min"
export function horas(minutos) {
  const h = Math.floor(minutos / 60);
  return h ? `${h} h${minutos % 60 ? ` ${minutos % 60} min` : ""}` : `${minutos} min`;
}

const podio = (lista, formato) =>
  lista.length ? lista.map(([u, v], i) => `${MEDALLAS[i]} <@${u}> · ${formato(v)}`).join("\n") : "Nadie esta semana 😴";

export function mensajePremios({ chat, voz: enVoz, rolChat, rolVoz }) {
  const ganadores = [chat[0]?.[0], enVoz[0]?.[0]].filter(Boolean);
  const felicitaciones = ganadores.length ? `¡Felicitaciones ${[...new Set(ganadores)].map((u) => `<@${u}>`).join(" y ")}! 🎉` : "";
  const medallas = [chat[0] && rolChat && `<@&${rolChat}>`, enVoz[0] && rolVoz && `<@&${rolVoz}>`].filter(Boolean);
  return {
    content: felicitaciones,
    embeds: [
      {
        title: TITULO,
        description: medallas.length ? `Las medallas ${medallas.join(" y ")} pasan a los ganadores hasta el viernes que viene.` : undefined,
        color: 0xffd54a,
        fields: [
          { name: CHAT, value: podio(chat, (n) => `${n} mensajes`), inline: true },
          { name: VOZ, value: podio(enVoz, horas), inline: true },
        ],
        footer: { text: "Chat: canales de COMUNIDAD y COUNTER · Voz: sin AFK, sin estar solo ni ensordecido" },
      },
    ],
    // Notifica solo a los ganadores (los roles se nombran pero no se mencionan a todos)
    allowed_mentions: { parse: [], users: [...new Set(ganadores)] },
  };
}

// Si ya hubo anuncio esta semana y quiénes ganaron el anterior
export function anunciosPrevios(mensajes, { botId, ahora }) {
  const ultimo = mensajes
    .filter((m) => m.author?.id === botId && m.embeds?.[0]?.title === TITULO)
    .sort((a, b) => fechaDeMensaje(b.id) - fechaDeMensaje(a.id))[0];
  const ganadorDe = (nombre) => {
    const campo = ultimo?.embeds[0].fields?.find((f) => f.name === nombre);
    return campo ? (/^🥇 <@!?(\d+)>/.exec(campo.value)?.[1] ?? null) : null;
  };
  return {
    yaAnunciado: Boolean(ultimo && ahora - fechaDeMensaje(ultimo.id) < MINIMO_ENTRE_ENVIOS_MS),
    chatAnterior: ganadorDe(CHAT),
    vozAnterior: ganadorDe(VOZ),
  };
}

async function pasarMedalla(cliente, servidor, rol, anterior, nuevo) {
  if (!rol || !nuevo) return;
  if (anterior && anterior !== nuevo) await cliente.sacarRol(servidor, anterior, rol).catch(() => {});
  await cliente.ponerRol(servidor, nuevo, rol);
}

// prueba: cuenta todo pero no publica ni toca roles (para revisar en el log)
export async function ejecutarPremios({ cliente, canalPremios, rolChat, rolVoz, categorias, excluidos, registroVoz, ahora = Date.now(), prueba = false }) {
  const yo = await cliente.yo();
  const previos = anunciosPrevios(await cliente.mensajes(canalPremios, 50), { botId: yo.id, ahora });
  if (previos.yaAnunciado && !prueba) return { estado: "repetido" };

  const { guild_id: servidor } = await cliente.canal(canalPremios);
  const canales = canalesDeChat(await cliente.canalesDelServidor(servidor), categorias, excluidos);
  const mensajesPorCanal = [];
  for (const c of canales) {
    try {
      mensajesPorCanal.push(await cliente.mensajesDesde(c.id, ahora - SEMANA_MS));
    } catch (error) {
      console.warn(`Premios: no pude leer #${c.name} (${error.message})`);
    }
  }
  const chat = top(contarMensajes(mensajesPorCanal, { ahora }));
  // En prueba se ve la semana en curso (la que todavía no terminó)
  const enVoz = top(prueba ? (registroVoz?.minutos ?? {}) : voz.semanaParaPremios(registroVoz, ahora));
  if (prueba) return { estado: "prueba", canales: canales.map((c) => c.name), chat, voz: enVoz };

  await cliente.enviar(canalPremios, mensajePremios({ chat, voz: enVoz, rolChat, rolVoz }));
  await pasarMedalla(cliente, servidor, rolChat, previos.chatAnterior, chat[0]?.[0]);
  await pasarMedalla(cliente, servidor, rolVoz, previos.vozAnterior, enVoz[0]?.[0]);
  return { estado: "ok", canales: canales.length, chat, voz: enVoz };
}

// ---------- Arranque (`node src/premios.js`) ----------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { DISCORD_TOKEN } = process.env;
  const CANAL_PREMIOS = idDeCanal(process.env.CANAL_PREMIOS);
  if (!DISCORD_TOKEN || !CANAL_PREMIOS) {
    console.log("Sin DISCORD_TOKEN o CANAL_PREMIOS: no hay premios de la semana.");
    process.exit(0);
  }
  const lista = (v) => (v ?? "").split(",").map((c) => c.trim()).filter(Boolean);
  const categorias = lista(process.env.CATEGORIAS_CHAT);
  const excluidos = lista(process.env.CANALES_EXCLUIDOS);
  const r = await ejecutarPremios({
    cliente: crearCliente(DISCORD_TOKEN),
    canalPremios: CANAL_PREMIOS,
    rolChat: idDeCanal(process.env.ROL_CHAT),
    rolVoz: idDeCanal(process.env.ROL_VOZ),
    categorias: categorias.length ? categorias : undefined,
    excluidos: excluidos.length ? excluidos : undefined,
    registroVoz: await voz.leer(),
    prueba: process.env.PREMIOS_PRUEBA === "true",
  });
  if (r.estado === "prueba") {
    console.log(`PRUEBA (no se publicó nada). Canales de chat: ${r.canales.join(", ") || "ninguno"}`);
    console.log(`Chat: ${r.chat.map(([u, n]) => `${u}=${n}`).join(", ") || "nadie"}`);
    console.log(`Voz: ${r.voz.map(([u, m]) => `${u}=${horas(m)}`).join(", ") || "nadie"}`);
    process.exit(0);
  }
  console.log(
    r.estado === "repetido"
      ? "Los premios de esta semana ya estaban anunciados: no se repiten."
      : `Listo: premios anunciados (${r.canales} canales de chat; chat: ${r.chat.length} en el podio, voz: ${r.voz.length}).`
  );
}
