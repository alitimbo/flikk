import { ReactNode } from "react";
import { useWindowDimensions } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

type OnboardingSwipeProps = {
  children: ReactNode;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  allowSwipeLeft?: boolean;
  allowSwipeRight?: boolean;
};

export function OnboardingSwipe({
  children,
  onSwipeLeft,
  onSwipeRight,
  allowSwipeLeft = true,
  allowSwipeRight = true,
}: OnboardingSwipeProps) {
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const threshold = Math.max(80, width * 0.15);

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      let nextX = event.translationX;
      if (!allowSwipeRight) {
        nextX = Math.min(0, nextX);
      }
      if (!allowSwipeLeft) {
        nextX = Math.max(0, nextX);
      }
      translateX.value = nextX;
    })
    .onEnd((event) => {
      const { translationX } = event;
      if (allowSwipeLeft && translationX <= -threshold) {
        translateX.value = withTiming(-width, { duration: 180 }, () => {
          runOnJS(onSwipeLeft)();
        });
        return;
      }
      if (allowSwipeRight && translationX >= threshold) {
        translateX.value = withTiming(width, { duration: 180 }, () => {
          runOnJS(onSwipeRight)();
        });
        return;
      }
      translateX.value = withTiming(0, { duration: 180 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
