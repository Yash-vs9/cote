package com.cote.client.story;

import java.util.List;

/** One chapter of the playable story: a title plus an ordered list of steps. */
public class Chapter {
    public final int number;
    public final String title;
    public final List<Step> steps;

    public Chapter(int number, String title, List<Step> steps) {
        this.number = number;
        this.title = title;
        this.steps = steps;
    }
}
