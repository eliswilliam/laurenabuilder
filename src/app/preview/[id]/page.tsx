import Link from "next/link";
import { headers } from "next/headers";
import { translate } from "@/i18n/dictionary";
import { detectLocaleFromAcceptLanguage } from "@/i18n/locales";

interface PageProps {
  params: { id: string };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const headerStore = await headers();
  const locale = detectLocaleFromAcceptLanguage(headerStore.get("accept-language"));

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold">{translate(locale, "preview.disabled.title")}</h1>
      <p className="mt-3 text-muted-foreground">
        {translate(locale, "preview.disabled.desc")}
      </p>
      <div className="mt-6">
        <Link className="underline" href={`/chat/${id}`}>
          {translate(locale, "preview.disabled.back")}
        </Link>
      </div>
    </div>
  );
}
