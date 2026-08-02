export default function NotFound() {
  return (
    <div className="text-center py-20">
      <h1 className="text-6xl font-bold mb-4">404</h1>
      <p className="text-xl text-gray-500 mb-6">This beat doesn&apos;t exist.</p>
      <a href="/" className="text-blue-600 hover:underline">← Back to beats</a>
    </div>
  );
}
