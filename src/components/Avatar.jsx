// components/Avatar.jsx — единая аватарка по всему приложению.
// Всегда показывает картинку: кастомное фото (url) или брендовую собаку-фолбэк.
// props: name, url, id (для хеша фолбэка), size, ring (цвет кольца), style.
import React from "react";
import { playerAvatar, avatarFallback, avatarBg , avatarOnLoad} from "../lib/avatar";

export default function Avatar({ name = "", url, id, size = 36, ring, style }) {
  const src = playerAvatar(url, id || name);
  return (
    <img
      src={src}
      onError={avatarFallback(id || name)} onLoad={avatarOnLoad}
      alt=""
      loading="lazy"
      decoding="async"
      style={{
        width: size, height: size, borderRadius: "50%", objectFit: "cover",
        border: ring ? `2px solid ${ring}` : "1px solid var(--line)",
        flexShrink: 0, ...avatarBg(id || name), ...style,
      }}
    />
  );
}
