package com.example.sounddebug.modules;

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
import net.minecraft.text.Text;
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

            // 2. Render the tall 16x16 vertical chunk pillar extending upward by `tall` blocks
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
}
