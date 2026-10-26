import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  Mail,
  Send,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import { Course, SharedCourse } from '../types';
import { api } from '../lib/api';
import { NokiaLoader } from './NokiaLoader';

interface ShareCourseModalProps {
  course: Course;
  isOpen: boolean;
  onClose: () => void;
  onPreviewShare?: (shareId: string) => void;
}

export const ShareCourseModal: React.FC<ShareCourseModalProps> = ({
  course,
  isOpen,
  onClose,
  onPreviewShare,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [shareId, setShareId] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [canNativeShare, setCanNativeShare] = useState<boolean>(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      setCanNativeShare(true);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !course) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setCopied(false);

    api
      .shareCourse(course.id)
      .then((res) => {
        if (!isMounted) return;
        setShareId(res.shareId);
        setShareUrl(res.shareUrl);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to generate share link:', err);
        setError(err.message || 'Unable to generate share link. Please check your connection.');
        // Fallback share link using origin
        const fallbackUrl = `${window.location.origin}/share/course/${course.shareId || course.id}`;
        setShareUrl(fallbackUrl);
        setShareId(course.shareId || course.id);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, course]);

  if (!isOpen) return null;

  const shareTitle = course.title;
  const shareText = `Check out "${course.title}" on Mindly — structured lessons and active recall for lifelong learning.`;
  const fullShareMessage = `${shareText}\n\n${shareUrl}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback prompt
      window.prompt('Copy course link:', shareUrl);
    }
  };

  const handleNativeShare = async () => {
    if (!canNativeShare) return;
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        handleCopy();
      }
    }
  };

  const openWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullShareMessage)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openTelegram = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openEmail = () => {
    const mailto = `mailto:?subject=${encodeURIComponent(`Course: ${shareTitle}`)}&body=${encodeURIComponent(fullShareMessage)}`;
    window.location.href = mailto;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#0B1F44] border border-[#1a366f] shadow-2xl p-6 text-white overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[#9bb1d6] hover:text-white hover:bg-[#1a366f]/40 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#00B4FF]/15 border border-[#00B4FF]/30 flex items-center justify-center text-[#00B4FF] shrink-0">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white leading-snug">Share Course</h3>
            <p className="text-xs text-[#9bb1d6]">
              Invite peers or learners to master this curriculum with their own copy.
            </p>
          </div>
        </div>

        {/* Course Summary Card */}
        <div className="p-3.5 rounded-xl bg-[#081734] border border-[#1a366f] mb-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#00B4FF]/10 text-[#00B4FF] flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#00B4FF]">
              {course.category || 'General'} &bull; {course.lessonCount || course.lessonsCount || 0} Lessons
            </span>
            <h4 className="text-xs font-bold text-white truncate">{course.title}</h4>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-600/40 text-amber-200 text-xs mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center space-y-2">
            <NokiaLoader label="Generating unique course share link..." color="#00B4FF" />
            <p className="text-[11px] text-[#9bb1d6]">Creating safe public snapshot without private notes.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Link Box */}
            <div>
              <label className="block text-[11px] font-semibold text-[#9bb1d6] uppercase tracking-wider mb-1.5">
                Shareable Course Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white font-mono select-all focus:outline-none focus:border-[#00B4FF]"
                />
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    copied
                      ? 'bg-emerald-500 text-white'
                      : 'bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44]'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Share Platforms */}
            <div>
              <span className="block text-[11px] font-semibold text-[#9bb1d6] uppercase tracking-wider mb-2">
                Share Directly
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={openWhatsApp}
                  className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[#122B54] hover:bg-[#18396D] border border-[#1a366f] text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={openTelegram}
                  className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[#122B54] hover:bg-[#18396D] border border-[#1a366f] text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4 text-sky-400" />
                  <span>Telegram</span>
                </button>
                <button
                  type="button"
                  onClick={openTwitter}
                  className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[#122B54] hover:bg-[#18396D] border border-[#1a366f] text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#00B4FF]" />
                  <span>X / Post</span>
                </button>
                <button
                  type="button"
                  onClick={openEmail}
                  className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-[#122B54] hover:bg-[#18396D] border border-[#1a366f] text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <Mail className="w-4 h-4 text-indigo-400" />
                  <span>Email</span>
                </button>
              </div>
            </div>

            {canNativeShare && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1a366f]/40 hover:bg-[#1a366f]/70 border border-[#1a366f] text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-[#00B4FF]" />
                <span>Share via System Dialog...</span>
              </button>
            )}

            {/* Privacy & Recipient Safety Notice */}
            <div className="p-3 rounded-xl bg-[#081734] border border-[#1a366f]/70 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Privacy & Independence Guaranteed</span>
              </div>
              <p className="text-[11px] text-[#9bb1d6] leading-relaxed">
                Recipients receive their own independent copy with fresh progress tracking. Your personal notes, bookmarks, quiz scores, and account data are never exposed or shared.
              </p>
            </div>

            {/* Preview Link Button */}
            {onPreviewShare && shareId && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onPreviewShare(shareId);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-[#00B4FF] hover:underline cursor-pointer"
                >
                  <span>Preview What Recipients See</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
