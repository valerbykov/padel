// vite.config.js — Vite + React + PWA.
// Установка плагина:  npm i -D vite-plugin-pwa
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      disable: mode === "capacitor",   // в нативной сборке (Capacitor) service worker не нужен
      registerType: "autoUpdate",   // тихо обновляет service worker
      injectRegister: "auto",       // сам добавит регистрацию SW
      includeAssets: ["favicon-32x32.png", "apple-touch-icon.png"],

      manifest: {
        name: "PadelPack",
        short_name: "PadelPack",
        description: "Игры в падел с друзьями: приглашения по ссылке, результаты и рейтинг.",
        lang: "ru",
        theme_color: "#0a1612",
        background_color: "#0a1612",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },

      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",   // офлайн-фолбэк для клиентского роутинга
        runtimeCaching: [
          {
            // Кэшируем шрифты Google (их грузит интерфейс).
            urlPattern: ({ url }) =>
              url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
        // ВАЖНО: запросы к Supabase API НЕ кэшируем — данные и авторизация
        // должны быть свежими. Они на другом origin и сюда не попадают.
      },
    }),
  ],
}));
