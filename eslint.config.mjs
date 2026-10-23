import js from '@eslint/js';
import angular from 'angular-eslint';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'projects/**',
      'node_modules/**',
      '.angular/**',
      'www/**',
      'dist/**',
      'out-tsc/**',
      'coverage/**',
      'android/**',
      'ios/**',
      'src/assets/**',
    ],
  },
  {
    files: ['src/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      'no-async-promise-executor': 'off',
      'no-multi-spaces': 'warn',
      'semi-spacing': 'warn',
      camelcase: 'warn',
      'no-case-declarations': 'off',
      'no-irregular-whitespace': 'off',
      'click-events-have-key-events': 'off',
      // Keep the existing change detection behavior during the Angular 22 upgrade.
      '@angular-eslint/prefer-on-push-component-change-detection': 'off',
    },
  },
  {
    files: ['src/**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/label-has-associated-control': 'off',
      '@angular-eslint/template/interactive-supports-focus': 'off',
      '@angular-eslint/template/click-events-have-key-events': 'off',
    },
  },
);
