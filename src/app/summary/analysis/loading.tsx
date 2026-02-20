export default function Loading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-lg" />
      </div>
    </div>
  )
}
