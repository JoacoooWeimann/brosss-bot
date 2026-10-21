// =============================================================
//  FIRMA DE DISCORD
//  Discord firma cada comando que manda a nuestra función (Ed25519).
//  Hay que verificarla siempre: si no, cualquiera podría mandarle
//  pedidos falsos. Si la firma no es válida, se responde 401.
//
//  Usa WebCrypto (crypto.subtle), que existe igual en Cloudflare
//  Workers, en Netlify y en Node: así la función corre en cualquiera.
// =============================================================

// Por si la clave se pegó con espacios, saltos de línea o comillas
export const limpiarClave = (clave) => String(clave ?? "").replace(/[^0-9a-fA-F]/g, "");

const deHex = (hex) => new Uint8Array((hex.match(/../g) ?? []).map((b) => parseInt(b, 16)));

export async function firmaValida(cuerpo, firma, timestamp, clavePublica) {
  try {
    const hex = limpiarClave(clavePublica);
    if (!firma || !timestamp || hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(firma)) return false;
    const clave = await crypto.subtle.importKey("raw", deHex(hex), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", clave, deHex(firma), new TextEncoder().encode(timestamp + cuerpo));
  } catch {
    return false;
  }
}
