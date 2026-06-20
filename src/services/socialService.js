// socialService — Community/Social feed data layer (Supabase-backed).
//
// ─────────────────────────────────────────────────────────────────────────────
// REAL BACKEND
// ─────────────────────────────────────────────────────────────────────────────
// This module is the SINGLE source of truth for community data. It is backed by
// Supabase (Postgres + RLS + Auth). Every exported function below is an async
// boundary with a STABLE signature — the UI (SocialScreen) depends only on this
// contract, so the screen stays untouched.
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
//
// Tables (snake_case in DB ↔ camelCase in app):
//   social_posts(id, author_id, author_name, type, text, meal_photo_uri,
//                protein, likes, created_at)
//   post_likes(post_id, user_id)
//   post_reports(id, post_id, reporter_id, reason)
//   blocked_users(blocker_id, blocked_id)
//
// RLS is ON: every table is scoped to auth.uid() automatically. We do NOT filter
// by user id manually for owner tables, but we MUST set the owning id on INSERT.
// Robust: every call is wrapped in try/catch; if not configured or on error we
// return a safe value so the UI never crashes.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

// ── Identity helper ──────────────────────────────────────────────────────────

async function getSessionUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data?.user || null;
  } catch (e) {
    console.warn('socialService: getSessionUser failed', e);
    return null;
  }
}

// Best-effort display name for the current user: profile name → email → 'You'.
async function getMyDisplayName(user) {
  try {
    if (user?.id) {
      const { data } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.name) return data.name;
      if (data?.email) return data.email;
    }
  } catch (e) {
    // ignore — fall through to auth email
  }
  return user?.email || 'You';
}

// ── Row → Post mapper ────────────────────────────────────────────────────────

function mapPost(row, likedByMe = false) {
  const post = {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name || 'Anonymous',
    type: row.type || 'general',
    text: row.text || '',
    likes: Number(row.likes || 0),
    likedByMe: !!likedByMe,
    createdAt: row.created_at,
  };
  if (row.meal_photo_uri) post.mealPhotoUri = row.meal_photo_uri;
  if (row.protein != null && !Number.isNaN(Number(row.protein))) {
    post.protein = Number(row.protein);
  }
  return post;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * getFeed — newest-first list of visible posts.
 * Excludes posts authored by users I've blocked and posts I've reported.
 * Computes likedByMe from post_likes for the current user.
 * @param {{ filter?: 'all'|'injection'|'meal' }} opts
 * @returns {Promise<Post[]>}
 */
export async function getFeed({ filter = 'all' } = {}) {
  if (!isSupabaseConfigured()) return [];
  try {
    const user = await getSessionUser();

    // Fetch posts (newest first), plus my blocks/reports/likes in parallel.
    const [postsRes, blockedIds, reportedIds, likedIds] = await Promise.all([
      supabase
        .from('social_posts')
        .select(
          'id, author_id, author_name, type, text, meal_photo_uri, protein, likes, created_at'
        )
        .order('created_at', { ascending: false }),
      getBlockedUsers(),
      getReportedPostIds(),
      getMyLikedPostIds(user?.id),
    ]);

    if (postsRes.error) {
      console.warn('socialService: getFeed select failed', postsRes.error);
      return [];
    }

    const rows = postsRes.data || [];
    const blockedSet = new Set(blockedIds);
    const reportedSet = new Set(reportedIds);
    const likedSet = new Set(likedIds);

    let visible = rows.filter(
      (r) => !blockedSet.has(r.author_id) && !reportedSet.has(r.id)
    );

    if (filter === 'injection' || filter === 'meal') {
      visible = visible.filter((r) => (r.type || 'general') === filter);
    }

    return visible.map((r) => mapPost(r, likedSet.has(r.id)));
  } catch (e) {
    console.warn('socialService: getFeed failed', e);
    return [];
  }
}

// Internal: the set of post ids the current user has liked.
async function getMyLikedPostIds(userId) {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', userId);
    if (error) return [];
    return (data || []).map((r) => r.post_id);
  } catch (e) {
    return [];
  }
}

// Internal: the set of post ids the current user has reported (hidden for me).
async function getReportedPostIds() {
  try {
    const { data, error } = await supabase
      .from('post_reports')
      .select('post_id');
    if (error) return [];
    return (data || []).map((r) => r.post_id);
  } catch (e) {
    return [];
  }
}

/**
 * createPost — add a new post authored by the current user.
 * The owning author_id is taken from the session (RLS owner column).
 * @param {{ type:'injection'|'meal'|'general', text:string, mealPhotoUri?:string, protein?:number, authorId?:string, authorName?:string }} input
 * @returns {Promise<Post|null>}
 */
export async function createPost({
  type = 'general',
  text = '',
  mealPhotoUri,
  protein,
  authorId,
  authorName,
} = {}) {
  if (!isSupabaseConfigured()) return null;
  try {
    const user = await getSessionUser();
    const ownerId = authorId || user?.id;
    if (!ownerId) {
      console.warn('socialService: createPost requires an authenticated user');
      return null;
    }
    const name = authorName || (await getMyDisplayName(user));

    const insertRow = {
      author_id: ownerId,
      author_name: name,
      type,
      text: String(text || '').trim(),
    };
    if (mealPhotoUri) insertRow.meal_photo_uri = mealPhotoUri;
    if (protein != null && !Number.isNaN(Number(protein))) {
      insertRow.protein = Number(protein);
    }

    const { data, error } = await supabase
      .from('social_posts')
      .insert(insertRow)
      .select(
        'id, author_id, author_name, type, text, meal_photo_uri, protein, likes, created_at'
      )
      .single();

    if (error) {
      console.warn('socialService: createPost insert failed', error);
      return null;
    }
    return mapPost(data, false);
  } catch (e) {
    console.warn('socialService: createPost failed', e);
    return null;
  }
}

/**
 * toggleLike — flip the current user's like on a post and keep the count synced.
 * @param {string} postId
 * @returns {Promise<Post|null>} the updated post (or null on error)
 */
export async function toggleLike(postId) {
  if (!isSupabaseConfigured() || !postId) return null;
  try {
    const user = await getSessionUser();
    if (!user?.id) return null;

    // Is it already liked by me?
    const { data: existing, error: existErr } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (existErr) {
      console.warn('socialService: toggleLike check failed', existErr);
      return null;
    }

    if (existing) {
      // Unlike.
      await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);
    } else {
      // Like.
      await supabase
        .from('post_likes')
        .insert({ post_id: postId, user_id: user.id });
    }

    // Recompute the like count from the source of truth and persist it.
    const { count } = await supabase
      .from('post_likes')
      .select('post_id', { count: 'exact', head: true })
      .eq('post_id', postId);

    const newLikes = typeof count === 'number' ? count : 0;

    const { data: updated, error: updErr } = await supabase
      .from('social_posts')
      .update({ likes: newLikes })
      .eq('id', postId)
      .select(
        'id, author_id, author_name, type, text, meal_photo_uri, protein, likes, created_at'
      )
      .maybeSingle();

    if (updErr || !updated) {
      // Count update may be blocked by RLS for non-owners; still return a
      // sensible post object so the UI reflects the new state.
      const { data: row } = await supabase
        .from('social_posts')
        .select(
          'id, author_id, author_name, type, text, meal_photo_uri, protein, likes, created_at'
        )
        .eq('id', postId)
        .maybeSingle();
      if (!row) return null;
      const post = mapPost(row, !existing);
      post.likes = newLikes;
      return post;
    }

    return mapPost(updated, !existing);
  } catch (e) {
    console.warn('socialService: toggleLike failed', e);
    return null;
  }
}

/**
 * reportPost — flag a post for moderator review and hide it from this user's feed.
 * @param {string} postId
 * @param {string} reason
 * @returns {Promise<void>}
 */
export async function reportPost(postId, reason) {
  if (!isSupabaseConfigured() || !postId) return;
  try {
    const user = await getSessionUser();
    if (!user?.id) return;
    await supabase.from('post_reports').insert({
      post_id: postId,
      reporter_id: user.id,
      reason: reason || 'unspecified',
    });
  } catch (e) {
    console.warn('socialService: reportPost failed', e);
  }
}

/**
 * blockUser — block an author; their posts disappear from the feed.
 * @param {string} authorId
 * @returns {Promise<void>}
 */
export async function blockUser(authorId) {
  if (!isSupabaseConfigured() || !authorId) return;
  try {
    const user = await getSessionUser();
    if (!user?.id) return;
    if (authorId === user.id) return; // can't block yourself
    await supabase.from('blocked_users').insert({
      blocker_id: user.id,
      blocked_id: authorId,
    });
  } catch (e) {
    console.warn('socialService: blockUser failed', e);
  }
}

/**
 * getBlockedUsers — list of blocked author ids for the current user.
 * @returns {Promise<string[]>}
 */
export async function getBlockedUsers() {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await supabase
      .from('blocked_users')
      .select('blocked_id');
    if (error) return [];
    return (data || []).map((r) => r.blocked_id);
  } catch (e) {
    console.warn('socialService: getBlockedUsers failed', e);
    return [];
  }
}

/**
 * seedIfEmpty — NO-OP.
 * The community feed is genuine user-generated content ONLY. There is NO seeding
 * of fake/sample posts (App Store 2.1 / report D1). A new user sees a proper
 * empty state until real posts exist. Kept for signature stability.
 * @param {string} _language
 * @returns {Promise<void>}
 */
export async function seedIfEmpty(_language) {
  // Intentionally does nothing — no fake data.
}

export default {
  getFeed,
  createPost,
  toggleLike,
  reportPost,
  blockUser,
  getBlockedUsers,
  seedIfEmpty,
};
