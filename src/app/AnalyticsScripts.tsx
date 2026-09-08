import Script from "next/script";

export default function AnalyticsScripts() {
  const provider = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER;
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (provider !== "ga4" || !measurementId) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${measurementId}', { send_page_view: false });`}
      </Script>
    </>
  );
}
