// eslint.config.cjs
const js = require("@eslint/js");
const globals = require("globals");
const { defineConfig } = require("eslint/config");

module.exports = defineConfig([
  {
    ignores: [
      "node_modules/**",
      "eslint.config.cjs",
      "js/*.min.js",
      "js/aos.js",
      "js/bootstrap-datepicker.min.js",
      "js/bootstrap.min.js",
      "js/jarallax.min.js",
      "js/jquery-3.4.1.min.js",
      "js/jquery.animateNumber.min.js",
      "js/jquery.fancybox.min.js",
      "js/jquery.sticky.js",
      "js/owl.carousel.min.js",
      "js/popper.min.js",
      "js/script.js"  // Ignoring script.js since its functions are used as event handlers
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    // ✅ use @eslint/js recommended rules directly
    ...js.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        $: "readonly",
        jQuery: "readonly",
        AOS: "readonly",
      },
      sourceType: "module"
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error"
    }
  },
  {
  files: ["analyseAI.js", "sendMail.js"],
  languageOptions: {
    sourceType: "module",
    globals: { ...require("globals").node }
  }
}

]);
