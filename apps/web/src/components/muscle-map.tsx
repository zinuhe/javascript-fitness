import { Muscle } from '@fitness/contracts';
import { BACK, FRONT, type BodyRegion } from './body-outline';
import { labelize } from './ui';

/** The drawing zones each muscle lights up (side delts show on both shoulder views). */
const REGIONS: Record<Muscle, string[]> = {
  [Muscle.Chest]: ['chest'],
  [Muscle.FrontDelts]: ['front-deltoids'],
  [Muscle.SideDelts]: ['front-deltoids', 'back-deltoids'],
  [Muscle.RearDelts]: ['back-deltoids'],
  [Muscle.Biceps]: ['biceps'],
  [Muscle.Triceps]: ['triceps'],
  [Muscle.Forearms]: ['forearm'],
  [Muscle.Abs]: ['abs'],
  [Muscle.Obliques]: ['obliques'],
  [Muscle.Traps]: ['trapezius'],
  [Muscle.Lats]: ['upper-back'],
  [Muscle.UpperBack]: ['upper-back'],
  [Muscle.LowerBack]: ['lower-back'],
  [Muscle.Glutes]: ['gluteal'],
  [Muscle.Quads]: ['quadriceps'],
  [Muscle.Hamstrings]: ['hamstring'],
  // The outline has one inner-thigh zone per view; both thigh muscles use it.
  [Muscle.Adductors]: ['abductors', 'adductor'],
  [Muscle.Abductors]: ['abductors', 'adductor'],
  [Muscle.Calves]: ['calves', 'left-soleus', 'right-soleus'],
};

type Level = 'primary' | 'secondary';

/** Each drawing zone's highlight; a zone worked mainly by one muscle stays bright. */
function zoneLevels(primary: Muscle[], secondary: Muscle[]): Map<string, Level> {
  const levels = new Map<string, Level>();
  for (const muscle of secondary) for (const zone of REGIONS[muscle]) levels.set(zone, 'secondary');
  for (const muscle of primary) for (const zone of REGIONS[muscle]) levels.set(zone, 'primary');
  return levels;
}

/** "Works: Glutes (main), Hamstrings, Adductors" for screen readers. */
export function musclesLabel(primary: Muscle[], secondary: Muscle[]): string {
  if (primary.length + secondary.length === 0) return 'No muscles set';
  const parts = [
    ...primary.map((m) => `${labelize(m)} (main)`),
    ...secondary.map((m) => labelize(m)),
  ];
  return `Works: ${parts.join(', ')}`;
}

function Figure({ regions, levels }: { regions: BodyRegion[]; levels: Map<string, Level> }) {
  return (
    <svg viewBox="0 0 100 200" className="muscle-figure" aria-hidden="true">
      {regions.flatMap(({ region, points }) =>
        points.map((p, i) => (
          <polygon
            key={`${region}-${i}`}
            points={p}
            data-muscle={region}
            className={`mm-${levels.get(region) ?? 'base'}`}
          />
        )),
      )}
    </svg>
  );
}

interface MuscleMapProps {
  primary: Muscle[];
  secondary: Muscle[];
  /** "small": one figure (the side with more main muscles), for lists and forms. */
  size?: 'large' | 'small';
  /** Hidden from screen readers where the text next to it already names the exercise. */
  decorative?: boolean;
}

/** A body, front and back, with the muscles an exercise works highlighted. */
export function MuscleMap({
  primary,
  secondary,
  size = 'large',
  decorative = false,
}: MuscleMapProps) {
  const levels = zoneLevels(primary, secondary);
  const label = musclesLabel(primary, secondary);
  if (size === 'small') {
    const count = (regions: BodyRegion[]) =>
      regions.filter((r) => levels.get(r.region) === 'primary').length * 2 +
      regions.filter((r) => levels.get(r.region) === 'secondary').length;
    const regions = count(BACK) > count(FRONT) ? BACK : FRONT;
    return (
      <span
        className="muscle-map small"
        {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
      >
        <Figure regions={regions} levels={levels} />
      </span>
    );
  }
  return (
    <figure className="muscle-map large" role="img" aria-label={label}>
      <Figure regions={FRONT} levels={levels} />
      <Figure regions={BACK} levels={levels} />
    </figure>
  );
}
