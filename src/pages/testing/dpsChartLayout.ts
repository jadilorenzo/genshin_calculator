/** Minimum horizontal gap between adjacent run points (viewBox units). */
export const MIN_DPS_POINT_GAP = 44

const CHART_HEIGHT = 220
const AXIS_WIDTH = 56
const PAD_TOP = 16
const PAD_RIGHT = 16
const PAD_BOTTOM = 36

export function dpsChartLayout(pointCount: number, maxDps: number) {
  const innerH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM
  const plotWidth =
    pointCount <= 1
      ? MIN_DPS_POINT_GAP
      : (pointCount - 1) * MIN_DPS_POINT_GAP
  const plotSvgWidth = plotWidth + PAD_RIGHT
  const maxIndex = Math.max(1, pointCount - 1)
  const xAt = (index: number) =>
    pointCount <= 1 ? plotWidth / 2 : (index / maxIndex) * plotWidth
  const yAt = (dps: number) =>
    PAD_TOP + innerH - (dps / Math.max(1, maxDps)) * innerH

  return {
    axisWidth: AXIS_WIDTH,
    plotWidth,
    plotSvgWidth,
    height: CHART_HEIGHT,
    pad: { top: PAD_TOP, right: PAD_RIGHT, bottom: PAD_BOTTOM, left: AXIS_WIDTH },
    innerH,
    xAt,
    yAt,
  }
}
