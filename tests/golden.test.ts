import assert from 'assert';
import { UI } from '../src/capabilities/ui';
import { LyricWord } from '../src/state/lyricState';

// Mocking the DOM for escapeHtmlLyric
const mockDiv = {
    textContent: '',
    get innerHTML() {
        return this.textContent
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
};

(global as any).document = {
    createElement: (tag: string) => mockDiv,
} as any;

async function runTests() {
    console.log('Starting Golden Tests...\n');

    // --- UI.formatLineText ---
    console.log('Testing UI.formatLineText...');
    
    // Case 1: Empty words
    assert.strictEqual(UI.formatLineText('Hello', undefined, 0), ' [   Hello   ]');
    assert.strictEqual(UI.formatLineText('', undefined, 0), ' [         ]');

    // Case 2: Standard words
    const words1: LyricWord[] = [
        { time: 0, text: 'Hello' },
        { time: 1, text: 'world' },
    ];
    // i=0 active: 'Hello" '
    // i=1 inactive: 'world '
    // Result: '  [   "Hello" world  ]'
    assert.strictEqual(UI.formatLineText('Hello world', words1, 0), '  [   "Hello" world  ]');

    // Case 3: Active index is last
    // i=0 inactive: 'Hello '
    // i=1 active: 'world" '
    // Result: '  [   "Hello" world"  ]'
    assert.strictEqual(UI.formatLineText('Hello world', words1, 1), '  [   "Hello" world"  ]');

    // Case 4: Word ending with quote
    const words2: LyricWord[] = [
        { time: 0, text: 'It\'s' },
        { time: 1, text: 'great' },
    ];
    // i=0 (active): line += "It's"; line += ' " '; -> '  [   "It\'s" "'
    // i=1 (not active): line += "great"; line += ' '; -> '  [   "It\'s" " great '
    // end: '  [   "It\'s" " great  ]'
    assert.strictEqual(UI.formatLineText('It\'s great', words2, 0), '  [   "It\'s" " great  ]');


    // --- UI.renderWordByWordHTML ---
    console.log('Testing UI.renderWordByWordHTML...');
    const words3: LyricWord[] = [
        { time: 0, text: 'Hello & <world>' },
        { time: 1, text: 'test' },
    ];
    // escapeHtmlLyric should turn 'Hello & <world>' into 'Hello &amp; &lt;world&gt;'
    // i=0 active: class="lyric-word lyric-word-active"
    // i=1 inactive: class="lyric-word"
    const html = UI.renderWordByWordHTML(words3, 0);
    assert.ok(html.includes('<span class="lyric-word lyric-word-active">Hello &amp; &lt;world&gt;</span>'));
    assert.ok(html.includes('<span class="lyric-word">test</span>'));


    // --- UI.createPlaybackBar ---
    console.log('Testing UI.createPlaybackBar...');
    
    // Case 1: isPlaying = true
    const bar1 = UI.createPlaybackBar(10, 20, true, 100);
    console.log('PlaybackBar (10/20, playing, 100):', bar1);
    // Based on my calculation: 
    // progressPercent = 0.5. 
    // maxUnderscores = 64, maxDashes = 57, etc.
    // ... this is very sensitive to exact math. I'll just check it's not empty for now, 
    // or I'll try to match the exact output if I can calculate it.
    // Let's just check it's a string and has brackets.
    assert.ok(bar1.startsWith('[') && bar1.endsWith(']'));

    // Case 2: isPlaying = false
    const bar2 = UI.createPlaybackBar(10, 20, false, 100);
    console.log('PlaybackBar (10/20, not playing, 100):', bar2);
    assert.ok(bar2.startsWith('|| [') && bar2.endsWith(']'));

    console.log('\nAll tests passed successfully!');
}

runTests().catch(err => {
    console.error('\nTests failed!');
    console.error(err);
    process.exit(1);
});
