// Intl.Locale's week information, from which browsers without it are spared by
// CLDR's list of the regions whose week doesn't start on a Monday.
const FIRST_DAYS: [number, string][] = [
  [
    0,
    'AG AS BD BR BS BT BW BZ CA CN CO DM DO ET GT GU HK HN ID IL IN IS JM JP KE KH KR LA MH MM MO MT MX MZ NI NP PA PE PH PK PR PT PY SA SG SV TH TT TW UM US VE VI WS YE ZA ZW',
  ],
  [5, 'MV'],
  [6, 'AE AF BH DJ DZ EG IQ IR JO KW LY OM QA SD SY'],
]

type WeekInfo = { firstDay: number }

/** Older browsers have the getter that newer ones replaced with the method. */
type WithWeekInfo = Intl.Locale & { getWeekInfo?(): WeekInfo; weekInfo?: WeekInfo }

/** The day a locale's week starts on, 0 for Sunday to 6 for Saturday. */
export function weekStart(locale: string) {
  const known = new Intl.Locale(locale) as WithWeekInfo
  const info = known.getWeekInfo?.() ?? known.weekInfo
  // 1 for Monday to 7 for Sunday.
  if (info) return info.firstDay % 7
  const { region = '' } = known.maximize()
  return FIRST_DAYS.find(([, regions]) => regions.split(' ').includes(region))?.[0] ?? 1
}
