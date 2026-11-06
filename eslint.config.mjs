// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import angular from "angular-eslint";
import chaiFriendly from 'eslint-plugin-chai-friendly';

export default tseslint.config(
  {
    files: ["src/frontend/**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],
      // Modernisation guardrails (#1250)
      "@angular-eslint/prefer-inject": "error",
      "@angular-eslint/prefer-output-readonly": "error",
      "@angular-eslint/prefer-signals": "error",
      // OnPush is the default since Angular 22, so components must not set changeDetection at all
      "@angular-eslint/prefer-on-push-component-change-detection": ["error", {allowExplicitOnPush: false}],
    },
  },
  {
    files: ["src/frontend/**/*.html"],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {
      // Modernisation guardrails (#1250)
      "@angular-eslint/template/prefer-control-flow": "error",
      "@angular-eslint/template/prefer-self-closing-tags": "error",
    },
  },
  {
    files: ["src/common/**/*.ts", "src/backend/**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
    ],
    rules: {
      '@typescript-eslint/prefer-for-of': 'off',
      // the jobs override abstract getters (Name, Supported, ...); fields would change when they are set
      '@typescript-eslint/class-literal-property-style': 'off',
      // CommonJS: native modules (sharp, ffmpeg) are loaded lazily, extensions and package.json from runtime paths
      '@typescript-eslint/no-require-imports': 'off',
    }
  },
  {
    files: ["test/**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
    ],
    plugins: {
      'chai-friendly': chaiFriendly
    },
    rules: {
      // turn off the strict TS version
      '@typescript-eslint/no-unused-expressions': 'off',
      // and enable the chai-friendly version
      'chai-friendly/no-unused-expressions': 'error',
      // JSON fixtures are loaded from runtime paths
      '@typescript-eslint/no-require-imports': 'off',
    }
  },
  {
    files: ["**/*.ts"],
    rules: {
      // the common setup from the typescript-eslint docs: `_` marks an intentionally unused name,
      // and `const {a, ...rest} = x` may drop `a`. Last, so the presets above don't reset the options.
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        ignoreRestSiblings: true,
      }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // the frontend is strictNullChecks and any-free (#1249); the backend still has some
    files: ["src/frontend/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // mocks and partial fixtures
    files: ["test/**/*.ts", "src/**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
