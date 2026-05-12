import { waitForEvenAppBridge } from "@evenrealities/even_hub_sdk";
import spotifyPresenter from './spotifyPresenter';
import { blankScreen, unblankScreen, isScreenBlanked } from '../view/GlassesView';

function devlog(level: 'INFO' | 'WARN' | 'DEBUG', tag: string, msg: string) {
    const ts = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    console.log(`[${ts} ${level}  ${tag}] ${msg}`);
}

export async function eventHandler() {
    const bridge = await waitForEvenAppBridge();

    const unsubscribe = bridge.onEvenHubEvent((event) => {
        // Dump raw event payload for diagnosis
        devlog('DEBUG', 'event', `raw=${JSON.stringify(event)}`);

        // Double-click → toggle blank/wake. Fires on either list or text container.
        if (event.sysEvent) {
            const type = event.sysEvent.eventType ?? 0;
            const src = event.sysEvent.eventSource ?? 0;
            devlog('INFO', 'event', `sysEvent type=${type} source=${src}`);
            if (type === 3) {
                if (isScreenBlanked()) {
                    devlog('INFO', 'event', 'double-click → unblank');
                    unblankScreen();
                } else {
                    devlog('INFO', 'event', 'double-click → blank');
                    blankScreen();
                }
                return;
            }
            // Single-click on text container also routes here (type 0). Treat as tap
            // only when no list capture active — currently list captures, so this is a no-op.
            return;
        }

        // While blanked, swallow single taps & swipes
        if (isScreenBlanked()) {
            devlog('INFO', 'event', 'event suppressed (screen blanked)');
            return;
        }

        if (event.listEvent) {
            const idx = event.listEvent.currentSelectItemIndex ?? 0;
            const name = event.listEvent.currentSelectItemName ?? '';
            devlog('INFO', 'event', `listEvent idx=${idx} name="${name}"`);
            switch (idx) {
                case 1:
                    spotifyPresenter.song_pauseplay();
                    break;
                case 2:
                    spotifyPresenter.song_forward();
                    break;
                default:
                    spotifyPresenter.song_back();
                    break;
            }
        } else if (event.textEvent) {
            devlog('INFO', 'event', `textEvent type=${event.textEvent.eventType ?? 0}`);
        } else {
            devlog('INFO', 'event', 'audio/unknown event');
        }
    });

    return unsubscribe;
}
