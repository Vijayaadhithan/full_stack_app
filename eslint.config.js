import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

const runtimeGlobals = Object.fromEntries(
  Object.getOwnPropertyNames(globalThis).map((name) => [name, "readonly"]),
);

const browserGlobals = {
  window: "readonly",
  document: "readonly",
  navigator: "readonly",
  location: "readonly",
  history: "readonly",
  localStorage: "readonly",
  sessionStorage: "readonly",
  fetch: "readonly",
  Request: "readonly",
  Response: "readonly",
  Headers: "readonly",
  FormData: "readonly",
  File: "readonly",
  Blob: "readonly",
  Event: "readonly",
  CustomEvent: "readonly",
  HTMLElement: "readonly",
  MutationObserver: "readonly",
  IntersectionObserver: "readonly",
  atob: "readonly",
  btoa: "readonly",
};

export default [
  {
    ignores: ["node_modules/**", "dist/**", "build/**"],
  },
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...runtimeGlobals,
        ...browserGlobals,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/prefer-as-const": "off",
      "no-empty": "off",
      "no-prototype-builtins": "off",
      "prefer-const": "off",
    },
  },
];
