package com.cote.simulation;

import javafx.application.Platform;
import javafx.embed.swing.JFXPanel;
import javafx.scene.Scene;
import javafx.scene.web.WebView;
import javax.swing.*;
import java.awt.*;

public class SimulationVisualizer {
    private final SimulationEngine engine;
    private final JFrame frame;

    public SimulationVisualizer(SimulationEngine engine) {
        this.engine = engine;
        this.frame = new JFrame("COTE Java Embedded Client");
        this.frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        this.frame.setSize(1280, 720);
        this.frame.setLocationRelativeTo(null);

        // Create the JFXPanel for WebView
        JFXPanel jfxPanel = new JFXPanel();
        this.frame.add(jfxPanel, BorderLayout.CENTER);

        // Initialize JavaFX
        Platform.runLater(() -> {
            WebView webView = new WebView();
            // Since we know the server is running on 8080, we load the index.html
            webView.getEngine().load("http://localhost:8080/index.html");
            jfxPanel.setScene(new Scene(webView));
        });

        this.frame.setVisible(true);
    }
}
