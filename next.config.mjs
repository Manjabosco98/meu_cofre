/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Router Cache do cliente: mantém o payload RSC de rotas visitadas por N segundos,
    // então trocar de tela e voltar é instantâneo (sem refazer as queries). Mutations
    // chamam router.refresh() e revalidam a rota atual. React Query complementa com
    // stale-while-revalidate no client (staleTime: 5min) para revisitas além deste window.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
