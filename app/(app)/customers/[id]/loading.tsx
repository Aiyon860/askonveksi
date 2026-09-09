import { BackLinkSkeleton, DetailLayoutSkeleton, LoadingPage, PageHeaderSkeleton } from "@/components/loading-skeletons";

export default function CustomerDetailLoading() {
  return (
    <LoadingPage label="Memuat detail customer">
      <BackLinkSkeleton />
      <PageHeaderSkeleton />
      <DetailLayoutSkeleton mainRows={5} asideCards={2} />
    </LoadingPage>
  );
}
