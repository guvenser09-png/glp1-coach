// SocialScreen — Community feed for the GLP-1 Coach app.
// Local-only (AsyncStorage via socialService) but written to be App-Store UGC
// compliant: community guidelines acknowledgement, per-post report + block.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  radii,
  spacing,
  typography,
  useTheme,
} from '../theme';
import {
  Screen,
  Card,
  Chip,
  Badge,
  PrimaryButton,
  SecondaryButton,
} from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import * as socialService from '../services/socialService';

const GUIDELINES_FLAG_KEY = 'social_guidelines_ack_v1';
const MAX_TEXT = 500;

const FILTERS = ['all', 'injection', 'meal'];
const COMPOSE_TYPES = ['injection', 'meal', 'general'];

// Relative time helper (bilingual).
function relativeTime(iso, isTr) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  const min = Math.floor(diffSec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (diffSec < 60) return isTr ? 'şimdi' : 'now';
  if (min < 60) return isTr ? `${min} dk` : `${min}m`;
  if (hr < 24) return isTr ? `${hr} sa` : `${hr}h`;
  if (day < 7) return isTr ? `${day} gün` : `${day}d`;
  return new Date(iso).toLocaleDateString(isTr ? 'tr-TR' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function initialsOf(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}

// Deterministic avatar tint from author id so each member keeps a stable color.
const AVATAR_TINTS = [
  '#4F46E5',
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#EC4899',
  '#8B5CF6',
  '#14B8A6',
];
function tintFor(id) {
  const s = String(id || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_TINTS[Math.abs(h) % AVATAR_TINTS.length];
}

export default function SocialScreen() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isTr = language === 'tr';
  const { colors, shadow } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadow), [colors, shadow]);

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  // Compose modal state.
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeType, setComposeType] = useState('general');
  const [composeText, setComposeText] = useState('');
  const [composePhoto, setComposePhoto] = useState(null);
  const [composeProtein, setComposeProtein] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Guidelines acknowledgement.
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);
  const [guidelinesAck, setGuidelinesAck] = useState(true); // assume true until checked

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadFeed = useCallback(
    async (nextFilter = filter) => {
      try {
        const data = await socialService.getFeed({ filter: nextFilter });
        if (mountedRef.current) setPosts(data);
      } catch (e) {
        console.warn('SocialScreen: failed to load feed', e);
        if (mountedRef.current) setPosts([]);
      }
    },
    [filter]
  );

  // Mount: check guidelines flag, load feed.
  // NOTE(store-compliance / App Store 2.1): no fake/sample posts are seeded —
  // the feed is genuine user-generated content only. A new user sees a proper
  // empty state ("Be the first to post") until real posts exist.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const ack = await AsyncStorage.getItem(GUIDELINES_FLAG_KEY);
        if (!cancelled) setGuidelinesAck(ack === 'true');
        await loadFeed(filter);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSelectFilter = useCallback(
    async (next) => {
      setFilter(next);
      setLoading(true);
      await loadFeed(next);
      setLoading(false);
    },
    [loadFeed]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFeed(filter);
    setRefreshing(false);
  }, [loadFeed, filter]);

  const acknowledgeGuidelines = useCallback(async () => {
    await AsyncStorage.setItem(GUIDELINES_FLAG_KEY, 'true');
    setGuidelinesAck(true);
    setGuidelinesOpen(false);
    // Open composer right after acknowledging.
    openComposer(true);
  }, []);

  // Open the composer — but force the guidelines gate first if not acknowledged.
  const openComposer = useCallback(
    (skipGate = false) => {
      if (!skipGate && !guidelinesAck) {
        setGuidelinesOpen(true);
        return;
      }
      setComposeType('general');
      setComposeText('');
      setComposePhoto(null);
      setComposeProtein('');
      setComposeOpen(true);
    },
    [guidelinesAck]
  );

  const pickMealPhoto = useCallback(async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          isTr ? 'İzin gerekli' : 'Permission needed',
          isTr
            ? 'Fotoğraf eklemek için galeri erişimine izin verin.'
            : 'Please allow photo library access to add a photo.'
        );
        return;
      }
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!picked.canceled && picked.assets && picked.assets.length > 0) {
        setComposePhoto(picked.assets[0].uri);
      }
    } catch (e) {
      console.warn('SocialScreen: image pick failed', e);
    }
  }, [isTr]);

  const submitPost = useCallback(async () => {
    const text = composeText.trim();
    if (!text) {
      Alert.alert(
        isTr ? 'Boş gönderi' : 'Empty post',
        isTr
          ? 'Lütfen paylaşmadan önce bir şeyler yazın.'
          : 'Please write something before sharing.'
      );
      return;
    }
    setSubmitting(true);
    try {
      await socialService.createPost({
        type: composeType,
        text,
        mealPhotoUri: composeType === 'meal' ? composePhoto || undefined : undefined,
        protein:
          composeType === 'meal' && composeProtein
            ? Number(composeProtein)
            : undefined,
        authorId: user?.uid || 'me',
        authorName: user?.displayName || (isTr ? 'Sen' : 'You'),
      });
      setComposeOpen(false);
      await loadFeed(filter);
    } catch (e) {
      console.warn('SocialScreen: create post failed', e);
      Alert.alert(
        isTr ? 'Hata' : 'Error',
        isTr ? 'Gönderi paylaşılamadı.' : 'Could not share your post.'
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    composeText,
    composeType,
    composePhoto,
    composeProtein,
    user,
    isTr,
    loadFeed,
    filter,
  ]);

  const onToggleLike = useCallback(async (postId) => {
    // Optimistic update.
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              likedByMe: !p.likedByMe,
              likes: Math.max(0, (p.likes || 0) + (p.likedByMe ? -1 : 1)),
            }
          : p
      )
    );
    try {
      await socialService.toggleLike(postId);
    } catch (e) {
      console.warn('SocialScreen: like failed', e);
      // Roll back on failure.
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                likedByMe: !p.likedByMe,
                likes: Math.max(0, (p.likes || 0) + (p.likedByMe ? -1 : 1)),
              }
            : p
        )
      );
    }
  }, []);

  const onOverflow = useCallback(
    (post) => {
      const reportTitle = isTr ? 'Gönderiyi bildir' : 'Report post';
      const blockTitle = isTr
        ? `${post.authorName} kullanıcısını engelle`
        : `Block ${post.authorName}`;
      const cancel = isTr ? 'Vazgeç' : 'Cancel';

      const doReport = () => {
        const reasons = isTr
          ? ['Uygunsuz içerik', 'Spam', 'Taciz', 'Yanlış bilgi']
          : ['Inappropriate', 'Spam', 'Harassment', 'Misinformation'];
        Alert.alert(
          reportTitle,
          isTr ? 'Bir neden seçin.' : 'Choose a reason.',
          [
            ...reasons.map((reason) => ({
              text: reason,
              onPress: async () => {
                await socialService.reportPost(post.id, reason);
                await loadFeed(filter);
                Alert.alert(
                  isTr ? 'Teşekkürler' : 'Thank you',
                  isTr
                    ? 'Bildiriminiz incelenecektir.'
                    : 'Your report will be reviewed.'
                );
              },
            })),
            { text: cancel, style: 'cancel' },
          ]
        );
      };

      const doBlock = () => {
        Alert.alert(blockTitle, isTr
          ? 'Bu kullanıcının gönderileri akışınızdan kaldırılacak.'
          : "This user's posts will be removed from your feed.", [
          {
            text: isTr ? 'Engelle' : 'Block',
            style: 'destructive',
            onPress: async () => {
              await socialService.blockUser(post.authorId);
              await loadFeed(filter);
            },
          },
          { text: cancel, style: 'cancel' },
        ]);
      };

      Alert.alert(
        isTr ? 'Seçenekler' : 'Options',
        post.authorName,
        [
          { text: reportTitle, onPress: doReport },
          { text: blockTitle, style: 'destructive', onPress: doBlock },
          { text: cancel, style: 'cancel' },
        ]
      );
    },
    [isTr, loadFeed, filter]
  );

  const typeMeta = useMemo(
    () => ({
      injection: {
        icon: '💉',
        label: isTr ? 'İğne' : 'Injection',
        tone: 'info',
      },
      meal: {
        icon: '🍽️',
        label: isTr ? 'Öğün' : 'Meal',
        tone: 'success',
      },
      general: {
        icon: '💬',
        label: isTr ? 'Genel' : 'General',
        tone: 'neutral',
      },
    }),
    [isTr]
  );

  const filterLabel = useCallback(
    (f) => {
      if (f === 'all') return isTr ? 'Tümü' : 'All';
      if (f === 'injection') return `💉 ${isTr ? 'İğne' : 'Injection'}`;
      return `🍽️ ${isTr ? 'Öğün' : 'Meal'}`;
    },
    [isTr]
  );

  const composeTypeLabel = useCallback(
    (tType) => {
      if (tType === 'injection')
        return `💉 ${isTr ? 'İğne deneyimi' : 'Injection experience'}`;
      if (tType === 'meal') return `🍽️ ${isTr ? 'Öğün paylaşımı' : 'Meal share'}`;
      return `💬 ${isTr ? 'Genel' : 'General'}`;
    },
    [isTr]
  );

  const renderPost = useCallback(
    ({ item }) => {
      const meta = typeMeta[item.type] || typeMeta.general;
      return (
        <Card style={styles.postCard} padding={spacing.cardPadding}>
          {/* Header row */}
          <View style={styles.postHeader}>
            <View
              style={[styles.avatar, { backgroundColor: tintFor(item.authorId) }]}
            >
              <Text style={styles.avatarText}>{initialsOf(item.authorName)}</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.authorName} numberOfLines={1}>
                {item.authorName}
              </Text>
              <Text style={styles.timeText}>
                {relativeTime(item.createdAt, isTr)}
              </Text>
            </View>
            <Pressable
              onPress={() => onOverflow(item)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={isTr ? 'Seçenekler' : 'Options'}
              style={styles.overflowBtn}
            >
              <Text style={styles.overflowText}>···</Text>
            </Pressable>
          </View>

          {/* Type badge */}
          <Badge
            tone={meta.tone}
            label={`${meta.icon} ${meta.label}`}
            style={styles.typeBadge}
          />

          {/* Body */}
          {!!item.text && <Text style={styles.postText}>{item.text}</Text>}

          {/* Meal photo */}
          {!!item.mealPhotoUri && (
            <Image
              source={{ uri: item.mealPhotoUri }}
              style={styles.mealPhoto}
              resizeMode="cover"
              accessible
              accessibilityRole="image"
              accessibilityLabel={
                isTr
                  ? `${item.authorName} tarafından paylaşılan öğün fotoğrafı`
                  : `Meal photo by ${item.authorName}`
              }
            />
          )}

          {/* Protein badge */}
          {item.protein != null && (
            <Badge
              tone="success"
              label={`💪 ${item.protein}g ${isTr ? 'protein' : 'protein'}`}
              style={styles.proteinBadge}
            />
          )}

          {/* Footer: like */}
          <View style={styles.postFooter}>
            <Pressable
              onPress={() => onToggleLike(item.id)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ selected: !!item.likedByMe }}
              accessibilityLabel={
                item.likedByMe
                  ? isTr
                    ? `Beğeniyi geri al, ${item.likes || 0} beğeni`
                    : `Unlike, ${item.likes || 0} likes`
                  : isTr
                  ? `Beğen, ${item.likes || 0} beğeni`
                  : `Like, ${item.likes || 0} likes`
              }
              style={({ pressed }) => [
                styles.likeBtn,
                item.likedByMe && styles.likeBtnActive,
                pressed && styles.likePressed,
              ]}
            >
              <Text style={styles.likeIcon}>{item.likedByMe ? '❤️' : '🤍'}</Text>
              <Text
                style={[
                  styles.likeCount,
                  item.likedByMe && styles.likeCountActive,
                ]}
              >
                {item.likes || 0}
              </Text>
            </Pressable>
          </View>
        </Card>
      );
    },
    [typeMeta, isTr, onOverflow, onToggleLike, styles]
  );

  const listEmpty = useMemo(() => {
    if (loading) return null;
    const isAll = filter === 'all';
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyEmoji} accessibilityElementsHidden importantForAccessibility="no">
          🌱
        </Text>
        <Text style={styles.emptyTitle}>
          {isAll
            ? isTr
              ? 'İlk paylaşımı sen yap'
              : 'Be the first to post'
            : isTr
            ? 'Henüz gönderi yok'
            : 'No posts yet'}
        </Text>
        <Text style={styles.emptyText}>
          {isAll
            ? isTr
              ? 'Topluluk gerçek üyelerin paylaşımlarıyla büyür. Deneyimini paylaşarak başlat.'
              : 'This community grows from real members. Share your experience to kick it off.'
            : isTr
            ? 'Bu filtre için gönderi bulunamadı.'
            : 'No posts match this filter.'}
        </Text>
        {isAll && (
          <PrimaryButton
            title={isTr ? 'İlk gönderiyi oluştur' : 'Create the first post'}
            onPress={() => openComposer()}
            style={styles.emptyCta}
          />
        )}
      </View>
    );
  }, [loading, isTr, filter, openComposer, styles]);

  return (
    <Screen contentStyle={styles.screenContent}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isTr ? 'Topluluk' : 'Community'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {isTr
            ? 'Deneyimlerini paylaş, birbirinize destek olun'
            : 'Share experiences and support each other'}
        </Text>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Chip
            key={f}
            label={filterLabel(f)}
            selected={filter === f}
            onPress={() => onSelectFilter(f)}
            style={styles.filterChip}
          />
        ))}
      </View>

      {/* Feed */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>
            {isTr ? 'Yükleniyor…' : 'Loading…'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={listEmpty}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}

      {/* Floating compose button */}
      <Pressable
        onPress={() => openComposer()}
        accessibilityRole="button"
        accessibilityLabel={isTr ? 'Gönderi oluştur' : 'Create post'}
        style={({ pressed }) => [
          styles.fab,
          shadow('lg'),
          pressed && styles.fabPressed,
        ]}
      >
        <Text style={styles.fabIcon}>＋</Text>
      </Pressable>

      {/* ── Compose Modal ─────────────────────────────────────────────── */}
      <Modal
        visible={composeOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setComposeOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalRoot}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setComposeOpen(false)}
          />
          <SafeAreaView edges={['bottom']} style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScroll}
            >
              <Text style={styles.modalTitle}>
                {isTr ? 'Yeni gönderi' : 'New post'}
              </Text>

              {/* Type selector */}
              <Text style={styles.fieldLabel}>{isTr ? 'Tür' : 'Type'}</Text>
              <View style={styles.composeTypeRow}>
                {COMPOSE_TYPES.map((tType) => (
                  <Chip
                    key={tType}
                    label={composeTypeLabel(tType)}
                    selected={composeType === tType}
                    onPress={() => setComposeType(tType)}
                    style={styles.composeTypeChip}
                  />
                ))}
              </View>

              {/* Text */}
              <Text style={styles.fieldLabel}>
                {isTr ? 'Mesajın' : 'Your message'}
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder={
                  isTr
                    ? 'Deneyimini, ipucunu veya ilerlemeni paylaş…'
                    : 'Share your experience, a tip, or your progress…'
                }
                placeholderTextColor={colors.outline}
                value={composeText}
                onChangeText={setComposeText}
                multiline
                maxLength={MAX_TEXT}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>
                {composeText.length}/{MAX_TEXT}
              </Text>

              {/* Meal-only extras */}
              {composeType === 'meal' && (
                <View style={styles.mealExtras}>
                  {composePhoto ? (
                    <View style={styles.photoPreviewWrap}>
                      <Image
                        source={{ uri: composePhoto }}
                        style={styles.photoPreview}
                        resizeMode="cover"
                        accessible
                        accessibilityRole="image"
                        accessibilityLabel={
                          isTr
                            ? 'Seçilen öğün fotoğrafı önizlemesi'
                            : 'Selected meal photo preview'
                        }
                      />
                      <Pressable
                        onPress={() => setComposePhoto(null)}
                        style={styles.removePhotoBtn}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={isTr ? 'Fotoğrafı kaldır' : 'Remove photo'}
                      >
                        <Text style={styles.removePhotoText}>✕</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <SecondaryButton
                      title={isTr ? '📷 Fotoğraf ekle' : '📷 Add photo'}
                      onPress={pickMealPhoto}
                      style={styles.addPhotoBtn}
                    />
                  )}

                  <Text style={styles.fieldLabel}>
                    {isTr ? 'Protein (g) — opsiyonel' : 'Protein (g) — optional'}
                  </Text>
                  <TextInput
                    style={styles.proteinInput}
                    placeholder={isTr ? 'örn. 30' : 'e.g. 30'}
                    placeholderTextColor={colors.outline}
                    value={composeProtein}
                    onChangeText={(v) =>
                      setComposeProtein(v.replace(/[^0-9]/g, '').slice(0, 3))
                    }
                    keyboardType="number-pad"
                  />
                </View>
              )}

              <PrimaryButton
                title={isTr ? 'Paylaş' : 'Share'}
                onPress={submitPost}
                loading={submitting}
                style={styles.submitBtn}
              />
              <SecondaryButton
                title={isTr ? 'Vazgeç' : 'Cancel'}
                onPress={() => setComposeOpen(false)}
                style={styles.cancelBtn}
              />

              <Text style={styles.modalDisclaimer}>
                {isTr
                  ? 'Gönderiler topluluk kurallarına tabidir. Uygunsuz içerik bildirilebilir.'
                  : 'Posts are subject to community guidelines. Inappropriate content can be reported.'}
              </Text>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Community Guidelines (one-time) ───────────────────────────── */}
      <Modal
        visible={guidelinesOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setGuidelinesOpen(false)}
      >
        <View style={styles.guidelinesRoot}>
          <Card style={styles.guidelinesCard} elevation="lg">
            <Text style={styles.guidelinesEmoji}>🤝</Text>
            <Text style={styles.guidelinesTitle}>
              {isTr ? 'Topluluk Kuralları' : 'Community Guidelines'}
            </Text>
            <Text style={styles.guidelinesText}>
              {isTr
                ? 'Bu topluluk destekleyici ve güvenli kalmalı. Lütfen:'
                : 'This community should stay supportive and safe. Please:'}
            </Text>
            <View style={styles.bulletList}>
              {(isTr
                ? [
                    'Saygılı ol; taciz, nefret söylemi veya uygunsuz içerik yasaktır.',
                    'Tıbbi tavsiye yerine kişisel deneyim paylaş; doktoruna danış.',
                    'Spam, reklam veya kişisel bilgi paylaşma.',
                    'Uygunsuz gönderileri bildir — bildirimler incelenir.',
                  ]
                : [
                    'Be respectful — no harassment, hate speech, or objectionable content.',
                    'Share personal experience, not medical advice; consult your doctor.',
                    'No spam, ads, or sharing personal information.',
                    'Report content that breaks the rules — reports are reviewed.',
                  ]
              ).map((line, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{line}</Text>
                </View>
              ))}
            </View>
            <PrimaryButton
              title={isTr ? 'Anladım ve kabul ediyorum' : 'I understand and agree'}
              onPress={acknowledgeGuidelines}
              style={styles.guidelinesBtn}
            />
            <Pressable
              onPress={() => setGuidelinesOpen(false)}
              style={styles.guidelinesDismiss}
            >
              <Text style={styles.guidelinesDismissText}>
                {isTr ? 'Şimdi değil' : 'Not now'}
              </Text>
            </Pressable>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

const makeStyles = (colors, shadow) =>
  StyleSheet.create({
  screenContent: {
    flex: 1,
  },

  // Header
  header: {
    paddingHorizontal: spacing.containerMargin,
    paddingTop: spacing.stackSm,
    paddingBottom: spacing.stackSm,
  },
  headerTitle: {
    ...typography.headlineLg,
    color: colors.onSurface,
  },
  headerSubtitle: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },

  // Filters
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.stackSm,
    paddingHorizontal: spacing.containerMargin,
    paddingBottom: spacing.stackSm,
  },
  filterChip: {
    marginRight: 0,
  },

  // List
  listContent: {
    paddingHorizontal: spacing.containerMargin,
    paddingTop: spacing.stackSm,
    paddingBottom: 120,
  },

  // Post card
  postCard: {
    marginBottom: spacing.stackMd,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: colors.white,
  },
  headerText: {
    flex: 1,
    marginLeft: spacing.stackSm + 2,
  },
  authorName: {
    ...typography.labelMd,
    fontSize: 15,
    color: colors.onSurface,
  },
  timeText: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    marginTop: 1,
  },
  overflowBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  overflowText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    lineHeight: 22,
    color: colors.outline,
  },
  typeBadge: {
    marginTop: spacing.stackSm + 2,
  },
  postText: {
    ...typography.bodyMd,
    color: colors.onSurface,
    marginTop: spacing.stackSm,
  },
  mealPhoto: {
    width: '100%',
    height: 200,
    borderRadius: radii.lg,
    marginTop: spacing.stackSm + 2,
    backgroundColor: colors.surfaceVariant,
  },
  proteinBadge: {
    marginTop: spacing.stackSm + 2,
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.stackSm + 4,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  likeBtnActive: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBg,
  },
  likePressed: {
    opacity: 0.7,
  },
  likeIcon: {
    fontSize: 15,
    marginRight: 6,
  },
  likeCount: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
  },
  likeCountActive: {
    color: colors.danger,
  },

  // Loading / empty
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginTop: spacing.stackSm,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: spacing.stackLg,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.stackSm,
  },
  emptyTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
    textAlign: 'center',
  },
  emptyText: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: spacing.stackSm,
  },
  emptyCta: {
    marginTop: spacing.stackMd,
    alignSelf: 'stretch',
  },

  // FAB
  fab: {
    position: 'absolute',
    right: spacing.containerMargin,
    bottom: spacing.stackLg + 8,
    width: 60,
    height: 60,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
  fabIcon: {
    fontFamily: 'Inter_400Regular',
    fontSize: 34,
    lineHeight: 38,
    color: colors.white,
    marginTop: Platform.OS === 'android' ? -2 : 0,
  },

  // Compose modal
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: '90%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.outlineVariant,
    marginTop: spacing.stackSm,
    marginBottom: spacing.stackSm,
  },
  modalScroll: {
    paddingHorizontal: spacing.containerMargin,
    paddingBottom: spacing.stackLg,
  },
  modalTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
    marginBottom: spacing.stackMd,
  },
  fieldLabel: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.stackSm,
    marginTop: spacing.stackSm,
  },
  composeTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.stackSm,
  },
  composeTypeChip: {
    marginRight: 0,
  },
  textInput: {
    ...typography.bodyMd,
    color: colors.onSurface,
    backgroundColor: colors.surfaceVariant,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.stackMd,
    minHeight: 120,
  },
  charCount: {
    ...typography.labelSm,
    color: colors.outline,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  mealExtras: {
    marginTop: spacing.stackSm,
  },
  addPhotoBtn: {
    marginBottom: spacing.stackSm,
  },
  photoPreviewWrap: {
    marginBottom: spacing.stackSm,
  },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceVariant,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: spacing.stackSm,
    right: spacing.stackSm,
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: colors.white,
  },
  proteinInput: {
    ...typography.bodyMd,
    color: colors.onSurface,
    backgroundColor: colors.surfaceVariant,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: spacing.stackMd,
    paddingVertical: spacing.stackSm + 4,
  },
  submitBtn: {
    marginTop: spacing.stackLg,
  },
  cancelBtn: {
    marginTop: spacing.stackSm,
  },
  modalDisclaimer: {
    ...typography.labelSm,
    color: colors.outline,
    textAlign: 'center',
    marginTop: spacing.stackMd,
  },

  // Guidelines modal
  guidelinesRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.containerMargin,
  },
  guidelinesCard: {
    width: '100%',
    maxWidth: 420,
  },
  guidelinesEmoji: {
    fontSize: 40,
    textAlign: 'center',
    marginBottom: spacing.stackSm,
  },
  guidelinesTitle: {
    ...typography.headlineMd,
    color: colors.onSurface,
    textAlign: 'center',
    marginBottom: spacing.stackSm,
  },
  guidelinesText: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.stackSm,
  },
  bulletList: {
    marginBottom: spacing.stackMd,
  },
  bulletRow: {
    flexDirection: 'row',
    marginTop: spacing.stackSm,
  },
  bulletDot: {
    ...typography.bodyMd,
    color: colors.primary,
    marginRight: spacing.stackSm,
  },
  bulletText: {
    ...typography.bodyMd,
    color: colors.onSurface,
    flex: 1,
  },
  guidelinesBtn: {
    marginTop: spacing.stackSm,
  },
  guidelinesDismiss: {
    alignSelf: 'center',
    paddingVertical: spacing.stackSm,
    marginTop: spacing.stackSm,
  },
  guidelinesDismissText: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
  },
  });
