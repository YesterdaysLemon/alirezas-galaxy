const nextConfig = {
  output: 'standalone' as const,
  async headers() {
    return [
      {
        source: '/embed',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "frame-ancestors 'self' https://x.com https://*.x.com https://twitter.com https://*.twitter.com https://portfolio.alirezaafshan.com",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/embed/index.html', destination: '/embed', permanent: true },
    ];
  },
};

export default nextConfig;
