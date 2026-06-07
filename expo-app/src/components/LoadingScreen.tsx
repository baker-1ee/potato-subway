import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

const LINES = [
  "Steaming potatoes...",
  "Boiling potatoes...",
  "Mashing potatoes...",
  "Frying potatoes...",
  "Cooking potatoes...",
];

const BG = "#f0f0ee";

export function LoadingScreen({ visible }: { visible: boolean }) {
  const [text] = useState(() => LINES[Math.floor(Math.random() * LINES.length)]);
  const opacity = useRef(new Animated.Value(1)).current;
  const [hidden, setHidden] = useState(false);

  // shimmer animation
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1600,
        useNativeDriver: false,
      })
    ).start();
  }, [shimmer]);

  // fade-out when content is ready
  useEffect(() => {
    if (!visible) {
      const showTimer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }).start(() => setHidden(true));
      }, 1300);
      return () => clearTimeout(showTimer);
    }
  }, [visible, opacity]);

  if (hidden) return null;

  const color = shimmer.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ["#bbb", "#bbb", "#111", "#bbb", "#bbb"],
  });

  return (
    <Animated.View style={[s.container, { opacity }]}>
      <View style={s.inner}>
        <Animated.Text style={[s.text, { color }]}>{text}</Animated.Text>
      </View>
    </Animated.View>
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
  inner: {
    alignItems: "center",
  },
  text: {
    fontSize: 15,
    fontWeight: "400",
    letterSpacing: 0.3,
  },
});
