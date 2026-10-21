export interface SectorInfo {
  id: string;
  label: string;
  angleStart: number; // in degrees (0 = North/12 o'clock, clockwise)
  angleEnd: number;
  midAngle: number;
  side: "off" | "leg";
}

/**
 * 8 standard cricket scoring sectors dividing the 360° field into 45° sectors,
 * drawn as the television camera behind the bowler shows the game: the
 * striker at the top end of the pitch, the bowler's end below, so straight
 * hits run down the picture. 0° is 12 o'clock (behind the striker, towards
 * the keeper), clockwise. For a right-handed batter, whose off side is on
 * their right as they face the bowler, that puts:
 * - Leg side: 0° to 180° (right half: Fine Leg, Square Leg, Mid Wicket, Long On)
 * - Off side: 180° to 360° (left half: Long Off, Cover, Point, Third Man)
 * Shots are stored by sector id, so the angles only affect drawing.
 */
export const SECTORS: SectorInfo[] = [
  {
    id: "long_off",
    label: "Long off",
    angleStart: 180,
    angleEnd: 225,
    midAngle: 202.5,
    side: "off",
  },
  {
    id: "cover",
    label: "Cover",
    angleStart: 225,
    angleEnd: 270,
    midAngle: 247.5,
    side: "off",
  },
  {
    id: "point",
    label: "Point",
    angleStart: 270,
    angleEnd: 315,
    midAngle: 292.5,
    side: "off",
  },
  {
    id: "third_man",
    label: "Third man",
    angleStart: 315,
    angleEnd: 360,
    midAngle: 337.5,
    side: "off",
  },
  {
    id: "fine_leg",
    label: "Fine leg",
    angleStart: 0,
    angleEnd: 45,
    midAngle: 22.5,
    side: "leg",
  },
  {
    id: "square_leg",
    label: "Square leg",
    angleStart: 45,
    angleEnd: 90,
    midAngle: 67.5,
    side: "leg",
  },
  {
    id: "mid_wicket",
    label: "Mid-wicket",
    angleStart: 90,
    angleEnd: 135,
    midAngle: 112.5,
    side: "leg",
  },
  {
    id: "long_on",
    label: "Long on",
    angleStart: 135,
    angleEnd: 180,
    midAngle: 157.5,
    side: "leg",
  },
];

/**
 * Converts polar coordinates (angle from 12 o'clock, radius) into SVG Cartesian (x, y).
 */
export function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleInDegrees: number,
) {
  const rad = ((angleInDegrees % 360) * Math.PI) / 180;
  return {
    x: cx + r * Math.sin(rad),
    y: cy - r * Math.cos(rad),
  };
}

/**
 * Generates an SVG path for an annular donut segment between rInner and rOuter.
 */
export function describeDonutSegment(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startAngle: number,
  endAngle: number,
) {
  let span = endAngle - startAngle;
  if (span < 0) span += 360;
  if (span >= 360) span = 359.99;
  const actualEnd = startAngle + span;

  const p1 = polarToCartesian(cx, cy, rOuter, startAngle);
  const p2 = polarToCartesian(cx, cy, rOuter, actualEnd);
  const p3 = polarToCartesian(cx, cy, rInner, actualEnd);
  const p4 = polarToCartesian(cx, cy, rInner, startAngle);

  const largeArcFlag = span > 180 ? 1 : 0;

  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)} A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)} Z`;
}

/**
 * Generates an SVG path for a circular wedge from center (cx, cy) up to radius r.
 * Used for interactive turf slices inside the boundary.
 */
export function describeWedge(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  let span = endAngle - startAngle;
  if (span < 0) span += 360;
  if (span >= 360) span = 359.99;
  const actualEnd = startAngle + span;

  const p1 = polarToCartesian(cx, cy, r, startAngle);
  const p2 = polarToCartesian(cx, cy, r, actualEnd);

  const largeArcFlag = span > 180 ? 1 : 0;

  return `M ${cx} ${cy} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z`;
}

/**
 * Finds the corresponding sector given an angle in degrees from 12 o'clock (0° - 360°).
 */
export function getSectorFromAngle(angleInDegrees: number): SectorInfo {
  const norm = ((angleInDegrees % 360) + 360) % 360;
  for (const sector of SECTORS) {
    if (sector.angleStart <= sector.angleEnd) {
      if (norm >= sector.angleStart && norm < sector.angleEnd) {
        return sector;
      }
    } else {
      // Handles 360 wrap-around (e.g. 315 to 360 / 0)
      if (norm >= sector.angleStart || norm < sector.angleEnd) {
        return sector;
      }
    }
  }
  return SECTORS[0]!;
}
