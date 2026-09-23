import React from 'react';

export interface PhivonexSymbolProps {
  size?: number | string;
  className?: string;
  variant?: 'color' | 'white' | 'light';
  animated?: boolean;
  glow?: boolean;
}

export const PhivonexSymbol: React.FC<PhivonexSymbolProps> = ({
  size = 36,
  className = '',
  variant = 'color',
  animated = true,
  glow = true,
}) => {
  const isWhite = variant === 'white';
  const isLight = variant === 'light';

  const uid = React.useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 320 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-label="PHIVONEX Network Symbol"
    >
      <defs>
        {/* Ambient Light Halo */}
        <radialGradient id={`aura-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00CFFF" stopOpacity={glow ? 0.35 : 0} />
          <stop offset="55%" stopColor="#168BFF" stopOpacity={glow ? 0.12 : 0} />
          <stop offset="100%" stopColor="#7057FF" stopOpacity="0" />
        </radialGradient>

        {/* Top Outer Ribbon */}
        <linearGradient id={`topRibbon-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={isLight ? '#00CFFF' : '#80EAFF'} />
          <stop offset="35%" stopColor="#00CFFF" />
          <stop offset="80%" stopColor="#168BFF" />
          <stop offset="100%" stopColor="#1760E8" />
        </linearGradient>

        {/* Top Right Bevel */}
        <linearGradient id={`rightBevel-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00CFFF" />
          <stop offset="40%" stopColor="#168BFF" />
          <stop offset="100%" stopColor="#0D47A1" />
        </linearGradient>

        {/* Vertical Stem / Left Pillar */}
        <linearGradient id={`stem-${uid}`} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#7057FF" />
          <stop offset="35%" stopColor="#4F46E5" />
          <stop offset="70%" stopColor="#168BFF" />
          <stop offset="100%" stopColor="#00CFFF" />
        </linearGradient>

        {/* Left Inner Wing */}
        <linearGradient id={`leftInner-${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#6366F1" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#00CFFF" stopOpacity="0.4" />
        </linearGradient>

        {/* Inner Return Fold Ribbon */}
        <linearGradient id={`innerReturn-${uid}`} x1="100%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#00CFFF" />
          <stop offset="45%" stopColor="#168BFF" />
          <stop offset="85%" stopColor="#0A1E4A" />
          <stop offset="100%" stopColor="#060E24" />
        </linearGradient>

        {/* Inner Cavity Back Wall */}
        <linearGradient id={`backdrop-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#09142E" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#050A18" stopOpacity="0.8" />
        </linearGradient>

        {/* Node Glow Filter */}
        <filter id={`nodeGlow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ambient Aura */}
      {!isWhite && <circle cx="160" cy="155" r="130" fill={`url(#aura-${uid})`} />}

      {/* 1. Back Depth Cavity */}
      <path
        d="M 126 96 L 196 66 L 246 112 L 246 172 L 204 208 L 132 168 Z"
        fill={isWhite ? 'rgba(255,255,255,0.12)' : `url(#backdrop-${uid})`}
      />

      {/* 2. Constellation Network Interior Lines */}
      <g
        stroke={isWhite ? '#FFFFFF' : '#00CFFF'}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={isWhite ? 0.6 : 0.85}
      >
        <line x1="124" y1="142" x2="164" y2="114" />
        <line x1="164" y1="114" x2="208" y2="182" />
        <line x1="124" y1="142" x2="208" y2="182" />
        <line x1="124" y1="142" x2="108" y2="204" strokeOpacity="0.4" strokeDasharray="2 3" />
        <line x1="164" y1="114" x2="228" y2="118" strokeOpacity="0.4" strokeDasharray="2 3" />
        <line x1="208" y1="182" x2="152" y2="236" strokeOpacity="0.4" strokeDasharray="2 3" />
      </g>

      {/* 3. Left Stem & Facets */}
      <path
        d="M 88 126 L 126 96 L 126 238 L 88 206 Z"
        fill={isWhite ? 'rgba(255,255,255,0.4)' : `url(#leftInner-${uid})`}
        opacity={isWhite ? 1 : 0.85}
      />
      <path
        d="M 88 126 L 126 96 L 126 142 L 108 204 L 88 206 Z"
        fill={isWhite ? 'rgba(255,255,255,0.75)' : `url(#stem-${uid})`}
      />
      <path
        d="M 108 142 L 132 168 L 132 238 L 108 204 Z"
        fill={isWhite ? 'rgba(255,255,255,0.9)' : `url(#stem-${uid})`}
      />

      {/* 4. Top Hexagonal Arch Ribbon */}
      <path
        d="M 88 126 L 160 62 L 196 66 L 126 96 Z"
        fill={isWhite ? '#FFFFFF' : `url(#topRibbon-${uid})`}
      />
      <path
        d="M 160 62 L 232 94 L 196 66 Z"
        fill={isWhite ? 'rgba(255,255,255,0.85)' : `url(#topRibbon-${uid})`}
      />
      <path
        d="M 232 94 L 254 118 L 246 112 L 196 66 Z"
        fill={isWhite ? 'rgba(255,255,255,0.65)' : `url(#rightBevel-${uid})`}
      />

      {/* 5. Right Outer & Return Ribbon */}
      <path
        d="M 254 118 L 254 168 L 246 172 L 246 112 Z"
        fill={isWhite ? 'rgba(255,255,255,0.5)' : `url(#rightBevel-${uid})`}
      />
      <path
        d="M 254 168 L 216 204 L 204 208 L 246 172 Z"
        fill={isWhite ? 'rgba(255,255,255,0.7)' : `url(#innerReturn-${uid})`}
      />
      <path
        d="M 216 204 L 152 236 L 132 238 L 204 208 Z"
        fill={isWhite ? 'rgba(255,255,255,0.8)' : `url(#innerReturn-${uid})`}
      />
      <path
        d="M 152 236 L 152 202 L 132 168 L 132 238 Z"
        fill={isWhite ? '#FFFFFF' : `url(#topRibbon-${uid})`}
      />

      {/* 6. Specular Rim Highlight */}
      <path
        d="M 88 126 L 160 62 L 232 94 L 254 118"
        stroke={isWhite ? '#FFFFFF' : '#FFFFFF'}
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity={isWhite ? 1 : 0.9}
      />
      <path
        d="M 88 126 L 88 206"
        stroke={isWhite ? '#FFFFFF' : '#80EAFF'}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity={isWhite ? 0.8 : 0.75}
      />
      <path
        d="M 132 238 L 152 236 L 216 204"
        stroke={isWhite ? '#FFFFFF' : '#80EAFF'}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity={isWhite ? 0.9 : 0.85}
      />

      {/* 7. Three Luminous Connected Constellation Nodes */}
      {/* Node 1: Left Node */}
      <g
        transform="translate(124, 142)"
        filter={isWhite ? undefined : `url(#nodeGlow-${uid})`}
        className={animated ? 'animate-subtle-pulse' : ''}
        style={{ transformOrigin: '124px 142px' }}
      >
        <circle cx="0" cy="0" r="10" fill={isWhite ? 'rgba(255,255,255,0.3)' : '#00CFFF'} fillOpacity={isWhite ? 0.3 : 0.35} />
        <circle cx="0" cy="0" r="7" fill={isWhite ? '#FFFFFF' : '#168BFF'} />
        <circle cx="0" cy="0" r="5" fill={isWhite ? '#FFFFFF' : '#80EAFF'} />
        <circle cx="-1.5" cy="-1.5" r="2" fill="#FFFFFF" />
      </g>

      {/* Node 2: Top-Right Node */}
      <g
        transform="translate(164, 114)"
        filter={isWhite ? undefined : `url(#nodeGlow-${uid})`}
        className={animated ? 'animate-subtle-pulse' : ''}
        style={{ transformOrigin: '164px 114px', animationDelay: '0.6s' }}
      >
        <circle cx="0" cy="0" r="11" fill={isWhite ? 'rgba(255,255,255,0.3)' : '#00CFFF'} fillOpacity={isWhite ? 0.3 : 0.35} />
        <circle cx="0" cy="0" r="7.5" fill={isWhite ? '#FFFFFF' : '#168BFF'} />
        <circle cx="0" cy="0" r="5.5" fill={isWhite ? '#FFFFFF' : '#80EAFF'} />
        <circle cx="-1.5" cy="-1.5" r="2.2" fill="#FFFFFF" />
      </g>

      {/* Node 3: Bottom-Right Node */}
      <g
        transform="translate(208, 182)"
        filter={isWhite ? undefined : `url(#nodeGlow-${uid})`}
        className={animated ? 'animate-subtle-pulse' : ''}
        style={{ transformOrigin: '208px 182px', animationDelay: '1.2s' }}
      >
        <circle cx="0" cy="0" r="12" fill={isWhite ? 'rgba(255,255,255,0.3)' : '#00CFFF'} fillOpacity={isWhite ? 0.3 : 0.4} />
        <circle cx="0" cy="0" r="8.5" fill={isWhite ? '#FFFFFF' : '#168BFF'} />
        <circle cx="0" cy="0" r="6" fill={isWhite ? '#FFFFFF' : '#80EAFF'} />
        <circle cx="-2" cy="-2" r="2.5" fill="#FFFFFF" />
      </g>

      {/* Ground Specular Flare */}
      {!isWhite && (
        <ellipse
          cx="160"
          cy="274"
          rx="38"
          ry="3.5"
          fill="#00CFFF"
          fillOpacity="0.4"
          filter={`url(#nodeGlow-${uid})`}
        />
      )}
    </svg>
  );
};
