import React, { useState } from 'react';
import { Download, Share2, X, Smartphone, CheckCircle } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'button' | 'sidebar' | 'banner' | 'header';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'sidebar',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed or neither installable nor iOS, suppress
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      {variant === 'header' && (
        <button
          onClick={handleInstallClick}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-md shadow-[#00B4FF]/20 cursor-pointer ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>
      )}

      {variant === 'banner' && (
        <button
          onClick={handleInstallClick}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-md shadow-[#00B4FF]/20 cursor-pointer ${className}`}
        >
          <Download className="w-4 h-4" />
          <span>Install Platform</span>
        </button>
      )}
      {variant === 'sidebar' && (
        <button
          onClick={handleInstallClick}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#07132b] hover:bg-[#0f2756] border border-[#1a366f] text-white text-xs font-semibold transition-all group cursor-pointer ${className}`}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#00B4FF]/15 text-[#00B4FF] flex items-center justify-center">
              <Download className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-white">Install Mindly</p>
              <p className="text-[10px] text-[#9bb1d6]">{isIOS ? 'Add to Home Screen' : 'Desktop & Mobile App'}</p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#00B4FF]/15 text-[#00B4FF] border border-[#00B4FF]/30">
            PWA
          </span>
        </button>
      )}

      {variant === 'button' && (
        <button
          onClick={handleInstallClick}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-md shadow-[#00B4FF]/20 cursor-pointer ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>
      )}

      {/* iOS Safari Installation Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-[#0B1F44] border border-[#1a366f] p-6 shadow-2xl text-white relative">
            <button
              onClick={() => setShowIOSGuide(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-[#9bb1d6] hover:text-white hover:bg-[#07132b] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#00B4FF]/20 border border-[#00B4FF]/40 text-[#00B4FF] flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Install Mindly on iOS</h3>
                <p className="text-xs text-[#9bb1d6]">Fast home screen access</p>
              </div>
            </div>

            <ol className="space-y-3 text-xs text-[#9bb1d6] mb-6">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#07132b] border border-[#1a366f] text-white flex items-center justify-center text-[10px] font-mono shrink-0">
                  1
                </span>
                <span>
                  Tap the <strong className="text-white">Share</strong> button <Share2 className="w-3.5 h-3.5 inline text-[#00B4FF]" /> in Safari’s navigation bar.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#07132b] border border-[#1a366f] text-white flex items-center justify-center text-[10px] font-mono shrink-0">
                  2
                </span>
                <span>
                  Scroll down the share sheet and tap <strong className="text-white">Add to Home Screen</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#07132b] border border-[#1a366f] text-white flex items-center justify-center text-[10px] font-mono shrink-0">
                  3
                </span>
                <span>
                  Tap <strong className="text-[#00B4FF]">Add</strong> in the top right corner. Mindly will launch like a native app!
                </span>
              </li>
            </ol>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all text-center cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
