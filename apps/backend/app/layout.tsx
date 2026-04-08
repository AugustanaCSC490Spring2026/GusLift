import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GusLift",
  description: "GusLift backend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
