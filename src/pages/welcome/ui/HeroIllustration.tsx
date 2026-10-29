import echpochmakMarker from '@shared/assets/icons/echpochmak-marker.svg';

export const HeroIllustration = () => {
  return (
    <div
      className="relative mx-auto h-[230px] w-full max-w-[390px] sm:h-[286px]"
      aria-hidden="true"
    >
      <svg viewBox="0 0 358 286" className="absolute inset-0 h-full w-full" fill="none">
        <path
          d="M21 238C62 214 106 217 148 234C195 253 246 250 337 216"
          stroke="hsl(var(--secondary))"
          strokeWidth="28"
          strokeLinecap="round"
        />
        <path
          d="M21 238C62 214 106 217 148 234C195 253 246 250 337 216"
          stroke="hsl(var(--primary))"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="8 12"
          className="welcome-route-line"
        />

        <g transform="translate(36 82)">
          <path d="M14 111H109V124H14V111Z" fill="hsl(var(--primary))" />
          <path
            d="M27 64H95V111H27V64Z"
            fill="hsl(var(--card))"
            stroke="hsl(var(--primary))"
            strokeWidth="4"
          />
          <path d="M35 77H49V111H35V77Z" fill="hsl(var(--accent))" />
          <path d="M57 77H71V111H57V77Z" fill="hsl(var(--destructive))" opacity="0.86" />
          <path d="M79 77H88V111H79V77Z" fill="hsl(var(--primary))" opacity="0.82" />
          <path d="M18 64C31 48 42 39 61 39C80 39 94 49 105 64H18Z" fill="hsl(var(--primary))" />
          <path
            d="M61 11C76 27 86 42 88 60H34C36 42 46 27 61 11Z"
            fill="hsl(var(--card))"
            stroke="hsl(var(--primary))"
            strokeWidth="4"
          />
          <circle cx="61" cy="36" r="8" fill="hsl(var(--accent))" />
        </g>

        <g transform="translate(166 22)">
          <path
            d="M38 7L63 128H13L38 7Z"
            fill="hsl(var(--card))"
            stroke="hsl(var(--primary))"
            strokeWidth="5"
          />
          <path d="M38 7L52 128H24L38 7Z" fill="hsl(var(--primary))" opacity="0.14" />
          <path
            d="M22 72H54"
            stroke="hsl(var(--destructive))"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path d="M28 96H48" stroke="hsl(var(--accent))" strokeWidth="5" strokeLinecap="round" />
          <path
            d="M38 7L52 22H41L50 37H36"
            stroke="hsl(var(--primary))"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M6 128H70V144H6V128Z" fill="hsl(var(--primary))" />
        </g>

        <g transform="translate(248 91)">
          <path d="M17 95H89V112H17V95Z" fill="hsl(var(--primary))" />
          <path
            d="M25 46H81V95H25V46Z"
            fill="hsl(var(--card))"
            stroke="hsl(var(--primary))"
            strokeWidth="4"
          />
          <path
            d="M16 46C23 25 37 13 53 13C69 13 83 25 90 46H16Z"
            fill="hsl(var(--secondary))"
            stroke="hsl(var(--primary))"
            strokeWidth="4"
          />
          <path d="M53 0V14" stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round" />
          <path d="M47 6H59" stroke="hsl(var(--accent))" strokeWidth="4" strokeLinecap="round" />
          <path d="M36 63H48V95H36V63Z" fill="hsl(var(--destructive))" opacity="0.82" />
          <path d="M59 63H70V95H59V63Z" fill="hsl(var(--accent))" />
        </g>

        <g transform="translate(214 178)">
          <path d="M0 41H82V55H0V41Z" fill="hsl(var(--primary))" />
          <path
            d="M9 13H72V41H9V13Z"
            fill="hsl(var(--card))"
            stroke="hsl(var(--primary))"
            strokeWidth="4"
          />
          <path d="M2 13L41 0L80 13H2Z" fill="hsl(var(--destructive))" />
          <path d="M19 25H31V41H19V25Z" fill="hsl(var(--accent))" />
          <path d="M42 25H54V41H42V25Z" fill="hsl(var(--primary))" opacity="0.72" />
        </g>

        <circle cx="22" cy="238" r="9" fill="hsl(var(--primary))" />
        <circle
          cx="22"
          cy="238"
          r="15"
          stroke="hsl(var(--primary))"
          strokeOpacity="0.22"
          strokeWidth="3"
        />
        <circle cx="338" cy="216" r="9" fill="hsl(var(--destructive))" />
        <circle
          cx="338"
          cy="216"
          r="15"
          stroke="hsl(var(--destructive))"
          strokeOpacity="0.22"
          strokeWidth="3"
        />
      </svg>

      <img
        src={echpochmakMarker}
        alt=""
        className="welcome-route-point absolute top-[58%] left-[39%] h-[58px] w-[52px] drop-shadow-[0_10px_0_rgba(0,0,0,0.12)]"
      />

      <div className="bg-accent absolute top-5 left-7 size-3 rounded-full" />
      <div className="bg-destructive/70 absolute top-20 right-8 size-2 rounded-full" />
      <div className="bg-primary/70 absolute bottom-7 left-28 size-2 rounded-full" />
    </div>
  );
};
