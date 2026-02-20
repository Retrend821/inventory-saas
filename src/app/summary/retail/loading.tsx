export default function Loading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded" />
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="h-12 w-full bg-gray-100 dark:bg-gray-800 rounded" />
      ))}
    </div>
  )
}
