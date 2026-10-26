import React from 'react';

interface MindlyLogoProps {
  className?: string;
  size?: number | string;
  color?: string;
  withContainer?: boolean;
}

export const MindlyLogo: React.FC<MindlyLogoProps> = ({
  className = '',
  size = 28,
  color = '#00B4FF',
  withContainer = false,
}) => {
  const svg = (
    <svg
      viewBox="0 0 1000 1000"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Mindly Logo"
    >
      <defs>
        <style>{`
          .mindly-path {
            stroke: ${color};
            stroke-width: 96px;
            stroke-linecap: round;
            stroke-linejoin: round;
            fill: none;
          }
        `}</style>
      </defs>

      {/* Outer Left Arch */}
      <path
        className="mindly-path"
        d="M 124 760 L 124 380 C 124 230, 240 180, 360 210 C 440 230, 480 300, 480 390"
      />

      {/* Inner stem flowing up into central droplet loop and right arch */}
      <path
        className="mindly-path"
        d="M 276 760 L 276 430 C 276 340, 340 300, 400 300 C 490 300, 580 230, 640 180 C 720 120, 800 190, 770 290 C 740 380, 620 460, 530 570 C 470 640, 450 720, 500 760 C 560 800, 630 750, 660 670 C 690 590, 710 440, 760 360 C 800 290, 876 360, 876 460 L 876 760"
      />
    </svg>
  );

  if (withContainer) {
    return (
      <div className="w-9 h-9 rounded-xl bg-[#00B4FF]/15 border border-[#00B4FF]/30 flex items-center justify-center text-[#00B4FF] shrink-0 shadow-inner">
        {svg}
      </div>
    );
  }

  return svg;
};
