import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { headers } from "next/headers";
import { translate } from "@/i18n/dictionary";
import { detectLocaleFromAcceptLanguage } from "@/i18n/locales";

export default async function ErrorPage() {
  const headerStore = await headers();
  const locale = detectLocaleFromAcceptLanguage(headerStore.get("accept-language"));

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>{translate(locale, "app.error.title")}</CardTitle>
          <CardDescription>
            {translate(locale, "app.error.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          <p>
            {translate(locale, "app.error.body")}
          </p>
          <Button asChild>
            <Link href="/signin">{translate(locale, "app.error.returnSignIn")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}