// vite.config.js — Vite + React + PWA.
// Установка плагина:  npm i -D vite-plugin-pwa
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Делим вендоров на отдельные чанки: react/supabase кэшируются
        // надолго и не перекачиваются при каждом обновлении приложения.
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@supabase")) return "supabase";
            if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) return "react";
            return "vendor";
          }
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",   // тихо обновляет service worker
      injectRegister: "auto",       // сам добавит регистрацию SW
      includeAssets: ["favicon-32x32.png", "apple-touch-icon.png"],

      manifest: {
        name: "PadelPack",
        short_name: "PadelPack",
        description: "Игры в падел с друзьями: приглашения по ссылке, счёт матчей, турниры и таблица лиги.",
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
        // Аватары-собаки переведены в webp (~9 КБ вместо ~900 КБ PNG), поэтому
        // их прекэш теперь дёшев. Раньше 15 PNG раздували precache до ~15 МБ.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,webp}"],
        cleanupOutdatedCaches: true,       // чистит старый precache (в т.ч. PNG-аватары до перехода на webp)
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
            // Аватары и логотипы лиг из публичных бакетов Supabase Storage.
            // Имена файлов уникальны (avatar_<ts>, logo_<ts>), поэтому кэшируем
            // агрессивно: первый раз тянем из (возможно холодного) origin,
            // дальше — мгновенно из локального кэша. Без league-logos логотип
            // лиги «пропадал» при каждом переключении.
            urlPattern: ({ url }) =>
              url.pathname.includes("/storage/v1/object/public/avatars/") ||
              url.pathname.includes("/storage/v1/object/public/league-logos/"),
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
