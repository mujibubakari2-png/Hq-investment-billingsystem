export interface RatingOnly {
  rating: number;
}

export function getReviewSummary(reviews: RatingOnly[]) {
  const reviewCount = reviews.length;

  if (reviewCount === 0) {
    return { avgRating: 0, reviewCount };
  }

  const total = reviews.reduce((sum, review) => sum + review.rating, 0);

  return {
    avgRating: Math.round((total / reviewCount) * 10) / 10,
    reviewCount,
  };
}
