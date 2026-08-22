import type { Metadata } from "next";
import { LockscreenClient } from "./lockscreen-client";

export const metadata: Metadata = {
  title: "Lock Screen | NODE",
};

export default function LockscreenPage() {
  return <LockscreenClient />;
}
