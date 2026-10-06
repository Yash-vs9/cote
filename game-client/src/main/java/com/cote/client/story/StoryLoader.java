package com.cote.client.story;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Parses the line-based story DSL into chapters of steps.
 *
 * Format (one instruction per line, '|' separates arguments, '#' starts a comment):
 *   CHAPTER 2|Welcome to the School Life of Your Dreams
 *   NARR Ayanokouji's internal monologue text...
 *   ME My spoken reply...
 *   NPC horikita|Her scripted line...
 *   OBJ Head to the Main Gate.
 *   GOTO gate|8                <- Landmarks key + trigger radius (default 8 m)
 *   GOTOAT 22|-49|5            <- raw x,z + radius
 *   WAIT 08:15                 <- block until in-game clock passes 08:15
 *   TIME 08:00                 <- jump the in-game clock
 *   TELEPORT 0|1.4|88
 *   CHOICE Prompt?|Option one|Option two|Option three
 *   RESPONSE 0|me|Line shown only if option 1 was picked[|flagToSet]
 *   RESPONSE 1|horikita|Line shown only if option 2 was picked
 *   SPAWN manabu|52|32|180     <- extraId x z yaw(deg, optional)
 *   DESPAWN manabu
 *   CMD kushida|gate           <- route an NPC to a Landmarks key
 *   PAUSE horikita / RESUME horikita
 *   SET flagname
 *   LABEL scene_name           <- jump target (chapter-scoped)
 *   JUMP scene_name            <- unconditional redirect to a LABEL
 *   IF flagname JUMP scene_name<- redirect only when the flag is set
 *   GOTO_CH 6                  <- jump to the start of chapter 6
 *   QUIZ
 *   TITLE May 1 - a new month begins
 *   END
 */
public final class StoryLoader {

    private StoryLoader() {}

    public static List<Chapter> load(String resourcePath) throws IOException {
        List<String> lines = new ArrayList<>();
        try (InputStream in = StoryLoader.class.getClassLoader().getResourceAsStream(resourcePath)) {
            if (in == null) throw new IOException("Story script not found: " + resourcePath);
            BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
            String raw;
            while ((raw = r.readLine()) != null) lines.add(raw);
        }
        return parseLines(lines);
    }

    /** Core parser over raw script lines (package-private so tests can feed synthetic scripts). */
    static List<Chapter> parseLines(List<String> rawLines) throws IOException {
        List<Chapter> chapters = new ArrayList<>();
        int curNum = 0;
        String curTitle = "";
        List<Step> steps = new ArrayList<>();
        for (String raw : rawLines) {
                String line = stripBom(raw).trim();
                if (line.isEmpty() || line.startsWith("#") || line.startsWith("//")) continue;
                // First whitespace-separated token is the directive; the rest holds '|' args.
                java.util.regex.Matcher ws = java.util.regex.Pattern.compile("\\s").matcher(line);
                String head, rest;
                if (ws.find()) {
                    head = line.substring(0, ws.start()).trim();
                    rest = line.substring(ws.end()).trim();
                } else {
                    head = line;
                    rest = "";
                }
                String[] parts = splitArgs(rest);

                Step s = parse(head.toUpperCase(), parts);
                if (s == null) continue;
                if (s.type == Step.Type.CHAPTER) {
                    if (!steps.isEmpty()) chapters.add(new Chapter(curNum, curTitle, steps));
                    curNum = (int) s.num(0);
                    curTitle = s.text(0);
                    steps = new ArrayList<>();
                } else {
                    steps.add(s);
                }
        }
        if (!steps.isEmpty()) chapters.add(new Chapter(curNum, curTitle, steps));
        validate(chapters);
        return chapters;
    }

    /** Rejects broken branches at load time instead of dead-airing at runtime. */
    private static void validate(List<Chapter> chapters) throws IOException {
        java.util.Set<Integer> chapterNumbers = new java.util.HashSet<>();
        for (Chapter ch : chapters) {
            if (!chapterNumbers.add(ch.number))
                throw new IOException("Duplicate chapter number " + ch.number);
        }
        for (Chapter ch : chapters) {
            java.util.Map<String, Integer> labels = new java.util.HashMap<>();
            for (int i = 0; i < ch.steps.size(); i++) {
                Step s = ch.steps.get(i);
                if (s.type == Step.Type.LABEL) {
                    if (labels.putIfAbsent(s.text(0), i) != null)
                        throw new IOException("Chapter " + ch.number + ": duplicate label '" + s.text(0) + "'");
                }
            }
            for (Step s : ch.steps) {
                if (s.type == Step.Type.JUMP && !labels.containsKey(s.text(0)))
                    throw new IOException("Chapter " + ch.number + ": JUMP to unknown label '" + s.text(0) + "'");
                if (s.type == Step.Type.IF_JUMP && !labels.containsKey(s.text(1)))
                    throw new IOException("Chapter " + ch.number + ": IF JUMP to unknown label '" + s.text(1) + "'");
                if (s.type == Step.Type.GOTO_CH && !chapterNumbers.contains((int) s.num(0)))
                    throw new IOException("Chapter " + ch.number + ": GOTO_CH to unknown chapter " + (int) s.num(0));
            }
        }
    }

    private static Step parse(String type, String[] a) {
        switch (type) {
            case "CHAPTER": {
                int n = 0;
                String title = a.length > 1 ? a[1] : "";
                try { n = Integer.parseInt(a[0].trim()); } catch (Exception ignored) {}
                return new Step(Step.Type.CHAPTER, new double[]{n}, new String[]{title});
            }
            case "NARR":    return new Step(Step.Type.NARR, null, new String[]{join(a)});
            case "ME":      return new Step(Step.Type.ME, null, new String[]{join(a)});
            case "NPC":     return a.length >= 2 ? new Step(Step.Type.NPC, null, new String[]{a[0].trim(), joinTail(a)}) : null;
            case "OBJ":     return new Step(Step.Type.OBJ, null, new String[]{join(a)});
            case "GOTO":    return new Step(Step.Type.GOTO, new double[]{a.length > 1 ? parseD(a[1], 8) : 8}, new String[]{a[0].trim()});
            case "GOTOAT":  return new Step(Step.Type.GOTOAT,
                    new double[]{parseD(idx(a,0), 0), parseD(idx(a,1), 0), parseD(idx(a,2), 8)}, null);
            case "WAIT":    return new Step(Step.Type.WAIT, new double[]{parseClock(a.length > 0 ? a[0] : "00:00")}, null);
            case "TIME":    return new Step(Step.Type.TIME, new double[]{parseClock(a.length > 0 ? a[0] : "08:00")}, null);
            case "TELEPORT":return new Step(Step.Type.TELEPORT,
                    new double[]{parseD(idx(a,0), 0), parseD(idx(a,1), 1.4), parseD(idx(a,2), 40)}, null);
            case "CHOICE": {
                String[] texts = new String[a.length];
                for (int i = 0; i < a.length; i++) texts[i] = a[i].trim();
                return new Step(Step.Type.CHOICE, null, texts);
            }
            case "RESPONSE": {
                // RESPONSE idx|speaker|body[|flag] — an optional trailing 4th arg sets a flag
                // when this branch plays, letting choices steer later IF JUMP steps.
                if (a.length < 3) return null;
                String[] texts;
                if (a.length >= 4 && !a[a.length - 1].isBlank()) {
                    StringBuilder body = new StringBuilder();
                    for (int i = 2; i < a.length - 1; i++) body.append(i > 2 ? "|" : "").append(a[i]);
                    texts = new String[]{a[1].trim(), body.toString().trim(), a[a.length - 1].trim()};
                } else {
                    texts = new String[]{a[1].trim(), joinTailFrom(a, 2)};
                }
                return new Step(Step.Type.RESPONSE, new double[]{parseD(a[0], 0)}, texts);
            }
            case "SPAWN":   return new Step(Step.Type.SPAWN,
                    new double[]{parseD(idx(a,1), 0), parseD(idx(a,2), 0), parseD(idx(a,3), 0)},
                    new String[]{a[0].trim()});
            case "DESPAWN": return new Step(Step.Type.DESPAWN, null, new String[]{a[0].trim()});
            case "CMD":     return a.length >= 2 ? new Step(Step.Type.CMD, null, new String[]{a[0].trim(), a[1].trim()}) : null;
            case "PAUSE":   return new Step(Step.Type.PAUSE, null, new String[]{a[0].trim()});
            case "RESUME":  return new Step(Step.Type.RESUME, null, new String[]{a[0].trim()});
            case "SET":     return new Step(Step.Type.SET, null, new String[]{a[0].trim()});
            case "LABEL":   return a.length >= 1 && !a[0].isBlank()
                                    ? new Step(Step.Type.LABEL, null, new String[]{a[0].trim()}) : null;
            case "JUMP":    return a.length >= 1 ? new Step(Step.Type.JUMP, null, new String[]{a[0].trim()}) : null;
            case "IF": {
                // "IF flag JUMP label" — the rest segment is space-separated here (no pipes).
                String[] tok = String.join(" ", a).trim().split("\\s+");
                return tok.length >= 3 && "JUMP".equalsIgnoreCase(tok[1])
                        ? new Step(Step.Type.IF_JUMP, null, new String[]{tok[0].trim(), tok[2].trim()}) : null;
            }
            case "GOTO_CH": return a.length >= 1 ? new Step(Step.Type.GOTO_CH, new double[]{parseD(a[0], -1)}, null) : null;
            case "QUIZ":    return new Step(Step.Type.QUIZ, null, null);
            case "TITLE":   return new Step(Step.Type.TITLE, null, new String[]{join(a)});
            case "END":     return new Step(Step.Type.END, null, null);
            default:        return null; // unknown directive -> skip silently
        }
    }

    private static String idx(String[] a, int i) { return a.length > i ? a[i] : "0"; }

    private static double parseD(String s, double def) {
        try { return Double.parseDouble(s.trim()); } catch (Exception e) { return def; }
    }

    private static double parseClock(String hhmm) {
        try {
            String[] p = hhmm.trim().split(":");
            return Integer.parseInt(p[0]) * 60 + Integer.parseInt(p[1]);
        } catch (Exception e) { return 480; }
    }

    private static String join(String[] a) {
        return String.join("|", a).trim();
    }

    private static String joinTail(String[] a) {
        StringBuilder sb = new StringBuilder();
        for (int i = 1; i < a.length; i++) sb.append(i > 1 ? "|" : "").append(a[i]);
        return sb.toString().trim();
    }

    private static String joinTailFrom(String[] a, int from) {
        StringBuilder sb = new StringBuilder();
        for (int i = from; i < a.length; i++) sb.append(i > from ? "|" : "").append(a[i]);
        return sb.toString().trim();
    }

    /** Split on '|', but keep escaped pipes (\|) as literal characters. */
    private static String[] splitArgs(String s) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\\' && i + 1 < s.length()) { cur.append(s.charAt(++i)); continue; }
            if (c == '|') { out.add(cur.toString()); cur.setLength(0); continue; }
            cur.append(c);
        }
        out.add(cur.toString());
        return out.toArray(new String[0]);
    }

    private static String stripBom(String s) {
        if (s != null && !s.isEmpty() && s.charAt(0) == '\uFEFF') return s.substring(1);
        return s;
    }
}
