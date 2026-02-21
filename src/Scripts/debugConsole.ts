
export function enableMobileConsole() {
    const consoleDiv = document.createElement('div');
    consoleDiv.style.position = 'fixed';
    consoleDiv.style.bottom = '0';
    consoleDiv.style.left = '0';
    consoleDiv.style.width = '100%';
    consoleDiv.style.height = '400px';
    consoleDiv.style.backgroundColor = 'rgba(0,0,0,0.8)';
    consoleDiv.style.color = '#0f0';
    consoleDiv.style.overflowY = 'scroll';
    consoleDiv.style.fontFamily = 'monospace';
    consoleDiv.style.fontSize = '12px';
    consoleDiv.style.zIndex = '9999';
    consoleDiv.style.padding = '5px';
    consoleDiv.style.pointerEvents = 'none'; // Click through
    document.body.appendChild(consoleDiv);

    const logToScreen = (message: any, color: string = '#0f0') => {
        const line = document.createElement('div');
        line.style.color = color;
        line.style.borderBottom = '1px solid #333';

        if (message instanceof Error) {
            line.textContent = `${message.name}: ${message.message}\n${message.stack || ''}`;
        } else if (typeof message === 'object') {
            try {
                line.textContent = JSON.stringify(message, null, 2);
            } catch (e) {
                line.textContent = message.toString();
            }
        } else {
            line.textContent = message;
        }

        consoleDiv.appendChild(line);
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
    };

    const originalLog = console.log;
    console.log = (...args) => {
        originalLog(...args);
        args.forEach(arg => logToScreen(arg));
    };

    const originalError = console.error;
    console.error = (...args) => {
        originalError(...args);
        args.forEach(arg => logToScreen(arg, '#f00')); // Red for errors
    };
    // const originalWarn = console.warn;
    // console.warn = (...args) => {
    //     originalWarn(...args);
    //     args.forEach(arg => logToScreen(arg, '#ff0')); // Yellow for warnings
    // };

    console.log("Mobile console enabled.");
}
