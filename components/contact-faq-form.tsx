"use client";

import { Check, MessageCircle, Plus } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { LandingReveal } from "@/components/landing-motion";
import { RichText } from "@/components/rich-text";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { waHref } from "@/lib/cms/selectors";
import type { CmsContact } from "@/lib/cms/types";
import { cn } from "@/lib/utils";

function FaqAccordion({ faq }: { faq: CmsContact["faq"] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const items = faq.items.filter((item) => item.visible);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => {
        const open = openIndex === index;
        return (
          <Collapsible
            key={`${item.question}-${index}`}
            open={open}
            onOpenChange={(next) => setOpenIndex(next ? index : null)}
            className="overflow-hidden rounded-landing-card border border-[#dde6ee] bg-white transition-colors"
          >
            <CollapsibleTrigger className="flex min-h-12 w-full items-center gap-3 p-4 text-left outline-none transition-colors hover:bg-[#f2f7fc] focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-landing-accent/40">
              <Plus aria-hidden="true" className={cn("size-5 shrink-0 text-landing-accent transition-transform duration-200", open && "rotate-45")} />
              <span className="text-sm font-semibold leading-6 text-[#142535] sm:text-base">{item.question}</span>
            </CollapsibleTrigger>
            <CollapsibleContent keepMounted className="contact-faq-panel">
              <div>
                <RichText html={item.answer} className="px-4 pb-4 pl-12 text-sm leading-6 text-[#536578]" />
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

function WhatsAppForm({ form, phone }: { form: CmsContact["form"]; phone: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneValue, setPhoneValue] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const sentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (sentTimer.current) clearTimeout(sentTimer.current);
    };
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const contactInfo = [email.trim(), phoneValue.trim()].filter(Boolean).join(" / ");
    const text = [
      "Halo Askonveksi,",
      "",
      `Saya ${name.trim()}${contactInfo ? ` (${contactInfo})` : ""}.`,
      subject.trim() ? `Kebutuhan: ${subject.trim()}` : null,
      "",
      "Pesan:",
      message.trim(),
    ]
      .filter((line) => line !== null)
      .join("\n");

    window.open(waHref(phone, text), "_blank", "noopener,noreferrer");

    setSent(true);
    if (sentTimer.current) clearTimeout(sentTimer.current);
    sentTimer.current = setTimeout(() => setSent(false), 3500);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-landing-card border border-[#dde6ee] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-name">
          {form.nameLabel} <span aria-hidden="true" className="text-destructive">*</span>
        </Label>
        <Input id="contact-name" name="name" type="text" autoComplete="name" placeholder={form.namePlaceholder} required value={name} onChange={(event) => setName(event.target.value)} className="min-h-11 rounded-landing-control" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contact-email">
            {form.emailLabel} <span aria-hidden="true" className="text-destructive">*</span>
          </Label>
          <Input id="contact-email" name="email" type="email" autoComplete="email" placeholder={form.emailPlaceholder} required value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-11 rounded-landing-control" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contact-phone">{form.phoneLabel}</Label>
          <Input id="contact-phone" name="phone" type="tel" autoComplete="tel" placeholder={form.phonePlaceholder} value={phoneValue} onChange={(event) => setPhoneValue(event.target.value)} className="min-h-11 rounded-landing-control" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-subject">{form.subjectLabel}</Label>
        <Input id="contact-subject" name="subject" type="text" placeholder={form.subjectPlaceholder} value={subject} onChange={(event) => setSubject(event.target.value)} className="min-h-11 rounded-landing-control" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contact-message">
          {form.messageLabel} <span aria-hidden="true" className="text-destructive">*</span>
        </Label>
        <Textarea id="contact-message" name="message" rows={4} placeholder={form.messagePlaceholder} required value={message} onChange={(event) => setMessage(event.target.value)} className="rounded-landing-control" />
      </div>

      <button
        type="submit"
        aria-live="polite"
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-landing-control bg-landing-accent px-5 text-sm font-semibold text-white outline-none transition-[background-color,transform] duration-200 hover:bg-landing-accent/90 focus-visible:ring-3 focus-visible:ring-landing-accent/30 active:translate-y-px"
      >
        {sent ? <Check aria-hidden="true" className="size-4" /> : <MessageCircle aria-hidden="true" className="size-4" />}
        {sent ? form.successLabel : form.submitLabel}
      </button>
      <p className="text-xs leading-5 text-[#536578]">{form.helperText}</p>
    </form>
  );
}

export function ContactFaqForm({ contact, phone }: { contact: CmsContact; phone: string }) {
  return (
    <section aria-label="Pertanyaan umum dan formulir kontak" className="bg-[#edf4fa]">
      <div className="mx-auto grid w-[90%] grid-cols-1 gap-10 py-16 sm:py-20 lg:grid-cols-2 lg:gap-12">
        <LandingReveal>
          <p className="text-sm font-semibold text-landing-accent">{contact.faq.eyebrow}</p>
          <h2 className="mt-2 text-balance text-2xl font-bold leading-tight tracking-[-0.02em] text-[#142535] sm:text-3xl">
            {contact.faq.title}
          </h2>
          <div className="mt-6">
            <FaqAccordion faq={contact.faq} />
          </div>
        </LandingReveal>

        <LandingReveal delay={0.08}>
          <p className="text-sm font-semibold text-landing-accent">{contact.form.eyebrow}</p>
          <h2 className="mt-2 text-balance text-2xl font-bold leading-tight tracking-[-0.02em] text-[#142535] sm:text-3xl">
            {contact.form.title}
          </h2>
          <div className="mt-6">
            <WhatsAppForm form={contact.form} phone={phone} />
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}
