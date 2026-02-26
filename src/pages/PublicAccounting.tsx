import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import yaroLogo from "@/assets/yaro-logo-wide.png";

const MONTHS: Record<string, string> = {
  "1": "Leden", "2": "Únor", "3": "Březen", "4": "Duben",
  "5": "Květen", "6": "Červen", "7": "Červenec", "8": "Srpen",
  "9": "Září", "10": "Říjen", "11": "Listopad", "12": "Prosinec",
  "all": "Všechny měsíce",
};

const formatDateShort = (d: string | null) => {
  if (!d) return "";
  try { return format(new Date(d), "dd.MM.yy"); } catch { return ""; }
};

const formatNum = (n: number | null | undefined) => {
  if (n == null || isNaN(n)) return "";
  return Math.round(n).toLocaleString("cs-CZ");
};

export default function PublicAccounting() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-accounting", token],
    queryFn: async () => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/get-public-accounting?token=${token}`,
        { headers: { "Content-Type": "application/json" } }
      );
      if (!resp.ok) throw new Error("Přístup zamítnut");
      return resp.json();
    },
    enabled: !!token,
  });

  const rows = (data?.rows || []).slice().sort((a: any, b: any) =>
    (a.contractNumber || "").localeCompare(b.contractNumber || "", "cs", { numeric: true })
  );
  const year = data?.year || "";
  const month = data?.month || "all";

  // Totals
  const totals = rows.reduce(
    (acc: any, r: any) => ({
      sellDeposit: acc.sellDeposit + (r.sellDeposit || 0),
      buyDeposit: acc.buyDeposit + (r.buyDeposit || 0),
      profitDeposit: acc.profitDeposit + (r.profitDeposit || 0),
      sellFinal: acc.sellFinal + (r.sellFinal || 0),
      buyFinal: acc.buyFinal + (r.buyFinal || 0),
      profitFinal: acc.profitFinal + (r.profitFinal || 0),
      vatDeposit: acc.vatDeposit + (r.vatDeposit || 0),
      vatFinal: acc.vatFinal + (r.vatFinal || 0),
      vatDiff: acc.vatDiff + (r.vatDiff || 0),
    }),
    { sellDeposit: 0, buyDeposit: 0, profitDeposit: 0, sellFinal: 0, buyFinal: 0, profitFinal: 0, vatDeposit: 0, vatFinal: 0, vatDiff: 0 }
  );

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-destructive text-lg">Neplatný nebo expirovaný odkaz.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Účetnictví – Rozklad kalkulace zájezdů</h1>
            <p className="text-muted-foreground">
              {year} · {MONTHS[month] || month}
            </p>
          </div>
          <img src={yaroLogo} alt="YARO Travel" className="h-10 object-contain" />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Načítám data…</p>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Smlouva</TableHead>
                  <TableHead className="whitespace-nowrap">Klient</TableHead>
                  <TableHead className="whitespace-nowrap">Země</TableHead>
                  <TableHead className="whitespace-nowrap">Destinace</TableHead>
                  <TableHead className="whitespace-nowrap">Od</TableHead>
                  <TableHead className="whitespace-nowrap">Do</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Prodej zál.</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Nákup zál.</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Zisk zál.</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Prodej vyúčt.</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Nákup vyúčt.</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Zisk vyúčt.</TableHead>
                  <TableHead className="whitespace-nowrap text-right">DPH zál.</TableHead>
                  <TableHead className="whitespace-nowrap text-right">DPH vyúčt.</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Rozdíl</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center text-muted-foreground py-8">
                      Žádné smlouvy pro zvolené období
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {rows.map((r: any, i: number) => (
                      <TableRow
                        key={i}
                        className={
                          r.highlightRed
                            ? "bg-red-50 dark:bg-red-950/30"
                            : r.highlightBlue
                            ? "bg-blue-50 dark:bg-blue-950/30"
                            : ""
                        }
                      >
                        <TableCell className="whitespace-nowrap font-medium">{r.contractNumber}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.clientName}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.country}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.destination}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDateShort(r.from)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDateShort(r.to)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatNum(r.sellDeposit)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatNum(r.buyDeposit)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatNum(r.profitDeposit)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatNum(r.sellFinal)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatNum(r.buyFinal)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatNum(r.profitFinal)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatNum(r.vatDeposit)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatNum(r.vatFinal)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatNum(r.vatDiff)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={6} className="text-right">Celkem</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatNum(totals.sellDeposit)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatNum(totals.buyDeposit)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatNum(totals.profitDeposit)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatNum(totals.sellFinal)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatNum(totals.buyFinal)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatNum(totals.profitFinal)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatNum(totals.vatDeposit)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatNum(totals.vatFinal)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatNum(totals.vatDiff)}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
