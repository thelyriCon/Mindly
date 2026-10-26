import React, { useState, useEffect } from 'react';
import {
  Users,
  MessageSquare,
  Compass,
  Sparkles,
  HelpCircle,
  Lightbulb,
  Plus,
  Send,
  Trash2,
  Lock,
  Globe,
  Shield,
  Eye,
  CheckCircle2,
  ArrowRight,
  X,
  UserCheck,
} from 'lucide-react';
import { Circle, Discussion, DiscussionReply, StudyRoom, LearnerProfile, User } from '../types';
import { api } from '../lib/api';
import { NokiaLoader } from './NokiaLoader';

interface CommunityViewProps {
  currentUser: User | null;
  onOpenAuth: () => void;
  initialTab?: 'discussions' | 'circles' | 'rooms';
}

export const CommunityView: React.FC<CommunityViewProps> = ({
  currentUser,
  onOpenAuth,
  initialTab = 'discussions',
}) => {
  const [activeTab, setActiveTab] = useState<'discussions' | 'circles' | 'rooms'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Circles state
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);

  // Discussions state
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [expandedDiscussionId, setExpandedDiscussionId] = useState<string | null>(null);
  const [newReplyText, setNewReplyText] = useState<{ [id: string]: string }>({});

  // Study Rooms state
  const [rooms, setRooms] = useState<StudyRoom[]>([]);

  // Daily Question
  const [todaysQuestion, setTodaysQuestion] = useState<any>(null);

  // Modals
  const [isNewPostModalOpen, setIsNewPostModalOpen] = useState(false);
  const [newPostType, setNewPostType] = useState<'question' | 'discussion' | 'insight'>('discussion');
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostCircleId, setNewPostCircleId] = useState('');

  // Learner profile modal
  const [viewedProfile, setViewedProfile] = useState<LearnerProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [submittingPost, setSubmittingPost] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [circRes, discRes, roomRes, tqRes] = await Promise.all([
        api.getCircles(),
        api.getDiscussions(selectedCircleId || undefined),
        api.getStudyRooms(),
        api.getTodaysQuestion(),
      ]);
      setCircles(circRes.circles || []);
      setDiscussions(discRes.discussions || []);
      setRooms(roomRes.rooms || []);
      setTodaysQuestion(tqRes.question || null);
    } catch (err) {
      console.error('Failed to load community data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCircleId]);

  const handleJoinCircle = async (circleId: string, isJoined?: boolean) => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    try {
      if (isJoined) {
        await api.leaveCircle(circleId);
      } else {
        await api.joinCircle(circleId);
      }
      setCircles((prev) =>
        prev.map((c) =>
          c.id === circleId
            ? {
                ...c,
                isJoined: !isJoined,
                membersCount: isJoined ? c.membersCount - 1 : c.membersCount + 1,
              }
            : c
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    if (!newPostTitle.trim() || !newPostContent.trim()) return;

    setSubmittingPost(true);
    try {
      const targetCircle = circles.find((c) => c.id === newPostCircleId);
      const res = await api.createDiscussion({
        title: newPostTitle.trim(),
        content: newPostContent.trim(),
        type: newPostType,
        circleId: newPostCircleId || undefined,
        circleName: targetCircle?.name || undefined,
      });

      setDiscussions((prev) => [res.discussion, ...prev]);
      setIsNewPostModalOpen(false);
      setNewPostTitle('');
      setNewPostContent('');
      setNewPostCircleId('');
    } catch (err: any) {
      alert(err.message || 'Failed to publish post');
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleSendReply = async (discussionId: string) => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    const text = (newReplyText[discussionId] || '').trim();
    if (!text) return;

    try {
      const res = await api.addDiscussionReply(discussionId, text);
      setDiscussions((prev) =>
        prev.map((d) =>
          d.id === discussionId
            ? {
                ...d,
                replyCount: (d.replyCount || 0) + 1,
                replies: [...(d.replies || []), res.reply],
              }
            : d
        )
      );
      setNewReplyText((prev) => ({ ...prev, [discussionId]: '' }));
    } catch (err: any) {
      alert(err.message || 'Failed to send reply');
    }
  };

  const handleDeletePost = async (discussionId: string) => {
    if (!confirm('Are you sure you want to delete this discussion post?')) return;
    try {
      await api.deleteDiscussion(discussionId);
      setDiscussions((prev) => prev.filter((d) => d.id !== discussionId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleJoinRoom = async (roomId: string, isMember?: boolean) => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    try {
      if (isMember) {
        await api.leaveStudyRoom(roomId);
      } else {
        await api.joinStudyRoom(roomId);
      }
      setRooms((prev) =>
        prev.map((r) =>
          r.id === roomId
            ? {
                ...r,
                isMember: !isMember,
                membersCount: isMember ? r.membersCount - 1 : r.membersCount + 1,
              }
            : r
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenUserProfile = async (username: string) => {
    setLoadingProfile(true);
    try {
      const res = await api.getLearnerProfile(username);
      setViewedProfile(res.profile);
    } catch (err: any) {
      alert('Learner profile is private or unavailable.');
    } finally {
      setLoadingProfile(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Users className="w-5 h-5 text-[#00B4FF]" />
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Learning Community & Circles
            </h1>
          </div>
          <p className="text-xs text-[#9bb1d6]">
            Collaborate with peers, ask deep conceptual questions, share learning insights, and join live study rooms.
          </p>
        </div>

        <button
          onClick={() => {
            if (!currentUser) {
              onOpenAuth();
            } else {
              setIsNewPostModalOpen(true);
            }
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00B4FF] hover:bg-[#009de0] text-[#0B1F44] text-xs font-bold transition-all shadow-md shadow-[#00B4FF]/20 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Start Discussion</span>
        </button>
      </div>

      {/* Today's Question Card */}
      {todaysQuestion && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-[#0B1F44] to-[#081734] border border-[#00B4FF]/40 mb-8 shadow-md">
          <div className="flex items-center gap-2 text-[#00B4FF] text-xs font-bold mb-2">
            <Sparkles className="w-4 h-4" />
            <span>Today&apos;s Knowledge Question</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-[#00B4FF]/10 text-[#00B4FF] border border-[#00B4FF]/20 font-mono">
              {todaysQuestion.topic}
            </span>
          </div>
          <h2 className="text-sm sm:text-base font-bold text-white mb-2 leading-relaxed">
            &ldquo;{todaysQuestion.question}&rdquo;
          </h2>
          <div className="flex items-center justify-between text-[11px] text-[#627ca8]">
            <span>Prompted by {todaysQuestion.author}</span>
            <button
              onClick={() => {
                setNewPostTitle(`Response to Daily Question: ${todaysQuestion.question.slice(0, 50)}...`);
                setNewPostType('insight');
                setIsNewPostModalOpen(true);
              }}
              className="text-[#00B4FF] hover:underline font-semibold cursor-pointer"
            >
              Share your perspective &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-[#1a366f] pb-3 mb-6">
        <button
          onClick={() => setActiveTab('discussions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'discussions'
              ? 'bg-[#00B4FF] text-[#0B1F44]'
              : 'text-[#9bb1d6] hover:text-white hover:bg-[#0f2756]'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Discussions ({discussions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('circles')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'circles'
              ? 'bg-[#00B4FF] text-[#0B1F44]'
              : 'text-[#9bb1d6] hover:text-white hover:bg-[#0f2756]'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Topic Circles ({circles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('rooms')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'rooms'
              ? 'bg-[#00B4FF] text-[#0B1F44]'
              : 'text-[#9bb1d6] hover:text-white hover:bg-[#0f2756]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Study Rooms ({rooms.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center">
          <NokiaLoader label="Connecting to community..." />
        </div>
      ) : activeTab === 'discussions' ? (
        /* DISCUSSIONS TAB */
        <div className="space-y-4">
          {selectedCircleId && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#081734] border border-[#00B4FF]/40 text-xs">
              <span className="text-[#9bb1d6]">
                Filtering by circle:{' '}
                <strong className="text-white">
                  {circles.find((c) => c.id === selectedCircleId)?.name}
                </strong>
              </span>
              <button
                onClick={() => setSelectedCircleId(null)}
                className="text-[#00B4FF] hover:underline font-semibold cursor-pointer"
              >
                Clear filter
              </button>
            </div>
          )}

          {discussions.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#0B1F44] border border-[#1a366f] text-center">
              <MessageSquare className="w-8 h-8 text-[#00B4FF] mx-auto mb-2" />
              <p className="text-sm font-bold text-white mb-1">No discussions yet</p>
              <p className="text-xs text-[#9bb1d6]">Be the first to share an insight or ask a question.</p>
            </div>
          ) : (
            discussions.map((d) => {
              const isExpanded = expandedDiscussionId === d.id;
              const isOwn = currentUser && currentUser.id === d.userId;

              return (
                <div
                  key={d.id}
                  className="p-5 rounded-2xl bg-[#0B1F44] border border-[#1a366f] text-left transition-all"
                >
                  {/* Post Top Meta */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          d.type === 'question'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : d.type === 'insight'
                            ? 'bg-[#00B4FF]/15 text-[#00B4FF] border border-[#00B4FF]/30'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {d.type}
                      </span>

                      {d.circleName && (
                        <span className="text-[11px] text-[#627ca8] font-mono">
                          in {d.circleName}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#627ca8]">
                        {new Date(d.createdAt).toLocaleDateString()}
                      </span>
                      {isOwn && (
                        <button
                          onClick={() => handleDeletePost(d.id)}
                          className="p-1 text-[#627ca8] hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Title & Author */}
                  <h3 className="text-sm sm:text-base font-bold text-white mb-2 leading-snug">
                    {d.title}
                  </h3>

                  <p className="text-xs text-[#9bb1d6] leading-relaxed mb-4 whitespace-pre-line">
                    {d.content}
                  </p>

                  {/* Author Bar & Reply Toggle */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#1a366f] text-xs">
                    <button
                      onClick={() => handleOpenUserProfile(d.authorUsername)}
                      className="flex items-center gap-2 text-left cursor-pointer group"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#081734] border border-[#1a366f] flex items-center justify-center text-[10px] font-bold text-[#00B4FF]">
                        {d.authorName.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-semibold text-white group-hover:text-[#00B4FF] transition-colors">
                        {d.authorName}
                      </span>
                      <span className="text-[11px] text-[#00B4FF] font-mono">
                        {d.authorUsername}
                      </span>
                    </button>

                    <button
                      onClick={() =>
                        setExpandedDiscussionId(isExpanded ? null : d.id)
                      }
                      className="text-[#00B4FF] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{d.replyCount || 0} Replies</span>
                    </button>
                  </div>

                  {/* Collapsible Replies Thread */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-[#1a366f]/60 space-y-3">
                      {d.replies && d.replies.length > 0 ? (
                        <div className="space-y-2.5">
                          {d.replies.map((r) => (
                            <div
                              key={r.id}
                              className="p-3 rounded-xl bg-[#081734] border border-[#1a366f] text-xs"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <button
                                  onClick={() => handleOpenUserProfile(r.authorUsername)}
                                  className="font-semibold text-white hover:text-[#00B4FF] flex items-center gap-1.5 cursor-pointer"
                                >
                                  <span>{r.authorName}</span>
                                  <span className="text-[10px] text-[#00B4FF] font-mono">
                                    {r.authorUsername}
                                  </span>
                                </button>
                                <span className="text-[10px] text-[#627ca8]">
                                  {new Date(r.createdAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <p className="text-[#9bb1d6] leading-relaxed">{r.content}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#627ca8] italic">No replies yet. Start the conversation!</p>
                      )}

                      {/* Add Reply Input */}
                      <div className="flex items-center gap-2 mt-3">
                        <input
                          type="text"
                          placeholder="Write a thoughtful, grounded reply..."
                          value={newReplyText[d.id] || ''}
                          onChange={(e) =>
                            setNewReplyText((prev) => ({
                              ...prev,
                              [d.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSendReply(d.id);
                          }}
                          className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF]"
                        />
                        <button
                          onClick={() => handleSendReply(d.id)}
                          className="px-3 py-2 rounded-xl bg-[#00B4FF] text-[#0B1F44] hover:bg-[#009de0] text-xs font-bold transition-colors cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : activeTab === 'circles' ? (
        /* CIRCLES TAB */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {circles.map((c) => (
            <div
              key={c.id}
              className="p-5 rounded-2xl bg-[#0B1F44] border border-[#1a366f] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00B4FF]/10 text-[#00B4FF] border border-[#00B4FF]/30 font-bold">
                    {c.topic}
                  </span>
                  <span className="text-xs text-[#627ca8] flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>{c.membersCount} members</span>
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white mb-1.5">{c.name}</h3>
                <p className="text-xs text-[#9bb1d6] leading-relaxed mb-4">{c.description}</p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#1a366f]">
                <button
                  onClick={() => {
                    setSelectedCircleId(c.id);
                    setActiveTab('discussions');
                  }}
                  className="text-xs text-[#00B4FF] hover:underline font-semibold cursor-pointer"
                >
                  View Discussions &rarr;
                </button>

                <button
                  onClick={() => handleJoinCircle(c.id, c.isJoined)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    c.isJoined
                      ? 'bg-[#081734] border border-[#1a366f] text-emerald-400 hover:text-red-400'
                      : 'bg-[#00B4FF] text-[#0B1F44] hover:bg-[#009de0]'
                  }`}
                >
                  {c.isJoined ? 'Joined ✓' : 'Join Circle'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* STUDY ROOMS TAB */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rooms.map((r) => (
            <div
              key={r.id}
              className="p-5 rounded-2xl bg-[#0B1F44] border border-[#1a366f] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                    Active Study Room
                  </span>
                  <span className="text-xs text-[#627ca8] flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    <span>{r.membersCount} studying</span>
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white mb-1">{r.name}</h3>
                <p className="text-xs text-[#00B4FF] font-semibold mb-2">Topic: {r.topic}</p>
                <p className="text-xs text-[#9bb1d6] leading-relaxed mb-3">{r.description}</p>

                {r.studyGoal && (
                  <div className="p-2.5 rounded-xl bg-[#081734] border border-[#1a366f] text-[11px] text-[#9bb1d6] mb-3">
                    <strong className="text-white">Goal:</strong> {r.studyGoal}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#1a366f]">
                <span className="text-[11px] text-[#627ca8]">Host: {r.creatorUsername}</span>
                <button
                  onClick={() => handleJoinRoom(r.id, r.isMember)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    r.isMember
                      ? 'bg-[#081734] border border-[#1a366f] text-emerald-400'
                      : 'bg-[#00B4FF] text-[#0B1F44] hover:bg-[#009de0]'
                  }`}
                >
                  {r.isMember ? 'Joined Room ✓' : 'Join Room'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Start Discussion Modal */}
      {isNewPostModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#0B1F44] border border-[#1a366f] shadow-2xl p-6 sm:p-7 text-white">
            <button
              onClick={() => setIsNewPostModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-[#9bb1d6] hover:text-white hover:bg-[#0f2756] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-white mb-1">Create Community Post</h3>
            <p className="text-xs text-[#9bb1d6] mb-4">
              Share a deep question, practical insight, or open discussion with peers.
            </p>

            <form onSubmit={handleCreatePost} className="space-y-3.5">
              {/* Type Select */}
              <div>
                <label className="block text-xs font-semibold text-white mb-1">Post Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['question', 'discussion', 'insight'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewPostType(type)}
                      className={`py-2 rounded-xl text-xs font-bold capitalize transition-colors cursor-pointer ${
                        newPostType === type
                          ? 'bg-[#00B4FF] text-[#0B1F44]'
                          : 'bg-[#081734] border border-[#1a366f] text-[#9bb1d6] hover:text-white'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Circle Assign */}
              <div>
                <label className="block text-xs font-semibold text-white mb-1">Topic Circle (Optional)</label>
                <select
                  value={newPostCircleId}
                  onChange={(e) => setNewPostCircleId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white focus:outline-none focus:border-[#00B4FF]"
                >
                  <option value="">General Community</option>
                  {circles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.topic})
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-white mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. What is the fundamental difference between..."
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF]"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-xs font-semibold text-white mb-1">Explanation / Content</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Elaborate on the concept, provide context from your study materials..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#081734] border border-[#1a366f] text-white placeholder-[#627ca8] focus:outline-none focus:border-[#00B4FF] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1a366f]">
                <button
                  type="button"
                  onClick={() => setIsNewPostModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#9bb1d6] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPost}
                  className="px-4 py-2 rounded-xl bg-[#00B4FF] text-[#0B1F44] text-xs font-bold hover:bg-[#009de0] transition-colors shadow-md shadow-[#00B4FF]/20 cursor-pointer disabled:opacity-50"
                >
                  {submittingPost ? 'Publishing...' : 'Publish Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Public Learner Profile Modal */}
      {viewedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl bg-[#0B1F44] border border-[#1a366f] shadow-2xl p-6 sm:p-7 text-white text-center">
            <button
              onClick={() => setViewedProfile(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-[#9bb1d6] hover:text-white hover:bg-[#0f2756] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-16 h-16 rounded-full bg-[#081734] border-2 border-[#00B4FF] flex items-center justify-center text-lg font-bold text-[#00B4FF] mx-auto mb-3">
              {viewedProfile.realName.slice(0, 2).toUpperCase()}
            </div>

            <h3 className="text-base font-bold text-white">{viewedProfile.realName}</h3>
            <p className="text-xs text-[#00B4FF] font-mono mb-2">{viewedProfile.username}</p>

            <p className="text-xs text-[#9bb1d6] max-w-sm mx-auto mb-5 leading-relaxed">
              {viewedProfile.bio || 'Curious learner expanding knowledge on Mindly.'}
            </p>

            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#081734] border border-[#1a366f] mb-5 text-center">
              <div>
                <p className="text-base font-bold text-white">{viewedProfile.completedCoursesCount}</p>
                <p className="text-[10px] text-[#627ca8]">Completed Courses</p>
              </div>
              <div>
                <p className="text-base font-bold text-[#00B4FF]">{viewedProfile.certificatesCount}</p>
                <p className="text-[10px] text-[#627ca8]">Verifiable Certificates</p>
              </div>
            </div>

            <div className="text-left">
              <p className="text-[11px] font-semibold text-white mb-2">Interests & Disciplines</p>
              <div className="flex flex-wrap gap-1.5">
                {(viewedProfile.interests || ['General Knowledge']).map((int, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-[#00B4FF]/10 text-[#00B4FF] border border-[#00B4FF]/30 font-medium"
                  >
                    {int}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
