import { NebenkostenAbrechnungTab } from "./NebenkostenAbrechnungTab";

interface ImmobilienNebenkostenTabNewProps {
  immobilieId: string;
}

export function ImmobilienNebenkostenTabNew({ immobilieId }: ImmobilienNebenkostenTabNewProps) {
  return <NebenkostenAbrechnungTab immobilieId={immobilieId} />;
}
