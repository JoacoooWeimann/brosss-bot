# BROSSS Bot

Bot del Discord de **BROSSS**: arma un ranking de CS2 con el **CS Rating de Premier**, el **nivel y ELO de FACEIT** y stats de **Leetify**, publica las partidas y consejos semanales, y sube los clips nuevos de TikTok.

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

### 🎬 Clips de TikTok (#clips)
Cada 15 minutos revisa la cuenta **@brosss.clips** y publica en **#clips** los videos nuevos (de los últimos 3 días), con el link para que Discord muestre el reproductor. Para no repetir, mira lo que ya publicó en el canal.

TikTok no tiene API pública: el bot lee la página de "embed de creador". Si TikTok la cambia o la bloquea, el ranking sigue andando y el log de Actions muestra `Clips: …`. Es opcional: sin `CANAL_CLIPS` se saltea. Para usar otra cuenta, agregá la variable `TIKTOK_USUARIO`.

### ⏰ Recordatorio de bump (#bumpeador)
DISBOARD deja bumpear cada 2 horas, y solo con `/bump` hecho por una persona: un bot no puede, y automatizarlo con una cuenta personal va contra las reglas de Discord y DISBOARD. El bot lee el último bump en el canal y, cuando pasan las 2 horas, avisa una sola vez (mencionando el rol de `ROL_BUMP`, si está). Cuando alguien bumpea, borra el aviso viejo. Como corre cada 15 minutos, el aviso puede llegar hasta 15 minutos tarde.

### 😂 Memes (#memes)
- **Memes de Reddit:** uno cada 6 horas (entre las 10 y las 2 de Argentina) de r/MemesEnEspanol y r/csgomemes, el más votado que todavía no salió, sin NSFW ni spoilers. Usa [meme-api.com](https://meme-api.com) porque Reddit bloquea a los bots. Para cambiar los subreddits: variable `MEMES_SUBREDDITS` (separados por coma).
- **Meme de la semana:** los viernes, con los consejos, gana el meme subido por un miembro en los últimos 7 días con más reacciones 😂 💀 🤣 (no cuentan las del autor ni las de bots, ni los memes de Reddit). El bot responde al meme ganador y, si está `ROL_MEME`, le pasa la medalla al nuevo ganador. Para eso el bot necesita el permiso **Gestionar roles** y estar más arriba que ese rol.

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
| Variables (o Secrets) | `CANAL_CLIPS` | ID de #clips (para los videos de TikTok) |
| Variables (o Secrets) | `CANAL_BUMP` | ID de #bumpeador (para el recordatorio) |
| Variables (o Secrets) | `ROL_BUMP` | *(opcional)* ID del rol al que avisa |
| Variables (o Secrets) | `CANAL_MEMES` | ID de #memes (Reddit y meme de la semana) |
| Variables (o Secrets) | `ROL_MEME` | *(opcional)* ID del rol 『🤣』Memero de la semana |
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
| `src/tiktok.js` | Videos nuevos de TikTok para #clips |
| `src/bump.js` | Recordatorio de bump de DISBOARD |
| `src/memes.js` | Memes de Reddit para #memes |
| `src/meme-semana.js` | Meme de la semana y su medalla |
| `src/ranking.js` | Arma el embed: tabla ordenada, colores de Premier y destacados |
| `src/discord.js` | Cliente mínimo de la API de Discord |

## A tener en cuenta
- **Quién lo corre cada 15 minutos:** [cron-job.org](https://cron-job.org) llama a la API de GitHub (`POST /repos/JoacoooWeimann/brosss-bot/actions/workflows/ranking.yml/dispatches` con `{"ref":"main"}`), porque las tareas programadas de GitHub no arrancaron en este repo. Usa un *fine-grained token* con permiso **Actions: Read and write** solo para este repo: **cuando vence, el bot deja de actualizarse**. Renovalo en GitHub y pegá el nuevo en cron-job.org. Si las de GitHub arrancan algún día, no pasa nada: las vueltas no se pisan y nada se publica dos veces.
- GitHub puede atrasar las tareas programadas unos minutos cuando está cargado. Los consejos de los viernes dependen de ellas: si no salen, corré **Consejos semanales** a mano o agregá otra tarea en cron-job.org con `consejos.yml`.
- En repositorios públicos, GitHub **pausa las tareas programadas después de 60 días sin commits**. Si el ranking deja de actualizarse, entrá a Actions y volvé a activarlo.
- El token nunca está en el código: solo en los Secrets de GitHub, que no se ven en los logs.
