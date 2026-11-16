import type { SectionId } from "../shared/sections.js";

export const bridge = {
  sessionId: "",
  onSection: (_id: SectionId) => {},
  onReady: (_scene: unknown) => {},
};
