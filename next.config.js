/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['date-fns'],
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
  webpack: (config, { isServer }) => {
    // face-api.js uses Node.js built-ins that don't exist in the browser.
    // Tell webpack to provide empty shims for them on the client side.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        canvas: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;