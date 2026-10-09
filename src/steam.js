// =============================================================
//  STEAM
//  Saca el perfil de Steam de lo que el jugador pegó en #vincular
//  y lo convierte en su ID de 64 bits (lo que pide Leetify).
// =============================================================

const STEAM = "https://steamcommunity.com";

// Acepta el link en cualquier parte del mensaje:
//  - https://steamcommunity.com/profiles/7656...
//  - https://steamcommunity.com/id/nombre
//  - el ID de 64 bits solo (7656...)
export function parsearSteam(texto) {
  const s = String(texto);
  const link = /steamcommunity\.com\/(?:profiles\/(7656\d{13})|id\/([\w-]{2,32}))/i.exec(s);
  if (link) return link[1] ? { tipo: "profiles", valor: link[1] } : { tipo: "id", valor: link[2] };
  const id = /\b(7656\d{13})\b/.exec(s);
  return id ? { tipo: "profiles", valor: id[1] } : null;
}

// El perfil en XML (?xml=1) no pide clave. Cortamos antes de <groups>:
// ahí vienen los IDs de los grupos y no los queremos confundir.
export function leerSteamId(xml) {
  const perfil = String(xml).split("<groups>")[0];
  const id = /<steamID64>(7656\d{13})<\/steamID64>/.exec(perfil)?.[1];
  return id ?? null;
}

// Devuelve el ID de 64 bits, o null si el perfil no existe.
// Si Steam no responde, tira un error (no es culpa del jugador).
export async function resolverSteamId(perfil, pedir) {
  if (perfil.tipo === "profiles") return perfil.valor;
  const res = await pedir(`${STEAM}/id/${encodeURIComponent(perfil.valor)}/?xml=1`);
  if (!res.ok) throw new Error(`Steam respondió ${res.status}`);
  return leerSteamId(await res.text());
}
