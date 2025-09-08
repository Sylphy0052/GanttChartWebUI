import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  eslint: {
    // 開発環境でのビルド時にESLintエラーを無視
    ignoreDuringBuilds: process.env.NODE_ENV === 'development',
  },
  typescript: {
    // 開発環境でのビルド時にTypeScriptエラーを無視
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
};

export default nextConfig;
