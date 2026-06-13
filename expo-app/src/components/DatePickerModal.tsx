import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { fetchAvailableDatesForMonth } from "../api/client";

const BG = "#f0f0ee";
const TEXT = "#111";
const BORDER = "#e8e8e6";
const MUTED = "#aaa";
const LIGHT = "#ddd";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function formatSelectedDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAY_SHORT[dt.getDay()]}, ${MONTH_SHORT[m - 1]} ${d}`;
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: string) => void;
  today: string; // "YYYY-MM-DD"
}

export function DatePickerModal({ visible, onClose, onSelect, today }: Props) {
  const todayDate = new Date(today + "T00:00:00");
  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [loadingMonth, setLoadingMonth] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setViewYear(todayDate.getFullYear());
      setViewMonth(todayDate.getMonth());
      setSelected(null);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 20 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const mk = monthKey(viewYear, viewMonth);
    if (mk === loadingMonth) return;
    setLoadingMonth(mk);
    fetchAvailableDatesForMonth(mk).then((dates) => {
      setAvailableDates(new Set(dates));
    });
  }, [visible, viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    // don't go past today's month
    const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
    const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
    if (nextY > todayDate.getFullYear() || (nextY === todayDate.getFullYear() && nextM > todayDate.getMonth())) return;
    setViewYear(nextY); setViewMonth(nextM);
  }

  const isNextDisabled =
    viewYear > todayDate.getFullYear() ||
    (viewYear === todayDate.getFullYear() && viewMonth >= todayDate.getMonth());

  // Build calendar grid
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  function handleDayPress(day: number) {
    const dk = dateKey(viewYear, viewMonth, day);
    if (!availableDates.has(dk)) return;
    if (dk > today) return;
    setSelected(dk);
    setTimeout(() => {
      onSelect(dk);
      onClose();
    }, 120);
  }

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Animated.View
          style={[s.sheet, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}
          // prevent backdrop press from propagating
        >
          <Pressable onPress={() => {}}>
            {/* Header */}
            <View style={s.header}>
              <Text style={s.headerTitle}>Select date</Text>
              <Text style={s.headerSub}>
                {formatSelectedDate(selected ?? today)}
              </Text>
            </View>

            {/* Month nav */}
            <View style={s.monthNav}>
              <Text style={s.monthLabel}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </Text>
              <View style={s.navBtns}>
                <Pressable style={s.navBtn} onPress={prevMonth}>
                  <Text style={s.navBtnText}>‹</Text>
                </Pressable>
                <Pressable style={[s.navBtn, isNextDisabled && s.navBtnDisabled]} onPress={nextMonth} disabled={isNextDisabled}>
                  <Text style={[s.navBtnText, isNextDisabled && s.navBtnTextDisabled]}>›</Text>
                </Pressable>
              </View>
            </View>

            {/* Day labels */}
            <View style={s.dayRow}>
              {DAY_LABELS.map((d, i) => (
                <Text key={i} style={s.dayLabel}>{d}</Text>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={s.grid}>
              {cells.map((day, i) => {
                if (!day) return <View key={i} style={s.cell} />;
                const dk = dateKey(viewYear, viewMonth, day);
                const isToday = dk === today;
                const isSelected = dk === selected;
                const isFuture = dk > today;
                const hasContent = availableDates.has(dk);
                const isDisabled = isFuture || !hasContent;

                return (
                  <Pressable
                    key={i}
                    style={s.cell}
                    onPress={() => handleDayPress(day)}
                    disabled={isDisabled}
                  >
                    <View style={[
                      s.dayCircle,
                      isSelected && s.dayCircleSelected,
                      !isSelected && isToday && s.dayCircleToday,
                    ]}>
                      <Text style={[
                        s.dayText,
                        isDisabled && s.dayTextDisabled,
                        isSelected && s.dayTextSelected,
                        !isSelected && isToday && s.dayTextToday,
                      ]}>
                        {day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Actions */}
            <View style={s.actions}>
              <Pressable onPress={onClose} style={s.actionBtn}>
                <Text style={s.actionBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: {
    backgroundColor: "#ededeb",
    borderRadius: 16,
    width: 320,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },

  // Header band
  header: {
    backgroundColor: "#e2e2df",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerTitle: { fontSize: 11, color: MUTED, letterSpacing: 1, textTransform: "uppercase", fontWeight: "500", marginBottom: 4 },
  headerSub: { fontSize: 26, fontWeight: "700", color: TEXT, letterSpacing: -0.5 },

  // Month nav
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  monthLabel: { fontSize: 13, fontWeight: "600", color: TEXT },
  navBtns: { flexDirection: "row", gap: 4 },
  navBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  navBtnDisabled: { opacity: 0.25 },
  navBtnText: { fontSize: 22, color: TEXT, lineHeight: 26 },
  navBtnTextDisabled: { color: MUTED },

  // Day labels
  dayRow: { flexDirection: "row", paddingHorizontal: 12, marginBottom: 4 },
  dayLabel: { flex: 1, textAlign: "center", fontSize: 11, color: MUTED, fontWeight: "500" },

  // Grid
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, paddingBottom: 8 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  dayCircleToday: { borderWidth: 1.5, borderColor: TEXT },
  dayCircleSelected: { backgroundColor: TEXT },
  dayText: { fontSize: 13, color: TEXT, fontWeight: "400" },
  dayTextDisabled: { color: LIGHT },
  dayTextToday: { fontWeight: "700" },
  dayTextSelected: { color: "#fff", fontWeight: "700" },

  // Actions
  actions: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  actionBtnText: { fontSize: 13, fontWeight: "600", color: TEXT },
});
