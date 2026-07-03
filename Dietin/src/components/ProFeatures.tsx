import { useUserStore } from "@/stores/userStore";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface ProFeaturesProps {
  children: React.ReactNode;
  showOnlyForNonPro?: boolean;
}

export default function ProFeatures({ children, showOnlyForNonPro = false }: ProFeaturesProps) {
  const [isPro, setIsPro] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const storeUser = useUserStore((state) => state.user);

  useEffect(() => {
    // Prefer the already-loaded user store value so the initial render is correct.
    setIsPro(!!storeUser?.isPro);
    setIsLoading(false);

    // Keep in sync with Firestore in case the store hasn't finished loading or
    // the pro status changes on another device.
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const unsubscribe = onSnapshot(
      doc(db, "users", uid),
      (snapshot) => {
        const data = snapshot.data();
        setIsPro(!!data?.isPro);
      },
      () => {
        // On snapshot error, fall back to the store value.
        setIsPro(!!storeUser?.isPro);
      }
    );

    return () => unsubscribe();
  }, [storeUser?.isPro]);

  if (isLoading) {
    return null;
  }

  // If showOnlyForNonPro is true, only show content when user is NOT pro
  if (showOnlyForNonPro) {
    return !isPro ? <>{children}</> : null;
  }

  // Otherwise, only show content when user IS pro
  return isPro ? <>{children}</> : null;
} 