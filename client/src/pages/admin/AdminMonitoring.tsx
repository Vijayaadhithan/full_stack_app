import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type HealthResponse = Record<string, unknown>;

type LogEntry = {
  timestamp: string;
  level: string;
  message: string;
  metadata?: Record<string, unknown>;
};

type TransactionsResponse = {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  transactions: Array<{
    id: number;
    status: string;
    paymentStatus: string | null;
    total: string;
    paymentReference: string | null;
    orderDate: string | null;
    customer: { id: number; name: string | null; email: string | null } | null;
    shop: { id: number; name: string | null; email: string | null } | null;
  }>;
};

export default function AdminMonitoring() {
  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Monitoring &amp; Logging</h1>
        <p className="text-sm text-muted-foreground">
          Track API health, inspect recent logs, and audit transaction activity from one place.
        </p>
      </header>
      <ApiStatusSection />
      <LogViewerSection />
      <TransactionViewerSection />
    </div>
  );
}

function ApiStatusSection() {
  const { data, isFetching, refetch } = useQuery<HealthResponse>({
    queryKey: ["/api/health"],
    queryFn: () => apiRequest("GET", "/api/health").then((r) => r.json()),
    refetchInterval: 15000,
  });

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">API Status</h2>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          Refresh
        </Button>
      </div>
      <div className="rounded border bg-muted/30 p-4 text-sm">
        <pre className="whitespace-pre-wrap break-words">
          {data ? JSON.stringify(data, null, 2) : "No status data yet."}
        </pre>
      </div>
    </section>
  );
}

const LOG_LEVEL_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Error", value: "error" },
  { label: "Warn", value: "warn" },
  { label: "Info", value: "info" },
  { label: "Debug", value: "debug" },
];

function LogViewerSection() {
  const [level, setLevel] = useState("all");

  const logQuery = useQuery<{ logs: LogEntry[] }>({
    queryKey: ["/api/admin/logs", { level }],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "200" });
      if (level !== "all") params.set("level", level);
      const query = params.toString();
      return apiRequest("GET", `/api/admin/logs${query ? `?${query}` : ""}`).then((r) => r.json());
    },
    refetchInterval: 15000,
  });

  const logData = logQuery.data?.logs ?? [];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Log Viewer</h2>
          <p className="text-sm text-muted-foreground">
            Automatically refreshes every 15 seconds. Use the filter to focus on a log level.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="log-level">
            Level
          </label>
          <select
            id="log-level"
            className="rounded border px-2 py-1 text-sm"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          >
            {LOG_LEVEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => logQuery.refetch()}
            disabled={logQuery.isFetching}
          >
            Refresh
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 font-medium">Timestamp</th>
              <th className="px-3 py-2 font-medium">Level</th>
              <th className="px-3 py-2 font-medium">Message</th>
              <th className="px-3 py-2 font-medium">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {logData.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-muted-foreground" colSpan={4}>
                  {logQuery.isFetching ? "Loading logs..." : "No log entries found."}
                </td>
              </tr>
            )}
            {logData.map((log, index) => (
              <tr key={`${log.timestamp}-${index}`} className="border-t">
                <td className="px-3 py-2 align-top font-mono text-xs">{log.timestamp}</td>
                <td className="px-3 py-2 align-top text-xs uppercase">{log.level}</td>
                <td className="px-3 py-2 align-top text-sm">{log.message || ""}</td>
                <td className="px-3 py-2 align-top text-xs">
                  {log.metadata ? (
                    <details>
                      <summary className="cursor-pointer text-muted-foreground">View</summary>
                      <pre className="mt-2 whitespace-pre-wrap break-words">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TransactionViewerSection() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState("");
  const [shop, setShop] = useState("");

  const params = useMemo(() => {
    const searchParams = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (status) searchParams.set("status", status);
    if (search) searchParams.set("search", search);
    if (customer) searchParams.set("customer", customer);
    if (shop) searchParams.set("shop", shop);
    return searchParams;
  }, [customer, page, pageSize, search, shop, status]);

  const queryKey = params.toString();

  const transactionsQuery = useQuery<TransactionsResponse>({
    queryKey: ["/api/admin/transactions", queryKey],
    queryFn: () =>
      apiRequest("GET", `/api/admin/transactions?${queryKey}`).then((r) => r.json()),
    placeholderData: (previousData) => previousData,
  });

  const data = transactionsQuery.data;
  const transactions = data?.transactions ?? [];
  const totalCount = data?.total ?? 0;
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min((page - 1) * pageSize + transactions.length, totalCount);

  const resetPage = () => setPage(1);

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Transactions</h2>
        <p className="text-sm text-muted-foreground">
          Search by customer or shop, filter by status, and page through recorded transactions.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Input
          placeholder="Search everywhere..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            resetPage();
          }}
        />
        <Input
          placeholder="Filter by customer"
          value={customer}
          onChange={(event) => {
            setCustomer(event.target.value);
            resetPage();
          }}
        />
        <Input
          placeholder="Filter by shop"
          value={shop}
          onChange={(event) => {
            setShop(event.target.value);
            resetPage();
          }}
        />
        <select
          className="rounded border px-2 py-2 text-sm"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            resetPage();
          }}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="processing">Processing</option>
          <option value="packed">Packed</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
          <option value="returned">Returned</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted-foreground" htmlFor="page-size">
          Rows
        </label>
        <select
          id="page-size"
          className="rounded border px-2 py-1 text-sm"
          value={pageSize}
          onChange={(event) => {
            setPageSize(Number(event.target.value));
            resetPage();
          }}
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => transactionsQuery.refetch()}
          disabled={transactionsQuery.isFetching}
        >
          Refresh
        </Button>
      </div>
      <div className="overflow-auto rounded border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 font-medium">Order ID</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Shop</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Payment</th>
              <th className="px-3 py-2 font-medium">Total</th>
              <th className="px-3 py-2 font-medium">Ordered</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-muted-foreground" colSpan={7}>
                  {transactionsQuery.isFetching ? "Loading transactions..." : "No transactions found."}
                </td>
              </tr>
            )}
            {transactions.map((transaction: TransactionsResponse["transactions"][number]) => (
              <tr key={transaction.id} className="border-t">
                <td className="px-3 py-2 align-top font-mono text-xs">{transaction.id}</td>
                <td className="px-3 py-2 align-top text-sm">
                  {transaction.customer ? (
                    <div className="space-y-1">
                      <span>{transaction.customer.name ?? "Unnamed"}</span>
                      {transaction.customer.email && (
                        <div className="text-xs text-muted-foreground">{transaction.customer.email}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 align-top text-sm">
                  {transaction.shop ? (
                    <div className="space-y-1">
                      <span>{transaction.shop.name ?? "Unassigned"}</span>
                      {transaction.shop.email && (
                        <div className="text-xs text-muted-foreground">{transaction.shop.email}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 align-top text-xs uppercase">{transaction.status}</td>
                <td className="px-3 py-2 align-top text-xs uppercase">
                  {transaction.paymentStatus ?? "unknown"}
                </td>
                <td className="px-3 py-2 align-top font-mono text-xs">₹{transaction.total}</td>
                <td className="px-3 py-2 align-top text-xs">
                  {transaction.orderDate ? new Date(transaction.orderDate).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Showing {rangeStart}–{rangeEnd} of {totalCount}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || transactionsQuery.isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <span className="text-sm">Page {page}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!data?.hasMore || transactionsQuery.isFetching}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
