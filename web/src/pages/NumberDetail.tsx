import {X} from "lucide-react";
import {FormEvent, useEffect, useState} from "react";
import {api, useRiskConfig} from "../lib/data";

interface NumberDetailProps {
  drawId: string;
  number: string;
  close: () => void;
}

export function NumberDetail({drawId, number, close}: NumberDetailProps) {
  const config = useRiskConfig(drawId, number);
  const [riskLimit, setRiskLimit] = useState("100000");
  const [warning, setWarning] = useState("60");
  const [orange, setOrange] = useState("85");
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!config.data) return;
    setRiskLimit(String(config.data.riskLimit));
    setWarning(String(config.data.warningThresholdPercent));
    setOrange(String(config.data.orangeThresholdPercent));
    setBlocked(config.data.manuallyBlocked);
  }, [config.data]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    await api.setRiskConfig({
      drawId,
      number,
      riskLimit: Number(riskLimit),
      warningThresholdPercent: Number(warning),
      orangeThresholdPercent: Number(orange),
      blockThresholdPercent: 100,
      manuallyBlocked: blocked,
    });
    setMessage("Risk settings saved.");
  }

  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">Number</span>
            <h2>{number}</h2>
          </div>
          <button className="icon-button" type="button" onClick={close} title="Close"><X size={18} /></button>
        </div>
        <label>
          Risk limit
          <input type="number" min="1" value={riskLimit} onChange={(event) => setRiskLimit(event.target.value)} />
        </label>
        <label>
          Warning percent
          <input type="number" min="1" max="99" value={warning} onChange={(event) => setWarning(event.target.value)} />
        </label>
        <label>
          Orange percent
          <input type="number" min="1" max="99" value={orange} onChange={(event) => setOrange(event.target.value)} />
        </label>
        <label className="check-row">
          <input type="checkbox" checked={blocked} onChange={(event) => setBlocked(event.target.checked)} />
          Block number
        </label>
        {message && <div className="notice">{message}</div>}
        <button className="primary">Save risk settings</button>
      </form>
    </div>
  );
}
