package com.cote.client.story;

/** One executable instruction of the story script. */
public class Step {
    public enum Type {
        CHAPTER,   // nums=[chapterNumber]            texts=[title]
        NARR,      // texts=[body]                    narrator monologue
        ME,        // texts=[body]                    Ayanokouji speaks/thinks aloud
        NPC,       // texts=[npcId, body]             scripted character line
        OBJ,       // texts=[objective]               set objective tracker text
        GOTO,      // texts=[placeKey] nums=[radius]  walk-to objective (Landmarks key)
        GOTOAT,    // nums=[x,z,radius]               walk-to raw coordinates
        WAIT,      // nums=[minutes]                  wait until in-game clock reaches hh:mm
        TIME,      // nums=[minutes]                  set the in-game clock
        TELEPORT,  // nums=[x,y,z]
        CHOICE,    // texts=[prompt, opt0, opt1, ..]  player picks an option (keys 1..n)
        RESPONSE,  // nums=[optionIdx] texts=[speakerId, body]  plays only if option picked
        SPAWN,     // texts=[extraId] nums=[x,z,yaw]
        DESPAWN,   // texts=[extraId]
        CMD,       // texts=[npcId, placeKey]         send an NPC somewhere (existing nav system)
        PAUSE,     // texts=[npcId]                   freeze an NPC's schedule movement
        RESUME,    // texts=[npcId]
        SET,       // texts=[flag]
        QUIZ,      //                                 midterm quiz mini-game
        TITLE,     // texts=[banner]                  transient top-of-screen notice (non-blocking)
        END        //                                 story finished
    }

    public final Type type;
    public final double[] nums;
    public final String[] texts;

    public Step(Type type, double[] nums, String[] texts) {
        this.type = type;
        this.nums = nums != null ? nums : new double[0];
        this.texts = texts != null ? texts : new String[0];
    }

    public double num(int i) { return nums.length > i ? nums[i] : 0; }
    public String text(int i) { return texts.length > i ? texts[i] : ""; }
}
