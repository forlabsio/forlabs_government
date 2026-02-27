import Link from "next/link";
import { FileText, Settings, ShieldCheck, Users } from "lucide-react";

const services = [
  {
    title: "Government Services",
    description: "Browse and apply for available government services",
    href: "/services",
    icon: Settings,
    color: "bg-blue-50 text-blue-600",
  },
  {
    title: "My Documents",
    description: "Manage your submitted documents and applications",
    href: "/documents",
    icon: FileText,
    color: "bg-green-50 text-green-600",
  },
  {
    title: "Citizen Portal",
    description: "Access your citizen account and personal information",
    href: "/profile",
    icon: Users,
    color: "bg-purple-50 text-purple-600",
  },
  {
    title: "Admin Panel",
    description: "Government staff and administrative tools",
    href: "/admin",
    icon: ShieldCheck,
    color: "bg-orange-50 text-orange-600",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">Government Portal</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Register
            </Link>
          </nav>
        </div>
      </header>

      <section className="bg-blue-700 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-4">Welcome to the Government Services Portal</h1>
          <p className="text-lg text-blue-100 mb-8">
            Access government services, submit documents, and manage your applications online.
          </p>
          <Link
            href="/register"
            className="inline-block bg-white text-blue-700 font-semibold px-8 py-3 rounded-lg hover:bg-blue-50"
          >
            Get Started
          </Link>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">Available Services</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service) => (
            <Link key={service.href} href={service.href} className="group">
              <div className="bg-white rounded-xl p-6 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all">
                <div className={`inline-flex p-3 rounded-lg ${service.color} mb-4`}>
                  <service.icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-blue-600">
                  {service.title}
                </h3>
                <p className="text-sm text-gray-500">{service.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Government Portal. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
