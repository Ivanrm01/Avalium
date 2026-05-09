# Avalium · Panel de administración del blog

Este documento te explica cómo migrar tu web actual al sistema con panel de administración (Decap CMS) para que puedas gestionar el blog tú mismo desde `tudominio.com/admin` sin tocar código.

**Tiempo estimado de configuración inicial: 30-40 minutos.** Después, escribir un artículo te llevará 5 minutos.

---

## Resumen de cómo funcionará

1. Vas a `tudominio.com/admin`
2. Te logueas con tu cuenta de GitHub
3. Ves un panel tipo WordPress
4. Pulsas "New Artículo del blog" → escribes en un editor visual (negritas, listas, enlaces, imágenes) → "Publish"
5. Decap hace commit en GitHub → Vercel redespliega → tu artículo aparece online en ~1 minuto

---

## Diferencias respecto a tu repo actual

Tu repo actual tiene los artículos como ficheros **HTML** en `/blog/`. Para que el panel pueda editarlos visualmente, ahora son ficheros **Markdown** en `/posts/` y se convierten a HTML automáticamente al hacer deploy.

**Estructura del repo nuevo:**

```
avalium-website/
├── index.html                       (igual que antes)
├── equipo.html                      (igual)
├── suspension-deudas-aeat.html      (igual)
├── ... resto de páginas estáticas igual ...
├── styles.css                       (igual)
├── assets/                          (igual)
├── legal/                           (igual)
│
├── posts/                           ◄── NUEVO: aquí viven los artículos del blog
│   ├── coste-hipoteca-unilateral.md
│   ├── articulo-233-lgt-suspension-deudas.md
│   └── ...
│
├── admin/                           ◄── NUEVO: el panel de administración
│   ├── index.html
│   └── config.yml
│
├── api/                             ◄── NUEVO: login con GitHub
│   ├── auth.js
│   └── callback.js
│
├── _includes/                       ◄── NUEVO: plantilla de los artículos
│   └── post.njk
│
├── package.json                     ◄── NUEVO
├── .eleventy.js                     ◄── NUEVO (config del generador)
└── vercel.json                      ◄── NUEVO (config de despliegue)
```

---

## PASO 1 — Subir el código nuevo a tu repo de GitHub

**~5 minutos**

1. Descarga el zip `avalium-cms.zip` (que te entrego junto a este README) y descomprímelo en tu ordenador.
2. Ve a tu repo en GitHub (el que tienes conectado a Vercel actualmente).
3. **Antes de subir nada**, haz una copia de seguridad: pulsa el botón **Code** verde → **Download ZIP** y guarda esa copia por si acaso.
4. En GitHub, abre tu repo, pulsa **Add file** → **Upload files**.
5. Arrastra **todo el contenido** de la carpeta descomprimida (no la carpeta entera, sino los archivos de dentro) a GitHub.
6. Cuando GitHub te pregunte "¿reemplazar archivos existentes?", di que sí.
7. Abajo, en "Commit changes", pon como mensaje: `Migración a Decap CMS`. Pulsa **Commit changes**.

Vercel detectará el cambio y empezará a desplegar. **Pero todavía fallará** porque le faltan dos cosas: las variables de entorno y la configuración de la app de GitHub. Lo arreglamos en los siguientes pasos.

---

## PASO 2 — Crear la "GitHub OAuth App"

**~5 minutos**

Esto es lo que permite a Decap CMS validar tu identidad cuando te logueas en `/admin`.

1. Ve a https://github.com/settings/developers
2. Pulsa **OAuth Apps** → **New OAuth App**
3. Rellena:
   - **Application name**: `Avalium CMS` (o lo que quieras)
   - **Homepage URL**: la URL que te ha dado Vercel (ej. `https://avalium-website.vercel.app`). Si ya tienes el dominio configurado, pon `https://avalium.es`.
   - **Authorization callback URL**: la misma URL anterior **+ `/api/callback`**.
     Ejemplo: `https://avalium.es/api/callback`
4. Pulsa **Register application**
5. En la siguiente pantalla:
   - Verás un **Client ID** → cópialo a un bloc de notas
   - Pulsa **Generate a new client secret** → te dará un **Client Secret** → cópialo también (solo lo verás una vez)

Guarda los dos valores. Los vas a necesitar en el paso 3.

---

## PASO 3 — Configurar variables de entorno en Vercel

**~3 minutos**

1. Ve a https://vercel.com → entra en tu proyecto Avalium
2. **Settings** (arriba) → **Environment Variables** (menú lateral)
3. Añade dos variables, una a una:

   **Variable 1:**
   - **Key**: `OAUTH_CLIENT_ID`
   - **Value**: el Client ID que copiaste de GitHub
   - **Environments**: marca las 3 (Production, Preview, Development)
   - Pulsa **Save**

   **Variable 2:**
   - **Key**: `OAUTH_CLIENT_SECRET`
   - **Value**: el Client Secret que copiaste de GitHub
   - **Environments**: marca las 3
   - Pulsa **Save**

4. Ahora vuelve a la pestaña **Deployments**, busca el último despliegue, haz clic en los tres puntos → **Redeploy** para que use las variables.

---

## PASO 4 — Editar el archivo de configuración del CMS

**~2 minutos**

Tienes que decirle a Decap CMS dónde está tu repo de GitHub.

1. En tu repo de GitHub, abre el archivo `admin/config.yml`
2. Pulsa el lápiz para editarlo
3. Cambia esta sección por tus datos reales:

```yaml
backend:
  name: github
  repo: TU_USUARIO/TU_REPO         ◄── cambia esto
  branch: main
  base_url: https://TU_DOMINIO_VERCEL.vercel.app  ◄── cambia esto
  auth_endpoint: api/auth
```

Por ejemplo, si tu usuario de GitHub es `juanperez`, tu repo se llama `avalium-website` y tu dominio es `https://avalium.es`:

```yaml
backend:
  name: github
  repo: juanperez/avalium-website
  branch: main
  base_url: https://avalium.es
  auth_endpoint: api/auth
```

4. Abajo, pulsa **Commit changes**.

---

## PASO 5 — Verificar que todo funciona

**~2 minutos**

1. Espera 1-2 minutos a que Vercel termine de desplegar (lo ves en la pestaña Deployments con un círculo verde).
2. Abre `https://tu-dominio/admin`
3. Verás la pantalla de login de Decap CMS. Pulsa **Login with GitHub**.
4. Te lleva a GitHub para autorizar. Pulsa **Authorize**.
5. Vuelves al panel y ya estás dentro.

Si ves los 7 artículos listados, **todo funciona**. 🎉

---

## Cómo escribir un artículo nuevo

1. Ve a `tudominio.com/admin` y haz login.
2. Pulsa el botón **"New artículo"** (arriba a la derecha).
3. Rellena los campos:
   - **Título**: el título del artículo
   - **Categoría**: elige una de la lista desplegable (Hipoteca unilateral, Procedimiento, Aplazamientos, etc.)
   - **Fecha de publicación**: la fecha que quieras
   - **Tiempo de lectura**: ej. `8 min`
   - **Resumen (lede)**: una frase que aparece en grande arriba del artículo
   - **Contenido**: el cuerpo del artículo. Tienes una barra de herramientas tipo Word: negrita, cursiva, listas, citas, enlaces, imágenes, encabezados (H2, H3)...
   - **Artículos relacionados** (opcional): puedes añadir 2-3 artículos para que aparezcan al final
4. Pulsa **Publish** (arriba a la derecha).
5. Espera ~1 minuto. Vercel desplegará automáticamente y verás tu artículo en `tudominio.com/blog/SLUG.html`.

**Para insertar imágenes**: dentro del editor de contenido, pulsa el icono de imagen → "Upload" → arrastra una imagen → se sube a `assets/blog/`. Aparece automáticamente en el artículo.

---

## Cómo editar un artículo existente

1. En el panel `/admin`, pulsa sobre cualquier artículo de la lista.
2. Modifica lo que quieras.
3. Pulsa **Publish** → se actualiza online en ~1 minuto.

---

## Cómo borrar un artículo

1. Abre el artículo en el panel.
2. Arriba a la derecha, junto al botón Publish, hay un icono de papelera.
3. Pulsa y confirma.

---

## ¿Y la página `/blog.html` (índice)?

✅ **Se actualiza automáticamente.** Cuando publicas un artículo nuevo desde el panel, aparece de inmediato en `/blog.html` (en cuanto Vercel termina el deploy, ~1 min).

**Cómo funciona el índice:**

- Los artículos se ordenan por fecha de publicación (los más recientes primero).
- Los botones de filtro por categoría se generan automáticamente con las categorías que tengan tus artículos.
- El **artículo destacado** (el grande de arriba con la cita) lo eliges tú: en el panel, al editar un artículo, hay un campo **"¿Es el artículo destacado?"** (interruptor on/off). El primer artículo que tenga ese interruptor activo es el que sale destacado. Si no marcas ninguno, sale automáticamente el más reciente.
- Solo puede haber un destacado a la vez. Si marcas dos, el sistema usa el primero que encuentre.

**Campos del panel que controlan cómo se ve un artículo en el índice:**

| Campo en el panel | Dónde aparece en el índice |
|--|--|
| Título | Título de la tarjeta |
| Categoría | Etiqueta de color y filtro |
| Resumen para el índice del blog | Descripción de la tarjeta (1-2 líneas). Si lo dejas vacío, se usa el lede |
| Tiempo de lectura | Esquina inferior izquierda de la tarjeta |
| Fecha de publicación | Esquina inferior derecha de la tarjeta |
| ¿Es el artículo destacado? | Si está activo, lo coloca arriba en grande |
| Frase destacada (cita visual) | Solo se ve si el artículo es destacado: aparece en el bloque azul oscuro de la izquierda |

**Para cambiar el artículo destacado:**

1. Abre el artículo destacado actual → desactiva el interruptor "¿Es el artículo destacado?" → Publish.
2. Abre el artículo que quieres destacar → activa el interruptor → escribe la frase destacada → Publish.
3. En 1 minuto, el cambio está online.

---

## Solución de problemas comunes

### "Login with GitHub" no responde
- Verifica que `OAUTH_CLIENT_ID` y `OAUTH_CLIENT_SECRET` están bien copiados en Vercel.
- Verifica que la URL del callback en GitHub OAuth App es exactamente `https://tu-dominio/api/callback` (sin barra final, con HTTPS).

### Cuando intento publicar dice "Error: 404"
- Verifica que en `admin/config.yml` el campo `repo:` está escrito como `usuario/nombre-repo` (sin URLs ni `.git`).

### Vercel falla al desplegar
- Comprueba en Vercel la pestaña Deployments → último deploy → "View Build Logs". Suele ser por una variable de entorno mal puesta.

### Mi artículo nuevo no aparece online
- Comprueba en Vercel que el último deploy ha terminado (círculo verde, no azul de "Building").
- Refresca la página con Ctrl+Shift+R (forzar recarga sin caché).

---

## Cómo modificar páginas que NO son artículos

Páginas como `index.html`, `equipo.html`, `contacto.html`, etc. **no se editan desde el panel** (porque solo tiene sentido para contenido que se publica con frecuencia). Para modificarlas:

1. Ve a tu repo en GitHub
2. Abre el archivo `.html` que quieras
3. Pulsa el lápiz, modifica, **Commit changes**
4. Vercel despliega automáticamente

Si modificar HTML te resulta complicado, puedo añadir más colecciones al panel (por ejemplo, una para que puedas cambiar los teléfonos y direcciones desde el admin). Avísame.

---

## Resumen final

Has hecho la migración cuando:
1. Tu repo tiene los archivos nuevos (incluyendo `posts/`, `admin/`, `api/`, `_includes/`, `package.json`, `.eleventy.js`, `vercel.json`)
2. La OAuth App está creada en GitHub con el callback correcto
3. Las variables `OAUTH_CLIENT_ID` y `OAUTH_CLIENT_SECRET` están en Vercel
4. El archivo `admin/config.yml` tiene tu usuario y repo reales
5. Puedes loguearte en `tudominio.com/admin` y ves los 7 artículos
