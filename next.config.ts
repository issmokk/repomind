import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config, { isServer }) {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    config.output.webassemblyModuleFilename = isServer
      ? "../static/wasm/[modulehash].wasm"
      : "static/wasm/[modulehash].wasm";
    return config;
  },
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/web-tree-sitter/*.wasm",
      "./wasm/**/*.wasm",
    ],
  },
};

export default nextConfig;
