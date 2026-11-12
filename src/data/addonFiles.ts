export interface AddonFile {
  path: string;
  name: string;
  language: 'java' | 'groovy' | 'json' | 'properties' | 'yaml' | 'text';
  description: string;
  badge: string;
  content: string;
}

export interface SimulatedSoundPreset {
  id: string;
  label: string;
  soundId: string;
  packetType: 'PlaySoundS2CPacket' | 'PlaySoundFromEntityS2CPacket' | 'WorldEventS2CPacket';
  defaultDistance: number;
  category: 'Global / Long-Range' | 'Block / Stash' | 'Entity / Combat';
  description: string;
}

export const SIMULATED_SOUND_PRESETS: SimulatedSoundPreset[] = [
  {
    id: 'thunder',
    label: 'Lightning Thunder',
    soundId: 'minecraft:entity.lightning_bolt.thunder',
    packetType: 'PlaySoundS2CPacket',
    defaultDistance: 640,
    category: 'Global / Long-Range',
    description: 'Long-range weather sound packet sent by server when lightning strikes near a loaded player.'
  },
  {
    id: 'wither',
    label: 'Wither Spawn (Global 1023)',
    soundId: 'minecraft:entity.wither.spawn',
    packetType: 'WorldEventS2CPacket',
    defaultDistance: 1280,
    category: 'Global / Long-Range',
    description: 'Global WorldEventS2CPacket (ID 1023) broadcast across dimension or within server view distance.'
  },
  {
    id: 'end_portal',
    label: 'End Portal Activation (1038)',
    soundId: 'minecraft:block.end_portal.spawn',
    packetType: 'WorldEventS2CPacket',
    defaultDistance: 920,
    category: 'Global / Long-Range',
    description: 'Global portal activation packet revealing the exact 16x16 stronghold portal room chunk.'
  },
  {
    id: 'tnt',
    label: 'Explosion / TNT Detonation',
    soundId: 'minecraft:entity.generic.explode',
    packetType: 'PlaySoundS2CPacket',
    defaultDistance: 195,
    category: 'Block / Stash',
    description: 'High-volume PlaySoundS2CPacket (volume 4.0) audible across multiple chunks.'
  },
  {
    id: 'chest',
    label: 'Ender Chest / Barrel Open',
    soundId: 'minecraft:block.ender_chest.open',
    packetType: 'PlaySoundS2CPacket',
    defaultDistance: 48,
    category: 'Block / Stash',
    description: 'Standard block interaction sound originating inside an underground or concealed base chunk.'
  },
  {
    id: 'piston',
    label: 'Piston Contraption',
    soundId: 'minecraft:block.piston.extend',
    packetType: 'PlaySoundS2CPacket',
    defaultDistance: 84,
    category: 'Block / Stash',
    description: 'Redstone contraption or farm activity detected passively via incoming S2C sound packet.'
  },
  {
    id: 'totem',
    label: 'Totem of Undying Pop',
    soundId: 'minecraft:item.totem.use',
    packetType: 'PlaySoundFromEntityS2CPacket',
    defaultDistance: 140,
    category: 'Entity / Combat',
    description: 'Entity-attached sound packet resolved via mc.world.getEntityById(packet.getEntityId()).'
  }
];

export const GITHUB_WORKFLOW_YAML = `name: Build SoundDebug Addon (MC 1.21.11)

on:
  push:
  pull_request:
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '21'

      - name: Set up Gradle 9.2.0
        uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: '9.2.0'

      - name: Build Addon JAR with Gradle
        run: gradle build --no-daemon

      - name: Upload Compiled JAR Artifact
        uses: actions/upload-artifact@v4
        with:
          name: sound-debug-addon-1.21.11
          path: |
            build/libs/*.jar
            !build/libs/*-sources.jar
            !build/libs/*-dev.jar
          if-no-files-found: error

      - name: Publish GitHub Pre-Release (Automated)
        if: github.event_name == 'push' || github.event_name == 'workflow_dispatch'
        continue-on-error: true
        uses: softprops/action-gh-release@v2
        with:
          tag_name: latest-build
          name: "SoundDebug 1.21.11 (Automated Build)"
          prerelease: true
          files: |
            build/libs/*.jar`;

export const ADDON_FILES: AddonFile[] = [
  {
    path: '.github/workflows/build.yml',
    name: 'build.yml',
    language: 'yaml',
    badge: 'GitHub Actions',
    description: 'Automated GitHub Actions cloud builder. Provisions JDK 21 + Gradle 9.2.0 (no gradlew binary needed) and outputs sound-debug-addon-1.0.0.jar to Actions Artifacts & Releases.',
    content: GITHUB_WORKFLOW_YAML
  },
  {
    path: 'src/main/java/com/example/sounddebug/modules/SoundDebug.java',
    name: 'SoundDebug.java',
    language: 'java',
    badge: 'Core Module',
    description: 'Complete Meteor 1.21.11 module with passive S2C sound packet listeners, 16x16 chunk box + tall beam renderer, 3D floating nametag, and test trigger.',
    content: `package com.example.sounddebug.modules;

import meteordevelopment.meteorclient.events.packets.PacketEvent;
import meteordevelopment.meteorclient.events.render.Render2DEvent;
import meteordevelopment.meteorclient.events.render.Render3DEvent;
import meteordevelopment.meteorclient.gui.GuiTheme;
import meteordevelopment.meteorclient.gui.widgets.WWidget;
import meteordevelopment.meteorclient.gui.widgets.containers.WHorizontalList;
import meteordevelopment.meteorclient.gui.widgets.pressable.WButton;
import meteordevelopment.meteorclient.renderer.Renderer2D;
import meteordevelopment.meteorclient.renderer.ShapeMode;
import meteordevelopment.meteorclient.renderer.text.TextRenderer;
import meteordevelopment.meteorclient.settings.BoolSetting;
import meteordevelopment.meteorclient.settings.ColorSetting;
import meteordevelopment.meteorclient.settings.DoubleSetting;
import meteordevelopment.meteorclient.settings.EnumSetting;
import meteordevelopment.meteorclient.settings.IntSetting;
import meteordevelopment.meteorclient.settings.Setting;
import meteordevelopment.meteorclient.settings.SettingGroup;
import meteordevelopment.meteorclient.systems.config.Config;
import meteordevelopment.meteorclient.systems.modules.Categories;
import meteordevelopment.meteorclient.systems.modules.Module;
import meteordevelopment.meteorclient.utils.render.NametagUtils;
import meteordevelopment.meteorclient.utils.render.color.Color;
import meteordevelopment.meteorclient.utils.render.color.SettingColor;
import meteordevelopment.orbit.EventHandler;
import net.minecraft.entity.Entity;
import net.minecraft.network.packet.s2c.play.PlaySoundFromEntityS2CPacket;
import net.minecraft.network.packet.s2c.play.PlaySoundS2CPacket;
import net.minecraft.network.packet.s2c.play.WorldEventS2CPacket;
import net.minecraft.util.Formatting;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.ChunkPos;
import net.minecraft.util.math.MathHelper;
import org.joml.Vector3d;

import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class SoundDebug extends Module {
    private final SettingGroup sgGeneral = settings.getDefaultGroup();
    private final SettingGroup sgRender = settings.createGroup("Render");

    // -------------------- General Settings --------------------

    private final Setting<Double> range = sgGeneral.add(new DoubleSetting.Builder()
        .name("range")
        .description("Maximum detection distance in blocks for incoming sound packets.")
        .defaultValue(256.0)
        .min(1.0)
        .max(4096.0)
        .sliderMin(16.0)
        .sliderMax(2048.0)
        .build()
    );

    private final Setting<Integer> tall = sgGeneral.add(new IntSetting.Builder()
        .name("tall")
        .description("Controls how tall the vertical green chunk highlight/beam extends upward in blocks.")
        .defaultValue(150)
        .min(10)
        .max(320)
        .sliderMin(10)
        .sliderMax(320)
        .build()
    );

    private final Setting<Integer> displayDuration = sgGeneral.add(new IntSetting.Builder()
        .name("display-duration")
        .description("How many seconds the green chunk and tall indicator stay visible after a sound plays.")
        .defaultValue(5)
        .min(1)
        .max(60)
        .sliderMin(1)
        .sliderMax(30)
        .build()
    );

    private final Setting<Boolean> test = sgGeneral.add(new BoolSetting.Builder()
        .name("test")
        .description("Immediately triggers a simulated sound highlight on the chunk underneath the player and resets.")
        .defaultValue(false)
        .onChanged(enabled -> {
            if (enabled) {
                triggerTestHighlight();
                resetTestToggle();
            }
        })
        .build()
    );

    private final Setting<Boolean> chatFeedback = sgGeneral.add(new BoolSetting.Builder()
        .name("chat-feedback")
        .description("Prints the detected sound name, chunk coordinates, and distance in client-side chat.")
        .defaultValue(true)
        .build()
    );

    private final Setting<Boolean> catchGlobalEvents = sgGeneral.add(new BoolSetting.Builder()
        .name("catch-global-events")
        .description("Also detects long-range WorldEventS2CPacket sounds (Wither spawn, End Portal, Dragon death).")
        .defaultValue(true)
        .build()
    );

    // -------------------- Render Settings --------------------

    private final Setting<ShapeMode> shapeMode = sgRender.add(new EnumSetting.Builder<ShapeMode>()
        .name("shape-mode")
        .description("How the 16x16 chunk box and vertical pillar are rendered.")
        .defaultValue(ShapeMode.Both)
        .build()
    );

    private final Setting<SettingColor> fillColor = sgRender.add(new ColorSetting.Builder()
        .name("fill-color")
        .description("The fill color of the 16x16 chunk highlight and tall vertical beam.")
        .defaultValue(new SettingColor(0, 255, 0, 75))
        .build()
    );

    private final Setting<SettingColor> lineColor = sgRender.add(new ColorSetting.Builder()
        .name("line-color")
        .description("The outline color of the 16x16 chunk highlight and tall vertical beam.")
        .defaultValue(new SettingColor(0, 255, 0, 255))
        .build()
    );

    private final Setting<Boolean> fadeOut = sgRender.add(new BoolSetting.Builder()
        .name("fade-out")
        .description("Smoothly fades out the chunk highlight and tall beam as the duration timer expires.")
        .defaultValue(true)
        .build()
    );

    private final Setting<Boolean> renderInnerBeam = sgRender.add(new BoolSetting.Builder()
        .name("render-inner-beam")
        .description("Renders a concentrated vertical pillar at the exact sound coordinates inside the chunk.")
        .defaultValue(true)
        .build()
    );

    private final Setting<Boolean> renderNametag = sgRender.add(new BoolSetting.Builder()
        .name("render-nametag")
        .description("Renders a floating 3D 'Sound Detected' nametag with sound name and distance.")
        .defaultValue(true)
        .build()
    );

    private final Setting<Double> nametagScale = sgRender.add(new DoubleSetting.Builder()
        .name("nametag-scale")
        .description("Scale of the 3D floating 'Sound Detected' nametag.")
        .defaultValue(1.15)
        .min(0.4)
        .max(3.0)
        .sliderMin(0.5)
        .sliderMax(2.5)
        .visible(renderNametag::get)
        .build()
    );

    // Active chunk sound highlights keyed by ChunkPos for thread-safe access between network & render threads
    private final Map<ChunkPos, SoundHighlight> activeHighlights = new ConcurrentHashMap<>();

    // Reusable objects for rendering to avoid per-frame allocations
    private final Color workingFill = new Color();
    private final Color workingLine = new Color();
    private final Color nametagBg = new Color(0, 0, 0, 140);
    private final Color nametagTitleColor = new Color(85, 255, 85, 255);
    private final Color nametagMetaColor = new Color(230, 230, 230, 255);
    private final Vector3d nametagPos = new Vector3d();

    public SoundDebug() {
        super(
            Categories.Render,
            "sound-debug",
            "Passively detects incoming sound packets and highlights their 16x16 chunk with a tall vertical beam."
        );
    }

    @Override
    public void onDeactivate() {
        activeHighlights.clear();
    }

    @Override
    public String getInfoString() {
        return activeHighlights.isEmpty() ? null : Integer.toString(activeHighlights.size());
    }

    /**
     * Adds convenient action buttons at the bottom of the module's ClickGUI settings window
     * in addition to the "test" BoolSetting above.
     */
    @Override
    public WWidget getWidget(GuiTheme theme) {
        WHorizontalList list = theme.horizontalList();

        WButton testButton = list.add(theme.button("Test Chunk Highlight Under Player")).expandX().widget();
        testButton.action = this::triggerTestHighlight;

        WButton clearButton = list.add(theme.button("Clear Highlights")).expandX().widget();
        clearButton.action = activeHighlights::clear;

        return list;
    }

    private void resetTestToggle() {
        if (test.get()) {
            test.set(false);
        }
    }

    /**
     * Immediately triggers a simulated sound highlight on the 16x16 chunk directly underneath the player
     * using the current Tall height setting so visuals can be previewed without waiting for an in-game sound.
     */
    public void triggerTestHighlight() {
        if (mc.player == null || mc.world == null) return;

        double px = mc.player.getX();
        double py = mc.player.getY();
        double pz = mc.player.getZ();

        recordDetectedSound("minecraft:block.note_block.pling (TEST)", px, py, pz, 0.0);
    }

    /**
     * 100% Passive Client-Side Packet Listener.
     * Never sends packets, never spoofs rotations, and never cancels or mutates packets.
     */
    @EventHandler
    private void onReceivePacket(PacketEvent.Receive event) {
        if (mc.player == null || mc.world == null) return;

        if (event.packet instanceof PlaySoundS2CPacket packet) {
            double soundX = packet.getX();
            double soundY = packet.getY();
            double soundZ = packet.getZ();

            double distance = computeDistanceToPlayer(soundX, soundY, soundZ);
            if (distance <= range.get()) {
                String soundId = packet.getSound().value().id().toString();
                recordDetectedSound(soundId, soundX, soundY, soundZ, distance);
            }
        } else if (event.packet instanceof PlaySoundFromEntityS2CPacket packet) {
            Entity entity = mc.world.getEntityById(packet.getEntityId());
            if (entity == null) return;

            double soundX = entity.getX();
            double soundY = entity.getY();
            double soundZ = entity.getZ();

            double distance = computeDistanceToPlayer(soundX, soundY, soundZ);
            if (distance <= range.get()) {
                String soundId = packet.getSound().value().id().toString();
                recordDetectedSound(soundId, soundX, soundY, soundZ, distance);
            }
        } else if (catchGlobalEvents.get() && event.packet instanceof WorldEventS2CPacket packet) {
            // Catch vanilla global sound events (e.g., 1023 Wither Spawn, 1028 Dragon Death, 1038 End Portal)
            int eventId = packet.getEventId();
            if (packet.isGlobal() || eventId == 1023 || eventId == 1028 || eventId == 1038) {
                BlockPos pos = packet.getPos();
                double soundX = pos.getX() + 0.5;
                double soundY = pos.getY() + 0.5;
                double soundZ = pos.getZ() + 0.5;

                double distance = computeDistanceToPlayer(soundX, soundY, soundZ);
                if (distance <= range.get()) {
                    String eventName = switch (eventId) {
                        case 1023 -> "minecraft:entity.wither.spawn";
                        case 1028 -> "minecraft:entity.ender_dragon.death";
                        case 1038 -> "minecraft:block.end_portal.spawn";
                        default -> "minecraft:world_event." + eventId;
                    };
                    recordDetectedSound(eventName, soundX, soundY, soundZ, distance);
                }
            }
        }
    }

    private double computeDistanceToPlayer(double x, double y, double z) {
        double dx = mc.player.getX() - x;
        double dy = mc.player.getY() - y;
        double dz = mc.player.getZ() - z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    private void recordDetectedSound(String soundId, double x, double y, double z, double distance) {
        int chunkX = MathHelper.floor(x) >> 4;
        int chunkZ = MathHelper.floor(z) >> 4;
        ChunkPos chunkPos = new ChunkPos(chunkX, chunkZ);

        String shortName = soundId.startsWith("minecraft:")
            ? soundId.substring("minecraft:".length())
            : soundId;

        SoundHighlight highlight = new SoundHighlight(
            chunkPos,
            shortName,
            x,
            y,
            z,
            distance,
            System.currentTimeMillis()
        );

        activeHighlights.put(chunkPos, highlight);

        if (chatFeedback.get()) {
            info(
                "Sound Detected: %s%s%s at Chunk [%d, %d] (%s%.1fm%s)",
                Formatting.GREEN,
                shortName,
                Formatting.GRAY,
                chunkX,
                chunkZ,
                Formatting.AQUA,
                distance,
                Formatting.GRAY
            );
        }
    }

    // -------------------- 3D World Rendering --------------------

    @EventHandler
    private void onRender3D(Render3DEvent event) {
        if (mc.player == null || mc.world == null || activeHighlights.isEmpty()) return;

        long now = System.currentTimeMillis();
        long maxAgeMs = displayDuration.get() * 1000L;
        int pillarHeight = tall.get();

        Iterator<Map.Entry<ChunkPos, SoundHighlight>> iterator = activeHighlights.entrySet().iterator();
        while (iterator.hasNext()) {
            Map.Entry<ChunkPos, SoundHighlight> mapEntry = iterator.next();
            SoundHighlight entry = mapEntry.getValue();

            long ageMs = now - entry.timestampMs;
            if (ageMs >= maxAgeMs) {
                iterator.remove();
                continue;
            }

            double lifeFactor = fadeOut.get()
                ? MathHelper.clamp(1.0 - ((double) ageMs / (double) maxAgeMs), 0.05, 1.0)
                : 1.0;

            SettingColor baseFill = fillColor.get();
            SettingColor baseLine = lineColor.get();

            workingFill.set(
                baseFill.r,
                baseFill.g,
                baseFill.b,
                (int) Math.round(baseFill.a * lifeFactor)
            );
            workingLine.set(
                baseLine.r,
                baseLine.g,
                baseLine.b,
                (int) Math.round(baseLine.a * lifeFactor)
            );

            // 16x16 Chunk world coordinates
            double chunkMinX = entry.chunkPos.getStartX();
            double chunkMinZ = entry.chunkPos.getStartZ();
            double chunkMaxX = chunkMinX + 16.0;
            double chunkMaxZ = chunkMinZ + 16.0;

            double baseY = entry.soundY;
            double topY = baseY + pillarHeight;

            // 1. Render the 16x16 chunk base highlight pad at the sound's Y level
            event.renderer.box(
                chunkMinX, baseY, chunkMinZ,
                chunkMaxX, baseY + 0.15, chunkMaxZ,
                workingFill, workingLine,
                shapeMode.get(), 0
            );

            // 2. Render the tall 16x16 vertical chunk pillar extending upward by \`tall\` blocks
            event.renderer.box(
                chunkMinX, baseY, chunkMinZ,
                chunkMaxX, topY, chunkMaxZ,
                workingFill, workingLine,
                shapeMode.get(), 0
            );

            // 3. Optional inner beacon beam at the exact sound origin inside the chunk
            if (renderInnerBeam.get()) {
                double beamRadius = 0.45;
                event.renderer.box(
                    entry.soundX - beamRadius, baseY, entry.soundZ - beamRadius,
                    entry.soundX + beamRadius, topY, entry.soundZ + beamRadius,
                    workingFill, workingLine,
                    ShapeMode.Both, 0
                );

                // Center vertical line from sound origin to top of pillar
                event.renderer.line(
                    entry.soundX, baseY, entry.soundZ,
                    entry.soundX, topY, entry.soundZ,
                    workingLine
                );
            }
        }
    }

    // -------------------- 3D Floating Nametag Rendering --------------------

    @EventHandler
    private void onRender2D(Render2DEvent event) {
        if (!renderNametag.get() || mc.player == null || mc.world == null || activeHighlights.isEmpty()) return;

        long now = System.currentTimeMillis();
        long maxAgeMs = displayDuration.get() * 1000L;
        boolean shadow = Config.get().customFont.get();
        int pillarHeight = tall.get();

        for (SoundHighlight entry : activeHighlights.values()) {
            long ageMs = now - entry.timestampMs;
            if (ageMs >= maxAgeMs) continue;

            // Position the floating 3D nametag above the chunk center along the tall pillar
            double centerX = entry.chunkPos.getStartX() + 8.0;
            double centerZ = entry.chunkPos.getStartZ() + 8.0;
            double labelY = entry.soundY + Math.min(pillarHeight * 0.6, 48.0);

            nametagPos.set(centerX, labelY, centerZ);

            if (!NametagUtils.to2D(nametagPos, nametagScale.get())) continue;

            double currentDistance = computeDistanceToPlayer(entry.soundX, entry.soundY, entry.soundZ);
            String headerText = "Sound Detected ";
            String detailText = String.format(
                Locale.ROOT,
                "[%s] (%.1fm)",
                entry.shortSoundName,
                currentDistance
            );

            TextRenderer text = TextRenderer.get();
            NametagUtils.begin(nametagPos, event.drawContext);

            double headerWidth = text.getWidth(headerText, shadow);
            double detailWidth = text.getWidth(detailText, shadow);
            double totalWidth = headerWidth + detailWidth;
            double halfWidth = totalWidth / 2.0;
            double textHeight = text.getHeight(shadow);

            // Render dark translucent nametag background
            Renderer2D.COLOR.begin();
            Renderer2D.COLOR.quad(
                -halfWidth - 4,
                -textHeight - 3,
                totalWidth + 8,
                textHeight + 6,
                nametagBg
            );
            Renderer2D.COLOR.render();

            // Render "Sound Detected [sound_name] (distance)" text
            text.beginBig();
            double cursorX = -halfWidth;
            double cursorY = -textHeight;
            cursorX = text.render(headerText, cursorX, cursorY, nametagTitleColor, shadow);
            text.render(detailText, cursorX, cursorY, nametagMetaColor, shadow);
            text.end();

            NametagUtils.end(event.drawContext);
        }
    }

    private record SoundHighlight(
        ChunkPos chunkPos,
        String shortSoundName,
        double soundX,
        double soundY,
        double soundZ,
        double initialDistance,
        long timestampMs
    ) {}
}`
  },
  {
    path: 'src/main/java/com/example/sounddebug/SoundDebugAddon.java',
    name: 'SoundDebugAddon.java',
    language: 'java',
    badge: 'Entrypoint',
    description: 'Main MeteorAddon entrypoint class registering SoundDebug in Categories.Render and exposing the package for Orbit @EventHandler scanning.',
    content: `package com.example.sounddebug;

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
}`
  },
  {
    path: 'src/main/resources/fabric.mod.json',
    name: 'fabric.mod.json',
    language: 'json',
    badge: 'Mod Metadata',
    description: 'Fabric mod configuration targeting Minecraft 1.21.11, Java 21, and registering the meteor entrypoint.',
    content: `{
  "schemaVersion": 1,
  "id": "sound-debug-addon",
  "version": "\${version}",
  "name": "SoundDebug Addon",
  "description": "Passive client-side sound packet visualizer & 16x16 chunk pillar highlighter for Meteor Client 1.21.11.",
  "authors": [
    "SoundDebugDev"
  ],
  "contact": {
    "sources": "https://github.com/MeteorDevelopment/meteor-addon-template"
  },
  "icon": "assets/sounddebug/icon.png",
  "environment": "client",
  "entrypoints": {
    "meteor": [
      "com.example.sounddebug.SoundDebugAddon"
    ]
  },
  "mixins": [
    "sounddebug.mixins.json"
  ],
  "custom": {
    "meteor-client:color": "0,255,100",
    "modmenu": {
      "parent": {
        "id": "meteor-client"
      }
    }
  },
  "depends": {
    "java": ">=21",
    "minecraft": ["\${mc_version}", "1.21.11"],
    "meteor-client": "*"
  }
}`
  },
  {
    path: 'build.gradle',
    name: 'build.gradle',
    language: 'groovy',
    badge: 'Build Script',
    description: 'Fabric Loom 1.14-SNAPSHOT build configuration with Meteor Client 1.21.11-SNAPSHOT Maven repositories and Yarn 1.21.11+build.3 mappings.',
    content: `plugins {
    id "fabric-loom" version "1.14-SNAPSHOT"
    id "java"
}

base {
    archivesName = project.archives_base_name
    version = project.mod_version
    group = project.maven_group
}

repositories {
    maven {
        name = "meteor-maven"
        url = "https://maven.meteordev.org/releases"
    }
    maven {
        name = "meteor-maven-snapshots"
        url = "https://maven.meteordev.org/snapshots"
    }
    mavenCentral()
}

dependencies {
    // Minecraft & Fabric (1.21.11)
    minecraft "com.mojang:minecraft:\${project.minecraft_version}"
    mappings "net.fabricmc:yarn:\${project.yarn_mappings}:v2"
    modImplementation "net.fabricmc:fabric-loader:\${project.loader_version}"

    // Meteor Client (1.21.11)
    modImplementation "meteordevelopment:meteor-client:\${project.meteor_version}"
}

processResources {
    def propertyMap = [
        "version"   : project.version,
        "mc_version": project.minecraft_version
    ]

    inputs.properties(propertyMap)
    filteringCharset = "UTF-8"

    filesMatching("fabric.mod.json") {
        expand(propertyMap)
    }
}

tasks.withType(JavaCompile).configureEach {
    it.options.encoding = "UTF-8"
    it.options.release = 21
    it.options.compilerArgs.add("-Xlint:deprecation")
    it.options.compilerArgs.add("-Xlint:unchecked")
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
    withSourcesJar()
}

jar {
    inputs.property("archivesName", project.base.archivesName.get())

    from("LICENSE") {
        rename { "\${it}_\${inputs.properties.archivesName}" }
    }
}`
  },
  {
    path: 'gradle.properties',
    name: 'gradle.properties',
    language: 'properties',
    badge: 'Versions',
    description: 'Defines Minecraft 1.21.11, Yarn 1.21.11+build.3, Fabric Loader 0.18.2, Loom 1.14-SNAPSHOT, and Meteor 1.21.11-SNAPSHOT versions.',
    content: `# Fabric & Gradle Properties for Minecraft 1.21.11
org.gradle.jvmargs=-Xmx2G
org.gradle.parallel=true

# Mod Metadata
mod_version=1.0.0
maven_group=com.example.sounddebug
archives_base_name=sound-debug-addon

# Minecraft & Fabric Versions (MC 1.21.11)
minecraft_version=1.21.11
yarn_mappings=1.21.11+build.3
loader_version=0.18.2
loom_version=1.14-SNAPSHOT

# Meteor Client Version (MC 1.21.11)
meteor_version=1.21.11-SNAPSHOT`
  },
  {
    path: 'settings.gradle',
    name: 'settings.gradle',
    language: 'groovy',
    badge: 'Gradle Setup',
    description: 'Configures the FabricMC Maven plugin repository required to resolve fabric-loom.',
    content: `pluginManagement {
    repositories {
        maven {
            name = "Fabric"
            url = "https://maven.fabricmc.net/"
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

rootProject.name = "sound-debug-addon"`
  },
  {
    path: 'gradle/wrapper/gradle-wrapper.properties',
    name: 'gradle-wrapper.properties',
    language: 'properties',
    badge: 'Gradle 9.2.0',
    description: 'Specifies Gradle 9.2.0 required by Fabric Loom 1.14-SNAPSHOT for Minecraft 1.21.11.',
    content: `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-9.2.0-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists`
  },
  {
    path: 'src/main/resources/sounddebug.mixins.json',
    name: 'sounddebug.mixins.json',
    language: 'json',
    badge: 'Mixin Config',
    description: 'Mixin configuration file referenced in fabric.mod.json (no mixins needed because SoundDebug uses Meteor Orbit events passively).',
    content: `{
  "required": true,
  "package": "com.example.sounddebug.mixin",
  "compatibilityLevel": "JAVA_21",
  "client": [],
  "injectors": {
    "defaultRequire": 1
  }
}`
  },
  {
    path: 'LICENSE',
    name: 'LICENSE',
    language: 'text',
    badge: 'License',
    description: 'MIT License file packaged into the compiled JAR by the Gradle jar task.',
    content: `MIT License

Copyright (c) 2026 SoundDebug Addon

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`
  },
  {
    path: '.gitignore',
    name: '.gitignore',
    language: 'text',
    badge: 'Git Config',
    description: 'Standard Git ignore rules for Gradle, Fabric Loom, and IDE folders.',
    content: `# Gradle
.gradle/
build/
out/

# Fabric / Minecraft Run Directory
run/

# IDEs
.idea/
*.iml
.vscode/
.settings/
.classpath
.project
bin/

# OS
.DS_Store
Thumbs.db`
  }
];
