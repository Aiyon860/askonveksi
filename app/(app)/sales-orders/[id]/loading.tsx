import { BackLinkSkeleton, DetailLayoutSkeleton, LoadingPage, PageHeaderSkeleton } from "@/components/loading-skeletons";

export default function SalesOrderLoading() {
  return (
    <LoadingPage label="Memuat Sales Order">
      <BackLinkSkeleton />
      <PageHeaderSkeleton action />
      <DetailLayoutSkeleton mainRows={4} asideCards={2} />
    </LoadingPage>
  );
}
