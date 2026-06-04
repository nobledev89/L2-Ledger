import {Send} from "lucide-react";
import {FormEvent, useMemo, useState} from "react";
import {DrawSelect} from "../components/DrawSelect";
import {api, useRiskConfig, useTallies} from "../lib/data";
import {money, number2, riskStatusFor} from "../lib/format";
import type {Draw} from "../lib/types";

interface AgentEntryProps {
  draws: Draw[];
  selectedDrawId: string;
  setSelectedDrawId: (id: string) => void;
}

export function AgentEntry({draws, selectedDrawId, setSelectedDrawId}: AgentEntryProps) {
  const selected = draws.find((draw) => draw.drawId === selectedDrawId);
  const [number, setNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [customerRef, setCustomerRef] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const normalized = /^\d{1,2}$/.test(number) ? number2(number) : "";
  const tallies = useTallies(selected?.drawId);
  const riskConfig = useRiskConfig(selected?.drawId, normalized);

  const projection = useMemo(() => {
    const current = tallies.data.find((item) => item.number === normalized);
    const entered = Number(amount || 0);
    const exposure = (current?.exposure ?? 0) + entered * (selected?.defaultPayoutMultiplier ?? 400);
    const config = riskConfig.data;
    return {
      exposure,
      status: riskStatusFor(
        exposure,
        config?.riskLimit ?? current?.riskLimit ?? 100000,
        config?.manuallyBlocked ?? current?.blocked ?? false,
        config?.warningThresholdPercent ?? 60,
        config?.orangeThresholdPercent ?? 85,
      ),
    };
  }, [amount, normalized, riskConfig.data, selected?.defaultPayoutMultiplier, tallies.data]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected || !normalized) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await api.submitBet({
        drawId: selected.drawId,
        number: normalized,
        amount: Number(amount),
        customerRef: customerRef.trim(),
      });
      setMessage(result.message);
      setNumber("");
      setAmount("");
      setCustomerRef("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="workspace">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Agent</span>
          <h2>Create Bet</h2>
        </div>
      </div>
      <form className="tool-panel" onSubmit={submit}>
        {draws.length > 0 ? (
          <DrawSelect draws={draws} selectedId={selectedDrawId} setSelectedId={setSelectedDrawId} />
        ) : (
          <div className="notice">No open draws are available.</div>
        )}
        <div className="form-grid">
          <label>
            Number
            <input inputMode="numeric" maxLength={2} pattern="\d{1,2}" value={number} onChange={(event) => setNumber(event.target.value)} />
          </label>
          <label>
            Amount
            <input inputMode="decimal" min="1" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label>
            Customer reference
            <input value={customerRef} onChange={(event) => setCustomerRef(event.target.value)} />
          </label>
        </div>
        {normalized && (
          <div className={`risk-strip ${projection.status}`}>
            <strong>{normalized}</strong>
            <span>Projected exposure {money(projection.exposure)}</span>
            <span>{projection.status}</span>
          </div>
        )}
        {message && <div className="notice">{message}</div>}
        <button className="primary" disabled={busy || !selected || !normalized || Number(amount) <= 0}>
          <Send size={18} />
          {busy ? "Submitting..." : "Submit bet"}
        </button>
      </form>
    </section>
  );
}
