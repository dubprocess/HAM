import React from 'react';

const AppleLogo = ({ size = 18, color, rainbow = true, ...props }) => {
  // Generate a unique ID for gradient to avoid SVG conflicts when multiple logos render
  const gradientId = `apple-rainbow-${Math.random().toString(36).substr(2, 6)}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color || (rainbow ? `url(#${gradientId})` : 'currentColor')}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {rainbow && !color && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#61BB46" />
            <stop offset="20%" stopColor="#FDB827" />
            <stop offset="40%" stopColor="#F5821F" />
            <stop offset="60%" stopColor="#E03A3E" />
            <stop offset="80%" stopColor="#963D97" />
            <stop offset="100%" stopColor="#009DDC" />
          </linearGradient>
        </defs>
      )}
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
};

export default AppleLogo;
