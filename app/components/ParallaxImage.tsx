"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";
import { useScrollY } from "./useScrollY";

interface ParallaxImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
  speed?: number; // 0 = no parallax, 0.1 = subtle, 0.3 = strong
  sizes?: string;
}

export default function ParallaxImage({
  src,
  alt,
  width,
  height,
  priority,
  className = "",
  speed = 0.08,
  sizes,
}: ParallaxImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const scrollY = useScrollY();

  useEffect(() => {
    const el = ref.current;
    const img = imgRef.current;
    if (!el || !img) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      img.style.transform = "";
      return;
    }
    const rect = el.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    const viewCenter = window.innerHeight / 2;
    const offset = (center - viewCenter) * speed;
    img.style.transform = `translateY(${offset}px)`;
  }, [scrollY, speed]);

  return (
    <div ref={ref} className="overflow-hidden">
      <Image
        ref={imgRef}
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes={sizes}
        className={className}
        style={{ transition: "transform 0.1s linear" }}
      />
    </div>
  );
}
