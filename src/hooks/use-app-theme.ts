import { useEffect } from "react";
import { useColorScheme } from "nativewind";

export function useAppTheme() {
  const { colorScheme, setColorScheme } = useColorScheme();

  useEffect(() => {
    if (colorScheme !== "dark") {
      setColorScheme("dark");
    }
  }, [colorScheme, setColorScheme]);

  return { colorScheme, setColorScheme };
}
