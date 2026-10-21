import { CmsEditor } from "@/components/cms/cms-editor";
import { settingsEditor } from "@/lib/cms/editors";
import { readSiteContent } from "@/lib/cms/store";

export const metadata = { title: "Pengaturan Website" };

export default async function CmsSettingsEditorPage() {
  const content = await readSiteContent();
  return <CmsEditor page={settingsEditor} initialContent={content} />;
}
