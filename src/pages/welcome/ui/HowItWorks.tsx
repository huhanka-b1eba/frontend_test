import { useTranslation } from 'react-i18next';
import { Footprints, MapPinned, Navigation } from 'lucide-react';

const steps = [
  {
    icon: MapPinned,
    titleKey: 'howItWorks.steps.interests.title',
    descriptionKey: 'howItWorks.steps.interests.description',
  },
  {
    icon: Navigation,
    titleKey: 'howItWorks.steps.route.title',
    descriptionKey: 'howItWorks.steps.route.description',
  },
  {
    icon: Footprints,
    titleKey: 'howItWorks.steps.walk.title',
    descriptionKey: 'howItWorks.steps.walk.description',
  },
] as const;

export const HowItWorks = () => {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="how-it-works-title" className="relative">
      <h2 id="how-it-works-title" className="sr-only">
        {t('howItWorks.title')}
      </h2>
      <div aria-hidden="true" className="bg-border absolute top-5 bottom-5 left-[1.125rem] w-px" />
      <ol className="relative grid gap-2.5">
        {steps.map(({ icon: Icon, titleKey, descriptionKey }, index) => (
          <li key={titleKey} className="grid grid-cols-[2rem_1fr] gap-3">
            <span className="border-primary/20 bg-background text-primary relative z-10 flex size-8 items-center justify-center rounded-lg border">
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <span className="pt-0.5">
              <span className="flex items-baseline gap-2">
                <span className="text-muted-foreground text-xs font-semibold">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="text-foreground text-[0.95rem] font-semibold">{t(titleKey)}</span>
              </span>
              <span className="text-muted-foreground mt-0.5 block text-[0.82rem] leading-4">
                {t(descriptionKey)}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
};
