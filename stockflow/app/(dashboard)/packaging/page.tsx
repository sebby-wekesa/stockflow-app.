import { getPackagingQueue } from "@/app/actions/packaging";
import { PackagingQueue } from "@/components/PackagingQueue";

export const dynamic = 'force-dynamic';

export default async function PackagingPage() {
  const orders = await getPackagingQueue();

  return (
    <div>
      <div className="section-header mb-16">
        <div><div className="section-title">Packaging Team Dashboard</div><div className="section-sub">Fulfil sales orders and prepare shipments</div></div>
      </div>

      <PackagingQueue orders={orders} />
    </div>
  );
}