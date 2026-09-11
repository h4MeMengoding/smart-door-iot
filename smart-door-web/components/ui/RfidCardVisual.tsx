'use client';

import { Card as CardType } from '@/lib/types';

interface RfidCardVisualProps {
  card: CardType;
  index?: number;
  size?: 'sm' | 'md' | 'lg';
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '--/--';
  try {
    const d = new Date(dateStr);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${mm}/${yy}`;
  } catch {
    return '--/--';
  }
}

function uidToGroups(uid: string): string {
  const clean = uid.replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
  // Pad to at least 8 chars for visual display
  const padded = clean.padEnd(8, '0');
  // Format into groups of 4
  return padded.match(/.{1,4}/g)?.join('  ') || padded;
}

// Generate a consistent gradient based on card UID
function getCardGradient(uid: string, index: number = 0): { from: string; to: string; accent: string } {
  const palettes = [
    { from: '#1a1a2e', to: '#16213e', accent: 'rgba(191, 254, 1, 0.8)' },    // deep navy + lime
    { from: '#0f0f23', to: '#1b1b3a', accent: 'rgba(56, 160, 255, 0.8)' },    // midnight + blue
    { from: '#1a0a2e', to: '#2d1b4e', accent: 'rgba(168, 85, 247, 0.7)' },    // purple night
    { from: '#0a1628', to: '#132743', accent: 'rgba(34, 197, 94, 0.7)' },      // ocean + green
    { from: '#1e1e1e', to: '#2d2d2d', accent: 'rgba(245, 158, 11, 0.7)' },    // charcoal + amber
    { from: '#1a1a2e', to: '#0f2027', accent: 'rgba(236, 72, 153, 0.7)' },    // dark teal + pink
  ];

  // Hash the UID to pick a consistent palette
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = ((hash << 5) - hash) + uid.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash + index) % palettes.length;
  return palettes[idx];
}

export function RfidCardVisual({ card, index = 0, size = 'md' }: RfidCardVisualProps) {
  const palette = getCardGradient(card.uid, index);
  const nickname = card.nickname || 'Unnamed Card';
  const uidDisplay = uidToGroups(card.uid);
  const addedDate = formatDate(card.addedAt);

  // Sanitize UID for use as SVG element IDs (remove colons, spaces, special chars)
  const svgId = card.uid.replace(/[^a-zA-Z0-9]/g, '') + index;

  const sizeConfig = {
    sm: { width: 320, height: 202, uidSize: 14, nameSize: 11, labelSize: 8, chipW: 32, chipH: 24 },
    md: { width: 360, height: 227, uidSize: 15, nameSize: 12, labelSize: 8, chipW: 36, chipH: 28 },
    lg: { width: 420, height: 265, uidSize: 17, nameSize: 14, labelSize: 9, chipW: 42, chipH: 32 },
  };

  const cfg = sizeConfig[size];

  return (
    <div style={{ width: '100%', maxWidth: cfg.width }}>
      <svg
        viewBox={`0 0 ${cfg.width} ${cfg.height}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.35))',
          borderRadius: 16,
          overflow: 'visible',
        }}
      >
        <defs>
          {/* Card background gradient */}
          <linearGradient id={`cardGrad-${svgId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.from} />
            <stop offset="100%" stopColor={palette.to} />
          </linearGradient>

          {/* Glossy overlay */}
          <linearGradient id={`gloss-${svgId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.02)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>

          {/* Accent glow */}
          <radialGradient id={`glow-${svgId}`} cx="85%" cy="15%" r="50%">
            <stop offset="0%" stopColor={palette.accent} stopOpacity="0.3" />
            <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
          </radialGradient>

          {/* Bottom glow */}
          <radialGradient id={`glowBot-${svgId}`} cx="20%" cy="90%" r="60%">
            <stop offset="0%" stopColor={palette.accent} stopOpacity="0.12" />
            <stop offset="100%" stopColor={palette.accent} stopOpacity="0" />
          </radialGradient>

          <clipPath id={`cardClip-${svgId}`}>
            <rect width={cfg.width} height={cfg.height} rx="16" ry="16" />
          </clipPath>
        </defs>

        <g clipPath={`url(#cardClip-${svgId})`}>
          {/* Base card */}
          <rect width={cfg.width} height={cfg.height} rx="16" ry="16" fill={`url(#cardGrad-${svgId})`} />

          {/* Glossy overlay */}
          <rect width={cfg.width} height={cfg.height} rx="16" ry="16" fill={`url(#gloss-${svgId})`} />

          {/* Accent glow circles */}
          <rect width={cfg.width} height={cfg.height} fill={`url(#glow-${svgId})`} />
          <rect width={cfg.width} height={cfg.height} fill={`url(#glowBot-${svgId})`} />

          {/* Decorative circles */}
          <circle
            cx={cfg.width - 40}
            cy={50}
            r={size === 'sm' ? 50 : 70}
            fill="none"
            stroke={palette.accent}
            strokeWidth="0.5"
            opacity="0.25"
          />
          <circle
            cx={cfg.width - 25}
            cy={35}
            r={size === 'sm' ? 30 : 40}
            fill={palette.accent}
            opacity="0.06"
          />

          {/* Subtle grid pattern */}
          <line x1="0" y1={cfg.height * 0.45} x2={cfg.width} y2={cfg.height * 0.45} stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />

          {/* ── Chip Icon ── */}
          <g transform={`translate(${size === 'sm' ? 22 : 28}, ${size === 'sm' ? 28 : 35})`}>
            <rect
              width={cfg.chipW}
              height={cfg.chipH}
              rx="4"
              ry="4"
              fill="none"
              stroke="rgba(218, 195, 120, 0.7)"
              strokeWidth="1.2"
            />
            <rect
              x="2" y="2"
              width={cfg.chipW - 4}
              height={cfg.chipH - 4}
              rx="2.5"
              ry="2.5"
              fill="rgba(218, 195, 120, 0.15)"
            />
            {/* Chip lines */}
            <line x1={cfg.chipW / 2} y1="0" x2={cfg.chipW / 2} y2={cfg.chipH} stroke="rgba(218, 195, 120, 0.3)" strokeWidth="0.5" />
            <line x1="0" y1={cfg.chipH / 2} x2={cfg.chipW} y2={cfg.chipH / 2} stroke="rgba(218, 195, 120, 0.3)" strokeWidth="0.5" />
            <line x1={cfg.chipW * 0.3} y1="0" x2={cfg.chipW * 0.3} y2={cfg.chipH} stroke="rgba(218, 195, 120, 0.15)" strokeWidth="0.5" />
            <line x1={cfg.chipW * 0.7} y1="0" x2={cfg.chipW * 0.7} y2={cfg.chipH} stroke="rgba(218, 195, 120, 0.15)" strokeWidth="0.5" />
          </g>

          {/* ── Contactless / RFID icon ── */}
          <g transform={`translate(${size === 'sm' ? 60 : 76}, ${size === 'sm' ? 30 : 38})`} opacity="0.5">
            <path
              d="M0 12 C3 8, 3 4, 0 0"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="1.2"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M5 14 C9 9, 9 3, 5 -2"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="1.2"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M10 16 C15 10, 15 2, 10 -4"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1.2"
              fill="none"
              strokeLinecap="round"
            />
          </g>

          {/* ── Card UID (like credit card number) ── */}
          <text
            x={size === 'sm' ? 22 : 28}
            y={cfg.height * 0.55}
            fontFamily="'SF Mono', 'Fira Code', 'Courier New', monospace"
            fontSize={cfg.uidSize}
            fontWeight="500"
            fill="rgba(255, 255, 255, 0.85)"
            letterSpacing="2"
          >
            {uidDisplay}
          </text>

          {/* ── Bottom section ── */}
          {/* Card holder label */}
          <text
            x={size === 'sm' ? 22 : 28}
            y={cfg.height - (size === 'sm' ? 32 : 42)}
            fontFamily="'Rethink Sans', sans-serif"
            fontSize={cfg.labelSize}
            fontWeight="500"
            fill="rgba(255, 255, 255, 0.35)"
            letterSpacing="1.5"
          >
            CARD HOLDER
          </text>
          <text
            x={size === 'sm' ? 22 : 28}
            y={cfg.height - (size === 'sm' ? 18 : 24)}
            fontFamily="'Rethink Sans', sans-serif"
            fontSize={cfg.nameSize}
            fontWeight="600"
            fill="rgba(255, 255, 255, 0.9)"
            letterSpacing="0.5"
          >
            {nickname.length > 20 ? nickname.slice(0, 20) + '…' : nickname.toUpperCase()}
          </text>

          {/* Added date */}
          <text
            x={cfg.width - (size === 'sm' ? 55 : 70)}
            y={cfg.height - (size === 'sm' ? 32 : 42)}
            fontFamily="'Rethink Sans', sans-serif"
            fontSize={cfg.labelSize}
            fontWeight="500"
            fill="rgba(255, 255, 255, 0.35)"
            letterSpacing="1.5"
          >
            ADDED
          </text>
          <text
            x={cfg.width - (size === 'sm' ? 55 : 70)}
            y={cfg.height - (size === 'sm' ? 18 : 24)}
            fontFamily="'SF Mono', 'Fira Code', 'Courier New', monospace"
            fontSize={cfg.nameSize}
            fontWeight="500"
            fill="rgba(255, 255, 255, 0.75)"
          >
            {addedDate}
          </text>

          {/* ── RFID branding (top right) ── */}
          <text
            x={cfg.width - (size === 'sm' ? 22 : 28)}
            y={size === 'sm' ? 22 : 28}
            fontFamily="'Rethink Sans', sans-serif"
            fontSize={size === 'sm' ? 10 : 12}
            fontWeight="700"
            fill={palette.accent}
            textAnchor="end"
            letterSpacing="2"
            opacity="0.8"
          >
            RFID
          </text>

          {/* ── Smart Door label ── */}
          <text
            x={cfg.width - (size === 'sm' ? 22 : 28)}
            y={size === 'sm' ? 36 : 44}
            fontFamily="'Rethink Sans', sans-serif"
            fontSize={size === 'sm' ? 7 : 8}
            fontWeight="400"
            fill="rgba(255, 255, 255, 0.3)"
            textAnchor="end"
            letterSpacing="1"
          >
            SMART DOOR
          </text>

          {/* Card border highlight */}
          <rect
            width={cfg.width}
            height={cfg.height}
            rx="16"
            ry="16"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        </g>
      </svg>
    </div>
  );
}
