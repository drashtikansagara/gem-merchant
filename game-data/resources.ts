import {
  GEM_TYPES,
  RESOURCE_TYPES,
  type GemType,
  type ResourceType,
} from "@/game-engine/types";

export interface ResourceMeta {
  type: ResourceType;
  name: string;
  shortLabel: string;
  cssClass: string;
  color: string;
  iconColor: string;
  accessibilityLabel: string;
}

export const RESOURCE_META: Record<ResourceType, ResourceMeta> = {
  RUBY: {
    type: "RUBY",
    name: "Ruby",
    shortLabel: "Rb",
    cssClass: "gem-ruby",
    color: "#E23B44",
    iconColor: "#FF3040",
    accessibilityLabel: "Ruby",
  },
  SAPPHIRE: {
    type: "SAPPHIRE",
    name: "Sapphire",
    shortLabel: "Sp",
    cssClass: "gem-sapphire",
    color: "#2F7FD6",
    iconColor: "#2B8FFF",
    accessibilityLabel: "Sapphire",
  },
  EMERALD: {
    type: "EMERALD",
    name: "Emerald",
    shortLabel: "Em",
    cssClass: "gem-emerald",
    color: "#1FA85A",
    iconColor: "#12C45A",
    accessibilityLabel: "Emerald",
  },
  ONYX: {
    type: "ONYX",
    name: "Onyx",
    shortLabel: "On",
    cssClass: "gem-onyx",
    color: "#2A2622",
    iconColor: "#1A1714",
    accessibilityLabel: "Onyx",
  },
  PEARL: {
    type: "PEARL",
    name: "Pearl",
    shortLabel: "Pr",
    cssClass: "gem-pearl",
    color: "#F4EFE4",
    iconColor: "#F4EFE4",
    accessibilityLabel: "Pearl",
  },
  ROYAL: {
    type: "ROYAL",
    name: "Gold",
    shortLabel: "Au",
    cssClass: "gem-royal",
    color: "#D4A62A",
    iconColor: "#F0C040",
    accessibilityLabel: "Gold (wild)",
  },
};

export { GEM_TYPES, RESOURCE_TYPES };
export type { GemType, ResourceType };

export const AVATARS = [
  "crest-1",
  "crest-2",
  "crest-3",
  "crest-4",
  "crest-5",
  "crest-6",
  "crest-7",
  "crest-8",
] as const;

export type AvatarId = (typeof AVATARS)[number];
