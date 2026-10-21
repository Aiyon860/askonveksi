import { cn } from "@/lib/utils";

/**
 * Konten sudah disanitasi di server saat dibaca dari CMS (allowlist ketat).
 * Komponen ini sengaja kecil agar bisa dipakai juga oleh halaman preview.
 */
export function RichText({
  html,
  className,
  as: Tag = "div",
}: {
  html: string;
  className?: string;
  as?: "div" | "span" | "p";
}) {
  return (
    <Tag
      className={cn("[&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_ol]:list-decimal [&_p+p]:mt-2 [&_ul]:list-disc", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
