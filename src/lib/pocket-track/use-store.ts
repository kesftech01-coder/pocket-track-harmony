import { useEffect, useState } from "react";

export function useStoreSync() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onChange = () => setTick((t) => t + 1);
    window.addEventListener("pt:change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("pt:change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return tick;
}
