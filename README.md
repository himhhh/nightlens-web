# 黑夜地图镜 · NightLens

PS5《艾尔登法环：黑夜君临》手机地图助手，免费社区参考工具。

**网页版：https://himhhh.github.io/nightlens-web/**

版本 0.8.0，基于 Build 17 的共享网页核心。支持地图拍照识别、普通／永夜王识别、520 个布局及 DLC 大空洞、Boss 与武器／魔法／祷告图鉴、弱点推荐、水晶标记。

## 手机使用

1. 用 Safari 或其他现代浏览器打开上方链接。
2. 首页顶部会显示离线下载百分比和已完成文件数；等到 100% 与“离线资源已就绪”后再断网使用。下载失败可点“重试下载”，已缓存内容会保留。
3. iPhone 可通过 Safari 的“分享 → 添加到主屏幕”保存入口；Android 可使用浏览器的安装选项。
4. 拍摄电视上的完整地图或从相册导入。照片识别在设备本地运行，不上传照片。

首次加载约 51 MB，请保持网络；浏览器是否长期保留离线缓存取决于系统存储策略。网页版拍照由浏览器和系统照片选择器提供，不能完全复制原生 App 的相机流程。

## 源码与部署

本仓库根目录就是可部署的完整网页源码和运行资源，无需构建。GitHub Pages 发布 main 分支根目录；`.nojekyll` 禁用 Jekyll。

本地预览可运行 `python3 -m http.server 8767`，然后访问 `http://127.0.0.1:8767/`。不能直接双击 HTML 文件使用。

此发布为适配 GitHub Pages 子路径，将 PWA 的 `id` 改为相对路径 `./`；识别核心与 Build 17 一致。

不包含原生 iOS 签名资料、私人屏摄、开发／封存验证集或独立路线概念原型。

## 来源与许可

- 自有网页代码按 GPL-3.0 发布，见 [LICENSE](LICENSE)。
- 据点模型和公开头像参考来自 [NeuraXmy/nightreign-overlay-helper](https://github.com/NeuraXmy/nightreign-overlay-helper)，保留 [AGPL-3.0 许可](assets/models/LICENSE.txt) 及 [来源记录](assets/models/provenance.json)。
- Boss 参数：[Aero / Nightreign Calculator](https://github.com/dash512/Nightreign-Calculator)。
- 地图、布局、终圈和水晶资料：thefifthmatt、Artimuz / Nightreign Seed Finder、stockholm754-source、Fuwish、xxiixi、NightreignHub / luismartinezs、Alex0Goat、SisterNun。
- 其他图鉴来源和许可见 [素材说明](assets/licenses/catalog-art-and-spells.txt)、[武器辅助项目许可](assets/licenses/NightreignArmamentHelper-MIT.txt) 及各数据文件中的来源链接。
- OpenCV.js 采用其上游 Apache-2.0 许可。

这是独立的玩家社区工具，与 FromSoftware、Bandai Namco 无官方关联。游戏图像、名称和原始素材的权利属于各自权利人；代码开源许可不授予游戏原始素材的使用权。免费及公开来源不代表取得额外授权。

识别结果和社区数据可能存在误差。地图编号用于已收录布局，不保证预测所有随机内容或未来游戏版本。
