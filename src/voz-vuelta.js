// =============================================================
//  VUELTA DE VOZ (cada 5 minutos, workflow voz.yml)
//  Mira quién está en voz, le suma 5 minutos y guarda datos/voz.json.
//  Es liviana a propósito: no instala nada ni toca el resto del bot.
// =============================================================

import { crearCliente } from "./discord.js";
import { idDeCanal } from "./ids.js";
import * as voz from "./voz.js";

const { DISCORD_TOKEN } = process.env;
const CANAL_PREMIOS = idDeCanal(process.env.CANAL_PREMIOS);
if (!DISCORD_TOKEN || !CANAL_PREMIOS) {
  console.log("Sin DISCORD_TOKEN o CANAL_PREMIOS: no se cuenta la voz.");
  process.exit(0);
}

const ahora = Date.now();
const { guild_id } = await crearCliente(DISCORD_TOKEN).canal(CANAL_PREMIOS);
const foto = await voz.fotoDeVoz(DISCORD_TOKEN, guild_id);
const usuarios = voz.quienesCuentan(foto);
const anterior = await voz.leer();
// Además de los minutos, quién está en cada canal (lo usa /team sin jugadores)
const nuevo = { ...voz.sumar(anterior, usuarios, ahora), canales: voz.enCanales(foto) };
const cambio = await voz.guardar(nuevo, anterior);
console.log(
  usuarios.length
    ? `${usuarios.length} en voz${cambio ? ", sumados 5 minutos" : " (ya se sumó en esta vuelta)"}.`
    : "Nadie en voz (acompañado) ahora."
);
