// vite.config.js — Vite + React + PWA.
// Установка плагина:  npm i -D vite-plugin-pwa
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
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
          {
            // Аватары из публичного бакета Supabase Storage. Имена файлов
            // уникальны (avatar_<timestamp>), поэтому кэшируем агрессивно:
            // первый раз тянем из (возможно холодного) origin, дальше — мгновенно
            // из локального кэша, без 10-секундного ожидания.
            urlPattern: ({ url }) => url.pathname.includes("/storage/v1/object/public/avatars/"),
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-avatars",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200, 206] },
            },
          },
        ],
        // ВАЖНО: запросы к Supabase API НЕ кэшируем — данные и авторизация
        // должны быть свежими. Они на другом origin и сюда не попадают.
      },
    }),
  ],
});
