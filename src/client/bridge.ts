import type { SectionId } from "../shared/sections.js";

export const bridge = {
  sessionId: "",
  onSection: (_id: SectionId) => {},
  onAim: (_system: number) => {},
  onReady: (_scene: unknown) => {},
};
