import { BackLinkSkeleton, DetailLayoutSkeleton, LoadingPage, PageHeaderSkeleton } from "@/components/loading-skeletons";

export default function OpportunityDetailLoading() {
  return (
    <LoadingPage label="Memuat detail peluang">
      <BackLinkSkeleton />
      <PageHeaderSkeleton action />
      <DetailLayoutSkeleton mainRows={4} asideCards={2} />
    </LoadingPage>
  );
}
