import "./globals.css";

export const metadata = {
  title: "Drug Cliff Radar",
  description: "Competition-timing intelligence for generic and biosimilar opportunities."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
