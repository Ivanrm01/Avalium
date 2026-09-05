const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");

/* ------------------------------------------------------------------ *
 *  AJUSTES GLOBALES DEL BLOG
 *  Cambia estos valores y se aplican en todo el sitio automáticamente.
 * ------------------------------------------------------------------ */
const SITE = "https://www.avalium.es";

// Nº máximo de artículos que se muestran en cada página del blog
// y en cada página de categoría. Al superarlo, se crea /blog/pagina-2, etc.
const ARTICULOS_POR_PAGINA = 9;

// Una categoría con menos artículos que este número se genera igual
// (para poder navegar), pero se marca como "noindex" y no entra en el
// sitemap, para no crear páginas de contenido pobre. En cuanto alcanza
// el umbral pasa a ser indexable sola.
const MIN_ARTICULOS_CATEGORIA_INDEXABLE = 3;

// Palabras por minuto para calcular el tiempo de lectura automático.
const PALABRAS_POR_MINUTO = 200;

/* ------------------------------------------------------------------ *
 *  UTILIDADES
 * ------------------------------------------------------------------ */

// Slug limpio y sin acentos: "Suspensión AEAT" -> "suspension-aeat"
function slugificar(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Quita el .html y la barra final para tener URLs limpias (Vercel cleanUrls)
function limpiarUrl(url) {
  if (!url) return "";
  return String(url)
    .replace(/index\.html$/, "")
    .replace(/\.html$/, "")
    .replace(/(.+)\/$/, "$1");
}

// HTML o markdown -> texto plano legible (para meta descriptions y schema)
function textoPlano(input) {
  if (!input) return "";
  return String(input)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Recorta por palabra completa (nunca parte una palabra por la mitad)
function recortar(input, max) {
  const t = textoPlano(input);
  if (!t) return "";
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  const ultimoEspacio = corte.lastIndexOf(" ");
  return (
    corte
      .slice(0, ultimoEspacio > 0 ? ultimoEspacio : max)
      .replace(/[\s.,;:—–-]+$/, "") + "…"
  );
}

function contarPalabras(input) {
  const t = textoPlano(input);
  return t ? t.split(" ").length : 0;
}

function trocear(lista, tam) {
  const trozos = [];
  for (let i = 0; i < lista.length; i += tam) {
    trozos.push(lista.slice(i, i + tam));
  }
  return trozos;
}

module.exports = function (eleventyConfig) {
  /* ---------------------------------------------------------------- *
   *  MARKDOWN: IDs automáticos en los encabezados
   *  Necesarios para el índice del artículo y para los enlaces de
   *  salto que Google muestra en los resultados de búsqueda.
   * ---------------------------------------------------------------- */
  const md = markdownIt({ html: true }).use(markdownItAnchor, {
    level: [2, 3],
    slugify: slugificar,
    tabIndex: false,
    permalink: false,
  });

  // Imágenes del cuerpo del artículo: carga diferida (mejora Core Web Vitals)
  const imagenPorDefecto =
    md.renderer.rules.image ||
    function (tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };
  md.renderer.rules.image = function (tokens, idx, options, env, self) {
    tokens[idx].attrSet("loading", "lazy");
    tokens[idx].attrSet("decoding", "async");
    return imagenPorDefecto(tokens, idx, options, env, self);
  };

  eleventyConfig.setLibrary("md", md);

  /* ---------------------------------------------------------------- *
   *  ARCHIVOS ESTÁTICOS
   * ---------------------------------------------------------------- */
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("styles.css");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("legal");
  eleventyConfig.addPassthroughCopy("*.html");
  eleventyConfig.addPassthroughCopy("robots.txt");
  eleventyConfig.addPassthroughCopy("favicon.ico");

  /* ---------------------------------------------------------------- *
   *  DATOS GLOBALES (accesibles desde cualquier plantilla)
   * ---------------------------------------------------------------- */
  eleventyConfig.addGlobalData("site", {
    url: SITE,
    nombre: "Avalium Consulting Group",
    marca: "Avalium",
    porPagina: ARTICULOS_POR_PAGINA,
    minCategoriaIndexable: MIN_ARTICULOS_CATEGORIA_INDEXABLE,
  });

  /* ---------------------------------------------------------------- *
   *  FILTROS
   * ---------------------------------------------------------------- */

  // URL canónica sin extensión .html (evita redirecciones 308 en Vercel)
  eleventyConfig.addFilter("clean", limpiarUrl);

  // URL absoluta y limpia: /blog/algo.html -> https://www.avalium.es/blog/algo
  eleventyConfig.addFilter("absUrl", function (url) {
    const limpia = limpiarUrl(url);
    if (/^https?:\/\//.test(limpia)) return limpia;
    return SITE + (limpia.startsWith("/") ? limpia : "/" + limpia);
  });

  eleventyConfig.addFilter("slugify", slugificar);
  eleventyConfig.addFilter("plain", textoPlano);
  eleventyConfig.addFilter("recorte", recortar);
  eleventyConfig.addFilter("palabras", contarPalabras);

  // Convierte markdown suelto (por ejemplo, las respuestas del FAQ) a HTML
  eleventyConfig.addFilter("md", function (contenido) {
    if (!contenido) return "";
    return md.render(String(contenido));
  });

  eleventyConfig.addFilter("mdInline", function (contenido) {
    if (!contenido) return "";
    return md.renderInline(String(contenido));
  });

  // Serializa cualquier valor para insertarlo con seguridad dentro de un
  // bloque JSON-LD (evita que una comilla en un título rompa el schema).
  eleventyConfig.addFilter("json", function (valor) {
    return JSON.stringify(valor === undefined || valor === null ? "" : valor)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026");
  });

  eleventyConfig.addFilter("dateFormat", function (date) {
    if (!date) return "";
    const d = new Date(date);
    const months = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ];
    return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
  });

  // Fecha en formato ISO corto (YYYY-MM-DD) para sitemap y schema
  eleventyConfig.addFilter("dateISO", function (date) {
    if (!date) return "";
    return new Date(date).toISOString().slice(0, 10);
  });

  eleventyConfig.addFilter("dateISOFull", function (date) {
    if (!date) return "";
    return new Date(date).toISOString();
  });

  eleventyConfig.addFilter("dateRFC", function (date) {
    if (!date) return "";
    return new Date(date).toUTCString();
  });

  // Tiempo de lectura calculado a partir del contenido real
  eleventyConfig.addFilter("tiempoLectura", function (contenido) {
    const palabras = contarPalabras(contenido);
    if (!palabras) return "";
    return Math.max(1, Math.round(palabras / PALABRAS_POR_MINUTO)) + " min";
  });

  // Índice del artículo a partir de los H2/H3 ya renderizados
  eleventyConfig.addFilter("indice", function (html) {
    if (!html) return [];
    const salida = [];
    const regex = /<h([23])[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi;
    let m;
    while ((m = regex.exec(String(html))) !== null) {
      salida.push({
        nivel: Number(m[1]),
        id: m[2],
        texto: textoPlano(m[3]),
      });
    }
    return salida;
  });

  eleventyConfig.addFilter("uniqueTags", function (posts) {
    const tags = new Set();
    (posts || []).forEach((post) => {
      if (post.data && post.data.tag) tags.add(post.data.tag);
    });
    return Array.from(tags).sort();
  });

  eleventyConfig.addFilter("featuredPost", function (posts) {
    if (!posts || posts.length === 0) return null;
    const featured = posts.find((p) => p.data && p.data.featured);
    return featured || posts[0];
  });

  eleventyConfig.addFilter("withoutFeatured", function (posts) {
    if (!posts || posts.length === 0) return [];
    const featured = posts.find((p) => p.data && p.data.featured) || posts[0];
    return posts.filter((p) => p.url !== featured.url);
  });

  // Artículos relacionados automáticos: primero misma categoría, después
  // los más recientes. Solo se usa si el artículo no los define a mano.
  eleventyConfig.addFilter("relacionados", function (posts, urlActual, tag, n) {
    const max = n || 3;
    const otros = (posts || []).filter((p) => p.url !== urlActual);
    const mismaCategoria = otros.filter((p) => p.data.tag === tag);
    const resto = otros.filter((p) => p.data.tag !== tag);
    return mismaCategoria
      .concat(resto)
      .slice(0, max)
      .map((p) => ({
        slug: p.fileSlug,
        url: limpiarUrl(p.url),
        title: p.data.title,
        tag: p.data.tag,
        mins: p.data.reading_time || "",
      }));
  });

  /* ---------------------------------------------------------------- *
   *  COLECCIONES
   * ---------------------------------------------------------------- */

  // Todos los artículos, del más reciente al más antiguo
  eleventyConfig.addCollection("posts", function (collection) {
    return collection.getFilteredByGlob("posts/*.md").reverse();
  });

  // Artículos del listado (todos menos el destacado, que va aparte arriba)
  eleventyConfig.addCollection("postsListado", function (collection) {
    const posts = collection.getFilteredByGlob("posts/*.md").reverse();
    if (posts.length === 0) return [];
    const destacado = posts.find((p) => p.data && p.data.featured) || posts[0];
    return posts.filter((p) => p.url !== destacado.url);
  });

  // Páginas del blog: cada elemento es una página con 9 artículos como máximo
  eleventyConfig.addCollection("blogPaginas", function (collection) {
    const posts = collection.getFilteredByGlob("posts/*.md").reverse();
    let listado = [];
    if (posts.length > 0) {
      const destacado = posts.find((p) => p.data && p.data.featured) || posts[0];
      listado = posts.filter((p) => p.url !== destacado.url);
    }
    const trozos = trocear(listado, ARTICULOS_POR_PAGINA);
    // Siempre debe existir /blog aunque todavía no haya artículos
    if (trozos.length === 0) trozos.push([]);
    return trozos.map((grupo, i) => ({
      numero: i + 1,
      indice: i,
      total: trozos.length,
      posts: grupo,
    }));
  });

  // Páginas de categoría: /blog/categoria/aplazamientos, paginadas de 9 en 9
  eleventyConfig.addCollection("categoriaPaginas", function (collection) {
    const posts = collection.getFilteredByGlob("posts/*.md").reverse();
    const porTag = {};
    posts.forEach((p) => {
      const tag = p.data && p.data.tag;
      if (!tag) return;
      if (!porTag[tag]) porTag[tag] = [];
      porTag[tag].push(p);
    });

    const paginas = [];
    Object.keys(porTag)
      .sort()
      .forEach((tag) => {
        const lista = porTag[tag];
        const trozos = trocear(lista, ARTICULOS_POR_PAGINA);
        trozos.forEach((trozo, i) => {
          paginas.push({
            tag: tag,
            slug: slugificar(tag),
            numero: i + 1,
            indice: i,
            total: trozos.length,
            totalArticulos: lista.length,
            indexable: lista.length >= MIN_ARTICULOS_CATEGORIA_INDEXABLE,
            posts: trozo,
          });
        });
      });
    return paginas;
  });

  /* ---------------------------------------------------------------- *
   *  ARCHIVOS QUE NO SE PUBLICAN
   * ---------------------------------------------------------------- */
  eleventyConfig.ignores.add("README.md");
  eleventyConfig.ignores.add("GUIA-SEO-BLOG.md");

  return {
    dir: {
      input: ".",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: false,
    templateFormats: ["md", "njk"],
  };
};
