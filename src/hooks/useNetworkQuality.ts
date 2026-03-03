import { useEffect, useState } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

export type NetworkQuality = "good" | "unstable" | "offline";

function resolveNetworkQuality(state: NetInfoState): NetworkQuality {
  if (state.isConnected === false || state.isInternetReachable === false) {
    return "offline";
  }

  if (state.type === "cellular") {
    const generation = state.details.cellularGeneration;
    if (generation === "2g" || generation === "3g") {
      return "unstable";
    }
    if (state.details.isConnectionExpensive) {
      return "unstable";
    }
  }

  if (state.type === "other" || state.type === "unknown") {
    return "unstable";
  }

  return "good";
}

export function useNetworkQuality() {
  const [quality, setQuality] = useState<NetworkQuality>("good");

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setQuality(resolveNetworkQuality(state));
    });

    return unsubscribe;
  }, []);

  return quality;
}

