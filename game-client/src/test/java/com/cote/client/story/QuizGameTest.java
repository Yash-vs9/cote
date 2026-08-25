package com.cote.client.story;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class QuizGameTest {

    @Test
    void scoringCountsOnlyCorrectAnswers() {
        QuizGame q = new QuizGame();
        assertEquals(6, q.total);
        assertFalse(q.submit(q.current().correct), "quiz not over after Q1");
        for (int i = 0; i < 4; i++) assertFalse(q.submit(-1), "not over until all 6 answered");
        assertTrue(q.submit(-1)); // final question ends the quiz
        assertTrue(q.finished());
        assertEquals(1, q.score);
    }

    @Test
    void timeoutSubmitsAsWrong() {
        QuizGame q = new QuizGame();
        int guard = 0;
        while (!q.finished() && guard++ < 100000) {
            float big = 20f; // exceeds SECONDS_PER_QUESTION
            q.update(big);
            if (q.lastResult == -1) q.update(0.001f); // let flash clear
        }
        assertTrue(q.finished());
        assertEquals(0, q.score);
    }

    @Test
    void everyQuestionHasFourOptionsAndValidAnswer() {
        QuizGame q = new QuizGame();
        while (!q.finished()) {
            QuizGame.Question question = q.current();
            assertEquals(4, question.options.length);
            assertTrue(question.correct >= 0 && question.correct < 4);
            q.submit(question.correct); // drain
        }
        assertEquals(q.total, q.score);
    }
}
