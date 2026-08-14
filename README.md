# 中八团建助手

一个移动端优先的中文中式八球团建记录应用。项目使用真实数据库与登录系统，可记录玩家、活动、逐局赛果和团建费用，并自动生成排行榜、对手战绩与结算结果。

## 功能

- 邮箱注册、登录与管理员权限
- 玩家与团建活动管理
- 中八逐局记分及黑八犯规判定
- 玩家个人历史战绩与对手交锋记录
- 日历、排行榜、MVP 与 Against 统计
- 多人付款、按参赛次数分摊及余额结算
- 历史 CSV 数据导入

## 技术栈

- Next.js App Router、React、TypeScript
- Tailwind CSS、vinext、Vite
- Supabase Auth、PostgreSQL、Row Level Security、Storage

## 本地运行

要求 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

在项目根目录创建 `.env.local`：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

`.env.local` 已被 Git 忽略，请勿把生产环境密钥提交到仓库。

## Supabase 初始化

1. 创建一个 Supabase 项目。
2. 在 SQL Editor 执行 `supabase/migrations/202608140001_initial.sql`。
3. 在 Authentication 中创建管理员账号。
4. 使用该账号的 Auth UUID，在 `public.profiles` 中设置 `role = 'admin'`。
5. 将项目 URL 和 Publishable Key 写入本地环境变量。

生产管理员 UUID、邮箱和密码不包含在本仓库中。

## 测试

```bash
npm test
```

测试涵盖正常抢八、黑八犯规、历史数据拆分、玩家统计、费用分摊和金额守恒。

## 隐私说明

本仓库只保存应用源代码。玩家姓名、比赛记录、付款记录、管理员邮箱、密码以及生产环境配置均保存在独立的 Supabase 项目或本地环境文件中，不会随代码上传。

## 许可证

当前未附加开源许可证。代码可公开查看，但默认不授予复制、修改或再发布许可。
