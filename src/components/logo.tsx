import logoUrl from "@/assets/logo.png";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useEventSettings() {
  return useQuery({
    queryKey: ["event-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_event_settings");
      if (error) throw error;
      return (data?.[0] ?? null) as null | {
        id: number;
        event_name: string;
        event_date: string | null;
        venue: string | null;
        logo_url: string | null;
        primary_color: string;
        accent_color: string;
        registration_open: boolean;
        show_qr: boolean;
        show_registration_number: boolean;
        badge_layout: string;
        badge_font_size: number;
      };
    },
    staleTime: 60_000,
  });
}

export function Logo({ className, alt = "Financial Architecture Summit" }: { className?: string; alt?: string }) {
  const { data } = useEventSettings();
  const src = data?.logo_url || logoUrl;
  return <img src={src} alt={alt} className={className} />;
}

export { logoUrl };
