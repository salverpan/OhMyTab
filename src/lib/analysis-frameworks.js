/**
 * 分析框架目录（轻量）与方法卡（按需加载）。
 * 原则：目录常驻，方法卡选中后加载；不把整本教材塞进 prompt。
 */
import { EXTRA_FRAMEWORK_CATALOG, EXTRA_FRAMEWORK_METHODS } from './analysis-frameworks-extra.js';

const BASE_FRAMEWORK_CATALOG = [
  { id: 'issue-tree', name: '问题树 / MECE', domains: ['general', 'strategy', 'policy'], purpose: '把复杂问题拆成可验证的子问题', use_when: ['问题边界不清', '需要覆盖关键驱动因素'], avoid_when: ['已经有明确单一问题'], outputs: ['问题树', '关键假设', '数据需求'], related: ['hypothesis-driven'] },
  { id: 'five-forces', name: '波特五力', domains: ['industry', 'strategy'], purpose: '判断行业结构、利润池和议价能力', use_when: ['行业竞争格局', '长期利润率', '进入壁垒'], avoid_when: ['单公司执行力分析', '短期事件'], outputs: ['五力强度', '利润池', '战略含义'], related: ['profit-pool', 'value-chain'] },
  { id: 'profit-pool', name: '利润池分析', domains: ['industry', 'strategy', 'investment'], purpose: '判断价值链上利润集中在哪一环以及是否迁移', use_when: ['行业增长但利润不增', '上下游议价变化'], avoid_when: ['没有收入/毛利结构数据'], outputs: ['利润池分布', '迁移方向', '受益环节'], related: ['five-forces', 'value-chain'] },
  { id: 'value-chain', name: '价值链分析', domains: ['industry', 'operations'], purpose: '拆解价值创造环节与瓶颈', use_when: ['寻找差异化来源', '分析成本结构', '判断控制点'], avoid_when: ['只需要宏观行业结论'], outputs: ['关键环节', '瓶颈', '控制点'], related: ['profit-pool', 'five-forces'] },
  { id: '3c', name: '3C（公司/客户/竞争）', domains: ['strategy', 'product'], purpose: '从公司能力、客户需求和竞争格局定位战略', use_when: ['产品/市场进入', '定位取舍'], avoid_when: ['需要精细财务估值'], outputs: ['定位', '取舍', '能力缺口'], related: ['jtbd', 'five-forces'] },
  { id: 'jtbd', name: 'JTBD（待办任务）', domains: ['product', 'customer'], purpose: '从用户要完成的任务而非画像解释需求', use_when: ['需求洞察', '产品定位', '替代品分析'], avoid_when: ['纯宏观政策研究'], outputs: ['待办任务', '痛点', '替代方案'], related: ['3c', 'unit-economics'] },
  { id: 'unit-economics', name: '单位经济模型', domains: ['business', 'investment', 'product'], purpose: '判断单笔/单客/单店是否赚钱以及规模化条件', use_when: ['商业模式', '增长质量', '补贴可持续性'], avoid_when: ['缺少成本/收入拆分'], outputs: ['单位贡献', '盈亏平衡', '规模化条件'], related: ['scenario-analysis', 'dcf'] },
  { id: 'dcf', name: 'DCF / 现金流折现', domains: ['investment', 'finance'], purpose: '把未来现金流和风险转换为价值区间', use_when: ['资产估值', '长期现金流判断'], avoid_when: ['现金流不可预测或早期项目'], outputs: ['价值区间', '关键假设', '敏感性'], related: ['scenario-analysis', 'unit-economics'] },
  { id: 'scenario-analysis', name: '情景分析', domains: ['investment', 'strategy', 'policy'], purpose: '在不确定环境下给出多情景与触发条件', use_when: ['关键变量不确定', '需要建议与止损'], avoid_when: ['可以用单一路径确定答案'], outputs: ['基准/上行/下行情景', '触发指标', '概率'], related: ['dcf', 'red-team'] },
  { id: 'stakeholder-analysis', name: '利益相关者分析', domains: ['policy', 'organization'], purpose: '判断谁影响决策、谁承担成本、谁有否决权', use_when: ['政策/监管', '组织变革', '多方决策'], avoid_when: ['单主体技术问题'], outputs: ['权力地图', '激励', '联盟/阻力'], related: ['cost-benefit', 'implementation-feasibility'] },
  { id: 'cost-benefit', name: '成本收益与可行性', domains: ['policy', 'operations', 'product'], purpose: '比较方案的总收益、总成本和执行可行性', use_when: ['公共政策', '项目取舍', '资源分配'], avoid_when: ['无法识别主要收益/成本'], outputs: ['净收益', '分配影响', '执行约束'], related: ['stakeholder-analysis', 'scenario-analysis'] },
  { id: 'first-principles', name: '第一性原理', domains: ['technology', 'strategy'], purpose: '回到物理/经济约束，拆掉类比和行业惯例', use_when: ['技术路线', '成本极限', '颠覆式创新'], avoid_when: ['成熟流程的日常优化'], outputs: ['硬约束', '可行边界', '关键突破点'], related: ['trl', 'value-chain'] },
  { id: 'trl', name: '技术成熟度（TRL）', domains: ['technology', 'policy'], purpose: '判断技术从原理到量产的距离和风险', use_when: ['技术评估', '研发投资', '产业化路径'], avoid_when: ['纯商业模式问题'], outputs: ['TRL 等级', '瓶颈', '产业化时间'], related: ['first-principles', 'scenario-analysis'] },
  { id: 'ach', name: 'ACH 竞争性假设', domains: ['intelligence', 'geopolitics', 'risk'], purpose: '比较多条假设，找出证据最一致的解释', use_when: ['情报判断', '归因分析', '阴谋论/单一叙事'], avoid_when: ['只有一个可验证解释'], outputs: ['假设矩阵', '支持/矛盾证据', '最可信假设'], related: ['red-team', 'source-reliability'] },
  { id: 'root-cause', name: '根因分析', domains: ['operations', 'engineering'], purpose: '区分症状、直接原因和系统性根因', use_when: ['故障', '流程问题', '质量事故'], avoid_when: ['战略/行业判断'], outputs: ['因果链', '根因', '修复优先级'], related: ['theory-of-constraints'] },
  { id: 'theory-of-constraints', name: '约束理论（TOC）', domains: ['operations'], purpose: '找到限制系统产出的瓶颈并优先改善', use_when: ['产能/交付/流程优化'], avoid_when: ['瓶颈不明确且缺数据'], outputs: ['瓶颈', '吞吐提升', '次生瓶颈'], related: ['root-cause', 'value-chain'] },
];
export const FRAMEWORK_CATALOG = [...BASE_FRAMEWORK_CATALOG, ...EXTRA_FRAMEWORK_CATALOG];

const CARD_MAP = new Map(FRAMEWORK_CATALOG.map((x) => [x.id, x]));

export function loadFrameworkCard(id) {
  return CARD_MAP.get(String(id || '').trim()) || null;
}

export function formatFrameworkCatalog() {
  return FRAMEWORK_CATALOG.map((f) => (
    '- ' + f.id + ' | ' + f.name + ' | ' + f.domains.join('/') + ' | ' + f.purpose
  )).join('\n');
}

export function formatFrameworkCard(id) {
  const f = loadFrameworkCard(id);
  if (!f) return '未知框架。可用：' + FRAMEWORK_CATALOG.map((x) => x.id).join(', ');
  const m = FRAMEWORK_METHODS[f.id] || {};
  const block = (label, arr) => Array.isArray(arr) && arr.length ? ['- ' + label + ': ' + arr.join('；')] : [];
  return [
    '## ' + f.name + ' (' + f.id + ')',
    '- 领域: ' + f.domains.join('/'),
    '- 用途: ' + f.purpose,
    '- 适用: ' + f.use_when.join('；'),
    '- 不适用: ' + f.avoid_when.join('；'),
    ...block('必需输入', m.required_inputs),
    ...block('执行步骤', m.steps),
    ...block('输出契约', m.output_contract),
    ...block('常见错误', m.common_mistakes),
    ...block('评审标准', m.review_rubric),
    '- 关联: ' + f.related.join('；'),
  ].join('\n');
}

const BASE_FRAMEWORK_METHODS = {
  'issue-tree': {
    required_inputs: ['问题定义', '决策目标', '可用数据边界'],
    steps: ['写清核心问题', '拆成互斥且尽量穷尽的子问题', '为每个分支写假设和数据需求', '删掉不影响决策的分支', '输出问题树和验证顺序'],
    output_contract: ['问题树', '关键假设', '优先验证项'],
    common_mistakes: ['按部门而不是按问题拆', '分支不互斥', '拆完不落到判断'],
    review_rubric: ['是否覆盖关键驱动', '是否有明确取舍', '是否指出数据缺口'],
  },
  'five-forces': {
    required_inputs: ['行业边界', '主要玩家份额', '毛利率/ROIC', '上下游集中度', '替代品经济性'],
    steps: ['定义行业和利润池', '评估五力强度并排序', '分析五力之间的相互作用', '落到利润池变化', '给出进入/退出/定位建议'],
    output_contract: ['五力强度排序', '利润池判断', '战略含义'],
    common_mistakes: ['五力平均用力', '只描述不定性', '忽略替代品和买方集中度'],
    review_rubric: ['行业边界是否清楚', '是否解释因果', '是否落到战略结论'],
  },
  'profit-pool': {
    required_inputs: ['价值链收入', '各环节毛利', '资本占用', '议价结构'],
    steps: ['拆价值链', '估算各环节收入和利润', '找出利润集中点', '判断迁移方向', '给出受益/受损环节'],
    output_contract: ['利润池分布', '迁移趋势', '受益环节'],
    common_mistakes: ['只看收入不看利润', '把行业增长等同于利润增长', '忽略资本占用'],
    review_rubric: ['是否有量化结构', '是否解释迁移', '是否能指导定位'],
  },
  'value-chain': {
    required_inputs: ['价值链环节', '成本结构', '差异化来源', '控制点'],
    steps: ['画出价值链', '标出成本和价值贡献', '找瓶颈和控制点', '判断可替代性', '提出取舍'],
    output_contract: ['关键环节', '瓶颈', '控制点'],
    common_mistakes: ['画图不分析', '忽略环节间依赖', '把规模当壁垒'],
    review_rubric: ['是否识别控制点', '是否连接利润', '是否有行动含义'],
  },
  '3c': {
    required_inputs: ['公司能力', '客户需求', '竞争格局'],
    steps: ['列公司真实能力', '定义客户和待办任务', '比较竞争对手', '找交集和取舍', '形成定位'],
    output_contract: ['定位', '取舍', '能力缺口'],
    common_mistakes: ['三块各写一段不交叉', '把愿望当能力', '定位没有放弃项'],
    review_rubric: ['是否有交叉分析', '是否有明确取舍', '是否可执行'],
  },
  'jtbd': {
    required_inputs: ['用户场景', '触发事件', '现有替代方案', '痛点'],
    steps: ['写清用户要完成的任务', '拆功能/情感/社会维度', '列出替代方案', '找未被满足的任务', '形成产品含义'],
    output_contract: ['待办任务', '痛点', '替代方案'],
    common_mistakes: ['按人口画像代替任务', '把功能当任务', '忽略非消费'],
    review_rubric: ['任务是否具体', '是否有替代方案', '是否能指导产品'],
  },
  'unit-economics': {
    required_inputs: ['单价', '变动成本', '获客成本', '留存/复购', '履约成本'],
    steps: ['算单笔贡献', '算回收期', '找盈亏平衡', '判断规模化条件', '做敏感性'],
    output_contract: ['单位贡献', '盈亏平衡', '规模化条件'],
    common_mistakes: ['漏算履约和获客', '用毛利代替贡献', '忽略留存'],
    review_rubric: ['口径是否完整', '是否可复算', '是否指出规模化前提'],
  },
  'dcf': {
    required_inputs: ['收入增长', '利润率', '资本开支', '折现率', '终值假设'],
    steps: ['建现金流', '写清关键假设', '算价值区间', '做敏感性', '和市场价格/替代方案比较'],
    output_contract: ['价值区间', '关键假设', '敏感性'],
    common_mistakes: ['终值占比过高', '假设没有依据', '只给单点值'],
    review_rubric: ['假设是否透明', '是否有区间', '是否解释关键变量'],
  },
  'scenario-analysis': {
    required_inputs: ['关键不确定变量', '基准假设', '触发指标'],
    steps: ['选 2-3 个关键变量', '写基准/上行/下行', '给概率或排序', '定义触发指标', '给行动和止损'],
    output_contract: ['情景表', '触发指标', '行动建议'],
    common_mistakes: ['情景没有区分度', '只写风险不写触发', '概率拍脑袋'],
    review_rubric: ['情景是否互斥', '是否有触发指标', '是否改变行动'],
  },
  'stakeholder-analysis': {
    required_inputs: ['决策者', '影响者', '受益者', '受损者', '否决点'],
    steps: ['列利益相关者', '画权力/利益图', '分析激励和阻力', '找联盟和交换', '给推进路径'],
    output_contract: ['权力地图', '激励', '联盟/阻力'],
    common_mistakes: ['只列名单', '忽略非正式权力', '不谈交换'],
    review_rubric: ['是否识别否决者', '是否分析激励', '是否有推进策略'],
  },
  'cost-benefit': {
    required_inputs: ['总成本', '总收益', '分配影响', '执行约束'],
    steps: ['列成本和收益', '货币化/分级', '比较方案', '分析分配', '判断可行性'],
    output_contract: ['净收益', '分配影响', '执行约束'],
    common_mistakes: ['漏掉隐性成本', '收益重复计算', '忽略执行能力'],
    review_rubric: ['口径是否一致', '是否考虑分配', '是否可执行'],
  },
  'first-principles': {
    required_inputs: ['物理/经济约束', '成本极限', '关键假设'],
    steps: ['拆掉类比', '写硬约束', '推可行边界', '找突破点', '重构方案'],
    output_contract: ['硬约束', '可行边界', '突破点'],
    common_mistakes: ['把行业惯例当物理规律', '忽略系统成本', '只做口号'],
    review_rubric: ['约束是否真实', '推理是否可检验', '是否改变方案'],
  },
  'trl': {
    required_inputs: ['技术原理', '验证环境', '工程化证据', '量产条件'],
    steps: ['定 TRL', '列关键验证', '找产业化瓶颈', '估时间窗', '给投资/跟进建议'],
    output_contract: ['TRL 等级', '瓶颈', '产业化时间'],
    common_mistakes: ['实验室成功当量产', '忽略良率和成本', '只看单项指标'],
    review_rubric: ['证据是否匹配等级', '瓶颈是否具体', '时间判断是否有依据'],
  },
  'ach': {
    required_inputs: ['竞争性假设', '证据清单', '来源可靠性'],
    steps: ['列所有合理假设', '建假设-证据矩阵', '标支持/矛盾', '找最一致假设', '写反转指标'],
    output_contract: ['假设矩阵', '最可信假设', '反转指标'],
    common_mistakes: ['只验证一个假设', '忽略矛盾证据', '把弱来源当强证据'],
    review_rubric: ['假设是否互斥', '是否使用矛盾证据', '是否有反转指标'],
  },
  'root-cause': {
    required_inputs: ['症状', '时间线', '直接原因', '系统条件'],
    steps: ['描述症状', '追直接原因', '追系统根因', '验证因果链', '定修复优先级'],
    output_contract: ['因果链', '根因', '修复优先级'],
    common_mistakes: ['把直接原因当根因', '没有验证', '只修人不修系统'],
    review_rubric: ['因果链是否闭合', '是否有验证', '修复是否针对根因'],
  },
  'theory-of-constraints': {
    required_inputs: ['系统产出', '瓶颈环节', '排队/库存', '改善成本'],
    steps: ['找瓶颈', '利用瓶颈', '让其他环节服从瓶颈', '提升瓶颈', '找次生瓶颈'],
    output_contract: ['瓶颈', '吞吐提升', '次生瓶颈'],
    common_mistakes: ['局部优化非瓶颈', '忽略次生瓶颈', '只看产能不看需求'],
    review_rubric: ['瓶颈是否基于数据', '改善是否作用于瓶颈', '是否考虑次生瓶颈'],
  },
};

const FRAMEWORK_METHODS = { ...BASE_FRAMEWORK_METHODS, ...EXTRA_FRAMEWORK_METHODS };
