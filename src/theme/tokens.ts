// Lifty design tokens — mirrors design/Tokens.dc.html
export const palette = {
  dark: {
    bg: '#0F0E0D',
    card: '#171614',
    input: '#1D1C19',
    border: '#24221F',
    borderStrong: '#322F2A',
    divider: '#1D1C19',
    faint: '#3A3630',
    dim: '#5C5750',
    muted: '#6E685E',
    secondary: '#8A8377',
    emphasisLow: '#A8A196',
    emphasis: '#C6BFB3',
    strong: '#D6D0C6',
    text: '#F4F1EA',
    accent: '#F2652F',
    accentSoft: 'rgba(242,101,47,0.12)',
    accentBorder: 'rgba(242,101,47,0.36)',
    onAccent: '#180C05',
    good: '#35B86A',
    goodSoft: 'rgba(53,184,106,0.11)',
    onGood: '#0A2413',
    danger: '#E0574B',
    tabBg: '#141311',
  },
  light: {
    bg: '#FAF8F4',
    card: '#FFFFFF',
    input: '#F1EDE6',
    border: '#E3DED4',
    borderStrong: '#CFC8BB',
    divider: '#F1EDE6',
    faint: '#CFC8BB',
    dim: '#A69D8D',
    muted: '#8A8172',
    secondary: '#6E6557',
    emphasisLow: '#4A443B',
    emphasis: '#3A352C',
    strong: '#2A2620',
    text: '#2A2620',
    accent: '#E0521C',
    accentSoft: 'rgba(224,82,28,0.10)',
    accentBorder: 'rgba(224,82,28,0.36)',
    onAccent: '#FFF6F0',
    good: '#1E9A52',
    goodSoft: 'rgba(30,154,82,0.12)',
    onGood: '#FFFFFF',
    danger: '#C93F33',
    tabBg: '#FFFFFF',
  },
};
export type ThemeColors = typeof palette.dark;

export const fonts = {
  regular: 'Barlow-Regular',
  medium: 'Barlow-Medium',
  semibold: 'Barlow-SemiBold',
  bold: 'Barlow-Bold',
  condSemibold: 'BarlowCondensed-SemiBold',
  condBold: 'BarlowCondensed-Bold',
};

export const muscleColors: Record<string, string> = {
  Chest: '#DE8A6E',
  Shoulders: '#C79A5A',
  Traps: '#A8A85F',
  Quads: '#86B472',
  Hamstrings: '#6BB68F',
  Calves: '#63B4AB',
  Lats: '#6FAECB',
  'Upper Back': '#86A4DA',
  'Lower Back': '#98A0C9',
  Biceps: '#A39BD9',
  Triceps: '#C093CB',
  Forearms: '#D68CB2',
  Core: '#DF8791',
  Glutes: '#B0997F',
  Adductors: '#9DAF6E',
  Neck: '#8A8377',
  Cardio: '#E0844B',
  Other: '#8A8377',
};

export const MUSCLE_GROUPS = Object.keys(muscleColors).filter((m) => m !== 'Other');

export const EQUIPMENT_TYPES = [
  'barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell',
  'ez bar', 'band', 'medicine ball', 'stability ball', 'other',
] as const;

export function equipmentLabel(e: string): string {
  return e.replace(/(^|\s)\w/g, (c) => c.toUpperCase());
}
