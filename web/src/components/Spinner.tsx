import {Loader2} from "lucide-react";

export function Spinner({size = 18}: {size?: number}) {
  return <Loader2 className="btn-spinner" size={size} aria-hidden />;
}
