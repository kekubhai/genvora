"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  async function handleSignOut() {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/sign-in");
        },
      },
    });
  }

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <main className="p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <button
            onClick={handleSignOut}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
          >
            Sign out
          </button>
        </div>

        {session?.user && (
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="text-sm font-medium text-gray-500">Signed in as</h2>
            <p className="mt-1 font-medium">{session.user.name}</p>
            <p className="text-sm text-gray-500">{session.user.email}</p>
          </div>
        )}

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <p className="text-gray-500 text-sm">
            Phase 0 complete. Product features coming in Phase 1.
          </p>
        </div>
      </div>
    </main>
  );
}
