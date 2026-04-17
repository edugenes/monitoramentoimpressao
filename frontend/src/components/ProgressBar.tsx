interface ProgressBarProps {
  percentage: number;
  showLabel?: boolean;
}

export default function ProgressBar({ percentage, showLabel = true }: ProgressBarProps) {
  const clampedPercentage = Math.min(percentage, 100);
  
  let colorClass = 'bg-green-500';
  if (percentage >= 100) {
    colorClass = 'bg-red-500';
  } else if (percentage >= 80) {
    colorClass = 'bg-yellow-500';
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-slate-200 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all ${colorClass}`}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
      {showLabel && (
        <span className={`text-sm font-medium min-w-[3rem] text-right ${
          percentage >= 100 ? 'text-red-600' : percentage >= 80 ? 'text-yellow-600' : 'text-green-600'
        }`}>
          {percentage}%
        </span>
      )}
    </div>
  );
}
