import { ProductCardSkeleton } from "@/components/ui/LoadingSkeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 pt-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-8 w-56 rounded-full bg-slate-200 animate-pulse mb-4" />
        <div className="h-4 w-full max-w-xl rounded-full bg-slate-200 animate-pulse mb-10" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </main>
  );
}
