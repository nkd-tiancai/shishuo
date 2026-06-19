import type { Metadata } from "next";
import "@/lib/env-guard";
import "./globals.css";

// 启动时校验关键环境变量（模块级副作用，仅执行一次）
import { assertEnv } from "@/lib/env-guard";
assertEnv();

export const metadata: Metadata = {
  title: "Socratopia Product",
  description: "多人个人版苏格拉底自学平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
