export const GRAPH_COLORS = {
  Grant: "#3b82f6",
  Agency: "#f97316",
  TechArea: "#8b5cf6",
  Company: "#10b981",
} as const;

export const SOURCE_LABELS: Record<string, string> = {
  bizinfo: "기업마당",
  kocca: "KOCCA",
  kstartup: "K-Startup",
  subsidy24: "보조금24",
  smes: "중소벤처24",
};

export const CHART_COLORS = [
  "#3b82f6", "#f97316", "#10b981", "#8b5cf6", "#00d4ff",
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
