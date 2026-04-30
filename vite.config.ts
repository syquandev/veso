import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'LottoDist - Hệ Thống Chia Vé Số',
          short_name: 'LottoDist',
          description: 'Hệ thống tự động phân phối vé số theo bộ, đảm bảo tỷ lệ đẹp/xấu và tuân thủ các quy tắc kinh doanh.',
          theme_color: '#4f46e5',
          icons: [
            {
              src: 'https://picsum.photos/seed/lotto/192/192',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://picsum.photos/seed/lotto/512/512',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY),
      'process.env.APP_URL': JSON.stringify(env.APP_URL || process.env.APP_URL || ''),
      'process.env.SHARED_APP_URL': JSON.stringify(env.SHARED_APP_URL || process.env.SHARED_APP_URL || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
