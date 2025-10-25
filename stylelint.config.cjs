module.exports = {
  extends: "stylelint-config-standard",
  rules: {
    // Désactiver certaines règles globalement
    "declaration-block-no-duplicate-properties": null,
    "no-duplicate-selectors": null,
    "property-no-unknown": null,
    "declaration-property-value-no-unknown": null,
    "font-family-no-missing-generic-family-keyword": null,
    "declaration-block-no-shorthand-property-overrides": null,
    "property-no-vendor-prefix": null,
    "no-empty-source": null,
    "property-no-deprecated": null,
    "media-feature-name-no-unknown": null,
    "no-descending-specificity": null,
    "declaration-block-single-line-max-declarations": null,
    "selector-pseudo-element-no-unknown": null,
    "selector-pseudo-class-no-unknown": null,
    "selector-class-pattern": null,
    "tagname-lowercase": null,
    "spec-char-escape": null,
    "attr-no-duplication": null,
    "selector-attribute-quotes": null,
    "rule-empty-line-before": null,
    "color-function-notation": null,
    "color-hex-length": null,
    "value-no-vendor-prefix": null,
    "selector-pseudo-element-colon-notation": null
  },
  ignoreFiles: [
    "fonts/",                  // Ignorer tous les fichiers fonts
    "css/vendor/",             // Ignorer tous les fichiers vendors
    "css/aos.css",
    "css/bootstrap-datepicker.css",
    "css/style.css",
    "css/_mixins.css",
    "css/_site-blocks.css",
    "register.html"
  ]
};