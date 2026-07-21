import type { MetadataRoute } from 'next';

// PWA manifest — makes RAPTOR installable / add-to-home-screen on desktop and
// mobile. Next serves this at /manifest.webmanifest automatically. Icons reuse
// the existing 512×512 raptor-logo.png (no new assets needed).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GIO4X Raptor Trading Terminal',
    short_name: 'Raptor',
    description: 'Institutional-grade multi-asset trading terminal by GIO4X.',
    start_url: '/terminal',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#060D16',
    theme_color: '#060D16',
    categories: ['finance', 'business', 'productivity'],
    icons: [
      { src: '/raptor-logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/raptor-logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
