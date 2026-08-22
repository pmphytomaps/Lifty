import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface IconProps { size?: number; color: string; strokeWidth?: number }

export function BarbellIcon({ size = 23, color, strokeWidth = 1.9 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Path d="M6.5 6.5v11M3.5 9v5M17.5 6.5v11M20.5 9v5M6.5 12h11" />
    </Svg>
  );
}

export function CalendarIcon({ size = 23, color, strokeWidth = 1.9 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3.5} y={5} width={17} height={15.5} rx={2.5} />
      <Path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </Svg>
  );
}

export function ChartIcon({ size = 23, color, strokeWidth = 1.9 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Path d="M3 20h18M6.5 20v-6M11.5 20V8M16.5 20v-9" />
    </Svg>
  );
}

export function CheckIcon({ size = 21, color, strokeWidth = 3 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4.5 12.5l5 5 10-11" />
    </Svg>
  );
}

export function PlusIcon({ size = 18, color, strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function BackIcon({ size = 22, color, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}

export function ChevronDownIcon({ size = 16, color, strokeWidth = 2.4 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Path d="M6 9.5l6 6 6-6" />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 17, color, strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Path d="M9 5l7 7-7 7" />
    </Svg>
  );
}

export function SearchIcon({ size = 18, color, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Circle cx={11} cy={11} r={6.5} />
      <Path d="M16 16l4.5 4.5" />
    </Svg>
  );
}

export function TrophyIcon({ size = 18, color, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <Path d="M7 6H4.5v1.5A3.5 3.5 0 0 0 8 11M17 6h2.5v1.5A3.5 3.5 0 0 1 16 11M9.5 20h5M12 14v6" />
    </Svg>
  );
}

export function TimerIcon({ size = 18, color, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Circle cx={12} cy={13} r={7.5} />
      <Path d="M12 9.5V13l2.5 2M9.5 3h5" />
    </Svg>
  );
}

export function TrashIcon({ size = 18, color, strokeWidth = 1.9 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4.5 6.5h15M9 6.5V4.8A1.3 1.3 0 0 1 10.3 3.5h3.4A1.3 1.3 0 0 1 15 4.8v1.7M6.5 6.5l.8 12.2a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12.2M10 10.5v6M14 10.5v6" />
    </Svg>
  );
}

export function GearIcon({ size = 21, color, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={3.2} />
      <Path d="M19 12a7 7 0 0 0-.14-1.38l2.06-1.6-2-3.46-2.43 1a7 7 0 0 0-2.39-1.38L13.7 2.5h-3.4l-.4 2.68a7 7 0 0 0-2.39 1.38l-2.43-1-2 3.46 2.06 1.6a7 7 0 0 0 0 2.76l-2.06 1.6 2 3.46 2.43-1a7 7 0 0 0 2.39 1.38l.4 2.68h3.4l.4-2.68a7 7 0 0 0 2.39-1.38l2.43 1 2-3.46-2.06-1.6A7 7 0 0 0 19 12Z" />
    </Svg>
  );
}

export function FolderIcon({ size = 16, color, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round">
      <Path d="M3.5 7.5a2 2 0 0 1 2-2h3.2l2 2.4h7.8a2 2 0 0 1 2 2v8.6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
    </Svg>
  );
}

export function ExportIcon({ size = 20, color, strokeWidth = 1.9 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Path d="M12 4v10M8 10.5l4 4 4-4M4.5 19.5h15" />
    </Svg>
  );
}

export function FlameIcon({ size = 17, color, strokeWidth = 1.9 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 21c4 0 6.5-2.6 6.5-6.2 0-2.5-1.4-4.4-2.7-6C14.6 7.3 13.5 5.7 13.5 3c-3 1.6-4.3 4-4.1 6.6-1-.5-1.7-1.3-2.1-2.4-1.2 1.6-2.8 3.9-2.8 6.6C4.5 18.4 8 21 12 21Z" />
    </Svg>
  );
}

export function DotsIcon({ size = 18, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Circle cx={12} cy={5.5} r={1.7} />
      <Circle cx={12} cy={12} r={1.7} />
      <Circle cx={12} cy={18.5} r={1.7} />
    </Svg>
  );
}
