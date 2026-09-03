interface AudioMeterProps {
  level: number;
}

export function AudioMeter({
  level,
}: AudioMeterProps) {

  const percentage =
    Math.round(
      level * 100
    );

  return (
    <div className="w-full">

      <div className="mb-1 flex justify-between text-xs text-gray-500">

        <span>
          Audio
        </span>

        <span>
          {percentage}%
        </span>

      </div>


      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">

        <div
          className="h-full rounded-full bg-green-500 transition-all duration-75"
          style={{
            width:
              `${percentage}%`,
          }}
        />

      </div>

    </div>
  );
}
