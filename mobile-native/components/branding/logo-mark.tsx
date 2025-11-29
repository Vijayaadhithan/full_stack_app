import React from "react";
import Svg, { Circle, Text, Defs, Pattern, G } from "react-native-svg";

type LogoMarkProps = {
    size?: number;
    className?: string;
};

export default function LogoMark({ size = 56, className }: LogoMarkProps) {
    const dim = size;
    const radius = dim / 2;
    return (
        <Svg
            width={dim}
            height={dim}
            viewBox={`0 0 ${dim} ${dim}`}
            className={className}
            aria-label="DoorStepTN logo"
        >
            <Defs>
                <Pattern
                    id="wm"
                    patternUnits="userSpaceOnUse"
                    width="40"
                    height="40"
                    patternTransform="rotate(-30 0 0)"
                >
                    <Text
                        x="20"
                        y="24"
                        textAnchor="middle"
                        fontFamily="sans-serif"
                        fontSize="10"
                        fill="#000000"
                        fillOpacity="0.06"
                    >
                        DoorStepTN
                    </Text>
                </Pattern>
            </Defs>
            <G>
                <Circle cx={radius} cy={radius} r={radius} fill="url(#wm)" />
                <Circle
                    cx={radius}
                    cy={radius}
                    r={radius - 1}
                    fill="white"
                    fillOpacity="0.75"
                />
                <Text
                    x={radius}
                    y={radius + 6}
                    textAnchor="middle"
                    fontFamily="System"
                    fontSize={dim * 0.34}
                    fontWeight="700"
                    fill="#111827"
                    fillOpacity="0.9"
                >
                    Logo
                </Text>
            </G>
        </Svg>
    );
}
