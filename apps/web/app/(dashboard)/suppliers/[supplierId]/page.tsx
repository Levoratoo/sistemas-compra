import { SupplierDetailPage } from '@/features/suppliers/supplier-detail-page';
import { STATIC_EXPORT_SUPPLIER_ID } from '@/lib/static-export-placeholders';

export async function generateStaticParams() {
  return [{ supplierId: STATIC_EXPORT_SUPPLIER_ID }];
}

type SupplierDetailRouteProps = {
  params: Promise<{ supplierId: string }>;
};

export default async function SupplierDetailRoute({ params }: SupplierDetailRouteProps) {
  const { supplierId } = await params;

  return <SupplierDetailPage supplierId={supplierId} />;
}
