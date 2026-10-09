import Image from "next/image";
import { ImageIcon } from "lucide-react";

import { LandingReveal, LandingStagger } from "@/components/landing-motion";
import { ComingSoonOverlay } from "@/components/coming-soon-overlay";
import type { LandingProduct } from "@/lib/products";

const PLACEHOLDER_COUNT = 9;

/**
 * Galeri foto asli per slug produk. Kunci harus sama dengan `slug` di `lib/products`.
 * Foto berdimensi landscape 3:2 (1536x1024) sehingga card memakai
 * `aspect-[3/2]` + `object-cover`: proporsional tanpa crop berlebih di semua breakpoint.
 * Slug lain yang belum punya foto tetap memakai placeholder.
 */
const PRODUCT_DETAIL_GALLERIES: Record<string, { src: string; alt: string }[]> = {
  "kemeja-pdh-pdl": [
    { src: "/assets/pdh-kemeja/APJII.webp", alt: "Kemeja PDH pesanan APJII produksi Askonveksi" },
    { src: "/assets/pdh-kemeja/ARTA%20JAYA.webp", alt: "Kemeja PDH pesanan Arta Jaya produksi Askonveksi" },
    { src: "/assets/pdh-kemeja/BANK%20JATENG.webp", alt: "Kemeja PDH pesanan Bank Jateng produksi Askonveksi" },
    { src: "/assets/pdh-kemeja/BUANA.webp", alt: "Kemeja PDH pesanan Buana produksi Askonveksi" },
    { src: "/assets/pdh-kemeja/BUMN.webp", alt: "Kemeja PDH pesanan BUMN produksi Askonveksi" },
    { src: "/assets/pdh-kemeja/GEKRAF.webp", alt: "Kemeja PDH pesanan Gekraf produksi Askonveksi" },
    { src: "/assets/pdh-kemeja/HRGA.webp", alt: "Kemeja PDH pesanan HRGA produksi Askonveksi" },
    { src: "/assets/pdh-kemeja/KOV%20(2).webp", alt: "Kemeja PDH pesanan KOV produksi Askonveksi" },
    { src: "/assets/pdh-kemeja/MES%20JATENG.webp", alt: "Kemeja PDH pesanan MES Jateng produksi Askonveksi" },
    { src: "/assets/pdh-kemeja/ORADO.webp", alt: "Kemeja PDH pesanan Orado produksi Askonveksi" },
    { src: "/assets/pdh-kemeja/PMR%20SMA%20SULA.webp", alt: "Kemeja PDH pesanan PMR SMA Sula produksi Askonveksi" },
    { src: "/assets/pdh-kemeja/PRUMNAS.webp", alt: "Kemeja PDH pesanan Prumnas produksi Askonveksi" },
    {
      src: "/assets/pdh-kemeja/PT%20AEGIST%20JAYA%20METALINDO.webp",
      alt: "Kemeja PDH pesanan PT Aegist Jaya Metalindo produksi Askonveksi",
    },
    {
      src: "/assets/pdh-kemeja/PUSKESMAS%20BANGETAYU.webp",
      alt: "Kemeja PDH pesanan Puskesmas Bangetayu produksi Askonveksi",
    },
    { src: "/assets/pdh-kemeja/SMA%20N%209%20SMG.webp", alt: "Kemeja PDH pesanan SMA N 9 Semarang produksi Askonveksi" },
  ],
  jersey: [
    { src: "/assets/jerysey-webp/AKPOL.webp", alt: "Jersey pesanan AKPOL produksi Askonveksi" },
    { src: "/assets/jerysey-webp/CORPORATE%20PADEL%20(2).webp", alt: "Jersey pesanan Corporate Padel produksi Askonveksi" },
    { src: "/assets/jerysey-webp/CORPORATE%20PADEL.webp", alt: "Jersey pesanan Corporate Padel produksi Askonveksi" },
    { src: "/assets/jerysey-webp/INDUSTRIPOLIS.webp", alt: "Jersey pesanan Industripolis produksi Askonveksi" },
    {
      src: "/assets/jerysey-webp/JERSEY%20KOPASUS%20RAJAWALI.webp",
      alt: "Jersey pesanan Kopasus Rajawali produksi Askonveksi",
    },
    {
      src: "/assets/jerysey-webp/KANWIL%20BPN%20JAWA%20TENGAH.webp",
      alt: "Jersey pesanan Kanwil BPN Jawa Tengah produksi Askonveksi",
    },
    { src: "/assets/jerysey-webp/ONSEVEN%20COFFE.webp", alt: "Jersey pesanan Onseven Coffe produksi Askonveksi" },
    { src: "/assets/jerysey-webp/PBPI%20JATENG.webp", alt: "Jersey pesanan PBPI Jateng produksi Askonveksi" },
    { src: "/assets/jerysey-webp/PIP.webp", alt: "Jersey pesanan PIP produksi Askonveksi" },
    { src: "/assets/jerysey-webp/PNM.webp", alt: "Jersey pesanan PNM produksi Askonveksi" },
    { src: "/assets/jerysey-webp/POLRES%20PEKALONGAN.webp", alt: "Jersey pesanan Polres Pekalongan produksi Askonveksi" },
    { src: "/assets/jerysey-webp/PSIS.webp", alt: "Jersey pesanan PSIS produksi Askonveksi" },
    { src: "/assets/jerysey-webp/USM.webp", alt: "Jersey pesanan USM produksi Askonveksi" },
  ],
  poloshirt: [
    { src: "/assets/polo-webp/BPKAD.webp", alt: "Poloshirt pesanan BPKAD produksi Askonveksi" },
    { src: "/assets/polo-webp/GITA%20JAYA%20WIRATAMA.webp", alt: "Poloshirt pesanan Gita Jaya Wiratama produksi Askonveksi" },
    {
      src: "/assets/polo-webp/KORPS%20GITA%20JAYA%20WIRATAMA.webp",
      alt: "Poloshirt pesanan Korps Gita Jaya Wiratama produksi Askonveksi",
    },
    {
      src: "/assets/polo-webp/KORPS%20TEROMPET%20GITA%20JAYA%20WIRATAMA.webp",
      alt: "Poloshirt pesanan Korps Terompet Gita Jaya Wiratama produksi Askonveksi",
    },
    {
      src: "/assets/polo-webp/KORPS%20TUBA%20GITA%20JAYA%20WIRATAMA.webp",
      alt: "Poloshirt pesanan Korps Tuba Gita Jaya Wiratama produksi Askonveksi",
    },
    {
      src: "/assets/polo-webp/MELLOPHONE%20GITA%20JAYA%20WIRATAMA.webp",
      alt: "Poloshirt pesanan Mellophone Gita Jaya Wiratama produksi Askonveksi",
    },
    {
      src: "/assets/polo-webp/SAGARA%20GLOBAL%20MANAGEMENT%20LENGAN%20PANJANG.webp",
      alt: "Poloshirt lengan panjang pesanan Sagara Global Management produksi Askonveksi",
    },
    {
      src: "/assets/polo-webp/SAGARA%20GLOBAL%20MANAGEMENT%20LENGAN%20PENDEK.webp",
      alt: "Poloshirt lengan pendek pesanan Sagara Global Management produksi Askonveksi",
    },
    {
      src: "/assets/polo-webp/SNARE%20DRUM%20GITA%20JAYA%20WIRATAMA.webp",
      alt: "Poloshirt pesanan Snare Drum Gita Jaya Wiratama produksi Askonveksi",
    },
    { src: "/assets/polo-webp/SPPG%20(2).webp", alt: "Poloshirt pesanan SPPG produksi Askonveksi" },
    { src: "/assets/polo-webp/SPPG%20(3).webp", alt: "Poloshirt pesanan SPPG produksi Askonveksi" },
    { src: "/assets/polo-webp/SPPG.webp", alt: "Poloshirt pesanan SPPG produksi Askonveksi" },
  ],
  "rompi-vest-apron": [
    { src: "/assets/rompi-apron/DISHUB.webp", alt: "Rompi pesanan Dishub produksi Askonveksi" },
    { src: "/assets/rompi-apron/HK%20BUCG.webp", alt: "Rompi pesanan HK BUCG produksi Askonveksi" },
    { src: "/assets/rompi-apron/LPH%20UIN%20WALISONGO.webp", alt: "Rompi pesanan LPH UIN Walisongo produksi Askonveksi" },
    { src: "/assets/rompi-apron/OIKN.webp", alt: "Rompi pesanan OIKN produksi Askonveksi" },
    { src: "/assets/rompi-apron/POLRES.webp", alt: "Rompi pesanan Polres produksi Askonveksi" },
    {
      src: "/assets/rompi-apron/SPPG%20MANGUNHARJO%2003.webp",
      alt: "Rompi pesanan SPPG Mangunharjo 03 produksi Askonveksi",
    },
    {
      src: "/assets/rompi-apron/VIRGIN%20BAKERY%20CEWEK.webp",
      alt: "Apron pesanan Virgin Bakery model cewek produksi Askonveksi",
    },
    { src: "/assets/rompi-apron/VIRGIN%20BAKERY.webp", alt: "Apron pesanan Virgin Bakery produksi Askonveksi" },
  ],
};

export function ProductDetailGrid({ product }: { product: LandingProduct }) {
  const detailImages = PRODUCT_DETAIL_GALLERIES[product.slug];

  return (
    <section aria-labelledby="product-detail-title" className="bg-white pt-10 pb-16 sm:pt-12 sm:pb-20 lg:pt-14 lg:pb-24">
      <div className="mx-auto w-[90%]">
        <LandingReveal className="mx-auto max-w-2xl text-center">
          <h1
            id="product-detail-title"
            className="text-balance text-3xl font-bold leading-tight tracking-[-0.025em] text-[#142535] sm:text-4xl"
          >
            {product.name}
          </h1>
          <p className="mt-4 text-sm leading-6 text-[#536578] sm:text-base sm:leading-7">{product.description}</p>
        </LandingReveal>

        {detailImages ? (
          <LandingStagger className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 lg:mt-12 lg:grid-cols-3 lg:gap-4">
            {detailImages.map((image) => (
              <div
                key={image.src}
                className="relative aspect-[3/2] w-full overflow-hidden bg-[#e3eaf1]"
              >
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 26vw"
                  className="object-cover"
                />
              </div>
            ))}
          </LandingStagger>
        ) : (
          <ComingSoonOverlay pageName={product.name}>
            <LandingStagger className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 lg:mt-12 lg:grid-cols-3 lg:gap-4">
              {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
                <div
                  key={`placeholder-${index + 1}`}
                  aria-hidden="true"
                  className="flex aspect-[3/2] w-full items-center justify-center overflow-hidden bg-[#e3eaf1]"
                >
                  <ImageIcon className="size-8 text-[#9db4c6] sm:size-10" strokeWidth={1.5} />
                </div>
              ))}
            </LandingStagger>
          </ComingSoonOverlay>
        )}
      </div>
    </section>
  );
}
