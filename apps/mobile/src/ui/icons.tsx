import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from './theme';

export type ModuleIconName = 'ada' | 'parties' | 'trips' | 'insurance' | 'bills' | 'reports';

/**
 * The six module marks, drawn for this app rather than taken from an icon set:
 * an ink outline with one lime fill, so they read as a family next to each other.
 */
export function ModuleIcon({ name, size = 30 }: { name: ModuleIconName; size?: number }) {
  const ink = colors.ink;
  const lime = colors.accent;
  const line = { stroke: ink, strokeWidth: 1.9, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {name === 'ada' && (
        <>
          <Rect x={6.5} y={3.5} width={18} height={25} rx={3} fill={lime} {...line} />
          <Path d="M11 3.5v25" {...line} />
          <Path d="M15 10h6M15 14h6" {...line} />
          <Path d="M18.5 24.5l7.5-7.5 2.5 2.5-7.5 7.5h-2.5z" fill={colors.white} {...line} />
        </>
      )}
      {name === 'parties' && (
        <>
          <Circle cx={21.5} cy={10.5} r={4} fill={colors.white} {...line} />
          <Path d="M16 24c.4-4 2.8-7 5.5-7s5.6 3 6 7" fill={colors.white} {...line} />
          <Circle cx={12} cy={12} r={4.5} fill={lime} {...line} />
          <Path d="M3.5 27.5c0-4.7 3.8-8.5 8.5-8.5s8.5 3.8 8.5 8.5z" fill={lime} {...line} />
        </>
      )}
      {name === 'trips' && (
        <>
          <Rect x={2.5} y={7.5} width={17} height={14} rx={2} fill={lime} {...line} />
          <Path d="M19.5 11.5h5l4.5 5.5v4.5h-9.5z" fill={colors.white} {...line} />
          <Path d="M22.5 14h2l2 2.5" {...line} />
          <Circle cx={8.5} cy={23} r={3} fill={colors.white} {...line} />
          <Circle cx={23.5} cy={23} r={3} fill={colors.white} {...line} />
        </>
      )}
      {name === 'insurance' && (
        <>
          <Path d="M16 3l10.5 4v7.5c0 7-4.6 12.2-10.5 14.5C10.1 26.7 5.5 21.5 5.5 14.5V7z" fill={lime} {...line} />
          <Path d="M11.5 15.5l3.2 3.2 6.3-6.4" fill="none" {...line} />
        </>
      )}
      {name === 'bills' && (
        <>
          <Path d="M7 3.5h18v25l-3-2-3 2-3-2-3 2-3-2-3 2z" fill={lime} {...line} />
          <Path d="M11 10h10M11 14h10M11 18h6" {...line} />
        </>
      )}
      {name === 'reports' && (
        <>
          <Rect x={5.5} y={16} width={5.5} height={11.5} rx={1.6} fill={colors.white} {...line} />
          <Rect x={13.25} y={7} width={5.5} height={20.5} rx={1.6} fill={lime} {...line} />
          <Rect x={21} y={12} width={5.5} height={15.5} rx={1.6} fill={colors.white} {...line} />
          <Path d="M3.5 27.5h25" {...line} />
        </>
      )}
    </Svg>
  );
}
