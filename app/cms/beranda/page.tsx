import { CmsEditor } from "@/components/cms/cms-editor";
import { homeEditor } from "@/lib/cms/editors";
import { readSiteContent } from "@/lib/cms/store";

export const metadata = { title: "Beranda" };

export default async function CmsHomeEditorPage() {
  const content = await readSiteContent();
  return <CmsEditor page={homeEditor} initialContent={content} />;
}
