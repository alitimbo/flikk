import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";
import { useTranslation } from "react-i18next";
import VideoFeed from "../../../components/features/video-feed";
import { useSyncNotificationContext } from "@/hooks/useSyncNotificationContext";

export default function HomeIndex() {
  const params = useLocalSearchParams();
  const { i18n } = useTranslation();
  const [uid, setUid] = useState<string | undefined>(() => getAuth().currentUser?.uid);
  const focusId =
    typeof params.focusId === "string" ? params.focusId : undefined;

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid);
    });
    return unsubscribe;
  }, []);

  useSyncNotificationContext(uid, i18n.language);

  return <VideoFeed initialId={focusId} />;
}
