interface SiteFooterProps {
  motto: string;
  copy: string;
  maxWidth?: string;
}

export default function SiteFooter({ motto, copy, maxWidth = "max-w-7xl" }: SiteFooterProps) {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)] transition-colors duration-300" role="contentinfo">
      <div className={`mx-auto ${maxWidth} px-4 py-8 sm:px-6 lg:px-10 lg:py-10`}>
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="font-serif text-[16px] italic tracking-wide text-[var(--accent)] sm:text-[18px]">
            {motto}
          </p>
          <div className="h-px w-12 bg-[var(--border)]" aria-hidden="true" />
          <p className="text-[13px] text-[var(--muted)] sm:text-[14px]">{copy}</p>
          <nav aria-label="Footer links" className="mt-1 flex items-center gap-4 text-[11px] tracking-[0.05em] text-[var(--muted-light)] sm:text-[12px]">
            <a
              href="mailto:gor@kartel.org.uk"
              className="transition-colors hover:text-[var(--accent)]"
            >
              gor@kartel.org.uk
            </a>
            <span aria-hidden="true" className="text-[var(--border)]">·</span>
            <a
              href="/sitemap.xml"
              className="transition-colors hover:text-[var(--accent)]"
            >
              Sitemap
            </a>
          </nav>
          <p className="text-[11px] tracking-[0.05em] text-[var(--muted-light)] sm:text-[12px]">
            &copy; {new Date().getFullYear()} kartel.org.uk
          </p>
        </div>
      </div>
    </footer>
  );
}
