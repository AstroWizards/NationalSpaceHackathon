import "./globals.css";

export const metadata = {
  title: "Orbital Conjunction Analysis",
  description: "Spacecraft Conjunction Assessment and Risk Prediction",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}