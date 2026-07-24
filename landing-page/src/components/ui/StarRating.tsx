"use client";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number; // 0–5
  count?: number;
  size?: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
  className?: string;
}

export default function StarRating({
  rating,
  count,
  size = 16,
  interactive = false,
  onChange,
  className,
}: StarRatingProps) {
  const stars = Array.from({ length: 5 }, (_, i) => i + 1);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex gap-0.5">
        {stars.map((star) => {
          const filled = star <= Math.floor(rating);
          const partial = !filled && star - 1 < rating && rating < star;
          const fillPercent = partial ? (rating - Math.floor(rating)) * 100 : 0;

          return (
            <button
              key={star}
              type="button"
              onClick={() => interactive && onChange?.(star)}
              className={cn(
                "relative",
                interactive ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default"
              )}
              style={{ width: size, height: size }}
              aria-label={interactive ? `Rate ${star} star${star > 1 ? "s" : ""}` : undefined}
              tabIndex={interactive ? 0 : -1}
            >
              {/* Empty star base */}
              <Star
                size={size}
                className="absolute inset-0 text-slate-200"
                fill="currentColor"
              />
              {/* Filled portion */}
              {(filled || partial) && (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: filled ? "100%" : `${fillPercent}%` }}
                >
                  <Star
                    size={size}
                    className="text-amber-400"
                    fill="currentColor"
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {rating > 0 && (
        <span className="text-sm font-medium text-slate-600">
          {rating.toFixed(1)}
          {count !== undefined && (
            <span className="text-slate-400 font-normal ml-1">({count})</span>
          )}
        </span>
      )}
    </div>
  );
}
