package com.example.sounddebug;

import com.example.sounddebug.modules.SoundDebug;
import com.mojang.logging.LogUtils;
import meteordevelopment.meteorclient.addons.GithubRepo;
import meteordevelopment.meteorclient.addons.MeteorAddon;
import meteordevelopment.meteorclient.systems.modules.Modules;
import org.slf4j.Logger;

public class SoundDebugAddon extends MeteorAddon {
    public static final Logger LOG = LogUtils.getLogger();

    @Override
    public void onInitialize() {
        LOG.info("Initializing SoundDebug Addon for Meteor Client 1.21.11");

        // Register SoundDebug cleanly into Meteor's standard Render category
        // Right-clicking SoundDebug in the Render category in ClickGUI opens all module settings
        Modules.get().add(new SoundDebug());
    }

    @Override
    public String getPackage() {
        // Required by Meteor's Orbit event bus to register @EventHandler methods in this package
        return "com.example.sounddebug";
    }

    @Override
    public GithubRepo getRepo() {
        return new GithubRepo("MeteorDevelopment", "meteor-addon-template");
    }
}
