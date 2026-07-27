/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'files.foxtrot.com.ua',
      },
      {
        protocol: 'https',
        hostname: 'hp-rus.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'kvanto.com.ua',
      },
      {
        protocol: 'https',
        hostname: 'laptopmedia.com',
      },
      {
        protocol: 'https',
        hostname: 'resources.cdn-kaspi.kz',
      },
      {
        protocol: 'https',
        hostname: 'www.notebookcheck.it',
      },
      {
        protocol: 'https',
        hostname: 'www.regard.ru',
      },
      {
        protocol: 'https',
        hostname: 'www.technodom.kz',
      },
      {
        protocol: 'https',
        hostname: 'xstore.md',
      },
      {
        protocol: 'https',
        hostname: 'zeajipsclthtdmqdpahz.supabase.co',
      },
    ],
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
};

export default nextConfig;
