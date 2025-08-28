import React from 'react';

// Distinct icon for Safe-Deposit Box items
export default function SafeBoxIcon({ size = 20, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Safe-Deposit Box"
    >
      <rect x="2.5" y="5" width="19" height="14" rx="2" stroke="#374151" strokeWidth="1.6" fill="#F8FAFC" />
      <rect x="5" y="8" width="13" height="8" rx="1" stroke="#374151" strokeWidth="1.2" />
      <circle cx="15.5" cy="12" r="2.1" fill="#374151" />
      <circle cx="15.5" cy="12" r="0.7" fill="#fff" />
      <path d="M15.5 10.1v-1M15.5 14v1M13.6 12h-1M18.4 12h1" stroke="#9CA3AF" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M7 5V3.5M17 5V3.5M7 19v1.5M17 19v1.5" stroke="#374151" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
