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
const SEED_FLAG_KEY = 'social_seeded_v1';

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

/**
 * seedIfEmpty — on first run, populate ~8 realistic bilingual sample posts so
 * the community feed looks alive. Runs at most once (guarded by a flag).
 * @param {string} language  'tr' | 'en'  (chooses which localized copy to seed)
 * @returns {Promise<void>}
 */
export async function seedIfEmpty(language) {
  const alreadySeeded = await readJSON(SEED_FLAG_KEY, false);
  const existing = await getAllPostsRaw();
  if (alreadySeeded || existing.length > 0) return;

  const isTr = language === 'tr';
  const now = Date.now();
  const hrs = (h) => new Date(now - h * 60 * 60 * 1000).toISOString();

  // Bilingual sample community members + posts.
  const samples = [
    {
      authorId: 'seed_ayse',
      authorName: isTr ? 'Ayşe K.' : 'Emma R.',
      type: 'injection',
      text: isTr
        ? '3. haftamdayım, ilk doz bulantısı geçti. Enjeksiyonu uyluk yerine karın bölgesine yapınca çok daha rahat oldu. Sabırlı olun!'
        : "Week 3 here, the first-dose nausea has faded. Switching the shot from my thigh to my belly made it way more comfortable. Hang in there!",
      likes: 24,
      likedByMe: false,
      createdAt: hrs(2),
    },
    {
      authorId: 'seed_mehmet',
      authorName: isTr ? 'Mehmet T.' : 'James L.',
      type: 'meal',
      text: isTr
        ? 'Bugünkü kahvaltım: yumurta, lor peyniri ve avokado. Protein dolu ve beni öğlene kadar tok tutuyor.'
        : 'Breakfast today: eggs, cottage cheese and avocado. Packed with protein and keeps me full until lunch.',
      protein: 32,
      likes: 41,
      likedByMe: false,
      createdAt: hrs(5),
    },
    {
      authorId: 'seed_zeynep',
      authorName: isTr ? 'Zeynep A.' : 'Sofia M.',
      type: 'injection',
      text: isTr
        ? 'Dozumu 0.5mg’a çıkardım. İştahım belirgin şekilde azaldı ama bol su içmeyi unutmuyorum. Yan etki yönetimi her şey!'
        : 'Bumped my dose to 0.5mg. Appetite dropped noticeably, but I make sure to drink plenty of water. Managing side effects is everything!',
      likes: 18,
      likedByMe: false,
      createdAt: hrs(9),
    },
    {
      authorId: 'seed_can',
      authorName: isTr ? 'Can D.' : 'Noah P.',
      type: 'meal',
      text: isTr
        ? 'Akşam yemeği: ızgara tavuk, kinoa ve brokoli. Küçük porsiyonlar ama yeterince doyurucu.'
        : 'Dinner: grilled chicken, quinoa and broccoli. Small portions but genuinely satisfying.',
      protein: 45,
      likes: 29,
      likedByMe: false,
      createdAt: hrs(14),
    },
    {
      authorId: 'seed_elif',
      authorName: isTr ? 'Elif S.' : 'Olivia W.',
      type: 'general',
      text: isTr
        ? '2 ayda 6 kilo verdim ve enerjim çok daha iyi. Bu topluluğun desteği motivasyonumu yüksek tutuyor, teşekkürler!'
        : "Down 13 lbs in 2 months and my energy is so much better. This community's support keeps my motivation high — thank you all!",
      likes: 57,
      likedByMe: false,
      createdAt: hrs(20),
    },
    {
      authorId: 'seed_burak',
      authorName: isTr ? 'Burak Y.' : 'Liam H.',
      type: 'injection',
      text: isTr
        ? 'İğne korkusu olanlara: enjeksiyon kalemini buzdolabından çıkarıp 20 dk oda sıcaklığında beklettim, neredeyse hiç acımadı.'
        : 'For anyone scared of needles: I let the pen sit at room temperature for 20 min after taking it out of the fridge — barely felt a thing.',
      likes: 33,
      likedByMe: false,
      createdAt: hrs(28),
    },
    {
      authorId: 'seed_deniz',
      authorName: isTr ? 'Deniz Ö.' : 'Ava C.',
      type: 'meal',
      text: isTr
        ? 'Protein hedefimi tutturmak için Yunan yoğurdu + chia tohumu ataştırıyorum. Basit ve etkili.'
        : 'To hit my protein goal I snack on Greek yogurt + chia seeds. Simple and effective.',
      protein: 20,
      likes: 22,
      likedByMe: false,
      createdAt: hrs(36),
    },
    {
      authorId: 'seed_selin',
      authorName: isTr ? 'Selin B.' : 'Mia F.',
      type: 'general',
      text: isTr
        ? 'Platoya girdim ve biraz moralim bozulmuştu. Doktorumla konuştum, yürüyüşü artırdım ve tekrar hareket başladı. Pes etmeyin!'
        : "Hit a plateau and felt discouraged. Talked to my doctor, upped my daily walks, and the scale started moving again. Don't give up!",
      likes: 48,
      likedByMe: false,
      createdAt: hrs(46),
    },
  ];

  const seeded = samples.map((s) => ({ id: genId(), ...s }));
  await writeJSON(POSTS_KEY, seeded);
  await writeJSON(SEED_FLAG_KEY, true);
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
