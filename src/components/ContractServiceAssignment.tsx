import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, Save } from "lucide-react";

interface Service {
  service_type: string;
  service_name: string;
}

interface Traveler {
  id: string;
  first_name: string;
  last_name: string;
}

interface Assignment {
  service_type: string;
  service_name: string;
  client_id: string;
}

interface ContractServiceAssignmentProps {
  contractId: string;
  dealId: string;
}

export function ContractServiceAssignment({
  contractId,
  dealId,
}: ContractServiceAssignmentProps) {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [travelers, setTravelers] = useState<Traveler[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch services from deal
        const { data: servicesData, error: servicesError } = await supabase
          .from("deal_services")
          .select("service_type, service_name")
          .eq("deal_id", dealId);

        if (servicesError) throw servicesError;

        // Fetch travelers from deal
        const { data: travelersData, error: travelersError } = await supabase
          .from("deal_travelers")
          .select("client_id, clients(id, first_name, last_name)")
          .eq("deal_id", dealId);

        if (travelersError) throw travelersError;

        // Fetch existing assignments
        // @ts-ignore - Supabase types not updated after migration
        const { data: assignmentsData, error: assignmentsError } = await (supabase as any)
          .from("contract_service_travelers")
          .select("service_type, service_name, client_id")
          .eq("contract_id", contractId);

        if (assignmentsError) throw assignmentsError;

        setServices(servicesData || []);
        setTravelers(
          travelersData?.map((t: any) => t.clients).filter(Boolean) || []
        );
        // @ts-ignore - Supabase types not updated after migration
        setAssignments(assignmentsData || []);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          title: "Chyba",
          description: "Nepodařilo se načíst data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [contractId, dealId]);

  const isAssigned = (serviceType: string, serviceName: string, clientId: string) => {
    return assignments.some(
      (a) =>
        a.service_type === serviceType &&
        a.service_name === serviceName &&
        a.client_id === clientId
    );
  };

  const toggleAssignment = (
    serviceType: string,
    serviceName: string,
    clientId: string
  ) => {
    const exists = isAssigned(serviceType, serviceName, clientId);
    if (exists) {
      setAssignments(
        assignments.filter(
          (a) =>
            !(
              a.service_type === serviceType &&
              a.service_name === serviceName &&
              a.client_id === clientId
            )
        )
      );
    } else {
      setAssignments([...assignments, { service_type: serviceType, service_name: serviceName, client_id: clientId }]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all existing assignments
      // @ts-ignore - Supabase types not updated after migration
      const { error: deleteError } = await (supabase as any)
        .from("contract_service_travelers")
        .delete()
        .eq("contract_id", contractId);

      if (deleteError) throw deleteError;

      // Insert new assignments
      if (assignments.length > 0) {
        // @ts-ignore - Supabase types not updated after migration
        const { error: insertError } = await (supabase as any)
          .from("contract_service_travelers")
          .insert(
            assignments.map((a) => ({
              contract_id: contractId,
              service_type: a.service_type,
              service_name: a.service_name,
              client_id: a.client_id,
            }))
          );

        if (insertError) throw insertError;
      }

      toast({
        title: "Uloženo",
        description: "Přiřazení cestujících bylo aktualizováno",
      });
    } catch (error) {
      console.error("Error saving assignments:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se uložit přiřazení",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-body text-muted-foreground text-center">Načítání...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-heading-2 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Přiřazení cestujících ke službám
        </CardTitle>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          Uložit přiřazení
        </Button>
      </CardHeader>
      <CardContent>
        {services.length === 0 || travelers.length === 0 ? (
          <p className="text-body text-muted-foreground">
            {services.length === 0
              ? "Nejsou k dispozici žádné služby"
              : "Nejsou přidáni žádní cestující"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Služba</TableHead>
                  {travelers.map((traveler) => (
                    <TableHead key={traveler.id} className="text-center">
                      {traveler.first_name} {traveler.last_name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-body font-medium">
                      {service.service_name}
                      <span className="text-xs text-muted-foreground ml-2">
                        ({service.service_type})
                      </span>
                    </TableCell>
                    {travelers.map((traveler) => (
                      <TableCell key={traveler.id} className="text-center">
                        <Checkbox
                          checked={isAssigned(
                            service.service_type,
                            service.service_name,
                            traveler.id
                          )}
                          onCheckedChange={() =>
                            toggleAssignment(
                              service.service_type,
                              service.service_name,
                              traveler.id
                            )
                          }
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
