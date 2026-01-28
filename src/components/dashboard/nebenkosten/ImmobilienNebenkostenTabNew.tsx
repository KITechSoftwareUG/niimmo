import { BetrKVNebenkostenTab } from "./BetrKVNebenkostenTab";

interface ImmobilienNebenkostenTabNewProps {
  immobilieId: string;
}

export function ImmobilienNebenkostenTabNew({ immobilieId }: ImmobilienNebenkostenTabNewProps) {
  return <BetrKVNebenkostenTab immobilieId={immobilieId} />;
}
