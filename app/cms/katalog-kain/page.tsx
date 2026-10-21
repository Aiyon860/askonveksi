import { CmsEditor } from "@/components/cms/cms-editor";
import { fabricEditor } from "@/lib/cms/editors";
import { readSiteContent } from "@/lib/cms/store";

export const metadata = { title: "Katalog Kain" };

export default async function CmsFabricEditorPage() {
  const content = await readSiteContent();
  return <CmsEditor page={fabricEditor} initialContent={content} />;
}
