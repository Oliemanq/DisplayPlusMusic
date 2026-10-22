/**
 * Escapes a string by using a <div> and textContent, which escapes &, <, and >.
 * This is used specifically for lyric word-level rendering to match original behavior.
 */
export function escapeHtmlLyric(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Escapes a string using regex for &, <, >, ", and '.
 * This is used for general UI rendering to match original behavior.
 */
export function escapeHtmlUI(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
