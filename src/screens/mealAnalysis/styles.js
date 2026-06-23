// StyleSheet factory extracted from MealAnalysisScreen (audit #12: god-component
// split). The component keeps the `useMemo(() => makeStyles(...))` call; only the
// factory definition lives here. Behavior is unchanged.
import { StyleSheet, Platform } from 'react-native';
import { fontFamily, typography, spacing, radii } from '../../theme';

export const makeStyles = (colors, semantic, shadow) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.containerMargin, paddingTop: spacing.gutter },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.stackLg },
  heading: { ...typography.headlineMd, color: colors.onSurface, marginBottom: 4 },
  subheading: { ...typography.labelMd, fontWeight: '400', fontFamily: fontFamily.body, color: colors.onSurfaceVariant },
  coachBtn: {
    backgroundColor: colors.primary, borderRadius: radii.lg, paddingHorizontal: 14,
    paddingVertical: 10, alignItems: 'center', minWidth: 64,
    ...shadow('md'),
  },
  coachBtnEmoji: { fontSize: 20 },
  coachBtnText: { color: colors.onPrimary, ...typography.labelSm, fontWeight: '700', marginTop: 2 },

  // Chat styles
  chatOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  chatBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  chatSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    overflow: 'hidden',
  },
  chatHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.outlineVariant, alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.primary, padding: 14,
  },
  chatHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chatAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  chatAvatarEmoji: { fontSize: 22 },
  chatName: { color: colors.white, fontFamily: fontFamily.headingBold, fontSize: 16, fontWeight: '700' },
  chatStatus: { color: 'rgba(255,255,255,0.8)', fontFamily: fontFamily.body, fontSize: 12, marginTop: 1 },
  chatClose: { padding: 8 },
  chatCloseText: { color: colors.white, fontFamily: fontFamily.headingSemiBold, fontSize: 18, fontWeight: '600' },
  chatMessages: { flex: 1 },
  bubble: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  bubbleUser: { justifyContent: 'flex-end' },
  bubbleCoach: { justifyContent: 'flex-start' },
  bubbleEmoji: { fontSize: 20, marginRight: 8, marginBottom: 4 },
  bubbleText: { maxWidth: '78%', borderRadius: 16, padding: 12 },
  bubbleTextUser: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTextCoach: { backgroundColor: colors.surface, borderBottomLeftRadius: 4, ...shadow('sm') },
  bubbleMsg: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  bubbleMsgUser: { color: colors.white },
  bubbleMsgCoach: { color: colors.onSurface },
  quickPrompts: { flexShrink: 0, maxHeight: 70, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.surfaceVariant },
  quickPrompt: {
    backgroundColor: colors.infoBg, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start',
  },
  quickPromptText: { color: colors.primary, fontFamily: fontFamily.bodySemiBold, fontSize: 13, fontWeight: '600' },
  chatInputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: 12, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.surfaceVariant,
  },
  chatInput: {
    flex: 1, borderWidth: 1.5, borderColor: colors.outlineVariant, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontFamily: fontFamily.body, fontSize: 14,
    color: colors.onSurface, maxHeight: 100, backgroundColor: colors.background,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.outlineVariant },
  sendBtnText: { color: colors.white, fontSize: 18 },

  freeBanner: {
    backgroundColor: colors.infoBg, borderRadius: radii.md, padding: 10,
    marginBottom: 14, borderWidth: 1, borderColor: colors.outlineVariant,
    alignItems: 'center',
  },
  freeBannerText: { ...typography.labelSm, color: colors.primary, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: spacing.stackSm, marginBottom: spacing.stackLg },
  cameraBtn: {
    flex: 1, backgroundColor: colors.success, borderRadius: radii.lg,
    paddingVertical: 16, alignItems: 'center',
    ...shadow('sm'),
  },
  photoBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: radii.lg,
    paddingVertical: 16, alignItems: 'center',
    ...shadow('sm'),
  },
  photoBtnIcon: { fontSize: 24, marginBottom: 4 },
  photoBtnText: { color: colors.onPrimary, fontWeight: '700', ...typography.labelMd },
  manualBtn: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radii.lg,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.outlineVariant,
  },
  manualBtnIcon: { fontSize: 24, marginBottom: 4 },
  manualBtnText: { color: colors.onSurfaceVariant, fontWeight: '700', ...typography.labelMd },

  imageCard: {
    overflow: 'hidden', marginBottom: spacing.gutter,
  },
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
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    ...shadow('sm'),
  },
  muscleScoreText: { fontSize: 14, fontWeight: '900', fontFamily: fontFamily.headingBold },
  macroChipsRow: { flexDirection: 'row', gap: spacing.stackSm, marginBottom: spacing.stackMd },
  macroChip: {
    flex: 1, alignItems: 'center', backgroundColor: colors.surfaceVariant,
    borderRadius: radii.md, paddingVertical: 12, paddingHorizontal: 6,
  },
  macroChipProtein: { backgroundColor: colors.successBg, borderWidth: 1, borderColor: '#A7F3D0' },
  macroChipLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, marginBottom: 4, textAlign: 'center' },
  macroChipValue: { fontFamily: fontFamily.headingBold, fontSize: 17, fontWeight: '800', color: colors.onSurface },
  macroChipValueProtein: { color: colors.success },
  qualityTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  qualityTag: {
    backgroundColor: colors.infoBg, borderRadius: radii.pill,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  qualityTagText: { ...typography.labelSm, fontWeight: '700', color: colors.primary },
  verdictRow: { flexDirection: 'row', marginBottom: spacing.stackSm },
  suggestionText: { ...typography.labelMd, fontWeight: '400', fontFamily: fontFamily.body, color: colors.onSurfaceVariant, lineHeight: 19, marginBottom: spacing.stackSm },
  smartSwapBox: {
    backgroundColor: colors.successBg, borderRadius: radii.md, padding: 10,
    borderLeftWidth: 3, borderLeftColor: colors.success, marginTop: 4,
  },
  smartSwapTitle: { ...typography.labelSm, fontWeight: '700', color: colors.success, marginBottom: 4 },
  smartSwapText: { ...typography.labelMd, fontWeight: '400', fontFamily: fontFamily.body, color: colors.onSurfaceVariant, lineHeight: 18 },

  todayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.stackMd },
  todaySectionTitle: { fontFamily: fontFamily.headingBold, fontSize: 18, fontWeight: '700', color: colors.onSurface },
  todayTotals: { flexDirection: 'row', gap: spacing.stackSm },
  todayTotalBadge: {
    backgroundColor: colors.infoBg, borderRadius: radii.pill, paddingHorizontal: 10,
    paddingVertical: 4, ...typography.labelSm, fontWeight: '700', color: colors.primary,
  },

  emptyCard: { },
  emptyCardContent: { alignItems: 'center', paddingVertical: 12 },
  emptyEmoji: { fontSize: 36, marginBottom: spacing.stackSm },
  emptyText: { ...typography.labelMd, fontWeight: '500', color: colors.outline },

  mealsCard: { overflow: 'hidden' },
  mealItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.gutter },
  mealBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  mealEmoji: { fontSize: 26, marginRight: 12 },
  mealInfo: { flex: 1 },
  mealName: { ...typography.labelMd, color: colors.onSurface },
  mealMeta: { ...typography.labelSm, color: colors.outline, marginTop: 2 },
  mealProtein: { fontFamily: fontFamily.headingBold, fontSize: 15, fontWeight: '800', color: colors.primary, marginRight: spacing.stackSm },
  editBtn: { padding: 6 },
  editBtnText: { fontSize: 16 },
  deleteBtn: { padding: 6 },
  deleteBtnText: { fontSize: 16 },

  fab: {
    position: 'absolute', right: spacing.containerMargin, bottom: spacing.stackLg,
    width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', ...shadow('lg'),
  },
  fabIcon: { color: colors.onPrimary, fontSize: 34, fontWeight: '300', marginTop: Platform.OS === 'ios' ? -2 : -4 },

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
  inputRow: { flexDirection: 'row' },
  portionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  portionPill: {
    flex: 1, borderWidth: 1.5, borderColor: colors.outlineVariant, borderRadius: radii.sm,
    paddingVertical: 10, alignItems: 'center', backgroundColor: colors.background,
  },
  portionPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  portionPillText: { fontFamily: fontFamily.bodySemiBold, fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },
  portionPillTextActive: { color: colors.white },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: colors.outlineVariant, borderRadius: radii.md,
    padding: 14, alignItems: 'center',
  },
  cancelBtnText: { color: colors.onSurfaceVariant, fontFamily: fontFamily.bodySemiBold, fontWeight: '600', fontSize: 15 },
  saveBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: radii.md,
    padding: 14, alignItems: 'center',
  },
  saveBtnText: { color: colors.white, fontFamily: fontFamily.headingBold, fontWeight: '700', fontSize: 15 },
  analyzeManualBtn: {
    backgroundColor: colors.primary, borderRadius: radii.md,
    paddingVertical: 14, alignItems: 'center',
    marginTop: 16, alignSelf: 'stretch',
  },
  analyzeManualBtnText: { color: colors.white, fontFamily: fontFamily.headingBold, fontWeight: '700', fontSize: 15 },

  suggestionsBox: {
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.outlineVariant,
    borderRadius: radii.md, marginTop: 4, overflow: 'hidden',
  },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  suggestionBorder: { borderBottomWidth: 1, borderBottomColor: colors.surfaceVariant },
  suggestionName: { fontFamily: fontFamily.bodySemiBold, fontSize: 14, fontWeight: '600', color: colors.onSurface },
  suggestionMeta: { fontFamily: fontFamily.body, fontSize: 11, color: colors.outline, marginTop: 1 },
  suggestionStats: { alignItems: 'flex-end' },
  suggestionProtein: { fontFamily: fontFamily.headingBold, fontSize: 13, fontWeight: '700', color: colors.primary },
  suggestionCalories: { fontFamily: fontFamily.body, fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },

  hintBox: {
    backgroundColor: colors.infoBg, borderRadius: radii.sm, padding: 10,
    marginTop: 8, borderLeftWidth: 3, borderLeftColor: colors.primary,
  },
  hintText: { fontFamily: fontFamily.body, fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 18 },
  hintBold: { fontFamily: fontFamily.bodyBold, fontWeight: '700', color: colors.primary },

  autoNutrition: {
    backgroundColor: colors.infoBg, borderRadius: radii.md, padding: 14,
    marginTop: 12, borderWidth: 1, borderColor: colors.outlineVariant,
  },
  autoNutritionTitle: { fontFamily: fontFamily.headingBold, fontSize: 12, fontWeight: '700', color: colors.primaryDark, marginBottom: 10 },
  autoNutritionRow: { flexDirection: 'row', alignItems: 'center' },
  autoNutritionItem: { flex: 1, alignItems: 'center' },
  autoNutritionValue: { fontFamily: fontFamily.headingBold, fontSize: 20, fontWeight: '800', color: colors.primary },
  autoNutritionLabel: { fontFamily: fontFamily.body, fontSize: 11, color: colors.onSurfaceVariant, marginTop: 2 },
  autoNutritionDivider: { width: 1, height: 36, backgroundColor: colors.outlineVariant },
  autoNutritionNote: { fontFamily: fontFamily.body, fontSize: 11, color: colors.onSurfaceVariant, marginTop: 8, textAlign: 'center' },

  exerciseBtn: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radii.lg,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.success,
  },
  exerciseBtnText: { color: colors.success, fontFamily: fontFamily.headingBold, fontWeight: '700', fontSize: 14 },
  exerciseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  exerciseTypeBtn: {
    width: '30%', flexGrow: 1, alignItems: 'center', paddingVertical: 12,
    backgroundColor: colors.background, borderRadius: radii.md,
    borderWidth: 1.5, borderColor: colors.outlineVariant,
  },
  exerciseTypeBtnActive: { backgroundColor: colors.infoBg, borderColor: colors.primary },
  exerciseTypeEmoji: { fontSize: 24, marginBottom: 4 },
  exerciseTypeName: { fontFamily: fontFamily.bodySemiBold, fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant, textAlign: 'center' },
  exerciseTypeNameActive: { color: colors.primary },
  calPreview: {
    backgroundColor: colors.successBg, borderRadius: radii.sm, padding: 12,
    marginTop: 16, borderWidth: 1, borderColor: '#A7F3D0',
  },
  calPreviewText: { fontFamily: fontFamily.body, fontSize: 14, color: colors.onSurfaceVariant, textAlign: 'center' },

  balanceCard: { marginBottom: spacing.stackLg },
  balanceTitle: { fontFamily: fontFamily.headingSemiBold, fontSize: 16, fontWeight: '700', color: colors.onSurface, marginBottom: 14 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  balanceItem: { alignItems: 'center', flex: 1 },
  balanceMinus: { fontSize: 18, fontWeight: '700', color: colors.outline, marginHorizontal: 2, fontFamily: fontFamily.headingBold },
  balanceValue: { fontFamily: fontFamily.headingBold, fontSize: 16, fontWeight: '800', color: colors.onSurface },
  balanceLabel: { fontSize: 10, color: colors.onSurfaceVariant, fontWeight: '600', marginTop: 2, textAlign: 'center', fontFamily: fontFamily.bodySemiBold },
  balanceResult: {
    borderWidth: 2, borderRadius: 10,
    paddingVertical: 6, paddingHorizontal: 4,
  },
  balanceResultValue: { fontSize: 17, fontWeight: '900', fontFamily: fontFamily.headingBold },
  balanceNote: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 6, fontFamily: fontFamily.bodySemiBold },
  balanceBmrNote: { fontSize: 10, color: colors.outline, textAlign: 'center', fontFamily: fontFamily.body },

  // Apple Watch / HealthKit card
  watchCard: { marginBottom: spacing.stackLg },
  watchHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  watchTitle: { fontFamily: fontFamily.headingSemiBold, fontSize: 16, fontWeight: '700', color: colors.onSurface, flex: 1, marginRight: spacing.stackSm },
  watchRefreshBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.sm, backgroundColor: colors.infoBg },
  watchRefreshText: { fontFamily: fontFamily.bodySemiBold, fontSize: 12, fontWeight: '600', color: colors.primary },
  watchConnectNote: { fontFamily: fontFamily.body, fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 18, marginBottom: 12 },
  watchConnectBtn: {
    backgroundColor: colors.success, borderRadius: radii.md,
    paddingVertical: 13, alignItems: 'center', ...shadow('sm'),
  },
  watchConnectBtnText: { color: colors.white, fontFamily: fontFamily.headingBold, fontWeight: '700', fontSize: 15 },
  watchStatsRow: { flexDirection: 'row', alignItems: 'center' },
  watchStatItem: { flex: 1, alignItems: 'center' },
  watchStatValue: { fontFamily: fontFamily.headingBold, fontSize: 22, fontWeight: '800', color: colors.success },
  watchStatLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: 11, fontWeight: '600', color: colors.onSurfaceVariant, marginTop: 3, textAlign: 'center' },
  watchStatDivider: { width: 1, height: 40, backgroundColor: colors.outlineVariant },

  // ════════════════════ DAILY INSIGHTS SECTIONS ════════════════════
  insightsSection: { marginTop: spacing.stackLg },
  insightCardBlock: { marginBottom: spacing.stackMd },

  // Honest-estimate caption (centered, used under the weekly muscle card)
  estimateCaptionCentered: {
    ...typography.labelSm, fontSize: 10, lineHeight: 13, color: colors.onSurfaceVariant,
    fontStyle: 'italic', textAlign: 'center', marginTop: 6,
  },

  // ── Muscle Health factor breakdown ──
  scoreFactors: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.outlineVariant,
  },
  scoreFactor: { alignItems: 'center', flex: 1 },
  scoreFactorDot: { fontSize: 14, marginBottom: 2 },
  scoreFactorText: { fontSize: 11, color: colors.onSurfaceVariant, textAlign: 'center', fontWeight: '500', fontFamily: fontFamily.bodySemiBold },

  // ── Sustainability / risk card ──
  riskCardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  riskCardEmoji: { fontSize: 26 },
  riskCardLabel: { fontSize: 15, fontFamily: fontFamily.headingBold, fontWeight: '700', marginBottom: 2 },
  riskCardDesc: { fontSize: 13, fontFamily: fontFamily.body, color: colors.onSurfaceVariant, lineHeight: 18 },
  riskFactors: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)' },
  riskFactorsTitle: { fontSize: 12, fontWeight: '700', color: colors.onSurface, marginBottom: 6, fontFamily: fontFamily.bodySemiBold },
  riskFactor: { fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 3, lineHeight: 16, fontFamily: fontFamily.body },

  // ── Muscle-protection (qualitative) card ──
  muscleCardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  muscleCardEmoji: { fontSize: 26 },
  muscleCardLabel: { fontSize: 15, fontFamily: fontFamily.headingBold, fontWeight: '700', marginBottom: 2 },
  muscleCardDesc: { fontSize: 13, fontFamily: fontFamily.body, color: colors.onSurfaceVariant, lineHeight: 18 },
  muscleCardNotClinical: { marginTop: 10, fontSize: 11, color: colors.outline, lineHeight: 15, fontStyle: 'italic', fontFamily: fontFamily.body },

  // ── 14-Day Projection ──
  projectionRateLabel: { fontSize: 11, fontFamily: fontFamily.body, color: colors.outline, marginBottom: 12, textAlign: 'center' },
  projTotalRow: { alignItems: 'center', paddingVertical: 8 },
  projTotalValue: { fontSize: 30, fontFamily: fontFamily.headingBold, fontWeight: '800', color: colors.onSurface },
  projTotalLabel: { fontSize: 12, fontFamily: fontFamily.body, color: colors.onSurfaceVariant, marginTop: 2, textAlign: 'center' },
  projDisclaimer: { marginTop: 10, fontSize: 11, color: colors.outline, lineHeight: 15, textAlign: 'center', fontStyle: 'italic', fontFamily: fontFamily.body },

  // ── Weekly Report hero ──
  weeklyHero: { marginBottom: spacing.stackMd, alignItems: 'stretch' },
  weeklyHeroTitle: { ...typography.labelMd, color: 'rgba(255,255,255,0.85)', marginBottom: spacing.stackSm, textAlign: 'center' },
  weeklyHeroValue: { ...typography.displayStat, color: colors.white, textAlign: 'center' },
  weeklyHeroSubtitle: { ...typography.labelMd, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 2 },
  weeklyHeroDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: spacing.stackMd },
  weeklyHeroStatsRow: { flexDirection: 'row', alignItems: 'center' },
  weeklyHeroStat: { flex: 1, alignItems: 'center' },
  weeklyHeroStatValue: { ...typography.headlineMd, fontSize: 20, color: colors.white },
  weeklyHeroStatLabel: { ...typography.labelSm, color: 'rgba(255,255,255,0.7)', marginTop: 2, textAlign: 'center' },
  weeklyHeroStatDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 2 },

  // ── Weekly grid (ring + grade) ──
  weeklyGridRow: { flexDirection: 'row', gap: spacing.gutter, marginBottom: spacing.stackMd },
  weeklyGridCard: { flex: 1 },
  weeklyGridCardInner: { alignItems: 'center' },
  weeklyGridLabel: { ...typography.labelMd, color: colors.onSurfaceVariant, marginTop: spacing.stackSm, textAlign: 'center' },
  weeklyRingValue: { ...typography.headlineMd, fontSize: 22 },
  weeklyRingSub: { ...typography.labelSm, color: colors.onSurfaceVariant, marginTop: 1 },
  gradeCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  gradeEmoji: { fontSize: 34, lineHeight: 40 },

  // ── 7-day protein chart ──
  proteinChartHeader: { marginBottom: spacing.stackMd },
  proteinChartSubtitle: { ...typography.labelMd, color: colors.onSurfaceVariant, marginBottom: spacing.stackSm },
  proteinChartLegend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 4 },
  legendText: { ...typography.labelSm, color: colors.onSurfaceVariant },
  proteinDayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 10 },
  proteinDayBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.outlineVariant },
  proteinDayName: { width: 32, ...typography.labelSm, fontWeight: '700', color: colors.onSurface },
  proteinBarContainer: { flex: 1 },
  proteinBarBg: { height: 10, borderRadius: 5, backgroundColor: colors.surfaceVariant, overflow: 'hidden', position: 'relative' },
  proteinBarFill: { height: '100%', borderRadius: 5 },
  proteinBarTargetLine: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(0,0,0,0.12)' },
  proteinGramsBadge: { borderRadius: radii.sm, paddingHorizontal: 8, paddingVertical: 3, minWidth: 44, alignItems: 'center' },
  proteinGramsText: { ...typography.labelSm, fontWeight: '700' },
  proteinPctLabel: { width: 34, ...typography.labelSm, fontWeight: '600', textAlign: 'right' },

  // ── AI insight cards ──
  aiInsightCard: { marginTop: spacing.stackSm },
  aiInsightInner: { flexDirection: 'row', alignItems: 'flex-start' },
  aiInsightBullet: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.stackSm,
  },
  aiInsightBulletText: { ...typography.labelMd, color: colors.white, fontWeight: '700' },
  aiInsightText: { ...typography.bodyMd, fontSize: 14, lineHeight: 20, color: colors.onSurface, flex: 1 },

  weeklyDisclaimer: {
    ...typography.labelSm, color: colors.outline, lineHeight: 16, textAlign: 'center',
    fontStyle: 'italic', marginTop: spacing.stackMd, paddingHorizontal: spacing.stackSm,
  },
});
