import { Suspense } from "react";
import AcceptInviteClient from "./accept-invite-client";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function AcceptInvitePage({ searchParams }: Props) {
  const params = await searchParams;
  const token = params.token ?? "";

  return (
    <Suspense>
      <AcceptInviteClient token={token} />
    </Suspense>
  );
}
