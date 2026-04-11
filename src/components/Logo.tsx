'use client';

/**
 * GIO RAPTOR Logo — SVG version derived from brand logo.
 * Raptor bird icon with teal/cyan gradient.
 * "GIO" in brand cyan, "RAPTOR" toggles black/white based on theme.
 *
 * Props:
 *  - height: logo height in px (default 32)
 *  - iconOnly: show only the raptor bird icon
 *  - className: additional CSS classes
 *  - theme: 'dark' | 'light' — controls RAPTOR text color
 */

interface LogoProps {
  height?: number;
  iconOnly?: boolean;
  className?: string;
  theme?: 'dark' | 'light';
}

export default function Logo({ height = 32, iconOnly = false, className = '', theme = 'dark' }: LogoProps) {
  // The RAPTOR text color toggles: white on dark bg, black on light bg
  const raptorColor = theme === 'dark' ? '#C0C4CC' : '#3A3A3A';
  const gioColor = '#00B4D8'; // brand cyan from logo

  // Aspect ratio from original: roughly 4.24:1 for full logo, 1:1 for icon
  const iconH = height;
  const iconW = iconH * 1.1; // bird icon is slightly wider than tall
  const fullW = iconOnly ? iconW : height * 4.5;

  if (iconOnly) {
    return (
      <svg
        width={iconW}
        height={iconH}
        viewBox="0 0 120 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <defs>
          <linearGradient id="raptorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00D4AA" />
            <stop offset="35%" stopColor="#00B4D8" />
            <stop offset="70%" stopColor="#0091B3" />
            <stop offset="100%" stopColor="#007A8C" />
          </linearGradient>
        </defs>
        {/* Left wing */}
        <polygon points="8,42 55,8 50,48" fill="url(#raptorGrad)" opacity="0.85" />
        <polygon points="15,48 52,22 48,52" fill="url(#raptorGrad)" opacity="0.7" />
        <polygon points="22,54 50,35 46,56" fill="url(#raptorGrad)" opacity="0.55" />
        {/* Right wing */}
        <polygon points="112,42 65,8 70,48" fill="url(#raptorGrad)" opacity="0.85" />
        <polygon points="105,48 68,22 72,52" fill="url(#raptorGrad)" opacity="0.7" />
        <polygon points="98,54 70,35 74,56" fill="url(#raptorGrad)" opacity="0.55" />
        {/* Diamond body */}
        <polygon points="60,50 45,72 60,100 75,72" fill="url(#raptorGrad)" strokeWidth="1.5" stroke="url(#raptorGrad)" opacity="0.9" />
        {/* Inner diamond cutout */}
        <polygon points="60,62 51,74 60,90 69,74" fill="none" stroke="url(#raptorGrad)" strokeWidth="2" opacity="0.6" />
      </svg>
    );
  }

  return (
    <div className={`flex items-center gap-1 ${className}`} style={{ height }}>
      {/* Bird icon */}
      <svg
        width={iconW}
        height={iconH}
        viewBox="0 0 120 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="raptorGradFull" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00D4AA" />
            <stop offset="35%" stopColor="#00B4D8" />
            <stop offset="70%" stopColor="#0091B3" />
            <stop offset="100%" stopColor="#007A8C" />
          </linearGradient>
        </defs>
        {/* Left wing */}
        <polygon points="8,42 55,8 50,48" fill="url(#raptorGradFull)" opacity="0.85" />
        <polygon points="15,48 52,22 48,52" fill="url(#raptorGradFull)" opacity="0.7" />
        <polygon points="22,54 50,35 46,56" fill="url(#raptorGradFull)" opacity="0.55" />
        {/* Right wing */}
        <polygon points="112,42 65,8 70,48" fill="url(#raptorGradFull)" opacity="0.85" />
        <polygon points="105,48 68,22 72,52" fill="url(#raptorGradFull)" opacity="0.7" />
        <polygon points="98,54 70,35 74,56" fill="url(#raptorGradFull)" opacity="0.55" />
        {/* Diamond body */}
        <polygon points="60,50 45,72 60,100 75,72" fill="url(#raptorGradFull)" opacity="0.9" />
        {/* Inner diamond cutout */}
        <polygon points="60,62 51,74 60,90 69,74" fill="none" stroke="url(#raptorGradFull)" strokeWidth="2" opacity="0.6" />
      </svg>
      {/* Text */}
      <div className="flex items-baseline gap-0.5" style={{ fontFamily: 'var(--font-inter, Inter), sans-serif' }}>
        <span
          style={{
            fontSize: height * 0.55,
            fontWeight: 600,
            letterSpacing: '0.02em',
            color: gioColor,
            lineHeight: 1,
          }}
        >
          GIO
        </span>
        <span
          style={{
            fontSize: height * 0.55,
            fontWeight: 300,
            letterSpacing: '0.12em',
            color: raptorColor,
            lineHeight: 1,
          }}
        >
          {' '}RAPTOR
        </span>
      </div>
    </div>
  );
}
