import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prompt and golden files are read from disk at runtime; make sure the
  // serverless bundle includes them.
  outputFileTracingIncludes: {
    "/**": ["./src/prompts/**", "./evals/golden/**"],
  },
  // pg must not be bundled by the Next.js edge bundler — it is server-only.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
