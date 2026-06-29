// main.jsx — точка входа приложения.
// Рендерим App (он показывает приложение лиги + кнопку «Войти»),
// а не PadelLeague напрямую — иначе пропадает экран авторизации.
import React from "react";
import { createRoot } from "react-dom/client";
import Root from "./Root";
import "./index.css";

// Root — тонкий гейт: гостю показывает Landing без supabase/App, остальное грузит лениво.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
