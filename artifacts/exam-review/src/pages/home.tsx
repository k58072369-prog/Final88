import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  useGetExamStatus, 
  useGetExamQuestions,
  getGetExamStatusQueryKey,
  getGetExamQuestionsQueryKey
} from "@workspace/api-client-react";
import teacherImg from "@assets/Gemini_Generated_Image_l00czzl00czzl00c_1777627228361.png";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertCircle, RefreshCcw, CheckCircle2, ChevronRight, ChevronLeft } from "lucide-react";

export default function Home() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Status Hook
  const { data: statusData, isLoading: isStatusLoading, isError: isStatusError, refetch: refetchStatus } = useGetExamStatus({
    query: {
      queryKey: getGetExamStatusQueryKey(),
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data) return 2000;
        return data.processing ? 2000 : false;
      }
    }
  });

  const isReady = statusData?.ready && !statusData?.processing;

  // Questions Hook
  const { data: questionsData, isLoading: isQuestionsLoading, isError: isQuestionsError, refetch: refetchQuestions } = useGetExamQuestions({
    query: {
      queryKey: getGetExamQuestionsQueryKey(),
      enabled: isReady
    }
  });

  const handleStart = () => {
    setShowWelcome(false);
  };

  const handleAnswerSelect = (questionId: number, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleNext = () => {
    const currentSection = questionsData?.exams[currentSectionIdx];
    if (!currentSection) return;

    if (currentQuestionIdx < currentSection.questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
    } else if (currentSectionIdx < (questionsData.exams.length - 1)) {
      // In this flow we just submit at the end of current section, or move to next section?
      // Let's assume one big exam or we navigate sections.
      // Actually, instructions say: "Shows one exam section at a time", "After last question: show Submit Exam button".
      // Let's submit the current section.
      setIsSubmitted(true);
    } else {
      setIsSubmitted(true);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx(prev => prev - 1);
    }
  };

  const handleNextSection = () => {
    if (!questionsData) return;
    if (currentSectionIdx < questionsData.exams.length - 1) {
      setCurrentSectionIdx(prev => prev + 1);
      setCurrentQuestionIdx(0);
      setAnswers({});
      setIsSubmitted(false);
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setCurrentQuestionIdx(0);
    setIsSubmitted(false);
  };

  if (showWelcome) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-card/60 backdrop-blur-xl border border-card-border rounded-3xl p-8 flex flex-col items-center text-center shadow-2xl"
        >
          <motion.img 
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            src={teacherImg} 
            alt="Teacher" 
            className="w-40 h-40 object-cover rounded-full border-4 border-primary/20 shadow-lg mb-6"
          />
          <h1 className="text-3xl font-bold text-foreground mb-2 font-sans tracking-tight">مراجعة ليلة الامتحان</h1>
          <h2 className="text-xl text-primary font-medium mb-6">الثانية الأزهرية - مادة الأحياء</h2>
          
          <p className="text-muted-foreground mb-8 leading-relaxed">
            أهلاً بك يا بطل! جهز ورقتك وقلمك، وخذ نفساً عميقاً. هذه المراجعة صممت خصيصاً لتجعلك مستعداً تماماً لامتحان الغد. التطبيق يعمل بدون إنترنت بعد التحميل.
          </p>

          {!isReady || isQuestionsLoading ? (
            <div className="flex flex-col items-center gap-4 w-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {statusData?.processing 
                  ? `جاري تجهيز الأسئلة... (${statusData.processedPages}/${statusData.totalPages})` 
                  : "جاري تحميل الامتحان..."}
              </p>
            </div>
          ) : (
            <Button 
              size="lg" 
              className="w-full text-lg rounded-xl h-14 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300 hover:shadow-[0_0_20px_rgba(250,204,21,0.4)]"
              onClick={handleStart}
            >
              ابدأ المراجعة
            </Button>
          )}

          {(isStatusError || isQuestionsError) && (
            <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">حدث خطأ أثناء تحميل الأسئلة. يرجى المحاولة مرة أخرى.</p>
              <Button size="icon" variant="ghost" onClick={() => { refetchStatus(); refetchQuestions(); }}>
                <RefreshCcw className="w-4 h-4" />
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  if (!questionsData || !questionsData.exams[currentSectionIdx]) {
    return null;
  }

  const currentSection = questionsData.exams[currentSectionIdx];
  const currentQuestion = currentSection.questions[currentQuestionIdx];
  const isLastQuestion = currentQuestionIdx === currentSection.questions.length - 1;
  const progress = ((currentQuestionIdx + 1) / currentSection.questions.length) * 100;

  if (isSubmitted) {
    let score = 0;
    currentSection.questions.forEach(q => {
      if (answers[q.id] === q.correctAnswer) score++;
    });
    const percentage = Math.round((score / currentSection.questions.length) * 100);
    
    let message = "أحسنت! أداء رائع، استمر في التقدم.";
    if (percentage === 100) message = "ممتاز! أنت مستعد تماماً للامتحان.";
    else if (percentage < 50) message = "لا بأس، يمكنك المحاولة مرة أخرى لتحسين نتيجتك.";

    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 relative z-10">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-card/60 backdrop-blur-xl border border-card-border rounded-3xl p-8 flex flex-col items-center text-center shadow-2xl"
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <img 
              src={teacherImg} 
              alt="Teacher" 
              className="w-32 h-32 object-cover rounded-full border-4 border-primary/20 shadow-lg mb-6 mx-auto"
            />
          </motion.div>

          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.4 }}
            className="w-32 h-32 rounded-full border-8 border-primary flex items-center justify-center mb-6"
          >
            <span className="text-4xl font-bold text-primary">{percentage}%</span>
          </motion.div>

          <h2 className="text-2xl font-bold mb-2">{message}</h2>
          <p className="text-muted-foreground mb-8">
            لقد أجبت بشكل صحيح على {score} من أصل {currentSection.questions.length} أسئلة.
          </p>

          <div className="flex flex-col gap-4 w-full">
            {currentSectionIdx < questionsData.exams.length - 1 && (
              <Button size="lg" className="w-full rounded-xl h-14 text-lg" onClick={handleNextSection}>
                الامتحان التالي
              </Button>
            )}
            <Button size="lg" variant="outline" className="w-full rounded-xl h-14 text-lg border-primary/20 hover:bg-primary/10" onClick={handleRetry}>
              إعادة المحاولة
              <RefreshCcw className="w-5 h-5 mr-2" />
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col p-4 md:p-8 max-w-3xl mx-auto relative z-10">
      <header className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-primary">{currentSection.title}</h2>
          <div className="bg-card px-4 py-1.5 rounded-full text-sm font-medium border border-card-border">
            سؤال {currentQuestionIdx + 1} من {currentSection.questions.length}
          </div>
        </div>
        <Progress value={progress} className="h-2 bg-muted" />
      </header>

      <main className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="flex-1 flex flex-col"
          >
            <Card className="bg-card/60 backdrop-blur-xl border-card-border mb-6 shadow-xl">
              <CardContent className="p-6 md:p-8 text-xl md:text-2xl font-medium leading-relaxed">
                {currentQuestion.question}
              </CardContent>
            </Card>

            <div className="grid gap-4 mt-auto">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = answers[currentQuestion.id] === option;
                return (
                  <motion.button
                    key={idx}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleAnswerSelect(currentQuestion.id, option)}
                    className={`
                      relative p-4 md:p-6 rounded-2xl text-right transition-all duration-200 border-2
                      ${isSelected 
                        ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(250,204,21,0.2)] text-primary-foreground' 
                        : 'bg-card border-card-border hover:border-primary/50 hover:bg-card/80 text-foreground'}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg md:text-xl font-medium">{option}</span>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                        >
                          <CheckCircle2 className="w-6 h-6 text-primary" />
                        </motion.div>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="mt-8 flex items-center justify-between pt-6 border-t border-border/50">
        <Button
          variant="outline"
          size="lg"
          className="rounded-xl px-6"
          disabled={currentQuestionIdx === 0}
          onClick={handlePrev}
        >
          <ChevronRight className="w-5 h-5 ml-2" />
          السابق
        </Button>

        {isLastQuestion ? (
          <Button
            size="lg"
            className="rounded-xl px-8 bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => setIsSubmitted(true)}
            disabled={!answers[currentQuestion.id]}
          >
            إنهاء الامتحان
          </Button>
        ) : (
          <Button
            size="lg"
            className="rounded-xl px-8 bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={handleNext}
            disabled={!answers[currentQuestion.id]}
          >
            التالي
            <ChevronLeft className="w-5 h-5 mr-2" />
          </Button>
        )}
      </footer>
    </div>
  );
}
