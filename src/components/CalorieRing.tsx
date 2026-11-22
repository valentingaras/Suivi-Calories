interface CalorieRingProps {
  consumed: number;
  goal: number;
}

export function CalorieRing({ consumed, goal }: CalorieRingProps) {
  const safeGoal = goal > 0 ? goal : 2000;
  const ratio = Math.min(1, Math.max(0, consumed / safeGoal));
  const isOver30Pct = goal > 0 && consumed > goal * 1.3;

  const size = 116;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);

  return (
    <div className="relative flex h-[116px] w-[116px] shrink-0 items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-[#E8EFEA] dark:stroke-[#233229]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={`transition-all duration-300 ease-out ${
            isOver30Pct
              ? 'stroke-[#DC2626] dark:stroke-[#F87171]'
              : 'stroke-[#0D9464] dark:stroke-[#34D399]'
          }`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        <span
          className={`text-2xl font-extrabold tracking-tight tabular-nums leading-none font-display ${
            isOver30Pct
              ? 'text-[#B91C1C] dark:text-[#FCA5A5]'
              : 'text-[#14231C] dark:text-[#EAF2ED]'
          }`}
        >
          {Math.round(consumed)}
        </span>
        <span className="mt-1 text-[11px] font-medium leading-none text-[#5E7066] dark:text-[#98ABA0]">
          kcal
        </span>
      </div>
    </div>
  );
}
