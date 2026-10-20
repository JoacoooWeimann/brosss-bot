// Discord manda acá cada uso de /team y /formacion.
// Configuración en Netlify (Site configuration → Environment variables):
//  - DISCORD_PUBLIC_KEY: la "Public Key" del portal de Discord (General Information)
//  - CANAL_VINCULAR (opcional): ID de #vincular, para el aviso a los que no tienen stats
import { atender } from "../../src/comando-team.js";

export const config = { path: "/interacciones" };

export default (peticion) =>
  atender(peticion, { clavePublica: process.env.DISCORD_PUBLIC_KEY, canalVincular: process.env.CANAL_VINCULAR });
