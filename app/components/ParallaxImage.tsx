"use client";

import { useRef, useEffect, useState } from "react";
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
  const scrollY = useScrollY();
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  let offset = 0;
  if (!reduced && ref.current) {
    const rect = ref.current.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    const viewCenter = window.innerHeight / 2;
    offset = (center - viewCenter) * speed;
  }

  return (
    <div ref={ref} className="overflow-hidden">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes={sizes}
        className={className}
        style={{
          transform: reduced ? undefined : `translateY(${offset}px)`,
          transition: "transform 0.1s linear",
        }}
      />
    </div>
  );
}
