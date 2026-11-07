import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// True when the phone's "reduce motion" accessibility setting is on. Every
// animation helper in components/motion checks this and skips its animation.
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduce(v));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}
