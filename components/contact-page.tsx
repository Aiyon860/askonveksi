"use client";

import { ArrowUpRight, MapPin, Send } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildWhatsAppContactUrl } from "@/lib/contact";
import { cn } from "@/lib/utils";

const MAPS_QUERY = "Askonveksi Semarang";
const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MAPS_QUERY)}`;
const mapsEmbedHref = `https://www.google.com/maps?q=${encodeURIComponent(MAPS_QUERY)}&output=embed`;

const fieldClassName =
  "h-12 rounded-landing-control border-landing-border bg-landing-canvas px-4 text-base text-landing-text shadow-none placeholder:text-landing-muted/65 focus-visible:border-landing-accent focus-visible:ring-landing-ring/35";

export function ContactPage({ headingClassName }: { headingClassName: string }) {
  const reduceMotion = useReducedMotion();
  const [error, setError] = useState("");
  const reveal = {
    hidden: reduceMotion ? { opacity: 1 } : { opacity: 0, y: 24, filter: "blur(8px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)" },
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = {
      name: String(data.get("name") ?? "").trim(),
      origin: String(data.get("origin") ?? "").trim(),
      message: String(data.get("message") ?? "").trim(),
    };
    const invalidField = [
      { name: "name", value: values.name, minimum: 2 },
      { name: "origin", value: values.origin, minimum: 2 },
      { name: "message", value: values.message, minimum: 10 },
    ].find((field) => field.value.length < field.minimum);

    if (invalidField) {
      setError("Mohon lengkapi nama, asal organisasi atau instansi, dan kebutuhan seragam Anda.");
      const control = form.elements.namedItem(invalidField.name);
      if (control instanceof HTMLElement) control.focus();
      return;
    }

    setError("");
    window.open(buildWhatsAppContactUrl(values), "_blank", "noopener,noreferrer");
  }

  return (
    <section
      id="kontak"
      aria-labelledby="contact-title"
      className="relative scroll-mt-24 overflow-hidden px-5 pb-24 pt-16 sm:px-8 sm:pb-28 sm:pt-20 lg:pb-32"
    >
      <noscript>
        <style>{`.contact-motion{opacity:1!important;transform:none!important;filter:none!important}`}</style>
      </noscript>

      <motion.header
        initial="hidden"
        whileInView="visible"
        viewport={{ once: false, amount: 0.6 }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.09 } },
        }}
        className="mx-auto mb-12 max-w-3xl text-center sm:mb-16"
      >
        <motion.h2
          id="contact-title"
          variants={reveal}
          transition={{ duration: 0.58, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            headingClassName,
            "contact-motion text-4xl font-semibold leading-tight tracking-[-0.035em] text-landing-text sm:text-5xl lg:text-6xl",
          )}
        >
          Siap Bikin Seragam Custom?
        </motion.h2>
        <motion.p
          variants={reveal}
          transition={{ duration: 0.58, ease: [0.16, 1, 0.3, 1] }}
          className="contact-motion mx-auto mt-5 max-w-2xl text-base leading-7 text-landing-muted sm:text-lg"
        >
          Ceritakan kebutuhan Anda. Konsultasi dan desain gratis, lalu Askonveksi akan membantu memilih produk
          yang sesuai.
        </motion.p>
      </motion.header>

      <div className="mx-auto grid max-w-[1200px] items-stretch gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] lg:gap-8">
        <motion.article
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.18 }}
          variants={reveal}
          transition={{ duration: reduceMotion ? 0.2 : 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="contact-motion relative min-h-96 overflow-hidden rounded-landing-card border border-landing-border bg-landing-card shadow-[0_10px_15px_-3px_rgb(0_0_0/0.08),0_4px_6px_-4px_rgb(0_0_0/0.08)] sm:min-h-[30rem] lg:min-h-0"
        >
          <iframe
            title="Peta lokasi Askonveksi di Semarang"
            src={mapsEmbedHref}
            className="absolute inset-0 size-full border-0 grayscale-[0.15]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
          <div className="pointer-events-none absolute inset-x-4 bottom-4 sm:inset-x-6 sm:bottom-6">
            <div className="pointer-events-auto flex flex-col gap-4 rounded-landing-card bg-landing-card/95 p-5 shadow-[0_2px_8px_rgb(0_0_0/0.08)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-landing-nav bg-landing-cta text-landing-accent">
                  <MapPin className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-landing-text">Kunjungi Askonveksi</p>
                  <p className="mt-1 text-sm leading-5 text-landing-muted">Semarang, Jawa Tengah</p>
                </div>
              </div>
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-2 self-start rounded-landing-control px-3 text-sm font-semibold text-landing-text outline-none transition-colors hover:bg-landing-cta hover:text-landing-accent focus-visible:ring-3 focus-visible:ring-landing-ring/40 sm:self-center"
              >
                Lihat di Google Maps
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </motion.article>

        <motion.form
          id="form-kontak"
          onSubmit={submit}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, amount: 0.12 }}
          variants={reveal}
          transition={{ duration: reduceMotion ? 0.2 : 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="contact-motion rounded-landing-card border border-landing-border bg-landing-card p-6 shadow-[0_10px_15px_-3px_rgb(0_0_0/0.08),0_4px_6px_-4px_rgb(0_0_0/0.08)] sm:p-8"
        >
          <div className="mb-7">
            <h3 className="text-2xl font-semibold tracking-[-0.025em] text-landing-text">Konsultasi &amp; Desain Gratis</h3>
            <p className="mt-2 text-sm leading-6 text-landing-muted">
              Cukup isi singkat. Pesan akan dirapikan lalu dikirim ke WhatsApp Askonveksi.
            </p>
          </div>

          <FieldGroup className="gap-5">
            <Field className="gap-2">
              <FieldLabel htmlFor="contact-name" required className="text-sm font-semibold text-landing-text">
                Nama Anda
              </FieldLabel>
              <Input id="contact-name" name="name" required minLength={2} maxLength={80} autoComplete="name" placeholder="Contoh: Budi" className={fieldClassName} />
            </Field>

            <Field className="gap-2">
              <FieldLabel htmlFor="contact-origin" required className="text-sm font-semibold text-landing-text">
                Organisasi / Instansi
              </FieldLabel>
              <Input id="contact-origin" name="origin" required minLength={2} maxLength={120} autoComplete="organization" placeholder="Contoh: Karang Taruna, sekolah, atau perusahaan" className={fieldClassName} />
            </Field>

            <Field className="gap-2">
              <FieldLabel htmlFor="contact-message" required className="text-sm font-semibold text-landing-text">
                Kebutuhan Seragam
              </FieldLabel>
              <Textarea id="contact-message" name="message" required minLength={10} maxLength={1000} rows={6} placeholder="Tulis jenis produk, perkiraan jumlah, dan waktu yang dibutuhkan." className={cn(fieldClassName, "min-h-36 resize-y py-3")} />
            </Field>

            {error ? <p role="alert" className="text-sm leading-5 text-destructive">{error}</p> : null}

            <Button type="submit" variant="landing" size="lg" className="h-12 w-full px-5">
              Konsultasi Gratis via WhatsApp
              <Send data-icon="inline-end" className="size-4" aria-hidden="true" />
            </Button>
            <p className="text-center text-xs leading-5 text-landing-muted">
              Isian ini hanya dipakai untuk menyusun pesan WhatsApp dan tidak disimpan di situs.
            </p>
          </FieldGroup>
        </motion.form>
      </div>
    </section>
  );
}
