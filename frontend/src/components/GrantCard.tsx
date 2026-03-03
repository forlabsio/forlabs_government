import Link from "next/link";
import { formatDDay, getDDayColor, formatAmountRange } from "@/lib/format";
import type { Grant } from "@/lib/api";

const SOURCE_COLORS: Record<string, string> = {
  bizinfo: "bg-blue-50 text-blue-700",
  kocca: "bg-orange-50 text-orange-700",
  kstartup: "bg-indigo-50 text-indigo-700",
  subsidy24: "bg-pink-50 text-pink-700",
  smes: "bg-purple-50 text-purple-700",
  default: "bg-gray-50 text-gray-600",
};

const SOURCE_LABELS: Record<string, string> = {
  bizinfo: "기업마당",
  kocca: "KOCCA",
  kstartup: "K-Startup",
  subsidy24: "보조금24",
  smes: "중소벤처24",
};

interface GrantCardProps {
  grant: Grant;
}

export default function GrantCard({ grant }: GrantCardProps) {
  const ddayText = formatDDay(grant.end_date);
  const ddayColor = getDDayColor(grant.end_date);
  const amount = formatAmountRange(grant.amount_min, grant.amount_max);
  const primarySource = grant.sources?.[0] || "default";
  const sourceColor = SOURCE_COLORS[primarySource] || SOURCE_COLORS.default;
  const sourceLabel = SOURCE_LABELS[primarySource] || primarySource;

  return (
    <Link href={`/grants/${grant.id}`} className="group block">
      <article className="flex h-full flex-col rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
        {/* Top: D-Day Badge + Sources */}
        <div className="mb-4 flex items-start justify-between">
          <span
            className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-bold ${ddayColor}`}
          >
            {ddayText}
          </span>
          <div className="flex gap-1">
            <span
              className={`rounded-md px-2 py-1 text-xs font-medium ${sourceColor}`}
            >
              {sourceLabel}
            </span>
            {grant.sources?.length > 1 && (
              <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
                +{grant.sources.length - 1}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="mb-2 line-clamp-2 text-base font-semibold leading-snug text-gray-900 transition-colors group-hover:text-blue-600">
          {grant.title}
        </h3>

        {/* Organization */}
        <p className="mb-4 text-sm text-gray-500">{grant.organization}</p>

        {/* Spacer to push bottom content down */}
        <div className="mt-auto" />

        {/* Amount */}
        {amount && amount !== "금액 미정" && (
          <p className="mb-3 text-lg font-bold text-blue-600">{amount}</p>
        )}

        {/* Bottom: Category + Status */}
        <div className="flex flex-wrap items-center gap-2">
          {grant.category && (
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
              {grant.category}
            </span>
          )}
          {grant.status && (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                grant.status === "접수중"
                  ? "bg-green-50 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {grant.status}
            </span>
          )}
        </div>
      </article>
    </Link>
  );
}
