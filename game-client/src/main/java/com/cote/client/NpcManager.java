package com.cote.client;

import com.jme3.asset.AssetManager;
import com.jme3.math.ColorRGBA;
import com.jme3.math.Vector3f;
import com.jme3.scene.Node;
import java.util.ArrayList;
import java.util.List;

public class NpcManager {
    
    private List<CharacterRig> npcs = new ArrayList<>();
    
    public void init(AssetManager assetManager, Node rootNode) {
        // Red blazer color
        ColorRGBA blazer = new ColorRGBA(0.7f, 0.2f, 0.25f, 1.0f);
        ColorRGBA skin = new ColorRGBA(0.95f, 0.79f, 0.65f, 1.0f);
        
        // Ayanokouji
        CharacterRig ayanokouji = new CharacterRig(assetManager, skin, blazer, new ColorRGBA(0.66f, 0.58f, 0.47f, 1.0f), "medium", false);
        ayanokouji.root.setLocalTranslation(new Vector3f(12, 0, -22)); // Class 1-D or Main path
        rootNode.attachChild(ayanokouji.root);
        npcs.add(ayanokouji);
        
        // Horikita
        CharacterRig horikita = new CharacterRig(assetManager, skin, blazer, new ColorRGBA(0.07f, 0.07f, 0.07f, 1.0f), "long", true);
        horikita.root.setLocalTranslation(new Vector3f(14, 0, -22));
        rootNode.attachChild(horikita.root);
        npcs.add(horikita);
        
        // Kushida
        CharacterRig kushida = new CharacterRig(assetManager, skin, blazer, new ColorRGBA(0.9f, 0.76f, 0.65f, 1.0f), "medium", true);
        kushida.root.setLocalTranslation(new Vector3f(44, 0, 78)); // Mall entrance
        rootNode.attachChild(kushida.root);
        npcs.add(kushida);
        
        // Sudou
        CharacterRig sudou = new CharacterRig(assetManager, skin, blazer, new ColorRGBA(0.6f, 0.15f, 0.1f, 1.0f), "short", false);
        sudou.root.setLocalTranslation(new Vector3f(62, 0, 30)); // Gym
        rootNode.attachChild(sudou.root);
        npcs.add(sudou);
        
        // Hirata
        CharacterRig hirata = new CharacterRig(assetManager, skin, blazer, new ColorRGBA(0.88f, 0.75f, 0.43f, 1.0f), "medium", false);
        hirata.root.setLocalTranslation(new Vector3f(0, 0, -5)); // Central Park
        rootNode.attachChild(hirata.root);
        npcs.add(hirata);
    }
    
    public void update(float tpf) {
        for (CharacterRig npc : npcs) {
            // For now, they just stand idle!
            npc.updateAnimation(tpf, false);
        }
    }
}
