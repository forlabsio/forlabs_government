import Link from "next/link";
import { formatDDay, getDDayColor, formatAmountRange } from "@/lib/format";
import type { Grant } from "@/lib/api";

const SOURCE_COLORS: Record<string, string> = {
  bizinfo: "bg-blue-50 text-blue-700",
  smes: "bg-purple-50 text-purple-700",
  iris: "bg-teal-50 text-teal-700",
  default: "bg-gray-50 text-gray-600",
};

interface GrantCardProps {
  grant: Grant;
}

export default function GrantCard({ grant }: GrantCardProps) {
  const ddayText = formatDDay(grant.deadline);
  const ddayColor = getDDayColor(grant.deadline);
  const amount = formatAmountRange(grant.amount_min, grant.amount_max);
  const sourceColor = SOURCE_COLORS[grant.source] || SOURCE_COLORS.default;

  return (
    <Link href={`/grants/${grant.id}`} className="group block">
      <article className="flex h-full flex-col rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
        {/* Top: D-Day Badge + Source */}
        <div className="mb-4 flex items-start justify-between">
          <span
            className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-bold ${ddayColor}`}
          >
            {ddayText}
          </span>
          <span
            className={`rounded-md px-2 py-1 text-xs font-medium ${sourceColor}`}
          >
            {grant.source}
          </span>
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
        {amount && (
          <p className="mb-3 text-lg font-bold text-blue-600">{amount}</p>
        )}

        {/* Bottom: Category + Region */}
        <div className="flex flex-wrap items-center gap-2">
          {grant.category && (
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
              {grant.category}
            </span>
          )}
          {grant.region && (
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
              {grant.region}
            </span>
          )}
        </div>
      </article>
    </Link>
  );
}
