export default {
  extends: ['stylelint-config-standard'],
  rules: {
    'alpha-value-notation': null,
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: ['apply', 'custom-variant', 'layer', 'theme', 'utility'],
      },
    ],
    'at-rule-prelude-no-invalid': null,
    'custom-property-empty-line-before': null,
    'import-notation': 'string',
    'media-feature-range-notation': 'prefix',
    'selector-class-pattern': null,
    'value-keyword-case': [
      'lower',
      {
        ignoreKeywords: ['Inter', 'Arial', 'BlinkMacSystemFont', 'optimizeLegibility'],
      },
    ],
  },
};
