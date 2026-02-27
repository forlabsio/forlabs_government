"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Settings, Users } from "lucide-react";

interface Stats {
  users: number;
  services: number;
  documents: number;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 403) throw new Error("Access denied. Admin role required.");
        if (!r.ok) throw new Error("Failed to fetch stats");
        return r.json();
      })
      .then(setStats)
      .catch((err) => setError(err.message));
  }, [router]);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Panel</h1>
        {error ? (
          <p className="text-red-600">{error}</p>
        ) : !stats ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Total Users</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.users}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <Settings className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-gray-700">Services</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.services}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-gray-700">Documents</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.documents}</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
