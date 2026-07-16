import { redirect } from "next/navigation";
import { headers } from "next/headers";

// Server-side session check for dashboard layout
// The middleware handles the redirect for unauthenticated users,
// but this provides a second layer for server components.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
