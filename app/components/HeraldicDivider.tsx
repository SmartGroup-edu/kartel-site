export default function HeraldicDivider() {
  return (
    <div className="flex items-center justify-center py-1" aria-hidden="true">
      <svg
        width="120"
        height="20"
        viewBox="0 0 120 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-[var(--muted-light)] transition-colors duration-300"
      >
        <path
          d="M0 10 Q15 0 30 10 Q45 20 60 10 Q75 0 90 10 Q105 20 120 10"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
        />
        <circle cx="60" cy="10" r="2.5" fill="currentColor" />
        <circle cx="30" cy="10" r="1.5" fill="currentColor" />
        <circle cx="90" cy="10" r="1.5" fill="currentColor" />
      </svg>
    </div>
  );
}
