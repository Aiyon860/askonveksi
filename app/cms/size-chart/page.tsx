import { CmsEditor } from "@/components/cms/cms-editor";
import { sizeChartEditor } from "@/lib/cms/editors";
import { readSiteContent } from "@/lib/cms/store";

export const metadata = { title: "Size Chart" };

export default async function CmsSizeChartEditorPage() {
  const content = await readSiteContent();
  return <CmsEditor page={sizeChartEditor} initialContent={content} />;
}
