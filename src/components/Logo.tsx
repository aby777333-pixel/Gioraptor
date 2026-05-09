'use client';

/**
 * GIO RAPTOR Logo — eagle-in-shield brand mark.
 * Gold-to-blue gradient shield containing a flying raptor silhouette,
 * paired with two-tone "GIO" (cyan) + "RAPTOR" (light gray) wordmark.
 *
 * Props:
 *  - height: logo height in px (default 32)
 *  - iconOnly: show only the shield + raptor mark
 *  - className: additional CSS classes
 *  - theme: 'dark' | 'light' — controls RAPTOR text color
 */

interface LogoProps {
  height?: number;
  iconOnly?: boolean;
  className?: string;
  theme?: 'dark' | 'light';
}

export default function Logo({
  height = 32,
  iconOnly = false,
  className = '',
  theme = 'dark',
}: LogoProps) {
  const raptorColor = theme === 'dark' ? '#C0C4CC' : '#3A3A3A';
  const gioColor = '#00B4D8';

  // Mark is a 1:1 square so it scales cleanly next to text.
  const markSize = height;

  if (iconOnly) {
    return <Mark size={markSize} className={className} />;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`} style={{ height }}>
      <Mark size={markSize} />
      <div
        className="flex items-baseline"
        style={{ fontFamily: 'var(--font-inter, Inter), sans-serif' }}
      >
        <span
          style={{
            fontSize: height * 0.62,
            fontWeight: 600,
            letterSpacing: '0.01em',
            color: gioColor,
            lineHeight: 1,
          }}
        >
          GIO
        </span>
        <span
          style={{
            fontSize: height * 0.62,
            fontWeight: 300,
            letterSpacing: '0.14em',
            color: raptorColor,
            lineHeight: 1,
            marginLeft: height * 0.18,
          }}
        >
          RAPTOR
        </span>
      </div>
    </div>
  );
}

/**
 * Shield-and-raptor mark, drawn as a single SVG.
 * Gradient runs gold (top) → blue (bottom), matching the brand artwork.
 */
function Mark({ size, className = '' }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="raptorBrandGrad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#F4C75A" />
          <stop offset="30%" stopColor="#D9A93B" />
          <stop offset="55%" stopColor="#3D7DC8" />
          <stop offset="100%" stopColor="#1E5AA8" />
        </linearGradient>
      </defs>

      {/* Shield outline — open frame with curled top "horns" tapering to a point */}
      <path
        d="M 18 30
           C 18 22, 24 16, 32 16
           C 46 16, 56 24, 60 36
           C 64 24, 74 16, 88 16
           C 96 16, 102 22, 102 30
           L 102 64
           C 102 88, 84 104, 60 112
           C 36 104, 18 88, 18 64
           Z"
        fill="none"
        stroke="url(#raptorBrandGrad)"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />

      {/* Stylized raptor in flight — wings up/back, body angled forward */}
      <g fill="url(#raptorBrandGrad)">
        {/* Upper wing (left, swept back) */}
        <path d="M 30 50 L 56 38 L 52 54 L 38 58 Z" />
        {/* Lower wing trailing edge */}
        <path d="M 34 62 L 54 56 L 50 70 L 40 70 Z" opacity="0.85" />
        {/* Body — angled diamond, head at right */}
        <path d="M 52 52 L 78 44 L 88 52 L 72 60 L 60 68 L 50 64 Z" />
        {/* Head + beak */}
        <path d="M 78 44 L 92 46 L 88 52 L 80 50 Z" />
        {/* Tail feathers (trailing left/down) */}
        <path d="M 50 64 L 36 76 L 46 72 L 56 70 Z" opacity="0.9" />
      </g>
    </svg>
  );
}
