'use client';

import React from 'react';

interface MaterialIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name?: string;
  icon?: string;
  children?: React.ReactNode;
  size?: number | string;
  fill?: boolean;
}

export default function MaterialIcon({
  name,
  icon,
  children,
  size,
  fill,
  className = '',
  style,
  ...props
}: MaterialIconProps) {
  const iconName = name || icon || children;
  const computedStyle: React.CSSProperties = {
    ...(size ? { fontSize: typeof size === 'number' ? `${size}px` : size } : {}),
    ...(fill ? { fontVariationSettings: "'FILL' 1" } : {}),
    ...style,
  };

  return (
    <span
      className={`material-symbols-outlined ${className}`.trim()}
      style={computedStyle}
      {...props}
    >
      {iconName}
    </span>
  );
}
