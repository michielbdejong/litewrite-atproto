import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Generated code (lexicon types from `npm run lexgen`) is not linted.
    ignores: ["**/dist/**", "**/node_modules/**", "src/lexicon/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // The brief's quality bar: no `any` in application code.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Plain-JS Node scripts (no TypeScript to define globals for us).
    files: ["**/*.mjs", "scripts/**"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly" },
    },
  },
);
