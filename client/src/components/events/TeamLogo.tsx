import React from 'react';

interface TeamLogoProps {
  name?: string;
  shortName?: string;
  logoUrl?: string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Aesthetic Team Logo component.
 * - Slightly rectangular badge with rounded corners
 * - Dark sleek glassmorphic container with crisp subtle border
 * - Aesthetic colorful gradient text for the team abbreviation/acronym (e.g. "MATH")
 * - If a custom image logoUrl is provided, it renders the image neatly fitted
 */
export function TeamLogo({
  name,
  shortName,
  logoUrl,
  className = '',
  size = 'md',
}: TeamLogoProps) {
  if (logoUrl) {
    const sizeClasses = {
      sm: 'w-8 h-7 rounded-lg',
      md: 'w-11 h-9 rounded-xl',
      lg: 'w-14 h-11 rounded-xl',
      xl: 'w-20 h-16 rounded-2xl',
    }[size];

    return (
      <div className={`relative shrink-0 overflow-hidden border border-border-strong/80 shadow-xs bg-card ${sizeClasses} ${className}`}>
        <img
          src={logoUrl}
          alt={name || shortName || 'Team Logo'}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Derive display acronym
  const rawText = (shortName || name || 'TEAM').trim();
  // Keep up to 4-5 chars for aesthetic proportions
  const acronym = (shortName || (rawText.length <= 4 ? rawText : rawText.substring(0, 4))).toUpperCase();

  // Pick vibrant, aesthetic modern gradient based on team text seed
  const gradients = [
    'from-chart-1 to-chart-2',
    'from-chart-2 to-chart-4',
    'from-chart-3 to-chart-5',
    'from-chart-4 to-chart-6',
    'from-chart-5 to-chart-1',
    'from-chart-6 to-chart-3',
    'from-chart-1 to-chart-6',
    'from-chart-3 to-chart-4',
  ];

  let hash = 0;
  for (let i = 0; i < acronym.length; i++) {
    hash = acronym.charCodeAt(i) + ((hash << 5) - hash);
  }
  const gradient = gradients[Math.abs(hash) % gradients.length];

  const sizeStyles = {
    sm: {
      box: 'px-2 py-1 min-w-[34px] h-7 rounded-lg text-[10px] tracking-wide',
    },
    md: {
      box: 'px-3 py-1.5 min-w-[46px] h-9 rounded-xl text-xs tracking-wider',
    },
    lg: {
      box: 'px-4 py-2 min-w-[58px] h-11 rounded-xl text-sm tracking-widest',
    },
    xl: {
      box: 'px-6 py-3 min-w-[76px] h-14 rounded-2xl text-lg tracking-widest',
    },
  }[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 border border-border bg-gradient-to-b from-card/95 via-card to-background text-foreground font-black shadow-md shadow-media/40 select-none overflow-hidden ${sizeStyles.box} ${className}`}
      title={name || acronym}
    >
      {/* Subtle top sheen highlight */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-foreground/25 to-transparent pointer-events-none" />

      {/* Colorful Gradient Typography */}
      <span
        className={`bg-gradient-to-r ${gradient} bg-clip-text text-transparent font-black drop-shadow-sm whitespace-nowrap`}
      >
        {acronym}
      </span>
    </div>
  );
}
