"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { Play, X } from "lucide-react";

type GalleryEntry = {
  id: string;
  type?: "photo" | "video";
  url?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  duration?: string;
  title?: string;
  alt?: string;
  caption?: string;
  locales?: Record<string, { title?: string; alt?: string; caption?: string; kind?: string }>;
};

export function GalleryGrid() {
  const english = useLocale() === "en";
  const [filter, setFilter] = useState<"all" | "video" | "photo">("all");
  const [items, setItems] = useState<GalleryEntry[]>([]);
  const [video, setVideo] = useState<GalleryEntry | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/site/content?collection=gallery", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => setItems(Array.isArray(result?.items) ? result.items : []))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const photos = useMemo(() => items.filter((item) => (item.type || "photo") === "photo" && (item.url || item.imageUrl)), [items]);
  const videos = useMemo(() => items.filter((item) => item.type === "video" && item.url), [items]);
  const visiblePhotos = filter !== "video" ? photos : [];
  const visibleVideos = filter !== "photo" ? videos : [];
  const t = (item: GalleryEntry) => item.locales?.[english ? "en" : "ar"] || {};

  return <>
    <div className="gallery-toolbar" role="group" aria-label={english ? "Filter gallery" : "تصفية المعرض"}>
      {[{ id: "all", label: english ? "All" : "الكل" }, { id: "video", label: english ? "Videos" : "الفيديو" }, { id: "photo", label: english ? "Photos" : "الصور" }].map((item) => (
        <button key={item.id} className={`filter-chip ${filter === item.id ? "is-active" : ""}`} type="button" onClick={() => setFilter(item.id as typeof filter)} aria-pressed={filter === item.id}>{item.label}</button>
      ))}
    </div>
    {visibleVideos.length > 0 && <section className="gallery-section"><div className="gallery-section__heading"><span className="eyebrow"><span className="eyebrow__dot" />{english ? "Video library" : "مكتبة الفيديو"}</span><h2>{english ? "Stories from the Academy" : "لحظات من عالم الأكاديمية"}</h2></div><div className="video-grid">
      {visibleVideos.map((item, index) => { const translation = t(item); const thumbnail = item.thumbnailUrl || item.imageUrl; return <motion.button layout key={item.id} className={`video-card ${index === 0 ? "video-card--wide" : ""}`} type="button" onClick={() => setVideo(item)}>
        <span className="video-card__image">{thumbnail ? <img src={thumbnail} alt={translation.alt || item.alt || translation.title || item.title || ""} loading="lazy" /> : <span className="gallery-image-placeholder" aria-hidden="true" />}<span className="video-card__play"><Play size={19} fill="currentColor" aria-hidden="true" /></span>{item.duration && <span className="video-card__duration">{item.duration}</span>}</span>
        <span className="video-card__text"><small>{translation.kind || (english ? "Video" : "فيديو")}</small><strong>{translation.title || item.title}</strong></span>
      </motion.button>; })}
    </div></section>}
    {visiblePhotos.length > 0 && <section className="gallery-section"><div className="gallery-section__heading"><span className="eyebrow"><span className="eyebrow__dot" />{english ? "Photo library" : "مكتبة الصور"}</span><h2>{english ? "A look at life at SEA" : "من رحلتنا في الترفيه"}</h2></div><div className="photo-grid">
      {visiblePhotos.map((item, index) => { const translation = t(item); const src = item.url || item.imageUrl || ""; return <figure key={item.id} className={`photo-card photo-card--${index % 5}`}><img src={src} alt={translation.alt || item.alt || translation.title || item.title || ""} loading="lazy" /><figcaption>{translation.caption || translation.title || item.caption || item.title}</figcaption></figure>; })}
    </div></section>}
    {visiblePhotos.length === 0 && visibleVideos.length === 0 && <p className="content-empty">{english ? "No media has been published yet." : "لم تُنشر وسائط في المعرض بعد."}</p>}
    <AnimatePresence>
      {video && <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setVideo(null); }}>
        <motion.div className="video-modal" initial={{ y: 16, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 12, scale: 0.98 }} role="dialog" aria-modal="true" aria-labelledby="video-modal-title">
          <button className="modal-close" type="button" aria-label={english ? "Close" : "إغلاق"} onClick={() => setVideo(null)}><X size={20} /></button>
          <video className="video-modal__player" controls autoPlay src={video.url} />
          <h3 id="video-modal-title">{t(video).title || video.title}</h3>
        </motion.div>
      </motion.div>}
    </AnimatePresence>
  </>;
}
