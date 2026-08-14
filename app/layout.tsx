import type { Metadata } from "next"; import "./globals.css";
export const metadata: Metadata = {title:"中八团建助手",description:"记录中式八球对局、统计与团建结算"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
