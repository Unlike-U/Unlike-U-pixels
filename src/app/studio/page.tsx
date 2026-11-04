import type { Metadata } from "next";
import StudioShell from "@/components/studio/StudioShell";

export const metadata: Metadata = {
  title: "Studio — pixelpunisher.x",
  description:
    "Design a contribution bitmap, connect GitHub and arm an interval painter that commits it tick by tick.",
};

export default function StudioPage() {
  return <StudioShell />;
}
