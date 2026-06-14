import { useEffect, useRef, useState } from "react";
import { Animated, Modal, Platform, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";

const LINES = [
  "Steaming potatoes...",
  "Boiling potatoes...",
  "Mashing potatoes...",
  "Frying potatoes...",
  "Cooking potatoes...",
];

const BG = "#f0f0ee";
const TEXT_WIDTH = 220;

function randomLine() {
  return LINES[Math.floor(Math.random() * LINES.length)];
}

export function LoadingScreen({ visible }: { visible: boolean }) {
  const [text, setText] = useState(() => randomLine());
  const opacity = useRef(new Animated.Value(1)).current;
  const [hidden, setHidden] = useState(false);

  // 웹용: 색상 pulse
  const pulse = useRef(new Animated.Value(0)).current;
  // 네이티브용: 좌→우 shimmer
  const shimmerX = useRef(new Animated.Value(-TEXT_WIDTH)).current;

  useEffect(() => {
    if (Platform.OS === "web") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: false }),
          Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: false }),
        ])
      ).start();
    } else {
      Animated.loop(
        Animated.timing(shimmerX, { toValue: TEXT_WIDTH, duration: 1400, useNativeDriver: true })
      ).start();
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setText(randomLine());
      setHidden(false);
      opacity.setValue(1);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      const t = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 700, useNativeDriver: true })
          .start(() => setHidden(true));
      }, 1300);
      return () => clearTimeout(t);
    }
  }, [visible, opacity]);

  if (hidden) return null;

  // 웹: Animated.Text 색상 pulse
  if (Platform.OS === "web") {
    const color = pulse.interpolate({
      inputRange: [0, 1],
      outputRange: ["#bbb", "#111"],
    });
    return (
      <Animated.View style={[s.container, { opacity }]}>
        <View style={s.inner}>
          <Animated.Text style={[s.text, { color }]}>{text}</Animated.Text>
        </View>
      </Animated.View>
    );
  }

  // 네이티브: MaskedView + LinearGradient shimmer
  return (
    <Modal transparent statusBarTranslucent visible={!hidden} animationType="none">
      <Animated.View style={[s.containerNative, { opacity }]}>
        <View style={s.inner}>
          <MaskedView maskElement={<Animated.Text style={s.text}>{text}</Animated.Text>}>
            <View style={s.textBase}>
              <Animated.Text style={[s.text, { opacity: 0 }]}>{text}</Animated.Text>
            </View>
            <Animated.View
              style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: shimmerX }] }]}
            >
              <LinearGradient
                colors={["#bbb", "#bbb", "#111", "#bbb", "#bbb"]}
                locations={[0, 0.3, 0.5, 0.7, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ width: TEXT_WIDTH * 2, height: 30 }}
              />
            </Animated.View>
          </MaskedView>
        </View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  containerNative: {
    flex: 1,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: { alignItems: "center" },
  textBase: { backgroundColor: "#bbb" },
  text: {
    fontSize: 15,
    fontWeight: "400",
    letterSpacing: 0.3,
    color: "#000",
  },
});
