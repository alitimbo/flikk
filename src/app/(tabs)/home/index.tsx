import { useLocalSearchParams } from "expo-router";
import VideoFeed from "../../../components/features/video-feed";

export default function HomeIndex() {
  const params = useLocalSearchParams();
  const focusId =
    typeof params.focusId === "string" ? params.focusId : undefined;
  return <VideoFeed initialId={focusId} />;
}
