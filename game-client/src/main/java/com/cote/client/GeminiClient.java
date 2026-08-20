package com.cote.client;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class GeminiClient {
    private static final String API_KEY = System.getenv("GEMINI_API_KEY");
    private static final HttpClient client = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_2)
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public static String generateResponse(String systemPrompt, String userMessage) {
        if (API_KEY == null || API_KEY.isEmpty()) {
            return "[Gemini API Key missing! Set GEMINI_API_KEY env var.]";
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
                    "maxOutputTokens": 150
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
    
    // Very rudimentary extraction without dragging in Jackson just for one field
    private static String extractTextFromJson(String json) {
        String target = "\"text\": \"";
        int start = json.indexOf(target);
        if (start == -1) return "No response generated.";
        start += target.length();
        int end = json.indexOf("\"", start);
        if (end == -1) return "Failed to parse.";
        String text = json.substring(start, end);
        return text.replace("\\n", "\n").replace("\\\"", "\"");
    }
}
