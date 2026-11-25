/**
 * Google 日历风格重叠布局：并排分列，右侧留 gutter。
 * @returns {{ data, startMin, endMin, col, colCount, leftFrac, widthFrac }[]}
 */
export function layoutCalendarEvents(
  events,
  { startMinuteOf, durationMinuteOf, defaultDurationMin = 60 } = {},
) {
  if (!events?.length) return [];
  const items = events
    .map((e) => {
      const start = startMinuteOf(e);
      const dur = durationMinuteOf ? durationMinuteOf(e) : defaultDurationMin;
      const end = start + Math.max(15, Math.min(24 * 60, dur || 60));
      return { data: e, start, end };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const colEnds = [];
  const cols = [];
  for (const it of items) {
    let col = -1;
    for (let i = 0; i < colEnds.length; i++) {
      if (colEnds[i] <= it.start) {
        col = i;
        colEnds[i] = it.end;
        break;
      }
    }
    if (col < 0) {
      col = colEnds.length;
      colEnds.push(it.end);
    }
    cols.push(col);
  }

  const colCount = new Array(items.length).fill(1);
  let clusterStart = 0;
  let clusterEnd = items[0].end;
  let clusterMaxCol = cols[0];

  function flush(from, toEx, maxCol) {
    const n = maxCol + 1;
    for (let i = from; i < toEx; i++) colCount[i] = n;
  }

  for (let i = 1; i < items.length; i++) {
    if (items[i].start < clusterEnd) {
      if (items[i].end > clusterEnd) clusterEnd = items[i].end;
      if (cols[i] > clusterMaxCol) clusterMaxCol = cols[i];
    } else {
      flush(clusterStart, i, clusterMaxCol);
      clusterStart = i;
      clusterEnd = items[i].end;
      clusterMaxCol = cols[i];
    }
  }
  flush(clusterStart, items.length, clusterMaxCol);

  return items.map((it, i) => ({
    data: it.data,
    startMin: it.start,
    endMin: it.end,
    col: cols[i],
    colCount: colCount[i],
    leftFrac: cols[i] / colCount[i],
    widthFrac: 1 / colCount[i],
  }));
}

export function calendarTimeFromY({
  day,
  localY,
  rowH,
  hourStart,
  hourEnd,
  snapMin = 15,
}) {
  const totalMin = (localY / rowH) * 60 + hourStart * 60;
  let snapped = Math.round(totalMin / snapMin) * snapMin;
  const minBound = hourStart * 60;
  const maxBound = hourEnd * 60;
  if (snapped < minBound) snapped = minBound;
  if (snapped > maxBound) snapped = maxBound;
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Math.floor(snapped / 60),
    snapped % 60,
    0,
    0,
  );
}

/** 右侧永久留白，便于点空白继续添加 */
export const CAL_EVENT_GUTTER_PX = 14;
