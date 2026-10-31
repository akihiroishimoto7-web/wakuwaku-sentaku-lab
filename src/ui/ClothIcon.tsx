import { CLOTH_MAP, type ClothId } from '../data'

// 衣服カードのアイコン（3Dの形と同じシルエット）
export function ClothIcon({ id }: { id: ClothId }) {
  const c = CLOTH_MAP[id].color
  const stroke = 'rgba(0,0,0,0.12)'
  switch (id) {
    case 'shirt':
      return (
        <svg viewBox="0 0 64 64" aria-hidden>
          <path d="M22 8 L14 12 L4 24 L12 31 L18 25 L18 58 L46 58 L46 25 L52 31 L60 24 L50 12 L42 8 Q32 16 22 8 Z" fill={c} stroke={stroke} strokeWidth="2" />
          <circle cx="32" cy="34" r="5" fill="#fff3a0" />
        </svg>
      )
    case 'socks':
      return (
        <svg viewBox="0 0 64 64" aria-hidden>
          <path d="M22 6 H38 V36 L50 44 Q58 50 52 57 Q47 62 38 58 L22 48 Q18 46 18 40 V6 Z" fill={c} stroke={stroke} strokeWidth="2" />
          <rect x="20" y="10" width="18" height="5" fill="#fff" />
        </svg>
      )
    case 'towel':
      return (
        <svg viewBox="0 0 64 64" aria-hidden>
          <rect x="4" y="14" width="56" height="38" rx="5" fill={c} stroke={stroke} strokeWidth="2" />
          <rect x="10" y="14" width="4" height="38" fill="#fff" />
          <rect x="50" y="14" width="4" height="38" fill="#fff" />
        </svg>
      )
    case 'pants':
      return (
        <svg viewBox="0 0 64 64" aria-hidden>
          <path d="M14 6 H50 L54 58 H36 L32 26 L28 58 H10 Z" fill={c} stroke={stroke} strokeWidth="2" />
          <rect x="14" y="6" width="36" height="7" fill="rgba(0,0,0,0.15)" />
        </svg>
      )
    case 'teddy':
      return (
        <svg viewBox="0 0 64 64" aria-hidden>
          <circle cx="20" cy="12" r="6" fill={c} />
          <circle cx="44" cy="12" r="6" fill={c} />
          <ellipse cx="32" cy="44" rx="16" ry="17" fill={c} />
          <circle cx="32" cy="22" r="13" fill={c} />
          <circle cx="27" cy="20" r="2" fill="#2b1d14" />
          <circle cx="37" cy="20" r="2" fill="#2b1d14" />
          <ellipse cx="32" cy="27" rx="5" ry="4" fill="#f0d0a8" />
          <circle cx="32" cy="26" r="1.8" fill="#2b1d14" />
        </svg>
      )
  }
}
