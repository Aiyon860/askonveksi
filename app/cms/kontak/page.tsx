import { CmsEditor } from "@/components/cms/cms-editor";
import { contactEditor } from "@/lib/cms/editors";
import { readSiteContent } from "@/lib/cms/store";

export const metadata = { title: "Halaman Kontak" };

export default async function CmsContactEditorPage() {
  const content = await readSiteContent();
  return <CmsEditor page={contactEditor} initialContent={content} />;
}
