import '../globals.css'

export const metadata = {
  title: 'Nurset',
}

export default function RootRedirectLayout({ children }) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-surface text-gray-800">
        {children}
      </body>
    </html>
  )
}
