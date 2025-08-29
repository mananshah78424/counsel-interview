/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        // Add other server-side modules here
        fs: false,
      };
    }
    config.resolve.alias.canvas = false;
    // config.externals = ["sqlite3"];

    return config;
  },
};

export default nextConfig;
