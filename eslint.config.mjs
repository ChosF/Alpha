import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "convex/_generated/**",
      ".convex-tmp/**",
      ".next/**",
      "public/**",
      "node_modules/**",
      // Documentacion de marca: material de referencia, no codigo del proyecto.
      "Brand identity design documentation/**",
      "Landing/**",
    ],
  },
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      // El panel muestra texto que escriben terceros: nunca se inyecta HTML.
      "react/no-danger": "error",
    },
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];

export default config;
