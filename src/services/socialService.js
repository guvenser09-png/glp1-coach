// socialService — Community/Social feed data layer.
//
// ─────────────────────────────────────────────────────────────────────────────
// SWAPPABLE BOUNDARY
// ─────────────────────────────────────────────────────────────────────────────
// This module is the SINGLE source of truth for community data. It is currently
// backed by local AsyncStorage so the feature works fully offline and with no
// backend. Every exported function below is an async boundary with a STABLE
// signature.
//
// TODO(backend): Replace the *internals* of each exported function with Supabase
// calls (e.g. supabase.from('posts').select(...), .insert(...), an RLS-protected
// `reports` table, a `blocks` table, and realtime subscriptions). Do NOT change
// the exported function names, argument shapes, or returned Post shape — the UI
// (SocialScreen) depends only on this contract, so a clean swap keeps the screen
// untouched.
//
// Post shape (the contract):
// {
//   id: string,
//   authorId: string,
//   authorName: string,
//   type: 'injection' | 'meal' | 'general',
//   text: string,
//   mealPhotoUri?: string,
//   protein?: number,
//   likes: number,
//   likedByMe: boolean,
//   createdAt: string (ISO),
// }
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Storage keys ─────────────────────────────────────────────────────────────
const POSTS_KEY = 'social_posts_v1';
const BLOCKED_KEY = 'social_blocked_users_v1';
const REPORTED_KEY = 'social_reported_posts_v1';

// Local pseudo-identity for "me" liking posts. The real author id comes from the
// caller via createPost (see SocialScreen passing user.uid through the post).
// Likes are stored on the post object directly for the local impl.

// ── Low-level helpers ────────────────────────────────────────────────────────
async function readJSON(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn('socialService: failed to read', key, e);
    return fallback;
  }
}

async function writeJSON(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('socialService: failed to write', key, e);
  }
}

async function getAllPostsRaw() {
  return readJSON(POSTS_KEY, []);
}

function genId() {
  return (
    'p_' +
    Date.now().toString(36) +
    '_' +
    Math.random().toString(36).slice(2, 8)
  );
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * getFeed — newest-first list of visible posts.
 * @param {{ filter?: 'all'|'injection'|'meal' }} opts
 * @returns {Promise<Post[]>}
 */
export async function getFeed({ filter = 'all' } = {}) {
  const [posts, blocked, reported] = await Promise.all([
    getAllPostsRaw(),
    getBlockedUsers(),
    readJSON(REPORTED_KEY, []),
  ]);

  const blockedSet = new Set(blocked);
  const reportedSet = new Set(reported);

  let visible = posts.filter(
    (p) => !blockedSet.has(p.authorId) && !reportedSet.has(p.id)
  );

  if (filter === 'injection' || filter === 'meal') {
    visible = visible.filter((p) => p.type === filter);
  }

  // Newest first.
  visible.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return visible;
}

/**
 * createPost — add a new post authored by the current user.
 * The caller is responsible for passing author identity through the optional
 * authorId/authorName fields; if omitted, a local placeholder is used.
 * @param {{ type:'injection'|'meal'|'general', text:string, mealPhotoUri?:string, protein?:number, authorId?:string, authorName?:string }} input
 * @returns {Promise<Post>}
 */
export async function createPost({
  type = 'general',
  text = '',
  mealPhotoUri,
  protein,
  authorId,
  authorName,
} = {}) {
  const posts = await getAllPostsRaw();

  const post = {
    id: genId(),
    authorId: authorId || 'me',
    authorName: authorName || 'You',
    type,
    text: String(text || '').trim(),
    likes: 0,
    likedByMe: false,
    createdAt: new Date().toISOString(),
  };
  if (mealPhotoUri) post.mealPhotoUri = mealPhotoUri;
  if (protein != null && !Number.isNaN(Number(protein))) {
    post.protein = Number(protein);
  }

  posts.push(post);
  await writeJSON(POSTS_KEY, posts);
  return post;
}

/**
 * toggleLike — flip the current user's like on a post.
 * @param {string} postId
 * @returns {Promise<Post>} the updated post
 */
export async function toggleLike(postId) {
  const posts = await getAllPostsRaw();
  const idx = posts.findIndex((p) => p.id === postId);
  if (idx === -1) {
    throw new Error('post-not-found');
  }
  const post = posts[idx];
  const liked = !post.likedByMe;
  post.likedByMe = liked;
  post.likes = Math.max(0, (post.likes || 0) + (liked ? 1 : -1));
  posts[idx] = post;
  await writeJSON(POSTS_KEY, posts);
  return post;
}

/**
 * reportPost — flag a post for review and hide it from this user's feed.
 * (Backend: insert into a `reports` table for moderator review.)
 * @param {string} postId
 * @param {string} reason
 * @returns {Promise<void>}
 */
export async function reportPost(postId, reason) {
  const reported = await readJSON(REPORTED_KEY, []);
  if (!reported.includes(postId)) {
    reported.push(postId);
    await writeJSON(REPORTED_KEY, reported);
  }
  // Persist a lightweight report record for future backend sync / audit.
  const log = await readJSON('social_report_log_v1', []);
  log.push({
    postId,
    reason: reason || 'unspecified',
    at: new Date().toISOString(),
  });
  await writeJSON('social_report_log_v1', log);
}

/**
 * blockUser — block an author; their posts disappear from the feed.
 * @param {string} authorId
 * @returns {Promise<void>}
 */
export async function blockUser(authorId) {
  if (!authorId) return;
  const blocked = await getBlockedUsers();
  if (!blocked.includes(authorId)) {
    blocked.push(authorId);
    await writeJSON(BLOCKED_KEY, blocked);
  }
}

/**
 * getBlockedUsers — list of blocked author ids.
 * @returns {Promise<string[]>}
 */
export async function getBlockedUsers() {
  return readJSON(BLOCKED_KEY, []);
}

// NOTE(store-compliance / App Store 2.1, report D1):
// The community feed is genuine user-generated content ONLY. There is NO seeding
// of fake/sample posts — nothing may be presented as other users' real content
// when it isn't. A new user sees a proper empty state until real posts exist.
// When a real backend is wired in (see SWAPPABLE BOUNDARY above), getFeed will
// return actual posts authored by real users; the contract stays unchanged.

export default {
  getFeed,
  createPost,
  toggleLike,
  reportPost,
  blockUser,
  getBlockedUsers,
};
