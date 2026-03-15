// Foundry design system colors
export const FOUNDRY = {
  bg:       "#0B1117",
  sidebar:  "#161C22",
  panel:    "#1C2B3C",
  card:     "#1F2D3D",
  border:   "rgba(255,255,255,0.08)",
  primary:  "#2D72D2",
  glow:     "rgba(45,114,210,0.15)",
  text:     "#F0F4F8",
  muted:    "#7B919E",
  success:  "#23A26D",
  warning:  "#BF7326",
  danger:   "#C23030",
} as const;

export const GRAPH_COLORS = {
  Grant:    "#3b82f6",
  Agency:   "#f97316",
  TechArea: "#8b5cf6",
  Company:  "#23A26D",
} as const;

export const SOURCE_LABELS: Record<string, string> = {
  bizinfo:  "기업마당",
  kocca:    "KOCCA",
  kstartup: "K-Startup",
  subsidy24: "보조금24",
  smes:     "중소벤처24",
};

export const SOURCE_KEYS = ["bizinfo", "kocca", "kstartup", "subsidy24", "smes"] as const;

export const CHART_COLORS = [
  "#3b82f6", "#f97316", "#10b981", "#8b5cf6", "#2D72D2",
  "#ef4444", "#eab308", "#06b6d4",
];

export const INDUSTRY_OPTIONS = [
  "IT/소프트웨어", "제조업", "바이오/의료", "문화/콘텐츠",
  "농업/식품", "건설", "유통/물류", "서비스업",
];

export const REGION_OPTIONS = [
  "전국", "서울", "경기", "인천", "부산", "대구",
  "광주", "대전", "울산", "세종", "강원", "충북",
  "충남", "전북", "전남", "경북", "경남", "제주",
];
