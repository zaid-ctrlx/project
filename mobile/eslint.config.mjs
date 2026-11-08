import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

// Deliberately lenient: it flags real bugs (hooks used wrongly, unused or
// undefined things, accidental assignments) without drowning the existing code
// in style complaints. Tighten rules gradually.
export default tseslint.config(
  { ignores: ["node_modules/**", "dist/**", ".expo/**", "web-build/**", "assets/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-require-imports": "off",
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  }
);
