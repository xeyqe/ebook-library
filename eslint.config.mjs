import js from '@eslint/js';
import angular from 'angular-eslint';
import tseslint from 'typescript-eslint';
import legacy from './.eslintrc.json' with { type: 'json' };

export default tseslint.config(
  { ignores: legacy.ignorePatterns },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      ...legacy.overrides[0].rules,
      // Keep the existing change detection behavior during the Angular 22 upgrade.
      '@angular-eslint/prefer-on-push-component-change-detection': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: legacy.overrides[1].rules,
  },
);
