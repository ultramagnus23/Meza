export function MetricCard({
  title,
  value,
}: {
  title: string
  value: string
}) {
  return (
    <div className="p-4 border rounded">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
