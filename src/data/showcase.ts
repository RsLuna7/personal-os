import {
  createEmptyData,
  type AppData,
  type ISODate,
  type Lane,
  type Milestone,
  type Phase,
  type Todo,
} from './schema'

const DAY_MS = 86_400_000

/**
 * 展示用的示例：一位大四学生同时推进考研、期末、六级、毕设、找实习和考驾照。
 * 板块、阶段、节点、学期和待办都按真实的备考节奏排布，但日期全部相对 today 计算，
 * 所以不管哪天打开，“现在”都停在考研强化阶段中段、离考研现场确认还有两天。
 * 所有阶段都从周一开始，和时间线按周吸附的做法一致。
 */
export function createShowcaseData(today: ISODate): AppData {
  const todayMs = Date.parse(`${today}T00:00:00Z`)
  const weekday = (new Date(todayMs).getUTCDay() + 6) % 7 // 周一为 0
  const mondayMs = todayMs - weekday * DAY_MS
  /** 本周一往后数 weeks 周零 days 天 */
  const at = (weeks: number, days = 0): ISODate =>
    new Date(mondayMs + (weeks * 7 + days) * DAY_MS).toISOString().slice(0, 10)

  const lane = (
    key: string,
    name: string,
    color: Lane['color'],
    order: number,
    note: string,
    links: Array<[string, string]> = [],
  ): Lane => ({
    id: `showcase-lane-${key}`,
    name,
    color,
    order,
    note,
    links: links.map(([title, url], index) => ({
      id: `showcase-link-${key}-${index + 1}`,
      title,
      url,
    })),
  })

  let phaseCount = 0
  const phase = (
    laneKey: string,
    name: string,
    start: ISODate,
    end: ISODate,
    options: { tentative?: boolean; done?: boolean; note?: string } = {},
  ): Phase => ({
    id: `showcase-phase-${++phaseCount}`,
    laneId: `showcase-lane-${laneKey}`,
    name,
    start,
    end,
    tentative: options.tentative ?? false,
    done: options.done ?? false,
    note: options.note ?? '',
  })

  let milestoneCount = 0
  const milestone = (
    laneKey: string,
    name: string,
    date: ISODate,
    options: { done?: boolean; note?: string } = {},
  ): Milestone => ({
    id: `showcase-milestone-${++milestoneCount}`,
    laneId: `showcase-lane-${laneKey}`,
    name,
    date,
    done: options.done ?? false,
    note: options.note ?? '',
  })

  let todoCount = 0
  const todo = (
    title: string,
    date: ISODate | null,
    laneKey: string | null,
    done = false,
  ): Todo => {
    const n = ++todoCount
    return {
      id: `showcase-todo-${n}`,
      title,
      date,
      done,
      laneId: laneKey === null ? null : `showcase-lane-${laneKey}`,
      createdAt: `${today}T07:${String(n).padStart(2, '0')}:00.000Z`,
    }
  }

  return {
    ...createEmptyData(),
    lanes: [
      lane(
        'kaoyan',
        '考研',
        'iris',
        0,
        '目标：985 计算机专硕。初试科目：政治、英语二、数学一、408。\n节奏：基础 → 强化 → 冲刺，408 和政治各开一条并行线。\n底线：初试结束后立刻转入春招，不空等成绩。',
        [
          ['研招网（报名与成绩）', 'https://yz.chsi.com.cn/'],
          ['目标院校招生简章', 'https://yzw.chsi.com.cn/zsml/'],
        ],
      ),
      lane(
        'final',
        '期末考试',
        'teal',
        1,
        '四门课：数据结构、操作系统、编译原理、软件工程。\n考研初试在 12 月底，期末周在 1 月初，复习要和考研错开节奏：数据结构、操作系统本来就是 408 的内容，一鱼两吃。',
      ),
      lane(
        'cet6',
        '英语六级',
        'blue',
        2,
        '目标 500+。每天一篇阅读、一组听力，作文背三个模板。\n12 月 12 日考试，当天上午听力、下午阅读。',
        [['全国大学英语四六级考试', 'https://cet.neea.edu.cn/']],
      ),
      lane(
        'thesis',
        '毕业设计',
        'grass',
        3,
        '题目：基于协同过滤的图书推荐系统。\n导师每两周看一次进展，中期检查前要有可演示的原型。',
        [['项目代码仓库', 'https://github.com/']],
      ),
      lane(
        'job',
        '实习与春招',
        'amber',
        4,
        '考研之外的第二条路。先把简历和项目打磨好，春招开启时直接投。\n具体时间要等春招公告，先放成待确认。',
        [['牛客网 · 招聘日历', 'https://www.nowcoder.com/']],
      ),
      lane('driving', '驾照', 'tomato', 5, '科目二已过，科目三打算放在寒假集中练。'),
      lane('club', '读书会', 'pink', 6, '秋季共读已经收官，下学期再看要不要继续。'),
    ],

    phases: [
      // —— 考研：三个连续阶段 + 两条并行线 + 两个待确认阶段
      phase('kaoyan', '择校与考纲', at(-14), at(-10), {
        done: true,
        note: '对比 6 所院校的报录比、真题风格和复试线，最终定 3 所，主攻 1 所。',
      }),
      phase('kaoyan', '基础阶段', at(-10), at(-3), {
        done: true,
        note: '高数全书一轮、线代过一遍、英语单词刷两轮。',
      }),
      phase('kaoyan', '强化阶段', at(-3), at(3), {
        note: '每天 10 小时：上午数学、下午 408 + 英语、晚上政治和复盘。',
      }),
      phase('kaoyan', '冲刺阶段', at(3), at(7), {
        note: '只做真题和模拟卷，错题本每天过一遍；最后一周调整作息。',
      }),
      phase('kaoyan', '专业课 408', at(-3), at(3), {
        note: '数据结构 → 计算机组成 → 操作系统 → 网络，每章刷题 + 整理思维导图。',
      }),
      phase('kaoyan', '政治', at(3), at(7), {
        note: '押题卷背诵 + 选择题每日 20 道。',
      }),
      phase('kaoyan', '复试准备', at(15), at(18), {
        tentative: true,
        note: '成绩出来、过线以后才会启动。',
      }),
      phase('kaoyan', '复试与调剂', at(18), at(22), {
        tentative: true,
        note: '时间以院校通知为准。',
      }),

      // —— 期末：学习 → 复习 → 考试周
      phase('final', '课程学习', at(-9), at(5), {
        note: '课上跟进度，作业和实验按周交。',
      }),
      phase('final', '期末复习', at(5), at(8), {
        note: '考研初试后的三周全力切回期末。',
      }),
      phase('final', '考试周', at(8), at(10)),

      // —— 六级
      phase('cet6', '词汇与长难句', at(-6), at(0), {
        done: true,
        note: '六级核心词汇过三遍，长难句每天分析一句。',
      }),
      phase('cet6', '真题训练', at(0), at(4), {
        note: '每周两套全真模拟，限时做、当天对答案。',
      }),
      phase('cet6', '考前一周', at(4), at(5)),

      // —— 毕设
      phase('thesis', '选题与开题', at(-14), at(-8), { done: true }),
      phase('thesis', '原型实现', at(-8), at(8), {
        note: '数据清洗、推荐算法、前端展示三块并行推进。',
      }),
      phase('thesis', '实验与调优', at(10), at(16), {
        note: '寒假做对比实验，补充评测指标。',
      }),
      phase('thesis', '论文撰写', at(16), at(27)),
      phase('thesis', '答辩准备', at(27), at(31)),

      // —— 实习与春招
      phase('job', '简历与项目打磨', at(-1), at(2), {
        note: '把推荐系统写进简历，准备三分钟项目讲解。',
      }),
      phase('job', '春招（时间待定）', at(18), at(26), {
        tentative: true,
        note: '等春招公告确定日期。',
      }),

      // —— 驾照
      phase('driving', '科目二练车', at(-8), at(-3), { done: true }),
      phase('driving', '科目三练车（寒假）', at(10), at(13), { tentative: true }),

      // —— 读书会（已收官，没有后续，会收进“还没有安排”）
      phase('club', '秋季共读', at(-9), at(-3), { done: true }),
    ],

    milestones: [
      // —— 考研
      milestone('kaoyan', '预报名', at(-7, 3), { done: true }),
      milestone('kaoyan', '正式报名', at(-4, 2), { done: true }),
      milestone('kaoyan', '现场确认', at(0, 5), { note: '带身份证和学历证明，早点去不排队。' }),
      milestone('kaoyan', '打印准考证', at(5, 2)),
      milestone('kaoyan', '考研初试', at(6, 5), { note: '周六周日两天，考前一天看考场。' }),
      milestone('kaoyan', '初试出分', at(15, 0)),
      milestone('kaoyan', '国家线公布', at(18, 0)),

      // —— 期末
      milestone('final', '操作系统期中', at(-3, 2), { done: true }),
      milestone('final', '课设答辩', at(4, 2)),
      milestone('final', '数据结构考试', at(8, 1), { note: '考研 408 也考，复习一次用两回。' }),
      milestone('final', '软件工程考试', at(9, 3)),

      // —— 六级
      milestone('cet6', '六级报名', at(-5, 1), { done: true }),
      milestone('cet6', '六级考试', at(4, 5)),
      milestone('cet6', '六级出分', at(15, 3)),

      // —— 毕设
      milestone('thesis', '开题答辩', at(-8, 3), { done: true }),
      milestone('thesis', '中期检查', at(18, 2)),
      milestone('thesis', '论文查重', at(27, 4)),
      milestone('thesis', '毕业答辩', at(31, 3)),

      // —— 实习与春招
      milestone('job', '内推开放', at(1, 4)),
      milestone('job', '春招网申开放', at(17, 0)),

      // —— 驾照
      milestone('driving', '科目二考试', at(-3, 3), { done: true }),
      milestone('driving', '科目三考试', at(13, 3)),

      // —— 读书会
      milestone('club', '结营分享', at(-3, 5), { done: true }),
    ],

    terms: [
      { id: 'showcase-term-1', name: '大四上学期', start: at(-9), end: at(10) },
      { id: 'showcase-term-2', name: '寒假', start: at(10), end: at(16) },
      { id: 'showcase-term-3', name: '大四下学期', start: at(16), end: at(34) },
    ],

    todos: [
      // 过期没做完的
      todo('整理数学错题本', at(0, 1), 'kaoyan'),
      todo('回复导师的毕设邮件', at(0, 2), 'thesis'),
      // 今天：一天排满，主页只露出前几条，其余折成“还有 N 项”
      todo('英语二真题 · 阅读两篇', at(0, 3), 'kaoyan'),
      todo('408 数据结构 · 图章节刷题', at(0, 3), 'kaoyan'),
      todo('提交操作系统实验报告', at(0, 3), 'final'),
      todo('六级听力真题 · Section A', at(0, 3), 'cet6'),
      todo('联调推荐模块接口', at(0, 3), 'thesis'),
      todo('打印现场确认材料', at(0, 3), 'kaoyan'),
      todo('背 100 个六级词汇', at(0, 3), 'cet6', true),
      todo('买两盒笔芯', at(0, 3), null),
      // 接下来几天
      todo('政治 · 马原选择题 20 道', at(0, 4), 'kaoyan'),
      todo('考研现场确认（带身份证）', at(0, 5), 'kaoyan'),
      todo('周日复盘 + 下周计划', at(0, 6), null),
      todo('六级作文模板背诵', at(1, 0), 'cet6'),
      todo('更新简历：加上推荐系统项目', at(1, 1), 'job'),
      todo('整理 408 错题', at(1, 3), 'kaoyan'),
      todo('数据结构课设：代码收尾', at(1, 4), 'final'),
      // 还没排日期
      todo('补完编译原理笔记', null, 'final'),
      todo('看一遍春招时间线', null, 'job'),
      todo('预约学校体检', null, null),
    ],
  }
}
