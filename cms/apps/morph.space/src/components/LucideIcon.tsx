import {
  Blocks,
  Bot,
  CirclePlay,
  Globe,
  KeyRound,
  Link2,
  Network,
  ShieldCheck,
  Sparkles,
  Tag,
  Waypoints,
  Workflow,
  type LucideIcon as LucideType,
} from "lucide-react";

/** The icons an editor can pick by name in the CMS ("Icon" fields on the feature list and the link cards). */
export const ICON_NAMES = ["globe", "blocks", "workflow", "waypoints", "link", "bot", "tag", "play", "shield", "key", "network", "sparkles"] as const;

const icons: Record<string, LucideType> = {
  globe: Globe,
  blocks: Blocks,
  workflow: Workflow,
  waypoints: Waypoints,
  link: Link2,
  bot: Bot,
  tag: Tag,
  play: CirclePlay,
  shield: ShieldCheck,
  key: KeyRound,
  network: Network,
  sparkles: Sparkles,
};

/** A Lucide icon by name; `fallback` is the name used when the CMS gives none or an unknown one. */
export default function LucideIcon({ name, fallback = "sparkles", size = 24, strokeWidth = 1.6 }: { name?: string; fallback?: string; size?: number; strokeWidth?: number }) {
  const Icon = icons[(name || "").toLowerCase()] ?? icons[fallback] ?? Sparkles;
  return <Icon size={size} strokeWidth={strokeWidth} />;
}
