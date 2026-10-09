// =============================================================
//  #VINCULAR
//  El canal es la "base de datos": cada jugador pega su Steam ahí.
//  Si borra su mensaje, sale del ranking. Si manda otro, vale el
//  más nuevo.
// =============================================================

import { parsearSteam } from "./steam.js";

export const OK = "✅";
export const ERROR = "❌";

// Los IDs de Discord (snowflakes) crecen con el tiempo:
// el más grande es el más nuevo.
const masNuevo = (a, b) => (BigInt(a.id) > BigInt(b.id) ? a : b);

// De todos los mensajes del canal, un registro por persona
export function registrosDesdeMensajes(mensajes) {
  const porUsuario = new Map();
  for (const m of mensajes) {
    if (m.author?.bot) continue;
    const perfil = parsearSteam(m.content);
    if (!perfil) continue;
    const anterior = porUsuario.get(m.author.id);
    if (anterior && masNuevo(anterior.mensaje, m) === anterior.mensaje) continue;
    porUsuario.set(m.author.id, { mensaje: m, perfil });
  }
  return [...porUsuario.values()].map(({ mensaje, perfil }) => ({
    usuarioId: mensaje.author.id,
    nombre: String(mensaje.author.global_name || mensaje.author.username || "Jugador").slice(0, 32),
    mensajeId: mensaje.id,
    perfil,
    // Qué reacciones ya le puso el bot (para no repetir ni responder dos veces)
    reaccionOk: tieneReaccion(mensaje, OK),
    reaccionError: tieneReaccion(mensaje, ERROR),
  }));
}

function tieneReaccion(mensaje, emoji) {
  return Boolean(mensaje.reactions?.some((r) => r.me && r.emoji?.name === emoji));
}

// Qué le contesta el bot a quien no pudo entrar
export const MOTIVOS = {
  "steam-no-existe":
    "No encontré ese perfil de Steam. Fijate que el link esté bien (abrí tu perfil y copiá la dirección).",
  "sin-cuenta":
    "Todavía no tenés cuenta en Leetify. Entrá a https://leetify.com, iniciá sesión con Steam y en unos minutos aparecés solo.",
  privado:
    "Tu perfil de Leetify está en privado. Ponelo público en Leetify → Settings → Privacy y aparecés solo.",
};
