module.exports = {
  extends: "stylelint-config-standard",
  rules: {
      "no-unused-vars": "off",
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
    "selector-attribute-quotes": null,
    "rule-empty-line-before": null,
    "color-function-notation": null,
    "color-hex-length": null,
    "value-no-vendor-prefix": null,
    "selector-pseudo-element-colon-notation": null,
    // 🔇 Ignore les notations rgba vs rgb
    "color-function-notation": null,
    "color-function-alias-notation": null,

    // 🔇 Ignore les pourcentages pour la transparence
    "alpha-value-notation": null,

    // 🔇 Ignore les valeurs redondantes dans les shorthand
    "shorthand-property-no-redundant-values": null,

    // 🔇 Ignore la règle de nommage des IDs
    "selector-id-pattern": null,

    // 🔇 Ignore la ligne vide avant les @rules
    "at-rule-empty-line-before": null,

    // 🔇 Ignore la notation des media queries
    "media-feature-range-notation": null,
    },
  ignoreFiles: [
    "fonts/",                  // Ignorer tous les fichiers fonts
    "css/vendor/",             // Ignorer tous les fichiers vendors
    "css/aos.css",
    "css/bootstrap-datepicker.css",
    "css/style.css",
    "css/_mixins.css",
    "css/_site-blocks.css",
    
  ]
};