"use client";

import { useState } from "react";

type SessionRatingFormProps = {
  rating: number | null;
  onRate: (rating: number) => Promise<void>;
  onError: (message: string | null) => void;
};

export function SessionRatingForm({ rating, onRate, onError }: SessionRatingFormProps): JSX.Element {
  const [ratingPending, setRatingPending] = useState<number | null>(null);

  const handleRating = async (nextRating: number) => {
    if (ratingPending === nextRating) {
      return;
    }

    setRatingPending(nextRating);
    onError(null);

    try {
      await onRate(nextRating);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to update rating.");
    } finally {
      setRatingPending(null);
    }
  };

  return (
    <div className="session-rating-block" style={{ marginTop: 16 }}>
      <strong>Rating</strong>
      <div className="session-rating" role="radiogroup" aria-label="Session rating">
        {Array.from({ length: 5 }, (_, index) => {
          const value = index + 1;
          const filled = (rating ?? 0) >= value;
          return (
            <button
              key={value}
              type="button"
              className={`session-rating__star${filled ? " is-filled" : ""}`}
              onClick={() => void handleRating(value)}
              disabled={ratingPending != null}
              aria-label={`Rate session ${value} out of 5`}
            >
              ★
            </button>
          );
        })}
      </div>
    </div>
  );
}