import { useState } from "react";

export function useProfileEquipmentState() {
  const [rackets, setRackets] = useState<{ name: string; string: string; tension: string }[]>([{ name: "", string: "", tension: "" }]);
  const [primaryRacketIndex, setPrimaryRacketIndex] = useState<number>(0);
  const [shoesList, setShoesList] = useState<{ name: string }[]>([{ name: "" }]);
  const [primaryShoeIndex, setPrimaryShoeIndex] = useState<number>(0);
  const [apparel, setApparel] = useState("");

  return {
    rackets, setRackets, primaryRacketIndex, setPrimaryRacketIndex,
    shoesList, setShoesList, primaryShoeIndex, setPrimaryShoeIndex, apparel, setApparel,
  };
}
