module.exports = function(eleventyConfig) {
  // Copia archivos estáticos sin procesar
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("styles.css");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("legal");
  eleventyConfig.addPassthroughCopy("*.html");

  // Filtro de fecha en español
  eleventyConfig.addFilter("dateFormat", function(date) {
    if (!date) return '';
    const d = new Date(date);
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
  });

  // Colección de posts ordenados por fecha (más recientes primero)
  eleventyConfig.addCollection("posts", function(collection) {
    return collection.getFilteredByGlob("posts/*.md").reverse();
  });

  // Filtro: extrae todas las categorías únicas de una lista de posts
  eleventyConfig.addFilter("uniqueTags", function(posts) {
    const tags = new Set();
    posts.forEach(post => {
      if (post.data && post.data.tag) {
        tags.add(post.data.tag);
      }
    });
    return Array.from(tags).sort();
  });

  // Filtro: encuentra el post destacado (primero con featured=true, o el más reciente)
  eleventyConfig.addFilter("featuredPost", function(posts) {
    if (!posts || posts.length === 0) return null;
    const featured = posts.find(p => p.data && p.data.featured);
    return featured || posts[0];
  });

  // Filtro: excluye el post destacado de la lista
  eleventyConfig.addFilter("withoutFeatured", function(posts) {
    if (!posts || posts.length === 0) return [];
    const featured = posts.find(p => p.data && p.data.featured) || posts[0];
    return posts.filter(p => p.url !== featured.url);
  });

  // Ignorar README en el output
  eleventyConfig.ignores.add("README.md");

  return {
    dir: {
      input: ".",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: false,
    templateFormats: ["md", "njk"]
  };
};
