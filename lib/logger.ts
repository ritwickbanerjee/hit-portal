// Development-only logging utility
// In production, these will be no-ops

const isDev = process.env.NODE_ENV === 'development';

export const devLog = (...args: any[]) => {
    if (isDev) {
        console.log(...args);
    }
};

export const devError = (...args: any[]) => {
    if (isDev) {
        console.error(...args);
    }
};

export const devWarn = (...args: any[]) => {
    if (isDev) {
        console.warn(...args);
    }
};

// For student portal - completely silent
export const studentLog = () => { };
export const studentError = () => { };
export const studentWarn = () => { };
