export default function Loading() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      <div className="flex gap-2">
        <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-10 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded" />
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="h-14 w-full bg-gray-100 dark:bg-gray-800 rounded" />
      ))}
    </div>
  )
}
