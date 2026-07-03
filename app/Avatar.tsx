'use client';
import { createContext, useContext } from 'react';

/*
 * Foto profil per orang (tabel person_photos, key = nama lowercase).
 * Dashboard membungkus diri dengan <PhotosProvider value={photos}>;
 * <Avatar> otomatis pakai foto kalau ada, fallback ke inisial.
 */

const PhotoCtx = createContext<Record<string, string>>({});
export const PhotosProvider = PhotoCtx.Provider;

export const photoKey = (n: string) => n.replace(/\s+/g, ' ').trim().toLowerCase();
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();

export function Avatar({ name, className, style }: { name: string; className: string; style?: React.CSSProperties }) {
  const photo = useContext(PhotoCtx)[photoKey(name)];
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt={name} className={`${className} object-cover`} style={style} />;
  }
  return <div className={className} style={style}>{initials(name)}</div>;
}
