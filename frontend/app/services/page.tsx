"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";

interface Service {
  id: number;
  name: string;
  description: string | null;
  category: string;
  is_active: boolean;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/services/`)
      .then((r) => r.json())
      .then((data) => setServices(Array.isArray(data) ? data : []))
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Government Services</h1>
        {loading ? (
          <p className="text-gray-500">Loading services...</p>
        ) : services.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Settings className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No services available at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <div key={service.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm">
                <span className="inline-block text-xs font-medium bg-blue-50 text-blue-600 px-2 py-1 rounded mb-3">
                  {service.category}
                </span>
                <h2 className="font-semibold text-gray-900 mb-2">{service.name}</h2>
                {service.description && <p className="text-sm text-gray-500">{service.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
