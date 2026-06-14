import { useEffect, useRef, useState } from "react";
import { Animated, Modal, Platform, StyleSheet, View } from "react-native";

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
  const fadeOut = useRef(new Animated.Value(1)).current; // 전체 화면 opacity (fade-out용)
  const shimmer = useRef(new Animated.Value(0)).current; // 텍스트 shimmer (0=dim, 1=bright)
  const [hidden, setHidden] = useState(false);

  // shimmer 루프
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // 로딩 재시작 시 리셋
  useEffect(() => {
    if (visible) {
      setText(randomLine());
      setHidden(false);
      fadeOut.setValue(1);
    }
  }, [visible]);

  // 콘텐츠 준비되면 페이드아웃
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

  const content = (
    <Animated.View style={[s.fill, { opacity: fadeOut }]}>
      {/* dim 텍스트 (베이스) */}
      <View style={s.center}>
        <Animated.Text style={[s.text, s.textDim, { opacity: shimmer.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
          {text}
        </Animated.Text>
        {/* bright 텍스트 (overlay) */}
        <Animated.Text style={[s.text, s.textBright, { opacity: shimmer }]}>
          {text}
        </Animated.Text>
      </View>
    </Animated.View>
  );

  if (Platform.OS !== "web") {
    return (
      <Modal transparent statusBarTranslucent visible={!hidden} animationType="none">
        <View style={s.modalBg}>
          {content}
        </View>
      </Modal>
    );
  }

  return <View style={s.webContainer}>{content}</View>;
}

const s = StyleSheet.create({
  modalBg: {
    flex: 1,
    backgroundColor: BG,
  },
  webContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    zIndex: 50,
  },
  fill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 15,
    fontWeight: "400",
    letterSpacing: 0.3,
  },
  textDim: {
    color: "#bbb",
    position: "absolute",
  },
  textBright: {
    color: "#111",
  },
});
