import React, { useState, useEffect } from 'react';
import {
  Award,
  CheckCircle2,
  Calendar,
  Layers,
  Copy,
  Printer,
  X,
  ExternalLink,
  Sparkles,
  BookOpen,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Certificate, CombinedCertificate, Course, User } from '../types';
import { api } from '../lib/api';
import { MindlyLogo } from './MindlyLogo';
import { NokiaLoader } from './NokiaLoader';

interface CertificatesViewProps {
  currentUser: User | null;
  courses: Course[];
  onStartCourse: (courseId: string) => void;
  onExploreCourses: () => void;
}

export const CertificatesView: React.FC<CertificatesViewProps> = ({
  currentUser,
  courses,
  onStartCourse,
  onExploreCourses,
}) => {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [combinedCertificates, setCombinedCertificates] = useState<CombinedCertificate[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected certificate for detail modal
  const [activeCert, setActiveCert] = useState<{
    type: 'individual' | 'combined';
    data: Certificate | CombinedCertificate;
  } | null>(null);

  // Combine modal state
  const [isCombineModalOpen, setIsCombineModalOpen] = useState(false);
  const [selectedToCombine, setSelectedToCombine] = useState<string[]>([]);
  const [combining, setCombining] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      const res = await api.getCertificates();
      setCertificates(res.certificates || []);
      setCombinedCertificates(res.combinedCertificates || []);
    } catch (err) {
      console.error('Failed to load certificates', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, []);

  const handleCreateCombined = async () => {
    if (selectedToCombine.length < 2) return;
    setCombining(true);
    try {
      const res = await api.generateCombinedCertificate(selectedToCombine);
      setCombinedCertificates((prev) => [res.combinedCertificate, ...prev]);
      setIsCombineModalOpen(false);
      setSelectedToCombine([]);
      setActiveCert({ type: 'combined', data: res.combinedCertificate });
    } catch (err: any) {
      alert(err.message || 'Failed to create combined certificate');
    } finally {
      setCombining(false);
    }
  };

  const handleCopyVerification = (certId: string) => {
    const url = `${window.location.origin}/#verify=${certId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const completedCourses = courses.filter((c) => {
    const total = c.totalLessonsCount || c.lessonCount || c.lessonsCount || 0;
    return c.isCompleted || (c.completedLessonsCount !== undefined && total > 0 && c.completedLessonsCount >= total);
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Award className="w-5 h-5 text-[#00B4FF]" />
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Certificates & Credentials
            </h1>
          </div>
          <p className="text-xs text-[#9bb1d6]">
            Official, verifiable credentials issued strictly in your real name upon completing curriculum courses.
          </p>
        </div>

        {certificates.length >= 2 && (
          <button
            onClick={() => setIsCombineModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-md shadow-[#00B4FF]/20 cursor-pointer self-start sm:self-auto"
          >
            <Layers className="w-4 h-4" />
            <span>Combine Certificates</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-12 flex justify-center">
          <NokiaLoader label="Retrieving credentials..." />
        </div>
      ) : certificates.length === 0 && combinedCertificates.length === 0 ? (
        /* Empty State */
        <div className="p-8 sm:p-12 rounded-2xl bg-[#0B1F44] border border-[#1a366f] text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-[#00B4FF]/10 border border-[#00B4FF]/30 flex items-center justify-center text-[#00B4FF] mx-auto mb-4">
            <Award className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">No Certificates Earned Yet</h2>
          <p className="text-xs text-[#9bb1d6] leading-relaxed mb-6">
            Certificates of Completion are granted once you finish 100% of the lessons in any course. They feature your verified Real Name (
            <span className="text-white font-semibold">
              {currentUser?.realName || currentUser?.name || 'Your Name'}
            </span>
            ), lesson metrics, and an immutable verification code.
          </p>

          {courses.length > 0 ? (
            <div className="space-y-3 text-left max-w-md mx-auto mb-6">
              <p className="text-xs font-semibold text-white">Your Courses in Progress:</p>
              {courses.slice(0, 3).map((course) => (
                <div
                  key={course.id}
                  onClick={() => onStartCourse(course.id)}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#081734] border border-[#1a366f] hover:border-[#00B4FF] cursor-pointer transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">{course.title}</p>
                    <p className="text-[11px] text-[#627ca8]">
                      {course.completedLessonsCount || 0} / {course.totalLessonsCount} lessons completed
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#00B4FF] shrink-0 ml-2" />
                </div>
              ))}
            </div>
          ) : (
            <button
              onClick={onExploreCourses}
              className="px-5 py-2.5 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-md shadow-[#00B4FF]/20 cursor-pointer inline-flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              <span>Explore or Create a Course</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Combined Master Certificates Section */}
          {combinedCertificates.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-[#00B4FF]" />
                <h2 className="text-sm font-bold text-white">Combined Master Certificates</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {combinedCertificates.map((cert) => (
                  <div
                    key={cert.id}
                    onClick={() => setActiveCert({ type: 'combined', data: cert })}
                    className="p-5 rounded-2xl bg-gradient-to-br from-[#0B1F44] to-[#081734] border border-[#00B4FF]/40 hover:border-[#00B4FF] cursor-pointer transition-all shadow-lg hover:shadow-[#00B4FF]/10 group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#00B4FF]/20 border border-[#00B4FF]/40 flex items-center justify-center text-[#00B4FF]">
                          <MindlyLogo size={20} color="#00B4FF" />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00B4FF]/15 text-[#00B4FF] border border-[#00B4FF]/30 font-bold">
                            {cert.certificateId}
                          </span>
                          <p className="text-xs font-bold text-white mt-1">Master Curriculum Certificate</p>
                        </div>
                      </div>
                      <span className="text-[11px] text-[#627ca8] font-mono">{cert.completionDate}</span>
                    </div>

                    <div className="space-y-1 my-3 pl-2 border-l-2 border-[#00B4FF]/40">
                      {cert.courseTitles.map((t, idx) => (
                        <p key={idx} className="text-xs text-[#9bb1d6] truncate font-medium">
                          &bull; {t}
                        </p>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#1a366f] text-[11px] text-[#627ca8]">
                      <span>Issued to: <strong className="text-white">{cert.realName}</strong></span>
                      <span className="text-[#00B4FF] group-hover:underline font-semibold flex items-center gap-1">
                        View Certificate &rarr;
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Individual Course Certificates */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-[#00B4FF]" />
              <h2 className="text-sm font-bold text-white">Course Certificates of Completion</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {certificates.map((cert) => (
                <div
                  key={cert.id}
                  onClick={() => setActiveCert({ type: 'individual', data: cert })}
                  className="p-5 rounded-2xl bg-[#0B1F44] border border-[#1a366f] hover:border-[#00B4FF] cursor-pointer transition-all shadow-md hover:shadow-[#00B4FF]/10 group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00B4FF]/10 text-[#00B4FF] border border-[#00B4FF]/30 font-bold">
                        {cert.certificateId}
                      </span>
                      <span className="text-[11px] text-[#627ca8]">{cert.completionDate}</span>
                    </div>

                    <h3 className="text-sm font-bold text-white group-hover:text-[#00B4FF] transition-colors line-clamp-2 mb-2">
                      {cert.courseTitle}
                    </h3>

                    <p className="text-xs text-[#9bb1d6] mb-3">
                      Mastered by <strong className="text-white">{cert.realName}</strong>
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#1a366f] flex items-center justify-between text-[11px] text-[#627ca8]">
                    <span>{cert.totalLessons} lessons &bull; {cert.hoursInvested}h</span>
                    <span className="text-[#00B4FF] font-semibold group-hover:underline">View Diploma</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Certificate Viewer Modal (Print & Verify) */}
      {activeCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-3xl rounded-2xl bg-[#07132b] border border-[#1a366f] shadow-2xl p-6 sm:p-10 text-white max-h-[90vh] overflow-y-auto">
            {/* Modal Controls */}
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#1a366f]">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B1F44] hover:bg-[#0f2756] border border-[#1a366f] text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-[#00B4FF]" />
                  <span>Print Certificate</span>
                </button>
                <button
                  onClick={() => handleCopyVerification(activeCert.data.certificateId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B1F44] hover:bg-[#0f2756] border border-[#1a366f] text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-[#00B4FF]" />
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Verification Link'}</span>
                </button>
              </div>

              <button
                onClick={() => setActiveCert(null)}
                className="p-1.5 rounded-lg text-[#9bb1d6] hover:text-white hover:bg-[#0f2756] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Official Diploma Frame */}
            <div
              id="printable-certificate"
              className="relative p-8 sm:p-12 rounded-xl bg-gradient-to-b from-[#0B1F44] to-[#081734] border-4 border-[#00B4FF]/40 text-center shadow-inner"
            >
              {/* Corner Emblems */}
              <div className="absolute top-3 left-3 text-[10px] font-mono text-[#00B4FF]/60 font-bold">MND-OFFICIAL</div>
              <div className="absolute top-3 right-3 text-[10px] font-mono text-[#00B4FF]/60 font-bold">VERIFIED</div>
              <div className="absolute bottom-3 left-3 text-[10px] font-mono text-[#00B4FF]/60 font-bold">{activeCert.data.certificateId}</div>
              <div className="absolute bottom-3 right-3 text-[10px] font-mono text-[#00B4FF]/60 font-bold">SECURE RECORD</div>

              {/* Logo & Emblem */}
              <div className="w-16 h-16 rounded-2xl bg-[#00B4FF]/15 border border-[#00B4FF]/30 flex items-center justify-center mx-auto mb-4">
                <MindlyLogo size={36} color="#00B4FF" />
              </div>

              <p className="text-xs uppercase tracking-[0.25em] font-extrabold text-[#00B4FF] mb-2">
                Mindly Certificate of Completion
              </p>

              <h2 className="text-2xl sm:text-3xl font-serif text-white mb-6">
                Certificate of Mastery
              </h2>

              <p className="text-xs text-[#9bb1d6] uppercase tracking-wider mb-2">
                This is proudly presented to
              </p>

              {/* Learner's Real Name in Distinctive Typography */}
              <h3 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight underline decoration-[#00B4FF] decoration-2 underline-offset-8 mb-6">
                {activeCert.data.realName}
              </h3>

              <p className="text-xs text-[#9bb1d6] max-w-lg mx-auto leading-relaxed mb-4">
                for successfully completing the rigorous conceptual curriculum, demonstrating thorough comprehension of foundational principles, mental models, and practical distinctions in:
              </p>

              {activeCert.type === 'individual' ? (
                <div className="p-4 rounded-xl bg-[#07132b]/80 border border-[#1a366f] max-w-xl mx-auto mb-6">
                  <h4 className="text-base sm:text-lg font-bold text-white">
                    {(activeCert.data as Certificate).courseTitle}
                  </h4>
                  <p className="text-xs text-[#00B4FF] mt-1">
                    {(activeCert.data as Certificate).totalLessons} Lessons Mastered &bull; {(activeCert.data as Certificate).hoursInvested} Dedicated Study Hours
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#07132b]/80 border border-[#1a366f] max-w-xl mx-auto mb-6 text-left">
                  <h4 className="text-xs font-bold text-[#00B4FF] uppercase tracking-wider mb-2">
                    Combined Master Curriculum Disciplines:
                  </h4>
                  <ul className="space-y-1">
                    {(activeCert.data as CombinedCertificate).courseTitles.map((title, i) => (
                      <li key={i} className="text-xs text-white font-medium flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#00B4FF] shrink-0" />
                        <span>{title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Signatures & Seal */}
              <div className="pt-6 border-t border-[#1a366f] grid grid-cols-2 sm:grid-cols-3 items-center gap-4 text-left">
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#627ca8]">Completion Date</p>
                  <p className="text-xs font-semibold text-white">{activeCert.data.completionDate}</p>
                </div>

                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border-2 border-[#00B4FF] bg-[#00B4FF]/10 text-[#00B4FF]">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <p className="text-[9px] uppercase tracking-wider text-[#00B4FF] font-bold mt-1">
                    Officially Verified
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-[#627ca8]">Credential ID</p>
                  <p className="text-xs font-mono font-bold text-[#00B4FF]">{activeCert.data.certificateId}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Combine Certificates Modal */}
      {isCombineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#0B1F44] border border-[#1a366f] shadow-2xl p-6 sm:p-7 text-white">
            <button
              onClick={() => setIsCombineModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-[#9bb1d6] hover:text-white hover:bg-[#0f2756] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#00B4FF]/15 border border-[#00B4FF]/30 flex items-center justify-center text-[#00B4FF]">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Create Combined Master Certificate</h3>
                <p className="text-xs text-[#9bb1d6]">
                  Select two or more completed courses to merge into a single verified credential.
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto my-4 pr-1">
              {certificates.map((cert) => {
                const isSelected = selectedToCombine.includes(cert.id) || selectedToCombine.includes(cert.certificateId);
                return (
                  <div
                    key={cert.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedToCombine((prev) => prev.filter((id) => id !== cert.id && id !== cert.certificateId));
                      } else {
                        setSelectedToCombine((prev) => [...prev, cert.id]);
                      }
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#00B4FF]/15 border-[#00B4FF] text-white'
                        : 'bg-[#081734] border-[#1a366f] text-[#9bb1d6] hover:border-[#627ca8]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate text-white">{cert.courseTitle}</p>
                      <p className="text-[11px] text-[#627ca8] font-mono">{cert.certificateId} &bull; {cert.completionDate}</p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ml-3 ${
                        isSelected
                          ? 'bg-[#00B4FF] border-[#00B4FF] text-[#0B1F44]'
                          : 'border-[#1a366f]'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-4 h-4" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#1a366f]">
              <span className="text-xs text-[#9bb1d6]">
                {selectedToCombine.length} selected (min 2)
              </span>
              <button
                onClick={handleCreateCombined}
                disabled={selectedToCombine.length < 2 || combining}
                className="px-4 py-2.5 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-md shadow-[#00B4FF]/20 cursor-pointer disabled:opacity-40"
              >
                {combining ? 'Generating Master Credential...' : 'Issue Combined Certificate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
