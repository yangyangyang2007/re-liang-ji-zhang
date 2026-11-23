// Exercise library — 65 exercises across every major muscle group. Each
// entry has an owned demo GIF (bytes in ./assets/gifs, sourced from public
// exercise libraries — see DATA-PLAN.md), target muscles, equipment,
// difficulty, short original coaching cues written for this app, and a
// video/guide link collected from real search results (URLs verbatim).
// The plan generator on the server uses a name-matched catalog subset of
// this library, so names here must stay in sync with PLAN_CATALOG.

import gifChestPress from "./assets/gifs/chest-press.gif";
import gifInclineDbPress from "./assets/gifs/incline-db-press.gif";
import gifPecDeck from "./assets/gifs/pec-deck.gif";
import gifFlatDbPress from "./assets/gifs/flat-db-press.gif";
import gifBarbellBench from "./assets/gifs/barbell-bench-press.gif";
import gifInclineBarbell from "./assets/gifs/incline-barbell-press.gif";
import gifDbFly from "./assets/gifs/dumbbell-fly.gif";
import gifCableFly from "./assets/gifs/cable-crossover.gif";
import gifDips from "./assets/gifs/dips.gif";
import gifPushUp from "./assets/gifs/push-up.gif";
import gifSmithBench from "./assets/gifs/smith-bench-press.gif";
import gifDeclineDb from "./assets/gifs/decline-db-press.gif";
import gifLatPulldown from "./assets/gifs/lat-pulldown.gif";
import gifPullUp from "./assets/gifs/pull-up.gif";
import gifBarbellRow from "./assets/gifs/barbell-row.gif";
import gifDeadlift from "./assets/gifs/deadlift.gif";
import gifSeatedRow from "./assets/gifs/seated-row.gif";
import gifOneArmDbRow from "./assets/gifs/one-arm-db-row.gif";
import gifTBarRow from "./assets/gifs/t-bar-row.gif";
import gifOneArmRow from "./assets/gifs/one-arm-row.gif";
import gifStraightArm from "./assets/gifs/straight-arm-pulldown.gif";
import gifBackExt from "./assets/gifs/back-extension.gif";
import gifBarbellSquat from "./assets/gifs/barbell-squat.gif";
import gifGobletSquat from "./assets/gifs/goblet-squat.gif";
import gifBodyweightSquat from "./assets/gifs/bodyweight-squat.gif";
import gifLegPress from "./assets/gifs/leg-press.gif";
import gifRomanian from "./assets/gifs/romanian-deadlift.gif";
import gifWalkingLunge from "./assets/gifs/walking-lunge.gif";
import gifBulgarian from "./assets/gifs/bulgarian-split-squat.gif";
import gifLegExtension from "./assets/gifs/leg-extension.gif";
import gifLyingCurl from "./assets/gifs/lying-leg-curl.gif";
import gifStandingCalf from "./assets/gifs/standing-calf-raise.gif";
import gifSeatedCalf from "./assets/gifs/seated-calf-raise.gif";
import gifHipThrust from "./assets/gifs/hip-thrust.gif";
import gifGluteBridge from "./assets/gifs/glute-bridge.gif";
import gifCableKickback from "./assets/gifs/cable-kickback.gif";
import gifBarbellOhp from "./assets/gifs/barbell-ohp.gif";
import gifShoulderPress from "./assets/gifs/shoulder-press.gif";
import gifDbPress from "./assets/gifs/db-shoulder-press.gif";
import gifArnold from "./assets/gifs/arnold-press.gif";
import gifLateralRaise from "./assets/gifs/lateral-raise.gif";
import gifDbLateral from "./assets/gifs/db-lateral-raise.gif";
import gifDbFront from "./assets/gifs/db-front-raise.gif";
import gifReverseFly from "./assets/gifs/reverse-fly.gif";
import gifBentoverFly from "./assets/gifs/bentover-db-fly.gif";
import gifFacePull from "./assets/gifs/face-pull.gif";
import gifBarbellCurl from "./assets/gifs/barbell-curl.gif";
import gifDbCurl from "./assets/gifs/db-curl.gif";
import gifHammerCurl from "./assets/gifs/hammer-curl.gif";
import gifMachineCurl from "./assets/gifs/machine-curl.gif";
import gifPreacher from "./assets/gifs/preacher-curl.gif";
import gifConcentration from "./assets/gifs/concentration-curl.gif";
import gifPushdown from "./assets/gifs/pushdown.gif";
import gifCloseGrip from "./assets/gifs/close-grip-bench.gif";
import gifSkullcrusher from "./assets/gifs/skullcrusher.gif";
import gifOverheadExt from "./assets/gifs/overhead-extension.gif";
import gifBenchDip from "./assets/gifs/bench-dip.gif";
import gifCrunch from "./assets/gifs/crunch.gif";
import gifPlank from "./assets/gifs/plank.gif";
import gifHangingLegRaise from "./assets/gifs/hanging-leg-raise.gif";
import gifRussianTwist from "./assets/gifs/russian-twist.gif";
import gifDeadBug from "./assets/gifs/dead-bug.gif";
import gifAbWheel from "./assets/gifs/ab-wheel.gif";
import gifMountainClimber from "./assets/gifs/mountain-climber.gif";
import gifBicycleCrunch from "./assets/gifs/bicycle-crunch.gif";

export type Exercise = {
  name: string;
  // Display group used by the library filter: 胸/背/腿/臀/肩/二头/三头/核心.
  muscle: string;
  // Target muscles, shown in the detail sheet.
  target: string;
  equipment: string;
  level: string;
  gif: string;
  gifSource: string;
  videoUrl: string;
  videoTitle: string;
  cues: string[];
};

const COLLECTION_70P = "https://www.bilibili.com/en/video/BV17J41157tj/";
const COLLECTION_70P_TITLE = "健身房器材与动作大全 · 70P 合集（含本动作分P）";

export const EXERCISE_LIBRARY: Exercise[] = [
  // ---------------- 胸 ----------------
  { name: "杠铃平板卧推", muscle: "胸", target: "胸大肌 · 三头 · 三角肌前束", equipment: "杠铃", level: "有一定基础", gif: gifBarbellBench, gifSource: "演示动图：公开动作演示图", videoUrl: "https://www.calorietech.com/exercises/669e695ff370cc0001bf8455", videoTitle: "杠铃平板卧推动作指南（Keep 动作库）", cues: ["肩胛后缩下沉贴紧凳面，双脚踩实地面，腰留一点自然空隙", "杠铃下放到胸口中段，触胸轻停，不要弹胸借力", "沿微斜的轨迹推回，大臂与躯干约成 45–75 度", "全程手腕叠在肘正上方，别向后折腕"] },
  { name: "坐姿推胸机", muscle: "胸", target: "胸大肌", equipment: "器械", level: "新手友好", gif: gifChestPress, gifSource: "演示动图：BurnFit 动作库", videoUrl: "https://www.bilibili.com/video/BV1WA411y7n4/", videoTitle: "保姆级健身器械教程 · 坐姿推胸（B站）", cues: ["座椅调到把手与胸口中段齐平，背和臀贴紧靠垫", "推出时呼气，肘不锁死，顶端挤压胸肌1秒", "还原慢一点，别让配重片落底、别耸肩"] },
  { name: "平板哑铃卧推", muscle: "胸", target: "胸大肌 · 三头", equipment: "哑铃", level: "新手友好", gif: gifFlatDbPress, gifSource: "演示动图：JEFIT 动作库", videoUrl: "https://www.bilibili.com/video/BV1mD421J7o3/", videoTitle: "哑铃平板卧推详解（B站）", cues: ["肩胛后缩下沉，脚踩实地面", "下放到胸两侧、大臂与躯干约45–60度", "推起时两只哑铃别相撞，顶端留几厘米"] },
  { name: "上斜杠铃卧推", muscle: "胸", target: "胸大肌上部 · 三角肌前束", equipment: "杠铃", level: "有一定基础", gif: gifInclineBarbell, gifSource: "演示动图：公开动作演示图", videoUrl: "https://www.bilibili.com/video/BV15V411N7VR/", videoTitle: "上斜杠铃卧推教学（B站）", cues: ["凳角约 30–45 度，角度太高会变成练肩", "杠铃落点在锁骨下方的上胸位置", "出杆和回杆轨迹垂直地面，推起时别往脸的方向漂"] },
  { name: "上斜哑铃卧推", muscle: "胸", target: "胸大肌上部", equipment: "哑铃", level: "新手友好", gif: gifInclineDbPress, gifSource: "演示动图：Legion Athletics 动作演示", videoUrl: "https://www.bilibili.com/video/BV1aa4y1o7XA/", videoTitle: "上斜哑铃卧推详解（B站）", cues: ["凳角约30度，肩胛后缩下沉贴紧凳面", "哑铃推向垂直地面方向，不是垂直身体", "下放到哑铃下沿与上胸齐平，小臂始终垂直地面"] },
  { name: "史密斯机卧推", muscle: "胸", target: "胸大肌", equipment: "史密斯机", level: "新手友好", gif: gifSmithBench, gifSource: "演示动图：JEFIT 动作库", videoUrl: "https://fitwill.app/zh-hant/exercise/0748/smith-bench-press/", videoTitle: "史密斯机卧推：锻炼指南、视频、技巧（Fitwill）", cues: ["先空杆确认落点在胸口中段，再挂安全扣到胸上方一点", "下放时旋开保险，推起时旋回，全程握紧杆身", "轨迹被轨道固定，专注顶端挤压和慢速下放"] },
  { name: "下斜哑铃卧推", muscle: "胸", target: "胸大肌下部", equipment: "哑铃", level: "进阶", gif: gifDeclineDb, gifSource: "演示动图：JEFIT 动作库", videoUrl: "https://www.jefit.com/exercises/39/Dumbbell-Decline-Bench-Press", videoTitle: "下斜哑铃卧推演示与说明（JEFIT）", cues: ["先坐稳再躺下，起身时先把哑铃放膝盖上，别硬抱起来", "下放落点在下胸边缘，肘别开得太大", "头低脚高容易充血，组间先坐起来缓一下"] },
  { name: "俯卧撑", muscle: "胸", target: "胸大肌 · 三头 · 核心", equipment: "自重", level: "新手友好", gif: gifPushUp, gifSource: "演示动图：Giphy 演示动图", videoUrl: "https://www.bilibili.com/video/BV1tVwNe4EX7/", videoTitle: "俯卧撑正确姿势教学（B站）", cues: ["身体从头到脚成一条直线，臀别塌也别撅", "手掌在肩的正下方偏外一点，肘向后约 45 度打开", "胸离地一拳时推起，做不了先扶高处或跪姿退阶"] },
  { name: "蝴蝶机夹胸", muscle: "胸", target: "胸大肌（内侧）", equipment: "器械", level: "新手友好", gif: gifPecDeck, gifSource: "演示动图：JEFIT 动作库", videoUrl: "https://www.bilibili.com/video/BV1To4y1g7hw/", videoTitle: "蝴蝶机夹胸保姆级详解（B站）", cues: ["把手调到与胸同高，背贴靠背、挺胸", "想着用双肘向中间夹，不要用手推", "打开时控制离心，肘只开到与躯干一线，别过深拉伤肩"] },
  { name: "上斜哑铃飞鸟", muscle: "胸", target: "胸大肌上部", equipment: "哑铃", level: "有一定基础", gif: gifDbFly, gifSource: "演示动图：BurnFit 动作库", videoUrl: "https://burnfit.io/library/인클라인-덤벨-플라이/", videoTitle: "上斜哑铃飞鸟动作库（BurnFit）", cues: ["肘保持微屈的固定角度，全程别变成卧推", "像抱一个大桶一样画弧打开，落到与胸一线就停", "重量宁轻勿重，顶端合拢时挤压上胸"] },
  { name: "绳索夹胸", muscle: "胸", target: "胸大肌", equipment: "绳索", level: "新手友好", gif: gifCableFly, gifSource: "演示动图：BurnFit 动作库", videoUrl: "https://calonote.com/zh-cn/exercise-guide/cable-fly/", videoTitle: "绳索夹胸动作指南（CaloNote）", cues: ["滑轮调到与肩同高，人站在龙门架中间偏前一步", "肘微屈固定，向前下方合拢到双手在腹前相遇", "回放时让胸被拉开，但别放到肩膀被扯痛的位置"] },
  { name: "双杠臂屈伸", muscle: "胸", target: "胸大肌下部 · 三头", equipment: "双杠 / 自重", level: "进阶", gif: gifDips, gifSource: "演示动图：Giphy 演示动图", videoUrl: "https://www.bilibili.com/video/BV1ka411w7mh/", videoTitle: "双杠臂屈伸教学（B站）", cues: ["身体前倾练胸多、直立练三头多，先选前倾版", "下放到大臂与地面平行就推起，别沉肩硬压到底", "全程锁紧核心，双腿可微屈交叉在身后"] },
  // ---------------- 背 ----------------
  { name: "高位下拉", muscle: "背", target: "背阔肌 · 二头", equipment: "器械", level: "新手友好", gif: gifLatPulldown, gifSource: "演示动图：BurnFit 动作库", videoUrl: "https://www.bilibili.com/video/BV1EG411m7YZ/", videoTitle: "详细拆解：如何做一个标准的高位下拉（B站）", cues: ["先沉肩再拉，手只当钩子，用肘往下带", "拉到上胸附近，身体只微微后仰，别猛甩借力", "回放控制住，背阔始终有张力，别完全放松"] },
  { name: "引体向上", muscle: "背", target: "背阔肌 · 二头 · 核心", equipment: "单杠 / 自重", level: "进阶", gif: gifPullUp, gifSource: "演示动图：公开动作演示图", videoUrl: "https://www.bilibili.com/video/BV1vg4y1N7pj/", videoTitle: "引体向上教学（B站）", cues: ["正手握距略宽于肩，先沉肩启动，别只用手臂拽", "胸口往杠的方向送，下巴过杠或胸触杠", "下放到底手臂接近伸直，做不了先用弹力带辅助或离心慢放"] },
  { name: "杠铃划船", muscle: "背", target: "背阔肌 · 菱形肌 · 后束", equipment: "杠铃", level: "有一定基础", gif: gifBarbellRow, gifSource: "演示动图：WorkoutLabs 动作库", videoUrl: "https://www.bilibili.com/video/BV12Z421J7mW/", videoTitle: "杠铃划船教学（B站）", cues: ["俯身约 45 度，背挺直，杠铃贴着大腿往肚脐方向拉", "顶端夹紧肩胛，别靠挺腰把杠甩上来", "全程膝盖微屈、核心绷紧，腰不舒服立刻减重"] },
  { name: "杠铃硬拉", muscle: "背", target: "竖脊肌 · 臀大肌 · 腘绳肌", equipment: "杠铃", level: "进阶", gif: gifDeadlift, gifSource: "演示动图：公开动作演示图", videoUrl: "https://www.bilibili.com/video/BV1T7411k7Mb/", videoTitle: "杠铃硬拉与罗马尼亚硬拉教学（B站）", cues: ["杠贴胫骨，肩在杠的正上方，背绷平再起", "想着用脚把地面推开，杠贴腿上升，别先撅臀再拉", "锁定时臀夹紧站直，不要向后仰腰代偿"] },
  { name: "坐姿划船", muscle: "背", target: "背阔肌 · 菱形肌", equipment: "器械", level: "新手友好", gif: gifSeatedRow, gifSource: "演示动图：JEFIT 动作库", videoUrl: "https://www.bilibili.com/video/BV1UG411k7ZM/", videoTitle: "坐姿划船详解（B站）", cues: ["挺胸、背挺直，别弓背探身去够把手", "拉向肚脐上方，顶端夹紧肩胛1秒", "回放时手臂伸直但别让躯干跟着前倒太多"] },
  { name: "单臂哑铃划船", muscle: "背", target: "背阔肌（一侧）", equipment: "哑铃", level: "新手友好", gif: gifOneArmDbRow, gifSource: "演示动图：公开动作演示图", videoUrl: "https://www.bilibili.com/video/BV14441187Np/", videoTitle: "单臂哑铃划船教学（B站）", cues: ["同侧膝盖跪上凳面，另一只手撑直，背与地面平行", "哑铃往髋部方向拉，不是竖直往胸口提", "顶端停一下再慢放，两侧各做满组数"] },
  { name: "T杠划船", muscle: "背", target: "背阔肌 · 中背", equipment: "T杠", level: "有一定基础", gif: gifTBarRow, gifSource: "演示动图：BurnFit 动作库", videoUrl: "https://www.bilibili.com/en/video/BV1TteM6dELF/", videoTitle: "T杠划船教学（B站）", cues: ["胸贴垫或俯身固定，躯干全程别起伏借力", "把手拉向腹部，肘贴着身体向后走", "下放把背拉开，但手别伸到肩膀被扯圆"] },
  { name: "单臂绳索划船", muscle: "背", target: "背阔肌（一侧）", equipment: "绳索", level: "新手友好", gif: gifOneArmRow, gifSource: "演示动图：JEFIT 动作库", videoUrl: "https://fitwill.app/zh-hans/exercise/0189/single-arm-cable-rows/", videoTitle: "单臂绳索划船：锻炼指南、视频、技巧（Fitwill）", cues: ["躯干朝前固定，别靠转体把重量拉过来", "肘贴着肋骨向后拉到下肋旁，顶端停1秒", "两侧各做满计划组数，先做弱的一侧"] },
  { name: "直臂下压", muscle: "背", target: "背阔肌", equipment: "绳索", level: "新手友好", gif: gifStraightArm, gifSource: "演示动图：公开动作演示图", videoUrl: "https://www.bilibili.com/video/BV1MG4117758/", videoTitle: "绳索直臂下压的三种做法与讲解（B站）", cues: ["站远一点，微俯身，手臂近乎伸直、肘只留一点弯", "以肩为轴画弧压到大腿前侧，想着用背把把手带下来", "回放到手与肩同高就停，保持背阔张力"] },
  { name: "山羊挺身", muscle: "背", target: "竖脊肌 · 臀大肌", equipment: "罗马椅 / 自重", level: "新手友好", gif: gifBackExt, gifSource: "演示动图：JEFIT 动作库", videoUrl: "https://www.jefit.com/exercises/92/back-hyperextension", videoTitle: "山羊挺身演示与说明（JEFIT）", cues: ["垫子调到髋骨刚好能折下去的位置", "起身到身体成一条直线就停，不要向后过度反弓", "动作慢，顶端夹臀1秒；腰不舒服就缩小幅度"] },
];

EXERCISE_LIBRARY.push(
  // ---------------- 腿 ----------------
  { name: "杠铃深蹲", muscle: "腿", target: "股四头肌 · 臀大肌", equipment: "杠铃", level: "有一定基础", gif: gifBarbellSquat, gifSource: "演示动图：公开动作演示图", videoUrl: "https://www.bilibili.com/video/BV1zm4y1j7Cn/", videoTitle: "杠铃深蹲教学（B站）", cues: ["杠放在斜方肌上，站距略宽于肩，脚尖外展约 30 度", "吸气绷紧核心，髋膝同时弯，像坐一张身后的椅子", "蹲到大腿与地面平行，膝盖始终对着脚尖方向，别内扣", "全脚掌蹬地站起，重心压在足弓，别只用脚尖"] },
  { name: "自重深蹲", muscle: "腿", target: "股四头肌 · 臀大肌", equipment: "自重", level: "新手友好", gif: gifBodyweightSquat, gifSource: "演示动图：公开动作演示图", videoUrl: "https://www.bilibili.com/video/BV1FB4y137gi/", videoTitle: "普通人如何学会一个标准的深蹲（B站）", cues: ["双脚与肩同宽，手臂前伸保持平衡", "先推髋向后坐，再屈膝下蹲，背保持挺直", "蹲到自己能稳住的最低点，脚跟不离地", "站起时膝盖向外推，别往里夹"] },
  { name: "高脚杯深蹲", muscle: "腿", target: "股四头肌 · 臀大肌", equipment: "哑铃", level: "新手友好", gif: gifGobletSquat, gifSource: "演示动图：公开动作演示图", videoUrl: "https://www.bilibili.com/video/BV1TT4y1p7YR/", videoTitle: "高脚杯深蹲详解（B站）", cues: ["双手托住哑铃一端贴在胸口，肘朝下", "下蹲时让肘落到两膝内侧，躯干比杠铃深蹲更直立", "脚跟踩稳，蹬地站起，顶端夹臀"] },
  { name: "腿举机", muscle: "腿", target: "股四头肌 · 臀大肌", equipment: "器械", level: "新手友好", gif: gifLegPress, gifSource: "演示动图：公开动作演示图", videoUrl: "https://www.bilibili.com/video/BV1XJ411G7u3/", videoTitle: "腿举机超详细教学（B站）", cues: ["臀和背全程贴紧靠垫，膝盖对准脚尖", "下放到大腿贴近腹部就推起，别让臀离垫卷腰", "推到膝盖接近伸直但别锁死，解锁和锁定保险时手别离把手"] },
  { name: "罗马尼亚硬拉", muscle: "腿", target: "腘绳肌 · 臀大肌", equipment: "杠铃 / 哑铃", level: "有一定基础", gif: gifRomanian, gifSource: "演示动图：公开动作演示图", videoUrl: "https://www.bilibili.com/video/BV1T7411k7Mb/", videoTitle: "杠铃硬拉与罗马尼亚硬拉教学（B站）", cues: ["膝盖只微屈并固定，动作靠推髋向后，不是蹲下去", "杠贴着腿下滑到小腿中段，背始终平直", "大腿后侧被拉紧时靠夹臀把髋送回来站直"] },
  { name: "行走箭步蹲", muscle: "腿", target: "股四头肌 · 臀大肌", equipment: "哑铃 / 自重", level: "新手友好", gif: gifWalkingLunge, gifSource: "演示动图：Giphy 演示动图", videoUrl: "https://www.bilibili.com/video/av393720440/", videoTitle: "练腿精讲｜箭步蹲正确示范（B站）", cues: ["迈一大步，前脚全掌踩稳，后脚脚跟抬起", "直上直下地下蹲，前膝对脚尖，别向前顶穿脚尖", "前腿发力站起直接迈下一步，躯干别左右晃"] },
  { name: "保加利亚分腿蹲", muscle: "腿", target: "股四头肌 · 臀大肌（一侧）", equipment: "哑铃 / 自重", level: "有一定基础", gif: gifBulgarian, gifSource: "演示动图：Giphy 演示动图", videoUrl: "https://www.bilibili.com/video/BV1Qe4y1v79y/", videoTitle: "保加利亚深蹲的正确姿势（B站）", cues: ["后脚脚背搭在凳面上，前脚位置多试半步找平衡", "躯干微前倾，垂直下蹲，重心压在前脚中后段", "前腿主导发力，后腿只辅助平衡；两侧次数做一样"] },
  { name: "腿屈伸", muscle: "腿", target: "股四头肌", equipment: "器械", level: "新手友好", gif: gifLegExtension, gifSource: "演示动图：公开动作演示图", videoUrl: "https://www.bilibili.com/video/BV1Pj411y7fy/", videoTitle: "健身动作指南｜坐姿腿屈伸（B站）", cues: ["膝盖对准器械转轴，挡垫压在脚踝上方", "伸直时顶端挤压大腿前侧1秒，别把腿甩上去", "下放慢，别让配重片落底泄力"] },
  { name: "俯卧腿弯举", muscle: "腿", target: "腘绳肌", equipment: "器械", level: "新手友好", gif: gifLyingCurl, gifSource: "演示动图：公开动作演示图", videoUrl: COLLECTION_70P, videoTitle: COLLECTION_70P_TITLE, cues: ["俯卧贴紧凳面，挡垫在脚踝后侧，髋别翘起来", "脚跟往臀部方向卷，顶端停1秒", "下放到腿接近伸直，控制别砸回去"] },
  { name: "站姿提踵", muscle: "腿", target: "腓肠肌（小腿）", equipment: "器械 / 自重", level: "新手友好", gif: gifStandingCalf, gifSource: "演示动图：公开动作演示图", videoUrl: "https://fitwill.app/zh-hans/exercise/1373/standing-calf-raise/", videoTitle: "站姿提踵：锻炼指南、视频、技巧（Fitwill）", cues: ["前脚掌踩台阶边缘，脚跟先下沉把小腿拉满", "踮到最高停1秒，再慢放到底，全程幅度做满", "膝盖保持伸直，身体别前后晃借力"] },
  { name: "坐姿提踵", muscle: "腿", target: "比目鱼肌（小腿深层）", equipment: "器械", level: "新手友好", gif: gifSeatedCalf, gifSource: "演示动图：JEFIT 动作库", videoUrl: COLLECTION_70P, videoTitle: COLLECTION_70P_TITLE, cues: ["膝盖屈约 90 度压好垫子，前脚掌踩稳踏板", "脚跟尽量下沉再踮高，顶端停顿", "小腿深层肌耐力好，次数可以做到 15–20 次"] },
  // ---------------- 臀 ----------------
  { name: "杠铃臀推", muscle: "臀", target: "臀大肌", equipment: "杠铃", level: "有一定基础", gif: gifHipThrust, gifSource: "演示动图：公开动作演示图", videoUrl: "https://www.bilibili.com/en/video/BV17m4y1X7tT/", videoTitle: "杠铃臀推教学（B站）", cues: ["上背靠凳沿，杠放在髋折痕处，垫上海绵或毛巾", "下巴微收，骨盆后倾着往上顶，别靠挺腰", "顶到大腿与躯干成一条直线，夹臀停1–2秒再下放"] },
  { name: "臀桥", muscle: "臀", target: "臀大肌 · 腘绳肌", equipment: "自重", level: "新手友好", gif: gifGluteBridge, gifSource: "演示动图：公开动作演示图", videoUrl: "https://www.bilibili.com/video/BV1RA411f7PB/", videoTitle: "仰卧臀桥详细教程（B站）", cues: ["仰卧屈膝，脚跟靠近臀部、全掌踩地", "脚跟发力把髋顶起，顶端肩、髋、膝成一条直线", "顶端夹臀停1秒，下放别完全落回地面泄力"] },
  { name: "绳索后踢腿", muscle: "臀", target: "臀大肌", equipment: "绳索", level: "新手友好", gif: gifCableKickback, gifSource: "演示动图：公开动作演示图", videoUrl: COLLECTION_70P, videoTitle: COLLECTION_70P_TITLE, cues: ["踝带绑好，扶稳架子，躯干微前倾固定", "腿向后上方踢，膝盖角度不变，靠臀发力", "踢到大腿与躯干一线就回，别甩腰；回放控制速度"] },
  // ---------------- 肩 ----------------
  { name: "杠铃推举", muscle: "肩", target: "三角肌 · 三头", equipment: "杠铃", level: "有一定基础", gif: gifBarbellOhp, gifSource: "演示动图：BurnFit 动作库", videoUrl: "https://www.bilibili.com/video/BV1gT411Q7Cb/", videoTitle: "站姿杠铃推肩保姆级教学（B站）", cues: ["握距略宽于肩，杠从锁骨前上方沿脸前推过头顶", "推起时头微后让再回正，臀和腹全程绷紧别挺腰", "下放到锁骨再推，肘在杠的正下方"] },
  { name: "坐姿推肩机", muscle: "肩", target: "三角肌", equipment: "器械", level: "新手友好", gif: gifShoulderPress, gifSource: "演示动图：BurnFit 动作库", videoUrl: "https://www.bilibili.com/video/BV1b34y1G7rq/", videoTitle: "练肩动作精讲｜坐姿推肩（器械版）（B站）", cues: ["座椅调到把手约与肩同高，背贴靠垫", "推到手臂接近伸直别锁死，肩别往耳朵耸", "下放到肘略低于肩就停，别硬压到最低"] },
  { name: "哑铃推举", muscle: "肩", target: "三角肌（前束、中束）", equipment: "哑铃", level: "新手友好", gif: gifDbPress, gifSource: "演示动图：公开动作演示图", videoUrl: "https://www.bilibili.com/video/BV1db411K7Eb/", videoTitle: "如何正确坐姿哑铃肩推（B站）", cues: ["坐姿靠背，哑铃举到耳侧，掌心朝前", "垂直向上推到手臂接近伸直，两铃别相撞", "下放到肘与肩同高，腰别为了借力向后仰"] },
  { name: "阿诺德推举", muscle: "肩", target: "三角肌（前束、中束）", equipment: "哑铃", level: "有一定基础", gif: gifArnold, gifSource: "演示动图：Tenor 演示动图", videoUrl: "https://www.bilibili.com/video/BV11s4y1Q7R6/", videoTitle: "阿诺德推举教学（B站）", cues: ["起始掌心朝自己、哑铃在下巴前", "边推边外旋手腕，顶端掌心朝前", "下放时反向旋回，全程连贯，别在半途停顿"] },
  { name: "器械侧平举", muscle: "肩", target: "三角肌中束", equipment: "器械", level: "新手友好", gif: gifLateralRaise, gifSource: "演示动图：BurnFit 动作库", videoUrl: "https://www.bilibili.com/video/BV1Fk4y157uJ/", videoTitle: "健身房固定器械大全·肩膀篇（含器械侧平举）（B站）", cues: ["用前臂/肘去顶垫子，不是手抓着抬", "抬到与肩同高就停，别耸肩、别甩", "下放慢，配重片别落底"] },
  { name: "哑铃侧平举", muscle: "肩", target: "三角肌中束", equipment: "哑铃", level: "新手友好", gif: gifDbLateral, gifSource: "演示动图：BurnFit 动作库", videoUrl: "https://www.bilibili.com/video/BV18o4y147RH/", videoTitle: "哑铃侧平举——正确做法（全程无废话）（B站）", cues: ["微俯身、沉肩，想象把哑铃往远处送，而不是向上提", "抬到手与肩同高，肘始终略高于手", "宁可轻两公斤也别耸肩甩动，下放慢到3秒"] },
  { name: "哑铃前平举", muscle: "肩", target: "三角肌前束", equipment: "哑铃", level: "新手友好", gif: gifDbFront, gifSource: "演示动图：JEFIT 动作库", videoUrl: "https://www.jefit.com/exercises/411/dumbbell-front-incline-raise", videoTitle: "哑铃前平举演示与说明（JEFIT）", cues: ["双手交替或同时抬到与肩同高就停", "肘微屈固定，靠肩把重量带起来，别仰身借力", "下放全程控制，底部不停顿直接连下一次"] },
  { name: "蝴蝶机反向飞鸟", muscle: "肩", target: "三角肌后束", equipment: "器械", level: "新手友好", gif: gifReverseFly, gifSource: "演示动图：JEFIT 动作库", videoUrl: "https://www.bilibili.com/video/BV1V4411M7ik/", videoTitle: "蝴蝶机反向飞鸟动作解析（B站）", cues: ["反坐，胸贴垫，把手调到与肩同高", "肘微屈固定，用后束把手向两侧打开成T字", "打开到与肩一线就停，别过度往后拉"] },
  { name: "俯身哑铃飞鸟", muscle: "肩", target: "三角肌后束", equipment: "哑铃", level: "有一定基础", gif: gifBentoverFly, gifSource: "演示动图：JEFIT 动作库", videoUrl: "https://www.jefit.com/exercises/1113/dumbbell-alternating-bent-over-reverse-fly", videoTitle: "俯身哑铃飞鸟演示与说明（JEFIT）", cues: ["俯身到背接近与地面平行，背挺直别弓", "肘保持微屈的角度，用后束把哑铃向两侧打开", "打开到手与肩一线就回，重量轻一点更容易找感觉"] },
  { name: "面拉", muscle: "肩", target: "三角肌后束 · 肩袖", equipment: "绳索", level: "新手友好", gif: gifFacePull, gifSource: "演示动图：JEFIT 动作库", videoUrl: "https://www.jefit.com/exercises/874/cable-rope-face-pull", videoTitle: "绳索面拉演示与说明（JEFIT）", cues: ["滑轮调到面部高度，绳索末端分开握住", "往额头方向拉，顶端双手在耳朵两侧、大拇指朝后", "肘全程高于手，身体别前后晃"] },
);

EXERCISE_LIBRARY.push(
  // ---------------- 二头 ----------------
  { name: "杠铃弯举", muscle: "二头", target: "肱二头肌", equipment: "杠铃", level: "新手友好", gif: gifBarbellCurl, gifSource: "演示动图：Giphy 演示动图", videoUrl: "https://www.bilibili.com/video/BV1fm411Q7xT/", videoTitle: "马克·瑞比托的杠铃弯举教学（B站）", cues: ["正手握距与肩同宽，大臂贴紧身体两侧", "只弯肘把杠举向肩，身体不前后摇摆", "顶峰收缩1秒，下放到手臂接近伸直再连下一次"] },
  { name: "哑铃交替弯举", muscle: "二头", target: "肱二头肌", equipment: "哑铃", level: "新手友好", gif: gifDbCurl, gifSource: "演示动图：公开动作演示图", videoUrl: "https://www.calorietech.com/exercises/56f3b35c11fc502da240d2c8", videoTitle: "哑铃交替弯举动作指南（Keep 动作库）", cues: ["一侧弯举时把掌心旋向自己，另一侧原地等", "肘钉在肋骨旁不前移，身体别跟着扭", "放下一侧时慢慢离心到底再换边"] },
  { name: "哑铃锤式弯举", muscle: "二头", target: "肱肌 · 肱桡肌 · 二头", equipment: "哑铃", level: "新手友好", gif: gifHammerCurl, gifSource: "演示动图：StrengthLog 动作库", videoUrl: "https://www.bilibili.com/video/BV1ab411W7xW/", videoTitle: "如何锤式弯举？四大错误（B站）", cues: ["掌心全程相对，大臂贴紧身体不前后摆", "身体别前后摇借力，摇了就是重了", "下放慢一点，底部别完全放松"] },
  { name: "器械弯举", muscle: "二头", target: "肱二头肌", equipment: "器械", level: "新手友好", gif: gifMachineCurl, gifSource: "演示动图：JEFIT 动作库", videoUrl: "https://www.jefit.com/exercises/278/Machine-Bicep-Curl", videoTitle: "器械弯举演示与说明（JEFIT）", cues: ["肘稳稳压在垫子上，座椅调到腋下刚好卡住垫子", "举到顶峰收缩停1秒，别让肩跟着往前送", "下放到手臂接近伸直，留一点弯，别完全泄力"] },
  { name: "牧师凳弯举", muscle: "二头", target: "肱二头肌（下部）", equipment: "牧师凳", level: "有一定基础", gif: gifPreacher, gifSource: "演示动图：BurnFit 动作库", videoUrl: "https://burnfit.io/en/library/preacher-curl-machine", videoTitle: "牧师凳弯举动作库（BurnFit）", cues: ["腋窝卡住垫子顶端，大臂全程贴垫不抬起", "下放到手臂接近伸直就停，别完全放松让关节硬扛", "上举别用身体压，顶端收缩1秒"] },
  { name: "集中弯举", muscle: "二头", target: "肱二头肌（肌峰）", equipment: "哑铃", level: "有一定基础", gif: gifConcentration, gifSource: "演示动图：JEFIT 动作库", videoUrl: "https://www.jefit.com/exercises/1085/dumbbell-reverse-concentration-curl", videoTitle: "集中弯举演示与说明（JEFIT）", cues: ["坐姿，肘抵在大腿内侧固定住", "只弯肘往肩方向举，另一只手扶膝保持稳定", "顶端用力收紧二头，下放慢；左右各做满"] },
  // ---------------- 三头 ----------------
  { name: "龙门架绳索下压", muscle: "三头", target: "肱三头肌", equipment: "绳索", level: "新手友好", gif: gifPushdown, gifSource: "演示动图：BurnFit 动作库", videoUrl: "https://www.bilibili.com/video/BV1qZ421u7RE/", videoTitle: "30秒教你做标准的绳索下压（B站）", cues: ["大臂夹紧身体两侧，全程只有前臂动", "压到底时把绳索两端向外分开，挤压三头1秒", "回放慢，肘别跟着前后晃，身体别直上直下借力"] },
  { name: "窄距卧推", muscle: "三头", target: "肱三头肌 · 胸", equipment: "杠铃", level: "有一定基础", gif: gifCloseGrip, gifSource: "演示动图：BurnFit 动作库", videoUrl: "https://burnfit.io/en/library/Close-grip-Bench-Press/", videoTitle: "窄距卧推动作库（BurnFit）", cues: ["握距约与肩同宽或略窄，太窄会伤手腕", "杠下放到下胸，肘贴着身体两侧打开", "推起时专注三头发力，轨迹和普通卧推一样垂直"] },
  { name: "仰卧杠铃臂屈伸", muscle: "三头", target: "肱三头肌（长头）", equipment: "杠铃", level: "有一定基础", gif: gifSkullcrusher, gifSource: "演示动图：Giphy 演示动图", videoUrl: "https://www.bilibili.com/video/BV1QF411p7A1/", videoTitle: "最详细仰卧臂屈伸教学（B站）", cues: ["仰卧，大臂垂直地面并固定，只弯肘让杠落向额头上方", "落点别真的压到头，伸肘推回到大臂正上方", "优先用曲杠，手腕更舒服；重量别贪大"] },
  { name: "绳索过头臂屈伸", muscle: "三头", target: "肱三头肌（长头）", equipment: "绳索", level: "新手友好", gif: gifOverheadExt, gifSource: "演示动图：公开动作演示图", videoUrl: COLLECTION_70P, videoTitle: COLLECTION_70P_TITLE, cues: ["滑轮调到低位，背对器械站稳，一脚前后站更稳", "大臂贴耳侧固定，只伸肘把绳子推过头顶", "下放到三头被充分拉伸再发力，别让肘向外张开"] },
  { name: "凳间臂屈伸", muscle: "三头", target: "肱三头肌", equipment: "自重", level: "新手友好", gif: gifBenchDip, gifSource: "演示动图：JEFIT 动作库", videoUrl: COLLECTION_70P, videoTitle: COLLECTION_70P_TITLE, cues: ["双手撑凳沿、指尖朝前，腿伸直或屈膝退阶", "身体贴着凳子垂直下沉，肘向后弯不外张", "下放到大臂与地面平行就撑起，肩前侧不舒服就缩小幅度"] },
  // ---------------- 核心 ----------------
  { name: "垫上卷腹", muscle: "核心", target: "腹直肌", equipment: "自重", level: "新手友好", gif: gifCrunch, gifSource: "演示动图：公开动作演示图", videoUrl: "https://www.bilibili.com/video/BV1dA411a7wZ/", videoTitle: "卷腹超详细分解教程（B站）", cues: ["下背始终贴垫，只卷起肩胛，别做成仰卧起坐", "手放耳侧别抱头硬拉脖子", "卷到顶停1秒，呼气把气吐干净"] },
  { name: "平板支撑", muscle: "核心", target: "腹横肌 · 核心整体", equipment: "自重", level: "新手友好", gif: gifPlank, gifSource: "演示动图：Giphy 演示动图", videoUrl: "https://www.bilibili.com/video/BV1vW411S738/", videoTitle: "一条视频get平板支撑的正确姿势（B站）", cues: ["肘在肩正下方，前臂贴地，头、背、臀、腿成一条直线", "收紧腹和臀，别塌腰也别把臀撅高", "均匀呼吸，撑不住先休息，别硬顶到腰酸"] },
  { name: "悬垂举腿", muscle: "核心", target: "腹直肌下部", equipment: "单杠", level: "进阶", gif: gifHangingLegRaise, gifSource: "演示动图：JEFIT 动作库", videoUrl: "https://www.bilibili.com/video/BV1Uo4y1t7S6/", videoTitle: "悬垂举腿——正确做法（B站）", cues: ["身体别前后晃，晃了先改屈膝版", "用下腹把骨盆往上卷，不只是抬大腿", "下放慢，别让腿自由落体"] },
  { name: "俄罗斯转体抱片", muscle: "核心", target: "腹斜肌", equipment: "杠铃片 / 药球", level: "新手友好", gif: gifRussianTwist, gifSource: "演示动图：Stronger 动作库", videoUrl: "https://www.bilibili.com/video/BV1UA411E7a2/", videoTitle: "俄罗斯转体动作解析（B站）", cues: ["抱一片轻杠铃片，背挺直微微后仰", "用胸口带动转体，不是只甩手臂", "左右各碰一下算1次，动作别快到失控"] },
  { name: "死虫式", muscle: "核心", target: "腹横肌 · 深层核心", equipment: "自重", level: "新手友好", gif: gifDeadBug, gifSource: "演示动图：公开动作演示图", videoUrl: "https://www.bilibili.com/video/BV12kEQ6gE4c/", videoTitle: "死虫式保姆级教程（B站）", cues: ["仰卧，下背全程压紧地面，手臂朝天、髋膝各 90 度", "对侧手脚同时伸远，腰一旦离地就缩小幅度", "呼气时伸出，吸气收回，动作越慢越有效"] },
  { name: "健腹轮推出", muscle: "核心", target: "腹直肌 · 核心整体", equipment: "健腹轮", level: "进阶", gif: gifAbWheel, gifSource: "演示动图：Giphy 演示动图", videoUrl: "https://www.bilibili.com/video/BV1Q4411y7iG/", videoTitle: "教你正确使用健腹轮，并且不伤腰（B站）", cues: ["跪姿垫好膝盖，先从推一半幅度开始练", "推出时收紧腹臀、背不塌，身体别先于轮子倒下去", "拉回靠腹部发力，手臂只握住把手"] },
  { name: "登山跑", muscle: "核心", target: "腹直肌 · 髋屈肌 · 心肺", equipment: "自重", level: "新手友好", gif: gifMountainClimber, gifSource: "演示动图：Giphy 演示动图", videoUrl: "https://www.bilibili.com/video/BV1TY4y1i7sR/", videoTitle: "俯身登山跑标准动作教程（B站）", cues: ["俯撑成平板姿势，手在肩正下方", "双膝交替往胸口提，臀别上下弹跳", "先慢速保持姿势，再逐渐加速到计时目标"] },
  { name: "自行车卷腹", muscle: "核心", target: "腹斜肌 · 腹直肌", equipment: "自重", level: "新手友好", gif: gifBicycleCrunch, gifSource: "演示动图：公开动作演示图", videoUrl: "https://www.bilibili.com/video/BV16j421o7Md/", videoTitle: "仰卧自行车健身动作讲解（B站）", cues: ["仰卧，双手轻放耳后，下背压紧垫子", "转体用对侧肘碰膝，另一条腿伸直悬空", "转的是胸廓不是脖子，节奏稳，别靠甩动完成"] },
);

export const MUSCLE_FILTERS = ["全部", "胸", "背", "腿", "臀", "肩", "二头", "三头", "核心"] as const;

export function exerciseByName(name: string): Exercise | undefined {
  return EXERCISE_LIBRARY.find((e) => e.name === name);
}
