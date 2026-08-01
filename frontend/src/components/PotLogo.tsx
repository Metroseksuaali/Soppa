// Hassu kattila -logo. Piirtyy currentColor-värillä, joten väri tulee text-*-luokasta.
export function PotLogo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      {/* Höyry */}
      <path
        d="M25 15c-3-3 0-6 0-9M32 15c3-3 0-6 0-9M39 15c-3-3 0-6 0-9"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* Kansi */}
      <path d="M20 28c0-6 5-10 12-10s12 4 12 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="15.5" r="2.4" fill="currentColor" />
      {/* Reuna */}
      <path d="M13 30h38" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      {/* Runko */}
      <path
        d="M17 31l2 16c.3 3 2 4.5 5 4.5h16c3 0 4.7-1.5 5-4.5l2-16"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* Kahvat */}
      <path
        d="M17 34c-4.5 0-6.5 2.2-6.5 5.2s2 5.2 6.5 5.2M47 34c4.5 0 6.5 2.2 6.5 5.2s-2 5.2-6.5 5.2"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Hassut kasvot */}
      <circle cx="26" cy="40" r="1.9" fill="currentColor" />
      <circle cx="38" cy="40" r="1.9" fill="currentColor" />
      <path d="M26 44c2 3 10 3 12 0" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
}
