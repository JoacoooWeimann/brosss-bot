// El ID de un canal o rol de Discord, tal como venga en la variable:
// solo el número, como mención (<#123...>) o con espacios de más.
// Va en un archivo propio, sin dependencias, para que lo puedan usar
// las vueltas livianas (como la de voz) sin cargar todo el bot.
export const idDeCanal = (valor) => /\d{17,20}/.exec(String(valor ?? ""))?.[0] ?? "";
