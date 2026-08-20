import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "convex/_generated/**",
      ".next/**",
      "public/**",
      "node_modules/**",
      // Documentacion de marca: material de referencia, no codigo del proyecto.
      "Brand identity design documentation/**",
      "Landing/**",
    ],
  },
  {
    rules: {
      // El panel muestra texto que escriben terceros: nunca se inyecta HTML.
      "react/no-danger": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];

export default config;
