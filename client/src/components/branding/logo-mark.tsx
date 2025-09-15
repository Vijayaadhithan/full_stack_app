import React from "react";

type LogoMarkProps = {
  size?: number;
  className?: string;
};

// Simple circular logo with subtle internal watermark pattern and DS initials
export default function LogoMark({ size = 56, className }: LogoMarkProps) {
  const dim = size;
  const radius = dim / 2;
  return (
    <svg
      width={dim}
      height={dim}
      viewBox={`0 0 ${dim} ${dim}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="DoorStepTN logo"
    >
      <defs>
        <pattern id="wm" patternUnits="userSpaceOnUse" width="40" height="40" patternTransform="rotate(-30 0 0)">
          <text
            x="20"
            y="24"
            textAnchor="middle"
            fontFamily="sans-serif"
            fontSize="10"
            fill="#000000"
            fillOpacity="0.06"
          >
            DoorStepTN
          </text>
        </pattern>
      </defs>
      <g>
        <circle cx={radius} cy={radius} r={radius} fill="url(#wm)" />
        <circle cx={radius} cy={radius} r={radius - 1} fill="white" fillOpacity="0.75" />
        <text
          x={radius}
          y={radius + 6}
          textAnchor="middle"
          fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
          fontSize={dim * 0.34}
          fontWeight={700}
          fill="#111827"
          fillOpacity="0.9"
        >
          Logo
        </text>
      </g>
    </svg>
  );
}
