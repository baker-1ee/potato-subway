import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LoadingScreen } from "../src/components/LoadingScreen";
import { DatePickerModal } from "../src/components/DatePickerModal";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useRef, useState } from "react";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import type { Example, Post, Word } from "../src/api/client";
import { createPost, fetchPostsByWordId, fetchWordByDate } from "../src/api/client";
import { formatCommentTime, formatHeaderDate, localDateKey } from "../src/utils/date";

function displayWord(w: string) {
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : "";
}

const HERO_IMAGES = [
  require("../assets/heroes/hero_weekday.png"),
  require("../assets/heroes/hero_weekday_fan.png"),
  require("../assets/heroes/hero_weekday_sunbed.png"),
  require("../assets/heroes/hero_weekday_walk.png"),
  require("../assets/heroes/hero_weekday_water.png"),
  require("../assets/heroes/hero_weekday_keyboard.png"),
];

function randomHero() {
  return HERO_IMAGES[Math.floor(Math.random() * HERO_IMAGES.length)];
}

export default function HomePage() {
  const date = localDateKey();
  const [heroImg, setHeroImg] = useState(() => randomHero());

  const [word, setWord] = useState<Word | null>(null);
  const [loading, setLoading] = useState(true);
  const [noContent, setNoContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exampleIndex, setExampleIndex] = useState(0);

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [calendarVisible, setCalendarVisible] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const noteInputRef = useRef<TextInput>(null);
  const noteSectionOffsetY = useRef<number>(0);

  const load = useCallback(async (publishDate: string) => {
    setLoading(true);
    setError(null);
    setNoContent(false);
    setWord(null);
    try {
      setWord(await fetchWordByDate(publishDate));
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string };
      if (err.status === 404) setNoContent(true);
      else setError(err.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(date); }, [date, load]);
  useEffect(() => {
    setExampleIndex(0);
    setFormError(null);
    setCommentText("");
    setHeroImg(randomHero());
  }, [word?.id]);

  useEffect(() => {
    const id = word?.id;
    if (!id) { setPosts([]); return; }
    let cancelled = false;
    (async () => {
      setPostsLoading(true);
      try {
        const list = await fetchPostsByWordId(id);
        if (!cancelled) setPosts(list);
      } catch { /* silently fail */ } finally {
        if (!cancelled) setPostsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [word?.id]);

  const examples: Example[] = word?.examples ?? [];
  const currentExample = examples[exampleIndex] ?? null;

  const swipeGesture = Gesture.Pan().runOnJS(true).onEnd((e) => {
    if (Math.abs(e.velocityX) < 200) return;
    if (e.velocityX < 0 && exampleIndex < examples.length - 1) setExampleIndex((i) => i + 1);
    else if (e.velocityX > 0 && exampleIndex > 0) setExampleIndex((i) => i - 1);
  });

  function hasKorean(s: string) {
    return /[가-힣ᄀ-ᇿ㄰-㆏ꥠ-꥿ힰ-퟿]/.test(s);
  }

  async function handleSubmit() {
    if (!word || !commentText.trim()) return;
    if (hasKorean(commentText)) { setFormError("한글은 입력할 수 없어요. Please write in English."); return; }
    setSubmitting(true);
    setFormError(null);
    try {
      const post = await createPost(word.id, commentText.trim());
      setPosts((prev) => [post, ...prev]);
      setCommentText("");
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2000);
    } catch (e: unknown) {
      setFormError((e as Error).message ?? "Failed to post");
    } finally {
      setSubmitting(false);
    }
  }

  const sortedPosts = [...posts].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <>
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}>
        <FlatList
          ref={flatListRef}
          data={sortedPosts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              {/* Header */}
              <View style={s.header}>
                <Text style={s.title}>Potato on the Subway</Text>
                <Pressable onPress={() => setCalendarVisible(true)} style={s.dateLabelBtn}>
                  {word
                    ? <Text style={s.dateLabel}>{formatHeaderDate(word.publish_date)}</Text>
                    : <Text style={s.dateLabel}>{formatHeaderDate(date)}</Text>
                  }
                </Pressable>
                {/* 평일 hero는 단어 있을 때만 */}
                {!loading && !noContent && !error && word && (
                  <Image
                    source={heroImg}
                    style={s.heroImg}
                    resizeMode="contain"
                  />
                )}
              </View>

              {/* Loading - LoadingScreen은 absolute overlay로 렌더 */}

              {/* Error */}
              {!loading && error && (
                <View style={s.errorBox}>
                  <Text style={s.errorText}>{error}</Text>
                </View>
              )}

              {/* Weekend */}
              {!loading && noContent && (
                <View style={s.weekendContent}>
                  <Text style={s.weekendMsg}>{"Why are you here?\nIt's the weekend. Go rest."}</Text>
                  <Image
                    source={require("../assets/heroes/hero_weekend.png")}
                    style={s.weekendImg}
                    resizeMode="contain"
                  />
                </View>
              )}

              {/* Word content */}
              {!loading && !error && !noContent && word && (
                <View>
                  {/* Today's word */}
                  <View style={s.section}>
                    <Text style={s.sectionLabel}>Today's word</Text>
                    <View style={s.card}>
                      <Text style={s.wordText}>{displayWord(word.word)}</Text>
                      {word.meaning_ko && <Text style={s.wordMeaning}>{word.meaning_ko}</Text>}
                    </View>
                  </View>

                  {/* How it's used */}
                  <View style={s.section}>
                    <View style={s.sectionLabelRow}>
                      <Text style={s.sectionLabelInRow}>How it's used</Text>
                      {examples.length > 1 && (
                        <View style={s.dots}>
                          {examples.map((_, i) => (
                            <Pressable key={i} onPress={() => setExampleIndex(i)}>
                              <View style={[s.dot, i === exampleIndex && s.dotActive]} />
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                    <GestureDetector gesture={swipeGesture}>
                      <View style={[s.card, s.exampleCard]}>
                        {currentExample ? (
                          <>
                            <Text style={s.exampleEn}>{currentExample.en}</Text>
                            <Text style={s.exampleKo}>{currentExample.ko}</Text>
                          </>
                        ) : (
                          <Text style={s.emptyText}>No examples for this word.</Text>
                        )}
                      </View>
                    </GestureDetector>
                  </View>

                  {/* Leave a note */}
                  <View
                    style={s.section}
                    onLayout={(e) => { noteSectionOffsetY.current = e.nativeEvent.layout.y; }}
                  >
                    <Text style={s.sectionLabel}>Leave a note</Text>
                    <View style={s.noteRow}>
                      <TextInput
                        ref={noteInputRef}
                        style={s.noteInput}
                        placeholder="Try today's word"
                        placeholderTextColor="#aaa"
                        value={commentText}
                        onChangeText={setCommentText}
                        maxLength={80}
                        editable={!submitting}
                        returnKeyType="send"
                        onSubmitEditing={handleSubmit}
                        autoCorrect={false}
                        multiline
                        scrollEnabled={false}
                        onFocus={() => {
                          setTimeout(() => {
                            flatListRef.current?.scrollToOffset({
                              offset: noteSectionOffsetY.current - 16,
                              animated: true,
                            });
                          }, 300);
                        }}
                      />
                      <Pressable
                        style={[s.noteSubmit, submitted && s.noteSubmitDropped, (!commentText.trim() || submitting) && s.noteSubmitDisabled]}
                        onPress={handleSubmit}
                        disabled={!commentText.trim() || submitting}
                      >
                        {submitting
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={s.noteSubmitText}>{submitted ? "Dropped ✓" : "Drop It"}</Text>
                        }
                      </Pressable>
                    </View>
                    {commentText.length > 0 && (
                      <Text style={s.charCount}>{commentText.length}/80</Text>
                    )}
                    {formError && <Text style={s.formError}>{formError}</Text>}
                  </View>

                  {/* Comments section label */}
                  <View style={[s.section, { marginBottom: 0 }]}>
                    <Text style={s.sectionLabel}>Notes</Text>
                  </View>
                  <View style={s.commentsCard}>
                    {postsLoading && (
                      <Text style={s.commentEmpty}>Loading comments…</Text>
                    )}
                    {!postsLoading && sortedPosts.length === 0 && (
                      <Text style={s.commentEmpty}>Be the first to drop a note.</Text>
                    )}
                  </View>
                </View>
              )}
            </View>
          }
          renderItem={({ item, index }) => (
            <View style={[s.commentItem, index === sortedPosts.length - 1 && s.commentItemLast]}>
              <Text style={s.commentText}>{item.content}</Text>
              <Text style={s.commentTime}>{formatCommentTime(item.created_at)}</Text>
            </View>
          )}
          ListFooterComponent={
            <View style={s.footer}>
              <Text style={s.footerText}>Potato on the Subway · Every weekday morning</Text>
            </View>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
    <LoadingScreen visible={loading} />
    <DatePickerModal
      visible={calendarVisible}
      onClose={() => setCalendarVisible(false)}
      onSelect={(d) => { load(d); flatListRef.current?.scrollToOffset({ offset: 0, animated: false }); }}
      today={date}
    />
    </>
  );
}

const BG = "#f0f0ee";
const CARD = "#fff";
const BORDER = "#e8e8e6";
const TEXT = "#111";
const MUTED = "#888";
const LIGHT = "#bbb";

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  scroll: { paddingBottom: 40 },

  // Header
  header: { paddingTop: 28, paddingHorizontal: 24, paddingBottom: 0, alignItems: "center" },
  title: { fontSize: 15, fontWeight: "700", color: TEXT, letterSpacing: -0.2 },
  dateLabelBtn: { marginTop: 4, paddingVertical: 10, paddingHorizontal: 20 },
  dateLabel: { fontSize: 13, color: "#aaa" },
  heroImg: { width: "100%", maxWidth: 400, height: 300, marginTop: 0 },

  // Loading / error
  center: { alignItems: "center", paddingVertical: 48 },
  errorBox: { marginHorizontal: 20, marginTop: 16, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 4, padding: 14 },
  errorText: { fontSize: 13, color: "#c00" },

  // Weekend
  weekendContent: { alignItems: "center", paddingTop: 56, paddingHorizontal: 32, paddingBottom: 80 },
  weekendMsg: { fontSize: 22, fontWeight: "700", color: TEXT, textAlign: "center", lineHeight: 33, letterSpacing: -0.4, marginBottom: 48 },
  weekendImg: { width: "100%", maxWidth: 320, height: 240 },

  // Sections
  section: { paddingHorizontal: 20, marginBottom: 40 },
  sectionLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionLabel: { fontSize: 11, color: "#999", letterSpacing: 1, textTransform: "uppercase", fontWeight: "500", marginBottom: 12, lineHeight: 14 },
  sectionLabelInRow: { fontSize: 11, color: "#999", letterSpacing: 1, textTransform: "uppercase", fontWeight: "500", lineHeight: 14 },

  // Dots
  dots: { flexDirection: "row", gap: 5, alignItems: "center" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ccc" },
  dotActive: { width: 16, backgroundColor: TEXT },

  // Card
  card: { backgroundColor: CARD, borderRadius: 4, borderWidth: 1, borderColor: BORDER, padding: 20 },
  exampleCard: { minHeight: 88 },
  wordText: { fontSize: 22, fontWeight: "700", color: TEXT, letterSpacing: -0.4, marginBottom: 6 },
  wordMeaning: { fontSize: 14, color: MUTED },
  exampleEn: { fontSize: 16, fontWeight: "600", color: TEXT, lineHeight: 24, letterSpacing: -0.2, marginBottom: 8 },
  exampleKo: { fontSize: 14, color: MUTED, lineHeight: 21 },
  emptyText: { fontSize: 13, color: LIGHT, fontStyle: "italic" },

  // Note form
  noteRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  noteInput: { flex: 1, backgroundColor: CARD, borderWidth: 1, borderColor: "#e0e0de", borderRadius: 4, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, color: "#333", minHeight: 44, maxHeight: 120, lineHeight: 20 },
  noteSubmit: { backgroundColor: TEXT, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12, minHeight: 44, justifyContent: "center", alignItems: "center" },
  noteSubmitDropped: { backgroundColor: "#555" },
  noteSubmitDisabled: { opacity: 0.35 },
  noteSubmitText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  charCount: { fontSize: 11, color: LIGHT, textAlign: "right", marginTop: 4 },
  formError: { fontSize: 12, color: "#c00", marginTop: 6 },

  // Comments
  commentsCard: { marginHorizontal: 20, backgroundColor: CARD, borderRadius: 4, borderWidth: 1, borderColor: BORDER, overflow: "hidden" },
  commentEmpty: { fontSize: 13, color: LIGHT, padding: 20, textAlign: "center" },
  commentItem: { backgroundColor: CARD, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingVertical: 14, paddingHorizontal: 16, marginHorizontal: 20, borderBottomWidth: 1, borderBottomColor: BG },
  commentItemLast: { borderBottomWidth: 0 },
  commentText: { flex: 1, fontSize: 13, color: "#333", lineHeight: 20 },
  commentTime: { fontSize: 11, color: LIGHT, flexShrink: 0, marginTop: 2 },

  // Footer
  footer: { marginTop: 40, paddingVertical: 24, paddingHorizontal: 20, alignItems: "center", borderTopWidth: 1, borderTopColor: BORDER },
  footerText: { fontSize: 11, color: "#ccc" },
});
