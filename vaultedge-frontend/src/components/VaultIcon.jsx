import React from 'react';

// Simple vault / safe SVG. Variants: 'title' (large), 'root' (gold), 'child' (gray)
export default function VaultIcon({ size = 18, className = '', variant = 'child' }) {
  const stroke = '#374151'; // unified dark gray
  const fill = variant === 'root' ? 'none' : 'none';
  const wheelFill = '#111827';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={variant === 'root' ? 'Root Vault' : 'Vault'}
    >
  {/* Unified dark gray style for all variants (root no longer gold) */}
  <rect x="2" y="2" width="20" height="20" rx="1" stroke={stroke} strokeWidth="1.5" fill={fill} />
  <rect x="6" y="6" width="12" height="12" stroke={stroke} strokeWidth="1.2" fill="none" />
  <rect x="3.5" y="7" width="1.6" height="3" rx="0.3" fill={stroke} />
  <rect x="3.5" y="12" width="1.6" height="3" rx="0.3" fill={stroke} />
  <circle cx="14.5" cy="10.5" r="2" fill={wheelFill} />
  <circle cx="14.5" cy="10.5" r="0.6" fill="#fff" />
  <path d="M14.5 8.3v-1M14.5 12.7v1M12.3 10.5h-1M16.7 10.5h1" stroke="#9CA3AF" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  );
}
