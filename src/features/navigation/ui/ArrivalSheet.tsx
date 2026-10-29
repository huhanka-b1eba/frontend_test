import { Button } from '@shared/ui/button';
import { saveLocationRating } from '@shared/api';
import { Textarea } from '@shared/ui/textarea';
import { CheckCircle2, Star } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { NavigationPlace } from '../model';

type ArrivalSheetProps = {
  place: NavigationPlace;
  onContinue: () => void;
};

const BACKEND_PLACE_ID_PATTERN = /^(node|way|relation)\/\d+$/;

export const ArrivalSheet = ({ place, onContinue }: ArrivalSheetProps) => {
  const { t } = useTranslation();
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [ratingStatus, setRatingStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const canRatePlace = BACKEND_PLACE_ID_PATTERN.test(place.id);

  const handleSaveRating = async () => {
    const normalizedReview = review.trim();

    setRatingStatus('saving');

    try {
      await saveLocationRating({
        placeId: place.id,
        rating,
        review: normalizedReview ? normalizedReview : null,
      });
      setRatingStatus('success');
    } catch (error) {
      console.error('[Location rating] save failed', error);
      setRatingStatus('error');
    }
  };

  return (
    <section className="bg-card text-card-foreground shadow-mobile-sheet absolute right-0 bottom-0 left-0 z-30 rounded-t-xl border-t px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div className="flex items-start gap-3">
        <div className="bg-primary text-primary-foreground grid size-10 shrink-0 place-items-center rounded-xl">
          <CheckCircle2 className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-primary text-sm font-semibold">{t('navigation.arrival.title')}</p>
          <h2 className="mt-0.5 line-clamp-2 font-semibold">{place.name}</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {t('navigation.arrival.visitDuration', {
              minutes: place.visitDurationMinutes,
            })}
          </p>
        </div>
      </div>

      {canRatePlace ? (
        <div className="mt-4 rounded-xl border p-3">
          <p className="text-sm font-semibold">{t('navigation.rating.title')}</p>
          <div
            className="mt-2 flex gap-1"
            role="radiogroup"
            aria-label={t('navigation.rating.title')}
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className="text-primary rounded-md p-1"
                aria-label={t('navigation.rating.value', { value })}
                aria-checked={rating === value}
                role="radio"
                onClick={() => {
                  setRating(value);
                }}
              >
                <Star
                  className="size-6"
                  fill={value <= rating ? 'currentColor' : 'none'}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
          <Textarea
            className="mt-2 min-h-20 text-sm"
            maxLength={2000}
            value={review}
            placeholder={t('navigation.rating.reviewPlaceholder')}
            onChange={(event) => {
              setReview(event.target.value);
              if (ratingStatus !== 'idle') {
                setRatingStatus('idle');
              }
            }}
          />
          {ratingStatus === 'success' && (
            <p className="text-primary mt-2 text-sm font-medium">
              {t('navigation.rating.success')}
            </p>
          )}
          {ratingStatus === 'error' && (
            <p className="text-destructive mt-2 text-sm font-medium">
              {t('navigation.rating.error')}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            className="mt-3 w-full rounded-lg"
            disabled={ratingStatus === 'saving'}
            onClick={() => {
              void handleSaveRating();
            }}
          >
            {ratingStatus === 'saving'
              ? t('navigation.rating.saving')
              : t('navigation.rating.save')}
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground mt-4 rounded-xl border p-3 text-sm">
          {t('navigation.rating.unavailable')}
        </p>
      )}

      <Button type="button" className="mt-4 w-full rounded-xl" onClick={onContinue}>
        {t('navigation.arrival.continue')}
      </Button>
    </section>
  );
};
