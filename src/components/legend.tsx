import { STATUS_COLOR, STATUS_LABEL } from "./ui";
import { STATUSES } from "@/lib/places/types";

export function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
      {STATUSES.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-3 rounded-full" style={{ background: STATUS_COLOR[s] }} />
          {STATUS_LABEL[s]}
        </li>
      ))}
    </ul>
  );
}
