import { useEffect, useState } from "react";
import type { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";

export function useAuthUser() {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(
    () => getAuth().currentUser,
  );

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
    });
    return unsubscribe;
  }, []);

  return user;
}

export function useAuthUid() {
  const user = useAuthUser();
  return user?.uid;
}

