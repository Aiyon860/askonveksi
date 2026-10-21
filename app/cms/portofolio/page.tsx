import { CmsEditor } from "@/components/cms/cms-editor";
import { portfolioEditor } from "@/lib/cms/editors";
import { readSiteContent } from "@/lib/cms/store";

export const metadata = { title: "Portofolio" };

export default async function CmsPortfolioEditorPage() {
  const content = await readSiteContent();
  return <CmsEditor page={portfolioEditor} initialContent={content} />;
}
