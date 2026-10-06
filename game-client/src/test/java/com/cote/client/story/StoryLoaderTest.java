package com.cote.client.story;

import com.cote.client.Landmarks;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Regression tests for the story script: structure and cross-references must stay valid. */
class StoryLoaderTest {

    @Test
    void loadsAllTwelveChapters() throws IOException {
        List<Chapter> chapters = StoryLoader.load(StoryManager.SCRIPT_RESOURCE);
        assertEquals(12, chapters.size(), "Volume 1 must ship with 12 chapters");
        for (int i = 0; i < chapters.size(); i++)
            assertEquals(i + 1, chapters.get(i).number, "Chapters must be sequential");
    }

    @Test
    void everyGotoTargetExists() throws IOException {
        for (Chapter ch : StoryLoader.load(StoryManager.SCRIPT_RESOURCE))
            for (Step s : ch.steps) {
                if (s.type == Step.Type.GOTO)
                    assertNotNull(Landmarks.byKey(s.text(0)),
                            ch.number + ": unknown GOTO key " + s.text(0));
                if (s.type == Step.Type.CMD) {
                    assertNotNull(Landmarks.byKey(s.text(1)),
                            ch.number + ": unknown CMD place " + s.text(1));
                }
            }
    }

    @Test
    void responsesStayWithinChoiceBounds() throws IOException {
        int openOptions = 0;
        for (Chapter ch : StoryLoader.load(StoryManager.SCRIPT_RESOURCE)) {
            openOptions = 0;
            for (Step s : ch.steps) {
                if (s.type == Step.Type.CHOICE)
                    openOptions = Math.max(0, s.texts.length - 1);
                if (s.type == Step.Type.RESPONSE)
                    assertTrue((int) s.num(0) < openOptions,
                            ch.number + ": RESPONSE exceeds last CHOICE options");
            }
        }
    }

    @Test
    void examQuizStepExists() throws IOException {
        for (Chapter ch : StoryLoader.load(StoryManager.SCRIPT_RESOURCE))
            for (Step s : ch.steps)
                if (s.type == Step.Type.QUIZ) return;
        fail("Volume 1 must contain a QUIZ step for the midterm");
    }

    // ---------------------------------------------------------------- branching DSL

    @Test
    void everyJumpTargetResolves() throws IOException {
        for (Chapter ch : StoryLoader.load(StoryManager.SCRIPT_RESOURCE)) {
            java.util.Set<String> labels = new java.util.HashSet<>();
            for (Step s : ch.steps)
                if (s.type == Step.Type.LABEL) labels.add(s.text(0));
            for (Step s : ch.steps) {
                if (s.type == Step.Type.JUMP)
                    assertTrue(labels.contains(s.text(0)), ch.number + ": JUMP to missing label " + s.text(0));
                if (s.type == Step.Type.IF_JUMP)
                    assertTrue(labels.contains(s.text(1)), ch.number + ": IF JUMP to missing label " + s.text(1));
                if (s.type == Step.Type.GOTO_CH) {
                    int target = (int) s.num(0);
                    assertTrue(target >= 1 && target <= 12, ch.number + ": GOTO_CH out of range " + target);
                }
            }
        }
    }

    @Test
    void volume1ShipsBranchPoints() throws IOException {
        boolean kushidaFlag = false, studyFlag = false, quizBranch = false;
        for (Chapter ch : StoryLoader.load(StoryManager.SCRIPT_RESOURCE))
            for (Step s : ch.steps) {
                if (s.type == Step.Type.RESPONSE && s.texts.length > 2 && "kushida_contact".equals(s.text(2))) kushidaFlag = true;
                if (s.type == Step.Type.RESPONSE && s.texts.length > 2 && "horikita_study".equals(s.text(2))) studyFlag = true;
                if (s.type == Step.Type.IF_JUMP && "quiz_high".equals(s.text(0))) quizBranch = true;
            }
        assertTrue(kushidaFlag, "Ch2 contact choice must set kushida_contact");
        assertTrue(studyFlag, "Ch8 study choice must set horikita_study");
        assertTrue(quizBranch, "Ch11 must branch on quiz_high");
    }

    private static List<Chapter> parse(String... lines) throws IOException {
        return StoryLoader.parseLines(java.util.Arrays.asList(lines));
    }

    @Test
    void rejectsUnknownJumpLabel() {
        assertThrows(IOException.class, () -> parse(
                "CHAPTER 1|T",
                "JUMP nowhere",
                "END"));
    }

    @Test
    void rejectsDuplicateLabel() {
        assertThrows(IOException.class, () -> parse(
                "CHAPTER 1|T",
                "LABEL a",
                "LABEL a",
                "END"));
    }

    @Test
    void rejectsUnknownChapterJump() {
        assertThrows(IOException.class, () -> parse(
                "CHAPTER 1|T",
                "GOTO_CH 9",
                "END"));
    }

    @Test
    void parsesBranchDirectivesAndResponseFlags() throws IOException {
        List<Chapter> chapters = parse(
                "CHAPTER 1|T",
                "SET flag_a",
                "IF flag_a JUMP good",
                "LABEL bad",
                "NARR cold path",
                "JUMP join",
                "LABEL good",
                "ME warm path",
                "LABEL join",
                "CHOICE Pick?|One|Two",
                "RESPONSE 0|me|Picked one|flag_one",
                "RESPONSE 1|me|Picked two",
                "END",
                "CHAPTER 2|B",
                "NARR next",
                "END");
        assertEquals(2, chapters.size());
        List<Step> steps = chapters.get(0).steps;
        Step ifJump = steps.stream().filter(s -> s.type == Step.Type.IF_JUMP).findFirst().orElseThrow();
        assertEquals("flag_a", ifJump.text(0));
        assertEquals("good", ifJump.text(1));
        Step resp0 = steps.stream().filter(s -> s.type == Step.Type.RESPONSE && (int) s.num(0) == 0).findFirst().orElseThrow();
        assertEquals("Picked one", resp0.text(1));
        assertEquals("flag_one", resp0.text(2));
        Step resp1 = steps.stream().filter(s -> s.type == Step.Type.RESPONSE && (int) s.num(0) == 1).findFirst().orElseThrow();
        assertEquals("Picked two", resp1.text(1));
        assertEquals(2, resp1.texts.length, "RESPONSE without flag must not grow a flag slot");
    }
}
