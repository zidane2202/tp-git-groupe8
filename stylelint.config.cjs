module.exports = {
  extends: "stylelint-config-standard",
  rules: {
    // Ignorer les doublons de propriétés
    "declaration-block-no-duplicate-properties": null,
    // Ignorer les sélecteurs dupliqués
    "no-duplicate-selectors": null,
    // Ignorer les erreurs sur box-shadow, transform, transition
    "property-no-unknown": null,
    "declaration-property-value-no-unknown": null,
    "font-family-no-missing-generic-family-keyword": null,
    "declaration-block-no-shorthand-property-overrides": null,
    "property-no-vendor-prefix": null,
    "no-empty-source": null,
     "declaration-block-no-duplicate-properties": null,
    "declaration-block-no-shorthand-property-overrides": null,
    "declaration-property-value-no-unknown": null,
    "property-no-deprecated": null,
    "font-family-no-missing-generic-family-keyword": null,
    "no-empty-source": null,
    "media-feature-name-no-unknown": null,
    "no-descending-specificity": null,
    "declaration-block-single-line-max-declarations": null,
      "selector-pseudo-element-no-unknown": null,
    "selector-pseudo-class-no-unknown": null,
    "selector-class-pattern": null
  },
  ignoreFiles: [
    "fonts/**", // Ignorer tous les fichiers fonts
    "css/vendor/**" // Ignorer les fichiers vendors
  ]
};
