package com.cote.client;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class GeminiClient {
    private static final String API_KEY = loadKey();
    private static final HttpClient client = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_2)
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    /** Key comes from the GEMINI_API_KEY env var, or a git-ignored file: game-client/gemini.key */
    private static String loadKey() {
        String env = System.getenv("GEMINI_API_KEY");
        if (env != null && !env.trim().isEmpty()) return env.trim();
        for (String path : new String[]{"gemini.key", "game-client/gemini.key"}) {
            try {
                java.nio.file.Path p = java.nio.file.Paths.get(path);
                if (java.nio.file.Files.exists(p)) {
                    String k = java.nio.file.Files.readString(p).trim();
                    if (!k.isEmpty()) return k;
                }
            } catch (Exception ignored) {}
        }
        return null;
    }

    public static String generateResponse(String systemPrompt, String userMessage) {
        if (API_KEY == null || API_KEY.isEmpty()) {
            return "[Gemini API key missing. Put it in game-client/gemini.key or set GEMINI_API_KEY.]";
        }

        try {
            String jsonPayload = String.format("""
                {
                  "system_instruction": {
                    "parts": [
                      { "text": "%s" }
                    ]
                  },
                  "contents": [
                    {
                      "parts": [
                        { "text": "%s" }
                      ]
                    }
                  ],
                  "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 256,
                    "thinkingConfig": { "thinkingBudget": 0 }
                  }
                }
                """, escapeJson(systemPrompt), escapeJson(userMessage));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + API_KEY))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() == 200) {
                return extractTextFromJson(response.body());
            } else {
                return "[API Error " + response.statusCode() + "]: " + response.body();
            }
        } catch (Exception e) {
            e.printStackTrace();
            return "[Failed to contact Gemini API]";
        }
    }

    private static String escapeJson(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
    }
    
    // Lightweight extraction of the model's text, tolerant of spacing and escaped quotes.
    private static String extractTextFromJson(String json) {
        int key = json.indexOf("\"text\"");
        if (key == -1) return "No response generated.";
        int start = json.indexOf('"', json.indexOf(':', key) + 1);
        if (start == -1) return "Failed to parse.";
        start++; // move past the opening quote
        StringBuilder sb = new StringBuilder();
        for (int i = start; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '\\' && i + 1 < json.length()) { // handle escape sequences
                char n = json.charAt(++i);
                switch (n) {
                    case 'n': sb.append('\n'); break;
                    case 't': sb.append('\t'); break;
                    case 'r': break;
                    case 'u':
                        if (i + 4 < json.length()) {
                            try { sb.append((char) Integer.parseInt(json.substring(i + 1, i + 5), 16)); } catch (Exception ignored) {}
                            i += 4;
                        }
                        break;
                    default: sb.append(n); // \" \\ \/ etc.
                }
            } else if (c == '"') {
                break; // unescaped closing quote
            } else {
                sb.append(c);
            }
        }
        return sb.toString().trim();
    }
}
