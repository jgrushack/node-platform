import { getRentalsAdmin } from "@/lib/actions/equipment";
import { RentalsClient } from "./rentals-client";

export default async function RentalsPage() {
  const data = await getRentalsAdmin();
  if ("error" in data) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-red-400">{data.error}</p>
      </div>
    );
  }
  return <RentalsClient data={data} />;
}
