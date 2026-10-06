export const GOAL_PARTNERS = 50;
export const FOUNDING_PARTNER_SLOTS = 25;
export const GOAL_DEADLINE = "2026-12-31";

export const STAGES = [
  "prospekt",
  "kontaktad",
  "dialog",
  "mote_bokat",
  "onboarding",
  "betald",
  "live",
  "forlorad",
  "aterkom",
] as const;
export type Stage = (typeof STAGES)[number];

/** Huvudflödet 1–7, utan sidospåren. */
export const MAIN_STAGES = STAGES.slice(0, 7) as readonly Stage[];
export const SIGNED_STAGES: readonly Stage[] = ["betald", "live"];

export const STAGE_LABELS: Record<Stage, string> = {
  prospekt: "Prospekt",
  kontaktad: "Kontaktad",
  dialog: "Dialog",
  mote_bokat: "Möte bokat",
  onboarding: "Onboarding",
  betald: "Betald partner",
  live: "Live",
  forlorad: "Förlorad",
  aterkom: "Återkom senare",
};

export const STAGE_DONE_WHEN: Record<Stage, string> = {
  prospekt: "Första kontakt tagen",
  kontaktad: "De har svarat eller visat intresse",
  dialog: "Möte eller besök bokat",
  mote_bokat: "Mötet genomfört",
  onboarding: "Betalning gjord",
  betald: "Erbjudandet är publicerat",
  live: "",
  forlorad: "",
  aterkom: "",
};

export const STAGE_COLORS: Record<Stage, string> = {
  prospekt: "bg-gray-100 text-gray-700",
  kontaktad: "bg-sky-100 text-sky-800",
  dialog: "bg-indigo-100 text-indigo-800",
  mote_bokat: "bg-amber-100 text-amber-800",
  onboarding: "bg-orange-100 text-orange-800",
  betald: "bg-lime-100 text-brand",
  live: "bg-brand text-white",
  forlorad: "bg-red-100 text-red-800",
  aterkom: "bg-purple-100 text-purple-800",
};

export const ACTIVITY_TYPES = ["besok", "samtal", "mejl", "dm"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  besok: "Besök",
  samtal: "Samtal",
  mejl: "Mejl",
  dm: "DM",
};

export const OUTCOMES = [
  "Positiv",
  "Vill ha mer info",
  "Ej på plats / inget svar",
  "Återkom senare",
  "Nej tack",
] as const;

export const OBJECTIONS = [
  "Pris",
  "Timing",
  "Ser inte nyttan",
  "Har redan liknande",
  "Måste prata med ägaren/kedjan",
] as const;

export const LOST_REASONS = [
  "Pris",
  "Timing",
  "Ej intresserad",
  "Kedja – beslut centralt",
  "Ingen kontakt",
  "Annat",
] as const;

export const CATEGORIES = [
  "Mat & dryck",
  "Fika",
  "Mode",
  "Handel",
  "Skönhet & hälsa",
  "Träning",
  "Upplevelser",
  "Tjänster",
  "Övrigt",
] as const;

export const MUNICIPALITIES = [
  "Gävle",
  "Sandviken",
  "Hudiksvall",
  "Söderhamn",
  "Bollnäs",
  "Ljusdal",
  "Ovanåker",
  "Hofors",
  "Ockelbo",
  "Nordanstig",
] as const;

export const NETWORKS = [
  "Gävle City",
  "Handel Söderhamn",
  "Hudik City",
  "Flanör",
  "Nian",
  "Valbo Köpcentrum",
] as const;

export const PACKAGES = ["standard", "premium"] as const;
export type Package = (typeof PACKAGES)[number];
export const PACKAGE_LABELS: Record<Package, string> = {
  standard: "Standard 500 kr/mån",
  premium: "Premium 700 kr/mån",
};

export const CHANNELS = ["telefon", "sms", "mejl", "instagram", "facebook", "besok"] as const;
export type Channel = (typeof CHANNELS)[number];
export const CHANNEL_LABELS: Record<Channel, string> = {
  telefon: "Telefon",
  sms: "SMS",
  mejl: "Mejl",
  instagram: "Instagram",
  facebook: "Facebook",
  besok: "Besök",
};

export function isStage(value: unknown): value is Stage {
  return typeof value === "string" && (STAGES as readonly string[]).includes(value);
}
