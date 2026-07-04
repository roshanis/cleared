import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prompt and golden files are read from disk at runtime; make sure the
  // serverless bundle includes them.
  outputFileTracingIncludes: {
    "/**": ["./src/prompts/**", "./evals/golden/**"],
  },
};

export default nextConfig;
