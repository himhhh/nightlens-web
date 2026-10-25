# 黑夜地图镜 · NightLens

PS5《艾尔登法环：黑夜君临》手机地图助手，免费社区参考工具。

**网页版：https://himhhh.github.io/nightlens-web/**

版本 0.8.0，基于 Build 18 的共享网页核心。支持地图拍照识别、普通／永夜王识别、520 个布局及 DLC 大空洞、Boss 与武器／魔法／祷告图鉴、弱点推荐、水晶标记。

## 手机使用

1. 用 Safari 或其他现代浏览器打开上方链接。
2. 右上角版本号旁显示离线下载百分比；点开可查看文件数和下载详情。完成后显示小勾，确认“离线资源已就绪”后再断网使用。下载失败可点“重试下载”，已缓存内容会保留。
3. 首次在手机浏览器打开会显示添加到主屏幕步骤；建议先添加，再从主屏幕图标进入。iPhone 使用 Safari 的“分享 → 添加到主屏幕”，Android 使用安装入口或浏览器菜单。
4. 拍摄电视上的完整地图或从相册导入。照片识别在设备本地运行，不上传照片。

首次加载约 51 MB，请保持网络；浏览器是否长期保留离线缓存取决于系统存储策略。网页版在页面内直接取景和拍摄；首次需要允许相机访问。按快门后照片会直接进入识别，不再经过系统相机的照片确认页。

## 源码与部署

本仓库根目录就是可部署的完整网页源码和运行资源，无需构建。GitHub Pages 发布 main 分支根目录；`.nojekyll` 禁用 Jekyll。

本地预览可运行 `python3 -m http.server 8767`，然后访问 `http://127.0.0.1:8767/`。不能直接双击 HTML 文件使用。

此发布为适配 GitHub Pages 子路径，将 PWA 的 `id` 改为相对路径 `./`；识别核心与 Build 18 一致。

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

## 2026-10-23 更新

- 六种地形均先对齐再检查特有区域；普通地形须在四个可能变化区均得到正向证据。多候选冲突或关键区域不可见时要求补拍。
- 页面内相机取景，快门后直接识别；取消、锁屏或退出时停止摄像头。
- 手机首次打开提供添加到主屏幕指引；独立模式和原生 App 不重复提示。
- 离线进度收纳在右上角版本号旁，点开可查看详情和重试。
- 废弃物之王与布德奇冥按唯一形态处理，不提供不存在的永夜切换。

## 2026-10-25 大空洞识别修复

大空洞增加多尺度及有限平移取样，灰度分支只核对建筑形状，属性仍来自彩色图；多次取样一致才保留属性。可见空点需有底图纹理证据，地下未显示区域保持未知。空点不能单独自动确认布局。模型文件没有重新训练或修改，未发布用户照片。另补充7张特殊魔法师塔位置，撤掉未核验事件锚点。
