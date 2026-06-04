import {dateTime} from "../lib/format";
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
            {draw.gameType} · {dateTime(draw.drawTime)} · {draw.status}
          </option>
        ))}
      </select>
    </label>
  );
}
