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
}
