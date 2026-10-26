/**
 * Mindly Firestore Community Service — Phase 3B
 * Authoritative Cloud Firestore persistence for Community Circles, Memberships,
 * Discussions, Replies, and Study Rooms.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Circle, CircleMembership, Discussion, DiscussionReply, StudyRoom } from '../types';

/**
 * Strips undefined properties recursively so Firestore does not reject payloads.
 */
function cleanPayload<T>(val: T): T {
  if (val === undefined) return undefined as any;
  if (val === null || typeof val !== 'object') return val;
  if (val instanceof Date) return val as any;
  if (Array.isArray(val)) {
    return val
      .filter((item) => item !== undefined)
      .map((item) => cleanPayload(item)) as any;
  }
  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    if (v !== undefined) {
      cleaned[k] = cleanPayload(v);
    }
  }
  return cleaned as any;
}

// =========================================================================
// 1. COMMUNITY CIRCLES & MEMBERSHIPS
// =========================================================================

export async function getCirclesFromFirestore(userId?: string): Promise<Circle[]> {
  try {
    const circlesRef = collection(db, 'circles');
    const snap = await getDocs(circlesRef);

    let userMemberships = new Set<string>();
    if (userId) {
      try {
        const memRef = collection(db, 'circleMemberships');
        const q = query(memRef, where('userId', '==', userId));
        const memSnap = await getDocs(q);
        memSnap.forEach((m) => {
          const data = m.data();
          if (data.circleId) userMemberships.add(data.circleId);
        });
      } catch (memErr) {
        console.warn('[FIRESTORE] Could not query user circle memberships:', memErr);
      }
    }

    const circles: Circle[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as Circle;
      const cId = data.id || docSnap.id;
      circles.push({
        ...data,
        id: cId,
        isJoined: userMemberships.has(cId),
      });
    });

    return circles;
  } catch (err) {
    console.warn('[FIRESTORE] Failed to fetch circles from Firestore:', err);
    throw err;
  }
}

export async function createCircleInFirestore(data: {
  name: string;
  description: string;
  topic: string;
}): Promise<Circle> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to create a circle.');
  }

  const circleId = `cir_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newCircle: Circle = {
    id: circleId,
    name: data.name.trim(),
    description: (data.description || '').trim(),
    topic: data.topic.trim(),
    membersCount: 1,
    isJoined: true,
    createdAt: now,
  };

  const circleRef = doc(db, 'circles', circleId);
  await setDoc(circleRef, cleanPayload(newCircle));

  // Automatically join creator to the circle
  const membershipId = `${circleId}_${currentUid}`;
  const membershipRef = doc(db, 'circleMemberships', membershipId);
  await setDoc(membershipRef, {
    id: membershipId,
    circleId,
    userId: currentUid,
    joinedAt: now,
  });

  return newCircle;
}

export async function joinCircleInFirestore(circleId: string, userId: string): Promise<void> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid || currentUid !== userId) {
    throw new Error('Authorized user identity mismatch.');
  }

  const membershipId = `${circleId}_${userId}`;
  const membershipRef = doc(db, 'circleMemberships', membershipId);

  const existing = await getDoc(membershipRef);
  if (existing.exists()) {
    return; // Already joined
  }

  await setDoc(membershipRef, {
    id: membershipId,
    circleId,
    userId,
    joinedAt: new Date().toISOString(),
  });

  // Increment circle membersCount
  try {
    const circleRef = doc(db, 'circles', circleId);
    await updateDoc(circleRef, {
      membersCount: increment(1),
    });
  } catch {}
}

export async function leaveCircleInFirestore(circleId: string, userId: string): Promise<void> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid || currentUid !== userId) {
    throw new Error('Authorized user identity mismatch.');
  }

  const membershipId = `${circleId}_${userId}`;
  const membershipRef = doc(db, 'circleMemberships', membershipId);

  await deleteDoc(membershipRef);

  // Decrement circle membersCount
  try {
    const circleRef = doc(db, 'circles', circleId);
    await updateDoc(circleRef, {
      membersCount: increment(-1),
    });
  } catch {}
}

// =========================================================================
// 2. DISCUSSIONS & REPLIES
// =========================================================================

export async function getDiscussionsFromFirestore(circleId?: string): Promise<Discussion[]> {
  try {
    const discRef = collection(db, 'discussions');
    let q = query(discRef);
    if (circleId) {
      q = query(discRef, where('circleId', '==', circleId));
    }

    const snap = await getDocs(q);
    const discussions: Discussion[] = [];

    // Also fetch all replies to populate thread discussions
    const repliesRef = collection(db, 'discussionReplies');
    const repliesSnap = await getDocs(repliesRef);
    const repliesByDiscId: { [discId: string]: DiscussionReply[] } = {};

    repliesSnap.forEach((rDoc) => {
      const rep = rDoc.data() as DiscussionReply;
      const dId = rep.discussionId;
      if (!repliesByDiscId[dId]) repliesByDiscId[dId] = [];
      repliesByDiscId[dId].push({
        ...rep,
        id: rep.id || rDoc.id,
      });
    });

    snap.forEach((docSnap) => {
      const data = docSnap.data() as Discussion;
      const dId = data.id || docSnap.id;
      const replies = repliesByDiscId[dId] || [];
      discussions.push({
        ...data,
        id: dId,
        replyCount: replies.length || data.replyCount || 0,
        replies,
      });
    });

    // Sort discussions newest first
    discussions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return discussions;
  } catch (err) {
    console.warn('[FIRESTORE] Failed to fetch discussions from Firestore:', err);
    throw err;
  }
}

export async function createDiscussionInFirestore(data: {
  title: string;
  content: string;
  type: 'question' | 'discussion' | 'insight';
  circleId?: string;
  circleName?: string;
  authorName?: string;
  authorUsername?: string;
  authorAvatar?: string;
}): Promise<Discussion> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to create a discussion post.');
  }

  const discussionId = `disc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newDiscussion: Discussion = {
    id: discussionId,
    userId: currentUid,
    authorName: data.authorName || auth.currentUser?.displayName || 'Mindly Learner',
    authorUsername: data.authorUsername || '@learner',
    authorAvatar: data.authorAvatar || auth.currentUser?.photoURL || undefined,
    circleId: data.circleId || undefined,
    circleName: data.circleName || undefined,
    title: data.title.trim(),
    content: data.content.trim(),
    type: data.type || 'discussion',
    replyCount: 0,
    replies: [],
    createdAt: now,
    updatedAt: now,
  };

  const discRef = doc(db, 'discussions', discussionId);
  await setDoc(discRef, cleanPayload(newDiscussion));

  return newDiscussion;
}

export async function deleteDiscussionInFirestore(id: string, userId: string): Promise<void> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid || currentUid !== userId) {
    throw new Error('Permission denied: You can only delete your own discussions.');
  }

  const discRef = doc(db, 'discussions', id);
  const snap = await getDoc(discRef);
  if (!snap.exists()) {
    throw new Error('Discussion post not found.');
  }

  if (snap.data().userId !== currentUid) {
    throw new Error('Permission denied: You do not own this discussion.');
  }

  await deleteDoc(discRef);
}

export async function addDiscussionReplyInFirestore(data: {
  discussionId: string;
  content: string;
  authorName?: string;
  authorUsername?: string;
  authorAvatar?: string;
}): Promise<DiscussionReply> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to reply to a discussion.');
  }

  const replyId = `drep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newReply: DiscussionReply = {
    id: replyId,
    discussionId: data.discussionId,
    userId: currentUid,
    authorName: data.authorName || auth.currentUser?.displayName || 'Mindly Learner',
    authorUsername: data.authorUsername || '@learner',
    authorAvatar: data.authorAvatar || auth.currentUser?.photoURL || undefined,
    content: data.content.trim(),
    createdAt: now,
    updatedAt: now,
  };

  const replyRef = doc(db, 'discussionReplies', replyId);
  await setDoc(replyRef, cleanPayload(newReply));

  // Update discussion reply count
  try {
    const discRef = doc(db, 'discussions', data.discussionId);
    await updateDoc(discRef, {
      replyCount: increment(1),
      updatedAt: now,
    });
  } catch {}

  return newReply;
}

// =========================================================================
// 3. STUDY ROOMS & ROOM MEMBERSHIPS
// =========================================================================

export async function getStudyRoomsFromFirestore(userId?: string): Promise<StudyRoom[]> {
  try {
    const roomsRef = collection(db, 'studyRooms');
    const snap = await getDocs(roomsRef);

    let userMemberships = new Set<string>();
    if (userId) {
      try {
        const memRef = collection(db, 'studyRoomMembers');
        const q = query(memRef, where('userId', '==', userId));
        const memSnap = await getDocs(q);
        memSnap.forEach((m) => {
          const data = m.data();
          if (data.roomId) userMemberships.add(data.roomId);
        });
      } catch (memErr) {
        console.warn('[FIRESTORE] Could not query study room memberships:', memErr);
      }
    }

    const rooms: StudyRoom[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as StudyRoom;
      const rId = data.id || docSnap.id;
      rooms.push({
        ...data,
        id: rId,
        isMember: userMemberships.has(rId),
      });
    });

    return rooms;
  } catch (err) {
    console.warn('[FIRESTORE] Failed to fetch study rooms from Firestore:', err);
    throw err;
  }
}

export async function createStudyRoomInFirestore(data: {
  name: string;
  topic: string;
  description?: string;
  studyGoal?: string;
  sessionTime?: string;
  creatorName?: string;
  creatorUsername?: string;
}): Promise<StudyRoom> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) {
    throw new Error('Authentication required to create a study room.');
  }

  const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newRoom: StudyRoom = {
    id: roomId,
    creatorId: currentUid,
    creatorName: data.creatorName || auth.currentUser?.displayName || 'Mindly Host',
    creatorUsername: data.creatorUsername || '@host',
    name: data.name.trim(),
    topic: data.topic.trim(),
    description: (data.description || '').trim(),
    membersCount: 1,
    studyGoal: (data.studyGoal || '').trim(),
    sessionTime: (data.sessionTime || '').trim(),
    isMember: true,
    createdAt: now,
  };

  const roomRef = doc(db, 'studyRooms', roomId);
  await setDoc(roomRef, cleanPayload(newRoom));

  // Add host membership
  const membershipId = `${roomId}_${currentUid}`;
  const membershipRef = doc(db, 'studyRoomMembers', membershipId);
  await setDoc(membershipRef, {
    id: membershipId,
    roomId,
    userId: currentUid,
    joinedAt: now,
  });

  return newRoom;
}

export async function joinStudyRoomInFirestore(roomId: string, userId: string): Promise<void> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid || currentUid !== userId) {
    throw new Error('Authorized user identity mismatch.');
  }

  const membershipId = `${roomId}_${userId}`;
  const membershipRef = doc(db, 'studyRoomMembers', membershipId);

  const existing = await getDoc(membershipRef);
  if (existing.exists()) {
    return;
  }

  await setDoc(membershipRef, {
    id: membershipId,
    roomId,
    userId,
    joinedAt: new Date().toISOString(),
  });

  try {
    const roomRef = doc(db, 'studyRooms', roomId);
    await updateDoc(roomRef, {
      membersCount: increment(1),
    });
  } catch {}
}

export async function leaveStudyRoomInFirestore(roomId: string, userId: string): Promise<void> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid || currentUid !== userId) {
    throw new Error('Authorized user identity mismatch.');
  }

  const membershipId = `${roomId}_${userId}`;
  const membershipRef = doc(db, 'studyRoomMembers', membershipId);

  await deleteDoc(membershipRef);

  try {
    const roomRef = doc(db, 'studyRooms', roomId);
    await updateDoc(roomRef, {
      membersCount: increment(-1),
    });
  } catch {}
}

// =========================================================================
// 4. IDEMPOTENT COMMUNITY MIGRATION ENGINE
// =========================================================================

export async function migrateCommunityToFirestore(legacyData?: {
  circles?: Circle[];
  discussions?: Discussion[];
  discussionReplies?: DiscussionReply[];
  studyRooms?: StudyRoom[];
}): Promise<{
  circlesMigrated: number;
  discussionsMigrated: number;
  repliesMigrated: number;
  roomsMigrated: number;
}> {
  let circlesMigrated = 0;
  let discussionsMigrated = 0;
  let repliesMigrated = 0;
  let roomsMigrated = 0;

  try {
    let payload = legacyData;
    if (!payload) {
      try {
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('mindly_token') : null;
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch('/api/migrate/community-data', { headers });
        if (res.ok) {
          payload = await res.json();
        }
      } catch (fErr) {
        console.warn('[MIGRATION] Could not fetch legacy community data from server:', fErr);
      }
    }

    // 1. Circles Migration
    if (payload?.circles && payload.circles.length > 0) {
      const existingCircles = await getCirclesFromFirestore().catch(() => []);
      const existingCircleIds = new Set(existingCircles.map((c) => c.id));

      for (const circle of payload.circles) {
        if (!existingCircleIds.has(circle.id)) {
          const cRef = doc(db, 'circles', circle.id);
          await setDoc(cRef, cleanPayload(circle), { merge: true });
          existingCircleIds.add(circle.id);
          circlesMigrated++;
        }
      }
    }

    // 2. Discussions Migration
    if (payload?.discussions && payload.discussions.length > 0) {
      const existingDiscs = await getDiscussionsFromFirestore().catch(() => []);
      const existingDiscIds = new Set(existingDiscs.map((d) => d.id));

      for (const disc of payload.discussions) {
        if (!existingDiscIds.has(disc.id)) {
          const dRef = doc(db, 'discussions', disc.id);
          const { replies, ...cleanDisc } = disc;
          await setDoc(dRef, cleanPayload(cleanDisc), { merge: true });
          existingDiscIds.add(disc.id);
          discussionsMigrated++;

          // Migrate replies if embedded
          if (replies && Array.isArray(replies)) {
            for (const reply of replies) {
              const rRef = doc(db, 'discussionReplies', reply.id);
              await setDoc(rRef, cleanPayload(reply), { merge: true });
              repliesMigrated++;
            }
          }
        }
      }
    }

    // 3. Discussion Replies (if provided separately at root)
    if (payload?.discussionReplies && payload.discussionReplies.length > 0) {
      const existingRepliesSnap = await getDocs(collection(db, 'discussionReplies')).catch(() => null);
      const existingReplyIds = new Set<string>();
      if (existingRepliesSnap) {
        existingRepliesSnap.forEach((r) => existingReplyIds.add(r.id));
      }
      for (const reply of payload.discussionReplies) {
        if (!existingReplyIds.has(reply.id)) {
          const rRef = doc(db, 'discussionReplies', reply.id);
          await setDoc(rRef, cleanPayload(reply), { merge: true });
          existingReplyIds.add(reply.id);
          repliesMigrated++;
        }
      }
    }

    // 4. Study Rooms Migration
    if (payload?.studyRooms && payload.studyRooms.length > 0) {
      const existingRooms = await getStudyRoomsFromFirestore().catch(() => []);
      const existingRoomIds = new Set(existingRooms.map((r) => r.id));

      for (const room of payload.studyRooms) {
        if (!existingRoomIds.has(room.id)) {
          const rRef = doc(db, 'studyRooms', room.id);
          await setDoc(rRef, cleanPayload(room), { merge: true });
          existingRoomIds.add(room.id);
          roomsMigrated++;
        }
      }
    }
  } catch (err) {
    console.warn('[MIGRATION] Community migration encountered an error:', err);
  }

  return { circlesMigrated, discussionsMigrated, repliesMigrated, roomsMigrated };
}
