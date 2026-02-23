"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="antialiased" suppressHydrationWarning>
        <main className="mx-auto min-h-screen w-full max-w-2xl p-6">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-3 text-sm text-neutral-700">
            {error.message || "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-md bg-black px-4 py-2 text-sm text-white"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
