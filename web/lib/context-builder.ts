import { readAllTeacherFiles, readTextbookChapter } from "./file-reader";
import { getConcept, getPrerequisites } from "./knowledge-index";

export interface BuiltContext {
  systemPrompt: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
}

export async function buildClassroomContext(
  conceptSlug: string,
  userMessage: string,
  history: string
): Promise<BuiltContext> {
  const teacherFiles = await readAllTeacherFiles();
  const concept = getConcept(conceptSlug);

  const systemContent = teacherFiles["system.md"] || "";
  const systemDetail = teacherFiles["system_detail.md"] || "";
  const learnerProfile = teacherFiles["learner_profile.md"] || "";
  const progress = teacherFiles["progress.md"] || "";
  // Relationship & emotional history
  const diary = (teacherFiles["diary.md"] || "").slice(-2000);
  const wechatRecent = (teacherFiles["wechat_group.md"] || "").slice(-1500);
  const knowledgeMap = teacherFiles["知识地图.md"] || "";

  const professorName = concept?.professor ?? "马超";
  const professorFile =
    professorName === "马超"
      ? teacherFiles["马超.md"] || ""
      : teacherFiles["九雀.md"] || "";
  const otherProfessor =
    professorName === "马超"
      ? teacherFiles["九雀.md"] || ""
      : teacherFiles["马超.md"] || "";

  let textbookContent = "";
  if (concept) {
    textbookContent = await readTextbookChapter(
      concept.file,
      concept.section
    );
  }

  const prereqs = concept
    ? getPrerequisites(conceptSlug)
        .map((p) => `- ${p.title}: ${p.concepts.join(", ")}`)
        .join("\n")
    : "";

  const systemPrompt = `你是苏格拉底式教学系统的AI教授。

## 系统设定
${systemContent}

## 背景故事
${systemDetail}

## 学习者
${learnerProfile}

## 当前进度
${progress}

## 情感与关系史（最近）
${diary}

## 近期群聊互动
${wechatRecent}

## 知识地图
${knowledgeMap}

## 主讲教授：${professorName}
${professorFile}

## 另一位教授（旁听/补充提问）
${otherProfessor}

## 学生角色
${(teacherFiles["小华.md"] || "").slice(0, 500)}
${(teacherFiles["牢施.md"] || "").slice(0, 500)}

## 本节课内容
${textbookContent}

## 前置知识（已掌握）
${prereqs}

## 教学规则
1. 使用苏格拉底诘问法：全程用问题引导学生，不直接给答案
2. ${professorName}主导教学，另一位教授可补充提问或换个角度
3. 同学角色（小华、牢施）可自然插话、提问、抢答。**教授点名小华/牢施时，该角色必须立即在当前回复中作答**——你是AI，你同时扮演教授和所有同学角色，不要等用户替他们回答
4. 所有提问最终要回到用户身上，让用户也参与思考和回答
5. 数学公式使用 KaTeX 格式：行内 $...$，块级 $$...$$
6. 当学生对概念有误解时，用追问帮助他们自己发现
7. 保持角色性格一致（参考角色设定文件）
8. 教学语言：中文为主，专业术语可中英混用
9. 不要给出最终答案——引导到学生自己推理出来

## 之前对话
${history}`;

  return {
    systemPrompt,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  };
}

export async function buildGroupChatContext(
  userMessage: string,
  history: string,
  mode: "group" | "private" = "group",
  targetCharacter: string = ""
): Promise<BuiltContext> {
  const teacherFiles = await readAllTeacherFiles();

  let systemPrompt: string;

  if (mode === "private" && targetCharacter) {
    const targetFile = teacherFiles[`${targetCharacter}.md`] || "";
    systemPrompt = `你是苏格拉底实验室的私信模拟系统。用户正在和${targetCharacter}进行一对一的私密对话。

## ${targetCharacter}的完整角色设定
${targetFile}

## 私信规则
1. 只有${targetCharacter}回复，没有其他角色
2. 回复格式："[${targetCharacter}]: [内容]"
3. 每次只回复一条消息（${targetCharacter}一个人说一句话）
4. 保持${targetCharacter}的性格和说话风格
5. 回复中用括号加入神态/动作描写，如"(脸红)"、"(靠近了一点)"、"(声音很轻)"
6. 对话私密、真诚，比群聊更亲密自然

## 之前对话
${history}`;
  } else {
    systemPrompt = `你是苏格拉底实验室的群聊模拟系统。模拟四个角色在微信群中的对话。

## 角色设定
${teacherFiles["马超.md"] || ""}
${teacherFiles["九雀.md"] || ""}
${teacherFiles["小华.md"] || ""}
${teacherFiles["牢施.md"] || ""}

## 群聊规则
1. 角色回复格式："[角色名]: [内容]"
2. 角色保持各自性格和说话风格，回复中用括号加入神态/动作描写，如"(轻笑)"、"(低头)"、"(瞪了他一眼)"
3. 对话自然、有生活气息
4. 偶尔有私下互动（私信）、走廊偶遇等
5. 马超和九雀之间有微妙默契
6. 小华和牢施之间有轻度的情感线
7. 可以用 LaTeX 公式，但群聊氛围轻松

## 之前对话
${history}`;
  }

  return {
    systemPrompt,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `[用户]: ${userMessage}` },
    ],
  };
}
