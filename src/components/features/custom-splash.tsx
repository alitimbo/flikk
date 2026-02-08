import { useEffect } from "react";
import { View, Text } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";

const SUBTEXT = ["Swipe", "Shop", "Smile"] as const;

type CustomSplashProps = {
  onFinish: () => void;
};

export function CustomSplash({ onFinish }: CustomSplashProps) {
  const logoScale = useSharedValue(0.75);
  const logoOpacity = useSharedValue(0);
  const wordOpacities = SUBTEXT.map(() => useSharedValue(0));
  const wordTranslates = SUBTEXT.map(() => useSharedValue(24));
  const containerOpacity = useSharedValue(1);

  useEffect(() => {
    logoOpacity.value = withTiming(1, {
      duration: 600,
      easing: Easing.out(Easing.quad),
    });
    logoScale.value = withSpring(1, {
      damping: 12,
      stiffness: 140,
    });

    const staggerDelay = 220;
    SUBTEXT.forEach((_, i) => {
      const delay = 800 + i * staggerDelay;

      wordOpacities[i].value = withDelay(
        delay,
        withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }),
      );

      wordTranslates[i].value = withDelay(
        delay,
        withSpring(0, {
          damping: 14,
          stiffness: 160,
          overshootClamping: false,
        }),
      );
    });

    const totalDuration = 800 + SUBTEXT.length * staggerDelay + 1400;
    const fadeOutTimer = setTimeout(() => {
      containerOpacity.value = withTiming(
        0,
        { duration: 500, easing: Easing.in(Easing.quad) },
        (finished) => {
          if (finished) {
            runOnJS(onFinish)();
          }
        },
      );
    }, totalDuration);

    return () => clearTimeout(fadeOutTimer);
  }, [
    containerOpacity,
    logoOpacity,
    logoScale,
    onFinish,
    wordOpacities,
    wordTranslates,
  ]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const getWordStyle = (index: number) =>
    useAnimatedStyle(() => ({
      opacity: wordOpacities[index].value,
      transform: [{ translateY: wordTranslates[index].value }],
    }));

  return (
    <Animated.View
      className="absolute inset-0 items-center justify-center bg-flikk-dark"
      style={containerStyle}
    >
      <View className="items-center">
        <Animated.View style={logoStyle}>
          <Image
            source={require("@/assets/images/splash-icon.png")}
            contentFit="contain"
            className="w-[60%] aspect-square"
            width={200}
            height={200}
          />
        </Animated.View>

        <View className="mt-8 flex-row items-center gap-x-3">
          {SUBTEXT.map((word, i) => (
            <Animated.Text
              key={word}
              className={`text-2xl font-display tracking-wider ${
                i === 0
                  ? "text-flikk-lime"
                  : i === 2
                    ? "text-flikk-purple"
                    : "text-flikk-text"
              }`}
              style={getWordStyle(i)}
            >
              {word}
              {i < SUBTEXT.length - 1 && (
                <Text className="text-flikk-text/70"> • </Text>
              )}
            </Animated.Text>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}
