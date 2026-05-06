"use client";

import { useEffect } from "react";
import { useFocusTrap } from "./useFocusTrap";

interface ImageLightboxProps {
  src: string;
  alt: string;
  webpSrc?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ImageLightbox({ src, alt, webpSrc, isOpen, onClose }: ImageLightboxProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-50 flex animate-lightbox-in items-center justify-center bg-black/80"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        aria-label="Close"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <div
        className="max-h-[90vh] max-w-[90vw] animate-lightbox-zoom-in"
        onClick={(e) => e.stopPropagation()}
      >
        <picture>
          {webpSrc && <source srcSet={webpSrc} type="image/webp" />}
          <img
            src={src}
            alt={alt}
            className="h-auto max-h-[85vh] w-auto rounded object-contain"
            loading="eager"
            decoding="async"
          />
        </picture>
      </div>
    </div>
  );
}
