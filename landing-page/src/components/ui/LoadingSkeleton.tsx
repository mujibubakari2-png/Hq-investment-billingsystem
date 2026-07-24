"use client";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "skeleton rounded-xl",
        className
      )}
      aria-hidden="true"
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-100 bg-white">
      <Skeleton className="h-64 w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex justify-between items-center pt-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function BannerSkeleton() {
  return <Skeleton className="h-80 md:h-[480px] w-full rounded-3xl" />;
}

export function CategorySkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden">
      <Skeleton className="aspect-[3/4] w-full rounded-none" />
    </div>
  );
}

export function TestimonialSkeleton() {
  return (
    <div className="rounded-2xl p-8 border border-slate-100 bg-white space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
      <Skeleton className="h-[500px] w-full rounded-3xl" />
      <div className="space-y-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-px w-full" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-4 w-full" />)}
        </div>
        <Skeleton className="h-14 w-full rounded-full" />
      </div>
    </div>
  );
}
