// =============================================================
//  ACTIVIDAD EN VOZ
//  El bot no queda conectado, así que no puede cronometrar. En cada
//  vuelta (cada 15 min) se conecta un instante al gateway de Discord,
//  mira quién está en un canal de voz y le suma 15 minutos.
//
//  No cuenta: el canal de AFK, a quien está solo (o solo con bots)
//  y a quien está ensordecido. Así no se puede "farmear".
//
//  Los minutos se guardan en datos/voz.json, por semana (arranca el
//  viernes a las 12, como todo lo demás). Al cambiar de semana se
//  guarda la anterior, que es la que usan los premios del viernes.
// =============================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { inicioSemana } from "./semana.js";

export const ARCHIVO = new URL("../datos/voz.json", import.meta.url);
export const MINUTOS_POR_VUELTA = 15;
const GATEWAY = "wss://gateway.discord.gg/?v=10&encoding=json";
const INTENTS = (1 << 0) | (1 << 7); // GUILDS + GUILD_VOICE_STATES (ninguno privilegiado)

// Se conecta, espera los datos del servidor y se desconecta.
// Devuelve { estados, afk, bots } o tira error si tarda demasiado.
export function fotoDeVoz(token, servidorId, { espera = 15000, WS = globalThis.WebSocket } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WS(GATEWAY);
    let latido;
    const terminar = (error, valor) => {
      clearTimeout(limite);
      clearInterval(latido);
      try {
        ws.close();
      } catch {}
      error ? reject(error) : resolve(valor);
    };
    const limite = setTimeout(() => terminar(new Error("el gateway no respondió a tiempo")), espera);
    ws.onerror = () => terminar(new Error("no pude conectarme al gateway"));
    ws.onmessage = (evento) => {
      const { op, t, d } = JSON.parse(evento.data);
      if (op === 10) {
        latido = setInterval(() => ws.send(JSON.stringify({ op: 1, d: null })), d.heartbeat_interval);
        ws.send(JSON.stringify({ op: 2, d: { token, intents: INTENTS, properties: { os: "linux", browser: "brosss-bot", device: "brosss-bot" } } }));
      } else if (op === 0 && t === "GUILD_CREATE" && d.id === servidorId) {
        // Los bots que están en voz (ej. de música) vienen en members
        const bots = new Set((d.members ?? []).filter((m) => m.user?.bot).map((m) => m.user.id));
        terminar(null, { estados: d.voice_states ?? [], afk: d.afk_channel_id ?? null, bots });
      } else if (op === 9) {
        terminar(new Error("Discord rechazó la sesión"));
      }
    };
  });
}

// Quiénes suman minutos en esta foto
export function quienesCuentan({ estados, afk, bots }) {
  const validos = estados.filter(
    (e) => e.channel_id && e.channel_id !== afk && !e.self_deaf && !e.deaf && !bots.has(e.user_id)
  );
  const porCanal = new Map();
  for (const e of validos) porCanal.set(e.channel_id, [...(porCanal.get(e.channel_id) ?? []), e.user_id]);
  // Solo canales con al menos 2 personas
  return [...porCanal.values()].filter((usuarios) => usuarios.length >= 2).flat();
}

// Suma la foto al registro de la semana (y guarda la anterior al cambiar)
export function sumar(registro, usuarios, ahora) {
  const semana = inicioSemana(ahora);
  let r = registro;
  if (!r || r.semana !== semana) {
    r = { semana, minutos: {}, anterior: r ? { semana: r.semana, minutos: r.minutos } : null };
  }
  const minutos = { ...r.minutos };
  for (const u of usuarios) minutos[u] = (minutos[u] ?? 0) + MINUTOS_POR_VUELTA;
  return { ...r, minutos };
}

// Los minutos de la semana que terminó (para los premios del viernes).
// Si todavía no se cerró la semana, la que está en curso.
export function semanaParaPremios(registro, ahora) {
  if (!registro) return {};
  if (registro.semana === inicioSemana(ahora)) return registro.anterior?.minutos ?? {};
  return registro.minutos ?? {};
}

export async function leer(archivo = ARCHIVO) {
  try {
    return JSON.parse(await readFile(archivo, "utf8"));
  } catch {
    return null;
  }
}

export async function guardar(registro, anterior, archivo = ARCHIVO) {
  const nuevo = JSON.stringify(registro, null, 2) + "\n";
  if (anterior && JSON.stringify(anterior, null, 2) + "\n" === nuevo) return false;
  await mkdir(dirname(archivo instanceof URL ? archivo.pathname : archivo), { recursive: true });
  await writeFile(archivo, nuevo);
  return true;
}
