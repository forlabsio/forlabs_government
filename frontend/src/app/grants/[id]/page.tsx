"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { fetchGrantDetail, fetchGrants, type Grant } from "@/lib/api";
import {
  formatDDay,
  getDDayColor,
  formatAmountRange,
} from "@/lib/format";
import GrantCard from "@/components/GrantCard";
import {
  ArrowLeft,
  Bookmark,
  Calendar,
  Building2,
  MapPin,
  ExternalLink,
  Tag,
  Banknote,
} from "lucide-react";

export default function GrantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [grant, setGrant] = useState<Grant | null>(null);
  const [relatedGrants, setRelatedGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const detail = await fetchGrantDetail(id);
        setGrant(detail);

        // Fetch related grants by same category
        if (detail.category) {
          const related = await fetchGrants({
            category: detail.category,
            size: "3",
          }).catch(() => null);
          if (related?.items) {
            setRelatedGrants(
              related.items.filter((g: Grant) => g.id !== id).slice(0, 3)
            );
          }
        }
      } catch {
        setError("지원사업 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-32 rounded bg-gray-200" />
            <div className="h-12 w-3/4 rounded bg-gray-200" />
            <div className="h-64 rounded-xl bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !grant) {
    return (
      <div className="min-h-screen bg-gray-50/50">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <p className="text-lg text-gray-500">
            {error || "지원사업을 찾을 수 없습니다."}
          </p>
          <Link
            href="/grants"
            className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const ddayText = formatDDay(grant.deadline);
  const ddayColor = getDDayColor(grant.deadline);
  const amount = formatAmountRange(grant.amount_min, grant.amount_max);

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Back link */}
        <Link
          href="/grants"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          목록으로
        </Link>

        {/* Main Card */}
        <article className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {/* Header */}
          <div className="border-b border-gray-100 px-6 py-8 sm:px-8">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-bold ${ddayColor}`}
              >
                {ddayText}
              </span>
              {grant.category && (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                  {grant.category}
                </span>
              )}
              {grant.source && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
                  {grant.source}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
              {grant.title}
            </h1>

            {/* Amount */}
            {amount && (
              <p className="mt-4 text-2xl font-bold text-blue-600">
                {amount}
              </p>
            )}
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 gap-px border-b border-gray-100 bg-gray-100 sm:grid-cols-2">
            <div className="flex items-center gap-3 bg-white px-6 py-4 sm:px-8">
              <Building2 className="h-5 w-5 shrink-0 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">주관기관</p>
                <p className="font-medium text-gray-900">
                  {grant.organization || "-"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white px-6 py-4 sm:px-8">
              <MapPin className="h-5 w-5 shrink-0 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">지역</p>
                <p className="font-medium text-gray-900">
                  {grant.region || "전국"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white px-6 py-4 sm:px-8">
              <Calendar className="h-5 w-5 shrink-0 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">마감일</p>
                <p className="font-medium text-gray-900">
                  {grant.deadline || "상시접수"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white px-6 py-4 sm:px-8">
              <Banknote className="h-5 w-5 shrink-0 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">지원금액</p>
                <p className="font-medium text-gray-900">
                  {amount || "금액 미정"}
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          {grant.description && (
            <div className="px-6 py-8 sm:px-8">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                <Tag className="h-5 w-5 text-gray-400" />
                사업 개요
              </h2>
              <div className="whitespace-pre-wrap text-base leading-relaxed text-gray-600">
                {grant.description}
              </div>
            </div>
          )}

          {/* Eligibility */}
          {grant.eligibility && (
            <div className="border-t border-gray-100 px-6 py-8 sm:px-8">
              <h2 className="mb-4 text-lg font-bold text-gray-900">
                신청 자격
              </h2>
              <div className="whitespace-pre-wrap text-base leading-relaxed text-gray-600">
                {grant.eligibility}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 border-t border-gray-100 px-6 py-6 sm:flex-row sm:px-8">
            {grant.source_url && (
              <a
                href={grant.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                원문 보기
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50">
              <Bookmark className="h-4 w-4" />
              북마크
            </button>
          </div>
        </article>

        {/* Related Grants */}
        {relatedGrants.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-6 text-xl font-bold text-gray-900">
              비슷한 지원사업
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relatedGrants.map((g) => (
                <GrantCard key={g.id} grant={g} />
              ))}
            </div>
          </section>
        )}

        {/* Bottom spacing */}
        <div className="h-16" />
      </div>
    </div>
  );
}
