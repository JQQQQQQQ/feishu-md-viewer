/**
 * Error state component displayed when content fetching fails.
 * Provides a user-friendly message and retry button.
 */

interface ErrorStateProps {
  message: string;
  url?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, url, onRetry }: ErrorStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen bg-white p-8"
      role="alert"
      aria-label="Error loading document"
    >
      <div className="w-full max-w-md text-center space-y-6">
        {/* Error icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        {/* Error heading */}
        <h1 className="text-xl font-semibold text-gray-900">
          Failed to Load Document
        </h1>

        {/* Error message */}
        <p className="text-gray-600 text-sm leading-relaxed">
          {message}
        </p>

        {/* URL display */}
        {url && (
          <p className="text-xs text-gray-400 break-all font-mono bg-gray-50 p-3 rounded-lg">
            {url}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3 pt-4">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Retry
            </button>
          )}

          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              Open Original URL
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
