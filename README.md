# BROSSS Bot · Ranking y consejos de CS2

Bot del Discord de **BROSSS**: arma un ranking de CS2 con el **CS Rating de Premier**, el **nivel y ELO de FACEIT** y stats de **Leetify**, y lo mantiene actualizado en un canal.

No necesita un servidor prendido: **GitHub Actions** lo corre cada 15 minutos, hace su trabajo y termina.

## Cómo funciona

1. Cada jugador pega su link de Steam en **#🔗・vincular**.
2. Cada 15 minutos el bot lee el canal y busca a cada uno en Steam y Leetify.
3. Le reacciona **✅** si entró al ranking, o **❌** con un mensaje que explica qué le falta (una sola vez).
4. Edita el mensaje fijo de **#🏆・ranking**. La primera vez lo crea.

Para salir del ranking, el jugador borra su mensaje. Si manda otro link, vale el más nuevo.

### ⭐ Jugador de la semana (#ranking)
El ranking muestra quién **más subió de Premier** desde el viernes a las 12 y, cuando termina la semana, al ganador de la anterior. El Premier de cada uno al arrancar la semana se guarda en `datos/historial.json`, que el workflow commitea solo cuando cambia. Esos commits, además, evitan que GitHub pause las tareas programadas.

### 📜 Historial de partidas (#historial)
Cada partida que juegan los registrados aparece en **#historial**: victoria o derrota, mapa, modo, resultado y las stats de cada uno (K/D/A, ADR, HS y rating de Leetify). Si varios jugaron juntos, va un solo resumen con todos, y el de mejor rating lleva ⭐. El título lleva a la partida completa en Leetify.

Solo publica partidas de las últimas 48 horas, y para no repetir mira lo que ya publicó en el canal. Es opcional: si no está `CANAL_HISTORIAL`, se saltea.

### Consejos semanales (#tips)
Todos los **viernes a las 12** (hora de Argentina), el bot busca el punto más flojo de cada jugador de #vincular entre 12 áreas de Leetify (puntería, headshots, preaim, spray, counter-strafe, utilidad, flashes, tradeos…) y publica en **#tips** qué practicar, con un mapa de workshop y videos. Menciona a cada uno **sin notificar**.

Los objetivos de cada área están en `src/consejos.js` (`AREAS`): son valores de buen nivel aproximados, ajustalos si salen siempre los mismos consejos.

### Qué tiene que hacer cada jugador
- Entrar **una vez** a [leetify.com](https://leetify.com) con su cuenta de Steam.
- Tener el perfil de Leetify en **público** (es lo normal).
- Pegar su link de Steam en #vincular: `https://steamcommunity.com/id/...` o `/profiles/7656...`.

## Configuración (una sola vez)

### 1. Crear el bot
1. Entrá a [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application** → nombre `BROSSS`.
2. **Bot** → subí el logo como avatar.
3. En **Privileged Gateway Intents**, activá **Message Content Intent** (sin esto no puede leer los links).
4. **Reset Token** → copiá el token. Es la contraseña del bot: **no la pegues en ningún chat ni archivo**.
5. **OAuth2 → URL Generator** → marcá `bot` y estos permisos: *View Channels*, *Send Messages*, *Read Message History*, *Add Reactions*, *Embed Links*. Abrí el link que aparece y agregalo a BROSSS.

### 2. Crear los canales
En la categoría COUNTER:
- **🔗・vincular**: todos pueden escribir. Tema: `Pegá tu link de Steam para entrar al ranking.`
- **🏆・ranking**: nadie escribe (sacale *Enviar mensajes* a @everyone). El bot sí tiene que poder escribir.

Copiá el ID de cada canal (clic derecho → *Copiar ID del canal*, con el modo desarrollador activado).

### 3. Cargar los datos en GitHub
En este repositorio → **Settings → Secrets and variables → Actions**:

| Pestaña | Nombre | Valor |
|---|---|---|
| Secrets | `DISCORD_TOKEN` | el token del paso 1 |
| Secrets | `LEETIFY_API_KEY` | *(opcional)* clave de Leetify, sube el límite de pedidos |
| Variables (o Secrets) | `CANAL_VINCULAR` | ID de #vincular |
| Variables (o Secrets) | `CANAL_RANKING` | ID de #ranking |
| Variables (o Secrets) | `CANAL_HISTORIAL` | ID de #historial (para los resúmenes de partidas) |
| Variables (o Secrets) | `CANAL_TIPS` | ID de #tips (para los consejos) |

### 4. Probarlo
**Actions → Ranking CS2 → Run workflow.** En menos de un minuto aparece el ranking en el canal.

## Desarrollo

```bash
npm test
```

No hace falta `npm install`: no tiene dependencias (usa `fetch` y `node:test`, que vienen con Node 22+).

| Archivo | Qué hace |
|---|---|
| `src/index.js` | La vuelta completa: lee, consulta, reacciona y publica |
| `src/vincular.js` | Saca un registro por persona de los mensajes de #vincular |
| `src/steam.js` | Entiende el link de Steam y lo pasa a ID de 64 bits |
| `src/leetify.js` | Consulta Leetify (Premier, FACEIT, aim, HS, winrate) |
| `src/consejos.js` | Consejos semanales: punto flojo de cada jugador y qué practicar |
| `src/semana.js` | Jugador de la semana: historial del Premier desde el viernes |
| `src/partidas.js` | Resúmenes de partidas para #historial |
| `src/ranking.js` | Arma el embed: tabla ordenada, colores de Premier y destacados |
| `src/discord.js` | Cliente mínimo de la API de Discord |

## A tener en cuenta
- GitHub puede atrasar las tareas programadas unos minutos cuando está cargado.
- En repositorios públicos, GitHub **pausa las tareas programadas después de 60 días sin commits**. Si el ranking deja de actualizarse, entrá a Actions y volvé a activarlo.
- El token nunca está en el código: solo en los Secrets de GitHub, que no se ven en los logs.
