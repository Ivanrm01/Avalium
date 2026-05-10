module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("styles.css");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("legal");
  eleventyConfig.addPassthroughCopy("*.html");

  eleventyConfig.addFilter("dateFormat", function(date) {
    if (!date) return '';
    const d = new Date(date);
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
  });

  eleventyConfig.addCollection("posts", function(collection) {
    return collection.getFilteredByGlob("posts/*.md").reverse();
  });

  eleventyConfig.addFilter("uniqueTags", function(posts) {
    const tags = new Set();
    posts.forEach(post => {
      if (post.data && post.data.tag) {
        tags.add(post.data.tag);
      }
    });
    return Array.from(tags).sort();
  });

  eleventyConfig.addFilter("featuredPost", function(posts) {
    if (!posts || posts.length === 0) return null;
    const featured = posts.find(p => p.data && p.data.featured);
    return featured || posts[0];
  });

  eleventyConfig.addFilter("withoutFeatured", function(posts) {
    if (!posts || posts.length === 0) return [];
    const featured = posts.find(p => p.data && p.data.featured) || posts[0];
    return posts.filter(p => p.url !== featured.url);
  });

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
