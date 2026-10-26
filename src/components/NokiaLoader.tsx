import React from 'react';

interface NokiaLoaderProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  color?: string;
  dotSize?: string;
}

export const NokiaLoader: React.FC<NokiaLoaderProps> = ({
  label,
  size = 'md',
  className = '',
  color = '#00B4FF',
  dotSize,
}) => {
  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2.5 h-2.5',
    lg: 'w-3.5 h-3.5',
  };

  const dotClass = dotSize || dotSizes[size];

  return (
    <div
      role="status"
      aria-label={label || 'Processing...'}
      className={`inline-flex flex-col items-center justify-center gap-2.5 select-none ${className}`}
    >
      {/* Nokia-style rhythmic knocking dots */}
      <div className="flex items-center gap-1.5">
        <span
          className={`${dotClass} rounded-full animate-nokia-bounce-1`}
          style={{ backgroundColor: color }}
        />
        <span
          className={`${dotClass} rounded-full animate-nokia-bounce-2`}
          style={{ backgroundColor: color }}
        />
        <span
          className={`${dotClass} rounded-full animate-nokia-bounce-3`}
          style={{ backgroundColor: color }}
        />
      </div>

      {label && (
        <span className="text-xs font-mono tracking-wider text-[#9bb1d6] animate-pulse">
          {label}
        </span>
      )}
    </div>
  );
};

export default NokiaLoader;
