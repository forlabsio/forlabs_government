"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";

interface Document {
  id: number;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/documents/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json();
      })
      .then((data) => setDocuments(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load documents"))
      .finally(() => setLoading(false));
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Documents</h1>
        {loading ? (
          <p className="text-gray-500">Loading documents...</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : documents.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No documents submitted yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-700">Title</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-700">Status</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-700">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{doc.title}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block text-xs font-medium px-2 py-1 rounded capitalize ${statusColors[doc.status] ?? "bg-gray-50 text-gray-700"}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
