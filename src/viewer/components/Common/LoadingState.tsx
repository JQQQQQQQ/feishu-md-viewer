/**
 * Loading state component displayed while fetching remote markdown content.
 * Shows a skeleton UI mimicking document structure.
 */
export function LoadingState() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen bg-white p-8"
      role="status"
      aria-label="Loading document"
    >
      <div className="w-full max-w-3xl space-y-6 animate-pulse">
        {/* Title skeleton */}
        <div className="h-8 bg-gray-200 rounded w-2/3" />

        {/* Paragraph skeletons */}
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
          <div className="h-4 bg-gray-200 rounded w-4/5" />
        </div>

        {/* Subheading skeleton */}
        <div className="h-6 bg-gray-200 rounded w-1/3 mt-8" />

        {/* More paragraph skeletons */}
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
        </div>

        {/* Code block skeleton */}
        <div className="h-24 bg-gray-100 border border-gray-200 rounded-lg" />

        {/* Status text */}
        <p className="text-center text-gray-500 text-sm mt-8">
          Loading document...
        </p>
      </div>
    </div>
  );
}
