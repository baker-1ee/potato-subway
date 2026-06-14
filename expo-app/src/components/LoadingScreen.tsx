import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Platform, StyleSheet, Text, View } from "react-native";

const LINES = [
  "Steaming potatoes...",
  "Boiling potatoes...",
  "Mashing potatoes...",
  "Frying potatoes...",
  "Cooking potatoes...",
];

const BG = "#f0f0ee";

function randomLine() {
  return LINES[Math.floor(Math.random() * LINES.length)];
}

export function LoadingScreen({ visible }: { visible: boolean }) {
  const [text, setText] = useState(() => randomLine());
  const fadeOut = useRef(new Animated.Value(1)).current;
  const [hidden, setHidden] = useState(false);

  // 웹용: CSS transition으로 색상 토글
  const [bright, setBright] = useState(false);

  // 네이티브용: Animated shimmer
  const shimmer = useRef(new Animated.Value(0)).current;

  // 웹: setInterval로 색상 토글
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const id = setInterval(() => setBright((b) => !b), 700);
    return () => clearInterval(id);
  }, []);

  // 네이티브: Animated loop
  useEffect(() => {
    if (Platform.OS === "web") return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.delay(100),
        Animated.timing(shimmer, { toValue: 0, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: false }),
        Animated.delay(200),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (visible) {
      setText(randomLine());
      setHidden(false);
      fadeOut.setValue(1);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      const t = setTimeout(() => {
        Animated.timing(fadeOut, { toValue: 0, duration: 700, useNativeDriver: true })
          .start(() => setHidden(true));
      }, 1300);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (hidden) return null;

  // 웹 렌더
  if (Platform.OS === "web") {
    return (
      <Animated.View style={[s.webContainer, { opacity: fadeOut }]}>
        <Text
          style={[
            s.text,
            {
              color: bright ? "#222" : "#bbb",
              // @ts-ignore - web only CSS transition
              transitionProperty: "color",
              transitionDuration: "0.7s",
              transitionTimingFunction: "ease-in-out",
            },
          ]}
        >
          {text}
        </Text>
      </Animated.View>
    );
  }

  // 네이티브 렌더
  const color = shimmer.interpolate({ inputRange: [0, 1], outputRange: ["#bbb", "#222"] });

  return (
    <Modal transparent statusBarTranslucent visible={!hidden} animationType="none">
      <Animated.View style={[s.modalBg, { opacity: fadeOut }]}>
        <Animated.Text style={[s.text, { color }]}>{text}</Animated.Text>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" },
  webContainer: { ...StyleSheet.absoluteFillObject, backgroundColor: BG, zIndex: 50, alignItems: "center", justifyContent: "center" },
  text: { fontSize: 15, fontWeight: "400", letterSpacing: 0.3 },
});
