import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';

interface LinePoint { t: number; value: number }

export function LineChart({ points, height = 150, width = 340, unitLabel = '' }: {
  points: LinePoint[]; height?: number; width?: number; unitLabel?: string;
}) {
  const c = useTheme();
  if (points.length === 0) return null;
  const padL = 38;
  const padR = 10;
  const padT = 12;
  const padB = 24;
  const w = width - padL - padR;
  const h = height - padT - padB;
  const vals = points.map((p) => p.value);
  const ts = points.map((p) => p.t);
  let vMin = Math.min(...vals);
  let vMax = Math.max(...vals);
  if (vMax === vMin) { vMax += 1; vMin = Math.max(0, vMin - 1); }
  const span = vMax - vMin;
  vMin = Math.max(0, vMin - span * 0.15);
  vMax = vMax + span * 0.1;
  const tMin = Math.min(...ts);
  const tMax = Math.max(...ts);
  const x = (t: number) => padL + (tMax === tMin ? w / 2 : ((t - tMin) / (tMax - tMin)) * w);
  const y = (v: number) => padT + h - ((v - vMin) / (vMax - vMin)) * h;

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const area = `${d} L${x(tMax).toFixed(1)} ${padT + h} L${x(tMin).toFixed(1)} ${padT + h} Z`;
  const last = points[points.length - 1];

  const gridLines = 4;
  const gridVals = Array.from({ length: gridLines }, (_, i) => vMin + ((i + 1) / gridLines) * (vMax - vMin));

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const labelIdx = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <View>
      <Svg width={width} height={height}>
        {gridVals.map((v, i) => (
          <React.Fragment key={i}>
            <Line x1={padL} y1={y(v)} x2={width - padR} y2={y(v)} stroke={c.border} strokeWidth={1} />
            <SvgText x={4} y={y(v) + 3.5} fill={c.dim} fontSize={10}>
              {v >= 100 ? Math.round(v) : Math.round(v * 10) / 10}
            </SvgText>
          </React.Fragment>
        ))}
        <Path d={area} fill={c.accent} fillOpacity={0.12} />
        <Path d={d} stroke={c.accent} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={x(last.t)} cy={y(last.value)} r={4.5} fill={c.accent} stroke={c.card} strokeWidth={2.5} />
        {labelIdx.map((i) => {
          const dte = new Date(points[i].t);
          return (
            <SvgText key={i} x={Math.min(x(points[i].t), width - 30)} y={height - 6} fill={c.dim} fontSize={10}>
              {`${months[dte.getMonth()]} ${String(dte.getFullYear()).slice(2)}`}
            </SvgText>
          );
        })}
        {unitLabel ? (
          <SvgText x={width - padR} y={padT + 2} fill={c.dim} fontSize={10} textAnchor="end">{unitLabel}</SvgText>
        ) : null}
      </Svg>
    </View>
  );
}

export function BarChart({ bars, height = 110, width = 340, highlightLast = 3 }: {
  bars: { label?: string; value: number }[]; height?: number; width?: number; highlightLast?: number;
}) {
  const c = useTheme();
  if (!bars.length) return null;
  const padB = 18;
  const h = height - padB - 8;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const gap = 6;
  const bw = (width - gap * (bars.length - 1)) / bars.length;
  return (
    <Svg width={width} height={height}>
      <Line x1={0} y1={8 + h} x2={width} y2={8 + h} stroke={c.border} strokeWidth={1} />
      {bars.map((b, i) => {
        const bh = Math.max(3, (b.value / max) * h);
        const hot = i >= bars.length - highlightLast;
        return (
          <Rect
            key={i}
            x={i * (bw + gap)}
            y={8 + h - bh}
            width={bw}
            height={bh}
            rx={Math.min(4, bw / 3)}
            fill={hot ? c.accent : c.borderStrong}
            fillOpacity={b.value === 0 ? 0.35 : hot ? 0.55 + 0.45 * ((i - (bars.length - highlightLast)) / Math.max(1, highlightLast - 1)) : 1}
          />
        );
      })}
      {bars.map((b, i) => b.label ? (
        <SvgText key={`l${i}`} x={i * (bw + gap)} y={height - 4} fill={c.dim} fontSize={9.5}>{b.label}</SvgText>
      ) : null)}
    </Svg>
  );
}
