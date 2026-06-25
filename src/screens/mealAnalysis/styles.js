// StyleSheet factory extracted from MealAnalysisScreen (audit #12: god-component
// split). The component keeps the `useMemo(() => makeStyles(...))` call; only the
// factory definition lives here.
//
// Daily screen redesign (Stitch): top app bar, Maya bubble, Weekly Report hero,
// 7-day protein bar chart, Muscle Health, Today's Meals, collapsible "more".
// Tokens only (colors/semantic/shadow/spacing/radii/typography) so light AND
// dark mode both read correctly.
import { StyleSheet, Platform } from 'react-native';
import { fontFamily, typography, spacing, radii } from '../../theme';

export const makeStyles = (colors, semantic, shadow) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.containerMargin, paddingTop: spacing.stackMd },

  // ── Top app bar (matches Dashboard) ──
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.containerMargin,
    paddingVertical: 10,
  },
  appBarAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  appBarAvatarText: {
    color: colors.onPrimary, fontFamily: fontFamily.bodyBold, fontWeight: '700', fontSize: 15,
  },
  appBarTitle: {
    fontSize: 20, lineHeight: 26, fontFamily: fontFamily.headingBold, fontWeight: '700',
    color: colors.primary,
  },
  appBarBell: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  // ── Maya encouragement bubble ──
  mayaRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: spacing.stackLg },
  mayaBubble: {
    flex: 1,
    backgroundColor: colors.infoBg,
    borderRadius: radii.lg,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  mayaBubbleText: {
    ...typography.bodyMd, fontSize: 14, lineHeight: 20, color: colors.onSurface,
    fontFamily: fontFamily.bodyMedium, fontWeight: '500',
  },

  // ── Action row (camera + pills) ──
  actionRow: { flexDirection: 'row', gap: spacing.stackSm, marginBottom: spacing.stackLg },
  cameraBtn: {
    flex: 1.2, flexDirection: 'row', gap: 6, backgroundColor: colors.primary,
    borderRadius: radii.lg, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    ...shadow('sm'),
  },
  cameraBtnText: { color: colors.onPrimary, fontWeight: '700', ...typography.labelMd },
  actionPill: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radii.lg,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.outlineVariant,
  },
  actionPillText: { color: colors.primary, fontWeight: '700', ...typography.labelSm },

  // ── Section heading (shared) ──
  sectionHeading: {
    fontSize: 18, fontFamily: fontFamily.headingBold, fontWeight: '700',
    color: colors.onSurface, letterSpacing: -0.25,
  },

  // ── Weekly Report hero card ──
  weeklyCard: {
    borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radii.xl,
    marginBottom: spacing.stackLg,
  },
  weeklyTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  weeklyKicker: {
    ...typography.labelSm, color: colors.onSurfaceVariant, letterSpacing: 1.2,
    textTransform: 'uppercase', marginBottom: 6,
  },
  weeklyChangeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weeklyChangeValue: {
    fontFamily: fontFamily.headingExtraBold, fontWeight: '800', fontSize: 30, letterSpacing: -0.5,
  },
  weeklyChangeSub: { ...typography.labelSm, color: colors.onSurfaceVariant, marginLeft: 2 },
  weeklyEmptyValue: {
    fontFamily: fontFamily.headingBold, fontWeight: '700', fontSize: 24, color: colors.onSurface,
  },
  weeklyTotalLost: { ...typography.labelSm, color: colors.onSurfaceVariant, marginTop: 6 },
  weeklyRingValue: { fontFamily: fontFamily.headingBold, fontWeight: '800', fontSize: 14 },
  weeklyRingSub: { ...typography.labelSm, fontSize: 8, color: colors.onSurfaceVariant, marginTop: 1 },
  weeklyEmptyHint: {
    ...typography.bodyMd, fontSize: 13, lineHeight: 19, color: colors.onSurfaceVariant,
    marginTop: spacing.stackMd,
  },
  recBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.infoBg, borderRadius: radii.lg, padding: 12,
    marginTop: spacing.stackMd,
  },
  recIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  recText: { flex: 1, ...typography.bodyMd, fontSize: 13, lineHeight: 18, color: colors.onSurface },
  recBold: { fontFamily: fontFamily.bodyBold, fontWeight: '700', color: colors.primary },

  // ── 7-day protein bar chart ──
  chartCard: {
    borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radii.xl,
    marginBottom: spacing.stackLg,
  },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  chartTargetChip: {
    backgroundColor: colors.surfaceVariant, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 4,
  },
  chartTargetChipText: { ...typography.labelSm, fontWeight: '700', color: colors.onSurfaceVariant },
  chartLegend: { flexDirection: 'row', alignItems: 'center', marginTop: 16, flexWrap: 'wrap' },
  legendDot: { width: 9, height: 9, borderRadius: 5, marginRight: 5 },
  legendText: { ...typography.labelSm, color: colors.onSurfaceVariant },

  // ── Muscle Health card ──
  muscleCard: {
    borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radii.xl,
    marginBottom: spacing.stackMd,
  },
  muscleHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  muscleShield: {
    width: 48, height: 48, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center',
  },
  muscleSectionLabel: {
    ...typography.labelSm, color: colors.onSurfaceVariant, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 2,
  },
  muscleLabel: { fontSize: 15, fontFamily: fontFamily.headingBold, fontWeight: '700', marginBottom: 3 },
  muscleDesc: { fontSize: 13, fontFamily: fontFamily.body, color: colors.onSurfaceVariant, lineHeight: 18 },
  muscleNotClinical: {
    marginTop: 10, fontSize: 11, color: colors.outline, lineHeight: 15,
    fontStyle: 'italic', fontFamily: fontFamily.body,
  },
  disclaimerSpacing: { marginBottom: spacing.stackLg },

  // ── Muscle factor breakdown ──
  scoreFactors: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.outlineVariant,
  },
  scoreFactor: { alignItems: 'center', flex: 1 },
  scoreFactorDot: { fontSize: 14, marginBottom: 2 },
  scoreFactorText: { fontSize: 11, color: colors.onSurfaceVariant, textAlign: 'center', fontWeight: '500', fontFamily: fontFamily.bodySemiBold },

  // ── Today's Meals ──
  mealsSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.stackMd },
  mealsKcal: { ...typography.labelMd, color: colors.primary, fontFamily: fontFamily.bodyBold, fontWeight: '700' },
  mealsList: { gap: spacing.stackSm },
  mealRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: radii.lg, padding: 10,
    borderWidth: 1, borderColor: colors.outlineVariant,
    ...shadow('sm'),
  },
  mealThumb: { width: 56, height: 56, borderRadius: radii.md, backgroundColor: colors.surfaceVariant },
  mealThumbEmoji: {
    width: 56, height: 56, borderRadius: radii.md, backgroundColor: colors.surfaceVariant,
    alignItems: 'center', justifyContent: 'center',
  },
  mealThumbEmojiText: { fontSize: 28 },
  mealInfo: { flex: 1, minWidth: 0 },
  mealName: { ...typography.labelMd, fontFamily: fontFamily.headingSemiBold, fontWeight: '600', color: colors.onSurface },
  mealMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' },
  proteinPill: {
    backgroundColor: colors.successBg, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2,
  },
  proteinPillText: { ...typography.labelSm, fontSize: 10, fontWeight: '700', color: colors.success },
  mealKcal: { ...typography.labelSm, color: colors.onSurfaceVariant },
  mealTime: { ...typography.labelSm, color: colors.outline },
  mealDelete: { padding: 6 },

  // ── Empty states ──
  emptyCard: { marginBottom: 0 },
  emptyCardContent: { alignItems: 'center', paddingVertical: 12, gap: 10 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { ...typography.labelMd, fontWeight: '500', color: colors.onSurfaceVariant, textAlign: 'center' },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: radii.pill,
    paddingHorizontal: 16, paddingVertical: 9, marginTop: 2,
  },
  emptyCtaText: { color: colors.onPrimary, ...typography.labelMd, fontWeight: '700' },

  // ── Talk to Maya entry card ──
  mayaEntryCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radii.xl,
    borderWidth: 1, borderColor: colors.outlineVariant, padding: 14,
    marginTop: spacing.stackLg,
    ...shadow('md'),
  },
  mayaEntryLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  mayaEntryTitle: { fontFamily: fontFamily.headingBold, fontWeight: '700', fontSize: 16, color: colors.onSurface },
  mayaEntrySub: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18, color: colors.onSurfaceVariant, marginTop: 2 },

  // ── More details toggle + detail cards ──
  moreToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, marginTop: spacing.stackLg,
  },
  moreToggleText: { ...typography.labelMd, fontWeight: '700', color: colors.primary },
  detailCard: { marginBottom: spacing.stackMd },
  detailTitle: { fontFamily: fontFamily.headingSemiBold, fontSize: 16, fontWeight: '700', color: colors.onSurface, marginBottom: 14, flex: 1, marginRight: spacing.stackSm },

  // ── Image picker / analysis result (kept) ──
  imageCard: { overflow: 'hidden', marginBottom: spacing.gutter },
  pickedImage: { width: '100%', height: 200 },
  imageActions: { padding: spacing.gutter, gap: spacing.stackSm },
  imageActionsTop: { flexDirection: 'row', gap: spacing.stackSm },
  changeBtn: { flex: 1 },

  resultCard: { marginBottom: spacing.stackLg },
  resultHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing.stackMd,
  },
  resultFoodType: { ...typography.labelMd, fontFamily: fontFamily.headingSemiBold, fontSize: 16, color: colors.onSurface, flex: 1, marginRight: spacing.stackSm },
  muscleScoreBadge: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', ...shadow('sm'),
  },
  muscleScoreText: { fontSize: 14, fontWeight: '900', fontFamily: fontFamily.headingBold },
  macroChipsRow: { flexDirection: 'row', gap: spacing.stackSm, marginBottom: spacing.stackMd },
  macroChip: {
    flex: 1, alignItems: 'center', backgroundColor: colors.surfaceVariant,
    borderRadius: radii.md, paddingVertical: 12, paddingHorizontal: 6,
  },
  macroChipProtein: { backgroundColor: colors.successBg, borderWidth: 1, borderColor: colors.success },
  macroChipLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, marginBottom: 4, textAlign: 'center' },
  macroChipValue: { fontFamily: fontFamily.headingBold, fontSize: 17, fontWeight: '800', color: colors.onSurface },
  macroChipValueProtein: { color: colors.success },
  qualityTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  qualityTag: { backgroundColor: colors.infoBg, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
  qualityTagText: { ...typography.labelSm, fontWeight: '700', color: colors.primary },
  verdictRow: { flexDirection: 'row', marginBottom: spacing.stackSm },
  suggestionText: { ...typography.labelMd, fontWeight: '400', fontFamily: fontFamily.body, color: colors.onSurfaceVariant, lineHeight: 19, marginBottom: spacing.stackSm },
  smartSwapBox: {
    backgroundColor: colors.successBg, borderRadius: radii.md, padding: 10,
    borderLeftWidth: 3, borderLeftColor: colors.success, marginTop: 4,
  },
  smartSwapTitle: { ...typography.labelSm, fontWeight: '700', color: colors.success, marginBottom: 4 },
  smartSwapText: { ...typography.labelMd, fontWeight: '400', fontFamily: fontFamily.body, color: colors.onSurfaceVariant, lineHeight: 18 },

  // ── FAB ──
  fab: {
    position: 'absolute', right: spacing.containerMargin, bottom: spacing.stackLg,
    width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', ...shadow('lg'),
  },
  fabIcon: { color: colors.onPrimary, fontSize: 34, fontWeight: '300', marginTop: Platform.OS === 'ios' ? -2 : -4 },

  // ── Calorie Balance (in details) ──
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  balanceItem: { alignItems: 'center', flex: 1 },
  balanceMinus: { fontSize: 18, fontWeight: '700', color: colors.outline, marginHorizontal: 2, fontFamily: fontFamily.headingBold },
  balanceValue: { fontFamily: fontFamily.headingBold, fontSize: 16, fontWeight: '800', color: colors.onSurface },
  balanceLabel: { fontSize: 10, color: colors.onSurfaceVariant, fontWeight: '600', marginTop: 2, textAlign: 'center', fontFamily: fontFamily.bodySemiBold },
  balanceResult: { borderWidth: 2, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 4 },
  balanceResultValue: { fontSize: 17, fontWeight: '900', fontFamily: fontFamily.headingBold },
  balanceNote: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 6, fontFamily: fontFamily.bodySemiBold },
  balanceBmrNote: { fontSize: 10, color: colors.outline, textAlign: 'center', fontFamily: fontFamily.body },

  // ── Apple Watch / HealthKit (in details) ──
  watchHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  watchRefreshBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.sm, backgroundColor: colors.infoBg },
  watchRefreshText: { fontFamily: fontFamily.bodySemiBold, fontSize: 12, fontWeight: '600', color: colors.primary },
  watchConnectNote: { fontFamily: fontFamily.body, fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 18, marginBottom: 12 },
  watchConnectBtn: { backgroundColor: colors.success, borderRadius: radii.md, paddingVertical: 13, alignItems: 'center', ...shadow('sm') },
  watchConnectBtnText: { color: colors.white, fontFamily: fontFamily.headingBold, fontWeight: '700', fontSize: 15 },
  watchStatsRow: { flexDirection: 'row', alignItems: 'center' },
  watchStatItem: { flex: 1, alignItems: 'center' },
  watchStatValue: { fontFamily: fontFamily.headingBold, fontSize: 22, fontWeight: '800', color: colors.success },
  watchStatLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant, marginTop: 3, textAlign: 'center' },
  watchStatDivider: { width: 1, height: 40, backgroundColor: colors.outlineVariant },

  // ── Sustainability / risk card (in details) ──
  riskCardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  riskCardEmoji: { fontSize: 26 },
  riskCardLabel: { fontSize: 15, fontFamily: fontFamily.headingBold, fontWeight: '700', marginBottom: 2 },
  riskCardDesc: { fontSize: 13, fontFamily: fontFamily.body, color: colors.onSurfaceVariant, lineHeight: 18 },
  riskFactors: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  riskFactorsTitle: { fontSize: 12, fontWeight: '700', color: colors.onSurface, marginBottom: 6, fontFamily: fontFamily.bodySemiBold },
  riskFactor: { fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 3, lineHeight: 16, fontFamily: fontFamily.body },

  // ── 14-Day Projection (in details) ──
  projectionRateLabel: { fontSize: 11, fontFamily: fontFamily.body, color: colors.outline, marginBottom: 12, textAlign: 'center' },
  projTotalRow: { alignItems: 'center', paddingVertical: 8 },
  projTotalValue: { fontSize: 30, fontFamily: fontFamily.headingBold, fontWeight: '800', color: colors.onSurface },
  projTotalLabel: { fontSize: 12, fontFamily: fontFamily.body, color: colors.onSurfaceVariant, marginTop: 2, textAlign: 'center' },
  projDisclaimer: { marginTop: 10, fontSize: 11, color: colors.outline, lineHeight: 15, textAlign: 'center', fontStyle: 'italic', fontFamily: fontFamily.body },

  // ── Recommendation insight cards (in details) ──
  aiInsightCard: { marginTop: spacing.stackSm },
  aiInsightInner: { flexDirection: 'row', alignItems: 'flex-start' },
  aiInsightBullet: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.stackSm,
  },
  aiInsightBulletText: { ...typography.labelMd, color: colors.onPrimary, fontWeight: '700' },
  aiInsightText: { ...typography.bodyMd, fontSize: 14, lineHeight: 20, color: colors.onSurface, flex: 1 },
  weeklyDisclaimer: {
    ...typography.labelSm, color: colors.outline, lineHeight: 16, textAlign: 'center',
    fontStyle: 'italic', marginTop: spacing.stackMd, paddingHorizontal: spacing.stackSm,
  },

  // ════════════════ CHAT (kept) ════════════════
  chatOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  chatBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  chatSheet: {
    backgroundColor: colors.background, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, overflow: 'hidden',
  },
  chatHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.outlineVariant,
    alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primary, padding: 14 },
  chatHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chatAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  chatName: { color: colors.white, fontFamily: fontFamily.headingBold, fontSize: 16, fontWeight: '700' },
  chatStatus: { color: 'rgba(255,255,255,0.8)', fontFamily: fontFamily.body, fontSize: 12, marginTop: 1 },
  chatClose: { padding: 8 },
  chatCloseText: { color: colors.white, fontFamily: fontFamily.headingSemiBold, fontSize: 18, fontWeight: '600' },
  chatMessages: { flex: 1 },
  bubble: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  bubbleUser: { justifyContent: 'flex-end' },
  bubbleCoach: { justifyContent: 'flex-start' },
  bubbleText: { maxWidth: '78%', borderRadius: 16, padding: 12 },
  bubbleTextUser: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTextCoach: { backgroundColor: colors.surface, borderBottomLeftRadius: 4, ...shadow('sm') },
  bubbleMsg: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  bubbleMsgUser: { color: colors.white },
  bubbleMsgCoach: { color: colors.onSurface },
  quickPrompts: { flexShrink: 0, maxHeight: 70, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.surfaceVariant },
  quickPrompt: { backgroundColor: colors.infoBg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start' },
  quickPromptText: { color: colors.primary, fontFamily: fontFamily.bodySemiBold, fontSize: 13, fontWeight: '600' },
  chatInputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.surfaceVariant,
  },
  chatInput: {
    flex: 1, borderWidth: 1.5, borderColor: colors.outlineVariant, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontFamily: fontFamily.body, fontSize: 14,
    color: colors.onSurface, maxHeight: 100, backgroundColor: colors.background,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: colors.outlineVariant },
  sendBtnText: { color: colors.white, fontSize: 18 },

  // ════════════════ MODALS (kept) ════════════════
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { fontFamily: fontFamily.headingBold, fontSize: 20, fontWeight: '700', color: colors.onSurface, marginBottom: 16 },
  fieldLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant, marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1.5, borderColor: colors.outlineVariant, borderRadius: radii.md,
    padding: 13, fontFamily: fontFamily.body, fontSize: 15, color: colors.onSurface, backgroundColor: colors.background,
  },
  portionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  portionPill: {
    flex: 1, borderWidth: 1.5, borderColor: colors.outlineVariant, borderRadius: radii.sm,
    paddingVertical: 10, alignItems: 'center', backgroundColor: colors.background,
  },
  portionPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  portionPillText: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },
  portionPillTextActive: { color: colors.white },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: colors.outlineVariant, borderRadius: radii.md, padding: 14, alignItems: 'center' },
  cancelBtnText: { color: colors.onSurfaceVariant, fontFamily: fontFamily.bodySemiBold, fontWeight: '600', fontSize: 15 },
  saveBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: radii.md, padding: 14, alignItems: 'center' },
  saveBtnText: { color: colors.white, fontFamily: fontFamily.headingBold, fontWeight: '700', fontSize: 15 },
  analyzeManualBtn: { backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: 14, alignItems: 'center', marginTop: 16, alignSelf: 'stretch' },
  analyzeManualBtnText: { color: colors.white, fontFamily: fontFamily.headingBold, fontWeight: '700', fontSize: 15 },

  // ── Optional meal-time selector (inside manual modal) ──
  mealTimeToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 44, marginTop: 14,
  },
  mealTimeToggleText: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant, flex: 1, marginRight: 8 },
  mealTimeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  mealTimePill: {
    borderWidth: 1.5, borderColor: colors.outlineVariant, borderRadius: radii.pill,
    paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, justifyContent: 'center',
    backgroundColor: colors.background,
  },
  mealTimePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  mealTimePillText: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },
  mealTimePillTextActive: { color: colors.white },

  // ── Meal Details (grouped by time, collapsible) ──
  mealDetailsToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 44, paddingVertical: 10, marginTop: spacing.stackSm,
  },
  mealDetailsToggleText: { ...typography.labelMd, fontWeight: '700', color: colors.primary },
  mealGroup: { marginBottom: spacing.stackMd },
  mealGroupHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
  },
  mealGroupTitle: { ...typography.labelMd, fontFamily: fontFamily.headingSemiBold, fontWeight: '700', color: colors.onSurface },
  mealGroupSubtotal: { ...typography.labelSm, fontWeight: '700', color: colors.onSurfaceVariant },
  mealGroupRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    backgroundColor: colors.surface, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10,
    minHeight: 44, borderWidth: 1, borderColor: colors.outlineVariant, marginBottom: spacing.stackSm,
  },
  mealGroupRowName: { ...typography.labelMd, fontWeight: '600', color: colors.onSurface, flex: 1, marginRight: 8 },
  mealGroupRowMeta: { ...typography.labelSm, color: colors.onSurfaceVariant },

  autoNutrition: { backgroundColor: colors.infoBg, borderRadius: radii.md, padding: 14, marginTop: 12, borderWidth: 1, borderColor: colors.outlineVariant },
  autoNutritionTitle: { fontFamily: fontFamily.headingBold, fontSize: 12, fontWeight: '700', color: colors.primaryDark, marginBottom: 10 },
  autoNutritionRow: { flexDirection: 'row', alignItems: 'center' },
  autoNutritionItem: { flex: 1, alignItems: 'center' },
  autoNutritionValue: { fontFamily: fontFamily.headingBold, fontSize: 20, fontWeight: '800', color: colors.primary },
  autoNutritionLabel: { fontFamily: fontFamily.body, fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
  autoNutritionDivider: { width: 1, height: 36, backgroundColor: colors.outlineVariant },
  autoNutritionNote: { fontFamily: fontFamily.body, fontSize: 11, color: colors.onSurfaceVariant, marginTop: 8, textAlign: 'center' },

  // Exercise modal
  exerciseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  exerciseTypeBtn: {
    width: '30%', flexGrow: 1, alignItems: 'center', paddingVertical: 12,
    backgroundColor: colors.background, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.outlineVariant,
  },
  exerciseTypeBtnActive: { backgroundColor: colors.infoBg, borderColor: colors.primary },
  exerciseTypeEmoji: { fontSize: 24, marginBottom: 4 },
  exerciseTypeName: { fontFamily: fontFamily.bodySemiBold, fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant, textAlign: 'center' },
  exerciseTypeNameActive: { color: colors.primary },
  calPreview: { backgroundColor: colors.successBg, borderRadius: radii.sm, padding: 12, marginTop: 16, borderWidth: 1, borderColor: colors.success },
  calPreviewText: { fontFamily: fontFamily.body, fontSize: 14, color: colors.onSurfaceVariant, textAlign: 'center' },
});
