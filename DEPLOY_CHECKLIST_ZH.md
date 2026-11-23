# Path V79 部署前检查清单

## 当前验证状态
- 本轮实际执行结果以 `TEST_REPORT.md` 为准；V78 ZIP 内原有的“26/26”只保留为历史记录，不再冒充本轮结果。
- 后端契约测试使用模拟大学页面和模拟 AI；浏览器测试使用真实 Chromium 内核，但活动详情、路线证据与其他 API 响应仍是模拟数据。
- 内置目录预期为 31 所大学、390 个 University × programme 路线；部署前应重新运行全部测试确认。

## Cloudflare Pages 部署前必须确认
1. 确认要部署到哪个现有 Cloudflare Pages 项目；不要直接沿用或改动旧项目名，除非已确认。
2. 在 Cloudflare Pages 项目环境变量中私下配置 `OPENAI_API_KEY`（以及可选 `OPENAI_MODEL`），或配置 Workers AI 的 `AI` binding。不要把密钥写进 HTML、公开仓库、截图或聊天。
3. 为所有会抓取来源或调用 AI 的 `/api/*` 路由设置 rate limiting / abuse controls，特别是 `/api/activity-details`、`/api/route-evidence`、`/api/syllabus` 和 `/api/university-info`；域名 allowlist 本身不等于请求频率限制。
4. 安装依赖并运行 `npm test` 与 `npm run test:browser`。
5. 先从已确认的现有项目下载并审查 Wrangler 配置，不要使用旧的 `path-v76-syllabus` 名称：

```bash
npm install
npm test
npm run test:browser
npx wrangler pages download config YOUR_CONFIRMED_PROJECT
npx wrangler pages secret put OPENAI_API_KEY --project-name YOUR_EXISTING_PAGES_PROJECT
```

6. 确认项目名、AI secret/binding、`/api/*` 限流与生产配置后，才设置 `CLOUDFLARE_PAGES_PROJECT` 和精确的 `PATH_DEPLOY_CONFIRM=deploy:<project>`，再运行受保护的 `npm run deploy`。
7. 部署后必须在真实网址验证：首页硬刷新、Onboarding、Explore、大学、专业、Syllabus 四个标签、官方信息 API、Plan、Reminders、Reset，并检查 API 失败时的降级提示。

## 48 小时活动库核对
- 当前集中缓存只覆盖 `data/activity-sources.json` 已登记的 48 条官方主办方来源，每条存为 `activity/{activityId}`。
- 每小时任务只检查缺失或已满 48 小时的记录，每轮最多 2 条；空缓存完成首轮最长约 24 小时。
- 系统不会自动发现白名单外的新比赛；包内静态日期不能作为实时结果。部署后要查看实际定时执行日志。

## 已知限制
- 当前包尚未部署；不要把本地测试结果当成线上测试。
- AI 接口测试使用模拟响应；真实 AI 服务需要用户在部署平台配置。
- 当前数据覆盖范围有限：内置审计显示 15/390 条路线匹配到已核验活动证据，375 条没有路线专属的已核验活动证据。没有匹配结果不代表不存在机会。
- 当前 `wrangler.toml` 只用于本地开发，故意不包含生产项目名和构建输出配置；`wrangler.production.example.toml` 只是模板，不能代替从现有 Cloudflare 项目下载并审查的真实配置。
