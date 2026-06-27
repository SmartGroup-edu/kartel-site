interface SiteFooterProps {
  motto: string;
  copy: string;
  maxWidth?: string;
  /**
   * Contact email shown in the footer. Defaults to the family/home contact.
   * Pass `null` on institutional surfaces (e.g. the Core Registry) that must
   * carry no personal contact / PII.
   */
  contactEmail?: string | null;
}

export default function SiteFooter({
  motto,
  copy,
  maxWidth = "max-w-7xl",
  contactEmail = "gor@kartel.org.uk",
}: SiteFooterProps) {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)] transition-colors duration-300">
      <div className={`mx-auto ${maxWidth} px-4 py-8 sm:px-6 lg:px-10 lg:py-10`}>
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="font-serif text-[16px] italic tracking-wide text-[var(--accent)] sm:text-[18px]">
            {motto}
          </p>
          <div className="h-px w-12 bg-[var(--border)]" aria-hidden="true" />
          <p className="text-[13px] text-[var(--muted)] sm:text-[14px]">{copy}</p>
          <nav aria-label="Footer links" className="mt-1 flex items-center gap-4 text-[11px] tracking-[0.05em] text-[var(--muted-light)] sm:text-[12px]">
            {contactEmail && (
              <>
                {/*
                  Render the mailto link inside Cloudflare's `email_off` markers so
                  Cloudflare's Email Address Obfuscation (Scrape Shield) leaves it
                  alone. Without this, the edge rewrites the address into a JS-only
                  `data-cfemail` placeholder that shows "[email protected]" to
                  no-JS clients and crawlers. The markers are HTML comments, so they
                  must be emitted as raw HTML (React strips comment nodes). The
                  address is public and already published in llms.txt, so no
                  obfuscation is wanted here — only a working, no-JS link.
                */}
                <span
                  dangerouslySetInnerHTML={{
                    __html: `<!--email_off--><a href="mailto:${contactEmail}" class="rounded-sm transition-colors hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">${contactEmail}</a><!--/email_off-->`,
                  }}
                />
                <span aria-hidden="true" className="text-[var(--border)]">·</span>
              </>
            )}
            <a
              href="/sitemap.xml"
              className="rounded-sm transition-colors hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
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
