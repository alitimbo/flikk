import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import VideoFeed from "../../../components/features/video-feed";
import { useSyncNotificationContext } from "@/hooks/useSyncNotificationContext";
import { useAuthUid } from "@/hooks/useAuthUser";

export default function HomeIndex() {
  const params = useLocalSearchParams();
  const { i18n } = useTranslation();
  const uid = useAuthUid();
  const focusId =
    typeof params.focusId === "string" ? params.focusId : undefined;

  useSyncNotificationContext(uid, i18n.language);

  return <VideoFeed initialId={focusId} />;
}
