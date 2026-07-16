import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">Genvora</h1>
        <p className="text-gray-500">AI-powered platform</p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/sign-in"
            className="rounded-md bg-black px-6 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-md border border-gray-300 px-6 py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Sign up
          </Link>
        </div>
      </div>
    </main>
  );
}
