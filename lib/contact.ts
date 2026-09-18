import { whatsappHref } from "./crm/format.ts";

export const ASKONVEKSI_WHATSAPP = "6281912924898";

export type ContactMessage = {
  name: string;
  origin: string;
  message: string;
};

export function buildWhatsAppContactUrl(values: ContactMessage, phoneNumber = ASKONVEKSI_WHATSAPP) {
  const text = [
    "Halo Askonveksi,",
    "",
    `Saya ${values.name} dari ${values.origin}.`,
    "",
    "Saya ingin konsultasi gratis untuk kebutuhan berikut:",
    values.message,
  ].join("\n");
  const destination = whatsappHref(phoneNumber) ?? "https://wa.me/";

  return `${destination}?text=${encodeURIComponent(text)}`;
}
