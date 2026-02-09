import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, View, StyleSheet, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const AnimatedLinearGradient =
  Animated.createAnimatedComponent(LinearGradient);

const BASE_COLOR = "#1B1B1B";
const HIGHLIGHT_COLOR = "#2B2B2B";

type SkeletonBlockProps = {
  height: number;
  width?: number | string;
  radius?: number;
  style?: object;
};

export function SkeletonBlock({
  height,
  width = "100%",
  radius = 12,
  style,
}: SkeletonBlockProps) {
  const shimmer = useRef(new Animated.Value(0)).current;
  const [layoutWidth, setLayoutWidth] = useState(0);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);

  const translateX = useMemo(() => {
    return shimmer.interpolate({
      inputRange: [0, 1],
      outputRange: [-layoutWidth, layoutWidth],
    });
  }, [shimmer, layoutWidth]);

  return (
    <View
      style={[
        {
          height,
          width,
          borderRadius: radius,
          backgroundColor: BASE_COLOR,
          overflow: "hidden",
        },
        style,
      ]}
      onLayout={(event) => {
        setLayoutWidth(event.nativeEvent.layout.width);
      }}
    >
      {layoutWidth > 0 && (
        <AnimatedLinearGradient
          colors={[BASE_COLOR, HIGHLIGHT_COLOR, BASE_COLOR]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            StyleSheet.absoluteFill,
            {
              width: layoutWidth * 0.7,
              transform: [{ translateX }],
              opacity: 0.45,
            },
          ]}
        />
      )}
    </View>
  );
}

export function SkeletonGridCard() {
  return (
    <View className="flex-1 p-2">
      <View className="overflow-hidden rounded-2xl border border-white/10 bg-flikk-card">
        <SkeletonBlock height={160} radius={16} />
        <View className="p-3 gap-2">
          <SkeletonBlock height={14} radius={8} width="70%" />
          <SkeletonBlock height={12} radius={8} width="40%" />
        </View>
      </View>
    </View>
  );
}

type SkeletonFeedItemProps = {
  height: number;
};

export function SkeletonFeedItem({ height }: SkeletonFeedItemProps) {
  return (
    <View style={{ height }} className="bg-flikk-dark">
      <SkeletonBlock height={height} radius={0} />
      <View className="absolute bottom-6 left-4 right-4 flex-row items-end">
        <View className="w-[80%] pr-1">
          <SkeletonBlock height={7} radius={999} width="85%" />
          <View className="mt-4">
            <SkeletonBlock height={16} radius={8} width="78%" />
            <View className="mt-2">
              <SkeletonBlock height={12} radius={8} width="92%" />
            </View>
          </View>
          <View className="mt-4 rounded-2xl border border-white/10 bg-flikk-card p-4">
            <View className="flex-row items-center gap-4 mb-3">
              <SkeletonBlock height={56} width={56} radius={12} />
              <View className="flex-1 gap-2">
                <SkeletonBlock height={14} radius={8} width="85%" />
                <SkeletonBlock height={14} radius={8} width="45%" />
              </View>
            </View>
            <SkeletonBlock height={44} radius={999} />
          </View>
        </View>

        <View className="w-[20%] items-end">
          <View className="items-end gap-5">
            <SkeletonBlock height={48} width={48} radius={999} />
            <SkeletonBlock height={30} width={30} radius={999} />
            <SkeletonBlock height={28} width={28} radius={999} />
            <SkeletonBlock height={28} width={28} radius={999} />
          </View>
        </View>
      </View>
    </View>
  );
}

export function getDefaultFeedSkeletonHeight() {
  return Dimensions.get("window").height;
}
