import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type ShopTransactionStat = {
  shopId: number;
  shopName: string | null;
  transactionCount: number;
};

export default function AdminShopAnalytics() {
  const { data, isLoading, error } = useQuery<ShopTransactionStat[]>({
    queryKey: ["/api/admin/shops/transactions"],
    queryFn: () => apiRequest("GET", "/api/admin/shops/transactions").then((res) => res.json()),
  });

  if (isLoading) {
    return <div>Loading shop analytics...</div>;
  }

  if (error) {
    return <div className="text-red-600">Failed to load shop analytics.</div>;
  }

  const stats = data ?? [];

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Shop Analytics</h1>
      {stats.length === 0 ? (
        <p>No transactions recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-left text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border-b px-4 py-2">Shop Name</th>
                <th className="border-b px-4 py-2">Number of Transactions</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((shop) => (
                <tr key={shop.shopId} className="odd:bg-white even:bg-gray-50">
                  <td className="border-b px-4 py-2">{shop.shopName ?? "Unnamed Shop"}</td>
                  <td className="border-b px-4 py-2 font-medium">
                    {shop.transactionCount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
