import React, { useState } from 'react';
import {
  BookOpen,
  Code,
  Brain,
  FlaskConical,
  Binary,
  TrendingUp,
  Landmark,
  Palette,
  GraduationCap,
  Sparkles,
  Cpu,
  Globe,
  Music,
} from 'lucide-react';
import { getEducationalPhotoUrl } from '../lib/educationalMedia';

interface CourseThumbnailProps {
  title: string;
  category?: string;
  coverImage?: string;
  coverIcon?: string;
  className?: string;
  alt?: string;
}

function getCategoryIcon(category = '', title = '') {
  const combined = `${category} ${title}`.toLowerCase();

  if (/code|software|programming|developer|web|python|javascript|typescript|react/.test(combined)) {
    return Code;
  }
  if (/ai|robotics|machine learning|deep learning|data|algorithm|cpu|neural/.test(combined)) {
    return Cpu;
  }
  if (/science|physics|chemistry|biology|quantum|genetics|biotech|lab/.test(combined)) {
    return FlaskConical;
  }
  if (/psychology|neuroscience|brain|cognition|mind|memory|learning/.test(combined)) {
    return Brain;
  }
  if (/math|statistics|algebra|calculus|geometry|probability|binary/.test(combined)) {
    return Binary;
  }
  if (/finance|business|economics|trading|marketing|strategy|management/.test(combined)) {
    return TrendingUp;
  }
  if (/history|philosophy|politics|law|geopolitics|culture/.test(combined)) {
    return Landmark;
  }
  if (/design|art|visual|creative|typography|ux/.test(combined)) {
    return Palette;
  }
  if (/music|audio|sound|song/.test(combined)) {
    return Music;
  }
  if (/world|global|geography|earth|language|spanish|french/.test(combined)) {
    return Globe;
  }

  return BookOpen;
}

export const CourseThumbnail: React.FC<CourseThumbnailProps> = ({
  title,
  category = 'Curriculum',
  coverImage,
  coverIcon,
  className = 'w-full h-full object-cover',
  alt,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Determine best candidate image URL
  const candidateUrl = coverImage || getEducationalPhotoUrl(title, category);
  const IconComponent = getCategoryIcon(category, title);

  // If image loading has failed or candidate URL is empty, render designed Mindly fallback
  if (imgFailed || !candidateUrl) {
    return (
      <div className="w-full h-full relative overflow-hidden bg-gradient-to-br from-[#0e305e] via-[#092244] to-[#05142b] flex flex-col items-center justify-center p-2 text-center select-none border-r border-[#00B8F4]/20">
        {/* Subtle geometric background glow */}
        <div className="absolute -top-6 -right-6 w-16 h-16 rounded-full bg-[#00B8F4]/10 blur-md pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-16 h-16 rounded-full bg-[#1E60FF]/15 blur-md pointer-events-none" />

        <div className="relative z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#00B8F4]/15 border border-[#00B8F4]/30 flex items-center justify-center text-[#00B8F4] shadow-sm mb-1.5 transition-transform duration-300 group-hover:scale-110">
          <IconComponent className="w-5 h-5 stroke-[2.2]" />
        </div>

        <span className="relative z-10 text-[10px] font-bold text-white/80 uppercase tracking-wider truncate max-w-[90%]">
          {category || 'Curriculum'}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#071d3a]">
      {/* Background placeholder while image loads */}
      {!imgLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0e305e] via-[#092244] to-[#05142b] flex flex-col items-center justify-center p-2">
          <div className="w-8 h-8 rounded-lg bg-[#00B8F4]/10 flex items-center justify-center text-[#00B8F4] animate-pulse">
            <IconComponent className="w-4 h-4" />
          </div>
        </div>
      )}

      <img
        src={candidateUrl}
        alt={alt || title}
        className={`${className} transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        onLoad={() => setImgLoaded(true)}
        onError={() => setImgFailed(true)}
      />
    </div>
  );
};
