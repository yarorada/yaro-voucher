import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ClientCombobox } from "./ClientCombobox";
import { DestinationCombobox } from "./DestinationCombobox";
import { Filter, RotateCcw } from "lucide-react";

export interface AnalyticsFilterState {
  yearType: 'departure' | 'created' | 'contract_signed';
  year: number | null;
  clientId: string | null;
  destinationId: string | null;
  status: string;
}

interface AnalyticsFiltersProps {
  filters: AnalyticsFilterState;
  onFiltersChange: (filters: AnalyticsFilterState) => void;
}

export function AnalyticsFilters({ filters, onFiltersChange }: AnalyticsFiltersProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const handleReset = () => {
    onFiltersChange({
      yearType: 'departure',
      year: currentYear,
      clientId: null,
      destinationId: null,
      status: 'all',
    });
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Filtry</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="space-y-2">
          <Label>Typ data</Label>
          <Select
            value={filters.yearType}
            onValueChange={(value: any) => onFiltersChange({ ...filters, yearType: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="departure">Rok odjezdu</SelectItem>
              <SelectItem value="created">Rok vytvoření</SelectItem>
              <SelectItem value="contract_signed">Rok podpisu smlouvy</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Rok</Label>
          <Select
            value={filters.year?.toString() || "all"}
            onValueChange={(value) => onFiltersChange({ ...filters, year: value === "all" ? null : parseInt(value) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny roky</SelectItem>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Klient</Label>
          <ClientCombobox
            value={filters.clientId || ""}
            onChange={(clientId) => onFiltersChange({ ...filters, clientId: clientId || null })}
          />
        </div>

        <div className="space-y-2">
          <Label>Destinace</Label>
          <DestinationCombobox
            value={filters.destinationId || ""}
            onValueChange={(destId) => onFiltersChange({ ...filters, destinationId: destId || null })}
          />
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={filters.status}
            onValueChange={(value) => onFiltersChange({ ...filters, status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny</SelectItem>
              <SelectItem value="inquiry">Poptávka</SelectItem>
              <SelectItem value="quote">Nabídka</SelectItem>
              <SelectItem value="confirmed">Potvrzeno</SelectItem>
              <SelectItem value="completed">Dokončeno</SelectItem>
              <SelectItem value="cancelled">Zrušeno</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Resetovat filtry
        </Button>
      </div>
    </Card>
  );
}
