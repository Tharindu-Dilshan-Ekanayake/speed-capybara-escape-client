import { memo } from 'react'
/** Inline SVG icons drawn in the chunky Roblox-sim style (thick dark outlines). */

const S = { stroke: '#1a1030', strokeWidth: 5, strokeLinejoin: 'round', strokeLinecap: 'round' }

const TrophySvg = ({ size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <defs>
      <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff3a0" />
        <stop offset="0.5" stopColor="#ffcf2a" />
        <stop offset="1" stopColor="#f08a00" />
      </linearGradient>
    </defs>
    <path d="M22 18h56v16c0 20-12 32-28 34C34 66 22 54 22 34z" fill="url(#tg)" {...S} />
    <path d="M22 26H10c0 14 8 22 18 22M78 26h12c0 14-8 22-18 22" fill="none" {...S} />
    <path d="M42 66h16v12H42z" fill="url(#tg)" {...S} />
    <path d="M30 80h40v10H30z" fill="#f0a000" {...S} />
    <path d="M34 26c0 12 4 22 12 26" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.8" />
  </svg>
)

/** Grey medallion with a red (top) and white (bottom) arrow chasing each other round. */
const RebirthSvg = ({ size = 56 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="42" fill="#8d96a3" stroke="#1a1030" strokeWidth="5" />
    <circle cx="50" cy="50" r="33" fill="#6c7480" />
    <g transform="rotate(-25 50 50)">
      {/* Red arc over the top, arrowhead on the right. */}
      <path d="M22 50a28 28 0 0 1 52-14" fill="none" stroke="#1a1030" strokeWidth="17" strokeLinecap="round" />
      <path d="M22 50a28 28 0 0 1 52-14" fill="none" stroke="#e8354a" strokeWidth="10" strokeLinecap="round" />
      <path d="M86 30l-6 24-20-14z" fill="#e8354a" stroke="#1a1030" strokeWidth="4" strokeLinejoin="round" />
      {/* White arc under the bottom, arrowhead on the left. */}
      <path d="M78 50a28 28 0 0 1-52 14" fill="none" stroke="#1a1030" strokeWidth="17" strokeLinecap="round" />
      <path d="M78 50a28 28 0 0 1-52 14" fill="none" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" />
      <path d="M14 70l6-24 20 14z" fill="#ffffff" stroke="#1a1030" strokeWidth="4" strokeLinejoin="round" />
    </g>
    <path d="M30 28a30 30 0 0 1 20-8" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="4" strokeLinecap="round" />
  </svg>
)

const GearSvg = ({ size = 56 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path
      d="M43 8h14l3 12 9 4 11-6 10 10-6 11 4 9 12 3v14l-12 3-4 9 6 11-10 10-11-6-9 4-3 12H43l-3-12-9-4-11 6-10-10 6-11-4-9-12-3V43l12-3 4-9-6-11 10-10 11 6 9-4z"
      fill="#dfe6f0"
      {...S}
    />
    <circle cx="50" cy="50" r="14" fill="#4a5568" {...S} />
  </svg>
)

const GiftSvg = ({ size = 56 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d="M14 40h72v50H14z" fill="#2fd5ff" {...S} />
    <path d="M10 28h80v16H10z" fill="#ff3a6a" {...S} />
    <path d="M44 28h12v62H44z" fill="#ff3a6a" {...S} />
    <path d="M50 28c-8-18-28-16-22-4 4 6 22 4 22 4zM50 28c8-18 28-16 22-4-4 6-22 4-22 4z" fill="#ff3a6a" {...S} />
  </svg>
)

const PeopleSvg = ({ size = 56 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <rect x="44" y="34" width="44" height="40" rx="12" fill="#ffcf2a" {...S} />
    <rect x="12" y="26" width="48" height="46" rx="14" fill="#ffe14a" {...S} />
    <circle cx="28" cy="46" r="4" fill="#1a1030" />
    <circle cx="44" cy="46" r="4" fill="#1a1030" />
    <path d="M26 58q10 8 20 0" fill="none" {...S} strokeWidth="4" />
    <path d="M12 74h48v16H12zM44 76h44v14H44z" fill="#2a7bff" {...S} />
  </svg>
)

const DuckIconSvg = ({ size = 56, body = '#ffd21a', beak = '#ff8a1a', glow }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={glow ? { filter: `drop-shadow(0 0 6px ${glow})` } : undefined}>
    <ellipse cx="46" cy="64" rx="36" ry="24" fill={body} {...S} />
    <circle cx="64" cy="34" r="20" fill={body} {...S} />
    <path d="M80 34q16 2 14 9-9 4-17-2z" fill={beak} {...S} strokeWidth="4" />
    <circle cx="68" cy="30" r="4.5" fill="#111" />
    <circle cx="69.5" cy="28.5" r="1.5" fill="#fff" />
    <path d="M22 60q10 12 26 6" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="5" strokeLinecap="round" />
  </svg>
)

const MapIconSvg = ({ size = 56 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d="M10 22l26-10 28 10 26-10v66l-26 10-28-10-26 10z" fill="#7dff8a" {...S} />
    <path d="M36 12v66M64 22v66" {...S} fill="none" />
    <path d="M22 50l10-8 12 10 12-14 10 8 12-6" fill="none" stroke="#ff3a6a" strokeWidth="5" strokeDasharray="6 5" strokeLinecap="round" />
  </svg>
)

const WheelIconSvg = ({ size = 56 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    {['#ff3a3a', '#ffd21a', '#3dff5a', '#29c8ff', '#b46bff', '#ff8a1a'].map((c, i) => {
      const a0 = (i / 6) * Math.PI * 2
      const a1 = ((i + 1) / 6) * Math.PI * 2
      return <path key={c} d={`M50 50L${50 + 42 * Math.cos(a0)} ${50 + 42 * Math.sin(a0)}A42 42 0 0 1 ${50 + 42 * Math.cos(a1)} ${50 + 42 * Math.sin(a1)}z`} fill={c} />
    })}
    <circle cx="50" cy="50" r="42" fill="none" {...S} />
    <circle cx="50" cy="50" r="8" fill="#fff" {...S} strokeWidth="4" />
  </svg>
)

const SneakerSvg = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d="M10 58c0-10 6-30 22-30 8 10 14 12 26 14 18 2 32 8 32 22v8H10z" fill="#ff3a4a" {...S} />
    <path d="M10 72h80v10H10z" fill="#fff" {...S} />
    <path d="M36 40l8 6M44 36l8 6" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
  </svg>
)

const BoltSvg = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d="M58 6L18 56h26l-8 38 46-54H54z" fill="#ffe14a" {...S} />
  </svg>
)

const CloseXSvg = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d="M22 22l56 56M78 22L22 78" stroke="#fff" strokeWidth="16" strokeLinecap="round" />
  </svg>
)

const LockSvg = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d="M30 44V32a20 20 0 0 1 40 0v12" fill="none" {...S} strokeWidth="9" />
    <rect x="20" y="44" width="60" height="44" rx="10" fill="#ffd21a" {...S} />
  </svg>
)

// Memoised: the HUD re-renders often and these SVGs never change for the same props.
export const Trophy = memo(TrophySvg)
export const Rebirth = memo(RebirthSvg)
export const Gear = memo(GearSvg)
export const Gift = memo(GiftSvg)
export const People = memo(PeopleSvg)
export const DuckIcon = memo(DuckIconSvg)
export const MapIcon = memo(MapIconSvg)
export const WheelIcon = memo(WheelIconSvg)
export const Sneaker = memo(SneakerSvg)
export const Bolt = memo(BoltSvg)
export const CloseX = memo(CloseXSvg)
export const Lock = memo(LockSvg)
