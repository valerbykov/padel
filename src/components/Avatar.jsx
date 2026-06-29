// components/Avatar.jsx — единая аватарка по всему приложению.
// Всегда показывает картинку: кастомное фото (url) или брендовую собаку-фолбэк.
// props: name, url, id (для хеша фолбэка), size, ring (цвет кольца), style.
import React from "react";
import { dogAvatar } from "../lib/avatar";

export default function Avatar({ name = "", url, id, size = 36, ring, style }) {
  const src = url || dogAvatar(id || name);
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      style={{
        width: size, height: size, borderRadius: "50%", objectFit: "cover",
        border: ring ? `2px solid ${ring}` : "1px solid var(--line)",
        background: "var(--surface2)", flexShrink: 0, ...style,
      }}
    />
  );
}
