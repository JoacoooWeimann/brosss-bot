// =============================================================
//  FIRMA DE DISCORD
//  Discord firma cada comando que manda a nuestra función (Ed25519).
//  Hay que verificarla siempre: si no, cualquiera podría mandarle
//  pedidos falsos. Si la firma no es válida, se responde 401.
// =============================================================

import { createPublicKey, verify } from "node:crypto";

// Una clave pública Ed25519 "cruda" (32 bytes en hex) en formato que entiende Node
const PREFIJO_SPKI = Buffer.from("302a300506032b6570032100", "hex");

export function firmaValida(cuerpo, firma, timestamp, clavePublica) {
  try {
    if (!firma || !timestamp || !clavePublica) return false;
    const clave = createPublicKey({ key: Buffer.concat([PREFIJO_SPKI, Buffer.from(clavePublica, "hex")]), format: "der", type: "spki" });
    return verify(null, Buffer.from(timestamp + cuerpo), clave, Buffer.from(firma, "hex"));
  } catch {
    return false;
  }
}
