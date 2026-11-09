import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // transformers.js: evitar que el bundler intente meter onnxruntime-node
  serverExternalPackages: ["onnxruntime-node", "sharp"],
};

export default nextConfig;
