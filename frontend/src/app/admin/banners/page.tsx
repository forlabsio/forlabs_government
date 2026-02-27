"use client";

import { useState, useEffect } from "react";
import {
  fetchBanners,
  createBanner as createBannerApi,
  deleteBanner as deleteBannerApi,
} from "@/lib/api";
import {
  Plus,
  Trash2,
  X,
  Eye,
  MousePointerClick,
  Image,
} from "lucide-react";

interface Banner {
  id: string;
  title: string;
  target_url: string;
  image_url: string;
  status: "active" | "inactive";
  impressions: number;
  clicks: number;
  created_at: string;
}

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    target_url: "",
    image_url: "",
  });

  useEffect(() => {
    loadBanners();
  }, []);

  async function loadBanners() {
    setLoading(true);
    try {
      const token = localStorage.getItem("govgrants_token");
      if (token) {
        const result = await fetchBanners(token);
        setBanners(result?.banners || []);
      }
    } catch {
      // Use empty array on error
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const token = localStorage.getItem("govgrants_token");
      if (token) {
        await createBannerApi(token, form);
        setShowModal(false);
        setForm({ title: "", target_url: "", image_url: "" });
        await loadBanners();
      }
    } catch {
      // Handle error silently
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 배너를 삭제하시겠습니까?")) return;
    try {
      const token = localStorage.getItem("govgrants_token");
      if (token) {
        await deleteBannerApi(token, id);
        await loadBanners();
      }
    } catch {
      // Handle error silently
    }
  }

  return (
    <div className="px-6 py-8 lg:px-8">
      {/* Page Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">배너 관리</h1>
          <p className="mt-1 text-sm text-gray-500">
            홈페이지 배너를 관리합니다
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          배너 등록
        </button>
      </div>

      {/* Banners Table */}
      <div className="rounded-2xl bg-white shadow-sm">
        {loading ? (
          <div className="p-6">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="mb-3 h-16 animate-pulse rounded-lg bg-gray-50"
              />
            ))}
          </div>
        ) : banners.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-4">제목</th>
                  <th className="px-6 py-4">타겟 URL</th>
                  <th className="px-6 py-4">상태</th>
                  <th className="px-6 py-4 text-right">노출수</th>
                  <th className="px-6 py-4 text-right">클릭수</th>
                  <th className="px-6 py-4 text-right">CTR</th>
                  <th className="px-6 py-4 text-center">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {banners.map((banner, idx) => {
                  const ctr =
                    banner.impressions > 0
                      ? ((banner.clicks / banner.impressions) * 100).toFixed(1)
                      : "0.0";
                  return (
                    <tr
                      key={banner.id}
                      className={idx % 2 === 1 ? "bg-gray-50/50" : ""}
                    >
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          {banner.title}
                        </p>
                        <p className="text-xs text-gray-400">
                          {banner.created_at}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <a
                          href={banner.target_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {banner.target_url.length > 40
                            ? banner.target_url.slice(0, 40) + "..."
                            : banner.target_url}
                        </a>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                            banner.status === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {banner.status === "active" ? "활성" : "비활성"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 text-sm text-gray-600">
                          <Eye className="h-3.5 w-3.5 text-gray-400" />
                          {banner.impressions.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 text-sm text-gray-600">
                          <MousePointerClick className="h-3.5 w-3.5 text-gray-400" />
                          {banner.clicks.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-gray-700">
                        {ctr}%
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleDelete(banner.id)}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center">
            <Image className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="mb-1 text-sm font-medium text-gray-500">
              등록된 배너가 없습니다
            </p>
            <p className="text-xs text-gray-400">
              위의 &quot;배너 등록&quot; 버튼으로 배너를 추가하세요
            </p>
          </div>
        )}
      </div>

      {/* Create Banner Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">배너 등록</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  배너 제목
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="배너 제목을 입력하세요"
                  required
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  타겟 URL
                </label>
                <input
                  type="url"
                  value={form.target_url}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, target_url: e.target.value }))
                  }
                  placeholder="https://example.com"
                  required
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  이미지 URL
                </label>
                <input
                  type="url"
                  value={form.image_url}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, image_url: e.target.value }))
                  }
                  placeholder="https://example.com/banner.jpg"
                  required
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? "등록 중..." : "등록하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
