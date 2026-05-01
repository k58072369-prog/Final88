import { Router } from "express";
import { execSync, exec } from "child_process";
import { readFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { ai } from "@workspace/integrations-gemini-ai";
import { logger } from "../../lib/logger";

const router = Router();

const PDF_PATH = path.resolve(
  process.cwd(),
  "../../attached_assets/امتحانات_أحياء٢ث_ت٢_المرشد٢٠٢٥_1777627228535.pdf"
);

interface ExamQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string | null;
  examIndex: number;
}

interface ExamSection {
  title: string;
  questions: ExamQuestion[];
}

interface ExtractionStatus {
  ready: boolean;
  processing: boolean;
  totalPages: number;
  processedPages: number;
  error: string | null;
}

let extractionStatus: ExtractionStatus = {
  ready: false,
  processing: false,
  totalPages: 0,
  processedPages: 0,
  error: null,
};

let extractedExams: ExamSection[] = [];
let questionIdCounter = 1;

async function extractQuestionsFromPage(
  imagePath: string,
  pageNum: number
): Promise<ExamQuestion[]> {
  const imageData = readFileSync(imagePath);
  const base64Image = imageData.toString("base64");

  const prompt = `أنت مساعد متخصص في استخراج أسئلة الامتحانات. 
هذه صورة من ورقة امتحان أحياء للصف الثاني الثانوي الأزهري.

مهمتك:
1. استخرج كل الأسئلة الاختيارية (اختر الإجابة الصحيحة) من هذه الصفحة
2. لكل سؤال، استخرج نص السؤال والخيارات الأربعة (أ، ب، ج، د)
3. إذا كانت الإجابة الصحيحة محددة أو مظللة، استخرجها

أعد الإجابة بتنسيق JSON فقط (بدون أي نص إضافي):
{
  "questions": [
    {
      "question": "نص السؤال",
      "options": ["الخيار أ", "الخيار ب", "الخيار ج", "الخيار د"],
      "correctAnswer": null
    }
  ]
}

إذا لم تجد أسئلة اختيارية في هذه الصفحة، أعد: {"questions": []}

ملاحظة: استخرج النص العربي بدقة كما هو مكتوب في الصورة.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: base64Image,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    const text = response.text ?? "{}";
    const cleanText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleanText);
    return (parsed.questions || []).map(
      (q: { question: string; options: string[]; correctAnswer: string | null }) => ({
        id: questionIdCounter++,
        question: q.question,
        options: q.options || [],
        correctAnswer: q.correctAnswer || null,
        examIndex: 0,
      })
    );
  } catch (err) {
    logger.error({ err, pageNum }, "Failed to extract questions from page");
    return [];
  }
}

function groupIntoExams(allQuestions: ExamQuestion[]): ExamSection[] {
  const QUESTIONS_PER_EXAM = 20;
  const exams: ExamSection[] = [];

  for (let i = 0; i < allQuestions.length; i += QUESTIONS_PER_EXAM) {
    const chunk = allQuestions.slice(i, i + QUESTIONS_PER_EXAM);
    const examNum = Math.floor(i / QUESTIONS_PER_EXAM) + 1;
    chunk.forEach((q) => {
      q.examIndex = exams.length;
    });
    exams.push({
      title: `الامتحان رقم ${examNum}`,
      questions: chunk,
    });
  }

  return exams.length > 0 ? exams : [];
}

async function processPDF() {
  if (extractionStatus.processing || extractionStatus.ready) return;

  extractionStatus.processing = true;
  extractionStatus.error = null;
  questionIdCounter = 1;

  try {
    const tmpDir = "/tmp/exam_pages";
    if (!existsSync(tmpDir)) {
      mkdirSync(tmpDir, { recursive: true });
    }

    const countOutput = execSync(
      `pdfinfo "${PDF_PATH}" 2>/dev/null | grep Pages | awk '{print $2}'`
    )
      .toString()
      .trim();
    const totalPages = parseInt(countOutput) || 20;
    extractionStatus.totalPages = totalPages;

    logger.info({ totalPages }, "Starting PDF extraction");

    execSync(
      `pdftoppm -r 150 -png "${PDF_PATH}" "${tmpDir}/page"`,
      { timeout: 120000 }
    );

    const allQuestions: ExamQuestion[] = [];

    for (let i = 1; i <= totalPages; i++) {
      const pageFile = `${tmpDir}/page-${String(i).padStart(2, "0")}.png`;
      const pageFileAlt = `${tmpDir}/page-${i}.png`;

      const actualFile = existsSync(pageFile)
        ? pageFile
        : existsSync(pageFileAlt)
        ? pageFileAlt
        : null;

      if (!actualFile) {
        logger.warn({ page: i }, "Page image not found");
        extractionStatus.processedPages = i;
        continue;
      }

      const questions = await extractQuestionsFromPage(actualFile, i);
      allQuestions.push(...questions);
      extractionStatus.processedPages = i;

      logger.info(
        { page: i, questionsFound: questions.length, total: allQuestions.length },
        "Processed page"
      );
    }

    extractedExams = groupIntoExams(allQuestions);
    extractionStatus.ready = true;
    extractionStatus.processing = false;

    logger.info(
      { totalQuestions: allQuestions.length, exams: extractedExams.length },
      "PDF extraction complete"
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "PDF extraction failed");
    extractionStatus.error = errorMsg;
    extractionStatus.processing = false;

    if (extractedExams.length === 0) {
      extractedExams = getFallbackQuestions();
      extractionStatus.ready = true;
    }
  }
}

function getFallbackQuestions(): ExamSection[] {
  const questions: ExamQuestion[] = [
    { id: 1, question: "ما هي وحدة بناء البروتين؟", options: ["الأحماض الأمينية", "الجلوكوز", "الأحماض الدهنية", "النيوكليوتيدات"], correctAnswer: "الأحماض الأمينية", examIndex: 0 },
    { id: 2, question: "أي من الآتي يُعدّ من وظائف الغشاء الخلوي؟", options: ["التمثيل الضوئي", "التنفس الخلوي", "تنظيم مرور المواد", "تخزين الطاقة"], correctAnswer: "تنظيم مرور المواد", examIndex: 0 },
    { id: 3, question: "ما الذي تُنتجه البلاستيدات الخضراء؟", options: ["الأكسجين والجلوكوز", "ثاني أكسيد الكربون والماء", "ATP فقط", "البروتينات"], correctAnswer: "الأكسجين والجلوكوز", examIndex: 0 },
    { id: 4, question: "أي من الآتي يحدث في الميتوكوندريا؟", options: ["التمثيل الضوئي", "التنفس الخلوي الهوائي", "تخليق البروتين", "الانقسام الخلوي"], correctAnswer: "التنفس الخلوي الهوائي", examIndex: 0 },
    { id: 5, question: "ما هو الغشاء الذي يحيط بالنواة؟", options: ["الغشاء البلازمي", "الغشاء النووي", "الغشاء الليزوزومي", "الغشاء الميتوكوندري"], correctAnswer: "الغشاء النووي", examIndex: 0 },
  ];
  return [{ title: "امتحان نموذجي", questions }];
}

processPDF();

router.get("/exam/status", (req, res) => {
  res.json(extractionStatus);
});

router.get("/exam/questions", (req, res) => {
  if (!extractionStatus.ready) {
    res.status(202).json({
      exams: [],
      totalQuestions: 0,
    });
    return;
  }
  const totalQuestions = extractedExams.reduce(
    (sum, exam) => sum + exam.questions.length,
    0
  );
  res.json({
    exams: extractedExams,
    totalQuestions,
  });
});

export default router;
