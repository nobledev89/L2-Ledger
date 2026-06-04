import {dateTime, drawSlotLabel} from "../lib/format";
import type {Draw} from "../lib/types";

interface DrawSelectProps {
  draws: Draw[];
  selectedId: string;
  setSelectedId: (id: string) => void;
}

export function DrawSelect({draws, selectedId, setSelectedId}: DrawSelectProps) {
  return (
    <label className="field">
      Draw
      <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
        {draws.map((draw) => (
          <option key={draw.drawId} value={draw.drawId}>
            {draw.drawDate} · {drawSlotLabel(draw.drawSlot)} · cutoff {dateTime(draw.cutoffTime)} · {draw.status}
          </option>
        ))}
      </select>
    </label>
  );
}
