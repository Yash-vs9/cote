package com.cote.client.story;

/**
 * Midterm exam mini-game: plain mental-ability questions (arithmetic, sequences,
 * odd-one-out) tuned so anyone can solve them. Pure logic; rendering lives in StoryUI.
 */
public class QuizGame {
    public static class Question {
        public final String prompt;
        public final String[] options;
        public final int correct;
        Question(String prompt, String[] options, int correct) {
            this.prompt = prompt;
            this.options = options;
            this.correct = correct;
        }
    }

    private static final Question[] QUESTIONS = {
        new Question("14 x 6 = ?",                 new String[]{"78", "84", "86", "96"},          1),
        new Question("2, 6, 12, 20, 30, ...  What comes next?",
                                                    new String[]{"36", "40", "42", "44"},          2),
        new Question("3 pens cost 270 yen. How much do 5 pens cost?",
                                                    new String[]{"360", "405", "450", "540"},      2),
        new Question("What is 15% of 200?",        new String[]{"15", "25", "30", "35"},          2),
        new Question("Which one does NOT belong?   Dog / Cat / Rice / Sparrow",
                                                    new String[]{"Dog", "Cat", "Rice", "Sparrow"}, 2),
        new Question("7 x 8 - 6 = ?",              new String[]{"46", "50", "54", "56"},          1),
    };

    public static final float SECONDS_PER_QUESTION = 15f;

    public final int total = QUESTIONS.length;
    public int index = 0;
    public int score = 0;
    public float timeLeft = SECONDS_PER_QUESTION;
    /** -1 none, 0 wrong answer chosen, 1 correct answer chosen (for flash feedback). */
    public int lastResult = -1;
    public float resultFlash = 0f;

    public Question current() { return QUESTIONS[Math.min(index, QUESTIONS.length - 1)]; }
    public boolean finished() { return index >= QUESTIONS.length; }

    public void update(float tpf) {
        if (resultFlash > 0) {
            resultFlash -= tpf;
            if (resultFlash <= 0) lastResult = -1;
            return; // timer paused during feedback flash
        }
        if (!finished()) {
            timeLeft -= tpf;
            if (timeLeft <= 0) submit(-1); // ran out of time
        }
    }

    /** @return true when the whole quiz is now over. */
    public boolean submit(int option) {
        Question q = current();
        boolean correct = option == q.correct;
        if (correct) score++;
        lastResult = correct ? 1 : 0;
        resultFlash = 0.7f;
        index++;
        timeLeft = SECONDS_PER_QUESTION;
        return finished();
    }
}
