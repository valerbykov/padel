<<<<<<< HEAD
// main.jsx — точка входа приложения.
// Рендерим App (он показывает приложение лиги + кнопку «Войти»),
// а не PadelLeague напрямую — иначе пропадает экран авторизации.
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
=======
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PadelLeague from './PadelLeague.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PadelLeague />
  </StrictMode>,
)
>>>>>>> c2d2ff7ecc118e233a4904512d8b2194b41dc24b
